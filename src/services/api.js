// Fetch API helper
export async function fetchApi(endpoint, options = {}) {
  try {
    return await fetch(endpoint, options);
  } catch (err) {
    if (err.name === "AbortError") throw err;
    console.error("fetchApi error:", err);
    throw err;
  }
}

export function getAudioUrl(videoId) {
  return `/api/audio?id=${encodeURIComponent(videoId)}`;
}

export async function fetchRecommendedPlaylists() {
  try {
    const res = await fetchApi('/api/playlists');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("fetchRecommendedPlaylists error:", err);
    return [];
  }
}

export async function fetchPlaylistDetails(playlistId) {
  try {
    const res = await fetchApi(`/api/playlist?id=${encodeURIComponent(playlistId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("fetchPlaylistDetails error:", err);
    return null;
  }
}
