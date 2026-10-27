/**
 * LRCLIB Synced Lyrics Service for Play-LooP
 * Documentation: https://lrclib.net
 * Features:
 * - Backend proxy via /api/lyrics with RFC-compliant User-Agent & server-side shared cache
 * - Client-side dual-tier cache (In-memory + localStorage LRU)
 * - Negative lookup caching (prevents repeat requests for tracks without lyrics)
 * - In-flight request deduplication (prevents duplicate bursts)
 * - Upstream 429 / rate-limit circuit breaker backoff
 * - Accurate track & artist cleaner supporting "Artist - Title" SoundCloud formats
 */

const USER_AGENT_HEADER = "Play-LooP/1.0.0 (https://github.com/vraj07-11/Play-LooP)";
const TIMEOUT_MS = 6000;
const STORAGE_KEY = "playloop_lyrics_cache_v2";
const MAX_LOCAL_ENTRIES = 120;
const POSITIVE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const NEGATIVE_TTL = 24 * 60 * 60 * 1000;     // 24 hours

// In-memory cache for ultra-fast instant lookups during user session
const memoryCache = new Map();

// In-flight Promise tracker to deduplicate concurrent requests for the exact same track
const inFlightRequests = new Map();

// Client-side rate-limit backoff circuit breaker (active if 429 received)
let clientBackoffUntil = 0;

/**
 * Load persisted lyrics cache from localStorage
 */
function readStorageCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Save entry to localStorage with LRU eviction and TTL
 */
function saveStorageCache(key, value, isPositive = true) {
  try {
    const cache = readStorageCache();
    const now = Date.now();
    const ttl = isPositive ? POSITIVE_TTL : NEGATIVE_TTL;

    // Prune expired entries
    const keys = Object.keys(cache);
    for (const k of keys) {
      if (cache[k]?.expiresAt && now > cache[k].expiresAt) {
        delete cache[k];
      }
    }

    // Evict oldest if exceeding limit
    const remainingKeys = Object.keys(cache);
    if (remainingKeys.length >= MAX_LOCAL_ENTRIES) {
      const oldest = remainingKeys.sort((a, b) => (cache[a]?.savedAt || 0) - (cache[b]?.savedAt || 0))[0];
      if (oldest) delete cache[oldest];
    }

    cache[key] = {
      data: value,
      savedAt: now,
      expiresAt: now + ttl
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Graceful degrade if localStorage is full or disabled
  }
}

/**
 * Check if track is cached in memory or localStorage
 */
function getCachedLyrics(key) {
  // 1. In-memory check
  if (memoryCache.has(key)) {
    const entry = memoryCache.get(key);
    if (Date.now() < entry.expiresAt) {
      return entry.data;
    }
    memoryCache.delete(key);
  }

  // 2. localStorage check
  try {
    const cache = readStorageCache();
    const entry = cache[key];
    if (entry) {
      if (Date.now() < entry.expiresAt) {
        memoryCache.set(key, { data: entry.data, expiresAt: entry.expiresAt });
        return entry.data;
      }
    }
  } catch {
    // Ignore storage errors
  }

  return null;
}

/**
 * Store lyrics in memory and localStorage
 */
function setCachedLyrics(key, data, isPositive = true) {
  const ttl = isPositive ? POSITIVE_TTL : NEGATIVE_TTL;
  memoryCache.set(key, { data, expiresAt: Date.now() + ttl });
  saveStorageCache(key, data, isPositive);
}

/**
 * Parses raw LRC string format ([mm:ss.xx] text) into an array of time-indexed objects.
 * @param {string} lrcText 
 * @returns {Array<{ time: number, text: string }>}
 */
export function parseLRC(lrcText) {
  if (!lrcText || typeof lrcText !== 'string') return [];

  const lines = lrcText.split(/\r?\n/);
  const result = [];
  // Match [mm:ss.xx] or [mm:ss:xx] or [mm:ss.xxx]
  const timeRegex = /\[(\d{2,}):(\d{2})(?:[\.\:](\d{2,3}))?\]/g;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    timeRegex.lastIndex = 0;
    const matches = [...trimmed.matchAll(timeRegex)];
    if (matches.length === 0) continue;

    const text = trimmed.replace(timeRegex, '').trim();

    for (const match of matches) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const sub = match[3] ? parseInt(match[3], 10) : 0;
      const subDivisor = match[3] && match[3].length === 3 ? 1000 : 100;

      const timeInSeconds = minutes * 60 + seconds + sub / subDivisor;
      result.push({ time: timeInSeconds, text });
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

/**
 * Clean up and separate title & artist strings accurately (handling SoundCloud "Artist - Title" patterns).
 */
export function cleanSongMetadata(rawTitle, rawArtist) {
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

  // Remove noise tags from title
  title = title
    .replace(/[\(\[\{]\s*(?:feat|ft)\.?\s+[^)\]\}]+[\)\]\}]/gi, "")
    .replace(/\s+(?:feat|ft)\.?\s+.*/gi, "")
    .replace(/[\(\[\{][^)\]\}]*(?:official|lyric|video|audio|full song|hd|4k|remix|version|slowed|reverb|lofi|lo-fi|prod|edit|visualizer|cover|original|remastered)[^)\]\}]*[\)\]\}]/gi, "")
    .replace(/\s*\|\s*.*$/i, "")
    .trim();

  // Remove noise tags from artist
  artist = artist
    .replace(/\s*-\s*topic$/i, "")
    .replace(/topic|official|channel|vevo|🥀|records|music/gi, "")
    .replace(/[\(\[\{].*?[\)\]\}]/g, "")
    .replace(/^[\s\-–—]+|[\s\-–—]+$/g, "")
    .trim();

  return { title, artist };
}

