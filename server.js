const path = require("node:path");
const fs = require("node:fs");
const express = require("express");
const cors = require("cors");
const crypto = require("node:crypto");

const app = express();	
const port = process.env.PORT || 3000;

app.use(cors());

// Serve the Vite build if it exists (for Render deployment)
if (fs.existsSync(path.join(__dirname, "dist"))) {
	app.use(express.static(path.join(__dirname, "dist"), {
		etag: false,
		maxAge: 0,
		setHeaders: (res) => {
			res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
		}
	}));
} else {
	app.use(express.static(__dirname));
}

// --- JioSaavn Helper Functions ---

function decryptSaavnUrl(encryptedUrl) {
	try {
		const key = Buffer.from('38346591', 'utf8');
		const decipher = crypto.createDecipheriv('des-ecb', key, null);
		decipher.setAutoPadding(false);
		let decrypted = decipher.update(encryptedUrl, 'base64', 'utf8');
		decrypted += decipher.final('utf8');
		return decrypted.replace(/\0|[\x01-\x08\x0b-\x0c\x0e-\x1f\x7f]/g, '');
	} catch (e) {
		console.error("Decryption failed:", e);
		return null;
	}
}

async function fetchJioSaavn(callParams) {
	const url = new URL("https://www.jiosaavn.com/api.php");
	url.searchParams.set("_format", "json");
	url.searchParams.set("_marker", "0");
	url.searchParams.set("ctx", "web6dot0");
	url.searchParams.set("api_version", "4");
	
	for (const [key, value] of Object.entries(callParams)) {
		url.searchParams.set(key, value);
	}

	const res = await fetch(url.toString(), {
		headers: {
			"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
			"Cookie": "L=english"
		}
	});
	
	if (!res.ok) throw new Error(`JioSaavn API Error: ${res.status}`);
	const text = await res.text();
	// JioSaavn sometimes returns JSON wrapped in HTML comments, though with api_version=4 it should be clean
	try {
		return JSON.parse(text);
	} catch (e) {
		const cleanText = text.replace(/^<!--.*?-->/, '').trim();
		return JSON.parse(cleanText);
	}
}

function formatSong(song) {
	const encUrl = song.encrypted_media_url || song.more_info?.encrypted_media_url;
	const decUrl = encUrl ? decryptSaavnUrl(encUrl) : null;
	const highQualityUrl = decUrl ? decUrl.replace("_96", "_320").replace("_160", "_320") : null;
	
	let artistName = "Various Artists";
	if (song.more_info?.primary_artists) {
		artistName = song.more_info.primary_artists;
	} else if (song.subtitle) {
		artistName = song.subtitle;
	}

	return {
		videoId: song.id,
		title: (song.title || "").replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
		artist: artistName.replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
		thumbnail: (song.image || "").replace("150x150", "500x500"),
		duration: parseInt(song.more_info?.duration || song.duration || 0, 10),
		streamUrl: highQualityUrl
	};
}

// --- API Endpoints ---

app.get("/api/health", (req, res) => {
	res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/search", async (req, res) => {
	const query = String(req.query.q || "").trim();
	if (!query) return res.status(400).json({ error: 'Query parameter "q" is required' });

	try {
		const data = await fetchJioSaavn({ __call: "search.getResults", q: query, n: "15", p: "1" });
		if (!data || !data.results) {
			return res.json([]);
		}
		
		const songs = data.results.map(formatSong);
		res.json(songs);
	} catch (error) {
		console.error("Search endpoint error:", error);
		res.status(500).json({ error: "Failed to fetch search results" });
	}
});

app.get("/api/audio/preload", (req, res) => {
	// Not needed with direct CDN URLs, just return ok
	res.json({ ok: true });
});

app.get("/api/audio", async (req, res) => {
	const videoId = String(req.query.id || "").trim();
	if (!videoId) return res.status(400).send("Video ID is required");

	try {
		const data = await fetchJioSaavn({ __call: "song.getDetails", pids: videoId });
		let songData = data[videoId] || (data.songs && data.songs[0]);
		
		if (!songData) {
			return res.status(404).send("Song not found");
		}
		
		const formatted = formatSong(songData);
		if (formatted.streamUrl) {
			return res.redirect(302, formatted.streamUrl);
		} else {
			return res.status(404).send("Stream URL not found");
		}
	} catch (error) {
		console.error("Audio stream failed:", error);
		res.status(502).send("Audio extraction failed");
	}
});

