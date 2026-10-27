import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { fetchRecommendedPlaylists, fetchPlaylistDetails, fetchMoreDynamicPlaylists, fetchPopularArtists, fetchPopularSongs, DEFAULT_PLAYLISTS, savePlaylistApi, unsavePlaylistApi } from '../services/api.js';
import Carousel from '../components/Carousel';
import LanguageSongSection from '../components/LanguageSongSection';
import SpeedDialSection from '../components/SpeedDialSection';
import Footer from '../components/Footer.jsx';
import { ArrowLeft, Play, Pause, Music, Heart, Sparkles, Library, ChevronRight, Settings, Download, ArrowUpDown, Check, Edit3, Share2, MoreVertical, Trash2, GripVertical, ChevronUp, ChevronDown, ListPlus, FolderPlus, ListMusic, ListStart, Disc3, LocateFixed } from 'lucide-react';
import { navigateBack } from '../utils/navigationHistory';
import { filterValidDurationTracks } from '../utils/durationUtils';
import { removeSongFromPlaylist, reorderSongsInPlaylist, deleteUserPlaylist } from '../utils/playlistManager';

const LANGUAGE_POPULARITY_RANK = {
  hindi: 1,
  english: 2,
  punjabi: 3,
  telugu: 4,
  tamil: 5,
  bhojpuri: 6,
  gujarati: 7,
  marathi: 8,
  malayalam: 9,
  bengali: 10,
  kannada: 11,
  spanish: 12
};

const LANGUAGE_META = {
  english: { label: 'English', native: 'English', tag: 'Global Pop & Billboard Hits', watermark: 'ENGLISH' },
  hindi: { label: 'Hindi', native: 'हिन्दी', tag: 'Bollywood Top Charts & Indies', watermark: 'हिन्दी' },
  gujarati: { label: 'Gujarati', native: 'ગુજરાતી', tag: 'Dhollywood & Folk Melodies', watermark: 'ગુજરાતી' },
  punjabi: { label: 'Punjabi', native: 'ਪੰਜਾਬੀ', tag: 'Desi Hip-Hop & Bhangra Beats', watermark: 'ਪੰਜਾਬੀ' },
  tamil: { label: 'Tamil', native: 'தமிழ்', tag: 'Kollywood Soundtracks & Melodies', watermark: 'தமிழ்' },
  telugu: { label: 'Telugu', native: 'తెలుగు', tag: 'Tollywood Grooves & Hits', watermark: 'తెలుగు' },
  spanish: { label: 'Spanish', native: 'Español', tag: 'Latin Reggaeton & Global Beats', watermark: 'ESPAÑOL' },
  marathi: { label: 'Marathi', native: 'मराठी', tag: 'Marathi Classics & Pop', watermark: 'मराठी' },
  bhojpuri: { label: 'Bhojpuri', native: 'भोजपुरी', tag: 'Desi Grooves & Folk Hits', watermark: 'भोजपुरी' },
  malayalam: { label: 'Malayalam', native: 'മലയാളം', tag: 'Mollywood Vibes & Indie Tracks', watermark: 'മലയാളം' },
  bengali: { label: 'Bengali', native: 'বাংলা', tag: 'Tollywood Classics & Hits', watermark: 'বাংলা' },
  kannada: { label: 'Kannada', native: 'ಕನ್ನಡ', tag: 'Sandalwood Melodies & Beats', watermark: 'ಕನ್ನಡ' }
};

const getLanguageMeta = (lang) => {
  const key = String(lang).toLowerCase().trim();
  if (LANGUAGE_META[key]) return LANGUAGE_META[key];
  const capitalized = key.charAt(0).toUpperCase() + key.slice(1);
  return {
    label: capitalized,
    native: capitalized,
    tag: 'Trending Hits'
  };
};

const getInitialLanguages = () => {
  try {
    const prefStr = localStorage.getItem('preferred_languages');
    if (prefStr) {
      const parsed = JSON.parse(prefStr);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(l => String(l).toLowerCase().trim()).filter(Boolean);
      }
    }
  } catch (e) {}
  return ['english', 'hindi'];
};

