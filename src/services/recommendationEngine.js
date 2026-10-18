/**
 * Custom In-House Recommendation & Scoring Engine for LooP
 * Combines candidate pools with personal behavior, anti-repetition rules,
 * user favorites weighting, and title deduplication.
 *
 * Also exports getRecommendations() — a three-tier async function that
 * derives personalized suggestions from scrobble history, current track
 * context, or popular defaults (cold start).
 */

// --- Constants ---
const LOCAL_SCROBBLES_KEY = 'playloop_scrobbles';

// --- Internal helpers ---

function _readLocalScrobbles() {
  try {
    const raw = localStorage.getItem(LOCAL_SCROBBLES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

/**
 * Given a list of scrobbles, return the top N artists by play count.
 * @param {Array} scrobbles
 * @param {number} n
 * @returns {string[]} Artist names, most-played first
 */
function _topArtists(scrobbles, n = 3) {
  const counts = {};
  for (const s of scrobbles) {
    const a = (s.artist || '').trim();
    if (a) counts[a] = (counts[a] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([artist]) => artist);
}

/**
 * Fetch tracks from the server search API for a given query.
 * Returns an empty array on any failure.
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<Array>}
 */
async function _searchTracks(query, limit = 8) {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&n=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    // The endpoint returns either an array (simple search) or { songs } (multi search)
    const songs = Array.isArray(data) ? data : (data.songs || []);
    return songs.filter(s => s && s.videoId);
  } catch (_) {
    return [];
  }
}

/**
 * Fetch default popular / trending tracks from the server.
 * @returns {Promise<Array>}
 */
async function _fetchPopular() {
  try {
    const res = await fetch('/api/popular-songs');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data.filter(s => s && s.videoId) : [];
  } catch (_) {
    return [];
  }
}

/**
 * Three-tier async recommendation function.
 *
 * Tier 1 — Personalized:
 *   Read the last 20 scrobbles from localStorage, extract top 3 artists,
 *   search for tracks from those artists, exclude the 5 most-recently
 *   scrobbled tracks to prevent immediate repetition.
 *
 * Tier 2 — Contextual Fallback:
 *   If history has < 3 scrobbles, use the current playing track's artist.
 *
 * Tier 3 — Cold Start:
 *   No scrobbles and no active track → return popular/trending tracks.
 *
 * @param {Object} [options]
 * @param {number} [options.limit=10]           Max tracks to return
 * @param {Object} [options.currentTrack=null]  Currently playing track {videoId,title,artist}
 * @returns {Promise<Array>}
 */
export async function getRecommendations({ limit = 10, currentTrack = null } = {}) {
  const scrobbles = _readLocalScrobbles();
  const recent20 = scrobbles.slice(-20);

  // IDs & titles to exclude (last 5 scrobbled tracks)
  const recentlyScrobbledIds = new Set(
    scrobbles.slice(-5).map(s => s.track_id).filter(Boolean)
  );
  const recentlyScrobbledTitles = new Set(
    scrobbles.slice(-5).map(s => (s.title || '').toLowerCase().trim()).filter(Boolean)
  );

  const _isDuplicate = (track) => {
    if (!track) return true;
    if (track.videoId && recentlyScrobbledIds.has(track.videoId)) return true;
    const t = (track.title || '').toLowerCase().trim();
    return t && recentlyScrobbledTitles.has(t);
  };

  const _dedup = (tracks) => {
    const seen = new Set();
    return tracks.filter(t => {
      if (!t || !t.videoId) return false;
      const key = t.videoId;
      if (seen.has(key)) return false;
      seen.add(key);
      return !_isDuplicate(t);
    });
  };

  // --- Tier 1: Personalized from scrobble history ---
  if (recent20.length >= 3) {
    const artists = _topArtists(recent20, 3);
    const results = await Promise.allSettled(artists.map(a => _searchTracks(a, limit)));
    const poolMap = new Map();
    for (const r of results) {
      if (r.status === 'fulfilled') {
        for (const t of r.value) {
          if (t.videoId && !poolMap.has(t.videoId)) poolMap.set(t.videoId, t);
        }
      }
    }
    const pool = _dedup([...poolMap.values()]);
    if (pool.length >= Math.min(3, limit)) {
      return pool.slice(0, limit);
    }
  }

  // --- Tier 2: Contextual fallback from current track ---
  const activeArtist = currentTrack?.artist;
  if (activeArtist) {
    const tracks = await _searchTracks(activeArtist, limit + 5);
    const pool = _dedup(tracks);
    if (pool.length > 0) {
      return pool.slice(0, limit);
    }
  }

  // --- Tier 3: Cold-start popular tracks ---
  const popular = await _fetchPopular();
  return _dedup(popular).slice(0, limit);
}

function cleanString(str = "") {
  return String(str || "")
    .toLowerCase()
    .replace(/\(official.*?\)/gi, '')
    .replace(/\[official.*?\]/gi, '')
    .replace(/\(lyric.*?\)/gi, '')
    .replace(/\[lyric.*?\]/gi, '')
    .replace(/\(music video\)/gi, '')
    .replace(/\[music video\]/gi, '')
    .replace(/\(audio\)/gi, '')
    .replace(/\[audio\]/gi, '')
    .replace(/ft\..*$/gi, '')
    .replace(/feat\..*$/gi, '')
    .replace(/\|.*$/gi, '')
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Ranks candidate songs based on current track context, listening history, and user preferences.
 * 
 * @param {Object} params
 * @param {Object} params.currentTrack - Currently playing track object { videoId, title, artist }
 * @param {Array} params.candidatePool - Array of raw song objects returned from API/recommendations
 * @param {Array} params.history - Array of recently played song objects
 * @param {Array} params.likedSongs - Array of user's liked/favorite track objects
 * @param {Set} [params.seenIds] - Set of videoIds already shown in current session
 * @param {Set} [params.seenTitles] - Set of cleaned titles already shown in current session
 * @param {number} [params.limit=10] - Maximum number of recommendations to return
 * @returns {Array} Ranked and deduplicated array of song objects
 */
export function generateRecommendations({
  currentTrack = {},
  candidatePool = [],
  history = [],
  likedSongs = [],
  seenIds = new Set(),
  seenTitles = new Set(),
  limit = 10
}) {
  if (!Array.isArray(candidatePool) || candidatePool.length === 0) {
    return [];
  }

  const currentId = currentTrack?.videoId || "";
  const currentTitleClean = cleanString(currentTrack?.title);
  const currentArtistClean = cleanString(currentTrack?.artist);

  // Take all recent history for anti-repetition filter
  const recentHistory = Array.isArray(history) ? history : [];
  const historyIds = new Set(recentHistory.map(t => t.videoId).filter(Boolean));
  const historyTitles = new Set(recentHistory.map(t => cleanString(t.title)).filter(Boolean));

  // User liked songs set
  const likedTrackIds = new Set(
    (Array.isArray(likedSongs) ? likedSongs : [])
      .map(t => t.videoId)
      .filter(Boolean)
  );

  const localSeenTitles = new Set();
  const scoredCandidates = [];

  for (const track of candidatePool) {
    if (!track || !track.videoId) continue;

    const trackTitleClean = cleanString(track.title);
    const trackArtistClean = cleanString(track.artist);

    // Skip exact current track
    if (track.videoId === currentId || (trackTitleClean && trackTitleClean === currentTitleClean)) {
      continue;
    }

    // Deduplicate within the candidate pool itself
    if (trackTitleClean && localSeenTitles.has(trackTitleClean)) {
      continue;
    }
    if (trackTitleClean) localSeenTitles.add(trackTitleClean);

    let score = 0;

    // Heavy penalty for recently played songs & previously seen session recommendations to prevent loops
    if (historyIds.has(track.videoId) || (trackTitleClean && historyTitles.has(trackTitleClean))) {
      score -= 500;
    }
    if (seenIds.has(track.videoId) || (trackTitleClean && seenTitles.has(trackTitleClean))) {
      score -= 400;
    }

    // Moderate boost if candidate shares primary artist with current track
    if (trackArtistClean && currentArtistClean && (trackArtistClean.includes(currentArtistClean) || currentArtistClean.includes(trackArtistClean))) {
      score += 15;
    }

    // Bonus for user favorites
    if (likedTrackIds.has(track.videoId)) {
      score += 20;
    }

    // High random jitter for maximum queue diversity across refreshes
    score += Math.random() * 40;

    scoredCandidates.push({ track, score });
  }

  // Sort descending by score
  scoredCandidates.sort((a, b) => b.score - a.score);

  // Strictly filter out heavily penalized (already seen/played) songs first
  let freshTracks = scoredCandidates
    .filter(item => item.score > 0)
    .map(item => item.track);

  // Fallback 1: If strict filtering left us short, allow non-history tracks
  if (freshTracks.length < limit) {
    const fallbackTracks = scoredCandidates
      .filter(item => item.score > -300)
      .map(item => item.track);
    if (fallbackTracks.length > freshTracks.length) {
      freshTracks = fallbackTracks;
    }
  }

  // Fallback 2: Ultimate fallback if candidate pool was tiny
  if (freshTracks.length === 0) {
    freshTracks = scoredCandidates.map(item => item.track);
  }

  return freshTracks.slice(0, limit);
}