app.get("/api/recommendations", async (req, res) => {
	const videoId = String(req.query.id || "").trim();
	if (!videoId) return res.status(400).json({ error: "Video ID is required" });

	try {
		const data = await fetchJioSaavn({ __call: "reco.getreco", pid: videoId });
		if (Array.isArray(data) && data.length > 0) {
			return res.json(data.map(formatSong));
		}
		
		// Fallback: search artist if reco fails
		const songDetails = await fetchJioSaavn({ __call: "song.getDetails", pids: videoId });
		const songData = songDetails[videoId] || (songDetails.songs && songDetails.songs[0]);
		if (songData) {
			const artist = songData.more_info?.primary_artists || songData.subtitle;
			if (artist) {
				const searchData = await fetchJioSaavn({ __call: "search.getResults", q: artist, n: "10", p: "1" });
				if (searchData && searchData.results) {
					return res.json(searchData.results.map(formatSong));
				}
			}
		}
		
		res.json([]);
	} catch (error) {
		console.error("Recommendations failed:", error);
		res.json([]);
	}
});

let playlistsCache = {
	data: null,
	lastFetched: 0,
	isFetching: false
};
const PLAYLIST_CACHE_TTL = 3 * 60 * 60 * 1000;

function shuffleArray(array) {
	const arr = [...array];
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

async function fetchPlaylistsBackground() {
	if (playlistsCache.isFetching) return;
	playlistsCache.isFetching = true;
	try {
		// JioSaavn Playlist IDs (Top charts and popular mixes)
		const categoryPool = [
			{ id: "107604313", title: "Top JioSaavn Hits" }, // Hindi Hit Songs
			{ id: "82914609", title: "Bollywood Romance" }, 
			{ id: "153492", title: "Punjabi Hits" },
			{ id: "153472", title: "Workout Hits" },
			{ id: "103632947", title: "Lofi Chill" },
			{ id: "155422452", title: "Trending Now" },
			{ id: "158284", title: "Arijit Singh Hits" },
			{ id: "111956041", title: "Desi Hip Hop" },
			{ id: "153488", title: "90s Bollywood" },
			{ id: "103233261", title: "Sufi Classics" }
		];

		const selectedCategories = shuffleArray(categoryPool).slice(0, 10);

		const playlists = [];
		for (const cat of selectedCategories) {
			try {
				const data = await fetchJioSaavn({ __call: "playlist.getDetails", listid: cat.id });
				if (data && data.listid) {
					playlists.push({
						playlistId: data.listid,
						title: cat.title || data.listname,
						author: "Play LooP",
						thumbnail: (data.image || "").replace("150x150", "500x500") || "/logo.svg",
						count: parseInt(data.list_count || "20", 10)
					});
				}
			} catch (e) {
				console.warn(`Failed to fetch playlist ${cat.id}:`, e.message);
			}
		}

		playlistsCache.data = playlists;
		playlistsCache.lastFetched = Date.now();
	} catch (error) {
		console.error("Background playlists fetch failed:", error);
	} finally {
		playlistsCache.isFetching = false;
	}
}

app.get("/api/playlists", (req, res) => {
	const now = Date.now();
	if (playlistsCache.data && (now - playlistsCache.lastFetched < PLAYLIST_CACHE_TTL)) {
		return res.json(playlistsCache.data);
	}
	if (!playlistsCache.isFetching) {
		fetchPlaylistsBackground();
	}
	if (playlistsCache.data) {
		return res.json(playlistsCache.data);
	}
	return res.json([]);
});

app.get("/api/playlist", async (req, res) => {
	const playlistId = String(req.query.id || "").trim();
	if (!playlistId) return res.status(400).json({ error: "Playlist ID is required" });

	try {
		if (playlistId.startsWith("QUERY:")) {
			const query = playlistId.replace("QUERY:", "");
			const data = await fetchJioSaavn({ __call: "search.getResults", q: query, n: "30", p: "1" });
			const tracks = (data.results || []).map(formatSong);
			return res.json({
				playlistId,
				title: `${query} Mix`,
				description: `Curated collection for ${query}`,
				thumbnail: tracks[0]?.thumbnail || "/logo.svg",
				tracks
			});
		}

		const data = await fetchJioSaavn({ __call: "playlist.getDetails", listid: playlistId });
		if (!data || !data.listid) {
			throw new Error("Playlist not found");
		}
		
		const tracks = (data.songs || []).map(formatSong);
		
		return res.json({
			playlistId: data.listid,
			title: data.listname || "Featured Playlist",
			description: "Curated collection",
			thumbnail: (data.image || "").replace("150x150", "500x500") || tracks[0]?.thumbnail || "/logo.svg",
			tracks
		});
	} catch (error) {
		console.error("Playlist details failed:", error);
		res.status(502).json({ error: "Failed to fetch playlist details" });
	}
});

// SPA fallback for client-side routing
app.use((req, res) => {
	const distIndex = path.join(__dirname, "dist", "index.html");
	if (fs.existsSync(distIndex)) {
		res.sendFile(distIndex);
	} else {
		res.sendFile(path.join(__dirname, "index.html"));
	}
});

const server = app.listen(port, "0.0.0.0", () => {
	console.log(`Play LooP is running at http://0.0.0.0:${port}`);
});

server.on("error", (error) => {
	if (error.code === "EADDRINUSE") {
		console.error(`Port ${port} is already in use.`);
	} else {
		console.error("Server failed:", error);
	}
	process.exitCode = 1;
});
