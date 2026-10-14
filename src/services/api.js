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
  const quality = localStorage.getItem('playloop_audio_quality') || '320';
  return `/api/audio?id=${encodeURIComponent(videoId)}&quality=${encodeURIComponent(quality)}`;
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const MOODS = ["Chill", "Happy", "Sad", "Late Night", "Workout", "Party", "Romantic", "Focus", "Upbeat", "Melancholy", "Cozy", "Energetic", "Relaxing", "Driving"];
const GENRES = ["Pop", "Hip Hop", "Lofi", "Bollywood", "K-Pop", "Jazz", "Classical", "Rock", "R&B", "Indie", "Acoustic", "Electronic", "Country"];
const ARTISTS = ["The Weeknd", "Taylor Swift", "Arijit Singh", "Drake", "Bad Bunny", "Billie Eilish", "BTS", "Ed Sheeran", "Justin Bieber", "Travis Scott", "A.R. Rahman", "Post Malone", "Dua Lipa", "Neha Kakkar", "Shreya Ghoshal", "Imagine Dragons", "Atif Aslam", "Coldplay", "Bruno Mars", "Ariana Grande"];

function getRandomKeywords(count) {
  const generated = new Set();
  while(generated.size < count) {
    const r = Math.random();
    let keyword = "";
    if (r < 0.4) {
       // Mood + Genre (e.g., "Late Night Lofi")
       keyword = MOODS[Math.floor(Math.random() * MOODS.length)] + " " + GENRES[Math.floor(Math.random() * GENRES.length)];
    } else if (r < 0.7) {
       // Just Artist
       keyword = ARTISTS[Math.floor(Math.random() * ARTISTS.length)];
    } else {
       // Artist + Mood (e.g., "The Weeknd Chill")
       keyword = ARTISTS[Math.floor(Math.random() * ARTISTS.length)] + " " + MOODS[Math.floor(Math.random() * MOODS.length)];
    }
    generated.add(keyword);
  }
  return Array.from(generated);
}

export async function fetchMoreDynamicPlaylists(count = 5) {
  const keywords = getRandomKeywords(count);
  const promises = keywords.map(async (keyword) => {
    try {
      const details = await fetchPlaylistDetails(`QUERY:${keyword}`, 1);
      if (details) {
        return {
          playlistId: `QUERY:${keyword}`,
          title: details.title || `${keyword} Mix`,
          author: "Play LooP",
          thumbnail: details.thumbnail || "/default-cover.svg",
          count: details.tracks?.length || 30
        };
      }
      return null;
    } catch (e) {
      return null;
    }
  });
  
  const results = await Promise.all(promises);
  return results.filter(Boolean);
}

