import React, { useState, useEffect, useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { fetchApi, fetchPopularArtists, fetchPopularSongs, fetchMoreDynamicPlaylists, DEFAULT_PLAYLISTS } from '../services/api';
import { Search, Play, Music, Mic2, Disc3, Radio, X, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';

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

export default function SearchPage({ refreshKey = 0 }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searchResults, setSearchResults] = useState({ songs: [], artists: [], playlists: [], topResult: null });
  const [activeSearchFilter, setActiveSearchFilter] = useState('all');
  const [isSongsExpanded, setIsSongsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const { selectAndPlayTrack, playPlaylist } = usePlayer();
  const mainScrollRef = useRef(null);
  const mobileInputRef = useRef(null);

  const [popularArtists, setPopularArtists] = useState([]);
  const [popularSongsData, setPopularSongsData] = useState(DEFAULT_POPULAR_SONGS);
  const [visibleSongCount, setVisibleSongCount] = useState(5);
  const [loadingMoreSongs, setLoadingMoreSongs] = useState(false);
  
  // Use static data for instantaneous load to build the sections
  const [featuredAlbums, setFeaturedAlbums] = useState([...DEFAULT_PLAYLISTS].slice(0, 5));
  const [loadingMoreAlbums, setLoadingMoreAlbums] = useState(false);
  const [topPlaylists, setTopPlaylists] = useState([...DEFAULT_PLAYLISTS].slice(5, 10));
  const [loadingMorePlaylists, setLoadingMorePlaylists] = useState(false);

  const handleLoadMoreAlbums = async () => {
    if (loadingMoreAlbums) return;
    setLoadingMoreAlbums(true);
    try {
      const more = await fetchMoreDynamicPlaylists(5);
      setFeaturedAlbums(prev => [...prev, ...more]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMoreAlbums(false);
    }
  };

  const handleLoadMorePlaylists = async () => {
    if (loadingMorePlaylists) return;
    setLoadingMorePlaylists(true);
    try {
      const more = await fetchMoreDynamicPlaylists(5);
      setTopPlaylists(prev => [...prev, ...more]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMorePlaylists(false);
    }
  };

  const scrollToTop = () => {
    const containers = [
      mainScrollRef.current,
      document.querySelector('.app-content'),
      document.querySelector('main'),
      document.documentElement,
      document.body
    ];
    
    const applyScroll = () => {
      containers.forEach(el => {
        if (el && typeof el.scrollTop === 'number') {
          el.scrollTop = 0;
        }
      });
      window.scrollTo(0, 0);
    };

    applyScroll();
    requestAnimationFrame(applyScroll);
    setTimeout(applyScroll, 30);
    setTimeout(applyScroll, 100);
  };

  useEffect(() => {
    setIsSongsExpanded(false);
    scrollToTop();
  }, [query]);

  useEffect(() => {
    scrollToTop();
  }, [activeSearchFilter]);

  useEffect(() => {
    let isMounted = true;
    const prefStr = localStorage.getItem('preferred_languages');
    const langs = prefStr ? JSON.parse(prefStr) : [];
    
    // Fetch popular songs strictly by preferred languages
    fetchPopularSongs(langs)
      .then(songsData => {
        if (isMounted && Array.isArray(songsData) && songsData.length > 0) {
          setPopularSongsData(songsData);
        }
      })
      .catch(e => console.error("Failed to fetch popular songs:", e));

    // Fetch popular artists independently
    fetchPopularArtists(langs)
      .then(artistData => {
        if (isMounted && Array.isArray(artistData) && artistData.length > 0) {
          setPopularArtists(artistData);
        }
      })
      .catch(e => console.error("Failed to fetch popular artists:", e));

    return () => { isMounted = false; };
  }, [refreshKey]);

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

  const debounceTimerRef = useRef(null);

  const handleMobileInputChange = (val) => {
    setQuery(val);
    const trimmed = val.trim();
    if (!trimmed) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      setResults([]);
      setSearchResults({ songs: [], artists: [], playlists: [], topResult: null });
      setLoading(false);
      window.history.replaceState(null, '', '#/search');
      return;
    }

    setLoading(true);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      window.history.replaceState(null, '', `#/search?q=${encodeURIComponent(trimmed)}`);
      performSearch(trimmed);
    }, 250);
  };

  useEffect(() => {
    const handleHashChange = (overrideQuery) => {
      const q = typeof overrideQuery === 'string' ? overrideQuery : (() => {
        const hash = window.location.hash || '';
        const match = hash.match(/#\/?search\?q=(.+)/);
        return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : '';
      })();

      setQuery(prev => {
        if (prev && (prev.trim() === q.trim() || document.activeElement === mobileInputRef.current)) {
          return prev;
        }
        return q;
      });

      if (q) {
        setLoading(true);
        performSearch(q);
      } else {
        setResults([]);
        setSearchResults({ songs: [], artists: [], playlists: [], topResult: null });
        setLoading(false);
      }
    };

    handleHashChange();

    const onCustomSearch = (e) => {
      if (e.detail) {
        handleHashChange(e.detail);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    window.addEventListener('app-search-trigger', onCustomSearch);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
      window.removeEventListener('app-search-trigger', onCustomSearch);
    };
  }, []);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [results]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const active = document.activeElement;
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
    setIsSongsExpanded(false);
    try {
      const response = await fetchApi(`/api/search?q=${encodeURIComponent(searchTerm)}&type=all`);
      if (response.ok) {
        const data = await response.json();
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          setSearchResults({
            songs: data.songs || [],
            artists: data.artists || [],
            playlists: data.playlists || [],
            topResult: data.topResult || null
          });
          setResults(data.songs || []);
        } else if (Array.isArray(data)) {
          setSearchResults({
            songs: data,
            artists: [],
            playlists: [],
            topResult: data.length > 0 ? { ...data[0], category: 'Song' } : null
          });
          setResults(data);
        }
      } else {
        setSearchResults({ songs: [], artists: [], playlists: [], topResult: null });
        setResults([]);
      }
    } catch (e) {
      console.error(e);
      setSearchResults({ songs: [], artists: [], playlists: [], topResult: null });
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (item) => {
    if (!item) return;
    if (item.playlistId?.startsWith('ARTIST:')) {
      window.location.hash = `#/playlist/${item.playlistId}`;
    } else if (item.isArtist || item.type === 'artist') {
      if (item.playlistId) {
        window.location.hash = `#/playlist/${item.playlistId}`;
      } else if (item.id) {
        window.location.hash = `#/playlist/ARTIST:${item.id}`;
      } else {
        window.location.hash = `#/search?q=${encodeURIComponent(item.title || item.name || '')}`;
      }
    } else if (item.playlistId?.startsWith('QUERY:')) {
      window.location.hash = `#/search?q=${encodeURIComponent(item.title.replace(' Mix', ''))}`;
    } else if (item.playlistId) {
      window.location.hash = `#/playlist/${item.playlistId}`;
    } else if (item.videoId) {
      selectAndPlayTrack(item.videoId, item.title, item.artist, item.thumbnail);
    } else {
      window.location.hash = `#/search?q=${encodeURIComponent(item.title || item.name || '')}`;
    }
  };

  return (
    <div ref={mainScrollRef} className="flex flex-col h-full overflow-y-auto no-scrollbar-mobile custom-scrollbar pb-32 pt-8">
      <div className="px-6 md:px-12 lg:px-16 xl:px-24 max-w-[1600px] mx-auto w-full select-none">
        
        {/* Mobile-Only Search Bar on Search Page */}
        <div className="mb-6 max-w-3xl sm:hidden">
          <div className="relative flex items-center">
            <Search className="absolute left-4 w-5 h-5 text-zinc-400 pointer-events-none" />
            <input
              ref={mobileInputRef}
              type="text"
              placeholder="What do you want to play? (Songs, Artists, Albums)"
              value={query}
              onChange={(e) => handleMobileInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const trimmed = query.trim();
                  if (trimmed) {
                    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                    window.location.hash = `#/search?q=${encodeURIComponent(trimmed)}`;
                    performSearch(trimmed);
                    e.target.blur();
                  }
                }
              }}
              className="w-full pl-12 pr-12 py-3.5 bg-zinc-900/90 hover:bg-zinc-900 border border-zinc-700/60 focus:border-white rounded-full text-white placeholder-zinc-400 outline-none text-sm sm:text-base transition-all shadow-md focus:ring-2 focus:ring-white/20"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                  setQuery('');
                  setResults([]);
                  setSearchResults({ songs: [], artists: [], playlists: [], topResult: null });
                  setLoading(false);
                  window.location.hash = '#/search';
                }}
                className="absolute right-4 text-zinc-400 hover:text-white transition-colors p-1"
                aria-label="Clear search"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {!query ? (
          <div className="flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* 1. Popular Songs */}
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

            {/* 2. Trending Artists */}
            <section className="mb-10 sm:mb-16">
              <div className="flex items-center gap-3 mb-6">
                <Mic2 className="text-white w-6 h-6" />
                <h2 className="text-3xl font-bold text-white tracking-tight">Trending Artists</h2>
              </div>
              
              {popularArtists.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">
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
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={handleLoadMoreAlbums}
                  disabled={loadingMoreAlbums}
                  className="px-6 py-2.5 rounded-full border border-zinc-700/80 bg-zinc-900/80 hover:bg-zinc-800 text-xs sm:text-sm font-bold text-white transition-all shadow-sm hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {loadingMoreAlbums ? (
                    <><div className="w-4 h-4 rounded-full border-2 border-zinc-400 border-t-white animate-spin" />Loading...</>
                  ) : (<>Show More</>)}
                </button>
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
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={handleLoadMorePlaylists}
                  disabled={loadingMorePlaylists}
                  className="px-6 py-2.5 rounded-full border border-zinc-700/80 bg-zinc-900/80 hover:bg-zinc-800 text-xs sm:text-sm font-bold text-white transition-all shadow-sm hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {loadingMorePlaylists ? (
                    <><div className="w-4 h-4 rounded-full border-2 border-zinc-400 border-t-white animate-spin" />Loading...</>
                  ) : (<>Show More</>)}
                </button>
              </div>
            </section>

          </div>
        ) : (
          /* Search Results */
          <div className="animate-in fade-in duration-300">
            <div className="flex items-center justify-between gap-4 mb-3">
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Search Results for "{query}"</h2>
            </div>

            {/* Filter Pills Bar */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mb-6 py-1">
              {[
                { id: 'all', label: 'All Results' },
                { id: 'songs', label: 'Songs' },
                { id: 'artists', label: 'Artists' },
                { id: 'playlists', label: 'Playlists & Albums' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setActiveSearchFilter(cat.id);
                    scrollToTop();
                  }}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    activeSearchFilter === cat.id
                      ? 'bg-white text-black shadow-md scale-105'
                      : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 border border-white/10'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(8)].map((_, idx) => (
                  <div key={idx} className="bg-[#121212] border border-white/5 rounded-xl p-4 flex items-center gap-4 animate-pulse">
                    <div className="w-14 h-14 rounded-lg bg-zinc-800 shrink-0" />
                    <div className="flex-1 flex flex-col gap-2 min-w-0">
                      <div className="w-3/4 h-4 bg-zinc-800 rounded" />
                      <div className="w-1/2 h-3 bg-zinc-800/60 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (searchResults.songs.length === 0 && searchResults.artists.length === 0 && searchResults.playlists.length === 0) ? (
              <div className="text-center py-20">
                <Search className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                <p className="text-xl text-zinc-400">No results found for "{query}"</p>
                <p className="text-sm text-zinc-500 mt-2">Please make sure your words are spelled correctly or use less or different keywords.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-10">

                {/* ALL TAB */}
                {activeSearchFilter === 'all' && (
                  <>
                    {/* Top Result + Songs Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
                      
                      {/* Top Result Card */}
                      {searchResults.topResult && (
                        <div className="lg:col-span-2 flex flex-col">
                          <h3 className="text-xl font-bold text-white mb-4">Top Result</h3>
                          <div 
                            className="bg-[#141416] hover:bg-[#1c1c20] border border-white/10 rounded-2xl p-6 flex flex-col justify-between cursor-pointer transition-all duration-300 group relative shadow-2xl min-h-[220px]"
                            onClick={() => {
                              if (searchResults.topResult.videoId) {
                                selectAndPlayTrack(searchResults.topResult.videoId, searchResults.topResult.title, searchResults.topResult.artist, searchResults.topResult.thumbnail);
                              } else {
                                handleCardClick(searchResults.topResult);
                              }
                            }}
                          >
                            <div className="flex flex-col gap-4">
                              <img 
                                src={searchResults.topResult.thumbnail} 
                                alt={searchResults.topResult.title}
                                className={`shadow-2xl object-cover bg-black ${searchResults.topResult.isArtist ? 'w-24 h-24 sm:w-28 sm:h-28 rounded-full' : 'w-24 h-24 sm:w-28 sm:h-28 rounded-xl'}`}
                                onError={(e) => { e.target.src = '/default-cover.svg'; }}
                              />
                              <div>
                                <h4 className="text-2xl sm:text-3xl font-black text-white tracking-tight line-clamp-2 leading-tight group-hover:text-white transition-colors">
                                  {searchResults.topResult.title}
                                </h4>
                                <p className="text-sm text-zinc-400 font-medium mt-1">
                                  {searchResults.topResult.artist || searchResults.topResult.author || 'Result'}
                                </p>
                                <span className="inline-block mt-3 px-3 py-1 bg-white/10 text-white font-bold text-xs rounded-full uppercase tracking-wider">
                                  {searchResults.topResult.category || (searchResults.topResult.isArtist ? 'Artist' : 'Song')}
                                </span>
                              </div>
                            </div>

                            <div className="absolute bottom-6 right-6 w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-full flex items-center justify-center shadow-2xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 hover:scale-105">
                              <Play className="w-6 h-6 text-black fill-current translate-x-0.5" />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Songs Section */}
                      {searchResults.songs.length > 0 && (
                        <div className={`${searchResults.topResult ? 'lg:col-span-3' : 'lg:col-span-5'} flex flex-col`}>
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-white">Songs</h3>
                            {searchResults.songs.length > 4 && (
                              <button
                                type="button"
                                onClick={() => setActiveSearchFilter('songs')}
                                className="text-xs font-semibold text-zinc-400 hover:text-white transition-colors flex items-center gap-1 cursor-pointer py-1 px-2.5 rounded-full hover:bg-zinc-800 border border-transparent hover:border-white/10"
                              >
                                See All ({searchResults.songs.length}) →
                              </button>
                            )}
                          </div>
                          <div className="flex flex-col gap-1.5">
                            {searchResults.songs.slice(0, 4).map((song, idx) => (
                              <div 
                                key={song.videoId || idx}
                                className="flex items-center justify-between gap-4 p-2.5 sm:p-3 rounded-xl bg-[#141416] hover:bg-[#202024] active:bg-[#25252a] border border-white/5 cursor-pointer transition-all group"
                                onClick={() => selectAndPlayTrack(song.videoId, song.title, song.artist, song.thumbnail)}
                              >
                                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                  <span className="w-5 text-center text-xs font-bold text-zinc-500 shrink-0">
                                    {idx + 1}
                                  </span>
                                  <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 shadow-md bg-black border border-white/5">
                                    <img src={song.thumbnail || '/default-cover.svg'} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.src = '/default-cover.svg'; }} />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Play className="w-5 h-5 text-white fill-current translate-x-0.5" />
                                    </div>
                                  </div>
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <h4 className="text-white font-bold text-sm sm:text-base truncate group-hover:text-white transition-colors">{song.title}</h4>
                                    <p className="text-xs sm:text-sm text-zinc-400 truncate mt-0.5">{song.artist}</p>
                                  </div>
                                </div>
                                <span className="text-xs text-zinc-500 font-mono hidden sm:block">
                                  {Math.floor((song.duration || 180) / 60)}:{String(Math.floor((song.duration || 180) % 60)).padStart(2, '0')}
                                </span>
                              </div>
                            ))}
                          </div>

                          {searchResults.songs.length > 4 && (
                            <div className="mt-3.5 flex justify-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveSearchFilter('songs');
                                  scrollToTop();
                                }}
                                className="px-5 py-2.5 rounded-full border border-zinc-700/80 bg-zinc-900/90 hover:bg-zinc-800 text-xs sm:text-sm font-bold text-zinc-300 hover:text-white transition-all shadow-md hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer"
                              >
                                See All {searchResults.songs.length} Songs →
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Artists Section */}
                    {searchResults.artists.length > 0 && (
                      <div>
                        <h3 className="text-xl font-bold text-white mb-4">Artists</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                          {searchResults.artists.map((artist, idx) => (
                            <div 
                              key={idx}
                              className="group bg-[#141416] hover:bg-[#202024] p-4 rounded-2xl flex flex-col items-center text-center cursor-pointer transition-all duration-300 border border-white/5"
                              onClick={() => handleCardClick(artist)}
                            >
                              <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden shadow-xl mb-3 bg-black border border-white/5 shrink-0">
                                <img src={artist.thumbnail || '/default-cover.svg'} alt={artist.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => { e.target.src = '/default-cover.svg'; }} />
                              </div>
                              <h4 className="font-bold text-white text-sm sm:text-base truncate w-full">{artist.title}</h4>
                              <span className="text-xs text-zinc-400 font-medium mt-1">Artist</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Playlists & Albums Section */}
                    {searchResults.playlists.length > 0 && (
                      <div>
                        <h3 className="text-xl font-bold text-white mb-4">Playlists & Albums</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                          {searchResults.playlists.map((pl, idx) => (
                            <div 
                              key={idx}
                              className="group bg-[#141416] hover:bg-[#202024] p-3.5 rounded-2xl flex flex-col cursor-pointer transition-all duration-300 border border-white/5"
                              onClick={() => handleCardClick(pl)}
                            >
                              <div className="relative w-full aspect-square rounded-xl overflow-hidden shadow-xl mb-3 bg-black border border-white/5 shrink-0">
                                <img src={pl.thumbnail || '/default-cover.svg'} alt={pl.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => { e.target.src = '/default-cover.svg'; }} />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-xl">
                                    <Play className="w-4 h-4 text-black fill-current translate-x-0.5" />
                                  </div>
                                </div>
                              </div>
                              <h4 className="font-bold text-white text-sm truncate">{pl.title}</h4>
                              <p className="text-xs text-zinc-400 truncate mt-0.5">{pl.author || 'Collection'}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* SONGS TAB */}
                {activeSearchFilter === 'songs' && (
                  searchResults.songs.length > 0 ? (
                    <div className="flex flex-col gap-10">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                            All Songs <span className="text-sm font-semibold text-zinc-400 font-mono">({searchResults.songs.length})</span>
                          </h3>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveSearchFilter('all');
                              scrollToTop();
                            }}
                            className="text-xs sm:text-sm font-semibold text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer py-1.5 px-3.5 rounded-full hover:bg-zinc-800 border border-transparent hover:border-white/10"
                          >
                            <ChevronUp className="w-4 h-4" /> Show Less
                          </button>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {searchResults.songs.map((song, idx) => (
                            <div 
                              key={song.videoId || idx}
                              className="flex items-center justify-between gap-4 p-3 rounded-xl bg-[#141416] hover:bg-[#202024] border border-white/5 cursor-pointer transition-all group"
                              onClick={() => selectAndPlayTrack(song.videoId, song.title, song.artist, song.thumbnail)}
                            >
                              <div className="flex items-center gap-4 min-w-0 flex-1">
                                <span className="w-6 text-center text-xs font-bold text-zinc-500 shrink-0">{idx + 1}</span>
                                <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 shadow-md bg-black border border-white/5">
                                  <img src={song.thumbnail || '/default-cover.svg'} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.src = '/default-cover.svg'; }} />
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Play className="w-5 h-5 text-white fill-current translate-x-0.5" />
                                  </div>
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                  <h4 className="text-white font-bold text-base truncate">{song.title}</h4>
                                  <p className="text-xs sm:text-sm text-zinc-400 truncate mt-0.5">{song.artist}</p>
                                </div>
                              </div>
                              <span className="text-xs text-zinc-500 font-mono">
                                {Math.floor((song.duration || 180) / 60)}:{String(Math.floor((song.duration || 180) % 60)).padStart(2, '0')}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Bottom Show Less / Back Button */}
                        <div className="mt-6 flex justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveSearchFilter('all');
                              scrollToTop();
                            }}
                            className="px-6 py-2.5 rounded-full border border-zinc-700/80 bg-zinc-900/90 hover:bg-zinc-800 text-xs sm:text-sm font-bold text-zinc-300 hover:text-white transition-all shadow-md hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer"
                          >
                            <ChevronUp className="w-4 h-4" /> Show Less (Overview)
                          </button>
                        </div>
                      </div>

                      {/* Artists Section Preserved at End of Songs Tab */}
                      {searchResults.artists.length > 0 && (
                        <div>
                          <h3 className="text-xl font-bold text-white mb-4">Artists</h3>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {searchResults.artists.map((artist, idx) => (
                              <div 
                                key={idx}
                                className="group bg-[#141416] hover:bg-[#202024] p-4 rounded-2xl flex flex-col items-center text-center cursor-pointer transition-all duration-300 border border-white/5"
                                onClick={() => handleCardClick(artist)}
                              >
                                <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden shadow-xl mb-3 bg-black border border-white/5 shrink-0">
                                  <img src={artist.thumbnail || '/default-cover.svg'} alt={artist.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => { e.target.src = '/default-cover.svg'; }} />
                                </div>
                                <h4 className="font-bold text-white text-sm sm:text-base truncate w-full">{artist.title}</h4>
                                <span className="text-xs text-zinc-400 font-medium mt-1">Artist</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Playlists & Albums Preserved at End of Songs Tab */}
                      {searchResults.playlists.length > 0 && (
                        <div>
                          <h3 className="text-xl font-bold text-white mb-4">Playlists & Albums</h3>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {searchResults.playlists.map((pl, idx) => (
                              <div 
                                key={idx}
                                className="group bg-[#141416] hover:bg-[#202024] p-3.5 rounded-2xl flex flex-col cursor-pointer transition-all duration-300 border border-white/5"
                                onClick={() => handleCardClick(pl)}
                              >
                                <div className="relative w-full aspect-square rounded-xl overflow-hidden shadow-xl mb-3 bg-black border border-white/5 shrink-0">
                                  <img src={pl.thumbnail || '/default-cover.svg'} alt={pl.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => { e.target.src = '/default-cover.svg'; }} />
                                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-xl">
                                      <Play className="w-4 h-4 text-black fill-current translate-x-0.5" />
                                    </div>
                                  </div>
                                </div>
                                <h4 className="font-bold text-white text-sm truncate">{pl.title}</h4>
                                <p className="text-xs text-zinc-400 truncate mt-0.5">{pl.author || 'Collection'}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-16 bg-[#141416]/50 rounded-2xl border border-white/5 p-6">
                      <Music className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                      <p className="text-lg text-zinc-300 font-medium">No song results found for "{query}"</p>
                      <p className="text-xs text-zinc-500 mt-1 mb-4">Try checking other categories or searching with different keywords.</p>
                      <button
                        type="button"
                        onClick={() => setActiveSearchFilter('all')}
                        className="px-5 py-2 bg-white text-black text-xs font-bold rounded-full hover:bg-zinc-200 transition-all cursor-pointer"
                      >
                        Show All Results
                      </button>
                    </div>
                  )
                )}

                {/* ARTISTS TAB */}
                {activeSearchFilter === 'artists' && (
                  searchResults.artists.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {searchResults.artists.map((artist, idx) => (
                        <div 
                          key={idx}
                          className="group bg-[#141416] hover:bg-[#202024] p-4 rounded-2xl flex flex-col items-center text-center cursor-pointer transition-all duration-300 border border-white/5"
                          onClick={() => handleCardClick(artist)}
                        >
                          <div className="relative w-28 h-28 rounded-full overflow-hidden shadow-xl mb-3 bg-black border border-white/5 shrink-0">
                            <img src={artist.thumbnail || '/default-cover.svg'} alt={artist.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => { e.target.src = '/default-cover.svg'; }} />
                          </div>
                          <h4 className="font-bold text-white text-base truncate w-full">{artist.title}</h4>
                          <span className="text-xs text-zinc-400 font-medium mt-1">Artist</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16 bg-[#141416]/50 rounded-2xl border border-white/5 p-6">
                      <Mic2 className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                      <p className="text-lg text-zinc-300 font-medium">No artist results found for "{query}"</p>
                      <p className="text-xs text-zinc-500 mt-1 mb-4">Try checking songs or searching with different keywords.</p>
                      <button
                        type="button"
                        onClick={() => setActiveSearchFilter('all')}
                        className="px-5 py-2 bg-white text-black text-xs font-bold rounded-full hover:bg-zinc-200 transition-all cursor-pointer"
                      >
                        Show All Results
                      </button>
                    </div>
                  )
                )}

                {/* PLAYLISTS TAB */}
                {activeSearchFilter === 'playlists' && (
                  searchResults.playlists.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {searchResults.playlists.map((pl, idx) => (
                        <div 
                          key={idx}
                          className="group bg-[#141416] hover:bg-[#202024] p-3.5 rounded-2xl flex flex-col cursor-pointer transition-all duration-300 border border-white/5"
                          onClick={() => handleCardClick(pl)}
                        >
                          <div className="relative w-full aspect-square rounded-xl overflow-hidden shadow-xl mb-3 bg-black border border-white/5 shrink-0">
                            <img src={pl.thumbnail || '/default-cover.svg'} alt={pl.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => { e.target.src = '/default-cover.svg'; }} />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-xl">
                                <Play className="w-4 h-4 text-black fill-current translate-x-0.5" />
                              </div>
                            </div>
                          </div>
                          <h4 className="font-bold text-white text-sm truncate">{pl.title}</h4>
                          <p className="text-xs text-zinc-400 truncate mt-0.5">{pl.author || 'Collection'}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16 bg-[#141416]/50 rounded-2xl border border-white/5 p-6">
                      <Disc3 className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                      <p className="text-lg text-zinc-300 font-medium">No playlists or albums found for "{query}"</p>
                      <p className="text-xs text-zinc-500 mt-1 mb-4">Try checking songs or searching with different keywords.</p>
                      <button
                        type="button"
                        onClick={() => setActiveSearchFilter('all')}
                        className="px-5 py-2 bg-white text-black text-xs font-bold rounded-full hover:bg-zinc-200 transition-all cursor-pointer"
                      >
                        Show All Results
                      </button>
                    </div>
                  )
                )}

              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
