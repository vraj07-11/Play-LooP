const path = require("node:path");
const fs = require("node:fs");
const express = require("express");
const cors = require("cors");
const crypto = require("node:crypto");
const CryptoJS = require("crypto-js");
const dns = require("node:dns");

// Enforce IPv4 priority to prevent Windows IPv6 connection timeouts (UND_ERR_CONNECT_TIMEOUT)
dns.setDefaultResultOrder("ipv4first");

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

function getValidImage(imgUrl) {
	if (!imgUrl) return "/logo.svg";
	const url = String(imgUrl).replace("150x150", "500x500");
	if (
		url.includes("default_images") || 
		url.includes("artist-default") || 
		url.includes("default-artist") || 
		url.includes("default") ||
		url.includes("saavn_logo") ||
		url.includes("jiosaavn_logo") ||
		url.includes("editorial/logo/") ||
		url.includes("placeholder") ||
		url.includes("share-image")
	) {
		return "/logo.svg";
	}
	return url;
}

const playlistCoverCache = new Map();

async function resolveCleanPlaylistThumbnail(playlistId, rawImage) {
	const validImg = getValidImage(rawImage);
	if (!validImg || !validImg.includes('/editorial/')) {
		return validImg;
	}
	if (playlistCoverCache.has(playlistId)) {
		return playlistCoverCache.get(playlistId);
	}
	try {
		const data = await fetchJioSaavn({ __call: "playlist.getDetails", listid: playlistId });
		if (data && data.list && data.list.length > 0 && data.list[0].image) {
			const cleanImg = getValidImage(data.list[0].image);
			if (cleanImg && !cleanImg.includes('/editorial/')) {
				playlistCoverCache.set(playlistId, cleanImg);
				return cleanImg;
			}
		}
	} catch (e) {
		console.warn(`Could not resolve clean cover for playlist ${playlistId}:`, e.message);
	}
	return validImg;
}

