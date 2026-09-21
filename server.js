const path = require("node:path");
const fs = require("node:fs");
const express = require("express");
const cors = require("cors");
const YTMusic = require("ytmusic-api");
const { spawn, execFile } = require("node:child_process");
const { PassThrough } = require("node:stream");
const { promisify } = require("node:util");

const app = express();
const port = process.env.PORT || 3000;
const ytmusic = new YTMusic();
const execFileAsync = promisify(execFile);
const youtubeApiKey = process.env.YOUTUBE_API_KEY;
const ytdlpPath = process.env.YTDLP_PATH || (process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");
const audioCacheDirectory = path.join(__dirname, "audio-cache");
const configuredCacheLimit = Number.parseInt(process.env.AUDIO_CACHE_LIMIT || "10", 10);
const audioCacheLimit = Number.isInteger(configuredCacheLimit) && configuredCacheLimit > 0
	? configuredCacheLimit
	: 10;
const activeDownloads = new Map();
const ytdlpRuntimeArgs = process.env.YTDLP_JS_RUNTIME
	? ["--js-runtimes", process.env.YTDLP_JS_RUNTIME]
	: [];

// Concurrency Queue to prevent RAM spikes by limiting active yt-dlp subprocesses
const MAX_CONCURRENT_YTDLP = 2;
let activeYtdlpCount = 0;
const ytdlpQueue = [];

function acquireYtdlpSlot() {
	return new Promise((resolve) => {
		if (activeYtdlpCount < MAX_CONCURRENT_YTDLP) {
			activeYtdlpCount++;
			resolve(() => releaseYtdlpSlot());
		} else {
			ytdlpQueue.push(resolve);
		}
	});
}

function releaseYtdlpSlot() {
	if (ytdlpQueue.length > 0) {
		const next = ytdlpQueue.shift();
		next(() => releaseYtdlpSlot());
	} else {
		activeYtdlpCount = Math.max(0, activeYtdlpCount - 1);
	}
}

async function execFileAsyncWithLimit(file, args, options = {}) {
	const releaseSlot = await acquireYtdlpSlot();
	try {
		return await execFileAsync(file, args, {
			maxBuffer: 5 * 1024 * 1024,
			...options
		});
	} finally {
		releaseSlot();
	}
}

const directUrlCache = new Map();
const MAX_DIRECT_URL_CACHE_SIZE = 100;

function setDirectUrlCache(key, value) {
	if (directUrlCache.size >= MAX_DIRECT_URL_CACHE_SIZE) {
		const oldestKey = directUrlCache.keys().next().value;
		if (oldestKey) directUrlCache.delete(oldestKey);
	}
	directUrlCache.set(key, value);
}

// Periodic cleanup of expired entries every 15 minutes
setInterval(() => {
	const now = Date.now();
	for (const [key, item] of directUrlCache.entries()) {
		if (!item || now >= item.expiresAt) {
			directUrlCache.delete(key);
		}
	}
}, 15 * 60 * 1000).unref();
function formatNetscapeCookies(rawInput) {
	if (!rawInput || typeof rawInput !== "string") return null;

	let text = rawInput.trim();

	if (!text.includes("# Netscape") && !text.includes("\t") && !text.includes("=")) {
		try {
			const decoded = Buffer.from(text, "base64").toString("utf-8");
			if (decoded.includes("=") || decoded.includes("\t") || decoded.includes("# Netscape")) {
				text = decoded.trim();
			}
		} catch {}
	}

	if (text.includes("# Netscape") || text.includes("\t")) {
		if (!text.startsWith("# Netscape HTTP Cookie File")) {
			text = "# Netscape HTTP Cookie File\n" + text;
		}
		return text;
	}

	if (text.includes("=")) {
		const lines = ["# Netscape HTTP Cookie File"];
		const pairs = text.split(";");
		for (const pair of pairs) {
			const trimmed = pair.trim();
			if (!trimmed) continue;
			const eqIdx = trimmed.indexOf("=");
			if (eqIdx > 0) {
				const name = trimmed.substring(0, eqIdx).trim();
				const value = trimmed.substring(eqIdx + 1).trim();
				lines.push(`.youtube.com\tTRUE\t/\tTRUE\t2147483647\t${name}\t${value}`);
			}
		}
		if (lines.length > 1) {
			return lines.join("\n");
		}
	}

	return null;
}

const cookiesFilePath = path.join(__dirname, "cookies.txt");
if (process.env.YOUTUBE_COOKIES) {
	try {
		const formattedCookies = formatNetscapeCookies(process.env.YOUTUBE_COOKIES);
		if (formattedCookies) {
			fs.writeFileSync(cookiesFilePath, formattedCookies);
			console.log("[Audio] Formatted and wrote YOUTUBE_COOKIES env variable to cookies.txt");
		} else {
			console.warn("[Audio] Could not format YOUTUBE_COOKIES env variable into Netscape format.");
		}
	} catch (e) {
		console.warn("[Audio] Failed to write YOUTUBE_COOKIES:", e.message);
	}
}

const ytdlpNetworkArgs = [
	"--force-ipv4",
	"--extractor-args",
	"youtube:player_client=mweb,android,web",
	...(process.env.YTDLP_PROXY ? ["--proxy", process.env.YTDLP_PROXY] : []),
	...(fs.existsSync(cookiesFilePath) ? ["--cookies", cookiesFilePath] : [])
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

async function safeYtmusicCall(action) {
	try {
		return await action();
	} catch (error) {
		console.warn("[YTMusic] API call failed, re-initializing session...", error.message || error);
		try {
			await ytmusic.initialize();
			return await action();
		} catch (retryError) {
			console.error("[YTMusic] Re-initialization retry failed:", retryError.message || retryError);
			throw retryError;
		}
	}
}

async function ytdlpSearchFallback(query) {
	try {
		const { stdout } = await execFileAsyncWithLimit(ytdlpPath, [
			`ytsearch12:${query}`,
			"--dump-single-json",
			"--flat-playlist",
			"--skip-download",
			"--no-warnings",
			...ytdlpRuntimeArgs,
			...ytdlpNetworkArgs
		], { timeout: 10000 });

		const data = JSON.parse(stdout);
		const entries = Array.isArray(data.entries) ? data.entries : [];
		return entries.map((entry) => ({
			videoId: entry.id,
			name: entry.title || "Unknown Track",
			artist: { name: entry.uploader || entry.channel || "YouTube" },
			thumbnails: [{ url: `https://img.youtube.com/vi/${entry.id}/hqdefault.jpg` }],
			duration: entry.duration || 0
		}));
	} catch (err) {
		console.error("ytdlpSearchFallback error:", err.message || err);
		return [];
	}
}

app.get("/api/search", async (req, res) => {
	const query = String(req.query.q || "").trim();

	if (!query) {
		return res.status(400).json({ error: 'Query parameter "q" is required' });
	}

	try {
		let songs = [];
		try {
			songs = await safeYtmusicCall(() => ytmusic.searchSongs(query));
		} catch (primaryErr) {
			console.warn("[Search] Primary YTMusic search failed, using yt-dlp search fallback...", primaryErr.message);
			songs = await ytdlpSearchFallback(query);
		}

		if (!songs || songs.length === 0) {
			songs = await ytdlpSearchFallback(query);
		}

		res.json(await filterEmbeddableSongs(songs));
	} catch (error) {
		console.error("Search endpoint error:", error);
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

const defaultAudioFormat = "249/250/139/ba[abr<=70]/ba[abr<=96]/ba[ext=webm]/ba[ext=m4a]/bestaudio[abr<=96]/ba/bestaudio/best";

async function getDirectAudioUrl(videoId) {
	const getUrlArgs = [
		"--quiet",
		"--no-warnings",
		"--no-playlist",
		...ytdlpRuntimeArgs,
		...ytdlpNetworkArgs,
		"-g",
		"-f", defaultAudioFormat,
		`https://www.youtube.com/watch?v=${videoId}`
	];
	const { stdout } = await execFileAsyncWithLimit(ytdlpPath, getUrlArgs, { timeout: 25000 });
	const directUrl = stdout.trim().split(/\r?\n/)[0];
	if (!directUrl || !directUrl.startsWith("http")) {
		throw new Error("Invalid extracted audio URL");
	}
	return directUrl;
}

function triggerBackgroundDiskPreload(videoId, audioPath) {
	if (fs.existsSync(audioPath)) return;
	const currentArgs = [
		"--quiet",
		"--no-warnings",
		"--no-progress",
		"--no-playlist",
		...ytdlpRuntimeArgs,
		...ytdlpNetworkArgs,
		"-f", defaultAudioFormat,
		"-o", audioPath,
		`https://www.youtube.com/watch?v=${videoId}`
	];
	execFileAsyncWithLimit(ytdlpPath, currentArgs, { timeout: 120000 })
		.then(() => enforceAudioCacheLimit(audioPath))
		.catch(() => {});
}

async function handleHybridAudioStreaming(videoId, res) {
	const safeVideoId = videoId.replace(/[^a-zA-Z0-9_-]/g, "");
	const audioPath = path.join(audioCacheDirectory, `${safeVideoId}.m4a`);

	await fs.promises.mkdir(audioCacheDirectory, { recursive: true });

	// 1. If song is already in local cache, serve directly from disk (0.01s instant play)
	try {
		const stat = await fs.promises.stat(audioPath);
		if (stat.size > 64 * 1024) {
			return res.sendFile(audioPath, {
				acceptRanges: true,
				cacheControl: false,
				maxAge: 0
			});
		}
	} catch {}

	// 2. Check if direct CDN URL is cached in memory (valid for 3 hours)
	const cached = directUrlCache.get(safeVideoId);
	if (cached && Date.now() < cached.expiresAt) {
		triggerBackgroundDiskPreload(videoId, audioPath);
		return res.redirect(302, cached.url);
	}

	// 3. Fast-extract direct YouTube CDN audio URL with yt-dlp (-g) and 302 Redirect (~1s)
	try {
		const directUrl = await getDirectAudioUrl(videoId);
		setDirectUrlCache(safeVideoId, {
			url: directUrl,
			expiresAt: Date.now() + 3 * 3600 * 1000
		});

		triggerBackgroundDiskPreload(videoId, audioPath);
		return res.redirect(302, directUrl);
	} catch (extractError) {
		console.warn(`[Stream Direct URL fallback] Direct extraction failed for ${videoId}, using pipe streaming:`, extractError.message);
	}

	// 4. Fallback to real-time pipe streaming if direct extraction failed
	const ytdlpArgs = [
		"--quiet",
		"--no-warnings",
		"--no-progress",
		"--no-playlist",
		...ytdlpRuntimeArgs,
		...ytdlpNetworkArgs,
		"-o", "-",
		"-f", defaultAudioFormat,
		`https://www.youtube.com/watch?v=${videoId}`
	];

	const releaseSlot = await acquireYtdlpSlot();
	const ytdlpProcess = spawn(ytdlpPath, ytdlpArgs);
	let slotReleased = false;
	const safeRelease = () => {
		if (!slotReleased) {
			slotReleased = true;
			releaseSlot();
		}
	};

	const passThrough = new PassThrough();
	const fileStream = fs.createWriteStream(audioPath);

	const cleanup = () => {
		safeRelease();
		try { ytdlpProcess.kill("SIGKILL"); } catch {}
		try { fileStream.destroy(); } catch {}
	};

	res.on("close", () => {
		if (!res.writableEnded) {
			cleanup();
			fs.promises.unlink(audioPath).catch(() => {});
		} else {
			safeRelease();
		}
	});

	res.setHeader("Content-Type", "audio/mp4");
	res.setHeader("Accept-Ranges", "bytes");

	ytdlpProcess.stdout.pipe(passThrough);
	passThrough.pipe(res);
	passThrough.pipe(fileStream);

	fileStream.on("finish", () => {
		enforceAudioCacheLimit(audioPath).catch(() => {});
	});

	ytdlpProcess.on("error", (err) => {
		console.error(`[Stream Error] yt-dlp spawn failed for ${videoId}:`, err.message);
		cleanup();
		fs.promises.unlink(audioPath).catch(() => {});
		if (!res.headersSent) {
			res.status(502).json({ error: "Streaming failed", detail: err.message });
		}
	});

	ytdlpProcess.stderr.on("data", (data) => {
		const stderr = data.toString();
		if (stderr.includes("does not look like a Netscape format cookies file")) {
			console.warn("[Stream] Deleting invalid cookies.txt...");
			try { fs.unlinkSync(cookiesFilePath); } catch {}
		}
	});
}

app.get("/api/audio/preload", async (req, res) => {
	const videoId = String(req.query.id || "").trim();
	if (!videoId) return res.status(400).json({ error: "Video ID is required" });

	try {
		const safeVideoId = videoId.replace(/[^a-zA-Z0-9_-]/g, "");
		const audioPath = path.join(audioCacheDirectory, `${safeVideoId}.m4a`);

		// 1. Fast pre-resolve direct YouTube CDN Audio URL into memory cache if missing
		const cached = directUrlCache.get(safeVideoId);
		if (!cached || Date.now() >= cached.expiresAt) {
			getDirectAudioUrl(videoId)
				.then((directUrl) => {
					directUrlCache.set(safeVideoId, {
						url: directUrl,
						expiresAt: Date.now() + 3 * 3600 * 1000
					});
				})
				.catch((err) => {
					console.warn(`[Audio Preload] Direct URL extraction failed for ${videoId}:`, err.message);
				});
		}

		// 2. Trigger background disk caching
		triggerBackgroundDiskPreload(videoId, audioPath);

		res.json({ ok: true, preloading: videoId });
	} catch (error) {
		res.status(500).json({ error: "Preload trigger failed" });
	}
});

app.get("/api/audio", async (req, res) => {
	const videoId = String(req.query.id || "").trim();

	if (!videoId) return res.status(400).send("Video ID is required");

	try {
		await handleHybridAudioStreaming(videoId, res);
	} catch (error) {
		console.error("Audio stream failed:", error.message || error);
		if (!res.headersSent) {
			res.status(502).json({ error: "Audio extraction failed", detail: getExtractorError(error) });
		}
	}
});

app.get("/api/recommendations", async (req, res) => {
	const videoId = String(req.query.id || "").trim();

	if (!videoId) return res.status(400).json({ error: "Video ID is required" });

	try {
		const recommendations = await safeYtmusicCall(() => ytmusic.getUpNexts(videoId));
		res.json(recommendations);
	} catch (error) {
		console.error("Recommendations failed:", error);
		res.status(502).json({ error: "Failed to fetch recommendations" });
	}
});

function shuffleArray(array) {
	const arr = [...array];
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

app.get("/api/playlists", async (req, res) => {
	try {
		const categoryPool = [
			{ query: "Arijit Singh", title: "Arijit Singh Hits", author: "Play LooP" },
			{ query: "Latest Hindi Songs", title: "Latest Hindi Hits", author: "Play LooP" },
			{ query: "Phonk Beats", title: "Phonk Drift & Bass", author: "Play LooP" },
			{ query: "Global Top Hits", title: "Global Top 50", author: "Play LooP" },
			{ query: "Lofi Chill Beats", title: "Chill Lofi Mix", author: "Play LooP" },
			{ query: "Bollywood Romantic Songs", title: "Bollywood Romance", author: "Play LooP" },
			{ query: "Punjabi Party Hits", title: "Punjabi Bangers", author: "Play LooP" },
			{ query: "EDM Dance Hits", title: "EDM Dance Party", author: "Play LooP" },
			{ query: "90s Hindi Hits", title: "90s Bollywood Classics", author: "Play LooP" },
			{ query: "Workout Hype Beats", title: "Gym & Workout Hype", author: "Play LooP" },
			{ query: "Indie India", title: "Indie India Discovery", author: "Play LooP" },
			{ query: "Sufi Melodies", title: "Soulful Sufi & Rock", author: "Play LooP" },
			{ query: "Acoustic Pop Hits", title: "Acoustic Pop Chill", author: "Play LooP" },
			{ query: "Hip Hop Beats", title: "Desi Hip Hop Heavy", author: "Play LooP" },
			{ query: "K-Pop Top Hits", title: "K-Pop Dynamite Hits", author: "Play LooP" },
			{ query: "Synthwave Retro", title: "80s Retro Synthwave", author: "Play LooP" },
			{ query: "Coke Studio Hits", title: "Coke Studio Essentials", author: "Play LooP" },
			{ query: "Sad Hindi Songs", title: "Broken Hearts & Rain", author: "Play LooP" }
		];

		const selectedCategories = shuffleArray(categoryPool).slice(0, 12);

		const fetchCategoryPlaylist = async (cat) => {
			try {
				const searchWithTimeout = Promise.race([
					safeYtmusicCall(() => ytmusic.searchPlaylists(cat.query)),
					new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2500))
				]);
				const results = await searchWithTimeout;
				if (results && results.length > 0 && results[0].playlistId) {
					const p = results[0];
					return {
						playlistId: p.playlistId,
						title: cat.title,
						author: p.author?.name || cat.author,
						thumbnail: p.thumbnails?.[p.thumbnails.length - 1]?.url || p.thumbnail || "/logo.svg",
						count: p.count || p.songCount || 25
					};
				}
			} catch (e) {
				/* fallback below */
			}
			return {
				playlistId: `QUERY:${cat.query}`,
				title: cat.title,
				author: cat.author,
				thumbnail: "/logo.svg",
				count: 20
			};
		};

		// Batch requests in chunks of 3 to prevent memory and API connection spikes
		const playlists = [];
		const chunkSize = 3;
		for (let i = 0; i < selectedCategories.length; i += chunkSize) {
			const chunk = selectedCategories.slice(i, i + chunkSize);
			const chunkResults = await Promise.all(chunk.map(fetchCategoryPlaylist));
			playlists.push(...chunkResults);
		}

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
		if (playlistId.startsWith("QUERY:")) {
			const query = playlistId.replace("QUERY:", "");
			const songs = await safeYtmusicCall(() => ytmusic.searchSongs(query));
			return res.json({
				playlistId,
				title: `${query} Mix`,
				description: `Curated collection for ${query}`,
				thumbnail: songs[0]?.thumbnails?.[songs[0].thumbnails.length - 1]?.url || "/logo.svg",
				tracks: songs.map((t) => ({
					videoId: t.videoId,
					title: t.name || t.title,
					artist: t.artist?.name || t.artists?.[0]?.name || "Various Artists",
					thumbnail: t.thumbnails?.[t.thumbnails.length - 1]?.url || t.thumbnails?.[0]?.url || "/logo.svg",
					duration: t.duration || 0
				}))
			});
		}

		const [playlistMeta, videos] = await Promise.all([
			safeYtmusicCall(() => ytmusic.getPlaylist(playlistId)).catch(() => null),
			safeYtmusicCall(() => ytmusic.getPlaylistVideos(playlistId)).catch(() => [])
		]);

		let tracks = (videos || []).map((t) => ({
			videoId: t.videoId,
			title: t.name || t.title,
			artist: t.artist?.name || t.artists?.[0]?.name || t.artist || "Various Artists",
			thumbnail: t.thumbnails?.[t.thumbnails.length - 1]?.url || t.thumbnails?.[0]?.url || "/logo.svg",
			duration: t.duration || 0
		}));

		if (tracks.length === 0) {
			const songs = await safeYtmusicCall(() => ytmusic.searchSongs(playlistId));
			tracks = songs.map((t) => ({
				videoId: t.videoId,
				title: t.name || t.title,
				artist: t.artist?.name || t.artists?.[0]?.name || "Various Artists",
				thumbnail: t.thumbnails?.[t.thumbnails.length - 1]?.url || t.thumbnails?.[0]?.url || "/logo.svg",
				duration: t.duration || 0
			}));
		}

		return res.json({
			playlistId: playlistId,
			title: playlistMeta?.name || playlistMeta?.title || "Featured Playlist",
			description: playlistMeta?.artist?.name ? `Curated by ${playlistMeta.artist.name}` : "Curated collection by Play LooP",
			thumbnail: playlistMeta?.thumbnails?.[playlistMeta.thumbnails.length - 1]?.url || tracks[0]?.thumbnail || "/logo.svg",
			tracks
		});
	} catch (error) {
		console.error("Playlist details failed, trying search fallback:", error);
		try {
			const songs = await safeYtmusicCall(() => ytmusic.searchSongs(playlistId));
			return res.json({
				playlistId,
				title: "Playlist Mix",
				description: "Curated collection by Play LooP",
				thumbnail: songs[0]?.thumbnails?.[0]?.url || "/logo.svg",
				tracks: songs.map((t) => ({
					videoId: t.videoId,
					title: t.name || t.title,
					artist: t.artist?.name || t.artists?.[0]?.name || "Various Artists",
					thumbnail: t.thumbnails?.[0]?.url || "/logo.svg",
					duration: t.duration || 0
				}))
			});
		} catch (e) {
			res.status(502).json({ error: "Failed to fetch playlist details" });
		}
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



async function enforceAudioCacheLimit(protectedPath) {
	try {
		const entries = await fs.promises.readdir(audioCacheDirectory, { withFileTypes: true });
		const cacheFiles = await Promise.all(
			entries
				.filter((entry) => entry.isFile())
				.map(async (entry) => {
					const filePath = path.join(audioCacheDirectory, entry.name);
					const stats = await fs.promises.stat(filePath).catch(() => null);
					return stats ? { filePath, modifiedAt: stats.mtimeMs } : null;
				})
		);

		const validFiles = cacheFiles.filter(Boolean);
		if (validFiles.length <= audioCacheLimit) return;

		validFiles.sort((first, second) => first.modifiedAt - second.modifiedAt);
		let filesToRemove = validFiles.length - audioCacheLimit;
		for (const file of validFiles) {
			if (filesToRemove === 0) break;
			if (file.filePath === protectedPath) continue;
			await fs.promises.rm(file.filePath, { force: true }).catch(() => {});
			filesToRemove -= 1;
		}
	} catch (err) {
		console.warn("[Cache Cleanup] Error enforcing cache limit:", err.message);
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

	const handleShutdown = (signal) => {
		console.log(`${signal} received. Closing HTTP server gracefully...`);
		server.close(() => {
			console.log("HTTP server closed.");
			process.exit(0);
		});
	};

	process.on("SIGTERM", () => handleShutdown("SIGTERM"));
	process.on("SIGINT", () => handleShutdown("SIGINT"));

	try {
		await ytmusic.initialize();
		console.log("YouTube Music API initialized successfully.");
	} catch (error) {
		console.error("Warning: Failed to initialize YouTube Music API on startup:", error.message || error);
	}
}

startServer();
