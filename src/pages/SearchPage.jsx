import React, { useState, useEffect, useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { fetchApi, fetchPopularArtists, fetchPopularSongs, DEFAULT_PLAYLISTS } from '../services/api';
import { Search, Play, Music, Mic2, Disc3, Radio } from 'lucide-react';

const DEFAULT_POPULAR_SONGS = [
  {
    videoId: "oemj5iht",
    title: "Chikiri Chikiri",
    artist: "A.R. Rahman, Mohit Chauhan",
    thumbnail: "https://c.saavncdn.com/129/A-R-Rahman-Tollywood-Superhits-Telugu-2026-20260106191102-500x500.jpg"
  },
  {
    videoId: "qbQ0IFxj",
    title: "Yeshanagula",
    artist: "Anirudh Ravichander",
    thumbnail: "https://c.saavncdn.com/218/Yeshanagula-From-The-Paradise-Telugu-Telugu-2026-20260829173806-500x500.jpg"
  },
  {
    videoId: "1134543272",
    title: "India Superhits Top Track",
    artist: "Arijit Singh, Pritam",
    thumbnail: "https://c.saavncdn.com/editorial/Hindi-IndiaSuperhitsTop50_20260911054516_500x500.jpg"
  },
  {
    videoId: "947987697",
    title: "Global Pop Hit",
    artist: "The Weeknd, Dua Lipa",
    thumbnail: "https://c.saavncdn.com/editorial/GlobalPop_20260608125844_500x500.jpg"
  },
  {
    videoId: "47599074",
    title: "Now Trending Anthem",
    artist: "Badshah, Yo Yo Honey Singh",
    thumbnail: "https://c.saavncdn.com/editorial/NowTrending_20260423085344_500x500.jpg"
  }
];

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const { selectAndPlayTrack, playPlaylist } = usePlayer();
  const mainScrollRef = useRef(null);

  const [popularArtists, setPopularArtists] = useState([]);
  const [popularSongsData, setPopularSongsData] = useState(DEFAULT_POPULAR_SONGS);
  const [visibleSongCount, setVisibleSongCount] = useState(5);
  const [loadingMoreSongs, setLoadingMoreSongs] = useState(false);
  
  // Use static data for instantaneous load to build the sections
  const featuredAlbums = [...DEFAULT_PLAYLISTS].slice(0, 5);
  const topPlaylists = [...DEFAULT_PLAYLISTS].slice(5, 10);

  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
  }, [query]);

  useEffect(() => {
    let isMounted = true;
    const prefStr = localStorage.getItem('preferred_languages');
    const langs = prefStr ? JSON.parse(prefStr) : [];
    
    // 1. Fetch popular songs strictly by preferred languages (Equal representation)
    fetchPopularSongs(langs)
      .then(songsData => {
        if (isMounted && Array.isArray(songsData) && songsData.length > 0) {
          setPopularSongsData(songsData);
        }
      })
      .catch(e => console.error("Failed to fetch popular songs:", e));

    // 2. Fetch popular artists independently
    fetchPopularArtists(langs)
      .then(artistData => {
        if (isMounted && Array.isArray(artistData) && artistData.length > 0) {
          setPopularArtists(artistData);
        }
      })
      .catch(e => console.error("Failed to fetch popular artists:", e));

    return () => { isMounted = false; };
  }, []);

  const handleLoadMoreSongs = async () => {
    const nextCount = visibleSongCount + 5;
    if (nextCount > popularSongsData.length) {
      setLoadingMoreSongs(true);
      try {
        const extraKeywords = ["top hits", "trending songs", "charts", "viral hits"];
        const keyword = extraKeywords[Math.floor(Math.random() * extraKeywords.length)];
        const res = await fetchApi(`/api/search?q=${encodeURIComponent(keyword)}`);
        if (res.ok) {
          const extraSongs = await res.json();
          if (Array.isArray(extraSongs) && extraSongs.length > 0) {
            setPopularSongsData(prev => {
              const existingIds = new Set(prev.map(s => s.videoId));
              const newUnique = extraSongs.filter(s => s.videoId && !existingIds.has(s.videoId));
              return [...prev, ...newUnique];
            });
          }
        }
      } catch (e) {
        console.error("Error loading more songs:", e);
      } finally {
        setLoadingMoreSongs(false);
      }
    }
    setVisibleSongCount(nextCount);
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const match = hash.match(/#\/?search\?q=(.+)/);
      if (match) {
        const q = decodeURIComponent(match[1]);
        setQuery(q);
        performSearch(q);
      } else {
        setQuery('');
        setResults([]);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [results]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const active = document.activeElement;
      // Let the search input handle its own keys if focused
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;

      if (!results || results.length === 0 || !query) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % results.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev <= 0 ? results.length - 1 : prev - 1));
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          e.preventDefault();
          const track = results[selectedIndex];
          if (track) {
            const title = track.title || track.name || "Unknown track";
            const artist = typeof track.artist === 'string' ? track.artist : (track.artist?.name || track.artists || "Unknown artist");
            const thumbnail = track.thumbnail || track.thumbnails?.find((item) => item?.url)?.url || '/logo.svg';
            selectAndPlayTrack(track.videoId, title, artist, thumbnail);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [results, selectedIndex, selectAndPlayTrack, query]);

  const performSearch = async (searchTerm) => {
    setLoading(true);
    try {
      const response = await fetchApi(`/api/search?q=${encodeURIComponent(searchTerm)}`);
      if (response.ok) {
        const data = await response.json();
        setResults(data);
      } else {
        setResults([]);
      }
    } catch (e) {
      console.error(e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (item) => {
    if (item.playlistId?.startsWith('ARTIST:')) {
      window.location.hash = `#/search?q=${encodeURIComponent(item.title)}`;
    } else if (item.playlistId?.startsWith('QUERY:')) {
      window.location.hash = `#/search?q=${encodeURIComponent(item.title.replace(' Mix', ''))}`;
    } else if (item.playlistId) {
      playPlaylist(item.playlistId);
    } else {
      window.location.hash = `#/search?q=${encodeURIComponent(item.title)}`;
    }
  };

  return (
    <div ref={mainScrollRef} className="flex flex-col h-full overflow-y-auto custom-scrollbar pb-32 pt-8">
      <div className="px-6 md:px-12 lg:px-16 xl:px-24 max-w-[1600px] mx-auto w-full">
        
        {!query ? (
          <div className="flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* 1. Popular Songs (Full-Width 2-Column Desktop Grid) */}
            <section className="mb-10 sm:mb-16 w-full">
              <div className="flex items-center gap-2.5 sm:gap-3 mb-4 sm:mb-6">
                <Music className="text-white w-5 h-5 sm:w-6 sm:h-6" />
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Popular Songs</h2>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {popularSongsData.length > 0 ? (
                  popularSongsData.slice(0, visibleSongCount).map((song, idx) => {
                    const title = song.title || song.name || "Unknown track";
                    const artist = typeof song.artist === 'string' ? song.artist : (song.artist?.name || song.artists || "Unknown artist");
                    const thumbnail = song.thumbnail || song.thumbnails?.find((item) => item?.url)?.url || '/logo.svg';

                    return (
                      <div 
                        key={idx}
                        className="group flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-[#141414] hover:bg-zinc-800/80 active:bg-zinc-800 border border-white/5 hover:border-white/10 transition-all cursor-pointer shadow-sm"
                        onClick={() => selectAndPlayTrack(song.videoId, title, artist, thumbnail)}
                      >
                        <span className="w-5 text-center text-xs sm:text-sm text-zinc-400 font-extrabold group-hover:text-white transition-colors shrink-0">
                          {idx + 1}
                        </span>
                        <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden shrink-0 shadow-md bg-zinc-800">
                          <img src={thumbnail} className="w-full h-full object-cover" alt="" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="w-5 h-5 text-white fill-current translate-x-0.5" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 pr-2">
                          <h3 className="text-white font-bold text-sm sm:text-base group-hover:text-white transition-colors truncate leading-tight">{title}</h3>
                          <p className="text-xs sm:text-sm text-zinc-400 font-medium truncate mt-1">{artist}</p>
                        </div>
                        <div className="shrink-0 p-1">
                          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center sm:hidden">
                            <Play className="w-3.5 h-3.5 fill-current text-white translate-x-0.5" />
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  [...Array(5)].map((_, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-[#141414] border border-white/5 animate-pulse">
                      <span className="w-5 text-center text-xs sm:text-sm text-zinc-600 font-bold shrink-0">{idx + 1}</span>
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-zinc-800 shrink-0" />
                      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                        <div className="w-40 sm:w-48 h-4 sm:h-5 bg-zinc-800 rounded" />
                        <div className="w-28 sm:w-32 h-3 sm:h-4 bg-zinc-800/60 rounded" />
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Load More Popular Songs Button */}
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={handleLoadMoreSongs}
                  disabled={loadingMoreSongs}
                  className="px-6 py-2.5 rounded-full border border-zinc-700/80 bg-zinc-900/80 hover:bg-zinc-800 text-xs sm:text-sm font-bold text-white transition-all shadow-sm hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {loadingMoreSongs ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-zinc-400 border-t-white animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>Show More</>
                  )}
                </button>
              </div>
            </section>

            {/* 2. Trending Artists (Hero Spotlight + Stack Design) */}
            <section className="mb-10 sm:mb-16">
              <div className="flex items-center gap-3 mb-6">
                <Mic2 className="text-white w-6 h-6" />
                <h2 className="text-3xl font-bold text-white tracking-tight">Trending Artists</h2>
              </div>
              
              {popularArtists.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">
                  {/* #1 Artist Hero */}
                  <div 
                    className="lg:col-span-3 relative rounded-2xl overflow-hidden cursor-pointer group min-h-[280px] sm:min-h-[340px] lg:min-h-[380px] shadow-xl flex flex-col justify-end p-6 sm:p-8"
                    onClick={() => handleCardClick(popularArtists[0])}
                  >
                    <img src={popularArtists[0].thumbnail} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-10" />
                    <div className="relative z-20">
                      <span className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-white mb-3 inline-flex items-center gap-2 tracking-wider border border-white/20">
                        <Radio size={12} /> {popularArtists[0].followers || "Top Artist"}
                      </span>
                      <h3 className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-2 tracking-tighter">{popularArtists[0].title}</h3>
                    </div>
                    <div className="absolute right-8 bottom-8 w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center shadow-2xl opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 hover:scale-105 z-20">
                      <Play className="w-6 h-6 sm:w-7 sm:h-7 text-black fill-current translate-x-0.5" />
                    </div>
                  </div>
                  
                  {/* Next 4 Artists Stack */}
                  <div className="lg:col-span-2 flex flex-col gap-3 sm:gap-4">
                    {popularArtists.slice(1, 5).map((artist, idx) => (
                      <div 
                        key={idx}
                        className="flex-1 bg-zinc-900/80 hover:bg-zinc-800 border border-white/5 hover:border-white/10 rounded-2xl p-3.5 sm:p-4 flex items-center gap-4 sm:gap-5 cursor-pointer group transition-all shadow-sm"
                        onClick={() => handleCardClick(artist)}
                      >
                        <img src={artist.thumbnail} className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover shadow-lg group-hover:scale-110 transition-transform duration-300 shrink-0" alt="" />
                        <div className="min-w-0 flex-1">
                          <h4 className="text-white font-bold text-lg sm:text-xl truncate">{artist.title}</h4>
                          <span className="text-xs text-zinc-400 font-medium tracking-widest uppercase mt-0.5 flex items-center gap-1">
                            {artist.followers || "Trending"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">
                  <div className="lg:col-span-3 rounded-2xl bg-zinc-900/60 border border-white/5 animate-pulse min-h-[280px] sm:min-h-[340px] lg:min-h-[380px]" />
                  <div className="lg:col-span-2 flex flex-col gap-3 sm:gap-4">
                    {[...Array(4)].map((_, idx) => (
                      <div key={idx} className="flex-1 bg-zinc-900/60 border border-white/5 rounded-2xl p-3.5 sm:p-4 flex items-center gap-4 sm:gap-5 animate-pulse">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-zinc-800 shrink-0" />
                        <div className="flex flex-col gap-2 flex-1 min-w-0">
                          <div className="w-32 h-5 bg-zinc-800 rounded" />
                          <div className="w-20 h-3 bg-zinc-800/60 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* 3. Featured Albums */}
            <section className="mb-10 sm:mb-16">
              <div className="flex items-center gap-3 mb-6">
                <Disc3 className="text-white w-6 h-6" />
                <h2 className="text-3xl font-bold text-white tracking-tight">Featured Albums</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                {featuredAlbums.map((album, idx) => (
                  <div 
                    key={idx}
                    onClick={() => handleCardClick(album)}
                    className="group bg-zinc-900/60 hover:bg-zinc-800/80 border border-white/5 hover:border-white/10 rounded-2xl p-3.5 flex flex-col cursor-pointer transition-all duration-300 shadow-md hover:-translate-y-1"
                  >
                    <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-3 shadow-lg bg-zinc-800 shrink-0">
                      <img 
                        src={album.thumbnail} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                        alt={album.title} 
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-xl transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                          <Play className="w-5 h-5 text-black fill-current translate-x-0.5" />
                        </div>
                      </div>
                      {idx === 0 && (
                        <span className="absolute top-2 left-2 bg-rose-600/90 backdrop-blur-md text-white font-bold text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider shadow">
                          Spotlight
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col flex-1 justify-between min-w-0">
                      <h3 className="text-white font-bold text-base truncate group-hover:text-white transition-colors">
                        {album.title.replace(' Mix', '')}
                      </h3>
                      <span className="text-xs text-zinc-400 font-medium tracking-wide mt-1 block">
                        Album • Play LooP
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 4. Curated Playlists */}
            <section className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <Radio className="text-white w-6 h-6" />
                <h2 className="text-3xl font-bold text-white tracking-tight">Vibes & Playlists</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                {topPlaylists.map((playlist, idx) => (
                  <div 
                    key={idx}
                    onClick={() => handleCardClick(playlist)}
                    className="group bg-zinc-900/60 hover:bg-zinc-800/80 border border-white/5 hover:border-white/10 rounded-2xl p-3.5 flex flex-col cursor-pointer transition-all duration-300 shadow-md hover:-translate-y-1"
                  >
                    <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-3 shadow-lg bg-zinc-800 shrink-0">
                      <img 
                        src={playlist.thumbnail} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                        alt={playlist.title} 
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-xl transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                          <Play className="w-5 h-5 text-black fill-current translate-x-0.5" />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col flex-1 justify-between min-w-0">
                      <h3 className="text-white font-bold text-base truncate group-hover:text-white transition-colors">
                        {playlist.title}
                      </h3>
                      <span className="text-xs text-zinc-400 font-medium tracking-wide mt-1 block">
                        Playlist • Play LooP
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

          </div>
        ) : (
          /* Search Results */
          <div className="animate-in fade-in duration-300">
            <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">Top Results for "{query}"</h2>
            
            {loading ? (
              <div className="flex flex-col gap-2">
                {[...Array(6)].map((_, idx) => (
                  <div key={idx} className="bg-[#121212] border border-white/5 rounded-lg p-3 flex items-center gap-4 animate-pulse">
                    <div className="w-12 h-12 rounded bg-zinc-800/90 shrink-0" />
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="w-1/3 h-4 bg-zinc-800/90 rounded" />
                      <div className="w-1/4 h-3 bg-zinc-800/50 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-20">
                <Search className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                <p className="text-xl text-zinc-400">No tracks found for "{query}"</p>
                <p className="text-sm text-zinc-500 mt-2">Please make sure your words are spelled correctly or use less or different keywords.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {results.map((track, idx) => {
                  const title = track.title || track.name || "Unknown track";
                  const artist = typeof track.artist === 'string' ? track.artist : (track.artist?.name || track.artists || "Unknown artist");
                  const thumbnail = track.thumbnail || track.thumbnails?.find((item) => item?.url)?.url || '/logo.svg';
                  const isSelected = idx === selectedIndex;
                  
                  return (
                    <div 
                      key={idx} 
                      className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-zinc-800' : 'hover:bg-zinc-800/50 group'}`}
                      onClick={() => selectAndPlayTrack(track.videoId, title, artist, thumbnail)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <div className="relative shrink-0 w-12 h-12 rounded overflow-hidden shadow-md">
                        <img 
                          src={thumbnail} 
                          alt="" 
                          className="w-full h-full object-cover" 
                          onError={(e) => { e.target.src = "/logo.svg"; e.target.className = "w-full h-full object-contain p-1.5 bg-black"; }}
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                           <Play className="w-5 h-5 text-white fill-current" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-medium truncate ${isSelected ? 'text-white' : 'text-zinc-200'}`}>{title}</h3>
                        <p className="text-sm text-zinc-400 truncate">{artist}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
