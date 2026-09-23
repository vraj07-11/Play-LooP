/**
 * Custom In-House Recommendation & Scoring Engine for LooP
 * Combines candidate pools with personal behavior, anti-repetition rules,
 * user favorites weighting, and title deduplication.
 */

function cleanString(str = "") {
  return String(str || "")
    .toLowerCase()
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
 * @param {number} [params.limit=10] - Maximum number of recommendations to return
 * @returns {Array} Ranked and deduplicated array of song objects
 */
export function generateRecommendations({
  currentTrack = {},
  candidatePool = [],
  history = [],
  likedSongs = [],
  limit = 10
}) {
  if (!Array.isArray(candidatePool) || candidatePool.length === 0) {
    return [];
  }

  const currentId = currentTrack?.videoId || "";
  const currentTitleClean = cleanString(currentTrack?.title);
  const currentArtistClean = cleanString(currentTrack?.artist);

  // Take the last 15 songs from play history for anti-repetition filter
  const recentHistory = Array.isArray(history) ? history.slice(-15) : [];
  const recentlyPlayedIds = new Set(recentHistory.map(t => t.videoId).filter(Boolean));
  const recentlyPlayedTitles = new Set(recentHistory.map(t => cleanString(t.title)).filter(Boolean));

  // User liked songs set
  const likedTrackIds = new Set(
    (Array.isArray(likedSongs) ? likedSongs : [])
      .map(t => t.videoId)
      .filter(Boolean)
  );

  const seenTitles = new Set();
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
    if (trackTitleClean && seenTitles.has(trackTitleClean)) {
      continue;
    }
    if (trackTitleClean) seenTitles.add(trackTitleClean);

    let score = 0;

    // Heavy penalty for recently played songs to prevent loops
    if (recentlyPlayedIds.has(track.videoId) || (trackTitleClean && recentlyPlayedTitles.has(trackTitleClean))) {
      score -= 100;
    }

    // Moderate boost if candidate shares primary artist with current track
    if (trackArtistClean && currentArtistClean && (trackArtistClean.includes(currentArtistClean) || currentArtistClean.includes(trackArtistClean))) {
      score += 10;
    }

    // Bonus for user favorites
    if (likedTrackIds.has(track.videoId)) {
      score += 15;
    }

    // Larger random jitter for better queue diversity
    score += Math.random() * 25;

    scoredCandidates.push({ track, score });
  }

  // Sort descending by score
  scoredCandidates.sort((a, b) => b.score - a.score);

  // Filter out heavily penalized songs if we have enough fresh alternatives
  let finalTracks = scoredCandidates
    .filter(item => item.score > -50)
    .map(item => item.track);

  // Fallback: If filtering was too strict and left us empty, include all non-duplicate scored tracks
  if (finalTracks.length === 0) {
    finalTracks = scoredCandidates.map(item => item.track);
  }

  return finalTracks.slice(0, limit);
}
