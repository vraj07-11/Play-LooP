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
    playlistId: "947987697",
    title: "Global Pop",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/editorial/GlobalPop_20260608125844_500x500.jpg",
    count: 30
  },
  {
    playlistId: "1134543272",
    title: "India Superhits Top 50",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/editorial/Hindi-IndiaSuperhitsTop50_20260911054516_500x500.jpg",
    count: 50
  },
  {
    playlistId: "47599074",
    title: "Now Trending",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/editorial/NowTrending_20260423085344_500x500.jpg",
    count: 30
  },
  {
    playlistId: "1202559627",
    title: "Viral Desi Dance Hits",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/editorial/ViralDesiDanceHits_20260723071136_500x500.jpg",
    count: 40
  },
  {
    playlistId: "63116930",
    title: "English 2010s",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/editorial/charts_English2010s_178363_20240408065247_500x500.jpg",
    count: 50
  },
  {
    playlistId: "48189087",
    title: "English Viral Hits",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/editorial/EnglishViralHits_20260902085244_500x500.jpg",
    count: 30
  },
  {
    playlistId: "1210453303",
    title: "Latest Hindi Songs",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/editorial/LatestHindiSongs_20260326041941_500x500.jpg",
    count: 30
  },
  {
    playlistId: "1167751266",
    title: "Hindi 1990s",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/editorial/charts_Hindi1990s_136920_20240408061858_500x500.jpg",
    count: 50
  },
  {
    playlistId: "4144832",
    title: "Punjabi Hit Songs",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/editorial/PunjabiHitSongs_20260710115246_500x500.jpg",
    count: 50
  },
  {
    playlistId: "1214335916",
    title: "Lofi India Hits",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/editorial/LofiIndiaHits_20240307035844_500x500.jpg",
    count: 40
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
