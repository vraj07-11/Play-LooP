import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { fetchRecommendedPlaylists, fetchPlaylistDetails, fetchMoreDynamicPlaylists, fetchPopularArtists, DEFAULT_PLAYLISTS } from '../services/api.js';
import Carousel from '../components/Carousel';
import { ArrowLeft, Play, Music, Heart, Sparkles, Library, ChevronRight, Settings, Download, ArrowUpDown, Check } from 'lucide-react';

export default function Home({ setCurrentView, refreshKey = 0 }) {
  const [greeting, setGreeting] = useState('');
  const [playlists, setPlaylists] = useState([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [loadingPlaylistDetails, setLoadingPlaylistDetails] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  
  const [extraMadeForYou, setExtraMadeForYou] = useState([]);
  const [extraPopularAlbums, setExtraPopularAlbums] = useState([]);
  const [loadingMoreMadeForYou, setLoadingMoreMadeForYou] = useState(false);
  const [loadingMorePopularAlbums, setLoadingMorePopularAlbums] = useState(false);
  const [visiblePopularCount, setVisiblePopularCount] = useState(6);
  const [playlistThumbnailMap, setPlaylistThumbnailMap] = useState({});

  const featuredPlaylist = playlists.length > 0 ? playlists[0] : (DEFAULT_PLAYLISTS[0] || null);
  const madeForYouPlaylists = [...(playlists.length > 1 ? playlists.slice(1, 6) : DEFAULT_PLAYLISTS.slice(1, 6)), ...extraMadeForYou];
  
  const initialPopular = playlists.length >= 16 
    ? playlists.slice(6, 16) 
    : [...playlists.slice(6), ...DEFAULT_PLAYLISTS].filter((item, idx, self) => self.findIndex(t => t.playlistId === item.playlistId) === idx).slice(0, 10);
  const popularAlbumsPlaylists = [...initialPopular, ...extraPopularAlbums];

  const { selectAndPlayTrack, playPlaylist, recentlyPlayed = [], pendingTrack, trackQueue, setIsRightSidebarOpen } = usePlayer();

  const [popularArtists, setPopularArtists] = useState([]);
  const [loadingMoreArtists, setLoadingMoreArtists] = useState(false);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('all');

  const [sortBy, setSortBy] = useState('recent');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const sortDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target)) {
        setIsSortDropdownOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  const sortedTracks = useMemo(() => {
    if (!selectedPlaylist?.tracks) return [];
    const tracks = [...selectedPlaylist.tracks];
    switch (sortBy) {
      case 'recent-reverse':
        return tracks.reverse();
      case 'title-asc':
        return tracks.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      case 'title-desc':
        return tracks.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
      case 'duration-asc':
        return tracks.sort((a, b) => (a.duration || 0) - (b.duration || 0));
      case 'duration-desc':
        return tracks.sort((a, b) => (b.duration || 0) - (a.duration || 0));
      case 'recent':
      default:
        return tracks;
    }
  }, [selectedPlaylist?.tracks, sortBy]);

  const loadMoreArtists = async () => {
    if (loadingMoreArtists) return;
    setLoadingMoreArtists(true);
    try {
      const prefStr = localStorage.getItem('preferred_languages');
      const langs = prefStr ? JSON.parse(prefStr) : [];
      const more = await fetchPopularArtists(langs, popularArtists.length + 5);
      if (more && more.length > popularArtists.length) {
        setPopularArtists(more);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMoreArtists(false);
    }
  };

  useEffect(() => {
    const currentHour = new Date().getHours();
    if (currentHour < 12) setGreeting("Good morning");
    else if (currentHour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");

    let isMounted = true;
    if (refreshKey > 0) {
      setLoadingPlaylists(true);
    }
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
      
    const prefStr = localStorage.getItem('preferred_languages');
    const langs = prefStr ? JSON.parse(prefStr) : [];

    fetchPopularArtists(langs, 10).then(artists => {
      if (isMounted) setPopularArtists(artists);
    });

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  const handleOpenLikedSongs = useCallback(() => {
    try {
      const savedList = JSON.parse(localStorage.getItem('playloop_liked_tracks_list') || '[]');
      const playlistDetails = {
        playlistId: 'liked_songs',
        title: 'Liked Songs',
        author: 'Your Favorites',
        thumbnail: '/liked_songs_cover.png',
        description: 'Collection of all your favorite liked songs.',
        count: savedList.length,
        tracks: savedList,
        isLikedPlaylist: true
      };
      if (!window.location.hash.includes('liked_songs') && !window.location.hash.includes('liked-songs')) {
        window.location.hash = '#/playlist/liked_songs';
      }
      setSelectedPlaylist(playlistDetails);
      setIsSaved(true);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    const handleHashChange = async () => {
      const hash = window.location.hash;
      const match = hash.match(/^#\/?playlist\/(.+)$/);
      
      if (match) {
        const id = match[1];
        if (id === 'liked_songs' || id === 'liked-songs') {
          handleOpenLikedSongs();
          return;
        }
        if (!selectedPlaylist || selectedPlaylist.playlistId !== id) {
          setLoadingPlaylistDetails(true);
          setPlaylistPage(1);
          setHasMorePlaylist(true);
          try {
            const details = await fetchPlaylistDetails(id, 1);
            if (details) {
              setSelectedPlaylist(details);
              if (details.playlistId && details.thumbnail) {
                setPlaylistThumbnailMap(prev => ({
                  ...prev,
                  [details.playlistId]: details.thumbnail
                }));
              }
              checkIfSaved(details.playlistId);
              if (details.tracks && (details.tracks.length < 30 || String(details.playlistId).startsWith('imported_'))) {
                setHasMorePlaylist(false);
              }
            }
          } catch (err) {
            console.error(err);
          } finally {
            setLoadingPlaylistDetails(false);
          }
        }
      } else if (hash.includes('liked-songs') || hash.includes('liked_songs')) {
        handleOpenLikedSongs();
      } else {
        setSelectedPlaylist(null);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [selectedPlaylist, handleOpenLikedSongs]);

  function checkIfSaved(playlistId) {
    try {
      const saved = JSON.parse(localStorage.getItem('playloop_saved_playlists') || '[]');
      setIsSaved(saved.some(p => p.playlistId === playlistId));
    } catch (e) {
      setIsSaved(false);
    }
  };

  const [savedPlaylistsVersion, setSavedPlaylistsVersion] = useState(0);

  const isPlaylistSaved = useCallback((playlistId) => {
    if (!playlistId) return false;
    try {
      const saved = JSON.parse(localStorage.getItem('playloop_saved_playlists') || '[]');
      return saved.some(p => p.playlistId === playlistId);
    } catch (e) {
      return false;
    }
  }, [savedPlaylistsVersion]);

  useEffect(() => {
    const handleSavedUpdated = () => {
      setSavedPlaylistsVersion(v => v + 1);
    };
    window.addEventListener('playloop-saved-playlists-updated', handleSavedUpdated);
    return () => window.removeEventListener('playloop-saved-playlists-updated', handleSavedUpdated);
  }, []);

  const handleToggleSave = (targetPlaylist) => {
    const target = targetPlaylist || selectedPlaylist;
    if (!target || !target.playlistId) return;
    try {
      const saved = JSON.parse(localStorage.getItem('playloop_saved_playlists') || '[]');
      const existsIndex = saved.findIndex(p => p.playlistId === target.playlistId);
      if (existsIndex >= 0) {
        saved.splice(existsIndex, 1);
        if (selectedPlaylist?.playlistId === target.playlistId) {
          setIsSaved(false);
        }
      } else {
        const playlistToSave = {
          playlistId: target.playlistId,
          title: target.title,
          author: target.author || target.artist || 'Play LooP',
          thumbnail: target.thumbnail,
          description: target.description,
          count: target.tracks ? target.tracks.length : target.count,
          isArtist: target.isArtist
        };
        saved.unshift(playlistToSave);
        if (selectedPlaylist?.playlistId === target.playlistId) {
          setIsSaved(true);
        }
      }
      localStorage.setItem('playloop_saved_playlists', JSON.stringify(saved));
      window.dispatchEvent(new Event('playloop-saved-playlists-updated'));
      setSavedPlaylistsVersion(v => v + 1);
    } catch (e) {
      console.error(e);
    }
  };

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
    if (loadingMorePlaylist || selectedPlaylist?.isLikedPlaylist) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMorePlaylist && selectedPlaylist && !selectedPlaylist.isLikedPlaylist) {
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
      } else if (state.playlistId === 'liked_songs') {
        handleOpenLikedSongs();
      }
    };

    const handleOpenLikedEvent = () => {
      handleOpenLikedSongs();
    };

    if (window.history.state?.playlistId === 'liked_songs') {
      handleOpenLikedSongs();
    }

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('playloop-open-liked-songs', handleOpenLikedEvent);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('playloop-open-liked-songs', handleOpenLikedEvent);
    };
  }, [handleOpenLikedSongs]);

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
    fetchPlaylistDetails(playlist.playlistId, 1).then(details => {
      if (details && details.thumbnail) {
        setPlaylistThumbnailMap(prev => ({
          ...prev,
          [playlist.playlistId]: details.thumbnail
        }));
      }
    }).catch(() => {});
    window.location.hash = `#/playlist/${playlist.playlistId}`;
  };

  useEffect(() => {
    if (!popularAlbumsPlaylists || popularAlbumsPlaylists.length === 0) return;
    const visibleItems = popularAlbumsPlaylists.slice(0, visiblePopularCount);
    visibleItems.forEach((item) => {
      if (!item || !item.playlistId) return;
      if (playlistThumbnailMap[item.playlistId]) return;
      fetchPlaylistDetails(item.playlistId, 1).then((details) => {
        if (details && details.thumbnail && details.thumbnail !== item.thumbnail) {
          setPlaylistThumbnailMap(prev => ({
            ...prev,
            [item.playlistId]: details.thumbnail
          }));
        }
      }).catch(() => {});
    });
  }, [popularAlbumsPlaylists, visiblePopularCount, playlistThumbnailMap]);

  const handleBackToHome = () => {
    if (setCurrentView) {
      setCurrentView('home');
    } else {
      window.location.hash = '#/home';
    }
  };

  const handlePlayPlaylistAll = () => {
    const listToPlay = sortedTracks.length > 0 ? sortedTracks : (selectedPlaylist?.tracks || []);
    if (listToPlay.length > 0) {
      playPlaylist(listToPlay, 0);
    }
  };

  const handlePlayTrackInPlaylist = (index) => {
    const listToPlay = sortedTracks.length > 0 ? sortedTracks : (selectedPlaylist?.tracks || []);
    if (listToPlay.length > 0) {
      playPlaylist(listToPlay, index);
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
    return (
      <div className="max-w-[1400px] mx-auto pb-32 px-4 sm:px-6 lg:px-8 mt-4 select-none">
        <button
          type="button"
          onClick={handleBackToHome}
          className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-full text-sm font-medium transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </button>

        {/* Playlist Header */}
        <div className="flex flex-col md:flex-row items-center md:items-end text-center md:text-left gap-6 md:gap-8 mb-8">
          {selectedPlaylist.isLikedPlaylist ? (
            <div className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-2xl bg-black border border-white/10 flex items-center justify-center p-8 shrink-0 shadow-[0_12px_35px_rgba(0,0,0,0.7)] relative overflow-hidden group select-none mx-auto md:mx-0">
              <img
                src="/default-cover.svg"
                alt="Play LooP Logo"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
          ) : (
            <img
              src={(!selectedPlaylist.thumbnail || selectedPlaylist.thumbnail === '/logo.svg') ? '/default-cover.svg' : selectedPlaylist.thumbnail}
              alt={selectedPlaylist.title}
              className={`shrink-0 shadow-[0_8px_30px_rgba(0,0,0,0.5)] mx-auto md:mx-0 bg-black border border-white/10 ${selectedPlaylist.isArtist ? 'w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-full object-cover' : 'w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-xl object-cover'}`}
              onError={(e) => {
                e.target.src = '/default-cover.svg';
              }}
            />
          )}
          <div className="flex flex-col min-w-0 items-center md:items-start">
            <span className="flex items-center gap-2 text-xs uppercase font-bold text-zinc-400 tracking-widest mb-1.5">
              {selectedPlaylist.isArtist && selectedPlaylist.isVerified && (
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-500 fill-current" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              )}
              {selectedPlaylist.isArtist ? (selectedPlaylist.isVerified ? 'Verified Artist' : 'Artist') : 'Playlist'}
            </span>
            <h2 className="text-5xl md:text-7xl font-extrabold text-white mb-3 tracking-tight leading-tight">
              {(() => {
                try {
                  return decodeURIComponent(selectedPlaylist.title || '').replace(/%20/g, ' ');
                } catch (e) {
                  return (selectedPlaylist.title || '').replace(/%20/g, ' ');
                }
              })()}
            </h2>
            
            {selectedPlaylist.isArtist && selectedPlaylist.followerCount ? (
              <p className="text-base text-zinc-300 mb-6 font-medium">
                {Number(selectedPlaylist.followerCount).toLocaleString()} monthly listeners
              </p>
            ) : (
              <>
                <p className="text-base text-zinc-300 mb-2 max-w-2xl font-medium">
                  {(() => {
                    try {
                      return decodeURIComponent(selectedPlaylist.description || '').replace(/%20/g, ' ');
                    } catch (e) {
                      return (selectedPlaylist.description || '').replace(/%20/g, ' ');
                    }
                  })() || 'Relax • Unwind • Repeat'}
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
              <button onClick={handleToggleSave} className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-transparent border border-zinc-600 hover:border-zinc-400 text-white font-bold text-sm rounded-full transition cursor-pointer min-w-[120px]">
                {selectedPlaylist.isArtist ? 'Follow' : (
                  isSaved ? <span className="text-zinc-300">Saved</span> : <><span className="text-lg leading-none">+</span> Save</>
                )}
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


        <div className="flex flex-col lg:flex-row gap-10">
          {/* Main Tracklist */}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white tracking-tight">{selectedPlaylist.isArtist ? 'Popular Tracks' : 'Tracks'}</h2>
              
              <div className="relative z-20" ref={sortDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                  className="text-xs sm:text-sm font-normal text-zinc-300 hover:text-white bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/60 rounded-full px-3.5 py-1.5 flex items-center gap-2 transition cursor-pointer shadow-sm hover:scale-105 active:scale-95"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" />
                  <span>
                    Sort: {
                      sortBy === 'recent' ? 'Newest First' :
                      sortBy === 'recent-reverse' ? 'Oldest First' :
                      sortBy === 'title-asc' ? 'Title (A-Z)' :
                      sortBy === 'title-desc' ? 'Title (Z-A)' :
                      sortBy === 'duration-asc' ? 'Shortest' :
                      sortBy === 'duration-desc' ? 'Longest' : 'Newest First'
                    }
                  </span>
                  <span className="text-[10px] text-zinc-400">▼</span>
                </button>

                {isSortDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-zinc-900/95 backdrop-blur-md border border-zinc-700/80 rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-1.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wider border-b border-zinc-800 mb-1">
                      Sort Tracks By
                    </div>
                    {[
                      { id: 'recent', label: 'Newest First' },
                      { id: 'recent-reverse', label: 'Oldest First' },
                      { id: 'title-asc', label: 'Title (A – Z)' },
                      { id: 'title-desc', label: 'Title (Z – A)' },
                      { id: 'duration-asc', label: 'Duration (Shortest)' },
                      { id: 'duration-desc', label: 'Duration (Longest)' }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setSortBy(opt.id);
                          setIsSortDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2 text-xs font-normal flex items-center justify-between transition cursor-pointer ${
                          sortBy === opt.id ? 'bg-white/10 text-white font-medium' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {sortBy === opt.id && <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-[36px_minmax(0,4fr)_minmax(0,2.5fr)_minmax(0,2fr)_70px_40px] gap-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800/80 pb-3 mb-4 px-3 hidden md:grid">
              <span className="text-center">#</span>
              <span>Title</span>
              <span>Artist</span>
              <span>Album</span>
              <span className="text-right pr-3">Duration</span>
              <span></span>
            </div>

            <div className="flex flex-col gap-1">
              {sortedTracks && sortedTracks.length > 0 ? (
                sortedTracks.map((track, idx) => (
                  <article
                    key={track.videoId || idx}
                    ref={idx === sortedTracks.length - 1 ? lastTrackElementRef : null}
                    className="grid grid-cols-[auto_1fr_auto] md:grid-cols-[36px_minmax(0,4fr)_minmax(0,2.5fr)_minmax(0,2fr)_70px_40px] gap-3 md:gap-4 items-center p-2 md:p-3 rounded-lg hover:bg-zinc-800/50 transition group cursor-pointer"
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
                        src={(!track.thumbnail || track.thumbnail === '/logo.svg') ? '/default-cover.svg' : track.thumbnail}
                        alt={track.title}
                        className="w-10 h-10 md:w-12 md:h-12 rounded shrink-0 object-cover bg-black border border-white/5"
                        onError={(e) => {
                          e.target.src = '/default-cover.svg';
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

                    <div className="hidden md:flex justify-end text-sm text-zinc-500 font-medium pr-3">
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

  const isAppDownloaded = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone);

  const quickAccessItems = [
    { title: 'Browse', subtitle: 'Discover new music', icon: <Music className="w-5 h-5 text-white" />, color: 'bg-[#8938d2]', path: '#/search' },
    { title: 'Liked Songs', subtitle: 'Your favorites', icon: <Heart className="w-5 h-5 text-white fill-current" />, color: 'bg-[#d2384a]', action: handleOpenLikedSongs },
    isAppDownloaded
      ? { title: 'Settings', subtitle: 'App preferences', icon: <Settings className="w-5 h-5 text-white" />, color: 'bg-[#1e864c]', path: '#/settings' }
      : { title: 'Download App', subtitle: 'Install for offline', icon: <Download className="w-5 h-5 text-white" />, color: 'bg-[#1e864c]', path: '#/download' },
    { title: 'Your Library', subtitle: 'All your music', icon: <Library className="w-5 h-5 text-white" />, color: 'bg-[#d28238]', path: '#/library' }
  ];

  return (
    <div className="max-w-[1400px] mx-auto pb-36 px-3.5 sm:px-6 lg:px-8 mt-2 sm:mt-6 select-none">

      {/* Greeting & Mobile Header Bar */}
      {!loadingPlaylists && (
        <div className="mb-6 pl-0.5">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">{greeting}</h2>
              <p className="text-xs sm:text-sm text-zinc-400 font-medium mt-0.5">Discover your next favorite track.</p>
            </div>
          </div>

          {/* Mobile Category Filter Pills (Spotify Mobile Style) */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 -mx-1 px-1">
            {[
              { id: 'all', label: 'All' },
              { id: 'playlists', label: 'Playlists' },
              { id: 'songs', label: 'Songs' },
              { id: 'artists', label: 'Artists' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategoryFilter(cat.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 shrink-0 cursor-pointer ${
                  activeCategoryFilter === cat.id
                    ? 'bg-white text-black shadow-md scale-105'
                    : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 border border-white/10'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mobile-Only Redesigned Compact Hero Story Card */}
      {!loadingPlaylists && featuredPlaylist && (activeCategoryFilter === 'all' || activeCategoryFilter === 'playlists') && (
        <div 
          className="sm:hidden relative overflow-hidden rounded-2xl p-4 sm:p-5 mb-6 cursor-pointer bg-[#141416] hover:bg-[#18181c] border border-zinc-800/80 shadow-2xl group flex items-center justify-between gap-4"
          onClick={() => handlePlaylistClick(featuredPlaylist)}
        >
          <div className="flex flex-col min-w-0 flex-1 justify-center z-10">
            <span className="text-[10px] font-bold tracking-[0.2em] text-zinc-400 uppercase mb-1.5 block">
              Featured
            </span>
            <h2 className="text-lg font-black text-white tracking-tight leading-tight line-clamp-2 mb-1 drop-shadow">
              {featuredPlaylist.title}
            </h2>
            <p className="text-[11px] text-zinc-400 line-clamp-1 mb-3.5 font-medium">
              {featuredPlaylist.description || `${featuredPlaylist.count || '40'} tracks curated by Play LooP`}
            </p>
            <div className="flex items-center gap-2">
              <button 
                type="button"
                className="px-4 py-2 bg-white text-black font-bold text-xs rounded-full flex items-center gap-1.5 shadow-lg active:scale-95 transition cursor-pointer"
                onClick={(e) => { e.stopPropagation(); handlePlaylistClick(featuredPlaylist); }}
              >
                <Play className="w-3.5 h-3.5 fill-current translate-x-[0.5px]" /> Play
              </button>
              <button 
                type="button"
                className={`px-3.5 py-2 font-bold text-xs rounded-full flex items-center gap-1.5 backdrop-blur-md active:scale-95 transition cursor-pointer ${
                  isPlaylistSaved(featuredPlaylist.playlistId)
                    ? 'bg-zinc-800 text-emerald-400 border border-emerald-500/30'
                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                }`}
                onClick={(e) => { e.stopPropagation(); handleToggleSave(featuredPlaylist); }}
              >
                {isPlaylistSaved(featuredPlaylist.playlistId) ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" /> Saved
                  </>
                ) : (
                  <>+ Save</>
                )}
              </button>
            </div>
          </div>

          {/* Clean Right Thumbnail Art */}
          <div className="relative w-28 h-28 shrink-0 rounded-xl overflow-hidden shadow-2xl border border-white/10 z-10 group-hover:scale-105 transition-transform duration-500 bg-zinc-900">
            <img 
              src={featuredPlaylist.thumbnail} 
              alt={featuredPlaylist.title}
              className="w-full h-full object-cover"
              onError={(e) => { e.target.src = '/logo.svg'; }}
            />
          </div>
        </div>
      )}

      {/* Desktop Featured Section */}
      {loadingPlaylists ? (
        <div className="flex flex-col xl:grid xl:grid-cols-3 gap-6 mb-12">
          <div className="xl:col-span-2 h-[320px] sm:h-[450px] bg-[#121212] rounded-2xl animate-pulse"></div>
          <div className="grid grid-cols-2 xl:grid-cols-1 xl:grid-rows-4 gap-3 xl:gap-4 h-auto xl:h-[380px]">
             {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-[#121212] rounded-xl animate-pulse min-h-[50px]"></div>
             ))}
          </div>
        </div>
      ) : (
        (activeCategoryFilter === 'all' || activeCategoryFilter === 'playlists') && (
          <div className="hidden sm:flex flex-col xl:grid xl:grid-cols-3 gap-6 mb-12">
            {/* Hero Featured Playlist */}
            {featuredPlaylist && (
              <div 
                className="xl:col-span-2 relative h-[340px] sm:h-[450px] rounded-2xl overflow-hidden group cursor-pointer bg-[#121212] shadow-xl border border-white/5"
                onClick={() => handlePlaylistClick(featuredPlaylist)}
              >
                <img 
                  src={featuredPlaylist.thumbnail} 
                  alt={featuredPlaylist.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/60 to-transparent"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-transparent"></div>
                
                <div className="absolute bottom-0 left-0 p-6 sm:p-8 md:p-10 w-full md:w-3/4 flex flex-col justify-end h-full">
                  <span className="text-[10px] sm:text-xs font-bold tracking-[0.2em] text-zinc-400 uppercase mb-3 block drop-shadow-md">
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
                      className="bg-white text-black px-6 sm:px-8 py-2.5 sm:py-3.5 rounded-full font-bold text-sm flex items-center gap-2 hover:scale-105 active:scale-95 transition shadow-xl cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); handlePlaylistClick(featuredPlaylist); }}
                    >
                      <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current translate-x-[1px]" /> Play
                    </button>
                    <button 
                      className={`px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-full font-bold text-sm flex items-center gap-2 transition cursor-pointer ${
                        isPlaylistSaved(featuredPlaylist.playlistId)
                          ? 'bg-zinc-800 text-emerald-400 border border-emerald-500/40'
                          : 'bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/10'
                      }`}
                      onClick={(e) => { e.stopPropagation(); handleToggleSave(featuredPlaylist); }}
                    >
                      {isPlaylistSaved(featuredPlaylist.playlistId) ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" /> Saved
                        </>
                      ) : (
                        <>+ Save</>
                      )}
                    </button>
                    <span className="hidden md:inline-block ml-4 text-zinc-300 text-sm font-medium">
                      {featuredPlaylist.count} songs
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Access Grid Desktop */}
            <div className="grid grid-cols-2 xl:flex xl:flex-col gap-3 xl:gap-4 xl:justify-between h-auto xl:h-[450px]">
              {quickAccessItems.map((item, index) => (
                <div 
                  key={index}
                  onClick={() => { 
                    if (item.action) {
                      item.action();
                    } else if (item.path) {
                      if (setCurrentView) setCurrentView(item.path.replace('#/', ''));
                      window.location.hash = item.path;
                    }
                  }}
                  className="flex-1 bg-[#121212] hover:bg-[#1a1a1a] rounded-xl p-3 xl:p-4 flex items-center gap-3 xl:gap-4 cursor-pointer transition border border-white/5 hover:border-white/10 shadow-sm group"
                >
                  <div className={`w-10 h-10 xl:w-14 xl:h-14 rounded-lg xl:rounded-xl flex items-center justify-center shrink-0 shadow-sm ${item.color}`}>
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
        )
      )}

      {/* Quick Access Grid Mobile (Sleek Compact 2-Column Spotify Rows) */}
      {!loadingPlaylists && (activeCategoryFilter === 'all' || activeCategoryFilter === 'playlists') && (
        <div className="sm:hidden grid grid-cols-2 gap-2.5 mb-8">
          {quickAccessItems.map((item, index) => (
            <div 
              key={index}
              onClick={() => { 
                if (item.action) {
                  item.action();
                } else if (item.path) {
                  if (setCurrentView) setCurrentView(item.path.replace('#/', ''));
                  window.location.hash = item.path;
                }
              }}
              className="bg-[#161618] hover:bg-[#202024] active:bg-[#25252a] rounded-xl p-2 flex items-center gap-3 cursor-pointer transition border border-white/5 shadow-md group h-14"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${item.color}`}>
                {item.icon}
              </div>
              <div className="flex flex-col min-w-0 flex-1 justify-center">
                <h3 className="text-white font-bold text-xs truncate leading-tight">{item.title}</h3>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recently Played Row */}
      {recentlyPlayed && recentlyPlayed.length > 0 && (activeCategoryFilter === 'all' || activeCategoryFilter === 'songs') && (
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
      {!loadingPlaylists && madeForYouPlaylists.length > 0 && (activeCategoryFilter === 'all' || activeCategoryFilter === 'playlists') && (
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

      {/* Popular Artists Row */}
      {popularArtists.length > 0 && (activeCategoryFilter === 'all' || activeCategoryFilter === 'artists') && (
        <div className="mb-10 sm:mb-12">
          <Carousel
            title="Popular Artists"
            items={popularArtists}
            onItemClick={handlePlaylistClick}
            renderSubtitle={() => "Artist"}
            keyExtractor={(item, index) => `${item.playlistId}-${index}`}
            cardType="circle"
            onEndReached={loadMoreArtists}
            isLoadingMore={loadingMoreArtists}
          />
        </div>
      )}

      {/* Popular Albums - Immersive Grid Redesign */}
      {!loadingPlaylists && popularAlbumsPlaylists.length > 0 && (activeCategoryFilter === 'all' || activeCategoryFilter === 'playlists') && (
        <div className="mb-14 sm:mb-16 mt-4 sm:mt-8">
          <div className="flex items-center justify-between mb-5 pl-0.5">
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Trending & Popular</h3>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
            {popularAlbumsPlaylists.slice(0, visiblePopularCount).map((item, index) => {
              const outerCover = playlistThumbnailMap[item.playlistId] || item.thumbnail;
              return (
                <div
                  key={`${item.playlistId}-${index}`}
                  onClick={() => handlePlaylistClick(item)}
                  className="group flex flex-col p-2.5 sm:p-3.5 rounded-xl bg-[#141416] hover:bg-[#202024] active:bg-[#25252a] cursor-pointer transition-colors duration-300 border border-white/5"
                >
                  <div className="relative w-full aspect-square rounded-lg shadow-lg overflow-hidden mb-3 bg-black border border-white/5">
                    <img
                      src={(!outerCover || outerCover === '/logo.svg') ? '/default-cover.svg' : outerCover}
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        e.target.src = '/default-cover.svg';
                      }}
                      loading="lazy"
                    />
                    
                    {/* Play Button Overlay */}
                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 z-20">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white flex items-center justify-center shadow-xl hover:scale-105 hover:bg-gray-50 text-black">
                        <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current translate-x-[1.5px]" />
                      </div>
                    </div>
                  </div>

                  <h4 className="font-bold text-white text-xs sm:text-[15px] truncate mb-1 tracking-tight">
                    {item.title}
                  </h4>
                  <p className="font-medium text-zinc-400 text-[11px] sm:text-[13px] line-clamp-2 leading-snug">
                    {item.author || item.artist || 'Collection'}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={handleShowMorePopular}
              disabled={loadingMorePopularAlbums}
              className="px-6 py-2.5 rounded-full border border-zinc-700/80 bg-zinc-900/80 hover:bg-zinc-800 text-xs sm:text-sm font-bold text-white transition-all shadow-sm hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
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
    </div>
  );
}

