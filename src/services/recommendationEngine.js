/**
 * Custom In-House Recommendation & Scoring Engine for LooP
 * Combines candidate pools with personal behavior, anti-repetition rules,
 * user favorites weighting, and title deduplication.
 */

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
