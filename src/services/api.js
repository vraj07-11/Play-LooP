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

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const DEFAULT_PLAYLISTS = [
  {
    playlistId: "QUERY:Arijit Singh",
    title: "Arijit Singh Hits",
    author: "Play LooP",
    thumbnail: "/logo.svg",
    count: 25
  },
  {
    playlistId: "QUERY:Latest Hindi Songs",
    title: "Latest Hindi Hits",
    author: "Play LooP",
    thumbnail: "/logo.svg",
    count: 30
  },
  {
    playlistId: "QUERY:Phonk Beats",
    title: "Phonk Drift & Bass",
    author: "Play LooP",
    thumbnail: "/logo.svg",
    count: 20
  },
  {
    playlistId: "QUERY:Global Top Hits",
    title: "Global Top 50",
    author: "Play LooP",
    thumbnail: "/logo.svg",
    count: 40
  },
  {
    playlistId: "QUERY:Chill Lofi Beats",
    title: "Chill Lofi Mix",
    author: "Play LooP",
    thumbnail: "/logo.svg",
    count: 25
  },
  {
    playlistId: "QUERY:Bollywood Romantic Songs",
    title: "Bollywood Romance",
    author: "Play LooP",
    thumbnail: "/logo.svg",
    count: 25
  },
  {
    playlistId: "QUERY:Punjabi Party Hits",
    title: "Punjabi Bangers",
    author: "Play LooP",
    thumbnail: "/logo.svg",
    count: 30
  },
  {
    playlistId: "QUERY:EDM Dance Hits",
    title: "EDM Dance Party",
    author: "Play LooP",
    thumbnail: "/logo.svg",
    count: 20
  },
  {
    playlistId: "QUERY:90s Hindi Hits",
    title: "90s Bollywood Classics",
    author: "Play LooP",
    thumbnail: "/logo.svg",
    count: 25
  },
  {
    playlistId: "QUERY:Workout Hype Beats",
    title: "Gym & Workout Hype",
    author: "Play LooP",
    thumbnail: "/logo.svg",
    count: 25
  },
  {
    playlistId: "QUERY:Indie India",
    title: "Indie India Discovery",
    author: "Play LooP",
    thumbnail: "/logo.svg",
    count: 20
  },
  {
    playlistId: "QUERY:Sufi Melodies",
    title: "Soulful Sufi & Rock",
    author: "Play LooP",
    thumbnail: "/logo.svg",
    count: 20
  }
];

export async function fetchRecommendedPlaylists() {
  try {
    const res = await fetchApi('/api/playlists');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) return shuffleArray(data);
    return shuffleArray(DEFAULT_PLAYLISTS);
  } catch (err) {
    console.warn("fetchRecommendedPlaylists using fallback playlists:", err);
    return shuffleArray(DEFAULT_PLAYLISTS);
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
