import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { fetchRecommendedPlaylists, fetchPlaylistDetails, fetchMoreDynamicPlaylists, fetchPopularArtists, DEFAULT_PLAYLISTS } from '../services/api.js';
import Carousel from '../components/Carousel';
import { ArrowLeft, Play, Music, Heart, Sparkles, Library, ChevronRight } from 'lucide-react';

export default function Home({ setCurrentView }) {
  const [greeting, setGreeting] = useState('');
  const [playlists, setPlaylists] = useState([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [loadingPlaylistDetails, setLoadingPlaylistDetails] = useState(false);
  
  const [extraMadeForYou, setExtraMadeForYou] = useState([]);
  const [extraPopularAlbums, setExtraPopularAlbums] = useState([]);
  const [loadingMoreMadeForYou, setLoadingMoreMadeForYou] = useState(false);
  const [loadingMorePopularAlbums, setLoadingMorePopularAlbums] = useState(false);
  const [visiblePopularCount, setVisiblePopularCount] = useState(6);

  const { selectAndPlayTrack, playPlaylist, recentlyPlayed = [], pendingTrack, trackQueue, setIsRightSidebarOpen } = usePlayer();

  const [popularArtists, setPopularArtists] = useState([]);

  useEffect(() => {
    const currentHour = new Date().getHours();
    if (currentHour < 12) setGreeting("Good morning");
    else if (currentHour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");

    let isMounted = true;
    fetchRecommendedPlaylists()
      .then((data) => {
        if (isMounted) {
          setPlaylists(Array.isArray(data) ? data : []);
          setLoadingPlaylists(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load recommended playlists:", err);
        if (isMounted) {
          setPlaylists([]);
          setLoadingPlaylists(false);
        }
      });
      
    fetchPopularArtists().then(artists => {
      if (isMounted) setPopularArtists(artists);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const loadMoreMadeForYou = async () => {
    if (loadingMoreMadeForYou) return;
    setLoadingMoreMadeForYou(true);
    try {
      const more = await fetchMoreDynamicPlaylists(4);
      setExtraMadeForYou(prev => [...prev, ...more]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMoreMadeForYou(false);
    }
  };

  const loadMorePopularAlbums = async () => {
    if (loadingMorePopularAlbums) return;
    setLoadingMorePopularAlbums(true);
    try {
      const more = await fetchMoreDynamicPlaylists(6);
      setExtraPopularAlbums(prev => [...prev, ...more]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMorePopularAlbums(false);
    }
  };

  const handleShowMorePopular = () => {
    setVisiblePopularCount(prev => prev + 6);
    loadMorePopularAlbums();
  };

  const [playlistPage, setPlaylistPage] = useState(1);
  const [loadingMorePlaylist, setLoadingMorePlaylist] = useState(false);
  const [hasMorePlaylist, setHasMorePlaylist] = useState(true);

  const observer = useRef();
  const lastTrackElementRef = useCallback(node => {
    if (loadingMorePlaylist) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMorePlaylist && selectedPlaylist) {
        loadMorePlaylistTracks(selectedPlaylist.playlistId, playlistPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loadingMorePlaylist, hasMorePlaylist, selectedPlaylist, playlistPage]);

  useEffect(() => {
    const handlePopState = (e) => {
      const state = e.state;
      if (!state || !state.playlistId) {
        setSelectedPlaylist(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const loadMorePlaylistTracks = async (id, page) => {
    setLoadingMorePlaylist(true);
    try {
      const details = await fetchPlaylistDetails(id, page);
      if (details && details.tracks && details.tracks.length > 0) {
        setSelectedPlaylist(prev => {
          const existingIds = new Set(prev.tracks.map(t => t.videoId));
          const newTracks = details.tracks.filter(t => !existingIds.has(t.videoId));
          
          if (newTracks.length === 0) {
            setHasMorePlaylist(false);
            return prev;
          }

          return {
            ...prev,
            tracks: [...prev.tracks, ...newTracks]
          };
        });
        setPlaylistPage(page);
      } else {
        setHasMorePlaylist(false);
      }
    } catch (err) {
      console.error("Error loading more tracks:", err);
      setHasMorePlaylist(false);
    } finally {
      setLoadingMorePlaylist(false);
    }
  };

  const handlePlaylistClick = async (playlist) => {
    if (!playlist || !playlist.playlistId) return;
    setLoadingPlaylistDetails(true);
    setPlaylistPage(1);
    setHasMorePlaylist(true);
    const details = await fetchPlaylistDetails(playlist.playlistId, 1);
    if (details) {
      window.history.pushState({ view: 'home', playlistId: playlist.playlistId }, '', `#/playlist/${playlist.playlistId}`);
      setSelectedPlaylist(details);
      if (details.tracks && details.tracks.length < 30) {
         setHasMorePlaylist(false); // probably reached end if less than limit
      }
    }
    setLoadingPlaylistDetails(false);
  };

  const handleBackToHome = () => {
    setSelectedPlaylist(null);
    if (window.history.state && window.history.state.playlistId) {
      window.history.back();
    }
  };

  const handlePlayPlaylistAll = () => {
    if (selectedPlaylist && selectedPlaylist.tracks && selectedPlaylist.tracks.length > 0) {
      playPlaylist(selectedPlaylist.tracks, 0);
    }
  };

  const handlePlayTrackInPlaylist = (index) => {
    if (selectedPlaylist && selectedPlaylist.tracks) {
      playPlaylist(selectedPlaylist.tracks, index);
    }
  };

  const formatDuration = (secs) => {
    if (!secs || isNaN(secs)) return '--:--';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // If loading playlist details, render Playlist Skeleton View
  if (loadingPlaylistDetails) {
    return (
      <div className="max-w-[1400px] mx-auto pb-24 px-4 sm:px-6 lg:px-8 mt-4 select-none">
        <div className="w-28 h-9 bg-zinc-900 rounded-full mb-8 animate-pulse" />

        <div className="flex flex-col md:flex-row items-start md:items-end gap-6 sm:gap-8 mb-12">
          <div className="w-44 h-44 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-xl bg-zinc-900 border border-zinc-800/80 shrink-0 skeleton-shimmer-card animate-pulse" />
          <div className="flex flex-col min-w-0 w-full gap-3">
            <div className="w-16 h-3.5 bg-zinc-800/60 rounded-md animate-pulse" />
            <div className="w-3/4 max-w-lg h-9 sm:h-12 bg-zinc-800 rounded-lg animate-pulse" />
            <div className="w-full max-w-md h-4 bg-zinc-800/50 rounded-md animate-pulse" />
            <div className="flex items-center gap-4 mt-2">
              <div className="w-28 sm:w-32 h-11 sm:h-12 rounded-full bg-zinc-800 animate-pulse" />
              <div className="w-16 h-4 bg-zinc-800/50 rounded-md animate-pulse" />
            </div>
          </div>
        </div>

        <div className="track-list">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="track-card bg-[#121212] border border-zinc-800/60 rounded-lg p-3 flex items-center gap-4 animate-pulse skeleton-shimmer-card">
              <div className="w-6 h-4 bg-zinc-800/60 rounded" />
              <div className="w-12 h-12 rounded bg-zinc-800/90 shrink-0" />
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <div className="w-1/2 h-4 bg-zinc-800/90 rounded" />
                <div className="w-1/3 h-3 bg-zinc-800/50 rounded" />
              </div>
              <div className="w-12 h-4 bg-zinc-800/40 rounded hidden sm:block" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (selectedPlaylist) {
    const filters = ['Chill', 'Lo-fi', 'Indie', 'Acoustic', 'Ambient', 'Relax', 'Study', 'Focus'];

    return (
      <div className="max-w-[1600px] mx-auto pb-32 px-4 sm:px-6 lg:px-8 mt-4 select-none">
        <button
          type="button"
          onClick={handleBackToHome}
          className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-full text-sm font-medium transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </button>

        {/* Playlist Header */}
        <div className="flex flex-col md:flex-row items-start md:items-end gap-6 md:gap-8 mb-8">
          <img
            src={selectedPlaylist.thumbnail || '/logo.svg'}
            alt={selectedPlaylist.title}
            className={`shrink-0 shadow-[0_8px_30px_rgba(0,0,0,0.5)] ${selectedPlaylist.isArtist ? 'w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-full object-cover' : 'w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-xl'} ${(!selectedPlaylist.thumbnail || selectedPlaylist.thumbnail === '/logo.svg') ? 'object-contain p-8 bg-zinc-900 border border-zinc-800' : 'object-cover'}`}
            onError={(e) => {
              e.target.src = '/logo.svg';
              e.target.className = `shrink-0 object-contain p-8 bg-zinc-900 border border-zinc-800 ${selectedPlaylist.isArtist ? 'w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-full' : 'w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-xl'}`;
            }}
          />
          <div className="flex flex-col min-w-0">
            <span className="flex items-center gap-2 text-xs uppercase font-bold text-zinc-400 tracking-widest mb-1.5">
              {selectedPlaylist.isArtist && selectedPlaylist.isVerified && (
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-500 fill-current" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              )}
              {selectedPlaylist.isArtist ? (selectedPlaylist.isVerified ? 'Verified Artist' : 'Artist') : 'Playlist'}
            </span>
            <h2 className="text-5xl md:text-7xl font-extrabold text-white mb-3 tracking-tight leading-tight">
              {selectedPlaylist.title}
            </h2>
            
            {selectedPlaylist.isArtist && selectedPlaylist.followerCount ? (
              <p className="text-base text-zinc-300 mb-6 font-medium">
                {Number(selectedPlaylist.followerCount).toLocaleString()} monthly listeners
              </p>
            ) : (
              <>
                <p className="text-base text-zinc-300 mb-2 max-w-2xl font-medium">
                  {selectedPlaylist.description || 'Relax • Unwind • Repeat'}
                </p>
                <p className="text-sm text-zinc-400 mb-6 font-medium flex items-center gap-2">
                  <span>{selectedPlaylist.tracks ? selectedPlaylist.tracks.length : 0} songs</span>
                  <span className="w-1 h-1 rounded-full bg-zinc-600"></span>
                  <span>{Math.floor((selectedPlaylist.tracks?.length || 0) * 3.5 / 60)}h {Math.floor(((selectedPlaylist.tracks?.length || 0) * 3.5) % 60)}m</span>
                </p>
              </>
            )}

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handlePlayPlaylistAll}
                className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-white hover:bg-zinc-200 text-black font-bold text-sm rounded-full transition hover:scale-105 active:scale-95 cursor-pointer shadow-md"
              >
                <Play className="w-5 h-5 fill-current translate-x-[1px]" /> Play
              </button>
              <button className="inline-flex items-center gap-2 px-6 py-3 bg-transparent border border-zinc-600 hover:border-zinc-400 text-white font-bold text-sm rounded-full transition cursor-pointer">
                {selectedPlaylist.isArtist ? 'Follow' : <><span className="text-lg leading-none">+</span> Save</>}
              </button>
              <button className="w-12 h-12 flex items-center justify-center rounded-full border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 transition cursor-pointer">
                <span className="flex gap-1">
                  <span className="w-1 h-1 rounded-full bg-current"></span>
                  <span className="w-1 h-1 rounded-full bg-current"></span>
                  <span className="w-1 h-1 rounded-full bg-current"></span>
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 overflow-x-auto mb-10 pb-2 hide-scrollbar">
          {filters.map((filter) => (
            <button 
              key={filter} 
              className="px-5 py-2 rounded-full border border-zinc-800 bg-zinc-900/40 text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 whitespace-nowrap transition"
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-10">
          {/* Main Tracklist */}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white tracking-tight">{selectedPlaylist.isArtist ? 'Popular Tracks' : 'Tracks'}</h2>
              <button className="text-sm font-medium text-zinc-400 hover:text-white flex items-center gap-1.5 transition">
                Sort by <span className="text-[10px]">▼</span>
              </button>
            </div>

            <div className="grid grid-cols-[30px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_60px_40px] gap-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800/80 pb-3 mb-4 px-3 hidden md:grid">
              <span className="text-center">#</span>
              <span>Title</span>
              <span>Artist</span>
              <span>Album</span>
              <span>Duration</span>
              <span></span>
            </div>

            <div className="flex flex-col gap-1">
              {selectedPlaylist.tracks && selectedPlaylist.tracks.length > 0 ? (
                selectedPlaylist.tracks.map((track, idx) => (
                  <article
                    key={track.videoId || idx}
                    ref={idx === selectedPlaylist.tracks.length - 1 ? lastTrackElementRef : null}
                    className="grid grid-cols-[auto_1fr_auto] md:grid-cols-[30px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_60px_40px] gap-3 md:gap-4 items-center p-2 md:p-3 rounded-lg hover:bg-zinc-800/50 transition group cursor-pointer"
                    onClick={() => handlePlayTrackInPlaylist(idx)}
                  >
                    <span className="w-8 text-center text-sm font-medium text-zinc-500 group-hover:hidden">
                      {idx + 1}
                    </span>
                    <span className="w-8 text-center hidden group-hover:flex justify-center items-center">
                      <Play className="w-4 h-4 text-white fill-current" />
                    </span>
                    
                    <div className="flex items-center gap-4 min-w-0 pr-4">
                      <img
                        src={track.thumbnail || selectedPlaylist.thumbnail || '/logo.svg'}
                        alt={track.title}
                        className={`w-10 h-10 md:w-12 md:h-12 rounded shrink-0 ${(!track.thumbnail || track.thumbnail === '/logo.svg') ? 'object-contain p-1.5 bg-zinc-900' : 'object-cover'}`}
                        onError={(e) => {
                          e.target.src = '/logo.svg';
                          e.target.className = 'w-10 h-10 md:w-12 md:h-12 rounded shrink-0 object-contain p-1.5 bg-zinc-900';
                        }}
                        loading="lazy"
                      />
                      <div className="flex flex-col min-w-0">
                        <h3 className="text-sm md:text-base font-medium text-zinc-100 group-hover:text-white truncate">
                          {track.title}
                          {idx === 0 && <span className="inline-flex ml-2 px-1 rounded bg-zinc-200 text-black text-[10px] font-bold">E</span>}
                        </h3>
                        <p className="text-xs md:text-sm text-zinc-400 truncate md:hidden">{track.artist}</p>
                      </div>
                    </div>

                    <div className="hidden md:flex min-w-0 pr-4">
                      <p className="text-sm text-zinc-400 truncate hover:underline cursor-pointer">{track.artist}</p>
                    </div>

                    <div className="hidden md:flex min-w-0 pr-4">
                      <p className="text-sm text-zinc-400 truncate hover:underline cursor-pointer">{track.album || track.title}</p>
                    </div>

                    <div className="hidden md:flex text-sm text-zinc-500 font-medium">
                      {formatDuration(track.duration || (180 + Math.floor(Math.random() * 60)))}
                    </div>

                    <div className="flex items-center justify-end text-zinc-500 opacity-0 group-hover:opacity-100 transition">
                      <span className="flex gap-0.5 tracking-widest cursor-pointer hover:text-white px-2">•••</span>
                    </div>
                  </article>
                ))
              ) : (
                <p className="text-zinc-500 text-center py-12">No tracks found in this playlist.</p>
              )}
              {loadingMorePlaylist && (
                <div className="flex justify-center items-center py-6">
                  <div className="mini-infinity-loader" style={{ padding: 0 }}>
                    <svg className="mini-infinity-svg" viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
                      <path className="infinity-path-bg" d="M 40,50 C 40,15 85,15 100,50 C 115,85 160,85 160,50 C 160,15 115,15 100,50 C 85,85 40,85 40,50 Z" />
                      <path className="infinity-path-stroke" d="M 40,50 C 40,15 85,15 100,50 C 115,85 160,85 160,50 C 160,15 115,15 100,50 C 85,85 40,85 40,50 Z" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {selectedPlaylist.isArtist && selectedPlaylist.bio && selectedPlaylist.bio.length > 0 && (
            <div className="w-full lg:w-80 shrink-0">
              <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800/80">
                <h3 className="text-xl font-bold text-white mb-4">About</h3>
                {selectedPlaylist.bio.map((b, i) => (
                  <p key={i} className="text-sm text-zinc-400 leading-relaxed mb-3 last:mb-0 line-clamp-[12]">
                    {b.text || b}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const featuredPlaylist = playlists.length > 0 ? playlists[0] : (DEFAULT_PLAYLISTS[0] || null);
  const madeForYouPlaylists = [...(playlists.length > 1 ? playlists.slice(1, 6) : DEFAULT_PLAYLISTS.slice(1, 6)), ...extraMadeForYou];
  
  const initialPopular = playlists.length >= 16 
    ? playlists.slice(6, 16) 
    : [...playlists.slice(6), ...DEFAULT_PLAYLISTS].filter((item, idx, self) => self.findIndex(t => t.playlistId === item.playlistId) === idx).slice(0, 10);
  const popularAlbumsPlaylists = [...initialPopular, ...extraPopularAlbums];

  const quickAccessItems = [
    { title: 'Browse', subtitle: 'Discover new music', icon: <Music className="w-5 h-5 text-white" />, color: 'bg-[#8938d2]', path: '#/search' },
    { title: 'Liked Songs', subtitle: 'Your favorites', icon: <Heart className="w-5 h-5 text-white fill-current" />, color: 'bg-[#d2384a]' },
    { title: 'New Releases', subtitle: 'Fresh drops, weekly', icon: <Sparkles className="w-5 h-5 text-white" />, color: 'bg-[#1e864c]' },
    { title: 'Your Library', subtitle: 'All your music', icon: <Library className="w-5 h-5 text-white" />, color: 'bg-[#d28238]' }
  ];

  return (
    <div className="max-w-[1400px] mx-auto pb-24 px-4 sm:px-6 lg:px-8 mt-6">

      {/* Greeting Section */}
      {!loadingPlaylists && (
        <div className="mb-8 pl-1">
          <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">{greeting}</h2>
          <p className="text-zinc-400 font-medium">Discover your next favorite track.</p>
        </div>
      )}

      {/* Featured Section */}
      {loadingPlaylists ? (
        <div className="flex flex-col xl:grid xl:grid-cols-3 gap-6 mb-12">
          <div className="xl:col-span-2 h-[450px] bg-[#121212] rounded-[2px] animate-pulse"></div>
          <div className="grid grid-cols-2 xl:grid-cols-1 xl:grid-rows-4 gap-3 xl:gap-4 h-auto xl:h-[380px]">
             {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-[#121212] rounded-lg animate-pulse min-h-[60px]"></div>
             ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col xl:grid xl:grid-cols-3 gap-6 mb-12">
          {/* Hero Featured Playlist */}
          {featuredPlaylist && (
            <div 
              className="xl:col-span-2 relative h-[340px] sm:h-[450px] rounded-[2px] overflow-hidden group cursor-pointer bg-[#121212] shadow-xl"
              onClick={() => handlePlaylistClick(featuredPlaylist)}
            >
              <img 
                src={featuredPlaylist.thumbnail} 
                alt={featuredPlaylist.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/50 to-transparent"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent"></div>
              
              <div className="absolute bottom-0 left-0 p-6 sm:p-8 md:p-10 w-full md:w-3/4 flex flex-col justify-end h-full">
                <span className="text-[10px] sm:text-xs font-bold tracking-[0.2em] text-white/70 uppercase mb-3 block drop-shadow-md">
                  Featured Playlist
                </span>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-3 tracking-tight drop-shadow-lg">
                  {featuredPlaylist.title}
                </h1>
                <p className="text-zinc-300 text-xs sm:text-sm md:text-base mb-6 sm:mb-8 line-clamp-2 max-w-lg font-medium drop-shadow-md">
                  {featuredPlaylist.description || `A curated collection of ${featuredPlaylist.count || 'great'} songs by ${featuredPlaylist.author}.`}
                </p>
                
                <div className="flex items-center gap-3 sm:gap-4">
                  <button 
                    className="bg-white text-black px-6 sm:px-8 py-2.5 sm:py-3.5 rounded-full font-bold text-sm flex items-center gap-2 hover:scale-105 active:scale-95 transition shadow-xl"
                    onClick={(e) => { e.stopPropagation(); handlePlaylistClick(featuredPlaylist); }}
                  >
                    <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current translate-x-[1px]" /> Play
                  </button>
                  <button 
                    className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/10 px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-full font-bold text-sm flex items-center gap-2 transition"
                    onClick={(e) => { e.stopPropagation(); handlePlaylistClick(featuredPlaylist); }}
                  >
                    <span className="text-lg leading-none mb-0.5">+</span> Save
                  </button>
                  <span className="hidden md:inline-block ml-4 text-zinc-300 text-sm font-medium">
                    {featuredPlaylist.count} songs
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Quick Access Grid */}
          <div className="grid grid-cols-2 xl:flex xl:flex-col gap-3 xl:gap-4 xl:justify-between h-auto xl:h-[450px]">
            {quickAccessItems.map((item, index) => (
              <div 
                key={index}
                onClick={() => { 
                  if (item.path) {
                    if (setCurrentView) setCurrentView('search');
                    else window.location.hash = item.path;
                  }
                }}
                className="flex-1 bg-[#121212] hover:bg-[#1a1a1a] rounded-[2px] p-3 xl:p-4 flex items-center gap-3 xl:gap-4 cursor-pointer transition border border-white/5 hover:border-white/10 shadow-sm group"
              >
                <div className={`w-10 h-10 xl:w-14 xl:h-14 rounded-md flex items-center justify-center shrink-0 shadow-sm ${item.color}`}>
                  {item.icon}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <h3 className="text-white font-bold text-xs xl:text-sm truncate">{item.title}</h3>
                  <p className="text-zinc-400 text-[10px] xl:text-xs truncate mt-0.5">{item.subtitle}</p>
                </div>
                <div className="hidden xl:flex w-8 h-8 rounded-full items-center justify-center text-zinc-500 group-hover:text-white transition-colors mr-1">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recently Played Row */}
      {recentlyPlayed && recentlyPlayed.length > 0 && (
        <div className="mb-10 sm:mb-12">
          <Carousel
            title="Recently Played"
            items={recentlyPlayed}
            onItemClick={(track) => selectAndPlayTrack(track.videoId, track.title, track.artist, track.thumbnail)}
            renderSubtitle={(track) => track.artist}
            keyExtractor={(track, index) => `${track.videoId}-${index}`}
            cardType="square"
          />
        </div>
      )}

      {/* Made For You Row (Wide Cards) */}
      {!loadingPlaylists && madeForYouPlaylists.length > 0 && (
        <div className="mb-10 sm:mb-12">
          <Carousel
            title="Made For You"
            items={madeForYouPlaylists}
            onItemClick={handlePlaylistClick}
            renderSubtitle={(item) => item.author}
            keyExtractor={(item, index) => `${item.playlistId}-${index}`}
            cardType="wide"
            onEndReached={loadMoreMadeForYou}
            isLoadingMore={loadingMoreMadeForYou}
          />
        </div>
      )}
      
      {/* Popular Albums - Immersive Grid Redesign */}
      {!loadingPlaylists && popularAlbumsPlaylists.length > 0 && (
        <div className="mb-14 sm:mb-16 mt-8">
          <div className="flex items-center justify-between mb-6 pl-1">
            <h3 className="text-2xl font-bold tracking-tight text-white">Trending & Popular</h3>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
            {popularAlbumsPlaylists.slice(0, visiblePopularCount).map((item, index) => (
                <div
                  key={`${item.playlistId}-${index}`}
                  onClick={() => handlePlaylistClick(item)}
                  className="group flex flex-col p-3.5 rounded bg-[#181818] hover:bg-[#282828] cursor-pointer transition-colors duration-300"
                >
                  <div className="relative w-full aspect-square rounded-[2px] shadow-[0_8px_24px_rgba(0,0,0,0.5)] overflow-hidden mb-4 bg-zinc-800">
                    <img
                      src={item.thumbnail || '/logo.svg'}
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
                      onError={(e) => {
                        e.target.src = '/logo.svg';
                        e.target.className = 'w-full h-full object-contain p-6 bg-black';
                      }}
                      loading="lazy"
                    />
                    
                    {/* Play Button Overlay */}
                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 z-20">
                      <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-xl hover:scale-105 hover:bg-gray-50 text-black">
                        <Play className="w-5 h-5 fill-current translate-x-[2px]" />
                      </div>
                    </div>
                  </div>

                  <h4 className="font-bold text-white text-[15px] truncate mb-1.5 tracking-tight">
                    {item.title}
                  </h4>
                  <p className="font-medium text-zinc-400 text-[13px] line-clamp-2 leading-snug">
                    {item.author || item.artist || 'Collection'}
                  </p>
                </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={handleShowMorePopular}
              disabled={loadingMorePopularAlbums}
              className="px-6 py-2.5 rounded-full border border-zinc-700 text-sm font-bold text-white hover:bg-zinc-800 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loadingMorePopularAlbums ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-zinc-400 border-t-white animate-spin" />
                  Loading...
                </>
              ) : 'Show More'}
            </button>
          </div>
        </div>
      )}

      {/* Popular Artists Row */}
      {popularArtists.length > 0 && (
        <div className="mb-10 sm:mb-12">
          <Carousel
            title="Popular Artists"
            items={popularArtists}
            onItemClick={handlePlaylistClick}
            renderSubtitle={() => "Artist"}
            keyExtractor={(item, index) => `${item.playlistId}-${index}`}
            cardType="circle"
          />
        </div>
      )}
    </div>
  );
}
