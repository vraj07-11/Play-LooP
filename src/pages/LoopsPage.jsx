import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Repeat,
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Heart, 
  Share2, 
  Check, 
  ChevronUp, 
  ChevronDown, 
  Music2, 
  Disc3,
  Radio,
  RotateCw,
  ListMusic,
  Compass,
  Mic2
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { fetchPopularSongs, getAudioUrl, saveLikedTrackApi } from '../services/api';
import { fetchSyncedLyrics } from '../services/lyrics';

const LOOP_DURATION = 30; // 30-second music loop preview

const GENRE_TAGS = [
  { id: 'all', label: 'All' },
  { id: 'hindi', label: 'Hindi' },
  { id: 'english', label: 'English' },
  { id: 'punjabi', label: 'Punjabi' },
  { id: 'telugu', label: 'Telugu' },
  { id: 'tamil', label: 'Tamil' },
  { id: 'gujarati', label: 'Gujarati' },
  { id: 'spanish', label: 'Spanish' },
  { id: 'marathi', label: 'Marathi' }
];

export default function LoopsPage({ setCurrentView, isActiveView = true }) {
  const { selectAndPlayTrack, isPlaying: isGlobalPlaying, playPause: toggleGlobalPlay } = usePlayer() || {};

  const [tracks, setTracks] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTag, setActiveTag] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [likedTrackIds, setLikedTrackIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('playloop_liked_tracks') || '[]');
    } catch {
      return [];
    }
  });
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [heartBurstPos, setHeartBurstPos] = useState({ x: 0, y: 0 });
  const [toastMessage, setToastMessage] = useState(null);
  const [requiresUserGesture, setRequiresUserGesture] = useState(false);
  const [lyricsState, setLyricsState] = useState({
    trackId: null,
    lyrics: null,
    loading: false
  });
  const [currentAudioTime, setCurrentAudioTime] = useState(0);

  const audioRef = useRef(null);
  const containerRef = useRef(null);
  const queueListRef = useRef(null);
  const lastTapRef = useRef(0);
  const toastTimeoutRef = useRef(null);
  const isFetchingMoreRef = useRef(false);
  const wheelLockRef = useRef(false);
  const lyricsCacheRef = useRef(new Map());

  const likedTrackIdsRef = useRef(likedTrackIds);
  useEffect(() => {
    likedTrackIdsRef.current = likedTrackIds;
  }, [likedTrackIds]);

  const [isPlayingFullSong, setIsPlayingFullSong] = useState(false);
  const isPlayingFullSongRef = useRef(false);
  const lastPlayedIndexRef = useRef(currentIndex);

  const isGlobalPlayingRef = useRef(isGlobalPlaying);
  useEffect(() => {
    isGlobalPlayingRef.current = isGlobalPlaying;
  }, [isGlobalPlaying]);

  useEffect(() => {
    const handlePlayerClosed = () => {
      isPlayingFullSongRef.current = false;
      setIsPlayingFullSong(false);
    };
    window.addEventListener('playloop-player-closed', handlePlayerClosed);
    return () => window.removeEventListener('playloop-player-closed', handlePlayerClosed);
  }, []);

  const currentIndexRef = useRef(currentIndex);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
    if (currentIndex !== lastPlayedIndexRef.current) {
      isPlayingFullSongRef.current = false;
      setIsPlayingFullSong(false);
      lastPlayedIndexRef.current = currentIndex;
    }
  }, [currentIndex]);

  const tracksRef = useRef(tracks);
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  const isMutedRef = useRef(isMuted);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const showToast = useCallback((msg, duration = 800) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, duration);
  }, []);

  // Sync liked tracks with local storage
  useEffect(() => {
    const handleLikedUpdate = () => {
      try {
        const liked = JSON.parse(localStorage.getItem('playloop_liked_tracks') || '[]');
        setLikedTrackIds(liked);
        likedTrackIdsRef.current = liked;
      } catch (e) {
        console.error(e);
      }
    };
    window.addEventListener('playloop-liked-songs-updated', handleLikedUpdate);
    return () => window.removeEventListener('playloop-liked-songs-updated', handleLikedUpdate);
  }, []);

  // Fetch loop tracks based on tag
  const loadLoopsByTag = useCallback(async (tag = 'all') => {
    setIsLoading(true);
    try {
      let languages = [];
      if (tag === 'all') {
        try {
          const stored = localStorage.getItem('preferred_languages') || localStorage.getItem('playloop_selected_languages');
          if (stored) languages = JSON.parse(stored);
        } catch (_) {}
      } else {
        languages = [tag];
      }

      const popular = await fetchPopularSongs(languages);
      if (Array.isArray(popular) && popular.length > 0) {
        const shuffled = [...popular].sort(() => 0.5 - Math.random());
        setTracks(shuffled);
        setCurrentIndex(0);
      } else {
        setTracks([]);
      }
    } catch (err) {
      console.error('Failed to load loop tracks:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLoopsByTag(activeTag);
  }, [activeTag, loadLoopsByTag]);

  // Load more loops continuously as user scrolls
  const loadMoreLoops = useCallback(async () => {
    if (isFetchingMoreRef.current) return;
    isFetchingMoreRef.current = true;
    try {
      let languages = [];
      if (activeTag === 'all') {
        try {
          const stored = localStorage.getItem('preferred_languages') || localStorage.getItem('playloop_selected_languages');
          if (stored) languages = JSON.parse(stored);
        } catch (_) {}
      } else {
        languages = [activeTag];
      }
      
      const more = await fetchPopularSongs(languages);
      if (Array.isArray(more) && more.length > 0) {
        setTracks(prev => {
          const existingIds = new Set(prev.map(t => t.videoId));
          const uniqueNew = more.filter(t => t.videoId && !existingIds.has(t.videoId));
          return [...prev, ...uniqueNew];
        });
      }
    } catch (e) {
      console.warn('Could not load more loops:', e);
    } finally {
      isFetchingMoreRef.current = false;
    }
  }, [activeTag]);

  const currentTrack = tracks[currentIndex] || null;
  const activeTrackId = currentTrack?.videoId || null;

  // Immediate synchronous cache check to avoid flash of stale lyrics on slide/render
  const cachedLyrics = activeTrackId ? lyricsCacheRef.current.get(activeTrackId) : null;
  const isCached = activeTrackId ? lyricsCacheRef.current.has(activeTrackId) : false;

  // Derive active lyrics and loading state: if track changed, old lyrics instantly disappear
  const effectiveLyrics = (lyricsState.trackId === activeTrackId)
    ? lyricsState.lyrics
    : (isCached ? cachedLyrics : null);

  const effectiveLyricsLoading = (lyricsState.trackId === activeTrackId)
    ? lyricsState.loading
    : (!isCached && Boolean(activeTrackId));

  const hasLyrics = Boolean(effectiveLyrics && effectiveLyrics.syncedLyrics && effectiveLyrics.syncedLyrics.length > 0);

  // Auto-scroll queue item into view on desktop
  useEffect(() => {
    if (queueListRef.current) {
      const activeItem = queueListRef.current.querySelector(`[data-queue-index="${currentIndex}"]`);
      if (activeItem) {
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [currentIndex]);

  const getSampleStartTime = useCallback((track) => {
    if (!track) return 0;
    const dur = track.duration || 180;
    if (dur <= 40) return 0;
    return Math.min(25, Math.floor(dur * 0.2));
  }, []);

  // Lyrics fetching & caching for active track
  useEffect(() => {
    if (!isActiveView || !activeTrackId || !currentTrack) {
      setLyricsState({ trackId: null, lyrics: null, loading: false });
      return;
    }

    if (lyricsCacheRef.current.has(activeTrackId)) {
      const cached = lyricsCacheRef.current.get(activeTrackId);
      setLyricsState({ trackId: activeTrackId, lyrics: cached, loading: false });
      return;
    }

    // Immediately trigger loading state for newly selected track
    setLyricsState({ trackId: activeTrackId, lyrics: null, loading: true });

    let isMounted = true;

    fetchSyncedLyrics(currentTrack.title, currentTrack.artist, currentTrack.duration)
      .then((data) => {
        if (!isMounted) return;
        const result = (data && data.syncedLyrics && data.syncedLyrics.length > 0) ? data : null;
        lyricsCacheRef.current.set(activeTrackId, result);
        setLyricsState({ trackId: activeTrackId, lyrics: result, loading: false });
      })
      .catch(() => {
        if (!isMounted) return;
        lyricsCacheRef.current.set(activeTrackId, null);
        setLyricsState({ trackId: activeTrackId, lyrics: null, loading: false });
      });

    return () => {
      isMounted = false;
    };
  }, [isActiveView, activeTrackId, currentTrack?.title, currentTrack?.artist, currentTrack?.duration]);

  const activeLyricIndex = useMemo(() => {
    if (!hasLyrics || !effectiveLyrics) return -1;
    const list = effectiveLyrics.syncedLyrics;
    let active = -1;
    for (let i = 0; i < list.length; i++) {
      if (list[i].time <= currentAudioTime) {
        active = i;
      } else {
        break;
      }
    }
    return active;
  }, [hasLyrics, effectiveLyrics, currentAudioTime]);

  const currentLine = useMemo(() => {
    if (!hasLyrics || !effectiveLyrics || activeLyricIndex === -1) return null;
    return effectiveLyrics.syncedLyrics[activeLyricIndex];
  }, [hasLyrics, activeLyricIndex, effectiveLyrics]);

  const prevLine = useMemo(() => {
    if (!hasLyrics || !effectiveLyrics || activeLyricIndex <= 0) return null;
    return effectiveLyrics.syncedLyrics[activeLyricIndex - 1];
  }, [hasLyrics, activeLyricIndex, effectiveLyrics]);

  const nextLine = useMemo(() => {
    if (!hasLyrics || !effectiveLyrics) return null;
    if (activeLyricIndex === -1) return effectiveLyrics.syncedLyrics[0];
    if (activeLyricIndex < effectiveLyrics.syncedLyrics.length - 1) {
      return effectiveLyrics.syncedLyrics[activeLyricIndex + 1];
    }
    return null;
  }, [hasLyrics, activeLyricIndex, effectiveLyrics]);

  // Audio management: load track when index or track changes (NOT on mute toggle)
  useEffect(() => {
    if (!isActiveView || !currentTrack) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      return;
    }

    if (isPlayingFullSongRef.current) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    if (isGlobalPlayingRef.current && typeof toggleGlobalPlay === 'function') {
      toggleGlobalPlay();
    }

    const streamUrl = currentTrack.streamUrl || getAudioUrl(currentTrack.videoId);
    audio.src = streamUrl;
    const startTime = getSampleStartTime(currentTrack);
    audio.currentTime = startTime;
    setCurrentAudioTime(startTime);
    audio.muted = isMutedRef.current;

    setPlaybackProgress(0);

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
          setRequiresUserGesture(false);
        })
        .catch((err) => {
          console.warn('Autoplay prevented:', err);
          setIsPlaying(false);
          setRequiresUserGesture(true);
        });
    }

    const handleTimeUpdate = () => {
      const current = audio.currentTime;
      const elapsed = current - startTime;
      setCurrentAudioTime(current);
      if (elapsed >= LOOP_DURATION || audio.ended) {
        audio.currentTime = startTime;
        audio.play().catch(() => {});
        setPlaybackProgress(0);
      } else {
        const percent = Math.min(100, Math.max(0, (elapsed / LOOP_DURATION) * 100));
        setPlaybackProgress(percent);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [currentIndex, currentTrack?.videoId, isActiveView, getSampleStartTime, toggleGlobalPlay]);

  // Pause when navigating away
  useEffect(() => {
    if (!isActiveView && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [isActiveView]);

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (isPlayingFullSongRef.current) {
        isPlayingFullSongRef.current = false;
        setIsPlayingFullSong(false);
        if (isGlobalPlayingRef.current && typeof toggleGlobalPlay === 'function') {
          toggleGlobalPlay();
        }
      }
      audio.play().then(() => {
        setIsPlaying(true);
        setRequiresUserGesture(false);
      }).catch(err => {
        console.warn('Play error:', err);
      });
    }
  }, [isPlaying, toggleGlobalPlay]);

  // Mute audio in-place without restarting playback
  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextMuted = !isMutedRef.current;
    audio.muted = nextMuted;
    isMutedRef.current = nextMuted;
    setIsMuted(nextMuted);
    showToast(nextMuted ? 'Muted' : 'Sound On', 600);
  }, [showToast]);

  const handleLike = useCallback((e) => {
    if (e) e.stopPropagation();
    const track = tracksRef.current[currentIndexRef.current];
    if (!track?.videoId) return;

    const vid = track.videoId;
    const currentLiked = likedTrackIdsRef.current || [];
    const isLiked = currentLiked.includes(vid);
    let updatedLiked;
    let updatedList;

    try {
      const likedList = JSON.parse(localStorage.getItem('playloop_liked_tracks_list') || '[]');
      if (isLiked) {
        updatedLiked = currentLiked.filter(id => id !== vid);
        updatedList = likedList.filter(t => (t.videoId || t) !== vid);
        saveLikedTrackApi({ videoId: vid }, false).catch(() => {});
        showToast('Removed from Liked Songs', 700);
      } else {
        updatedLiked = [...currentLiked.filter(id => id !== vid), vid];
        const newTrackItem = {
          videoId: track.videoId,
          title: track.title || 'Track',
          artist: track.artist || 'Play LooP',
          thumbnail: track.thumbnail || '/default-cover.svg',
          duration: track.duration || 180
        };
        updatedList = [newTrackItem, ...likedList.filter(t => (t.videoId || t) !== vid)];
        saveLikedTrackApi(newTrackItem, true).catch(() => {});
        showToast('Added to Liked Songs', 700);
      }

      likedTrackIdsRef.current = updatedLiked;
      setLikedTrackIds(updatedLiked);
      localStorage.setItem('playloop_liked_tracks', JSON.stringify(updatedLiked));
      localStorage.setItem('playloop_liked_tracks_list', JSON.stringify(updatedList));
      window.dispatchEvent(new CustomEvent('playloop-liked-songs-updated'));
    } catch (err) {
      console.error(err);
    }
  }, [showToast]);

  const handleCardTap = (e) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX || (e.touches && e.touches[0]?.clientX) || rect.left + rect.width / 2) - rect.left;
      const y = (e.clientY || (e.touches && e.touches[0]?.clientY) || rect.top + rect.height / 2) - rect.top;

      setHeartBurstPos({ x, y });
      setShowHeartBurst(true);
      setTimeout(() => setShowHeartBurst(false), 800);

      const track = tracksRef.current[currentIndexRef.current];
      if (track?.videoId && !likedTrackIdsRef.current.includes(track.videoId)) {
        handleLike();
      }
    } else {
      togglePlayPause();
    }
    lastTapRef.current = now;
  };

  const handlePlayFullSong = useCallback((e) => {
    if (e) e.stopPropagation();
    const track = tracksRef.current[currentIndexRef.current];
    if (!track) return;

    if (isPlayingFullSongRef.current && isGlobalPlayingRef.current) {
      if (typeof toggleGlobalPlay === 'function') {
        toggleGlobalPlay();
      }
      return;
    }

    isPlayingFullSongRef.current = true;
    setIsPlayingFullSong(true);

    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    if (selectAndPlayTrack) {
      selectAndPlayTrack(
        track.videoId,
        track.title,
        track.artist,
        track.thumbnail,
        false,
        false,
        track.duration
      );
      showToast('Playing full song', 900);
    }
  }, [selectAndPlayTrack, showToast, toggleGlobalPlay]);

  const handleShare = useCallback((e) => {
    if (e) e.stopPropagation();
    const track = tracksRef.current[currentIndexRef.current];
    if (!track) return;
    window.dispatchEvent(new CustomEvent('playloop-open-share', { detail: track }));
  }, []);

  const goToNext = useCallback(() => {
    setToastMessage(null);
    if (currentIndexRef.current < tracksRef.current.length - 1) {
      setCurrentIndex(prev => prev + 1);
      if (currentIndexRef.current >= tracksRef.current.length - 3) {
        loadMoreLoops();
      }
    }
  }, [loadMoreLoops]);

  const goToPrev = useCallback(() => {
    setToastMessage(null);
    if (currentIndexRef.current > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!isActiveView) return;

    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        goToPrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        handleLike();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handlePlayFullSong();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActiveView, goToNext, goToPrev, togglePlayPause, toggleMute, handleLike, handlePlayFullSong]);

  // Desktop mouse wheel scrolling
  const handleWheel = (e) => {
    // If scrolling inside the right-hand queue, don't hijack wheel
    if (e.target && e.target.closest && e.target.closest('.loops-desktop-queue')) {
      return;
    }
    if (wheelLockRef.current) return;
    if (Math.abs(e.deltaY) > 25) {
      wheelLockRef.current = true;
      if (e.deltaY > 0) {
        goToNext();
      } else {
        goToPrev();
      }
      setTimeout(() => {
        wheelLockRef.current = false;
      }, 500);
    }
  };

  // Mobile swipe
  const touchStartY = useRef(null);
  const touchStartX = useRef(null);
  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    const deltaX = touchStartX.current !== null ? Math.abs(e.changedTouches[0].clientX - touchStartX.current) : 0;
    if (Math.abs(deltaY) > 40 && Math.abs(deltaY) > deltaX) {
      if (deltaY < 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }
    touchStartY.current = null;
    touchStartX.current = null;
  };

  const isCurrentLiked = currentTrack && likedTrackIds.includes(currentTrack.videoId);

  return (
    <div 
      className="relative w-full h-full flex items-center justify-center gap-6 lg:gap-8 overflow-hidden bg-black select-none p-0 sm:p-3 md:p-4 lg:p-6 touch-none"
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <audio ref={audioRef} preload="auto" playsInline />

      {/* Dynamic blurred ambient glow behind the reel card on desktop */}
      {currentTrack?.thumbnail && (
        <div 
          className="hidden md:block absolute inset-0 opacity-20 scale-125 filter blur-3xl pointer-events-none transition-all duration-700 ease-out"
          style={{
            backgroundImage: `url(${currentTrack.thumbnail})`,
            backgroundPosition: 'center',
            backgroundSize: 'cover'
          }}
        />
      )}

      {/* Main Reel Frame (Mobile Edge-to-Edge / Desktop Centered Card matching Up Next size) */}
      <div 
        ref={containerRef}
        className="relative w-full h-full max-w-full md:w-[400px] lg:w-[420px] md:max-h-[820px] rounded-none sm:rounded-2xl md:rounded-3xl overflow-hidden border-0 sm:border border-zinc-800/80 bg-zinc-950 shadow-[0_12px_45px_rgba(0,0,0,0.85)] z-10 shrink-0"
      >
        {/* Pinned Top Navigation Overlay (Snippet Progress, Loops Brand, Mute, and Mobile Language Filter Chips) */}
        <div className="absolute top-0 left-0 right-0 z-30 px-3.5 sm:px-4 pt-2.5 pb-2 flex flex-col gap-2 pointer-events-none bg-gradient-to-b from-black/85 via-black/45 to-transparent">
          {/* Snippet Progress Bar */}
          <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
            <div 
              className="h-full bg-white transition-[width] duration-150 ease-linear rounded-full shadow-[0_0_8px_rgba(255,255,255,0.7)]"
              style={{ width: `${playbackProgress || 0}%` }}
            />
          </div>

          {/* Header Badges & Actions */}
          <div className="flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-1.5 sm:gap-2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/15 shadow-sm">
              <Repeat className="w-3.5 h-3.5 text-white stroke-[2.2]" />
              <span className="text-xs font-bold text-white tracking-wider uppercase">Loops</span>
              <span className="text-[10px] text-zinc-400 font-mono">• 30s</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                aria-label={isMuted ? "Unmute loop" : "Mute loop"}
                className="p-1.5 sm:p-2 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white border border-white/15 transition-colors shadow-sm cursor-pointer"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-zinc-400" /> : <Volume2 className="w-4 h-4 text-white" />}
              </button>
            </div>
          </div>

          {/* Mobile & Tablet Language Filter Chips (Scrollable row for mobile screens where desktop panel is hidden) */}
          <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto hide-scrollbar pt-0.5 pb-0.5 pointer-events-auto select-none touch-pan-x">
            {GENRE_TAGS.map((tag) => {
              const isSelected = activeTag === tag.id;
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTag(tag.id);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer backdrop-blur-md active:scale-95 shrink-0 ${
                    isSelected 
                      ? 'bg-white text-black shadow-lg font-bold' 
                      : 'bg-black/60 text-zinc-300 hover:text-white hover:bg-black/80 border border-white/15'
                  }`}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>
        {isLoading ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
            <div className="relative w-16 h-16 mb-4 flex items-center justify-center">
              <Disc3 className="w-12 h-12 text-white animate-spin stroke-[1.5]" />
            </div>
            <p className="text-white font-medium text-sm tracking-wide">Loading Loops...</p>
            <p className="text-zinc-500 text-xs mt-1">Discovering endless music reels</p>
          </div>
        ) : tracks.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-zinc-400">
            <Music2 className="w-12 h-12 mb-3 text-zinc-600" />
            <p className="text-base font-semibold text-white">No Loops Available</p>
            <p className="text-xs text-zinc-500 mt-1">Try another language or check back later.</p>
          </div>
        ) : (
          /* Smooth Vertical Sliding Feed Container */
          <div 
            className="w-full h-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ transform: `translate3d(0, -${currentIndex * 100}%, 0)` }}
          >
            {tracks.map((track, index) => {
              const isNearby = Math.abs(index - currentIndex) <= 2;
              const isCardActive = index === currentIndex;
              const isTrackLiked = likedTrackIds.includes(track.videoId);

              if (!isNearby) {
                return (
                  <div key={track.videoId || index} className="w-full h-full shrink-0" />
                );
              }

              return (
                <div 
                  key={track.videoId || index}
                  className="w-full h-full shrink-0 relative flex flex-col justify-between cursor-pointer"
                  onClick={handleCardTap}
                >
                  {/* Background Artwork Layer */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <img 
                      src={track.thumbnail || '/default-cover.svg'} 
                      alt="" 
                      className="w-full h-full object-cover filter blur-3xl scale-150 opacity-50 transition-all duration-700" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/25 to-black/95" />
                    <div className="absolute inset-0 bg-radial from-transparent via-black/20 to-black/80" />
                  </div>

                  {/* Spacer for Top Pinned Header */}
                  <div className={`shrink-0 pointer-events-none transition-all duration-300 ${isCardActive && hasLyrics ? 'pt-24 lg:pt-20' : 'pt-24 lg:pt-14'}`} />

                  {/* Center Visual: Vinyl / Cover Art with animated Equalizer & Synced Lyrics */}
                  <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-2 sm:p-4 pointer-events-none min-h-0">
                    {/* Vinyl + Artwork Frame (Scales appropriately on desktop when lyrics are present to prevent header overlap) */}
                    <div className={`relative flex items-center justify-center transition-all duration-300 ${
                      isCardActive && hasLyrics 
                        ? 'w-44 h-44 sm:w-52 sm:h-52 lg:w-44 lg:h-44' 
                        : 'w-44 h-44 sm:w-52 sm:h-52 md:w-56 md:h-56'
                    }`}>
                      {/* Vinyl Record Shadow / Peek Animation */}
                      <div 
                        className={`absolute rounded-full bg-zinc-900 border-4 border-zinc-950/90 shadow-2xl flex items-center justify-center transition-all duration-700 ease-out ${
                          isCardActive && hasLyrics
                            ? 'w-32 h-32 sm:w-38 sm:h-38 lg:w-32 lg:h-32'
                            : 'w-36 h-36 sm:w-44 sm:h-44 md:w-48 md:h-48'
                        } ${
                          isCardActive && isPlaying 
                            ? (isCardActive && hasLyrics ? 'translate-x-5 sm:translate-x-6 lg:translate-x-6 rotate-45' : 'translate-x-8 sm:translate-x-10 rotate-45') 
                            : 'translate-x-0'
                        }`}
                      >
                        <div className={`rounded-full border-2 border-white/10 flex items-center justify-center bg-zinc-950 transition-all duration-300 ${
                          isCardActive && hasLyrics ? 'w-11 h-11 sm:w-13 sm:h-13 lg:w-11 lg:h-11' : 'w-14 h-14 sm:w-16 sm:h-16'
                        }`}>
                          <Disc3 className={`text-zinc-400 ${isCardActive && isPlaying ? 'animate-spin' : ''} ${
                            isCardActive && hasLyrics ? 'w-6 h-6 sm:w-8 sm:h-8 lg:w-6 lg:h-6' : 'w-8 h-8 sm:w-10 sm:h-10'
                          }`} style={{ animationDuration: '6s' }} />
                        </div>
                      </div>

                      {/* Front Album Artwork */}
                      <div className={`relative rounded-2xl md:rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-white/20 bg-zinc-900 transition-all duration-300 ${
                        isCardActive && hasLyrics
                          ? 'w-36 h-36 sm:w-44 sm:h-44 lg:w-36 lg:h-36'
                          : 'w-36 h-36 sm:w-44 sm:h-44 md:w-48 md:h-48'
                      }`}>
                        <img 
                          src={track.thumbnail || '/default-cover.svg'} 
                          alt={track.title} 
                          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" 
                        />
                        
                        {/* Play Indicator Overlay */}
                        {(!isCardActive || !isPlaying) && (
                          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-lg">
                              <Play className="w-6 h-6 ml-0.5 fill-black" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Animated Equalizer Waveform Bars */}
                    <div className={`flex items-center gap-1 h-5 transition-all duration-300 ${
                      isCardActive && hasLyrics ? 'mt-3 sm:mt-4' : 'mt-4 sm:mt-5'
                    }`}>
                      {[40, 75, 100, 60, 90, 45, 80, 65, 95, 50, 85, 30, 70, 90, 60, 40].slice(0, (isCardActive && hasLyrics) ? 12 : 16).map((height, i) => (
                        <span
                          key={i}
                          className={`w-1 bg-white/90 rounded-full transition-all duration-300 ${
                            isCardActive && isPlaying ? 'animate-pulse' : 'opacity-25'
                          }`}
                          style={{
                            height: isCardActive && isPlaying ? `${height}%` : '20%',
                            animationDuration: `${0.4 + (i % 5) * 0.15}s`,
                            animationDelay: `${i * 0.05}s`
                          }}
                        />
                      ))}
                    </div>

                    {/* Center Area: Live Synced Lyrics (Downside) OR Loading indicator when fetching */}
                    {isCardActive && hasLyrics ? (
                      <div className="w-full max-w-[360px] px-4 mt-4 sm:mt-5 lg:mt-4 flex flex-col items-center text-center gap-2 sm:gap-2.5 transition-all duration-500 loops-lyrics-container">
                        {prevLine && (
                          <p 
                            key={`prev-${prevLine?.time ?? activeLyricIndex}`}
                            className="lyric-line-neighbor text-xs sm:text-sm text-white/40 line-clamp-1 font-medium select-none"
                          >
                            {prevLine.text}
                          </p>
                        )}
                        <p 
                          key={`curr-${currentLine?.time ?? activeLyricIndex}`}
                          className="lyric-line-active text-base sm:text-lg font-bold text-white tracking-normal leading-relaxed drop-shadow-[0_2px_14px_rgba(0,0,0,0.9)] line-clamp-2 select-none px-4 py-2 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10"
                        >
                          {currentLine ? currentLine.text : (nextLine ? nextLine.text : "♪ ♪ ♪")}
                        </p>
                        {nextLine && activeLyricIndex !== -1 && (
                          <p 
                            key={`next-${nextLine?.time ?? activeLyricIndex}`}
                            className="lyric-line-neighbor text-xs sm:text-sm text-white/40 line-clamp-1 font-medium select-none"
                          >
                            {nextLine.text}
                          </p>
                        )}
                      </div>
                    ) : (
                      isCardActive && effectiveLyricsLoading ? (
                        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-zinc-300 text-xs mt-6 transition-all duration-300 shadow-sm animate-pulse loops-lyrics-container">
                          <Disc3 className="w-3.5 h-3.5 text-zinc-400 animate-spin" />
                          <span className="font-medium tracking-wide">Loading lyrics...</span>
                        </div>
                      ) : null
                    )}
                  </div>

                  {/* Tap to Unmute Overlay Banner */}
                  {isCardActive && requiresUserGesture && (
                    <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 z-30 flex justify-center">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); togglePlayPause(); }}
                        className="px-5 py-2.5 rounded-full bg-white text-black font-semibold text-xs flex items-center gap-2 shadow-[0_8px_25px_rgba(0,0,0,0.6)] cursor-pointer hover:scale-105 transition-all"
                      >
                        <Volume2 className="w-4 h-4 fill-black" />
                        Tap to Listen
                      </button>
                    </div>
                  )}

                  {/* Double Tap Heart Burst Animation */}
                  {isCardActive && showHeartBurst && (
                    <div 
                      className="absolute z-40 pointer-events-none transform -translate-x-1/2 -translate-y-1/2 animate-ping"
                      style={{ left: heartBurstPos.x, top: heartBurstPos.y }}
                    >
                      <Heart className="w-20 h-20 text-white fill-white drop-shadow-[0_0_30px_rgba(255,255,255,0.9)]" />
                    </div>
                  )}

                  {/* Bottom Section: Track Info & Action Buttons */}
                  <div className="relative z-20 px-4 pb-3.5 sm:pb-4 pt-1 flex items-end justify-between gap-3">
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-white border border-white/15 backdrop-blur-md">
                          <Radio className="w-2.5 h-2.5 text-white animate-pulse" />
                          Music Loop
                        </span>
                      </div>

                      <h2 className="text-base sm:text-lg font-bold text-white truncate drop-shadow-md tracking-tight">
                        {track.title}
                      </h2>
                      
                      <p className="text-xs text-zinc-300 truncate drop-shadow-sm font-medium mt-0.5">
                        {track.artist}
                      </p>

                      <div className="mt-2.5">
                        <button
                          type="button"
                          onClick={handlePlayFullSong}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-all shadow-[0_4px_18px_rgba(255,255,255,0.25)] hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                        >
                          {isPlayingFullSong && isGlobalPlaying ? (
                            <>
                              <Pause className="w-3.5 h-3.5 fill-black" />
                              Playing Full Song
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 fill-black" />
                              Play Full Song
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-3 pb-0.5 select-none shrink-0">
                      <button
                        type="button"
                        onClick={handleLike}
                        aria-label={isTrackLiked ? "Unlike song" : "Like song"}
                        className="flex flex-col items-center gap-0.5 group cursor-pointer"
                      >
                        <div className={`p-2.5 rounded-full backdrop-blur-xl border transition-all duration-200 ${
                          isTrackLiked 
                            ? 'bg-white border-white text-black scale-105 shadow-[0_0_15px_rgba(255,255,255,0.4)]' 
                            : 'bg-black/60 border-white/15 text-white hover:bg-black/80 hover:scale-105'
                        }`}>
                          <Heart className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 ${isTrackLiked ? 'fill-black text-black scale-110' : 'text-white'}`} />
                        </div>
                        <span className="text-[9px] text-zinc-300 font-medium">
                          {isTrackLiked ? 'Liked' : 'Like'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleShare}
                        aria-label="Share song"
                        className="flex flex-col items-center gap-0.5 group cursor-pointer"
                      >
                        <div className="p-2.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-xl border border-white/15 text-white transition-all duration-200 hover:scale-105">
                          <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <span className="text-[9px] text-zinc-300 font-medium">Share</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); goToNext(); }}
                        disabled={currentIndex >= tracks.length - 1}
                        aria-label="Next loop"
                        className="flex flex-col items-center gap-0.5 group cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <div className="p-2.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-xl border border-white/15 text-white transition-all duration-200 hover:scale-105">
                          <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <span className="text-[9px] text-zinc-300 font-medium">Next</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop Floating Navigation Arrows */}
      <div className="hidden md:flex lg:hidden flex-col gap-3 absolute right-6 z-20">
        <button
          type="button"
          onClick={goToPrev}
          disabled={currentIndex === 0}
          aria-label="Previous loop (Arrow Up)"
          className="p-3 rounded-full bg-zinc-900/90 hover:bg-zinc-800 text-white border border-zinc-700/80 shadow-lg transition-all duration-200 hover:scale-110 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          title="Previous loop (↑)"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={goToNext}
          disabled={currentIndex >= tracks.length - 1}
          aria-label="Next loop (Arrow Down)"
          className="p-3 rounded-full bg-zinc-900/90 hover:bg-zinc-800 text-white border border-zinc-700/80 shadow-lg transition-all duration-200 hover:scale-110 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          title="Next loop (↓)"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>

      {/* DESKTOP COMPANION PANEL: Uses desktop space for Up Next queue, language chips, and keyboard tips (exact same size as player card) */}
      <div className="hidden lg:flex flex-col w-[400px] lg:w-[420px] h-full lg:max-h-[820px] rounded-3xl border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-xl p-5 shadow-[0_12px_45px_rgba(0,0,0,0.85)] z-10 shrink-0 justify-between">
        {/* Panel Header */}
        <div>
          <div className="flex items-center justify-between pb-3.5 border-b border-zinc-800/80">
            <div className="flex items-center gap-2">
              <ListMusic className="w-5 h-5 text-white" />
              <h3 className="font-bold text-white text-sm tracking-wide">Up Next in Loops</h3>
            </div>
            <button
              type="button"
              onClick={() => loadLoopsByTag(activeTag)}
              title="Refresh queue"
              aria-label="Refresh queue"
              className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Language / Genre Filter Chips */}
          <div className="flex items-center gap-1.5 py-3 overflow-x-auto hide-scrollbar">
            {GENRE_TAGS.map((tag) => {
              const isSelected = activeTag === tag.id;
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => setActiveTag(tag.id)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    isSelected 
                      ? 'bg-white text-black shadow-md' 
                      : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800'
                  }`}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Up Next Queue List */}
        <div 
          ref={queueListRef}
          className="loops-desktop-queue flex-1 overflow-y-auto space-y-1.5 pr-1.5 my-2 hide-scrollbar min-h-0"
        >
          {tracks.map((t, idx) => {
            const isPlayingThis = idx === currentIndex;
            return (
              <div
                key={t.videoId || idx}
                data-queue-index={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`flex items-center gap-3 p-2 rounded-xl transition cursor-pointer group ${
                  isPlayingThis 
                    ? 'bg-zinc-800/90 border border-white/20 shadow-md' 
                    : 'hover:bg-zinc-900/80 border border-transparent'
                }`}
              >
                {/* Thumbnail with playing equalizer icon */}
                <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-zinc-900 border border-white/10">
                  <img 
                    src={t.thumbnail || '/default-cover.svg'} 
                    alt={t.title} 
                    className="w-full h-full object-cover" 
                  />
                  {isPlayingThis && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center gap-0.5">
                      <span className="w-0.5 h-3 bg-white rounded-full animate-pulse" />
                      <span className="w-0.5 h-4 bg-white rounded-full animate-pulse delay-75" />
                      <span className="w-0.5 h-2 bg-white rounded-full animate-pulse delay-150" />
                    </div>
                  )}
                </div>

                {/* Track Title and Artist */}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold truncate ${isPlayingThis ? 'text-white' : 'text-zinc-200 group-hover:text-white'}`}>
                    {t.title}
                  </p>
                  <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                    {t.artist}
                  </p>
                </div>

                {/* Indicator badge */}
                {isPlayingThis ? (
                  <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-white/20 text-white tracking-wider">
                    Playing
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full bg-white/10 hover:bg-white text-zinc-300 hover:text-black transition"
                    title="Play this loop"
                  >
                    <Play className="w-3 h-3 fill-current ml-0.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop Keyboard Shortcuts Footer */}
        <div className="pt-3 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400 font-medium">
          <div className="flex flex-wrap items-center gap-3">
            <span><kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 text-[10px]">Scroll</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 text-[10px]">↑</kbd> <kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 text-[10px]">↓</kbd> Skip</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 text-[10px]">Space</kbd> Play/Pause</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 text-[10px]">L</kbd> Like</span>
          </div>
          <span><kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 text-[10px]">Enter</kbd> Full Song</span>
        </div>
      </div>

      {/* Notification Toast (Non-intrusive, quick subtle fade) */}
      {toastMessage && (
        <div className="fixed bottom-24 md:bottom-28 z-50 px-4 py-1.5 rounded-full bg-zinc-900/95 text-white border border-zinc-700/80 backdrop-blur-xl text-xs font-semibold shadow-2xl flex items-center gap-2 pointer-events-none transition-all duration-150">
          <Check className="w-4 h-4 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
