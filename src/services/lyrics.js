/**
 * LRCLIB Synced Lyrics Service
 * Documentation: https://lrclib.net
 */

const USER_AGENT_HEADER = "Play-LooP/1.0.0 (https://github.com/vraj07-11/SPOTIFY-CLONE)";

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
 * Clean up title string to improve LRCLIB matching precision
 */
function cleanSongTitle(title) {
  if (!title) return '';
  return title
    .replace(/[\(\[\{].*?(official|lyric|video|audio|full song|hd|4k|remix|version).*?[\)\]\}]/gi, '')
    .replace(/ft\..*|feat\..*/gi, '')
    .trim();
}

/**
 * Clean up artist name
 */
function cleanArtistName(artist) {
  if (!artist || artist === 'Play LooP' || artist === 'Various Artists') return '';
  return artist
    .replace(/topic|official|channel|vevo/gi, '')
    .trim();
}

/**
 * Fetches synchronized lyrics from LRCLIB API.
 * @param {string} title 
 * @param {string} artist 
 * @param {number} duration 
 * @returns {Promise<{ syncedLyrics: Array<{time: number, text: string}>, plainLyrics: string, isInstrumental: boolean } | null>}
 */
export async function fetchSyncedLyrics(title, artist, duration) {
  const cleanedTitle = cleanSongTitle(title);
  const cleanedArtist = cleanArtistName(artist);

  if (!cleanedTitle) return null;

  const headers = {
    'X-User-Agent': USER_AGENT_HEADER
  };

  // 1. Primary endpoint: GET /api/get
  try {
    const params = new URLSearchParams();
    params.set('track_name', cleanedTitle);
    if (cleanedArtist) params.set('artist_name', cleanedArtist);
    if (duration && duration > 0) params.set('duration', Math.round(duration).toString());

    const response = await fetch(`https://lrclib.net/api/get?${params.toString()}`, { headers });

    if (response.ok) {
      const data = await response.json();
      if (data.instrumental) {
        return { syncedLyrics: [], plainLyrics: '', isInstrumental: true };
      }
      if (data.syncedLyrics) {
        return {
          syncedLyrics: parseLRC(data.syncedLyrics),
          plainLyrics: data.plainLyrics || '',
          isInstrumental: false
        };
      }
    }
  } catch (err) {
    console.warn('[LRCLIB] Direct match fetch error:', err.message);
  }

  // 2. Search fallback endpoint: GET /api/search?q=...
  try {
    const query = `${cleanedTitle} ${cleanedArtist}`.trim();
    const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
    const searchRes = await fetch(searchUrl, { headers });

    if (searchRes.ok) {
      const results = await searchRes.json();
      if (Array.isArray(results) && results.length > 0) {
        // Find best candidate with synced lyrics
        const bestMatch = results.find(item => item.syncedLyrics) || results[0];
        if (bestMatch.instrumental) {
          return { syncedLyrics: [], plainLyrics: '', isInstrumental: true };
        }
        if (bestMatch.syncedLyrics) {
          return {
            syncedLyrics: parseLRC(bestMatch.syncedLyrics),
            plainLyrics: bestMatch.plainLyrics || '',
            isInstrumental: false
          };
        }
        if (bestMatch.plainLyrics) {
          return {
            syncedLyrics: [],
            plainLyrics: bestMatch.plainLyrics,
            isInstrumental: false
          };
        }
      }
    }
  } catch (err) {
    console.warn('[LRCLIB] Search fallback error:', err.message);
  }

  return null;
}