/**
 * Direct LRCLIB client fallback (used if backend proxy is temporarily unreachable)
 */
async function fetchDirectFromLRCLIB(title, artist, duration) {
  if (Date.now() < clientBackoffUntil) return null;

  const headers = {
    "Lrclib-Client": USER_AGENT_HEADER,
    "X-User-Agent": USER_AGENT_HEADER
  };

  // 1. Try direct match
  try {
    const params = new URLSearchParams();
    params.set("track_name", title);
    if (artist) params.set("artist_name", artist);
    if (duration && duration > 0) params.set("duration", Math.round(duration).toString());

    const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
      headers,
      signal: AbortSignal.timeout ? AbortSignal.timeout(TIMEOUT_MS) : undefined
    });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("retry-after") || "60", 10);
      clientBackoffUntil = Date.now() + Math.max(retryAfter, 10) * 1000;
      return null;
    }

    if (res.ok) {
      const data = await res.json();
      return {
        syncedLyrics: data.syncedLyrics || null,
        plainLyrics: data.plainLyrics || null,
        isInstrumental: Boolean(data.instrumental)
      };
    }
  } catch {
    // Ignore and proceed to search fallback
  }

  // 2. Search fallback
  try {
    if (Date.now() >= clientBackoffUntil) {
      let searchUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}`;
      if (artist) searchUrl += `&artist_name=${encodeURIComponent(artist)}`;

      const searchRes = await fetch(searchUrl, {
        headers,
        signal: AbortSignal.timeout ? AbortSignal.timeout(TIMEOUT_MS) : undefined
      });

      if (searchRes.status === 429) {
        const retryAfter = parseInt(searchRes.headers.get("retry-after") || "60", 10);
        clientBackoffUntil = Date.now() + Math.max(retryAfter, 10) * 1000;
        return null;
      }

      if (searchRes.ok) {
        const results = await searchRes.json();
        if (Array.isArray(results) && results.length > 0) {
          const candidatesWithSynced = results.filter(item => item.syncedLyrics);
          const bestMatch = candidatesWithSynced.length > 0 ? candidatesWithSynced[0] : results[0];
          if (bestMatch) {
            return {
              syncedLyrics: bestMatch.syncedLyrics || null,
              plainLyrics: bestMatch.plainLyrics || null,
              isInstrumental: Boolean(bestMatch.instrumental)
            };
          }
        }
      }
    }
  } catch {
    // Ignore search errors
  }

  return null;
}

/**
 * Fetches synchronized lyrics from backend proxy or LRCLIB with deduplication and caching.
 * @param {string} rawTitle 
 * @param {string} rawArtist 
 * @param {number} duration 
 * @returns {Promise<{ syncedLyrics: Array<{time: number, text: string}>, plainLyrics: string, isInstrumental: boolean } | null>}
 */
export async function fetchSyncedLyrics(rawTitle, rawArtist, duration) {
  const { title, artist } = cleanSongMetadata(rawTitle, rawArtist);
  if (!title) return null;

  const cacheKey = `${title.toLowerCase()}:::${artist.toLowerCase()}`;

  // 1. Check local cache (Memory & localStorage)
  const cached = getCachedLyrics(cacheKey);
  if (cached) {
    if (cached.notFound) return null;
    return {
      syncedLyrics: Array.isArray(cached.syncedLyrics) ? cached.syncedLyrics : parseLRC(cached.rawSyncedLyrics || ""),
      plainLyrics: cached.plainLyrics || "",
      isInstrumental: Boolean(cached.isInstrumental)
    };
  }

  // 2. In-flight deduplication: reuse active Promise if already fetching this track
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const fetchPromise = (async () => {
    let result = null;

    // 3. Try backend proxy (/api/lyrics)
    try {
      const params = new URLSearchParams();
      params.set("track_name", title);
      if (artist) params.set("artist_name", artist);
      if (duration && duration > 0) params.set("duration", Math.round(duration).toString());

      const res = await fetch(`/api/lyrics?${params.toString()}`, {
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout ? AbortSignal.timeout(TIMEOUT_MS) : undefined
      });

      if (res.ok) {
        const data = await res.json();
        if (data && !data.rateLimited) {
          result = data;
        }
      }
    } catch {
      // Backend request failed or timed out, attempt direct fallback
    }

    // 4. Fallback directly to LRCLIB if backend was unavailable
    if (!result) {
      result = await fetchDirectFromLRCLIB(title, artist, duration);
    }

    // 5. Parse and Cache result
    if (result && (result.syncedLyrics || result.plainLyrics || result.isInstrumental)) {
      const parsedLyrics = parseLRC(result.syncedLyrics);
      const payload = {
        syncedLyrics: parsedLyrics,
        rawSyncedLyrics: typeof result.syncedLyrics === 'string' ? result.syncedLyrics : '',
        plainLyrics: result.plainLyrics || '',
        isInstrumental: Boolean(result.isInstrumental)
      };

      setCachedLyrics(cacheKey, payload, true);
      return {
        syncedLyrics: parsedLyrics,
        plainLyrics: payload.plainLyrics,
        isInstrumental: payload.isInstrumental
      };
    } else {
      // Negative cache so we do not spam requests for songs without lyrics
      setCachedLyrics(cacheKey, { notFound: true }, false);
      return null;
    }
  })().finally(() => {
    inFlightRequests.delete(cacheKey);
  });

  inFlightRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}
