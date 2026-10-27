const express = require("express");

const router = express.Router();

const USER_AGENT = "Play-LooP/1.0.0 (https://github.com/vraj07-11/Play-LooP)";
const TIMEOUT_MS = 6000;

// In-memory cache for fast lookups and upstream load reduction
// Max 1500 items, LRU eviction
const lyricsCache = new Map();
const MAX_CACHE_SIZE = 1500;
const POSITIVE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const NEGATIVE_TTL_MS = 4 * 60 * 60 * 1000;  // 4 hours for misses

// Upstream rate limit backoff circuit breaker
let upstreamBackoffUntil = 0;

function getCache(key) {
	if (!lyricsCache.has(key)) return null;
	const entry = lyricsCache.get(key);
	if (Date.now() > entry.expiresAt) {
		lyricsCache.delete(key);
		return null;
	}
	// Refresh LRU order
	lyricsCache.delete(key);
	lyricsCache.set(key, entry);
	return entry.data;
}

function setCache(key, data, isPositive = true) {
	if (lyricsCache.size >= MAX_CACHE_SIZE) {
		const oldestKey = lyricsCache.keys().next().value;
		if (oldestKey) lyricsCache.delete(oldestKey);
	}
	const ttl = isPositive ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS;
	lyricsCache.set(key, {
		data,
		expiresAt: Date.now() + ttl
	});
}

/**
 * Clean up title & artist to match LRCLIB's indexing conventions
 */
function cleanSongMetadata(rawTitle, rawArtist) {
	let title = (rawTitle || "").trim();
	let artist = (rawArtist || "").trim();

	const isGenericArtist = !artist || /^(play loop|various artists|soundcloud artist|unknown artist|topic)$/i.test(artist);

	if (title.includes(" - ")) {
		const parts = title.split(/\s+-\s+/);
		if (parts.length >= 2) {
			if (isGenericArtist) {
				// e.g. "Alan Walker - Faded" -> artist = "Alan Walker", title = "Faded"
				artist = parts[0].trim();
				title = parts.slice(1).join(" - ").trim();
			} else if (parts[0].toLowerCase() === artist.toLowerCase()) {
				// e.g. artist = "Alan Walker", title = "Alan Walker - Faded" -> title = "Faded"
				title = parts.slice(1).join(" - ").trim();
			} else if (parts[parts.length - 1].toLowerCase() === artist.toLowerCase()) {
				// e.g. artist = "Alan Walker", title = "Faded - Alan Walker" -> title = "Faded"
				title = parts.slice(0, -1).join(" - ").trim();
			} else if (/spider-man|soundtrack|ost|movie|from/i.test(parts[1])) {
				// e.g. "Tum Hi Ho - From Aashiqui 2" -> title = "Tum Hi Ho"
				title = parts[0].trim();
			}
		}
	}

	// Remove noise from title
	title = title
		.replace(/[\(\[\{]\s*(?:feat|ft)\.?\s+[^)\]\}]+[\)\]\}]/gi, "")
		.replace(/\s+(?:feat|ft)\.?\s+.*/gi, "")
		.replace(/[\(\[\{][^)\]\}]*(?:official|lyric|video|audio|full song|hd|4k|remix|version|slowed|reverb|lofi|lo-fi|prod|edit|visualizer|cover|original|remastered)[^)\]\}]*[\)\]\}]/gi, "")
		.replace(/\s*\|\s*.*$/i, "")
		.trim();

	// Remove noise from artist
	artist = artist
		.replace(/\s*-\s*topic$/i, "")
		.replace(/topic|official|channel|vevo|🥀|records|music/gi, "")
		.replace(/[\(\[\{].*?[\)\]\}]/g, "")
		.replace(/^[\s\-–—]+|[\s\-–—]+$/g, "")
		.trim();

	return { title, artist };
}

/**
 * GET /api/lyrics
 * Queries LRCLIB with User-Agent compliance, in-memory caching, rate limit backoff, and query fallback.
 */
