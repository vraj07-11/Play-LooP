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
      const res = await fetchApi(`/api/search?q=${encodeURIComponent(keyword)}`);
      const songs = await res.json();
      const thumbnail = songs && songs.length > 0 ? songs[0].thumbnail : "/logo.svg";
      return {
        playlistId: `QUERY:${keyword}`,
        title: `${keyword} Mix`,
        author: "Play LooP",
        thumbnail: thumbnail,
        count: 30
      };
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
  },
  {
    playlistId: "107584484",
    title: "Romantic Hindi Hits",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/editorial/HindiRomanticHits_20260715091230_500x500.jpg",
    count: 45
  },
  {
    playlistId: "8042456",
    title: "EDM Party Anthems",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/editorial/EDMPartyAnthems_20260810101530_500x500.jpg",
    count: 50
  },
  {
    playlistId: "115784920",
    title: "Workout Motivation",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/editorial/WorkoutMotivation_20260512061200_500x500.jpg",
    count: 40
  },
  {
    playlistId: "98273641",
    title: "Chillhop Beats",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/editorial/ChillhopBeats_20260405081000_500x500.jpg",
    count: 35
  },
  {
    playlistId: "88471029",
    title: "Best of 2000s Pop",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/editorial/charts_English2000s_178363_20240408065247_500x500.jpg",
    count: 50
  },
  {
    playlistId: "77492018",
    title: "Acoustic Sunset",
    author: "Play LooP",
    thumbnail: "https://c.saavncdn.com/editorial/AcousticSunset_20260310052000_500x500.jpg",
    count: 30
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

export async function fetchPlaylistDetails(playlistId, page = 1) {
  try {
    const res = await fetchApi(`/api/playlist?id=${encodeURIComponent(playlistId)}&page=${page}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
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

export async function fetchPopularArtists(languages = []) {
  try {
    const langQuery = languages.length > 0 ? `?languages=${languages.join(',')}` : '';
    const res = await fetchApi(`/api/trending-artists${langQuery}`);
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