export const DEFAULT_PLAYLISTS = [
  {
    playlistId: "947987697",
    title: "Global Pop",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/773/Heartless-English-2026-20260521060358-500x500.jpg",
    count: 50
  },
  {
    playlistId: "1134543272",
    title: "Hindi: India Superhits Top 50",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/786/Casa-Tupka-Anthemo-Hindi-2026-20260917173352-500x500.jpg",
    count: 50
  },
  {
    playlistId: "47599074",
    title: "Now Trending",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/238/Bairan-Unknown-2026-20260223182954-500x500.jpg",
    count: 40
  },
  {
    playlistId: "1202559627",
    title: "Viral Desi Dance Hits",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/784/Uyi-Amma-From-Azaad-Hindi-2025-20250106040010-500x500.jpg",
    count: 40
  },
  {
    playlistId: "63116930",
    title: "English 2010s",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/728/My-World-2-0-English-2010-20250315014144-500x500.jpg",
    count: 50
  },
  {
    playlistId: "48189087",
    title: "English Viral Hits",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/676/Dua-Lipa-Live-from-the-Royal-Albert-Hall-English-2024-20241204143122-500x500.jpg",
    count: 40
  },
  {
    playlistId: "1210453303",
    title: "Latest Hindi Songs",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/758/Samjho-Na-From-The-Vvaan-Hindi-2026-20260904111123-500x500.jpg",
    count: 40
  },
  {
    playlistId: "1167751266",
    title: "Hindi 1990s",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/474/Main-Khiladi-Tu-Anari-Original-Motion-Picture-Soundtrack-Hindi-1994-20250912131553-500x500.jpg",
    count: 50
  },
  {
    playlistId: "4144832",
    title: "Punjabi Hit Songs",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/918/AUJLA-SZN-1-Punjabi-2026-20260930131343-500x500.jpg",
    count: 50
  },
  {
    playlistId: "1214335916",
    title: "Lofi India Hits",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/465/Yeh-Vaada-Raha-Lofi-Flip-Hindi-2023-20230712053408-500x500.jpg",
    count: 40
  },
  {
    playlistId: "1134595537",
    title: "International : India Superhits Top 50",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/075/Jamaican-Bam-Bam-English-2026-20260309165945-500x500.jpg",
    count: 50
  },
  {
    playlistId: "110858205",
    title: "Trending Today",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/741/hate-that-i-made-you-love-me-English-2026-20260529103543-500x500.jpg",
    count: 50
  },
  {
    playlistId: "902306817",
    title: "Viral Nation",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/786/Casa-Tupka-Anthemo-Hindi-2026-20260917173352-500x500.jpg",
    count: 40
  },
  {
    playlistId: "1199709032",
    title: "Best of Phonk",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/023/Killers-From-The-Northside-English-2021-20211019215330-500x500.jpg",
    count: 40
  },
  {
    playlistId: "410785269",
    title: "Best of K-Pop",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/223/Dynamite-English-2021-20211124055845-500x500.jpg",
    count: 40
  },
  {
    playlistId: "303128179",
    title: "Best of Pop - English",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/111/Espresso-English-2024-20240412064803-500x500.jpg",
    count: 40
  },
  {
    playlistId: "78211018",
    title: "Best of Dance - English",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/665/Future-Nostalgia-English-2020-20260306223201-500x500.jpg",
    count: 40
  },
  {
    playlistId: "158049570",
    title: "Chill Beats",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/246/Dracula-Remix-English-2026-20260203071441-500x500.jpg",
    count: 40
  },
  {
    playlistId: "87109788",
    title: "Hip Hop Workout",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/035/HABIBTI-FOMO-English-2026-20261002063545-500x500.jpg",
    count: 40
  },
  {
    playlistId: "84576159",
    title: "Best of Hip Hop - English",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/087/The-Massacre-English-2005-20250422032513-500x500.jpg",
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

const playlistDetailsCache = new Map();

export function getCachedPlaylistThumbnail(playlistId) {
  if (!playlistId) return null;
  const cached = playlistDetailsCache.get(`${playlistId}:1`);
  return cached?.thumbnail || null;
}

export function cachePlaylistThumbnail(playlistId, thumbnail) {
  if (!playlistId || !thumbnail) return;
  const existing = playlistDetailsCache.get(`${playlistId}:1`) || {};
  playlistDetailsCache.set(`${playlistId}:1`, { ...existing, playlistId, thumbnail });
}

export async function fetchPlaylistDetails(playlistId, page = 1) {
  const cacheKey = `${playlistId}:${page}`;
  if (playlistDetailsCache.has(cacheKey)) {
    return playlistDetailsCache.get(cacheKey);
  }

  // Check if it's an imported or locally saved playlist with tracks stored in localStorage
  try {
    const saved = JSON.parse(localStorage.getItem('playloop_saved_playlists') || '[]');
    const localMatch = saved.find(p => String(p.playlistId) === String(playlistId));
    if (localMatch && Array.isArray(localMatch.tracks) && localMatch.tracks.length > 0) {
      const result = {
        playlistId: localMatch.playlistId,
        title: localMatch.title,
        author: localMatch.author || 'Imported Playlist',
        thumbnail: (!localMatch.thumbnail || localMatch.thumbnail === '/logo.svg') ? '/default-cover.svg' : localMatch.thumbnail,
        description: localMatch.description || `Collection containing ${localMatch.tracks.length} tracks.`,
        count: localMatch.tracks.length,
        tracks: localMatch.tracks
      };
      if (page === 1) playlistDetailsCache.set(cacheKey, result);
      return result;
    }
  } catch (err) {
    console.error("Error checking local saved playlists:", err);
  }

  try {
    const res = await fetchApi(`/api/playlist?id=${encodeURIComponent(playlistId)}&page=${page}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && data.playlistId) {
      playlistDetailsCache.set(cacheKey, data);
    }
    return data;
  } catch (err) {
    console.error("fetchPlaylistDetails error:", err);
    return null;
  }
}

export async function fetchPopularSongs(languages = []) {
  try {
    const langQuery = languages.length > 0 ? `?languages=${languages.join(',')}` : '';
    const res = await fetchApi(`/api/popular-songs${langQuery}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.error("Failed to fetch popular songs by language:", err);
  }
  return [];
}

export async function fetchPopularArtists(languages = [], limit = 5) {
  try {
    const langQuery = languages.length > 0 ? `languages=${languages.join(',')}` : '';
    const limitQuery = `limit=${limit}`;
    const query = [langQuery, limitQuery].filter(Boolean).join('&');
    const res = await fetchApi(`/api/trending-artists?${query}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.error("Failed to fetch real-time trending artists:", err);
  }
  
  return [
    {
      "playlistId": "ARTIST:459320",
      "title": "Arijit Singh",
      "thumbnail": "https://c.saavncdn.com/artists/Arijit_Singh_004_20241118063717_500x500.jpg",
      "author": "Artist"
    },
    {
      "playlistId": "ARTIST:615155",
      "title": "The Weeknd",
      "thumbnail": "https://c.saavncdn.com/artists/The_Weeknd_002_20241003071400_500x500.jpg",
      "author": "Artist"
    },
    {
      "playlistId": "ARTIST:565990",
      "title": "Taylor Swift",
      "thumbnail": "https://c.saavncdn.com/artists/Taylor_Swift_003_20200226074119_500x500.jpg",
      "author": "Artist"
    },
    {
      "playlistId": "ARTIST:2029479",
      "title": "Bad Bunny",
      "thumbnail": "https://c.saavncdn.com/artists/Bad_Bunny_001_20250207055513_500x500.jpg",
      "author": "Artist"
    },
    {
      "playlistId": "ARTIST:512453",
      "title": "Drake",
      "thumbnail": "https://c.saavncdn.com/artists/Drake_006_20260520062317_500x500.jpg",
      "author": "Artist"
    },
    {
      "playlistId": "ARTIST:456323",
      "title": "Pritam",
      "thumbnail": "https://c.saavncdn.com/artists/Pritam_Chakraborty-20170711073326_500x500.jpg",
      "author": "Artist"
    },
    {
      "playlistId": "ARTIST:456269",
      "title": "A.R. Rahman",
      "thumbnail": "https://c.saavncdn.com/artists/AR_Rahman_002_20210120084455_500x500.jpg",
      "author": "Artist"
    },
    {
      "playlistId": "ARTIST:1274170",
      "title": "Dua Lipa",
      "thumbnail": "https://c.saavncdn.com/artists/Dua_Lipa_004_20231120090922_500x500.jpg",
      "author": "Artist"
    },
    {
      "playlistId": "ARTIST:1918741",
      "title": "Billie Eilish",
      "thumbnail": "https://c.saavncdn.com/artists/Billie_Eilish_20190211151539_500x500.jpg",
      "author": "Artist"
    },
    {
      "playlistId": "ARTIST:568565",
      "title": "Justin Bieber",
      "thumbnail": "https://c.saavncdn.com/artists/Justin_Bieber_005_20201127112218_500x500.jpg",
      "author": "Artist"
    }
  ];
}
