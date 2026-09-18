const path = require("node:path");
const fs = require("node:fs");
const express = require("express");
const cors = require("cors");
const YTMusic = require("ytmusic-api");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const app = express();
const port = process.env.PORT || 3000;
const ytmusic = new YTMusic();
const execFileAsync = promisify(execFile);
const youtubeApiKey = process.env.YOUTUBE_API_KEY;
const ytdlpPath = process.env.YTDLP_PATH || (process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");
const audioCacheDirectory = path.join(__dirname, "audio-cache");
const configuredCacheLimit = Number.parseInt(process.env.AUDIO_CACHE_LIMIT || "50", 10);
const audioCacheLimit = Number.isInteger(configuredCacheLimit) && configuredCacheLimit > 0
	? configuredCacheLimit
	: 50;
const activeDownloads = new Map();
const ytdlpRuntimeArgs = process.env.YTDLP_JS_RUNTIME
	? ["--js-runtimes", process.env.YTDLP_JS_RUNTIME]
	: [];
const ytdlpNetworkArgs = [
	"--force-ipv4",
	"--extractor-args",
	"youtube:player_client=android,web,ios"
];

app.use(cors());

// Healthcheck endpoint for Docker & Cloud deployments
app.get("/api/health", (req, res) => {
	res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Serve the Vite build if it exists (for Render deployment)
if (fs.existsSync(path.join(__dirname, "dist"))) {
	app.use(express.static(path.join(__dirname, "dist")));
} else {
	app.use(express.static(__dirname));
}

app.get("/api/search", async (req, res) => {
	const query = String(req.query.q || "").trim();

	if (!query) {
		return res.status(400).json({ error: 'Query parameter "q" is required' });
	}

	try {
		const songs = await ytmusic.searchSongs(query);
		res.json(await filterEmbeddableSongs(songs));
	} catch (error) {
		console.error("Search failed:", error);
		res.status(500).json({ error: "Failed to fetch search results" });
	}
});

async function filterEmbeddableSongs(songs) {
	if (!youtubeApiKey || songs.length === 0) return songs;

	const videoIds = songs.map((song) => song.videoId).filter(Boolean).join(",");
	const url = new URL("https://www.googleapis.com/youtube/v3/videos");
	url.searchParams.set("part", "status");
	url.searchParams.set("id", videoIds);
	url.searchParams.set("key", youtubeApiKey);

	try {
		const response = await fetch(url);
		if (!response.ok) throw new Error(`YouTube Data API returned ${response.status}`);
		const data = await response.json();
		const embeddableIds = new Set(
			(data.items || [])
				.filter((item) => item.status?.embeddable === true)
				.map((item) => item.id)
		);
		return songs.filter((song) => embeddableIds.has(song.videoId));
	} catch (error) {
		console.error("Embeddable video filter failed:", error);
		return songs;
	}
}

app.get("/api/audio/preload", async (req, res) => {
	const videoId = String(req.query.id || "").trim();
	if (!videoId) return res.status(400).json({ error: "Video ID is required" });

	try {
		getCachedAudio(videoId).catch((error) => {
			console.warn(`[Preload] Background pre-download warning for ${videoId}:`, error.message);
		});
		res.json({ ok: true, preloading: videoId });
	} catch (error) {
		res.status(500).json({ error: "Preload trigger failed" });
	}
});

app.get("/api/audio", async (req, res) => {
	const videoId = String(req.query.id || "").trim();

	if (!videoId) return res.status(400).send("Video ID is required");

	try {
		const audioPath = await getCachedAudio(videoId);
		res.sendFile(audioPath, {
			acceptRanges: true,
			cacheControl: false,
			maxAge: 0
		});
	} catch (error) {
		console.error("Audio proxy failed:", error);
		if (!res.headersSent) {
			res.status(502).json({ error: "Audio extraction failed", detail: getExtractorError(error) });
		}
	}
});

app.get("/api/recommendations", async (req, res) => {
	const videoId = String(req.query.id || "").trim();

	if (!videoId) return res.status(400).json({ error: "Video ID is required" });

	try {
		const recommendations = await ytmusic.getUpNexts(videoId);
		res.json(recommendations);
	} catch (error) {
		console.error("Recommendations failed:", error);
		res.status(502).json({ error: "Failed to fetch recommendations" });
	}
});

app.get("/api/playlists", async (req, res) => {
	try {
		const queries = ["Arijit Singh", "Latest Hindi Hits", "Phonk", "Global Top Hits", "Chill Lofi Beats"];
		const playlistPromises = queries.map(async (q) => {
			try {
				const results = await ytmusic.searchPlaylists(q);
				return results[0] || null;
			} catch (e) {
				return null;
			}
		});
		const rawPlaylists = await Promise.all(playlistPromises);
		const playlists = rawPlaylists.filter(Boolean).map((p) => ({
			playlistId: p.playlistId,
			title: p.title || p.name,
			author: p.author?.name || p.artist || "Play LooP",
			thumbnail: p.thumbnails?.[p.thumbnails.length - 1]?.url || p.thumbnail || "/logo.svg",
			count: p.count || p.songCount || 25
		}));
		res.json(playlists);
	} catch (error) {
		console.error("Playlists fetch failed:", error);
		res.status(500).json({ error: "Failed to fetch playlists" });
	}
});

app.get("/api/playlist", async (req, res) => {
	const playlistId = String(req.query.id || "").trim();
	if (!playlistId) return res.status(400).json({ error: "Playlist ID is required" });

	try {
		const playlist = await ytmusic.getPlaylist(playlistId);
		res.json({
			playlistId: playlist.playlistId || playlistId,
			title: playlist.title || "Featured Playlist",
			description: playlist.description || `Curated collection by ${playlist.author?.name || "Play LooP"}`,
			thumbnail: playlist.thumbnails?.[playlist.thumbnails.length - 1]?.url || "/logo.svg",
			tracks: (playlist.videos || playlist.tracks || []).map((t) => ({
				videoId: t.videoId,
				title: t.title,
				artist: t.artists?.[0]?.name || t.artist || "Various Artists",
				thumbnail: t.thumbnails?.[0]?.url || playlist.thumbnails?.[0]?.url || "/logo.svg",
				duration: t.duration || 0
			}))
		});
	} catch (error) {
		console.error("Playlist details failed:", error);
		res.status(502).json({ error: "Failed to fetch playlist details" });
	}
});

app.get("/api/health", (req, res) => {
	res.json({
		ok: true,
		ytdlpRuntime: process.env.YTDLP_JS_RUNTIME || "default"
	});
});

function getExtractorError(error) {
	return String(error.stderr || error.message || "Unknown extractor error")
		.trim()
		.split(/\r?\n/)
		.slice(-3)
		.join(" ");
}

async function getCachedAudio(videoId) {
	const safeVideoId = videoId.replace(/[^a-zA-Z0-9_-]/g, "");
	const audioPath = path.join(audioCacheDirectory, `${safeVideoId}.m4a`);

	try {
		const file = await fs.promises.stat(audioPath);
		if (file.size > 0) return audioPath;
	} catch {
	}

	if (!activeDownloads.has(videoId)) {
		const download = (async () => {
			await fs.promises.mkdir(audioCacheDirectory, { recursive: true });
			await execFileAsync(ytdlpPath, [
				"--quiet",
				"--no-warnings",
				"--no-progress",
				"--no-playlist",
				...ytdlpRuntimeArgs,
				...ytdlpNetworkArgs,
				"--no-part",
				"-f",
				"140/ba[ext=m4a]/ba[ext=webm]/bestaudio/best",
				"-x",
				"--audio-format",
				"m4a",
				"-o",
				audioPath,
				`https://www.youtube.com/watch?v=${videoId}`
			], { timeout: 120000 });
		})();

		download.catch((err) => {
			console.warn(`[Audio] Extraction download error for ${videoId}:`, err.message);
		});
		activeDownloads.set(videoId, download);
	}

	const waitForPartialOrComplete = async () => {
		for (let i = 0; i < 35; i++) {
			try {
				const stat = await fs.promises.stat(audioPath);
				if (stat.size > 64 * 1024) return audioPath;
			} catch {}
			await new Promise((resolve) => setTimeout(resolve, 150));
		}
		try {
			await activeDownloads.get(videoId);
		} catch (err) {
			console.warn(`[Audio] Download failed or timed out for ${videoId}`);
		}
		return audioPath;
	};

	try {
		await waitForPartialOrComplete();
		await enforceAudioCacheLimit(audioPath);
	} finally {
		activeDownloads.get(videoId)?.finally(() => activeDownloads.delete(videoId));
	}

	return audioPath;
}

async function enforceAudioCacheLimit(protectedPath) {
	const entries = await fs.promises.readdir(audioCacheDirectory, { withFileTypes: true });
	const audioFiles = await Promise.all(
		entries
			.filter((entry) => entry.isFile() && entry.name.endsWith(".m4a"))
			.map(async (entry) => {
				const filePath = path.join(audioCacheDirectory, entry.name);
				const stats = await fs.promises.stat(filePath);
				return { filePath, modifiedAt: stats.mtimeMs };
			})
	);

	if (audioFiles.length <= audioCacheLimit) return;

	audioFiles.sort((first, second) => first.modifiedAt - second.modifiedAt);
	let filesToRemove = audioFiles.length - audioCacheLimit;
	for (const file of audioFiles) {
		if (filesToRemove === 0) break;
		if (file.filePath === protectedPath) continue;
		await fs.promises.rm(file.filePath, { force: true });
		filesToRemove -= 1;
	}
}

// SPA fallback for client-side routing (Express 5 compatible)
app.use((req, res) => {
	const distIndex = path.join(__dirname, "dist", "index.html");
	if (fs.existsSync(distIndex)) {
		res.sendFile(distIndex);
	} else {
		res.sendFile(path.join(__dirname, "index.html"));
	}
});

async function startServer() {
	try {
		await ytmusic.initialize();
		const server = app.listen(port, () => {
			console.log(`Play LooP is running at http://localhost:${port}`);
		});
		server.on("error", (error) => {
			if (error.code === "EADDRINUSE") {
				console.error(`Port ${port} is already in use. Use the existing server or stop it before restarting.`);
			} else {
				console.error("Server failed:", error);
			}
			process.exitCode = 1;
		});
	} catch (error) {
		console.error("Failed to initialize YouTube Music API:", error);
		process.exitCode = 1;
	}
}

startServer();
