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
		thumbnail: getValidImage(song.image),
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

		// 1. Try YT Music Up Next for superior recommendations based on current song
		if (artist && title) {
			let ytTracks = await fetchYTMusicUpNext(artist, title);
			if (ytTracks.length > 0) {
				if (isRefresh) {
					ytTracks.sort(() => 0.5 - Math.random());
				}
				const ytRecos = await resolveExternalTracksToSaavn(ytTracks, 30);
				recommendations.push(...ytRecos);
			}
		}

		// 2. Fallback / Append JioSaavn reco.getreco
		if (videoId) {
			const recoData = await fetchJioSaavn({ __call: "reco.getreco", pid: videoId });
			if (Array.isArray(recoData) && recoData.length > 0) {
				const formatted = recoData.map(formatSong);
				if (isRefresh) formatted.sort(() => 0.5 - Math.random());
				recommendations.push(...formatted);
			}
		}

		// 3. Multi-page artist catalogue search for deeper non-top-1 songs
		const cleanArtist = artist ? artist.split(",")[0].split("ft.")[0].split("feat.")[0].trim() : "";
		if (cleanArtist) {
			const pageToFetch = isRefresh ? Math.floor(Math.random() * 3) + 1 : 1;
			const searchData = await fetchJioSaavn({ __call: "search.getResults", q: cleanArtist, n: "40", p: String(pageToFetch) });
			if (searchData && searchData.results) {
				const artistTracks = searchData.results.map(formatSong);
				if (isRefresh) artistTracks.sort(() => 0.5 - Math.random());
				recommendations.push(...artistTracks);
			}
		}

		// 4. Broad Fallback from top playlists (Pop, 2010s, Viral, Hindi) to guarantee fresh candidates
		if (isRefresh || recommendations.length < 25) {
			const playlistIds = ["947987697", "63116930", "48189087", "1134543272"];
			const randomPid = playlistIds[Math.floor(Math.random() * playlistIds.length)];
			const chartData = await fetchJioSaavn({ __call: "playlist.getDetails", listid: randomPid, n: "50" });
			if (chartData && Array.isArray(chartData.songs)) {
				const chartSongs = chartData.songs.map(formatSong).sort(() => 0.5 - Math.random()).slice(0, 20);
				recommendations.push(...chartSongs);
			}
		}

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

		recommendations = uniqueRecos;

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
	const cacheKey = languagesQuery.toLowerCase().trim();

	if (trendingArtistsCache.data[cacheKey] && (now - trendingArtistsCache.lastFetched[cacheKey] < TRENDING_ARTISTS_TTL)) {
		return res.json(trendingArtistsCache.data[cacheKey]);
	}

	try {
		const languages = cacheKey.split(",").map(s => s.trim()).filter(Boolean);
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
				// if 2 langs, take 3 per lang (total 6, we'll slice to 5 later). if 1 lang, take 5.
				const numToTake = Math.max(1, Math.ceil(5 / languages.length));
				const topIds = Object.keys(langCounts).sort((a, b) => langCounts[b] - langCounts[a]).slice(0, numToTake);
				topArtistIdsByLang.push(...topIds);

			} catch(e) {
				console.warn(`Failed to process language ${lang}:`, e.message);
			}
		}

		// Deduplicate and limit to 5
		const finalIds = [...new Set(topArtistIdsByLang)].slice(0, 5);

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
						thumbnail: getValidImage(data.image),
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
			const query = playlistId.replace("QUERY:", "");
			
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

		return res.json({
			playlistId: data.id,
			title: data.title || "Featured Playlist",
			description: data.subtitle || "Curated collection",
			thumbnail: getValidImage(data.image) || tracks[0]?.thumbnail || "/logo.svg",
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
