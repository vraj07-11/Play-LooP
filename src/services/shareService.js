/**
 * Share track utility with clean short URL formatting (no third-party CDN exposed)
 * and interactive multi-platform sharing modal.
 */

export function getCleanShareUrl(videoId) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://play-loop.onrender.com';
  return `${origin}/track/${encodeURIComponent(videoId)}`;
}

export async function shareTrack(track, showToast = (msg) => console.log(msg)) {
  if (!track || !track.videoId) {
    showToast("No track selected to share");
    return;
  }

  // Trigger interactive multi-platform ShareModal
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('playloop-open-share', { detail: track }));
  }
}