router.get("/api/lyrics", async (req, res) => {
	const rawTitle = String(req.query.track_name || req.query.title || "").trim();
	const rawArtist = String(req.query.artist_name || req.query.artist || "").trim();
	const durationNum = parseFloat(req.query.duration);

	if (!rawTitle) {
		return res.status(400).json({ error: "Missing track_name parameter" });
	}

	const { title, artist } = cleanSongMetadata(rawTitle, rawArtist);
	const cacheKey = `${title.toLowerCase()}:::${artist.toLowerCase()}`;

	// 1. Check in-memory cache
	const cached = getCache(cacheKey);
	if (cached) {
		res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=43200");
		return res.json(cached);
	}

	// 2. Check circuit breaker (backoff from 429)
	if (Date.now() < upstreamBackoffUntil) {
		const retryAfterSec = Math.ceil((upstreamBackoffUntil - Date.now()) / 1000);
		res.setHeader("Retry-After", retryAfterSec);
		return res.status(200).json({
			syncedLyrics: null,
			plainLyrics: null,
			isInstrumental: false,
			rateLimited: true
		});
	}

	const fetchHeaders = {
		"User-Agent": USER_AGENT,
		"Accept": "application/json"
	};

	let lyricsResult = null;

	// 3. Try direct match: /api/get
	try {
		const getParams = new URLSearchParams();
		getParams.set("track_name", title);
		if (artist) getParams.set("artist_name", artist);
		if (durationNum && durationNum > 0) {
			getParams.set("duration", Math.round(durationNum).toString());
		}

		const getUrl = `https://lrclib.net/api/get?${getParams.toString()}`;
		const response = await fetch(getUrl, {
			headers: fetchHeaders,
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});

		if (response.status === 429) {
			const retryAfter = parseInt(response.headers.get("retry-after") || "60", 10);
			upstreamBackoffUntil = Date.now() + Math.max(retryAfter, 10) * 1000;
			console.warn(`[LRCLIB Proxy] Rate limited on /api/get, backing off for ${retryAfter}s`);
			return res.json({ syncedLyrics: null, plainLyrics: null, isInstrumental: false, rateLimited: true });
		}

		if (response.ok) {
			const data = await response.json();
			lyricsResult = {
				syncedLyrics: data.syncedLyrics || null,
				plainLyrics: data.plainLyrics || null,
				isInstrumental: Boolean(data.instrumental)
			};
		}
	} catch (err) {
		if (err.name !== "AbortError") {
			console.warn("[LRCLIB Proxy] Direct fetch warning:", err.message);
		}
	}

	// 4. Fallback search if direct match was not found
	if (!lyricsResult && Date.now() >= upstreamBackoffUntil) {
		try {
			// First try structured search: track_name + artist_name
			let searchUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}`;
			if (artist) {
				searchUrl += `&artist_name=${encodeURIComponent(artist)}`;
			}

			let searchRes = await fetch(searchUrl, {
				headers: fetchHeaders,
				signal: AbortSignal.timeout(TIMEOUT_MS)
			});

			if (searchRes.status === 429) {
				const retryAfter = parseInt(searchRes.headers.get("retry-after") || "60", 10);
				upstreamBackoffUntil = Date.now() + Math.max(retryAfter, 10) * 1000;
				console.warn(`[LRCLIB Proxy] Rate limited on /api/search, backing off for ${retryAfter}s`);
				return res.json({ syncedLyrics: null, plainLyrics: null, isInstrumental: false, rateLimited: true });
			}

			let results = searchRes.ok ? await searchRes.json() : null;

			// If structured search returned nothing, try fuzzy text search as last resort
			if (!Array.isArray(results) || results.length === 0) {
				const q = `${title} ${artist}`.trim();
				const fallbackUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`;
				const fallbackRes = await fetch(fallbackUrl, {
					headers: fetchHeaders,
					signal: AbortSignal.timeout(TIMEOUT_MS)
				});
				if (fallbackRes.ok) {
					results = await fallbackRes.json();
				}
			}

			if (Array.isArray(results) && results.length > 0) {
				// Prioritize candidate with synced lyrics and closest duration match
				let bestMatch = null;
				const candidatesWithSynced = results.filter(item => item.syncedLyrics);

				if (candidatesWithSynced.length > 0) {
					if (durationNum && durationNum > 0) {
						candidatesWithSynced.sort((a, b) => {
							const diffA = Math.abs((a.duration || 0) - durationNum);
							const diffB = Math.abs((b.duration || 0) - durationNum);
							return diffA - diffB;
						});
					}
					bestMatch = candidatesWithSynced[0];
				} else if (durationNum && durationNum > 0) {
					const sorted = [...results].sort((a, b) => {
						const diffA = Math.abs((a.duration || 0) - durationNum);
						const diffB = Math.abs((b.duration || 0) - durationNum);
						return diffA - diffB;
					});
					bestMatch = sorted[0];
				} else {
					bestMatch = results[0];
				}

				if (bestMatch) {
					lyricsResult = {
						syncedLyrics: bestMatch.syncedLyrics || null,
						plainLyrics: bestMatch.plainLyrics || null,
						isInstrumental: Boolean(bestMatch.instrumental)
					};
				}
			}
		} catch (err) {
			if (err.name !== "AbortError") {
				console.warn("[LRCLIB Proxy] Search fallback warning:", err.message);
			}
		}
	}

	// 5. Store in cache (positive or negative)
	if (lyricsResult) {
		setCache(cacheKey, lyricsResult, true);
		res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=43200");
		return res.json(lyricsResult);
	} else {
		// Cache negative lookup so we do not spam LRCLIB repeatedly for songs that don't have lyrics
		const negativeResult = { syncedLyrics: null, plainLyrics: null, isInstrumental: false, notFound: true };
		setCache(cacheKey, negativeResult, false);
		res.setHeader("Cache-Control", "public, max-age=14400");
		return res.json(negativeResult);
	}
});

module.exports = router;