export default function Home({ setCurrentView, refreshKey = 0 }) {
  const [greeting, setGreeting] = useState('');
  const [playlists, setPlaylists] = useState([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [loadingPlaylistDetails, setLoadingPlaylistDetails] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const selectedPlaylistRef = useRef(selectedPlaylist);
  useEffect(() => {
    selectedPlaylistRef.current = selectedPlaylist;
  }, [selectedPlaylist]);
  
  const [extraMadeForYou, setExtraMadeForYou] = useState([]);
  const [extraPopularAlbums, setExtraPopularAlbums] = useState([]);
  const [loadingMoreMadeForYou, setLoadingMoreMadeForYou] = useState(false);
  const [loadingMorePopularAlbums, setLoadingMorePopularAlbums] = useState(false);
  const getGridCols = useCallback(() => {
    if (typeof window === 'undefined') return 6;
    const w = window.innerWidth;
    if (w >= 1280) return 6;
    if (w >= 1024) return 5;
    if (w >= 768) return 4;
    if (w >= 640) return 3;
    return 2;
  }, []);

  const [gridCols, setGridCols] = useState(getGridCols);

  useEffect(() => {
    const handleResize = () => {
      setGridCols(getGridCols());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getGridCols]);

  const batchSize = gridCols <= 2 ? 4 : gridCols;
  const [visiblePopularCount, setVisiblePopularCount] = useState(() => {
    const initialCols = typeof window !== 'undefined' ? (
      window.innerWidth >= 1280 ? 6 :
      window.innerWidth >= 1024 ? 5 :
      window.innerWidth >= 768 ? 4 :
      window.innerWidth >= 640 ? 3 : 2
    ) : 6;
    return initialCols <= 2 ? 4 : initialCols;
  });

  const [playlistThumbnailMap, setPlaylistThumbnailMap] = useState({});

  const featuredPlaylist = playlists.length > 0 ? playlists[0] : (DEFAULT_PLAYLISTS[0] || null);
  const madeForYouPlaylists = [...(playlists.length > 1 ? playlists.slice(1, 6) : DEFAULT_PLAYLISTS.slice(1, 6)), ...extraMadeForYou];
  
  const initialPopular = playlists.length > 6 
    ? [...playlists.slice(6), ...DEFAULT_PLAYLISTS].filter((item, idx, self) => self.findIndex(t => t.playlistId === item.playlistId) === idx)
    : DEFAULT_PLAYLISTS;
  const popularAlbumsPlaylists = [...initialPopular, ...extraPopularAlbums];

  const { selectAndPlayTrack, playPlaylist, recentlyPlayed = [], pendingTrack, isPlaying, playPause, trackQueue, setIsRightSidebarOpen, addToUpNext, addToQueue } = usePlayer();

  const [popularArtists, setPopularArtists] = useState([]);
  const [loadingMoreArtists, setLoadingMoreArtists] = useState(false);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('all');

  const [userPreferredLanguages, setUserPreferredLanguages] = useState(getInitialLanguages);
  const [languageSongs, setLanguageSongs] = useState({});
  const [loadingLanguages, setLoadingLanguages] = useState({});

  const [sortBy, setSortBy] = useState('recent');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const sortDropdownRef = useRef(null);

  const [openTrackMenuIndex, setOpenTrackMenuIndex] = useState(null);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [touchDragIndex, setTouchDragIndex] = useState(null);
  const [touchOverIndex, setTouchOverIndex] = useState(null);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const headerMenuRef = useRef(null);

  const longPressTimerRef = useRef(null);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const isLongPressActiveRef = useRef(false);

  const handleTrackTouchStart = (idx, e) => {
    if (isReorderMode) return;
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    isLongPressActiveRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(40); } catch (_) {}
      }
      setOpenTrackMenuIndex(idx);
    }, 450);
  };

  const handleTrackTouchMove = (e) => {
    if (longPressTimerRef.current) {
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
      const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
      if (dx > 8 || dy > 8) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  };

  const handleTrackTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  useEffect(() => {
    setIsReorderMode(false);
    setTouchDragIndex(null);
    setTouchOverIndex(null);
  }, [selectedPlaylist?.playlistId]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target)) {
        setIsSortDropdownOpen(false);
      }
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target)) {
        setIsHeaderMenuOpen(false);
      }
      if (!e.target.closest('.track-menu-container')) {
        setOpenTrackMenuIndex(null);
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

  const playingTrackIndex = useMemo(() => {
    if (!pendingTrack || !sortedTracks || sortedTracks.length === 0) return -1;
    const pId = String(pendingTrack.videoId || pendingTrack.id || '').trim();
    const pTitle = String(pendingTrack.title || '').toLowerCase().trim().replace(/[\(\[].*?[\)\]]/g, '').trim();

    return sortedTracks.findIndex((t) => {
      const tId = String(t.videoId || t.id || '').trim();
      if (tId && pId && tId === pId) return true;
      if (t.title && pTitle) {
        const tTitle = String(t.title).toLowerCase().trim().replace(/[\(\[].*?[\)\]]/g, '').trim();
        if (tTitle && tTitle === pTitle) {
          if (!t.artist || !pendingTrack.artist) return true;
          return t.artist.toLowerCase().trim().slice(0, 10) === pendingTrack.artist.toLowerCase().trim().slice(0, 10);
        }
      }
      return false;
    });
  }, [pendingTrack, sortedTracks]);

  const isPlayingInThisPlaylist = playingTrackIndex !== -1;

  const handleScrollToPlayingTrack = useCallback(() => {
    if (playingTrackIndex === -1) return;
    const trackEl = document.querySelector(`[data-track-index="${playingTrackIndex}"]`);
    if (trackEl) {
      trackEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      trackEl.classList.add('playing-track-flash');
      setTimeout(() => {
        trackEl.classList.remove('playing-track-flash');
      }, 1600);
    }
  }, [playingTrackIndex]);

  const loadMoreArtists = async () => {
    if (loadingMoreArtists) return;
    setLoadingMoreArtists(true);
    try {
      const prefStr = localStorage.getItem('preferred_languages');
      const langs = prefStr ? JSON.parse(prefStr) : [];
      const nextLimit = Math.min(60, popularArtists.length + 10);
      const more = await fetchPopularArtists(langs, nextLimit);
      if (more && more.length > 0) {
        setPopularArtists(prev => {
          const existingIds = new Set(prev.map(a => a.playlistId));
          const newArtists = more.filter(a => a && a.playlistId && !existingIds.has(a.playlistId));
          if (newArtists.length === 0) return prev;
          return [...prev, ...newArtists];
        });
      }
    } catch (e) {
      console.error("Failed to load more artists:", e);
    } finally {
      setLoadingMoreArtists(false);
    }
  };

  useEffect(() => {
    const handleLanguagesUpdated = () => {
      const langs = getInitialLanguages();
      setUserPreferredLanguages(langs);

      setPopularArtists([]);
      fetchPopularArtists(langs, 10).then(artists => {
        if (artists && artists.length > 0) {
          setPopularArtists(artists);
        }
      });
    };
    window.addEventListener('playloop-languages-updated', handleLanguagesUpdated);
    window.addEventListener('storage', handleLanguagesUpdated);
    return () => {
      window.removeEventListener('playloop-languages-updated', handleLanguagesUpdated);
      window.removeEventListener('storage', handleLanguagesUpdated);
    };
  }, []);

  useEffect(() => {
    if (!userPreferredLanguages || userPreferredLanguages.length === 0) return;

    userPreferredLanguages.forEach((lang) => {
      if (languageSongs[lang] && languageSongs[lang].length > 0 && refreshKey === 0) return;

      setLoadingLanguages(prev => ({ ...prev, [lang]: true }));
      fetchPopularSongs([lang])
        .then((songs) => {
          if (Array.isArray(songs) && songs.length > 0) {
            setLanguageSongs(prev => ({ ...prev, [lang]: songs }));
          }
        })
        .catch((err) => {
          console.error(`Failed to load popular songs for ${lang}:`, err);
        })
        .finally(() => {
          setLoadingLanguages(prev => ({ ...prev, [lang]: false }));
        });
    });
  }, [userPreferredLanguages, refreshKey]);

  const handlePlayLanguageTrack = (track, index, lang) => {
    const meta = getLanguageMeta(lang);
    const songs = languageSongs[lang] || [];
    const targetIdx = index >= 0 && index < songs.length ? index : songs.findIndex(s => s.videoId === track.videoId);
    if (songs.length > 0) {
      playPlaylist(songs, targetIdx !== -1 ? targetIdx : 0, {
        playlistId: `popular-${lang}`,
        title: `Popular in ${meta.label}`,
        author: "Play LooP"
      });
    } else {
      selectAndPlayTrack(
        track.videoId,
        track.title,
        track.artist,
        track.thumbnail || track.cover || track.artwork || track.albumArt,
        false,
        false,
        track.duration
      );
    }
  };

  const handlePlayAllLanguage = (lang) => {
    const meta = getLanguageMeta(lang);
    const songs = languageSongs[lang];
    if (songs && songs.length > 0) {
      playPlaylist(songs, 0, {
        playlistId: `popular-${lang}`,
        title: `Popular in ${meta.label}`,
        author: "Play LooP"
      });
    }
  };

  const handleShuffleLanguage = (lang) => {
    const meta = getLanguageMeta(lang);
    const songs = languageSongs[lang];
    if (songs && songs.length > 0) {
      const shuffled = [...songs].sort(() => 0.5 - Math.random());
      playPlaylist(shuffled, 0, {
        playlistId: `popular-${lang}-shuffle`,
        title: `Popular in ${meta.label} (Shuffle)`,
        author: "Play LooP"
      });
    }
  };

  // Selected languages to showcase as full sections (maximum 3)
  const showcaseLanguages = useMemo(() => {
    if (!userPreferredLanguages || userPreferredLanguages.length === 0) {
      return ['hindi', 'english'];
    }
    const uniqueLangs = Array.from(new Set(userPreferredLanguages.map(l => String(l).toLowerCase().trim()))).filter(Boolean);
    const sorted = uniqueLangs.sort((a, b) => {
      const rankA = LANGUAGE_POPULARITY_RANK[a] || 99;
      const rankB = LANGUAGE_POPULARITY_RANK[b] || 99;
      return rankA - rankB;
    });
    return sorted.slice(0, 3);
  }, [userPreferredLanguages]);

  const renderLanguageSection = (lang) => {
    if (!lang) return null;
    const meta = getLanguageMeta(lang);
    const songs = languageSongs[lang] || [];
    const isLoading = Boolean(loadingLanguages[lang]) && songs.length === 0;

    return (
      <LanguageSongSection
        key={`lang-showcase-${lang}`}
        lang={lang}
        meta={meta}
        songs={songs}
        isLoading={isLoading}
        onPlayTrack={(track, index) => handlePlayLanguageTrack(track, index, lang)}
        onPlayAll={() => handlePlayAllLanguage(lang)}
        onShuffle={() => handleShuffleLanguage(lang)}
      />
    );
  };

  // Interleave popular tracks from all user's selected languages for Speed Dial
  const speedDialSongs = useMemo(() => {
    if (!userPreferredLanguages || userPreferredLanguages.length === 0) return [];

    const langLists = userPreferredLanguages.map(l => ({
      lang: l,
      songs: (languageSongs[l] || []).map(s => ({ ...s, language: l }))
    })).filter(item => item.songs.length > 0);

    if (langLists.length === 0) return [];

    const pooled = [];
    const maxTracks = Math.max(...langLists.map(l => l.songs.length));

    for (let i = 0; i < maxTracks; i++) {
      for (const list of langLists) {
        if (list.songs[i]) {
          pooled.push(list.songs[i]);
          if (pooled.length >= 27) break; // 3x3 x 3 pages max
        }
      }
      if (pooled.length >= 27) break;
    }

    return pooled;
  }, [userPreferredLanguages, languageSongs]);

  const handlePlaySpeedDialTrack = (track, index) => {
    if (speedDialSongs.length > 0) {
      playPlaylist(speedDialSongs, index >= 0 && index < speedDialSongs.length ? index : 0, {
        playlistId: 'speed-dial',
        title: 'Speed Dial',
        author: 'Play LooP'
      });
    } else {
      selectAndPlayTrack(
        track.videoId,
        track.title,
        track.artist,
        track.thumbnail || track.cover || track.artwork || track.albumArt,
        false,
        false,
        track.duration
      );
    }
  };

  const handlePlayAllSpeedDial = () => {
    if (speedDialSongs.length > 0) {
      playPlaylist(speedDialSongs, 0, {
        playlistId: 'speed-dial',
        title: 'Speed Dial',
        author: 'Play LooP'
      });
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

  const resetScrollToTop = useCallback(() => {
    const appContent = document.querySelector('.app-content');
    if (appContent) {
      appContent.scrollTop = 0;
    }
    const mainSection = document.querySelector('section.app-content');
    if (mainSection) {
      mainSection.scrollTop = 0;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }, []);

  const handleOpenLikedSongs = useCallback(() => {
    try {
      resetScrollToTop();
      let likedList = [];
      try {
        likedList = JSON.parse(localStorage.getItem('playloop_liked_tracks_list') || '[]');
      } catch (err) {
        likedList = [];
      }
      const validTracks = filterValidDurationTracks(likedList);
      const playlistDetails = {
        playlistId: 'liked_songs',
        title: 'Liked Songs',
        author: 'Your Favorites',
        thumbnail: '/liked_songs_cover.png',
        description: 'Collection of all your favorite liked songs.',
        count: validTracks.length,
        tracks: validTracks,
        isLikedPlaylist: true
      };
      if (!window.location.hash.includes('liked_songs') && !window.location.hash.includes('liked-songs')) {
        window.location.hash = '#/playlist/liked_songs';
      }
      setSelectedPlaylist(playlistDetails);
      setIsSaved(true);
      resetScrollToTop();
    } catch (e) {
      console.error(e);
    }
  }, [resetScrollToTop]);

  useEffect(() => {
    if (selectedPlaylist || loadingPlaylistDetails) {
      resetScrollToTop();
      const rAF1 = requestAnimationFrame(() => {
        resetScrollToTop();
        const rAF2 = requestAnimationFrame(() => {
          resetScrollToTop();
        });
        return () => cancelAnimationFrame(rAF2);
      });
      return () => cancelAnimationFrame(rAF1);
    }
  }, [selectedPlaylist?.playlistId, loadingPlaylistDetails, resetScrollToTop]);

  useEffect(() => {
    const handleHashChange = async () => {
      const hash = window.location.hash || '';
      const match = hash.match(/^#\/?playlist\/([^?&]+)/);
      
      if (match) {
        const id = match[1];
        resetScrollToTop();
        if (id === 'liked_songs' || id === 'liked-songs') {
          if (!selectedPlaylistRef.current || selectedPlaylistRef.current.playlistId !== 'liked_songs') {
            handleOpenLikedSongs();
          }
          return;
        }
        if (!selectedPlaylistRef.current || selectedPlaylistRef.current.playlistId !== id) {
          setLoadingPlaylistDetails(true);
          resetScrollToTop();
          setPlaylistPage(1);
          setHasMorePlaylist(true);
          try {
            const details = await fetchPlaylistDetails(id, 1);
            if (details) {
              if (Array.isArray(details.tracks)) {
                details.tracks = filterValidDurationTracks(details.tracks);
              }
              setSelectedPlaylist(details);
              resetScrollToTop();
              if (details.playlistId && details.thumbnail) {
                setPlaylistThumbnailMap(prev => ({
                  ...prev,
                  [details.playlistId]: details.thumbnail
                }));
              }
              checkIfSaved(details.playlistId);
              if (details.tracks && (details.tracks.length < 30 || String(details.playlistId).startsWith('imported_') || String(details.playlistId).startsWith('user_pl_') || details.isUserCreated)) {
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
        if (!selectedPlaylistRef.current || selectedPlaylistRef.current.playlistId !== 'liked_songs') {
          handleOpenLikedSongs();
        }
      } else {
        if (selectedPlaylistRef.current) {
          setSelectedPlaylist(null);
        }
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [handleOpenLikedSongs]);

  function checkIfSaved(playlistId) {
    if (!playlistId) {
      setIsSaved(false);
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem('playloop_saved_playlists') || '[]');
      setIsSaved(saved.some(p => String(p.playlistId || p.id) === String(playlistId)));
    } catch (e) {
      setIsSaved(false);
    }
  };

  const [savedPlaylistsVersion, setSavedPlaylistsVersion] = useState(0);

  const isPlaylistSaved = useCallback((playlistId) => {
    if (!playlistId) return false;
    try {
      const saved = JSON.parse(localStorage.getItem('playloop_saved_playlists') || '[]');
      return saved.some(p => String(p.playlistId || p.id) === String(playlistId));
    } catch (e) {
      return false;
    }
  }, [savedPlaylistsVersion]);

  useEffect(() => {
    const handleSavedUpdated = () => {
      setSavedPlaylistsVersion(v => v + 1);
      if (selectedPlaylistRef.current?.playlistId) {
        const curId = String(selectedPlaylistRef.current.playlistId);
        checkIfSaved(curId);
        try {
          const saved = JSON.parse(localStorage.getItem('playloop_saved_playlists') || '[]');
          const match = saved.find(p => String(p.playlistId || p.id) === curId);
          if (match) {
            setSelectedPlaylist(prev => ({
              ...prev,
              ...match,
              title: match.title || match.name,
              tracks: match.tracks || []
            }));
          }
        } catch (_) {}
      }
    };
    window.addEventListener('playloop-saved-playlists-updated', handleSavedUpdated);
    return () => window.removeEventListener('playloop-saved-playlists-updated', handleSavedUpdated);
  }, []);

  const isSelectedUserPlaylist = useMemo(() => {
    if (!selectedPlaylist || selectedPlaylist.isArtist || selectedPlaylist.isLikedPlaylist) return false;
    const pid = String(selectedPlaylist.playlistId || '');
    return Boolean(selectedPlaylist.isUserCreated || pid.startsWith('user_pl_') || isPlaylistSaved(pid));
  }, [selectedPlaylist, isPlaylistSaved]);

  const handleShareCurrentPlaylist = () => {
    if (!selectedPlaylist) return;
    setIsHeaderMenuOpen(false);
    window.dispatchEvent(
      new CustomEvent('playloop-open-share', {
        detail: {
          type: 'playlist',
          isPlaylist: true,
          playlistId: selectedPlaylist.playlistId,
          title: selectedPlaylist.title,
          author: selectedPlaylist.author || 'You',
          thumbnail: selectedPlaylist.thumbnail || '/default-cover.svg',
          count: selectedPlaylist.tracks?.length || 0
        }
      })
    );
  };

  const handleEditCurrentPlaylist = () => {
    if (!selectedPlaylist) return;
    setIsHeaderMenuOpen(false);
    window.dispatchEvent(
      new CustomEvent('playloop-open-playlist-edit', {
        detail: {
          playlistId: selectedPlaylist.playlistId,
          title: selectedPlaylist.title,
          description: selectedPlaylist.description || ''
        }
      })
    );
  };

  const handleDeleteCurrentPlaylist = () => {
    if (!selectedPlaylist) return;
    setIsHeaderMenuOpen(false);
    const pid = String(selectedPlaylist.playlistId);
    deleteUserPlaylist(pid);
    window.dispatchEvent(new CustomEvent('playloop-toast', { detail: 'Playlist deleted' }));
    handleBack();
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e, toIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === toIndex || !sortedTracks || !selectedPlaylist?.tracks) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    const fromTrack = sortedTracks[draggedIndex];
    const toTrack = sortedTracks[toIndex];
    if (!fromTrack || !toTrack) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const realFrom = selectedPlaylist.tracks.findIndex(t => String(t.videoId || t.id) === String(fromTrack.videoId || fromTrack.id));
    const realTo = selectedPlaylist.tracks.findIndex(t => String(t.videoId || t.id) === String(toTrack.videoId || toTrack.id));
    if (realFrom === -1 || realTo === -1 || realFrom === realTo) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    if (sortBy !== 'recent') {
      setSortBy('recent');
    }

    const pid = selectedPlaylist?.playlistId;
    if (pid) {
      const updated = reorderSongsInPlaylist(pid, realFrom, realTo);
      if (updated) {
        setSelectedPlaylist(prev => ({ ...prev, ...updated }));
      }
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleTouchStart = (e, index) => {
    if (!isSelectedUserPlaylist) return;
    setTouchDragIndex(index);
    setTouchOverIndex(index);
    if (navigator.vibrate) {
      try { navigator.vibrate(15); } catch (_) {}
    }
  };

  const handleTouchMove = (e) => {
    if (touchDragIndex === null) return;
    if (e.cancelable) {
      e.preventDefault();
    }
    const touch = e.touches[0];
    if (!touch) return;
    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
    const rowEl = targetEl?.closest('[data-track-index]');
    if (rowEl) {
      const overIndex = parseInt(rowEl.getAttribute('data-track-index'), 10);
      if (!isNaN(overIndex) && overIndex !== touchOverIndex) {
        setTouchOverIndex(overIndex);
        if (navigator.vibrate) {
          try { navigator.vibrate(5); } catch (_) {}
        }
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchDragIndex !== null && touchOverIndex !== null && touchDragIndex !== touchOverIndex) {
      const fromTrack = sortedTracks[touchDragIndex];
      const toTrack = sortedTracks[touchOverIndex];
      if (fromTrack && toTrack && selectedPlaylist?.tracks) {
        const realFrom = selectedPlaylist.tracks.findIndex(t => String(t.videoId || t.id) === String(fromTrack.videoId || fromTrack.id));
        const realTo = selectedPlaylist.tracks.findIndex(t => String(t.videoId || t.id) === String(toTrack.videoId || toTrack.id));
        if (realFrom !== -1 && realTo !== -1 && realFrom !== realTo) {
          if (sortBy !== 'recent') {
            setSortBy('recent');
          }
          const pid = selectedPlaylist?.playlistId;
          if (pid) {
            const updated = reorderSongsInPlaylist(pid, realFrom, realTo);
            if (updated) {
              setSelectedPlaylist(prev => ({ ...prev, ...updated }));
              window.dispatchEvent(new CustomEvent('playloop-toast', { detail: 'Playlist order updated' }));
            }
          }
        }
      }
    }
    setTouchDragIndex(null);
    setTouchOverIndex(null);
  };

  const handleMoveSong = (fromIndex, direction) => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (!sortedTracks || !selectedPlaylist?.tracks || toIndex < 0 || toIndex >= sortedTracks.length) return;

    const fromTrack = sortedTracks[fromIndex];
    const toTrack = sortedTracks[toIndex];
    if (!fromTrack || !toTrack) return;

    const realFrom = selectedPlaylist.tracks.findIndex(t => String(t.videoId || t.id) === String(fromTrack.videoId || fromTrack.id));
    const realTo = selectedPlaylist.tracks.findIndex(t => String(t.videoId || t.id) === String(toTrack.videoId || toTrack.id));
    if (realFrom === -1 || realTo === -1 || realFrom === realTo) return;

    if (sortBy !== 'recent') {
      setSortBy('recent');
    }

    const pid = selectedPlaylist?.playlistId;
    if (pid) {
      const updated = reorderSongsInPlaylist(pid, realFrom, realTo);
      if (updated) {
        setSelectedPlaylist(prev => ({ ...prev, ...updated }));
      }
    }
  };

  const handleRemoveTrackFromPlaylist = (e, videoId) => {
    e.stopPropagation();
    const pid = selectedPlaylist?.playlistId;
    if (pid) {
      const updated = removeSongFromPlaylist(pid, videoId);
      if (updated) {
        setSelectedPlaylist(prev => ({ ...prev, ...updated }));
        window.dispatchEvent(new CustomEvent('playloop-toast', { detail: 'Song removed from playlist' }));
      }
    }
  };

  const handleToggleSave = (targetPlaylist) => {
    const target = (targetPlaylist && targetPlaylist.playlistId) ? targetPlaylist : selectedPlaylist;
    if (!target || !target.playlistId) return;
    try {
      const pid = String(target.playlistId);
      const saved = JSON.parse(localStorage.getItem('playloop_saved_playlists') || '[]');
      const existsIndex = saved.findIndex(p => String(p.playlistId || p.id) === pid);
      if (existsIndex >= 0) {
        saved.splice(existsIndex, 1);
        if (selectedPlaylist && String(selectedPlaylist.playlistId) === pid) {
          setIsSaved(false);
        }
        unsavePlaylistApi(pid).catch(() => {});
      } else {
        const playlistToSave = {
          playlistId: pid,
          id: pid,
          title: target.title || target.name || 'Playlist',
          author: target.author || target.artist || 'Play LooP',
          thumbnail: target.thumbnail || target.cover,
          description: target.description || '',
          count: target.tracks ? target.tracks.length : (target.count || 0),
          tracks: target.tracks || [],
          isArtist: target.isArtist
        };
        saved.unshift(playlistToSave);
        if (selectedPlaylist && String(selectedPlaylist.playlistId) === pid) {
          setIsSaved(true);
        }
        savePlaylistApi(playlistToSave).catch(() => {});
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
      const currentAvailable = popularAlbumsPlaylists.length;
      const targetCount = visiblePopularCount + batchSize;
      
      if (currentAvailable < targetCount) {
        const needed = targetCount - currentAvailable;
        const more = await fetchMoreDynamicPlaylists(needed);
        setExtraPopularAlbums(prev => [...prev, ...more]);
      } else {
        await new Promise(r => setTimeout(r, 300));
      }
      setVisiblePopularCount(prev => prev + batchSize);
    } catch (err) {
      console.error(err);
      setVisiblePopularCount(prev => prev + batchSize);
    } finally {
      setLoadingMorePopularAlbums(false);
    }
  };

  const handleShowMorePopular = () => {
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
    const handlePopState = () => {
      const hash = window.location.hash || '';
      if (hash.includes('liked_songs') || hash.includes('liked-songs')) {
        if (!selectedPlaylistRef.current || selectedPlaylistRef.current.playlistId !== 'liked_songs') {
          handleOpenLikedSongs();
        }
      } else if (!hash.includes('playlist/')) {
        setSelectedPlaylist(null);
      }
    };

    const handleOpenLikedEvent = () => {
      handleOpenLikedSongs();
    };

    const handleLikedUpdated = () => {
      if (selectedPlaylistRef.current?.playlistId === 'liked_songs') {
        handleOpenLikedSongs();
      }
    };

    if (window.history.state?.playlistId === 'liked_songs') {
      handleOpenLikedSongs();
    }

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('playloop-open-liked-songs', handleOpenLikedEvent);
    window.addEventListener('playloop-liked-songs-updated', handleLikedUpdated);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('playloop-open-liked-songs', handleOpenLikedEvent);
      window.removeEventListener('playloop-liked-songs-updated', handleLikedUpdated);
    };
  }, [handleOpenLikedSongs]);

  const loadMorePlaylistTracks = async (id, page) => {
    setLoadingMorePlaylist(true);
    try {
      const details = await fetchPlaylistDetails(id, page);
      const validDetailsTracks = filterValidDurationTracks(details?.tracks || []);
      if (details && validDetailsTracks.length > 0) {
        setSelectedPlaylist(prev => {
          const existingIds = new Set(prev.tracks.map(t => t.videoId));
          const newTracks = validDetailsTracks.filter(t => !existingIds.has(t.videoId));
          
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
    resetScrollToTop();
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

  const handleBack = () => {
    resetScrollToTop();
    navigateBack('#/home');
  };

  const getSelectedPlaylistContext = (tracks) => {
    if (!selectedPlaylist) return null;
    const pid = String(selectedPlaylist.playlistId || '');
    const isImported = Boolean(
      selectedPlaylist.isImported ||
      pid.startsWith('imported_') ||
      selectedPlaylist.author === 'Imported Playlist' ||
      selectedPlaylist.artist === 'Imported Playlist'
    );
    const title = selectedPlaylist.title || (pid === 'liked_songs' ? 'Liked Songs' : 'Untitled Playlist');
    const firstCover = selectedPlaylist.thumbnail || tracks?.[0]?.thumbnail || tracks?.[0]?.cover || '/default-cover.svg';
    const cleanCover = (!firstCover || firstCover === '/logo.svg') ? '/default-cover.svg' : firstCover;
    return {
      type: 'playlist',
      id: pid,
      name: title,
      title,
      isImported,
      author: selectedPlaylist.author || (selectedPlaylist.isArtist ? selectedPlaylist.title : (isImported ? 'Imported Playlist' : 'Playlist')),
      thumbnail: cleanCover,
      cover: cleanCover,
      count: tracks?.length || selectedPlaylist.count || 0,
      tracks: tracks || []
    };
  };

  const handlePlayPlaylistAll = () => {
    const listToPlay = sortedTracks.length > 0 ? sortedTracks : (selectedPlaylist?.tracks || []);
    if (listToPlay.length > 0) {
      const context = getSelectedPlaylistContext(listToPlay);
      playPlaylist(listToPlay, 0, context);
    }
  };

  const handlePlayTrackInPlaylist = (index) => {
    const listToPlay = sortedTracks.length > 0 ? sortedTracks : (selectedPlaylist?.tracks || []);
    if (listToPlay.length > 0) {
      const context = getSelectedPlaylistContext(listToPlay);
      playPlaylist(listToPlay, index, context);
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
      <div className="max-w-[1400px] mx-auto pb-32 px-4 sm:px-6 lg:px-8 mt-4 select-none">
        {/* Back Button Skeleton */}
        <button
          type="button"
          onClick={handleBack}
          aria-label="Go back"
          className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-full text-sm font-medium transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Playlist Header Skeleton */}
        <div className="flex flex-col md:flex-row items-center md:items-end text-center md:text-left gap-6 md:gap-8 mb-8">
          <div className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-xl mx-auto md:mx-0 bg-zinc-900 border border-white/10 shrink-0 shadow-[0_8px_30px_rgba(0,0,0,0.5)] skeleton-shimmer-card" />
          <div className="flex flex-col min-w-0 items-center md:items-start w-full">
            <div className="w-20 h-3.5 bg-zinc-800/80 rounded-full mb-2" />
            <div className="w-3/4 max-w-lg h-10 sm:h-14 md:h-16 bg-zinc-700/80 rounded-xl mb-3 skeleton-shimmer-card" />
            <div className="w-full max-w-md h-4 bg-zinc-800/60 rounded mb-2" />
            <div className="w-36 h-3.5 bg-zinc-800/40 rounded mb-6" />
            <div className="flex items-center gap-4">
              <div className="w-28 sm:w-32 h-11 sm:h-12 rounded-full bg-zinc-700/80 skeleton-shimmer-card" />
              <div className="w-24 sm:w-28 h-11 sm:h-12 rounded-full bg-zinc-800/60 border border-zinc-700/60 skeleton-shimmer-card" />
            </div>
          </div>
        </div>

        {/* Desktop Table Header Skeleton */}
        <div className="grid grid-cols-[36px_minmax(0,4fr)_minmax(0,2.5fr)_minmax(0,2fr)_70px_40px] gap-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-800/80 pb-3 mb-4 px-3 hidden md:grid">
          <span className="text-center">#</span>
          <span>Title</span>
          <span>Artist</span>
          <span>Album</span>
          <span className="text-right pr-3">Duration</span>
          <span></span>
        </div>

        {/* Track Rows Skeleton (matches exact grid on mobile and desktop) */}
        <div className="flex flex-col gap-1">
          {[...Array(8)].map((_, idx) => (
            <div
              key={idx}
              className="grid grid-cols-[auto_1fr_auto] md:grid-cols-[36px_minmax(0,4fr)_minmax(0,2.5fr)_minmax(0,2fr)_70px_40px] gap-3 md:gap-4 items-center p-2 md:p-3 rounded-lg border border-white/[0.02] bg-[#141416]/50 skeleton-shimmer-card"
            >
              {/* Index */}
              <div className="w-8 flex justify-center">
                <div className="w-4 h-3.5 bg-zinc-800/60 rounded" />
              </div>

              {/* Title & Artwork */}
              <div className="flex items-center gap-4 min-w-0 pr-4">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded shrink-0 bg-zinc-800 border border-white/5" />
                <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                  <div className="w-40 sm:w-56 h-4 bg-zinc-700/80 rounded" />
                  <div className="w-28 sm:w-36 h-3 bg-zinc-800/50 rounded md:hidden" />
                </div>
              </div>

              {/* Desktop Artist */}
              <div className="hidden md:flex min-w-0 pr-4">
                <div className="w-28 h-3.5 bg-zinc-800/70 rounded" />
              </div>

              {/* Desktop Album */}
              <div className="hidden md:flex min-w-0 pr-4">
                <div className="w-24 h-3.5 bg-zinc-800/50 rounded" />
              </div>

              {/* Duration */}
              <div className="hidden md:flex justify-end pr-3">
                <div className="w-10 h-3.5 bg-zinc-800/50 rounded" />
              </div>

              {/* Desktop Action */}
              <div className="hidden md:flex justify-center">
                <div className="w-5 h-5 rounded-full bg-zinc-800/40" />
              </div>

              {/* Mobile Right Duration */}
              <div className="flex md:hidden items-center justify-end">
                <div className="w-10 h-3.5 bg-zinc-800/50 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (selectedPlaylist) {
    return (
      <div className="w-full max-w-[1400px] mx-auto pb-32 px-2 sm:px-6 lg:px-8 mt-2 sm:mt-4 select-none">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Go back"
          className="inline-flex items-center gap-2 mb-4 sm:mb-6 px-3.5 py-1.5 sm:px-4 sm:py-2 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-full text-xs sm:text-sm font-medium transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Back
        </button>

        {/* Playlist Header */}
        <div className="flex flex-col md:flex-row items-center md:items-end text-center md:text-left gap-5 sm:gap-6 md:gap-8 mb-6 sm:mb-8">
          {selectedPlaylist.isLikedPlaylist ? (
            <div className="w-40 h-40 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-2xl bg-gradient-to-br from-[#450af5] to-[#c4efd9] flex items-center justify-center p-8 shrink-0 shadow-[0_12px_35px_rgba(69,10,245,0.35)] relative overflow-hidden group select-none mx-auto md:mx-0">
              <Heart className="w-16 h-16 sm:w-24 sm:h-24 md:w-28 md:h-28 text-white fill-current drop-shadow-md group-hover:scale-105 transition-transform duration-500" />
            </div>
          ) : (
            <img
              src={(!selectedPlaylist.thumbnail || selectedPlaylist.thumbnail === '/logo.svg') ? '/default-cover.svg' : selectedPlaylist.thumbnail}
              alt={selectedPlaylist.title}
              className={`shrink-0 shadow-[0_8px_30px_rgba(0,0,0,0.5)] mx-auto md:mx-0 bg-black border border-white/10 ${selectedPlaylist.isArtist ? 'w-40 h-40 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-full object-cover' : 'w-40 h-40 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-xl object-cover'}`}
              onError={(e) => {
                e.target.src = '/default-cover.svg';
              }}
            />
          )}
          <div className="flex flex-col min-w-0 items-center md:items-start w-full">
            <span className="flex items-center gap-2 text-[11px] sm:text-xs uppercase font-bold text-zinc-400 tracking-widest mb-1.5">
              {selectedPlaylist.isArtist && selectedPlaylist.isVerified && (
                <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 fill-current" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              )}
              {selectedPlaylist.isArtist ? (selectedPlaylist.isVerified ? 'Verified Artist' : 'Artist') : 'Playlist'}
            </span>
            <h2 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white mb-2 sm:mb-3 tracking-tight leading-tight break-words max-w-full">
              {(() => {
                try {
                  return decodeURIComponent(selectedPlaylist.title || '').replace(/%20/g, ' ');
                } catch (e) {
                  return (selectedPlaylist.title || '').replace(/%20/g, ' ');
                }
              })()}
            </h2>
            
            {selectedPlaylist.isArtist && selectedPlaylist.followerCount ? (
              <p className="text-sm sm:text-base text-zinc-300 mb-4 sm:mb-6 font-medium">
                {Number(selectedPlaylist.followerCount).toLocaleString()} monthly listeners
              </p>
            ) : (
              <>
                <p className="text-xs sm:text-sm md:text-base text-zinc-300 mb-2 max-w-2xl font-medium px-1 md:px-0 break-words">
                  {(() => {
                    try {
                      return decodeURIComponent(selectedPlaylist.description || '').replace(/%20/g, ' ');
                    } catch (e) {
                      return (selectedPlaylist.description || '').replace(/%20/g, ' ');
                    }
                  })() || 'Relax • Unwind • Repeat'}
                </p>
                <p className="text-xs sm:text-sm text-zinc-400 mb-4 sm:mb-6 font-medium flex items-center justify-center md:justify-start gap-2 flex-wrap">
                  <span>{selectedPlaylist.tracks ? selectedPlaylist.tracks.length : 0} songs</span>
                  <span className="w-1 h-1 rounded-full bg-zinc-600"></span>
                  <span>{Math.floor((selectedPlaylist.tracks?.length || 0) * 3.5 / 60)}h {Math.floor(((selectedPlaylist.tracks?.length || 0) * 3.5) % 60)}m</span>
                </p>
              </>
            )}

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 sm:gap-4 w-full">
              <button
                type="button"
                onClick={handlePlayPlaylistAll}
                className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-2.5 sm:py-3 bg-white hover:bg-zinc-200 text-black font-bold text-xs sm:text-sm rounded-full transition hover:scale-105 active:scale-95 cursor-pointer shadow-md shrink-0"
              >
                <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current translate-x-[1px]" /> Play
              </button>

              {isSelectedUserPlaylist ? (
                <button
                  type="button"
                  onClick={handleEditCurrentPlaylist}
                  className="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-white font-medium text-xs sm:text-sm rounded-full transition cursor-pointer hover:scale-105 active:scale-95 shadow-sm shrink-0"
                >
                  <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-400" />
                  <span>Edit Playlist</span>
                </button>
              ) : !selectedPlaylist.isLikedPlaylist && (
                <button
                  type="button"
                  onClick={() => handleToggleSave()}
                  className={`inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-transparent border text-white font-bold text-xs sm:text-sm rounded-full transition cursor-pointer min-w-[100px] sm:min-w-[120px] shrink-0 ${
                    isSaved
                      ? 'border-white/40 hover:border-zinc-400 hover:text-zinc-200 group/savebtn'
                      : 'border-zinc-600 hover:border-zinc-400'
                  }`}
                >
                  {selectedPlaylist.isArtist ? (isSaved ? 'Following' : '+ Follow') : (
                    isSaved ? (
                      <>
                        <Check className="w-4 h-4 text-white group-hover/savebtn:hidden" />
                        <span className="text-zinc-200 group-hover/savebtn:hidden">Saved</span>
                        <span className="hidden group-hover/savebtn:inline">Remove</span>
                      </>
                    ) : (
                      <><span className="text-lg leading-none">+</span> Save</>
                    )
                  )}
                </button>
              )}

              {/* Share Playlist Button */}
              {!selectedPlaylist.isLikedPlaylist && (
                <button
                  type="button"
                  onClick={handleShareCurrentPlaylist}
                  title="Share Playlist"
                  aria-label="Share Playlist"
                  className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 transition cursor-pointer hover:scale-105 active:scale-95 shrink-0"
                >
                  <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}

              {/* Playlist Header More Menu */}
              {!selectedPlaylist.isLikedPlaylist && (
                <div className="relative shrink-0" ref={headerMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
                    aria-label="More playlist options"
                    className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 transition cursor-pointer hover:scale-105 active:scale-95"
                  >
                    <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>

                  {isHeaderMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl py-1.5 z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
                      {isSelectedUserPlaylist && (
                        <>
                          <button
                            type="button"
                            onClick={handleEditCurrentPlaylist}
                            className="w-full px-4 py-2.5 text-xs text-left text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2.5 transition cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4 text-zinc-400" />
                            <span>Edit Details</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsHeaderMenuOpen(false);
                              const next = !isReorderMode;
                              setIsReorderMode(next);
                              if (next && sortBy !== 'recent') {
                                setSortBy('recent');
                              }
                            }}
                            className="w-full px-4 py-2.5 text-xs text-left text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2.5 transition cursor-pointer"
                          >
                            <GripVertical className="w-4 h-4 text-zinc-400" />
                            <span>{isReorderMode ? 'Done Reordering' : 'Reorder Tracks'}</span>
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={handleShareCurrentPlaylist}
                        className="w-full px-4 py-2.5 text-xs text-left text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2.5 transition cursor-pointer"
                      >
                        <Share2 className="w-4 h-4 text-zinc-400" />
                        <span>Share Playlist</span>
                      </button>
                      {isSelectedUserPlaylist && (
                        <>
                          <div className="my-1 border-t border-zinc-800" />
                          <button
                            type="button"
                            onClick={handleDeleteCurrentPlaylist}
                            className="w-full px-4 py-2.5 text-xs text-left text-red-400 hover:text-red-300 hover:bg-zinc-800 flex items-center gap-2.5 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Delete Playlist</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>


        <div className="flex flex-col lg:flex-row gap-6 md:gap-10">
          {/* Main Tracklist */}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-4 sm:mb-6 gap-2 flex-wrap">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight shrink-0">
                  {selectedPlaylist.isArtist ? 'Popular Tracks' : 'Tracks'}
                </h2>
                {isReorderMode && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white text-black shrink-0">
                    Reordering
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {/* Locate Playing Song Button */}
                {isPlayingInThisPlaylist && (
                  <button
                    type="button"
                    onClick={handleScrollToPlayingTrack}
                    title={`Scroll to playing song: ${sortedTracks[playingTrackIndex]?.title || ''} (#${playingTrackIndex + 1})`}
                    aria-label="Scroll to currently playing song"
                    className="text-xs sm:text-sm font-semibold rounded-full px-3 py-1.5 sm:px-3.5 sm:py-1.5 flex items-center gap-1.5 transition cursor-pointer border shadow-sm text-zinc-300 hover:text-white bg-zinc-900/90 hover:bg-zinc-800 border-zinc-700/60 hover:scale-105 active:scale-95"
                  >
                    <LocateFixed className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-colors" />
                    <span>Locate</span>
                  </button>
                )}

                <div className="relative z-20 shrink-0" ref={sortDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                  className="text-xs sm:text-sm font-normal text-zinc-300 hover:text-white bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/60 rounded-full px-3 py-1.5 sm:px-3.5 sm:py-1.5 flex items-center gap-1.5 sm:gap-2 transition cursor-pointer shadow-sm hover:scale-105 active:scale-95"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate max-w-[120px] sm:max-w-none">
                    {
                      sortBy === 'recent' ? 'Newest First' :
                      sortBy === 'recent-reverse' ? 'Oldest First' :
                      sortBy === 'title-asc' ? 'Title (A-Z)' :
                      sortBy === 'title-desc' ? 'Title (Z-A)' :
                      sortBy === 'duration-asc' ? 'Shortest' :
                      sortBy === 'duration-desc' ? 'Longest' : 'Newest First'
                    }
                  </span>
                  <span className="text-[10px] text-zinc-400 shrink-0">▼</span>
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
                        {sortBy === opt.id && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

            <div className="grid grid-cols-[auto_minmax(0,4fr)_minmax(0,2.5fr)_minmax(0,2fr)_70px_40px] gap-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800/80 pb-3 mb-4 px-3 hidden md:grid">
              <span className="w-12 text-center">#</span>
              <span>Title</span>
              <span>Artist</span>
              <span>Album</span>
              <span className="text-right pr-3">Duration</span>
              <span></span>
            </div>

            {isReorderMode && isSelectedUserPlaylist && (
              <div className="mb-3.5 p-3 rounded-2xl bg-zinc-900/95 border border-zinc-700/80 flex items-center justify-between gap-3 text-xs text-zinc-300 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                    <GripVertical className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="truncate">Hold & drag handle <strong className="text-white">⠿</strong> or tap arrows to reorder</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsReorderMode(false)}
                  className="px-3.5 py-1.5 rounded-full bg-white text-black font-bold text-xs hover:bg-zinc-200 transition shrink-0 cursor-pointer shadow"
                >
                  Done
                </button>
              </div>
            )}

            <div className="flex flex-col gap-1">
              {sortedTracks && sortedTracks.length > 0 ? (
                sortedTracks.map((track, idx) => {
                  const isCurrentTrack = idx === playingTrackIndex;
                  return (
                  <article
                    key={track.videoId || idx}
                    data-track-index={idx}
                    ref={idx === sortedTracks.length - 1 ? lastTrackElementRef : null}
                    draggable={isSelectedUserPlaylist && (isReorderMode || sortBy === 'recent')}
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                    className={`grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_minmax(0,4fr)_minmax(0,2.5fr)_minmax(0,2fr)_70px_40px] gap-2.5 sm:gap-4 items-center p-1.5 sm:p-2.5 md:p-3 rounded-xl transition group cursor-pointer ${
                      isCurrentTrack
                        ? 'bg-white/[0.08] border border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.06)] playing-card-active'
                        : 'hover:bg-zinc-800/50 border border-transparent'
                    } ${
                      dragOverIndex === idx || (touchOverIndex === idx && touchDragIndex !== null && touchDragIndex !== idx)
                        ? 'border-t-2 border-white bg-zinc-800/80'
                        : ''
                    } ${
                      touchDragIndex === idx ? 'opacity-40 scale-[0.98] bg-zinc-800/80 ring-1 ring-white/20' : ''
                    }`}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpenTrackMenuIndex(openTrackMenuIndex === idx ? null : idx);
                    }}
                    onTouchStart={(e) => handleTrackTouchStart(idx, e)}
                    onTouchMove={handleTrackTouchMove}
                    onTouchEnd={handleTrackTouchEnd}
                    onTouchCancel={handleTrackTouchEnd}
                    onClick={() => {
                      if (isReorderMode) return;
                      if (isLongPressActiveRef.current) {
                        isLongPressActiveRef.current = false;
                        return;
                      }
                      if (isCurrentTrack) {
                        playPause();
                      } else {
                        handlePlayTrackInPlaylist(idx);
                      }
                    }}
                  >
                    {/* Index / Play / Reorder Handle */}
                    <div className="flex items-center justify-center shrink-0 min-w-[24px]" onClick={(e) => isSelectedUserPlaylist && e.stopPropagation()}>
                      {isReorderMode && isSelectedUserPlaylist ? (
                        <div className="flex items-center gap-1 sm:gap-1.5">
                          {/* Touch/mouse drag handle */}
                          <div
                            className="touch-none select-none p-1.5 text-zinc-400 hover:text-white active:text-white cursor-grab active:cursor-grabbing flex items-center justify-center rounded-lg hover:bg-zinc-800 active:bg-zinc-700 transition"
                            onTouchStart={(e) => handleTouchStart(e, idx)}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                            onTouchCancel={handleTouchEnd}
                            title="Drag to reorder"
                          >
                            <GripVertical className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-300" />
                          </div>

                          {/* Quick Up/Down arrows */}
                          <div className="flex flex-col items-center justify-center -space-y-0.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveSong(idx, 'up')}
                              className="p-1 text-zinc-400 hover:text-white disabled:opacity-20 cursor-pointer disabled:cursor-default transition hover:scale-110 active:scale-95"
                              title="Move up"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === sortedTracks.length - 1}
                              onClick={() => handleMoveSong(idx, 'down')}
                              className="p-1 text-zinc-400 hover:text-white disabled:opacity-20 cursor-pointer disabled:cursor-default transition hover:scale-110 active:scale-95"
                              title="Move down"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : isSelectedUserPlaylist && sortBy === 'recent' ? (
                        <>
                          {/* Mobile: clean track number */}
                          <span className="text-xs font-semibold text-zinc-500 sm:hidden">
                            {idx + 1}
                          </span>

                          {/* Tablet & Desktop: vertical stacked reorder arrows */}
                          <div className="hidden sm:flex flex-col items-center justify-center -space-y-0.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveSong(idx, 'up')}
                              className="p-1 text-zinc-400 hover:text-white disabled:opacity-20 cursor-pointer disabled:cursor-default transition hover:scale-110 active:scale-95"
                              title="Move up"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === sortedTracks.length - 1}
                              onClick={() => handleMoveSong(idx, 'down')}
                              className="p-1 text-zinc-400 hover:text-white disabled:opacity-20 cursor-pointer disabled:cursor-default transition hover:scale-110 active:scale-95"
                              title="Move down"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className={`text-xs sm:text-sm font-medium ${isCurrentTrack ? 'text-white font-bold' : 'text-zinc-500'} group-hover:hidden`}>
                            {idx + 1}
                          </span>
                          <span className="hidden group-hover:flex justify-center items-center">
                            {isCurrentTrack && isPlaying ? (
                              <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white fill-current" />
                            ) : (
                              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white fill-current" />
                            )}
                          </span>
                        </>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 pr-1">
                      <div className="relative shrink-0 w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12">
                        <img
                          src={(!track.thumbnail || track.thumbnail === '/logo.svg') ? '/default-cover.svg' : track.thumbnail}
                          alt={track.title}
                          className={`w-full h-full rounded-lg object-cover bg-black border shadow-sm ${
                            isCurrentTrack ? 'border-white/40 ring-1 ring-white/30' : 'border-white/5'
                          }`}
                          onError={(e) => {
                            e.target.src = '/default-cover.svg';
                          }}
                          loading="lazy"
                        />
                        {isCurrentTrack && (
                          <div className="absolute inset-0 bg-black/40 backdrop-blur-[0.5px] flex items-center justify-center gap-[2px] rounded-lg">
                            <span className={`w-[2px] bg-white rounded-full music-equalizer-bar-1 ${!isPlaying ? 'music-equalizer-paused h-1.5' : ''}`} />
                            <span className={`w-[2px] bg-white rounded-full music-equalizer-bar-2 ${!isPlaying ? 'music-equalizer-paused h-3' : ''}`} />
                            <span className={`w-[2px] bg-white rounded-full music-equalizer-bar-3 ${!isPlaying ? 'music-equalizer-paused h-2' : ''}`} />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <h3 className={`text-xs sm:text-sm md:text-base font-semibold truncate ${
                            isCurrentTrack ? 'text-white font-bold' : 'text-zinc-100 group-hover:text-white'
                          }`}>
                            {track.title}
                          </h3>
                          {Boolean(track.explicit) && (
                            <span className="inline-flex px-1 rounded bg-zinc-200 text-black text-[9px] font-bold shrink-0">E</span>
                          )}
                          {isCurrentTrack && (
                            <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-wider rounded-full bg-white/20 text-white shrink-0 hidden sm:inline-flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-white animate-ping" />
                              Playing
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] sm:text-xs md:text-sm text-zinc-400 truncate md:hidden mt-0.5">
                          {track.artist}
                        </p>
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

                    {/* Track Menu Dropdown */}
                    <div className="track-menu-container relative flex items-center justify-end">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenTrackMenuIndex(openTrackMenuIndex === idx ? null : idx);
                        }}
                        aria-label="Track options"
                        className="p-1.5 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-700/50 transition cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openTrackMenuIndex === idx && (
                        <div
                          className="absolute right-0 top-full mt-1 w-52 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl py-1.5 z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setOpenTrackMenuIndex(null);
                              window.dispatchEvent(new CustomEvent('playloop-open-add-to-playlist', { detail: track }));
                            }}
                            className="w-full px-3.5 py-2 text-xs text-left text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2.5 transition cursor-pointer"
                          >
                            <FolderPlus className="w-3.5 h-3.5 text-zinc-400" />
                            <span>Add to Playlist</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenTrackMenuIndex(null);
                              addToUpNext(track);
                            }}
                            className="w-full px-3.5 py-2 text-xs text-left text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2.5 transition cursor-pointer"
                          >
                            <ListStart className="w-3.5 h-3.5 text-zinc-400" />
                            <span>Play Next</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenTrackMenuIndex(null);
                              addToQueue(track);
                            }}
                            className="w-full px-3.5 py-2 text-xs text-left text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2.5 transition cursor-pointer"
                          >
                            <ListMusic className="w-3.5 h-3.5 text-zinc-400" />
                            <span>Add to Queue</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenTrackMenuIndex(null);
                              window.dispatchEvent(new CustomEvent('playloop-open-share', { detail: track }));
                            }}
                            className="w-full px-3.5 py-2 text-xs text-left text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2.5 transition cursor-pointer"
                          >
                            <Share2 className="w-3.5 h-3.5 text-zinc-400" />
                            <span>Share Track</span>
                          </button>

                          {isSelectedUserPlaylist && (
                            <>
                              <div className="my-1 border-t border-zinc-800" />
                              {idx > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenTrackMenuIndex(null);
                                    handleMoveSong(idx, 'up');
                                  }}
                                  className="w-full px-3.5 py-2 text-xs text-left text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2.5 transition cursor-pointer"
                                >
                                  <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
                                  <span>Move Up</span>
                                </button>
                              )}
                              {idx < sortedTracks.length - 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenTrackMenuIndex(null);
                                    handleMoveSong(idx, 'down');
                                  }}
                                  className="w-full px-3.5 py-2 text-xs text-left text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2.5 transition cursor-pointer"
                                >
                                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                                  <span>Move Down</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  setOpenTrackMenuIndex(null);
                                  handleRemoveTrackFromPlaylist(e, track.videoId || track.id);
                                }}
                                className="w-full px-3.5 py-2 text-xs text-left text-red-400 hover:text-red-300 hover:bg-zinc-800 flex items-center gap-2.5 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove from Playlist</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })
            ) : (
                <div className="text-center py-20 px-4">
                  <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 mx-auto flex items-center justify-center text-zinc-400 mb-4">
                    <Music className="w-8 h-8" />
                  </div>
                  <h3 className="text-white text-lg font-bold mb-1">
                    {selectedPlaylist.isLikedPlaylist 
                      ? "You haven't liked any songs yet" 
                      : (isSelectedUserPlaylist ? "This playlist is empty" : "No tracks found in this playlist")}
                  </h3>
                  <p className="text-zinc-400 text-xs sm:text-sm max-w-md mx-auto mb-6">
                    {selectedPlaylist.isLikedPlaylist 
                      ? "Tap the heart icon on any song or player to add it to your Liked Songs." 
                      : (isSelectedUserPlaylist 
                          ? "Find your favorite songs using Search or Home, tap the ••• menu or player button to add them here." 
                          : "Try exploring other playlists or tracks.")}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (setCurrentView) setCurrentView('search');
                      window.location.hash = '#/search';
                    }}
                    className="px-6 py-2.5 bg-white text-black font-bold text-xs sm:text-sm rounded-full hover:bg-zinc-200 transition cursor-pointer shadow-md hover:scale-105 active:scale-95"
                  >
                    Explore Songs
                  </button>
                </div>
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
    { title: 'Browse Songs', subtitle: 'Discover new music', icon: <Music className="w-5 h-5 xl:w-6 xl:h-6 transition-colors" />, path: '#/search' },
    { title: 'Liked Songs', subtitle: 'Your favorites', icon: <Heart className="w-5 h-5 xl:w-6 xl:h-6 transition-colors fill-current" />, action: handleOpenLikedSongs },
    isAppDownloaded
      ? { title: 'Settings', subtitle: 'App preferences', icon: <Settings className="w-5 h-5 xl:w-6 xl:h-6 transition-colors" />, path: '#/settings' }
      : { title: 'Download App', subtitle: 'Install for offline', icon: <Download className="w-5 h-5 xl:w-6 xl:h-6 transition-colors" />, path: '#/download' },
    { title: 'Your Library', subtitle: 'All your music', icon: <Library className="w-5 h-5 xl:w-6 xl:h-6 transition-colors" />, path: '#/library' }
  ];

  return (
    <div className="max-w-[1400px] mx-auto pb-6 sm:pb-8 px-3.5 sm:px-6 lg:px-8 mt-2 sm:mt-6 select-none">

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

      {/* Mobile-Only Hero Story Card (Real or Skeleton) */}
      {(activeCategoryFilter === 'all' || activeCategoryFilter === 'playlists') && (
        loadingPlaylists ? (
          <div className="sm:hidden relative overflow-hidden rounded-2xl p-4 sm:p-5 mb-6 bg-[#141416] border border-zinc-800/80 shadow-2xl flex items-center justify-between gap-4 skeleton-shimmer-card">
            <div className="flex flex-col min-w-0 flex-1 justify-center z-10">
              <div className="w-16 h-3 bg-zinc-800/80 rounded-full mb-2" />
              <div className="w-4/5 h-5 bg-zinc-700/80 rounded mb-1.5" />
              <div className="w-3/5 h-3 bg-zinc-800/60 rounded mb-3.5" />
              <div className="flex items-center gap-2">
                <div className="w-20 h-7 rounded-full bg-zinc-700/80" />
                <div className="w-18 h-7 rounded-full bg-zinc-800/60 border border-white/10" />
              </div>
            </div>
            <div className="relative w-28 h-28 shrink-0 rounded-xl bg-zinc-800/80 border border-white/10" />
          </div>
        ) : (
          featuredPlaylist && (
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
                        ? 'bg-zinc-800 text-white border border-white/30'
                        : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                    }`}
                    onClick={(e) => { e.stopPropagation(); handleToggleSave(featuredPlaylist); }}
                  >
                    {isPlaylistSaved(featuredPlaylist.playlistId) ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" /> Saved
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
                  fetchPriority="high"
                  decoding="async"
                  onError={(e) => { e.target.src = '/default-cover.svg'; }}
                />
              </div>
            </div>
          )
        )
      )}

      {/* Desktop Featured Section (Real or Skeleton) */}
      {(activeCategoryFilter === 'all' || activeCategoryFilter === 'playlists') && (
        loadingPlaylists ? (
          <div className="hidden sm:flex flex-col xl:grid xl:grid-cols-3 gap-6 mb-12">
            {/* Hero Featured Playlist Skeleton */}
            <div className="xl:col-span-2 relative h-[340px] sm:h-[450px] rounded-2xl bg-[#141416] border border-white/5 p-6 sm:p-8 md:p-10 flex flex-col justify-end overflow-hidden skeleton-shimmer-card">
              <div className="w-28 h-3.5 bg-zinc-800/80 rounded mb-3" />
              <div className="w-3/5 max-w-lg h-9 sm:h-12 bg-zinc-700/80 rounded-lg mb-3" />
              <div className="w-4/5 max-w-md h-4 bg-zinc-800/70 rounded mb-2" />
              <div className="w-1/2 max-w-sm h-4 bg-zinc-800/50 rounded mb-6 sm:mb-8" />
              <div className="flex items-center gap-4">
                <div className="w-32 h-11 sm:h-12 rounded-full bg-zinc-700/80" />
                <div className="w-28 h-11 sm:h-12 rounded-full bg-zinc-800/60 border border-white/10" />
              </div>
            </div>

            {/* Quick Access Desktop Skeleton */}
            <div className="grid grid-cols-2 xl:flex xl:flex-col gap-3 xl:gap-4 xl:justify-between h-auto xl:h-[450px]">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex-1 bg-white/[0.02] rounded-2xl p-3 xl:px-5 xl:py-4 flex items-center gap-4 border border-white/5 skeleton-shimmer-card min-h-[70px] xl:min-h-[90px]">
                  <div className="w-6 h-6 rounded bg-zinc-800/80 shrink-0" />
                  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <div className="w-24 h-3.5 xl:h-4 bg-zinc-700/80 rounded" />
                    <div className="w-16 h-2.5 xl:h-3 bg-zinc-800/60 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
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
                  fetchPriority="high"
                  decoding="async"
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
                          ? 'bg-zinc-800 text-white border border-white/40'
                          : 'bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/10'
                      }`}
                      onClick={(e) => { e.stopPropagation(); handleToggleSave(featuredPlaylist); }}
                    >
                      {isPlaylistSaved(featuredPlaylist.playlistId) ? (
                        <>
                          <Check className="w-4 h-4 text-white" /> Saved
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
                  className="flex-1 bg-white/[0.03] hover:bg-white/[0.08] active:bg-white/[0.12] rounded-2xl p-3 xl:px-5 xl:py-4 flex items-center gap-4 cursor-pointer transition-all duration-200 border border-white/10 hover:border-white/20 shadow-sm hover:shadow-lg group backdrop-blur-sm"
                >
                  <div className="text-zinc-400 group-hover:text-white transition-all duration-200 shrink-0 group-hover:scale-110">
                    {item.icon}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <h3 className="text-white font-bold text-xs xl:text-sm tracking-tight truncate group-hover:translate-x-0.5 transition-transform">{item.title}</h3>
                    <p className="text-zinc-400 group-hover:text-zinc-300 text-[10px] xl:text-xs truncate mt-0.5 transition-colors">{item.subtitle}</p>
                  </div>
                  <div className="hidden xl:flex w-8 h-8 rounded-full items-center justify-center text-zinc-600 group-hover:text-white transition-colors mr-1">
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* Quick Access Grid Mobile (Real or Skeleton) */}
      {(activeCategoryFilter === 'all' || activeCategoryFilter === 'playlists') && (
        loadingPlaylists ? (
          <div className="sm:hidden grid grid-cols-2 gap-2.5 mb-8">
            {[...Array(4)].map((_, index) => (
              <div 
                key={index}
                className="bg-white/[0.03] border border-white/5 rounded-xl p-3 flex items-center justify-center gap-2.5 h-14 skeleton-shimmer-card"
              >
                <div className="w-5 h-5 rounded-md bg-zinc-800/80 shrink-0" />
                <div className="w-20 h-3.5 bg-zinc-800/70 rounded" />
              </div>
            ))}
          </div>
        ) : (
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
                className="bg-white/[0.04] active:bg-white/[0.1] rounded-xl px-3 py-2.5 flex items-center justify-center gap-2.5 cursor-pointer transition-all border border-white/10 shadow-sm group h-14 text-center"
              >
                <div className="text-zinc-300 group-active:scale-95 transition-transform shrink-0 flex items-center justify-center">
                  {item.icon}
                </div>
                <div className="flex items-center justify-center min-w-0">
                  <h3 className="text-white font-bold text-xs truncate leading-tight">{item.title}</h3>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Recently Played Row */}
      {recentlyPlayed && recentlyPlayed.length > 0 && (activeCategoryFilter === 'all' || activeCategoryFilter === 'songs') && (
        <div className="mb-10 sm:mb-12">
          <Carousel
            title="Recently Played"
            items={recentlyPlayed}
            onItemClick={(track) => selectAndPlayTrack(track.videoId, track.title, track.artist, track.thumbnail || track.cover || track.artwork || track.albumArt)}
            renderSubtitle={(track) => track.artist}
            keyExtractor={(track, index) => `${track.videoId}-${index}`}
            cardType="square"
          />
        </div>
      )}

      {/* Speed Dial Section (YouTube Music Style 3-Row Grid from User's Selected Languages) */}
      {(activeCategoryFilter === 'all' || activeCategoryFilter === 'songs') && (
        <SpeedDialSection
          songs={speedDialSongs}
          isLoading={Object.values(loadingLanguages).some(Boolean) && speedDialSongs.length === 0}
          onPlayTrack={handlePlaySpeedDialTrack}
          onPlayAll={handlePlayAllSpeedDial}
          currentPlayingTrackId={pendingTrack?.videoId}
        />
      )}

      {/* 1st Language Showcase (Top Selected Language) */}
      {(activeCategoryFilter === 'all' || activeCategoryFilter === 'songs') && showcaseLanguages[0] && (
        renderLanguageSection(showcaseLanguages[0])
      )}

      {/* Made For You Row (Wide Cards - Real or Skeleton) */}
      {(loadingPlaylists || madeForYouPlaylists.length > 0) && (activeCategoryFilter === 'all' || activeCategoryFilter === 'playlists') && (
        <div className="mb-10 sm:mb-12">
          <Carousel
            title="Made For You"
            items={loadingPlaylists ? [] : madeForYouPlaylists}
            isLoading={loadingPlaylists}
            onItemClick={handlePlaylistClick}
            renderSubtitle={(item) => item.author}
            keyExtractor={(item, index) => `${item.playlistId}-${index}`}
            cardType="wide"
            onEndReached={loadMoreMadeForYou}
            isLoadingMore={loadingMoreMadeForYou}
          />
        </div>
      )}

      {/* 2nd Language Showcase (Second Selected Language, if selected) */}
      {(activeCategoryFilter === 'all' || activeCategoryFilter === 'songs') && showcaseLanguages[1] && (
        renderLanguageSection(showcaseLanguages[1])
      )}

      {/* Popular Artists Row (Real or Skeleton) */}
      {(popularArtists.length > 0 || loadingPlaylists) && (activeCategoryFilter === 'all' || activeCategoryFilter === 'artists') && (
        <div className="mb-10 sm:mb-12">
          <Carousel
            title="Popular Artists"
            items={popularArtists}
            isLoading={popularArtists.length === 0}
            onItemClick={handlePlaylistClick}
            renderSubtitle={() => "Artist"}
            keyExtractor={(item) => item.playlistId}
            cardType="circle"
            onEndReached={loadMoreArtists}
            isLoadingMore={loadingMoreArtists}
          />
        </div>
      )}

      {/* 3rd Language Showcase (Third Selected Language, if selected - maximum 3) */}
      {(activeCategoryFilter === 'all' || activeCategoryFilter === 'songs') && showcaseLanguages[2] && (
        renderLanguageSection(showcaseLanguages[2])
      )}

      {/* When filtering specifically by Artists: show a dedicated responsive grid */}
      {activeCategoryFilter === 'artists' && (
        <div className="mb-14 sm:mb-16">
          <div className="flex items-center justify-between mb-5 pl-0.5">
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white">All Artists</h3>
            <span className="text-xs sm:text-sm text-zinc-400 font-medium">
              {popularArtists.length} {popularArtists.length === 1 ? 'artist' : 'artists'} loaded
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
            {popularArtists.length === 0 ? (
              [...Array(12)].map((_, index) => (
                <div
                  key={`skeleton-artist-grid-${index}`}
                  className="flex flex-col items-center p-3.5 rounded-xl bg-[#141416] border border-white/5"
                >
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-zinc-800/90 border border-white/5 mb-3 overflow-hidden skeleton-shimmer-card shadow-lg" />
                  <div className="w-3/4 h-3.5 sm:h-4 bg-zinc-700/80 rounded mb-1.5" />
                  <div className="w-1/2 h-2.5 sm:h-3 bg-zinc-800/50 rounded" />
                </div>
              ))
            ) : (
              popularArtists.map((artist) => (
                <div
                  key={`grid-${artist.playlistId}`}
                  onClick={() => handlePlaylistClick(artist)}
                  className="group flex flex-col items-center p-3 sm:p-4 rounded-xl bg-[#141416] hover:bg-[#202024] active:bg-[#25252a] cursor-pointer transition-colors duration-300 border border-white/5 text-center"
                >
                  <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full shadow-xl overflow-hidden mb-3 bg-black border border-white/5">
                    <img
                      src={(!artist.thumbnail || artist.thumbnail === '/logo.svg') ? '/default-cover.svg' : artist.thumbnail}
                      alt={artist.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        e.target.src = '/default-cover.svg';
                      }}
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white flex items-center justify-center shadow-xl hover:scale-105 text-black">
                        <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current translate-x-[1.5px]" />
                      </div>
                    </div>
                  </div>

                  <h4 className="font-bold text-white text-xs sm:text-[15px] truncate w-full mb-1 tracking-tight">
                    {artist.title}
                  </h4>
                  <p className="font-medium text-zinc-400 text-[11px] sm:text-[13px] truncate w-full">
                    {artist.followers || 'Artist'}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={loadMoreArtists}
              disabled={loadingMoreArtists}
              className="px-6 py-2.5 rounded-full border border-zinc-700/80 bg-zinc-900/80 hover:bg-zinc-800 text-xs sm:text-sm font-bold text-white transition-all shadow-sm hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
            >
              {loadingMoreArtists ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-zinc-400 border-t-white animate-spin" />
                  Loading More Artists...
                </>
              ) : 'Show More Artists'}
            </button>
          </div>
        </div>
      )}

      {/* Popular Albums - Immersive Grid Redesign (Real or Skeleton) */}
      {(loadingPlaylists || popularAlbumsPlaylists.length > 0) && (activeCategoryFilter === 'all' || activeCategoryFilter === 'playlists') && (
        <div className="mb-14 sm:mb-16 mt-4 sm:mt-8">
          <div className="flex items-center justify-between mb-5 pl-0.5">
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Trending & Popular</h3>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
            {loadingPlaylists ? (
              [...Array(batchSize)].map((_, index) => (
                <div
                  key={`skeleton-popular-${index}`}
                  className="flex flex-col p-2.5 sm:p-3.5 rounded-xl bg-[#141416] border border-white/5"
                >
                  <div className="w-full aspect-square rounded-lg bg-zinc-800/90 border border-white/5 mb-3 overflow-hidden skeleton-shimmer-card shadow-lg" />
                  <div className="w-3/4 h-3.5 sm:h-4 bg-zinc-700/80 rounded mb-1.5" />
                  <div className="w-1/2 h-2.5 sm:h-3 bg-zinc-800/50 rounded" />
                </div>
              ))
            ) : (
              popularAlbumsPlaylists.slice(0, visiblePopularCount).map((item, index) => {
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
              })
            )}

            {loadingMorePopularAlbums && (
              [...Array(batchSize)].map((_, index) => (
                <div
                  key={`skeleton-more-${index}`}
                  className="flex flex-col p-2.5 sm:p-3.5 rounded-xl bg-[#141416] border border-white/5"
                >
                  <div className="w-full aspect-square rounded-lg bg-zinc-800/90 border border-white/5 mb-3 overflow-hidden skeleton-shimmer-card shadow-lg" />
                  <div className="w-3/4 h-3.5 sm:h-4 bg-zinc-700/80 rounded mb-1.5" />
                  <div className="w-1/2 h-2.5 sm:h-3 bg-zinc-800/50 rounded" />
                </div>
              ))
            )}
          </div>

          {!loadingPlaylists && (
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
          )}
        </div>
      )}

      {/* Footer */}
      <Footer setCurrentView={setCurrentView} />
    </div>
  );
}

