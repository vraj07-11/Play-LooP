export const MIN_SONG_DURATION = 35; // Must be longer than 35 seconds (> 35)
export const MAX_SONG_DURATION = 420; // Must be less than 7 minutes (< 420 seconds)

export function parseDurationInSeconds(d) {
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

export function isValidSongDuration(duration) {
  const secs = parseDurationInSeconds(duration);
  return secs > MIN_SONG_DURATION && secs < MAX_SONG_DURATION;
}

export function filterValidDurationTracks(tracks) {
  if (!Array.isArray(tracks)) return [];
  return tracks.filter(t => Boolean(t && isValidSongDuration(t.duration)));
}
