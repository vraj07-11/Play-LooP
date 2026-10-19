const CryptoJS = require("crypto-js");

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
	if (!imgUrl || typeof imgUrl !== "string" || !imgUrl.startsWith("http")) return "/default-cover.svg";
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
		return "/default-cover.svg";
	}
	return url;
}

const playlistCoverCache = new Map();

async function resolveCleanPlaylistThumbnail(playlistId, rawImage) {
	const validImg = getValidImage(rawImage);
	if (!validImg || (!validImg.includes('/editorial/') && validImg !== '/default-cover.svg' && validImg !== '/logo.svg')) {
		return validImg;
	}
	if (playlistCoverCache.has(playlistId)) {
		return playlistCoverCache.get(playlistId);
	}
	try {
		const data = await fetchJioSaavn({ __call: "playlist.getDetails", listid: playlistId });
		const tracks = data?.songs || data?.list || [];
		const cleanTrack = tracks.find(t => t?.image && !String(t.image).includes('/editorial/')) || tracks[0];
		if (cleanTrack?.image) {
			const cleanImg = getValidImage(cleanTrack.image);
			if (cleanImg && !cleanImg.includes('/editorial/') && cleanImg !== '/default-cover.svg' && cleanImg !== '/logo.svg') {
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
	const decodeEntities = (s) => {
		return String(s)
			.replace(/&quot;/g, '"')
			.replace(/&amp;/g, '&')
			.replace(/&#039;/g, "'")
			.replace(/&apos;/g, "'")
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&nbsp;/g, ' ')
			.replace(/&copy;/g, '©');
	};
	if (typeof val === "string") {
		return decodeEntities(val).trim();
	}
	if (Array.isArray(val)) {
		const str = val.map(v => typeof v === 'string' ? v : (v?.name || v?.title || '')).filter(Boolean).join(', ');
		return str ? decodeEntities(str).trim() : fallback;
	}
	if (typeof val === "object") {
		const str = val.name || val.title || val.description || fallback;
		return decodeEntities(str).trim();
	}
	return decodeEntities(val).trim();
}

const MIN_SONG_DURATION = 35; // Must be longer than 35 seconds (> 35)
const MAX_SONG_DURATION = 420; // Must be less than 7 minutes (< 420 seconds)

function parseDurationInSeconds(d) {
	if (d === null || d === undefined || d === '') return 0;
	if (typeof d === 'number') {
		if (d > 10000) return Math.round(d / 1000);
		return Math.round(d);
	}
	const str = String(d).trim();
	if (str.includes(':')) {
		const parts = str.split(':').map(p => parseInt(p, 10));
		if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
		if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
	}
	const parsed = parseInt(str, 10);
	if (isNaN(parsed)) return 0;
	if (parsed > 10000) return Math.round(parsed / 1000);
	return parsed;
}

function isValidSongDuration(duration) {
	const secs = parseDurationInSeconds(duration);
	return secs > MIN_SONG_DURATION && secs < MAX_SONG_DURATION;
}

function formatSong(song, quality = "320") {
	if (!song) return null;
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
	} else if (song.primary_artists) {
		artistName = song.primary_artists;
	} else if (song.subtitle) {
		artistName = song.subtitle;
	} else if (song.singers) {
		artistName = song.singers;
	}

	const songTitle = song.title || song.song || song.name;

	return {
		videoId: song.id,
		title: cleanStr(songTitle, "Unknown Track"),
		artist: cleanStr(artistName, "Various Artists"),
		thumbnail: getValidImage(song.image),
		duration: parseDurationInSeconds(song.more_info?.duration || song.duration || 0),
		streamUrl: qualityUrl
	};
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

function isRedundantArtist(candidateName, existingNames) {
	if (!candidateName) return true;
	const c = candidateName.trim().toLowerCase();
	const cNorm = c.replace(/[^a-z0-9]/g, "");
	if (!cNorm) return true;

	for (const ex of existingNames) {
		const e = ex.trim().toLowerCase();
		const eNorm = e.replace(/[^a-z0-9]/g, "");

		// Exact or normalized match
		if (cNorm === eNorm) return true;

		// Candidate contains existing full name
		if (c.includes(e) || cNorm.includes(eNorm)) return true;

		// Existing contains candidate and candidate is just 1 word
		const exWords = e.split(/\s+/);
		if (exWords.length > 1 && exWords[0] === c) return true;

		// Typos or slight variations
		if (Math.abs(cNorm.length - eNorm.length) <= 1 && (cNorm.startsWith(eNorm.slice(0, -1)) || eNorm.startsWith(cNorm.slice(0, -1)))) {
			return true;
		}
	}
	return false;
}

function shuffleArray(array) {
	const arr = [...array];
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

const playlistDetailsMemoryCache = new Map();

module.exports = {
	decryptSaavnUrl,
	fetchJioSaavn,
	getValidImage,
	playlistCoverCache,
	resolveCleanPlaylistThumbnail,
	cleanStr,
	MIN_SONG_DURATION,
	MAX_SONG_DURATION,
	parseDurationInSeconds,
	isValidSongDuration,
	formatSong,
	computeRelevanceScore,
	isRedundantArtist,
	shuffleArray,
	playlistDetailsMemoryCache
};