function cleanStr(val, fallback = "") {
	if (!val) return fallback;
	if (typeof val === "string") {
		return val.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
	}
	if (Array.isArray(val)) {
		const str = val.map(v => typeof v === 'string' ? v : (v?.name || v?.title || '')).filter(Boolean).join(', ');
		return str ? str.replace(/&quot;/g, '"').replace(/&amp;/g, '&') : fallback;
	}
	if (typeof val === "object") {
		const str = val.name || val.title || val.description || fallback;
		return String(str).replace(/&quot;/g, '"').replace(/&amp;/g, '&');
	}
	return String(val).replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

function formatSong(song, quality = "320") {
	const encUrl = song.encrypted_media_url || song.more_info?.encrypted_media_url;
	const decUrl = encUrl ? decryptSaavnUrl(encUrl) : null;
	
	let qualityUrl = decUrl;
	if (decUrl) {
		if (quality === "320") {
			qualityUrl = decUrl.replace("_96", "_320").replace("_160", "_320");
		} else if (quality === "160") {
			qualityUrl = decUrl.replace("_320", "_160").replace("_96", "_160");
		} else if (quality === "96") {
			qualityUrl = decUrl.replace("_320", "_96").replace("_160", "_96");
		}
	}

	let artistName = "Various Artists";
	if (song.more_info?.primary_artists) {
		artistName = song.more_info.primary_artists;
	} else if (song.subtitle) {
		artistName = song.subtitle;
	}

	return {
		videoId: song.id,
		title: cleanStr(song.title, "Unknown Track"),
		artist: cleanStr(artistName, "Various Artists"),
		thumbnail: getValidImage(song.image),
		duration: parseInt(song.more_info?.duration || song.duration || 0, 10),
		streamUrl: qualityUrl
	};
}

// --- SoundCloud Helper Functions ---
let scClientIdCache = { id: null, fetchedAt: 0 };

async function getSoundCloudClientId() {
	const now = Date.now();
	// Cache for 2 hours
	if (scClientIdCache.id && (now - scClientIdCache.fetchedAt < 2 * 60 * 60 * 1000)) {
		return scClientIdCache.id;
	}

	try {
		const htmlRes = await fetch("https://soundcloud.com", {
			headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
		});
		const html = await htmlRes.text();
		
		const scriptMatches = [...html.matchAll(/<script [^>]*src="([^"]+)"/g)];
		const scriptUrls = scriptMatches.map(m => m[1]).filter(url => url.startsWith("http"));

		for (const url of scriptUrls) {
			const jsRes = await fetch(url, {
				headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
			});
			const jsText = await jsRes.text();
			const match = jsText.match(/client_id["']?[:=]["']?([a-zA-Z0-9]{32})/);
			if (match && match[1]) {
				scClientIdCache = { id: match[1], fetchedAt: now };
				return match[1];
			}
		}
	} catch (e) {
		console.error("[SoundCloud] Error fetching client ID:", e);
	}
	return scClientIdCache.id || "dkevB9EsY4jIoSm8RfddPNUKyn6hurXF";
}

async function searchSoundCloud(query, limit = 8) {
	try {
		const clientId = await getSoundCloudClientId();
		if (!clientId) return [];

		const url = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=${limit}`;
		const res = await fetch(url, {
			headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
		});
		if (!res.ok) return [];
		const data = await res.json();
		const collection = data.collection || [];

		return collection.map(track => {
			const artwork = track.artwork_url || track.user?.avatar_url || "";
			const highResArt = artwork ? artwork.replace("-large", "-t500x500") : "/logo.svg";

			return {
				videoId: `sc:${track.id}`,
				title: cleanStr(track.title, "SoundCloud Track"),
				artist: cleanStr(track.user?.username || track.user?.full_name, "SoundCloud Artist"),
				thumbnail: getValidImage(highResArt),
				duration: Math.round((track.duration || 0) / 1000),
				source: "soundcloud",
				provider: "SoundCloud",
				tag: "SoundCloud"
			};
		});
	} catch (err) {
		console.error("[SoundCloud] Search error:", err);
		return [];
	}
}

async function getSoundCloudStreamUrl(scId) {
	try {
		const clientId = await getSoundCloudClientId();
		if (!clientId) return null;

		const trackRes = await fetch(`https://api-v2.soundcloud.com/tracks/${scId}?client_id=${clientId}`, {
			headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
		});
		if (!trackRes.ok) return null;
		const trackData = await trackRes.json();

		const trans = trackData.media?.transcodings || [];
		if (trans.length === 0) return null;

		// 1. Prefer non-snipped full-length streams over previews
		const fullLength = trans.filter(t => !t.snipped);
		const candidates = fullLength.length > 0 ? fullLength : trans;

		// 2. Select highest quality audio encoding available (AAC 256k -> AAC 160k -> Progressive MP3 -> fallback)
		const transcoding = 
			candidates.find(t => t.preset === 'aac_256k') ||
			candidates.find(t => t.preset === 'aac_160k') ||
			candidates.find(t => t.format?.protocol === 'progressive') ||
			candidates[0];

		if (!transcoding || !transcoding.url) return null;

		const streamRes = await fetch(`${transcoding.url}?client_id=${clientId}`, {
			headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
		});
		if (!streamRes.ok) return null;
		const streamData = await streamRes.json();
		return streamData.url || null;
	} catch (err) {
		console.error("[SoundCloud] Stream resolve error:", err);
		return null;
	}
}

// --- Search Relevance Helper ---
function computeRelevanceScore(song, queryLower) {
	const title = (song.title || "").toLowerCase().trim();
	const artist = (song.artist || "").toLowerCase().trim();
	if (!queryLower) return 0;

	if (title === queryLower) return 100;
	if (title.startsWith(queryLower)) return 85;
	
	const queryWords = queryLower.split(/\s+/).filter(Boolean);
	if (queryWords.length === 0) return 0;

	let matchCount = 0;
	for (const w of queryWords) {
		if (title.includes(w)) matchCount++;
	}
	const matchRatio = matchCount / queryWords.length;
	let score = Math.round(matchRatio * 75);

	if (artist.includes(queryLower)) score += 15;
	return score;
}

// --- API Endpoints ---

app.get("/api/health", (req, res) => {
	res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/search", async (req, res) => {
	const query = String(req.query.q || "").trim();
	if (!query) return res.status(400).json({ error: 'Query parameter "q" is required' });

	const type = String(req.query.type || "").toLowerCase();
	const isMulti = type === "all" || req.query.multi === "true";
	const queryLower = query.toLowerCase().trim();

	try {
		if (isMulti) {
			const [songsRes, artistsRes, playlistsRes, albumsRes, autoRes, scRes] = await Promise.allSettled([
				fetchJioSaavn({ __call: "search.getResults", q: query, n: "25", p: "1" }),
				fetchJioSaavn({ __call: "search.getArtistResults", q: query, n: "8", p: "1" }),
				fetchJioSaavn({ __call: "search.getPlaylistResults", q: query, n: "6", p: "1" }),
				fetchJioSaavn({ __call: "search.getAlbumResults", q: query, n: "6", p: "1" }),
				fetchJioSaavn({ __call: "autocomplete.get", query: query }),
				searchSoundCloud(query, 10)
			]);

			const songsData = songsRes.status === 'fulfilled' && songsRes.value?.results ? songsRes.value.results : [];
			const artistsData = artistsRes.status === 'fulfilled' && artistsRes.value?.results ? artistsRes.value.results : [];
			const playlistsData = playlistsRes.status === 'fulfilled' && playlistsRes.value?.results ? playlistsRes.value.results : [];
			const albumsData = albumsRes.status === 'fulfilled' && albumsRes.value?.results ? albumsRes.value.results : [];
			const autoData = autoRes.status === 'fulfilled' && autoRes.value ? autoRes.value : {};
			const scSongs = scRes.status === 'fulfilled' && Array.isArray(scRes.value) ? scRes.value : [];

			let saavnSongs = songsData.map(s => formatSong(s));
			if (saavnSongs.length === 0 && autoData.songs?.data) {
				saavnSongs = autoData.songs.data.map(s => ({
					videoId: s.id,
					title: cleanStr(s.title, "Unknown Track"),
					artist: cleanStr(s.more_info?.primary_artists || s.description, "Play LooP"),
					thumbnail: getValidImage(s.image),
					duration: 180
				}));
			}

			// Score and rank both sources by query relevance
			const scoredSaavn = saavnSongs.map(s => ({ ...s, score: computeRelevanceScore(s, queryLower) })).sort((a, b) => b.score - a.score);
			const scoredSC = scSongs.map(s => ({ ...s, score: computeRelevanceScore(s, queryLower) })).sort((a, b) => b.score - a.score);

			// Interleave and merge based on highest relevance score
			let songs = [];
			let i = 0, j = 0;
			while (i < scoredSaavn.length || j < scoredSC.length) {
				const saavnItem = scoredSaavn[i];
				const scItem = scoredSC[j];

				if (scItem && (!saavnItem || scItem.score >= saavnItem.score)) {
					songs.push(scItem);
					j++;
				} else if (saavnItem) {
					songs.push(saavnItem);
					i++;
				}
			}

			let artists = artistsData.map(a => ({
				playlistId: `ARTIST:${a.id}`,
				title: cleanStr(a.name || a.title, "Artist"),
				artist: "Verified Artist",
				thumbnail: getValidImage(a.image),
				type: "artist",
				description: cleanStr(a.role || a.description, "Artist"),
				isArtist: true
			}));

			if (artists.length === 0 && autoData.artists?.data) {
				artists = autoData.artists.data.map(a => ({
					playlistId: `ARTIST:${a.id}`,
					title: cleanStr(a.title || a.name, "Artist"),
					artist: "Verified Artist",
					thumbnail: getValidImage(a.image),
					type: "artist",
					description: cleanStr(a.description, "Artist"),
					isArtist: true
				}));
			}

			const playlistsDataClean = await Promise.all(
				playlistsData.map(async (p) => {
					const cleanThumb = await resolveCleanPlaylistThumbnail(p.id, p.image);
					return {
						playlistId: p.id,
						title: cleanStr(p.title || p.name, "Playlist"),
						author: cleanStr(p.more_info?.artist_name || p.subtitle, "Play LooP"),
						thumbnail: cleanThumb,
						type: "playlist",
						count: p.more_info?.song_count ? `${p.more_info.song_count} songs` : "Playlist"
					};
				})
			);

			let playlists = [
				...playlistsDataClean,
				...albumsData.map(al => ({
					playlistId: al.id,
					title: cleanStr(al.title || al.name, "Album"),
					author: cleanStr(al.music || al.artist || al.subtitle, "Album"),
					thumbnail: getValidImage(al.image),
					type: "album",
					count: "Album"
				}))
			];

			if (playlists.length === 0 && (autoData.playlists?.data || autoData.albums?.data)) {
				const autoPlaylists = await Promise.all(
					(autoData.playlists?.data || []).map(async (p) => {
						const cleanThumb = await resolveCleanPlaylistThumbnail(p.id, p.image);
						return {
							playlistId: p.id,
							title: cleanStr(p.title, "Playlist"),
							author: cleanStr(p.description || p.subtitle, "Play LooP"),
							thumbnail: cleanThumb,
							type: "playlist",
							count: "Playlist"
						};
					})
				);
				const autoAlbums = (autoData.albums?.data || []).map(al => ({
					playlistId: al.id,
					title: cleanStr(al.title, "Album"),
					author: cleanStr(al.description || al.subtitle, "Album"),
					thumbnail: getValidImage(al.image),
					type: "album",
					count: "Album"
				}));
				playlists = [...autoPlaylists, ...autoAlbums];
			}

			// Determine Top Result (Song with highest match score given top priority)
			let topResult = null;
			const exactArtistMatch = artists.length > 0 && artists[0].title.toLowerCase().trim() === queryLower;

			if (exactArtistMatch) {
				topResult = { ...artists[0], category: 'Artist' };
			} else if (songs.length > 0) {
				topResult = { ...songs[0], category: 'Song' };
			} else if (artists.length > 0) {
				topResult = { ...artists[0], category: 'Artist' };
			} else if (playlists.length > 0) {
				topResult = { ...playlists[0], category: 'Playlist' };
			}

			return res.json({
				songs,
				artists,
				playlists,
				topResult
			});
		}

		// Single song search fallback with relevance sorting
		const [saavnData, scSongs] = await Promise.all([
			fetchJioSaavn({ __call: "search.getResults", q: query, n: "25", p: "1" }).catch(() => null),
			searchSoundCloud(query, 10)
		]);

		let saavnSongs = [];
		if (saavnData && saavnData.results && saavnData.results.length > 0) {
			saavnSongs = saavnData.results.map(s => formatSong(s));
		} else {
			const autoData = await fetchJioSaavn({ __call: "autocomplete.get", query: query }).catch(() => null);
			if (autoData && autoData.songs?.data) {
				saavnSongs = autoData.songs.data.map(s => ({
					videoId: s.id,
					title: (s.title || "").replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
					artist: (s.more_info?.primary_artists || s.description || "Play LooP").replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
					thumbnail: getValidImage(s.image),
					duration: 180
				}));
			}
		}

		const scoredSaavn = saavnSongs.map(s => ({ ...s, score: computeRelevanceScore(s, queryLower) })).sort((a, b) => b.score - a.score);
		const scoredSC = (scSongs || []).map(s => ({ ...s, score: computeRelevanceScore(s, queryLower) })).sort((a, b) => b.score - a.score);

		let songs = [];
		let i = 0, j = 0;
		while (i < scoredSaavn.length || j < scoredSC.length) {
			const saavnItem = scoredSaavn[i];
			const scItem = scoredSC[j];

			if (scItem && (!saavnItem || scItem.score >= saavnItem.score)) {
				songs.push(scItem);
				j++;
			} else if (saavnItem) {
				songs.push(saavnItem);
				i++;
			}
		}

		return res.json(songs);
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
	const quality = String(req.query.quality || "320").trim();
	if (!videoId) return res.status(400).send("Video ID is required");

	// Handle SoundCloud tracks
	if (videoId.startsWith("sc:")) {
		const scId = videoId.replace(/^sc:/, "");
		const scStreamUrl = await getSoundCloudStreamUrl(scId);
		if (scStreamUrl) {
			return res.redirect(302, scStreamUrl);
		} else {
			return res.status(404).send("SoundCloud stream URL not found");
		}
	}

	// Handle dynamic search query tracks
	if (videoId.startsWith("QUERY:")) {
		let query = videoId.replace(/^QUERY:/, "");
		try { query = decodeURIComponent(query); } catch(e) {}
		
		try {
			const searchData = await fetchJioSaavn({ __call: "search.getResults", q: query, n: "3", p: "1" });
			if (searchData && searchData.results && searchData.results.length > 0) {
				const formatted = formatSong(searchData.results[0], quality);
				if (formatted.streamUrl) return res.redirect(302, formatted.streamUrl);
			}
		} catch (e) {}

		try {
			const scSongs = await searchSoundCloud(query, 3);
			if (scSongs.length > 0) {
				const scId = scSongs[0].videoId.replace(/^sc:/, "");
				const scStreamUrl = await getSoundCloudStreamUrl(scId);
				if (scStreamUrl) return res.redirect(302, scStreamUrl);
			}
		} catch (e) {}

		return res.status(404).send("Audio stream for query not found");
	}

	try {
		const data = await fetchJioSaavn({ __call: "song.getDetails", pids: videoId });
		let songData = data[videoId] || (data.songs && data.songs[0]);

		if (!songData) {
			return res.status(404).send("Song not found");
		}

		const formatted = formatSong(songData, quality);
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

app.get("/api/download", async (req, res) => {
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
			const https = require("node:https");
			const http = require("node:http");
			const client = formatted.streamUrl.startsWith("https") ? https : http;
			
			const filename = `${formatted.title.replace(/[^a-z0-9 ]/gi, '')} - ${formatted.artist.replace(/[^a-z0-9 ]/gi, '')}.m4a`;
			
			client.get(formatted.streamUrl, (proxyRes) => {
				res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
				res.setHeader("Content-Type", proxyRes.headers["content-type"] || "audio/mp4");
				proxyRes.pipe(res);
			}).on("error", (e) => {
				console.error("Download proxy error:", e);
				res.status(502).send("Download failed");
			});
		} else {
			return res.status(404).send("Stream URL not found");
		}
	} catch (error) {
		console.error("Download endpoint failed:", error);
		res.status(502).send("Download failed");
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

const YTMusic = require("ytmusic-api");
const ytmusic = new (YTMusic.default || YTMusic)();
let ytmusicInitialized = false;

async function initYTMusic() {
	if (!ytmusicInitialized) {
		await ytmusic.initialize();
		ytmusicInitialized = true;
	}
}

async function fetchYTMusicUpNext(artist, title) {
	try {
		await initYTMusic();
		const query = `${title} ${artist}`.trim();
		const search = await ytmusic.search(query, "SONG");
		if (search && search.length > 0 && search[0].videoId) {
			const upNext = await ytmusic.getUpNexts(search[0].videoId);
			if (upNext && upNext.length > 0) {
				return upNext.map(track => ({
					title: track.title || track.name,
					artist: typeof track.artists === 'string' ? track.artists : (Array.isArray(track.artists) ? track.artists.map(a => a.name).join(", ") : track.artist || "")
				})).filter(t => t.title && !(t.title.toLowerCase() === title.toLowerCase() && t.artist.toLowerCase().includes(artist.toLowerCase().split(',')[0])));
			}
		}
	} catch (e) {
		console.warn("[YTMusic] Recommendation fetch warning:", e.message);
	}
	return [];
}

async function resolveExternalTracksToSaavn(trackList, limit = 10) {
	if (!Array.isArray(trackList) || trackList.length === 0) return [];

	const candidates = trackList.slice(0, limit);
	const resolvedPromises = candidates.map(async (item) => {
		try {
			// Clean up titles (e.g. remove "(feat. Artist)") which confuse JioSaavn search
			const cleanTitle = item.title.replace(/\(feat\..*?\)/i, '').replace(/\[.*?\]/g, '').trim();
			const query = `${cleanTitle} ${item.artist}`.trim();
			const searchData = await fetchJioSaavn({ __call: "search.getResults", q: query, n: "5", p: "1" });
			
			if (searchData && searchData.results && searchData.results.length > 0) {
				const ytArtist = item.artist.toLowerCase();
				const ytWords = ytArtist.split(/[\s,]+/).filter(w => w.length > 2);
				
				// Try to find a result where the artist matches reasonably well
				for (const res of searchData.results) {
					const formatted = formatSong(res);
					const saavnArtist = formatted.artist.toLowerCase();
					
					// If YT artist is short, just check if it's included. Otherwise check word by word.
					let hasMatch = false;
					if (ytWords.length === 0) {
						hasMatch = saavnArtist.includes(ytArtist);
					} else {
						hasMatch = ytWords.some(w => saavnArtist.includes(w));
					}
					
					// Also accept if the title is an exact match as a fallback
					const titleMatch = formatted.title.toLowerCase() === item.title.toLowerCase();

					if (hasMatch || titleMatch) {
						return formatted;
					}
				}
				// If no strict match found among top 5, we skip it to prevent random Hindi songs
			}
		} catch (e) {
			// Ignore resolution errors
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
	const isRefresh = req.query.refresh === "true";

	const excludeIdsRaw = String(req.query.excludeIds || "").trim();
	const excludeSet = new Set(excludeIdsRaw ? excludeIdsRaw.split(",").map(id => id.trim()).filter(Boolean) : []);

	const excludeTitlesRaw = String(req.query.excludeTitles || "").trim();
	const excludeTitlesSet = new Set(excludeTitlesRaw ? excludeTitlesRaw.split("|").map(t => t.toLowerCase().replace(/[^a-z0-9]/g, "")).filter(Boolean) : []);

	const userLanguagesRaw = String(req.query.languages || "").trim();
	const userLanguages = userLanguagesRaw ? userLanguagesRaw.split(",").map(l => l.trim().toLowerCase()) : ["english", "hindi"];

	if (!videoId && !artist && !title) {
		return res.status(400).json({ error: "Video ID or song metadata required" });
	}

	const cacheKey = (videoId || `${artist}_${title}`).toLowerCase();
	const cachedEntry = recoCache.get(cacheKey);
	if (!isRefresh && cachedEntry && (Date.now() - cachedEntry.timestamp < RECO_CACHE_TTL)) {
		const filteredCache = cachedEntry.data.filter(t => 
			t && t.videoId && 
			!excludeSet.has(t.videoId) && 
			!excludeTitlesSet.has((t.title || "").toLowerCase().replace(/[^a-z0-9]/g, ""))
		);
		if (filteredCache.length >= 8) {
			return res.json(filteredCache);
		}
	}

	try {
		let recommendations = [];
		let lang = 'english'; // default fallback

		if (videoId) {
			try {
				const songData = await fetchJioSaavn({ __call: "song.getDetails", pids: videoId });
				const details = songData[videoId] || (songData.songs && songData.songs[0]);
				if (details && details.language) {
					lang = details.language.toLowerCase().trim();
				}
			} catch (e) {
				console.warn("Could not fetch language for videoId", videoId);
			}
		}

		// Restrict recommendations strictly to user's preferred languages
		if (!userLanguages.includes(lang) && userLanguages.length > 0) {
			lang = userLanguages.includes('english') ? 'english' : userLanguages[0];
		}

		const languagePlaylists = {
			'english': ["63116930", "48189087", "88471029", "110858205", "77492018", "8042456", "947987697"],
			'hindi': ["1134543272", "1210453303", "1167751266", "107584484", "1214335916", "1202559627"],
			'punjabi': ["4144832", "1543265", "1023456", "38029986", "107584484"],
			'tamil': ["1142512", "4234567", "5729104", "1193021", "1543265"],
			'telugu': ["1543285", "3791000", "28374902", "3829012", "1134543272"]
		};

		let candidatePids = languagePlaylists[lang];
		if (!candidatePids || candidatePids.length === 0) {
			try {
				const searchPlaylists = await fetchJioSaavn({ __call: "search.getPlaylistResults", q: `top ${lang} hits`, n: "5", p: "1" });
				if (searchPlaylists && searchPlaylists.results && searchPlaylists.results.length > 0) {
					candidatePids = searchPlaylists.results.map(p => p.id);
				}
			} catch (e) {
				console.warn(`Could not fetch dynamic playlists for language ${lang}`);
			}
		}
		
		if (!candidatePids || candidatePids.length === 0) {
			// fallback to global popular mix
			candidatePids = ["947987697", "1134543272", "47599074", "1202559627", "63116930"];
		}

		// Shuffle candidate playlists and pick at least 3
		candidatePids.sort(() => 0.5 - Math.random());
		const selectedPids = candidatePids.slice(0, 3);

		const fetchPromises = selectedPids.map(async (pid) => {
			try {
				const chartData = await fetchJioSaavn({ __call: "playlist.getDetails", listid: pid, n: "50" });
				if (chartData && Array.isArray(chartData.list)) {
					return chartData.list.map(formatSong);
				}
			} catch(e) {}
			return [];
		});

		const nestedSongs = await Promise.all(fetchPromises);
		for (const songs of nestedSongs) {
			recommendations.push(...songs);
		}

		// Randomize the collected songs
		recommendations.sort(() => 0.5 - Math.random());

		// Deduplicate and filter against excludeSet & excludeTitlesSet
		const uniqueRecos = [];
		const seenIds = new Set();
		const currentTitleClean = (title || "").toLowerCase().replace(/[^a-z0-9]/g, "");

		for (const track of recommendations) {
			if (!track || !track.videoId) continue;
			
			const trackTitleClean = (track.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
			
			if (track.videoId === videoId || (currentTitleClean && trackTitleClean === currentTitleClean)) {
				continue;
			}

			if (excludeSet.has(track.videoId) || (trackTitleClean && excludeTitlesSet.has(trackTitleClean))) {
				continue;
			}

			if (!seenIds.has(track.videoId)) {
				seenIds.add(track.videoId);
				uniqueRecos.push(track);
			}
		}

		// If we run out of new songs, allow reusing previous ones (excluding current song)
		let finalRecos = uniqueRecos;
		if (finalRecos.length === 0 && recommendations.length > 0) {
			const fallbackSet = new Set();
			for (const track of recommendations) {
				if (track && track.videoId && !fallbackSet.has(track.videoId) && track.videoId !== videoId) {
					fallbackSet.add(track.videoId);
					finalRecos.push(track);
				}
			}
		}

		recommendations = finalRecos;

		if (isRefresh) {
			recommendations.sort(() => 0.5 - Math.random());
		} else if (recommendations.length > 0) {
			recoCache.set(cacheKey, { data: recommendations, timestamp: Date.now() });
		}

		res.json(recommendations);
	} catch (error) {
		console.error("Recommendations failed:", error);
		res.json([]);
	}
});

let trendingArtistsCache = { data: {}, lastFetched: {} };
const TRENDING_ARTISTS_TTL = 6 * 60 * 60 * 1000;

app.get("/api/trending-artists", async (req, res) => {
	const now = Date.now();
	const languagesQuery = req.query.languages || "english,hindi";
	const limit = parseInt(req.query.limit, 10) || 5;
	const cacheKey = languagesQuery.toLowerCase().trim() + '-' + limit;

	if (trendingArtistsCache.data[cacheKey] && (now - trendingArtistsCache.lastFetched[cacheKey] < TRENDING_ARTISTS_TTL)) {
		return res.json(trendingArtistsCache.data[cacheKey]);
	}

	try {
		const languages = cacheKey.split("-")[0].split(",").map(s => s.trim()).filter(Boolean);
		const artistCounts = {};
		const artistMeta = {};
		
		// For each language, find top artists
		let topArtistIdsByLang = [];
		
		for (const lang of languages) {
			try {
				// 1. Search for top playlist for this language
				const searchPlaylists = await fetchJioSaavn({ __call: "search.getPlaylistResults", q: `top ${lang} hits`, n: "2", p: "1" });
				let pid = null;
				if (searchPlaylists && searchPlaylists.results && searchPlaylists.results.length > 0) {
					pid = searchPlaylists.results[0].id;
				} else {
					// Fallbacks
					if (lang === 'hindi') pid = '1134543272';
					else if (lang === 'english') pid = '947987697';
					else continue;
				}

				// 2. Fetch playlist details
				const playlistData = await fetchJioSaavn({ __call: "playlist.getDetails", listid: pid });
				const langCounts = {};
				
				if (playlistData && playlistData.list) {
					playlistData.list.forEach(song => {
						const artists = song.more_info?.artistMap?.primary_artists || [];
						artists.forEach(a => {
							if (a.id && a.name && !a.name.toLowerCase().includes("various")) {
								langCounts[a.id] = (langCounts[a.id] || 0) + 1;
								if (!artistMeta[a.id]) artistMeta[a.id] = { id: a.id, name: a.name, image: a.image };
							}
						});
					});
				}
				
				// 3. Take top N for this language to ensure equal representation
				const numToTake = Math.max(1, Math.ceil(limit / languages.length));
				const topIds = Object.keys(langCounts).sort((a, b) => langCounts[b] - langCounts[a]).slice(0, numToTake);
				topArtistIdsByLang.push(...topIds);

			} catch(e) {
				console.warn(`Failed to process language ${lang}:`, e.message);
			}
		}

		// Deduplicate and limit
		const finalIds = [...new Set(topArtistIdsByLang)].slice(0, limit);

		// Fetch high-res details and follower counts
		const finalArtists = await Promise.all(finalIds.map(async (id) => {
			try {
				const detail = await fetchJioSaavn({ __call: "artist.getArtistPageDetails", artistId: id, p: "1", n_song: "1", n_album: "0" });
				const followers = parseInt(detail.follower_count || "0", 10);
				let formattedFollowers = "";
				if (followers > 0) {
					formattedFollowers = followers > 1000000 
						? (followers / 1000000).toFixed(1) + "M Listeners"
						: (followers / 1000).toFixed(1) + "K Listeners";
				} else {
					formattedFollowers = "Trending Artist"; // fallback
				}

				return {
					playlistId: `ARTIST:${id}`,
					title: detail.name || artistMeta[id].name,
					thumbnail: getValidImage(detail.image || artistMeta[id].image),
					followers: formattedFollowers,
					followerCountRaw: followers,
					author: "Artist"
				};
			} catch (e) {
				return {
					playlistId: `ARTIST:${id}`,
					title: artistMeta[id].name,
					thumbnail: getValidImage(artistMeta[id].image),
					followers: "Trending Artist",
					followerCountRaw: 0,
					author: "Artist"
				};
			}
		}));

		// Sort final array by absolute follower count
		finalArtists.sort((a, b) => b.followerCountRaw - a.followerCountRaw);

		trendingArtistsCache.data[cacheKey] = finalArtists;
		trendingArtistsCache.lastFetched[cacheKey] = now;
		res.json(finalArtists);
	} catch (error) {
		console.error("Trending artists failed:", error);
		res.status(500).json([]);
	}
});

let popularSongsCache = { data: {}, lastFetched: {} };
const POPULAR_SONGS_TTL = 3 * 60 * 60 * 1000;

app.get("/api/popular-songs", async (req, res) => {
	const languagesQuery = req.query.languages || "english,hindi";
	const cacheKey = languagesQuery.toLowerCase().trim();

	let songsByLangRaw = popularSongsCache.data[cacheKey];

	if (!songsByLangRaw || (Date.now() - popularSongsCache.lastFetched[cacheKey] > POPULAR_SONGS_TTL)) {
		try {
			const languages = cacheKey.split(",").map(s => s.trim()).filter(Boolean);
			songsByLangRaw = [];

			for (const lang of languages) {
				try {
					let songs = [];
					if (lang === 'english') {
						// Randomly pool top English hits from both Global Pop (947987697) AND English 2010s (63116930) + English Viral Hits (48189087)
						const englishPids = ['947987697', '63116930', '48189087'];
						const selectedPids = shuffleArray(englishPids);
						for (const id of selectedPids) {
							try {
								const playlistData = await fetchJioSaavn({ __call: "playlist.getDetails", listid: id });
								if (playlistData && playlistData.list) {
									songs.push(...playlistData.list.map(formatSong));
								}
							} catch (e) {}
						}
					} else {
						let pid = null;
						if (lang === 'hindi') pid = '1134543272'; // India Superhits Top 50
						else if (lang === 'punjabi') pid = '4144832'; // Punjabi Hit Songs
						
						if (pid) {
							const playlistData = await fetchJioSaavn({ __call: "playlist.getDetails", listid: pid });
							if (playlistData && playlistData.list) {
								songs = playlistData.list.map(formatSong);
							}
						}
					}
					
					if (songs.length === 0) {
						// Fallback to searching top hits playlist for this language
						const searchPlaylists = await fetchJioSaavn({ __call: "search.getPlaylistResults", q: `top ${lang} hits`, n: "1", p: "1" });
						if (searchPlaylists && searchPlaylists.results && searchPlaylists.results.length > 0) {
							const plData = await fetchJioSaavn({ __call: "playlist.getDetails", listid: searchPlaylists.results[0].id });
							if (plData && plData.list) {
								songs = plData.list.map(formatSong);
							}
						}
					}

					if (songs.length === 0) {
						// Search top songs for language
						const searchSongs = await fetchJioSaavn({ __call: "search.getResults", q: `${lang} superhits`, n: "30", p: "1" });
						if (searchSongs && Array.isArray(searchSongs.results)) {
							songs = searchSongs.results.map(formatSong);
						}
					}

					if (songs.length > 0) {
						songsByLangRaw.push(songs);
					}
				} catch (err) {
					console.warn(`[Popular Songs] Failed for lang ${lang}:`, err.message);
				}
			}

			if (songsByLangRaw.length > 0) {
				popularSongsCache.data[cacheKey] = songsByLangRaw;
				popularSongsCache.lastFetched[cacheKey] = Date.now();
			}
		} catch (e) {
			console.error("Popular songs endpoint error:", e);
		}
	}

	if (songsByLangRaw && songsByLangRaw.length > 0) {
		// Shuffle each language's top songs pool so every open gets fresh random popular songs
		const shuffledByLang = songsByLangRaw.map(pool => shuffleArray(pool));
		const maxLen = Math.max(0, ...shuffledByLang.map(l => l.length));
		const combinedSongs = [];
		const seenIds = new Set();

		for (let i = 0; i < maxLen; i++) {
			for (let l = 0; l < shuffledByLang.length; l++) {
				if (shuffledByLang[l][i]) {
					const song = shuffledByLang[l][i];
					if (song.videoId && !seenIds.has(song.videoId)) {
						seenIds.add(song.videoId);
						combinedSongs.push(song);
					}
				}
			}
		}

		return res.json(combinedSongs);
	}

	// General superhits fallback
	const fallbackSearch = await fetchJioSaavn({ __call: "search.getResults", q: "superhits", n: "30", p: "1" });
	const fallbackSongs = shuffleArray((fallbackSearch?.results || []).map(formatSong));
	res.json(fallbackSongs);
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
			{ id: "1134543272", title: "Hindi: India Superhits Top 50" },
			{ id: "47599074", title: "Now Trending" },
			{ id: "1202559627", title: "Viral Desi Dance Hits" },
			{ id: "63116930", title: "English 2010s" },
			{ id: "48189087", title: "English Viral Hits" },
			{ id: "1210453303", title: "Latest Hindi Songs" },
			{ id: "1167751266", title: "Hindi 1990s" },
			{ id: "4144832", title: "Punjabi Hit Songs" },
			{ id: "1214335916", title: "Lofi India Hits" },
			{ id: "1134595537", title: "International : India Superhits Top 50" },
			{ id: "110858205", title: "Trending Today" },
			{ id: "902306817", title: "Viral Nation" },
			{ id: "1199709032", title: "Best of Phonk" },
			{ id: "410785269", title: "Best of K-Pop" },
			{ id: "303128179", title: "Best of Pop - English" },
			{ id: "78211018", title: "Best of Dance - English" },
			{ id: "158049570", title: "Chill Beats" },
			{ id: "87109788", title: "Hip Hop Workout" },
			{ id: "84576159", title: "Best of Hip Hop - English" }
		];

		const selectedCategories = categoryPool;

		const results = await Promise.all(
			selectedCategories.map(async (cat) => {
				try {
					const data = await fetchJioSaavn({ __call: "playlist.getDetails", listid: cat.id });
					if (data && data.id) {
						let thumb = getValidImage(data.image);
						if (thumb && thumb.includes('/editorial/')) {
							if (data.list && data.list.length > 0 && data.list[0].image) {
								thumb = getValidImage(data.list[0].image);
							}
						}
						if (thumb && !thumb.includes('/editorial/')) {
							playlistCoverCache.set(data.id, thumb);
						}
						return {
							playlistId: data.id,
							title: cat.title || data.title,
							author: "Play LooP",
							thumbnail: thumb,
							count: parseInt(data.list_count || data.list?.length || "20", 10)
						};
					}
				} catch (e) {
					console.warn(`Failed to fetch playlist ${cat.id}:`, e.message);
				}
				return null;
			})
		);

		const playlists = results.filter(Boolean);

		playlistsCache.data = playlists;
		playlistsCache.lastFetched = Date.now();
	} catch (error) {
		console.error("Background playlists fetch failed:", error);
	} finally {
		playlistsCache.isFetching = false;
	}
}

// Prefetch playlists immediately on boot
fetchPlaylistsBackground();

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
		if (playlistId.startsWith("ARTIST:")) {
			const artistId = playlistId.replace("ARTIST:", "");
			const pageStr = String(req.query.page || "1");
			const limitStr = String(req.query.limit || "30");

			const data = await fetchJioSaavn({ __call: "artist.getArtistPageDetails", artistId: artistId, p: pageStr, n_song: limitStr, n_album: "0" });
			if (!data || (!data.artistId && !data.name)) {
				throw new Error("Artist not found");
			}

			let tracks = [];
			if (Array.isArray(data.topSongs)) {
				tracks = data.topSongs.map(formatSong);
			} else if (data.topSongs && Array.isArray(data.topSongs.songs)) {
				tracks = data.topSongs.songs.map(formatSong);
			} else if (pageStr !== "1") {
				// If it fails on page > 1, we just return empty tracks.
			}

			let parsedBio = [];
			try {
				if (data.bio) {
					const b = typeof data.bio === 'string' ? JSON.parse(data.bio) : data.bio;
					if (Array.isArray(b)) parsedBio = b;
				}
			} catch(e) {}

			return res.json({
				playlistId,
				title: data.name,
				description: data.subtitle || "Artist",
				thumbnail: getValidImage(data.image),
				isArtist: true,
				followerCount: data.follower_count,
				isVerified: data.isVerified,
				bio: parsedBio,
				tracks: tracks
			});
		}

		if (playlistId.startsWith("QUERY:")) {
			const rawQuery = playlistId.replace("QUERY:", "");
			let query = rawQuery;
			try {
				query = decodeURIComponent(rawQuery).replace(/%20/g, " ");
			} catch (e) {
				query = rawQuery.replace(/%20/g, " ");
			}
			
			const cleanTitle = (str) => {
				return String(str || "")
					.toLowerCase()
					.replace(/[\(\[\{].*?[\)\]\}]/g, "")
					.replace(/[^a-z0-9]/g, "")
					.trim();
			};

			const calculateSimilarity = (str1, str2) => {
				if (!str1 || !str2) return 0;
				if (str1 === str2) return 1;
				
				const getBigrams = (str) => {
					const bigrams = [];
					for (let i = 0; i < str.length - 1; i++) {
						bigrams.push(str.slice(i, i + 2));
					}
					return bigrams;
				};

				const bg1 = getBigrams(str1);
				const bg2 = getBigrams(str2);
				
				if (bg1.length === 0 || bg2.length === 0) return 0;

				let intersection = 0;
				const bg2Copy = [...bg2];
				for (const bg of bg1) {
					const index = bg2Copy.indexOf(bg);
					if (index !== -1) {
						intersection++;
						bg2Copy.splice(index, 1);
					}
				}

				return (2.0 * intersection) / (bg1.length + bg2.length);
			};

			const pageStr = String(req.query.page || "1");
			const limitStr = String(req.query.limit || "30");
			const targetLimit = parseInt(limitStr, 10);
			let rawTracks = [];
			
			try {
				const data = await fetchJioSaavn({ __call: "search.getResults", q: query, n: limitStr, p: pageStr });
				if (data && Array.isArray(data.results)) {
					rawTracks = data.results.map(formatSong);
				}
			} catch (e) {
				console.warn(`QUERY: search page ${pageStr} failed:`, e.message);
			}

			// Deduplicate by normalized song title and fuzzy similarity
			const seenTitles = [];
			const uniqueTracks = [];

			const isDuplicate = (normTitle) => {
				for (const seen of seenTitles) {
					if (calculateSimilarity(normTitle, seen) >= 0.4) {
						return true;
					}
				}
				return false;
			};

			for (const track of rawTracks) {
				const normTitle = cleanTitle(track.title);
				if (normTitle && !isDuplicate(normTitle)) {
					seenTitles.push(normTitle);
					uniqueTracks.push(track);
				}
			}

			// If it's page 1 and unique tracks count is low, supplement with top tracks from artists
			if (pageStr === "1" && uniqueTracks.length > 0 && uniqueTracks.length < 10) {
				try {
					const seedTrack = uniqueTracks[0];
					const artists = (seedTrack.artist || "").split("-")[0].split(",");
					for (const rawArtist of artists) {
						const cleanArt = rawArtist.split("ft.")[0].split("feat.")[0].trim();
						if (!cleanArt) continue;
						
						for (let p = 1; p <= 2; p++) {
							const extraData = await fetchJioSaavn({ __call: "search.getResults", q: cleanArt, n: "30", p: String(p) });
							if (extraData && Array.isArray(extraData.results)) {
								for (const track of extraData.results.map(formatSong)) {
									const normTitle = cleanTitle(track.title);
									if (normTitle && !isDuplicate(normTitle)) {
										seenTitles.push(normTitle);
										uniqueTracks.push(track);
									}
									if (uniqueTracks.length >= targetLimit) break;
								}
							}
							if (uniqueTracks.length >= targetLimit) break;
						}
						if (uniqueTracks.length >= targetLimit) break;
					}
				} catch (err) {
					console.warn("Dynamic mix artist supplement error:", err.message);
				}
			}

			// If we found at least 3 unique tracks, return them! Otherwise, fall back to raw tracks so the playlist isn't completely empty.
			const finalTracks = uniqueTracks.length > 2 ? uniqueTracks.slice(0, targetLimit) : rawTracks.slice(0, targetLimit);

			return res.json({
				playlistId,
				title: `${query} Mix`,
				description: `Curated collection for ${query}`,
				thumbnail: finalTracks[0]?.thumbnail || "/logo.svg",
				tracks: finalTracks
			});
		}

		const data = await fetchJioSaavn({ __call: "playlist.getDetails", listid: playlistId });
		if (!data || !data.id) {
			throw new Error("Playlist not found");
		}

		const tracks = (data.list || []).map(formatSong);
		const rawThumb = getValidImage(data.image);
		const cleanThumb = (rawThumb && rawThumb.includes('/editorial/'))
			? (tracks[0]?.thumbnail || rawThumb)
			: (rawThumb || tracks[0]?.thumbnail || "/logo.svg");

		if (cleanThumb && !cleanThumb.includes('/editorial/')) {
			playlistCoverCache.set(playlistId, cleanThumb);
		}

		return res.json({
			playlistId: data.id,
			title: data.title || "Featured Playlist",
			description: data.subtitle || "Curated collection",
			thumbnail: cleanThumb,
			tracks
		});
	} catch (error) {
		console.error("Playlist details failed:", error.stack || error);
		res.status(502).json({ error: "Failed to fetch playlist details", details: error.message });
	}
});

async function getSpotifyPlaylistDetails(spotifyUrl) {
	try {
		const match = spotifyUrl.match(/(playlist|album)\/([a-zA-Z0-9]+)/);
		if (!match) return null;
		const type = match[1];
		const id = match[2];

		let accessToken = null;
		try {
			const tokRes = await fetch("https://open.spotify.com/get_access_token", {
				headers: {
					"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
					"App-Platform": "WebPlayer"
				}
			});
			if (tokRes.ok) {
				const tokData = await tokRes.json();
				accessToken = tokData.accessToken;
			}
		} catch (e) {
			console.error("Spotify token fetch failed:", e.message);
		}

		if (accessToken) {
			const apiRes = await fetch(
				type === "album" 
					? `https://api.spotify.com/v1/albums/${id}`
					: `https://api.spotify.com/v1/playlists/${id}?fields=name,images,tracks.items(track(name,artists(name)))`,
				{
					headers: {
						"Authorization": `Bearer ${accessToken}`,
						"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
					}
				}
			);

			if (apiRes.ok) {
				const apiData = await apiRes.json();
				const title = apiData.name || "Spotify Playlist";
				const thumbnail = apiData.images?.[0]?.url || "/logo.svg";
				const rawItems = type === "album" ? (apiData.tracks?.items || []) : (apiData.tracks?.items || []).map(i => i.track).filter(Boolean);

				const songsToSearch = [];
				for (const t of rawItems) {
					const trackName = t.name;
					const artistNames = (t.artists || []).map(a => a.name).join(" ");
					if (trackName) {
						songsToSearch.push(`${trackName} ${artistNames}`.trim());
					}
				}

				if (songsToSearch.length > 0) {
					return { title, thumbnail, songsToSearch };
				}
			}
		}

		const embedRes = await fetch(`https://open.spotify.com/embed/${type}/${id}`, {
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
			}
		});
		if (embedRes.ok) {
			const html = await embedRes.text();
			let title = "Spotify Playlist";
			let thumbnail = "/logo.svg";
			const songsToSearch = [];

			const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
			if (titleMatch) title = titleMatch[1].replace("- Spotify", "").replace("Spotify –", "").trim();

			const nextMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
			if (nextMatch) {
				try {
					const json = JSON.parse(nextMatch[1]);
					const entity = json?.props?.pageProps?.entity || json?.props?.pageProps?.state?.data?.entity;
					if (entity) {
						if (entity.name) title = entity.name;
						if (entity.coverArt?.sources?.[0]?.url) thumbnail = entity.coverArt.sources[0].url;

						const trackList = entity.trackList || entity.tracks?.items || [];
						for (const item of trackList) {
							const t = item.track || item;
							const name = t.title || t.name;
							const artist = (t.subtitle || t.artists?.[0]?.name || "").replace(/\u00a0/g, " ");
							if (name) songsToSearch.push(`${name} ${artist}`.trim());
						}
					}
				} catch (err) {}
			}

			if (songsToSearch.length > 0) {
				return { title, thumbnail, songsToSearch };
			}
		}
	} catch (e) {
		console.error("getSpotifyPlaylistDetails error:", e);
	}
	return null;
}

async function getYouTubePlaylistDetails(ytUrl) {
	try {
		const listMatch = ytUrl.match(/list=([a-zA-Z0-9_-]+)/);
		const listId = listMatch ? listMatch[1] : null;
		if (!listId) return null;

		const res = await fetch(`https://www.youtube.com/playlist?list=${listId}`, {
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
				"Accept-Language": "en-US,en;q=0.9"
			}
		});

		if (!res.ok) return null;
		const html = await res.text();

		const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i) || html.match(/<title>([^<]+)<\/title>/i);
		let title = titleMatch ? titleMatch[1].replace("- YouTube Music", "").replace("- YouTube", "").trim() : "YouTube Playlist";
		if (title.includes("http") || title.length > 80) title = "YouTube Playlist";

		const thumbMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
		const thumbnail = thumbMatch ? thumbMatch[1] : "/logo.svg";

		const songsToSearch = [];

		const jsonMatch = html.match(/var ytInitialData = ({.*?});<\/script>/s) || html.match(/window\["ytInitialData"\] = ({.*?});/s);
		if (jsonMatch) {
			try {
				const ytData = JSON.parse(jsonMatch[1]);
				
				function extractItems(obj) {
					if (!obj || typeof obj !== 'object') return;

					// 1. New YouTube lockupViewModel format (2025/2026)
					if (obj.lockupViewModel) {
						const l = obj.lockupViewModel;
						const trackTitle = l.metadata?.lockupMetadataViewModel?.title?.content;
						const artistName = l.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text?.content || "";
						if (trackTitle && !trackTitle.includes("[Deleted video]") && !trackTitle.includes("[Private video]")) {
							songsToSearch.push(`${trackTitle} ${artistName}`.trim());
						}
					}

					// 2. Classic playlistVideoRenderer format
					if (obj.playlistVideoRenderer) {
						const v = obj.playlistVideoRenderer;
						const t = v.title?.runs?.[0]?.text || v.title?.simpleText;
						const artist = v.shortBylineText?.runs?.[0]?.text || v.longBylineText?.runs?.[0]?.text || "";
						if (t && !t.includes("[Deleted video]") && !t.includes("[Private video]") && !t.includes("Play all")) {
							songsToSearch.push(`${t} ${artist}`.trim());
						}
					}

					// 3. YouTube Music responsive list item format
					if (obj.musicResponsiveListItemRenderer) {
						const item = obj.musicResponsiveListItemRenderer;
						const flexColumns = item.flexColumns || [];
						const t = flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
						const artist = flexColumns[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || "";
						if (t && !t.includes("Play all")) {
							songsToSearch.push(`${t} ${artist}`.trim());
						}
					}

					for (const k of Object.keys(obj)) {
						if (typeof obj[k] === 'object') {
							extractItems(obj[k]);
						}
					}
				}

				extractItems(ytData);
			} catch (err) {
				console.error("ytInitialData error:", err);
			}
		}

		const cleaned = songsToSearch.filter(s => 
			s.length > 2 && 
			!s.includes("Keyboard shortcuts") && 
			!s.includes("Playback") &&
			!s.includes("General") &&
			!s.includes("Subtitles")
		);

		if (cleaned.length > 0) {
			return { title, thumbnail, songsToSearch: cleaned };
		}
	} catch (e) {
		console.error("getYouTubePlaylistDetails error:", e);
	}
	return null;
}

async function getSoundCloudPlaylistDetails(scUrl) {
	try {
		const clientId = await getSoundCloudClientId();
		if (!clientId) return null;

		const resolveUrl = `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(scUrl)}&client_id=${clientId}`;
		const res = await fetch(resolveUrl, {
			headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
		});

		if (!res.ok) return null;
		const data = await res.json();
		if (data.kind !== 'playlist' && data.kind !== 'system-playlist') return null;

		const title = data.title || "SoundCloud Playlist";
		const author = data.user?.username || data.user?.full_name || "SoundCloud";
		const rawArt = data.artwork_url || data.user?.avatar_url || "";
		const thumbnail = rawArt ? rawArt.replace("-large", "-t500x500") : "/logo.svg";

		const tracks = [];
		const songsToSearch = [];

		if (Array.isArray(data.tracks)) {
			for (const t of data.tracks) {
				const trackTitle = t.title;
				const trackArtist = t.user?.username || t.user?.full_name || "SoundCloud Artist";
				if (trackTitle) {
					songsToSearch.push(`${trackTitle} ${trackArtist}`.trim());
					if (t.id) {
						const art = t.artwork_url || t.user?.avatar_url || rawArt || "";
						const img = art ? art.replace("-large", "-t500x500") : thumbnail;
						tracks.push({
							videoId: `sc:${t.id}`,
							title: cleanStr(trackTitle, "SoundCloud Track"),
							artist: cleanStr(trackArtist, "SoundCloud Artist"),
							thumbnail: getValidImage(img),
							duration: Math.round((t.duration || 0) / 1000),
							source: "soundcloud",
							provider: "SoundCloud",
							tag: "SoundCloud"
						});
					}
				}
			}
		}

		if (tracks.length > 0) {
			return { source: 'soundcloud', title, author, thumbnail, tracks };
		} else if (songsToSearch.length > 0) {
			return { source: 'soundcloud', title, author, thumbnail, songsToSearch };
		}
	} catch (e) {
		console.error("getSoundCloudPlaylistDetails error:", e);
	}
	return null;
}

app.get("/api/import-playlist", async (req, res) => {
	let link = String(req.query.url || "").trim();
	if (!link) return res.status(400).json({ error: 'URL parameter "url" is required' });

	try {
		if (!link.startsWith("http://") && !link.startsWith("https://")) {
			link = "https://" + link;
		}

		// 1. JioSaavn / Saavn Playlist
		if (link.includes("saavn.com") || link.includes("jiosaavn.com")) {
			let listid = null;
			let token = null;

			const listidMatch = link.match(/listid=([^&]+)/);
			if (listidMatch) listid = listidMatch[1];

			const tokenMatch = link.match(/featured\/[^/]+\/([^/?#]+)/) || link.match(/s\/playlist\/[^/]+\/([^/?#]+)/);
			if (tokenMatch) token = tokenMatch[1];

			let data = null;
			if (listid) {
				data = await fetchJioSaavn({ __call: "playlist.getDetails", listid, n: "200" });
			} else if (token) {
				data = await fetchJioSaavn({ __call: "webapi.get", type: "playlist", token, n: "200", p: "1" });
			} else {
				const response = await fetch(link, {
					headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
				});
				const html = await response.text();
				const matchId = html.match(/"listid":"([^"]+)"/) || html.match(/"type":"playlist","id":"([^"]+)"/) || html.match(/"playlist_id":"([^"]+)"/);
				if (matchId) {
					data = await fetchJioSaavn({ __call: "playlist.getDetails", listid: matchId[1], n: "200" });
				}
			}

			if (data && (data.list || data.songs)) {
				const list = data.list || data.songs;
				const tracks = list.map(s => formatSong(s));
				const rawThumb = getValidImage(data.image);
				const cleanThumb = (rawThumb && rawThumb.includes('/editorial/'))
					? (tracks[0]?.thumbnail || rawThumb)
					: (rawThumb || tracks[0]?.thumbnail || "/logo.svg");
				return res.json({
					source: 'jiosaavn',
					title: data.title || data.name || "JioSaavn Playlist",
					author: data.subtitle || data.header_desc || "JioSaavn",
					thumbnail: cleanThumb,
					tracks
				});
			}
		}

		// 2. Spotify Playlist Link
		if (link.includes("spotify.com")) {
			const details = await getSpotifyPlaylistDetails(link);
			if (details && details.songsToSearch.length > 0) {
				return res.json({
					source: 'spotify',
					title: details.title,
					thumbnail: details.thumbnail,
					songsToSearch: details.songsToSearch
				});
			}
		}

		// 3. YouTube / YT Music Playlist Link
		if (link.includes("youtube.com") || link.includes("youtu.be")) {
			const details = await getYouTubePlaylistDetails(link);
			if (details && details.songsToSearch.length > 0) {
				return res.json({
					source: 'youtube',
					title: details.title,
					thumbnail: details.thumbnail,
					songsToSearch: details.songsToSearch
				});
			}
		}

		// 4. SoundCloud Playlist Link
		if (link.includes("soundcloud.com")) {
			const details = await getSoundCloudPlaylistDetails(link);
			if (details) {
				return res.json(details);
			}
		}

		return res.status(400).json({ error: "Could not extract tracks from this playlist link. Ensure the playlist is Public." });
	} catch (error) {
		console.error("Import playlist endpoint failed:", error);
		res.status(500).json({ error: "Failed to process playlist URL" });
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
