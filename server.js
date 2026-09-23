const path = require("node:path");
const fs = require("node:fs");
const express = require("express");
const cors = require("cors");
const crypto = require("node:crypto");
const CryptoJS = require("crypto-js");

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
		const key = CryptoJS.enc.Utf8.parse('38346591');
		const decrypted = CryptoJS.DES.decrypt({
			ciphertext: CryptoJS.enc.Base64.parse(encryptedUrl)
		}, key, {
			mode: CryptoJS.mode.ECB,
			padding: CryptoJS.pad.Pkcs7
		});
		return decrypted.toString(CryptoJS.enc.Utf8);
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
			"Cookie": "L=english",
			"X-Forwarded-For": "103.15.253.250"
		}
	});
	
	if (!res.ok) throw new Error(`JioSaavn API Error: ${res.status}`);
	const text = await res.text();
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

// Load .env variables if present
if (fs.existsSync(path.join(__dirname, ".env"))) {
	try {
		const envContent = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
		envContent.split("\n").forEach((line) => {
			const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
			if (match) {
				const key = match[1];
				let value = match[2] || "";
				if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
					value = value.slice(1, -1);
				}
				process.env[key] = value.trim();
			}
		});
	} catch (e) {
		console.warn("Failed to parse .env file:", e.message);
	}
}

// In-Memory Recommendation Cache (24-Hour TTL)
const recoCache = new Map();
const RECO_CACHE_TTL = 24 * 60 * 60 * 1000;

async function fetchLastFmSimilar(artist, title) {
	const apiKey = process.env.LASTFM_API_KEY;
	if (!apiKey || !artist || !title) return [];

	try {
		const url = new URL("https://ws.audioscrobbler.com/2.0/");
		url.searchParams.set("method", "track.getsimilar");
		url.searchParams.set("artist", artist);
		url.searchParams.set("track", title);
		url.searchParams.set("api_key", apiKey);
		url.searchParams.set("format", "json");
		url.searchParams.set("limit", "12");

		const res = await fetch(url.toString(), {
			headers: { "User-Agent": "PlayLooP-MusicApp/1.0" }
		});

		if (!res.ok) throw new Error(`Last.fm API returned ${res.status}`);
		const data = await res.json();
		const tracks = data?.similartracks?.track;
		if (!Array.isArray(tracks)) return [];

		return tracks.map((t) => ({
			title: t.name,
			artist: typeof t.artist === "object" ? t.artist.name : t.artist
		}));
	} catch (err) {
		console.warn("[Last.fm API] Recommendation fetch warning:", err.message);
		return [];
	}
}

async function resolveLastFmTracksToSaavn(similarList) {
	if (!Array.isArray(similarList) || similarList.length === 0) return [];

	// Limit parallel resolution to top 8 candidates for speed
	const candidates = similarList.slice(0, 8);
	const resolvedPromises = candidates.map(async (item) => {
		try {
			const query = `${item.title} ${item.artist}`.trim();
			const searchData = await fetchJioSaavn({ __call: "search.getResults", q: query, n: "1", p: "1" });
			if (searchData && searchData.results && searchData.results[0]) {
				return formatSong(searchData.results[0]);
			}
		} catch (e) {
			// Ignore resolution errors for individual tracks
		}
		return null;
	});

	const results = await Promise.all(resolvedPromises);
	return results.filter(Boolean);
}

app.get("/api/recommendations", async (req, res) => {
	const videoId = String(req.query.id || "").trim();
	const artist = String(req.query.artist || "").trim();
	const title = String(req.query.title || "").trim();

	if (!videoId && !artist && !title) {
		return res.status(400).json({ error: "Video ID or song metadata required" });
	}

	const cacheKey = (videoId || `${artist}_${title}`).toLowerCase();
	const cachedEntry = recoCache.get(cacheKey);
	if (cachedEntry && (Date.now() - cachedEntry.timestamp < RECO_CACHE_TTL)) {
		return res.json(cachedEntry.data);
	}

	try {
		let recommendations = [];

		// 1. Try Last.fm Similar Tracks first if API Key is configured and track metadata exists
		if (process.env.LASTFM_API_KEY && artist && title) {
			const lastFmTracks = await fetchLastFmSimilar(artist, title);
			if (lastFmTracks.length > 0) {
				recommendations = await resolveLastFmTracksToSaavn(lastFmTracks);
			}
		}

		// 2. Fallback to JioSaavn reco.getreco if Last.fm yielded no candidates
		if (recommendations.length === 0 && videoId) {
			const recoData = await fetchJioSaavn({ __call: "reco.getreco", pid: videoId });
			if (Array.isArray(recoData) && recoData.length > 0) {
				recommendations = recoData.map(formatSong);
			}
		}

		// 3. Fallback: Search JioSaavn by artist/title if still empty
		if (recommendations.length === 0) {
			const cleanArtist = artist ? artist.split(",")[0].split("ft.")[0].split("feat.")[0].trim() : "";
			const query = cleanArtist || title;
			if (query) {
				const searchData = await fetchJioSaavn({ __call: "search.getResults", q: query, n: "30", p: "1" });
				if (searchData && searchData.results) {
					recommendations = searchData.results.map(formatSong);
				}
			}
		}

		// Save to 24-Hour Cache
		recoCache.set(cacheKey, { data: recommendations, timestamp: Date.now() });

		res.json(recommendations);
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
			{ id: "947987697", title: "Global Pop" },
			{ id: "1134543272", title: "India Superhits Top 50" },
			{ id: "47599074", title: "Now Trending" },
			{ id: "1202559627", title: "Viral Desi Dance Hits" },
			{ id: "63116930", title: "English 2010s" },
			{ id: "48189087", title: "English Viral Hits" },
			{ id: "1210453303", title: "Latest Hindi Songs" },
			{ id: "1167751266", title: "Hindi 1990s" },
			{ id: "4144832", title: "Punjabi Hit Songs" },
			{ id: "1214335916", title: "Lofi India Hits" }
		];

		const selectedCategories = shuffleArray(categoryPool).slice(0, 10);

		const playlists = [];
		for (const cat of selectedCategories) {
			try {
				const data = await fetchJioSaavn({ __call: "playlist.getDetails", listid: cat.id });
				if (data && data.id) {
					playlists.push({
						playlistId: data.id,
						title: cat.title || data.title,
						author: "Play LooP",
						thumbnail: (data.image || "").replace("150x150", "500x500") || "/logo.svg",
						count: parseInt(data.list_count || data.list?.length || "20", 10)
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
		if (!data || !data.id) {
			throw new Error("Playlist not found");
		}
		
		const tracks = (data.list || []).map(formatSong);
		
		return res.json({
			playlistId: data.id,
			title: data.title || "Featured Playlist",
			description: data.subtitle || "Curated collection",
			thumbnail: (data.image || "").replace("150x150", "500x500") || tracks[0]?.thumbnail || "/logo.svg",
			tracks
		});
	} catch (error) {
		console.error("Playlist details failed:", error.stack || error);
		res.status(502).json({ error: "Failed to fetch playlist details", details: error.message });
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
