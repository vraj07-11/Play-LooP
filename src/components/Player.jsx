import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { 
  Play, Pause, Shuffle, SkipBack, SkipForward, Repeat1, 
  ChevronUp, ChevronDown, RotateCcw, RotateCw, ListMusic, Heart, Share2,
  Volume2, Volume1, VolumeX 
} from 'lucide-react';
import { shareTrack } from '../services/shareService';

const FullPlayer = lazy(() => import('./FullPlayer'));

export default function Player() {
  const {
    isPlaying, playPause,
    currentTitle, playerStatus,
    progress, currentTime, duration,
    playNextTrack, playPreviousTrack,
    seekBy, seekToPercent,
    isRepeatEnabled, setIsRepeatEnabled,
    isShuffleEnabled, setIsShuffleEnabled,
    hasPrevious, hasNext,
    volume, setVolume,
    isMuted, toggleMute,
    pendingTrack,
    isRightSidebarOpen, setIsRightSidebarOpen,
    trackQueue, recommendationQueue, selectAndPlayTrack,
    isRefreshingUpNext, refreshUpNext
  } = usePlayer();

  const [isExpanded, setIsExpanded] = useState(false);
  const [hasOpenedFullPlayer, setHasOpenedFullPlayer] = useState(false);
  const [isMobileQueueOpen, setIsMobileQueueOpen] = useState(false);
  const [initialShowLyrics, setInitialShowLyrics] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const progressRef = useRef(null);

  // Top Progress Bar state for Desktop Miniplayer
  const topProgressContainerRef = useRef(null);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [dragPercent, setDragPercent] = useState(null);
  const [hoverPercent, setHoverPercent] = useState(null);
  const [isHoveringProgress, setIsHoveringProgress] = useState(false);

  useEffect(() => {
    if (!pendingTrack?.videoId) return;
    const checkIsLiked = () => {
      try {
        const liked = JSON.parse(localStorage.getItem('playloop_liked_tracks') || '[]');
        setIsLiked(liked.includes(pendingTrack.videoId));
      } catch (e) {
        setIsLiked(false);
      }
    };
    checkIsLiked();
    window.addEventListener('playloop-liked-songs-updated', checkIsLiked);
    return () => window.removeEventListener('playloop-liked-songs-updated', checkIsLiked);
  }, [pendingTrack]);

  const handleLikeClick = (e) => {
    e.stopPropagation();
    if (!pendingTrack?.videoId) return;
    try {
      const liked = JSON.parse(localStorage.getItem('playloop_liked_tracks') || '[]');
      const likedList = JSON.parse(localStorage.getItem('playloop_liked_tracks_list') || '[]');
      let updatedIds, updatedTracks;

      if (isLiked) {
        updatedIds = liked.filter(id => id !== pendingTrack.videoId);
        updatedTracks = likedList.filter(t => (t.videoId || t) !== pendingTrack.videoId);
        setIsLiked(false);
      } else {
        updatedIds = [...liked.filter(id => id !== pendingTrack.videoId), pendingTrack.videoId];
        const trackObj = {
          videoId: pendingTrack.videoId,
          title: pendingTrack.title || currentTitle || "Liked Track",
          artist: pendingTrack.artist || pendingTrack.channelTitle || "Play LooP",
          thumbnail: (!pendingTrack.thumbnail || pendingTrack.thumbnail === '/logo.svg') ? '/default-cover.svg' : pendingTrack.thumbnail,
          duration: pendingTrack.duration || duration || 180
        };
        updatedTracks = [trackObj, ...likedList.filter(t => (t.videoId || t) !== pendingTrack.videoId)];
        setIsLiked(true);
      }
      localStorage.setItem('playloop_liked_tracks', JSON.stringify(updatedIds));
      localStorage.setItem('playloop_liked_tracks_list', JSON.stringify(updatedTracks));
      window.dispatchEvent(new CustomEvent('playloop-liked-songs-updated'));
    } catch (err) {
      setIsLiked(!isLiked);
    }
  };

  useEffect(() => {
    const handleToggleLyrics = () => {
      if (!pendingTrack) return;
      if (!isExpanded) {
        setInitialShowLyrics(true);
        const currentState = window.history.state || {};
        window.history.pushState({ ...currentState, fullPlayer: true }, '', '#/player');
        setIsExpanded(true);
      } else {
        window.dispatchEvent(new CustomEvent('playloop-toggle-lyrics-internal'));
      }
    };

    const handleToggleFullPlayer = () => {
      if (!pendingTrack) return;
      if (!isExpanded) {
        openFullPlayer(false);
      } else {
        closeFullPlayer();
      }
    };

    const handleOpenQueue = () => {
      setIsMobileQueueOpen(true);
      if (typeof setIsRightSidebarOpen === 'function') {
        setIsRightSidebarOpen(true);
      }
    };

    window.addEventListener('playloop-toggle-lyrics', handleToggleLyrics);
    window.addEventListener('playloop-toggle-full-player', handleToggleFullPlayer);
    window.addEventListener('playloop-open-queue', handleOpenQueue);
    return () => {
      window.removeEventListener('playloop-toggle-lyrics', handleToggleLyrics);
      window.removeEventListener('playloop-toggle-full-player', handleToggleFullPlayer);
      window.removeEventListener('playloop-open-queue', handleOpenQueue);
    };
  }, [pendingTrack, isExpanded, setIsRightSidebarOpen]);

  useEffect(() => {
    const handlePopState = (e) => {
      const state = e.state;
      if (!state || !state.fullPlayer) {
        setIsExpanded(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (isExpanded && !pendingTrack) {
      setIsExpanded(false);
    }
  }, [isExpanded, pendingTrack]);

  const openFullPlayer = (showLyricsMode = false) => {
    setHasOpenedFullPlayer(true);
    if (!isExpanded) {
      setInitialShowLyrics(showLyricsMode);
      const currentState = window.history.state || {};
      window.history.pushState({ ...currentState, fullPlayer: true }, '', '#/player');
      setIsExpanded(true);
    }
  };

  const closeFullPlayer = () => {
    setIsExpanded(false);
    if (window.location.hash.includes('player')) {
      window.history.back();
    }
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formatTimePadded = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs < 10 ? '0' : ''}${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getPercentFromClientX = (clientX) => {
    if (!topProgressContainerRef.current) return 0;
    const rect = topProgressContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return rect.width > 0 ? (x / rect.width) * 100 : 0;
  };

  const handleTopProgressMouseDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.button !== 0) return;
    const pct = getPercentFromClientX(e.clientX);
    setIsDraggingProgress(true);
    setDragPercent(pct);
    seekToPercent(pct);

    const onMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      const currentPct = getPercentFromClientX(moveEvent.clientX);
      setDragPercent(currentPct);
      seekToPercent(currentPct);
    };

    const onMouseUp = (upEvent) => {
      upEvent.preventDefault();
      const finalPct = getPercentFromClientX(upEvent.clientX);
      seekToPercent(finalPct);
      setIsDraggingProgress(false);
      setDragPercent(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleTopProgressTouchStart = (e) => {
    e.stopPropagation();
    if (!e.touches || e.touches.length === 0) return;
    const pct = getPercentFromClientX(e.touches[0].clientX);
    setIsDraggingProgress(true);
    setDragPercent(pct);
    seekToPercent(pct);

    const onTouchMove = (moveEvent) => {
      if (!moveEvent.touches || moveEvent.touches.length === 0) return;
      const currentPct = getPercentFromClientX(moveEvent.touches[0].clientX);
      setDragPercent(currentPct);
      seekToPercent(currentPct);
    };

    const onTouchEnd = () => {
      setIsDraggingProgress(false);
      setDragPercent(null);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };

    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
  };

  const handleTopProgressMouseMove = (e) => {
    const pct = getPercentFromClientX(e.clientX);
    setHoverPercent(pct);
  };

  const handleProgressChange = (e) => {
    seekToPercent(e.target.value);
  };

  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const minSwipeDistance = 50;
  
  const queueTouchStartY = useRef(null);
  const [queueSwipeOffset, setQueueSwipeOffset] = useState(0);

  const onQueueTouchStart = (e) => {
    queueTouchStartY.current = e.targetTouches[0].clientY;
  };
  
  const onQueueTouchMove = (e) => {
    if (!queueTouchStartY.current) return;
    const currentY = e.targetTouches[0].clientY;
    const diff = currentY - queueTouchStartY.current;
    if (diff > 0) {
      setQueueSwipeOffset(diff);
    }
  };
  
  const onQueueTouchEnd = () => {
    if (queueSwipeOffset > 100) {
      setIsMobileQueueOpen(false);
    }
    setQueueSwipeOffset(0);
    queueTouchStartY.current = null;
  };

  // Hide the player bar if nothing is pending
  if (!pendingTrack) return null;

  const onTouchStart = (e) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
    setIsSwiping(true);
  };

  const onTouchMove = (e) => {
    if (!touchStartX.current || !touchStartY.current) return;
    const currentX = e.targetTouches[0].clientX;
    const currentY = e.targetTouches[0].clientY;
    const diffX = currentX - touchStartX.current;
    const diffY = currentY - touchStartY.current;
    
    if (Math.abs(diffY) > Math.abs(diffX)) return;
    
    // Add resistance if they are swiping but can't go that way
    if ((diffX < 0 && !hasNext) || (diffX > 0 && !hasPrevious)) {
      setSwipeOffset(diffX * 0.2);
    } else {
      setSwipeOffset(diffX);
    }
  };

  const onTouchEnd = (e) => {
    if (!touchStartX.current || !touchStartY.current) return;
    const endY = e.changedTouches ? e.changedTouches[0].clientY : touchStartY.current;
    const diffY = endY - touchStartY.current;
    
    const isUpSwipe = -diffY > minSwipeDistance;
    const distance = -swipeOffset; // positive = left swipe (finger moved left)
    
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isUpSwipe) {
      openFullPlayer(false);
      setIsSwiping(false);
      setSwipeOffset(0);
    } else if (isLeftSwipe && hasNext) {
      // Animate out to the left
      setSwipeOffset(-window.innerWidth);
      setIsSwiping(false);
      
      setTimeout(() => {
        playNextTrack();
        // Instantly move to right side
        setIsSwiping(true); 
        setSwipeOffset(window.innerWidth);
        
        // Animate in to 0
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsSwiping(false);
            setSwipeOffset(0);
          });
        });
      }, 300);
      
    // Swipe Right = Previous Track
    } else if (isRightSwipe && hasPrevious) {
      // Animate out to the right
      setSwipeOffset(window.innerWidth);
      setIsSwiping(false);
      
      setTimeout(() => {
        playPreviousTrack();
        // Instantly move to left side
        setIsSwiping(true); 
        setSwipeOffset(-window.innerWidth);
        
        // Animate in to 0
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsSwiping(false);
            setSwipeOffset(0);
          });
        });
      }, 300);
      
    } else {
      setIsSwiping(false);
      setSwipeOffset(0);
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  const activeProgress = isDraggingProgress && dragPercent !== null ? dragPercent : (progress || 0);

  return (
    <>
      {/* Desktop Player Bar */}
      <footer 
        className="hidden md:flex player-bar relative z-40 bg-zinc-900 border-t border-zinc-800 px-5 md:px-7 py-3.5 items-center justify-between gap-4 shrink-0 cursor-pointer select-none min-h-[5.5rem]"
        onClick={() => openFullPlayer(false)}
        onWheel={(e) => {
          if (e.deltaY > 0 || e.deltaY < 0) {
            openFullPlayer(false);
          }
        }}
      >
        {/* Desktop Top-Edge Progress Bar (Full Width with Circular Knob Scrubber) */}
        <div 
          ref={topProgressContainerRef}
          className="absolute top-0 left-0 right-0 h-4 -translate-y-1/2 z-50 cursor-pointer group/progressbar flex items-center select-none"
          onClick={(e) => {
            e.stopPropagation();
            const pct = getPercentFromClientX(e.clientX);
            seekToPercent(pct);
          }}
          onMouseDown={handleTopProgressMouseDown}
          onTouchStart={handleTopProgressTouchStart}
          onMouseMove={handleTopProgressMouseMove}
          onMouseEnter={() => setIsHoveringProgress(true)}
          onMouseLeave={() => {
            setIsHoveringProgress(false);
            setHoverPercent(null);
          }}
          title="Seek"
        >
          {/* Subtle Hover Time Badge */}
          {isHoveringProgress && hoverPercent !== null && duration > 0 && (
            <div 
              className="absolute -top-8 -translate-x-1/2 px-2 py-0.5 rounded bg-zinc-950/95 text-white text-xs font-mono border border-zinc-700/60 shadow-lg pointer-events-none"
              style={{ left: `${Math.max(2, Math.min(98, hoverPercent))}%` }}
            >
              {formatTimePadded((hoverPercent / 100) * duration)}
            </div>
          )}

          {/* Full-width Track */}
          <div className="relative w-full h-[3.5px] group-hover/progressbar:h-[5px] bg-zinc-700/70 transition-all duration-100 ease-out">
            {/* Hover Ghost Track */}
            {isHoveringProgress && hoverPercent !== null && (
              <div 
                className="absolute top-0 bottom-0 left-0 bg-white/20 pointer-events-none"
                style={{ width: `${Math.max(0, Math.min(100, hoverPercent))}%` }}
              />
            )}

            {/* Played Progress Bar */}
            <div 
              className="absolute top-0 bottom-0 left-0 bg-white pointer-events-none"
              style={{ width: `${Math.max(0, Math.min(100, activeProgress))}%` }}
            />

            {/* Scrubber Knob / Thumb (Always visible white circular dot, expands slightly on hover/drag) */}
            <div 
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full shadow-[0_1px_6px_rgba(0,0,0,0.85)] border border-black/20 transition-transform duration-75 pointer-events-none ${
                isDraggingProgress ? 'scale-125 ring-2 ring-white/30' : 'group-hover/progressbar:scale-125'
              }`}
              style={{ left: `${Math.max(0, Math.min(100, activeProgress))}%` }}
            />
          </div>
        </div>

        {/* Left Section: Track Artwork & Title / Artist */}
        <div 
          className="player-track flex items-center gap-3.5 w-1/4 max-w-[280px] min-w-0 cursor-pointer group hover:opacity-95 select-none shrink"
          onClick={(e) => {
            e.stopPropagation();
            openFullPlayer(false);
          }}
          title="Click to view expanded player"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openFullPlayer();
            }
          }}
        >
          <div className="relative shrink-0">
            <img 
              src={(!pendingTrack?.thumbnail || pendingTrack?.thumbnail === '/logo.svg') ? '/default-cover.svg' : pendingTrack.thumbnail} 
              alt="Track thumbnail" 
              className="w-14 h-14 rounded-lg object-cover bg-black border border-white/5 shrink-0 shadow-md"
              onError={(e) => {
                e.target.src = '/default-cover.svg';
              }}
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
              <ChevronUp className="w-6 h-6 text-white translate-y-0.5" />
            </div>
          </div>
          <div className="flex flex-col flex-1 min-w-0 justify-center">
            <span className="player-title text-[15px] font-semibold truncate text-white group-hover:text-zinc-200 transition-colors leading-tight" data-current-title>
              {currentTitle}
            </span>
            <span className="text-xs md:text-[13px] text-zinc-400 truncate mt-0.5 font-medium leading-tight">
              {pendingTrack?.artist || pendingTrack?.channelTitle || 'Play LooP'}
            </span>
          </div>
          <button 
            type="button" 
            className="p-2 rounded-full text-zinc-400 hover:text-white transition-colors shrink-0 cursor-pointer"
            onClick={handleLikeClick}
            aria-label={isLiked ? "Unlike track" : "Like track"}
            title={isLiked ? "Unlike" : "Like"}
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-white text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]' : ''}`} />
          </button>
        </div>

        {/* Center: Playback Buttons */}
        <div className="player-controls flex items-center justify-center shrink-0 mx-2" onClick={(e) => e.stopPropagation()}>
          <div className="player-buttons flex items-center gap-2 sm:gap-2.5 md:gap-3 lg:gap-4">
            <button 
              type="button" 
              className={`player-skip-button repeat-button ${isRepeatEnabled ? 'is-active text-white' : 'text-zinc-400 hover:text-white'}`}
              onClick={() => setIsRepeatEnabled(!isRepeatEnabled)}
              aria-label="Repeat"
            >
              <Repeat1 className="w-[22px] h-[22px]" />
            </button>
            <button 
              type="button" 
              className="player-skip-button text-zinc-400 hover:text-white transition-colors disabled:opacity-40"
              onClick={playPreviousTrack}
              disabled={!hasPrevious}
              aria-label="Previous track"
            >
              <SkipBack className="w-[22px] h-[22px]" />
            </button>
            <button 
              type="button" 
              className="player-skip-button seek-button text-zinc-400 hover:text-white transition-colors"
              onClick={() => seekBy(-10)} 
              aria-label="Rewind 10 seconds"
              title="Rewind 10 seconds"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <text x="12" y="15" textAnchor="middle" fill="currentColor" stroke="none" fontSize="8" fontWeight="700" fontFamily="system-ui, -apple-system, sans-serif">10</text>
              </svg>
            </button>
            <button 
              type="button" 
              className="player-button play-pause-btn text-white hover:text-white transition-colors"
              onClick={playPause}
              aria-label="Play/Pause"
            >
              {isPlaying ? (
                <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <rect x="6" y="4.5" width="4" height="15" rx="1" />
                  <rect x="14" y="4.5" width="4" height="15" rx="1" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-white translate-x-[2px]" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <path d="M7 4.5v15l12-7.5z" />
                </svg>
              )}
            </button>
            <button 
              type="button" 
              className="player-skip-button seek-button text-zinc-400 hover:text-white transition-colors"
              onClick={() => seekBy(10)} 
              aria-label="Forward 10 seconds"
              title="Forward 10 seconds"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.24L21 8" />
                <path d="M21 3v5h-5" />
                <text x="12" y="15" textAnchor="middle" fill="currentColor" stroke="none" fontSize="8" fontWeight="700" fontFamily="system-ui, -apple-system, sans-serif">10</text>
              </svg>
            </button>
            <button 
              type="button" 
              className="player-skip-button text-zinc-400 hover:text-white transition-colors disabled:opacity-40"
              onClick={playNextTrack}
              disabled={!hasNext}
              aria-label="Next track"
            >
              <SkipForward className="w-[22px] h-[22px]" />
            </button>
            <button 
              type="button" 
              className={`player-skip-button shuffle-button ${isShuffleEnabled ? 'is-active text-white' : 'text-zinc-400 hover:text-white'}`}
              onClick={() => setIsShuffleEnabled(!isShuffleEnabled)}
              aria-label="Shuffle"
            >
              <Shuffle className="w-[22px] h-[22px]" />
            </button>
          </div>
        </div>
        
        {/* Right Section: Time (00:03 / 02:33), Volume Slider & Actions */}
        <div className="flex w-1/4 min-w-0 justify-end items-center gap-2.5 xl:gap-3.5 shrink" onClick={(e) => e.stopPropagation()}>
          {/* Time Display: hidden on < 1200px (xl) to prevent overlapping */}
          <div className="hidden xl:flex text-sm text-zinc-300 font-mono font-medium select-none tracking-tight shrink-0">
            <span>{formatTimePadded(currentTime)}</span>
            <span className="mx-1 text-zinc-600">/</span>
            <span>{formatTimePadded(duration)}</span>
          </div>

          {/* Volume Control: Slider shown on lg (>= 1024px), compact icon button on smaller desktop screens */}
          <div className="hidden lg:flex items-center gap-2.5 group/volume shrink-0">
            <button
              type="button"
              className="text-zinc-400 hover:text-white transition-colors p-1.5 cursor-pointer"
              onClick={toggleMute}
              aria-label={isMuted ? "Unmute" : "Mute"}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-[22px] h-[22px]" />
              ) : volume < 0.5 ? (
                <Volume1 className="w-[22px] h-[22px]" />
              ) : (
                <Volume2 className="w-[22px] h-[22px]" />
              )}
            </button>
            <div className="relative flex items-center w-20 xl:w-28">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="volume-slider w-full"
                style={{ '--vol-percent': `${(isMuted ? 0 : volume) * 100}%` }}
                aria-label="Volume"
              />
            </div>
            <span className="hidden xl:inline text-xs font-mono font-medium text-zinc-300 w-8 text-right select-none">
              {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
            </span>
          </div>

          {/* Fallback Volume Mute Icon when slider is hidden to avoid overlapping */}
          <button
            type="button"
            className="lg:hidden text-zinc-400 hover:text-white transition-colors p-2 cursor-pointer shrink-0"
            onClick={toggleMute}
            aria-label={isMuted ? "Unmute" : "Mute"}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-[22px] h-[22px]" />
            ) : volume < 0.5 ? (
              <Volume1 className="w-[22px] h-[22px]" />
            ) : (
              <Volume2 className="w-[22px] h-[22px]" />
            )}
          </button>

          {/* Share & Queue / Sidebar Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer"
              onClick={() => shareTrack(pendingTrack)}
              aria-label="Share track"
              title="Share track"
            >
              <Share2 className="w-[22px] h-[22px]" />
            </button>
            <button
              type="button"
              className={`p-2 rounded-full transition-colors cursor-pointer ${isRightSidebarOpen ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
              onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
              aria-label="Toggle right sidebar"
              title="Now Playing View"
            >
              <ListMusic className="w-[22px] h-[22px]" />
            </button>
          </div>
        </div>
      </footer>

      {/* Mobile Compact Miniplayer Bar (Sleek 64px Bar with Like & Play/Pause) */}
      <div 
        className="md:hidden z-40 bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800/80 px-3.5 py-2 flex items-center justify-between gap-3 relative shrink-0 select-none shadow-2xl h-[64px] cursor-pointer"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => openFullPlayer(false)}
      >
        {/* Top 2px Progress Line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-zinc-800/60 pointer-events-none">
          <div 
            className="h-full bg-white transition-all duration-150" 
            style={{ width: `${progress || 0}%` }}
          />
        </div>

        {/* Left Track Info & Artwork */}
        <div 
          className={`flex items-center gap-3.5 min-w-0 flex-1 ${isSwiping ? '' : 'transition-transform duration-300 ease-out'}`}
          style={{ transform: `translateX(${swipeOffset}px)` }}
        >
          <img 
            src={(!pendingTrack?.thumbnail || pendingTrack?.thumbnail === '/logo.svg') ? '/default-cover.svg' : pendingTrack.thumbnail} 
            alt="Track thumbnail" 
            className="w-12 h-12 rounded-lg shrink-0 object-cover shadow-sm bg-black border border-white/5"
            onError={(e) => {
              e.target.src = '/default-cover.svg';
            }}
          />
          <div className="flex flex-col min-w-0 flex-1 justify-center">
            <span className="text-sm font-semibold text-white truncate leading-tight">
              {currentTitle || "Unknown Track"}
            </span>
            <span className="text-xs font-medium text-zinc-400 truncate leading-tight mt-0.5">
              {pendingTrack?.artist || pendingTrack?.channelTitle || 'Play LooP'}
            </span>
          </div>
        </div>

        {/* Right Quick Action Buttons: 1st Like, 2nd Play/Pause */}
        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button 
            type="button" 
            className="w-10 h-10 flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
            onClick={handleLikeClick}
            aria-label={isLiked ? "Unlike track" : "Like track"}
            title={isLiked ? "Unlike" : "Like"}
          >
            <Heart className={`w-6 h-6 transition-colors ${isLiked ? 'fill-white text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.9)]' : 'text-zinc-400 hover:text-white'}`} />
          </button>
          <button 
            type="button" 
            className="w-10 h-10 flex items-center justify-center text-white hover:text-zinc-200 active:scale-90 transition-transform cursor-pointer"
            onClick={playPause}
            aria-label="Play or Pause"
          >
            {isPlaying ? (
              <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <rect x="6.25" y="5.25" width="3.5" height="14.5" rx="0.75" />
                <rect x="14.25" y="5.25" width="3.5" height="14.5" rx="0.75" />
              </svg>
            ) : (
              <svg className="w-7 h-7 text-white translate-x-[1px]" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <path d="M7 4.5v15l12-7.5z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile "Up Next" Queue Bottom Sheet */}
      <div 
        className="fixed inset-0 z-[60] bg-zinc-950 flex flex-col md:hidden"
        style={{ 
          transform: isMobileQueueOpen 
            ? `translateY(${queueSwipeOffset}px)` 
            : 'translateY(100%)',
          transition: queueSwipeOffset > 0 ? 'none' : 'transform 300ms ease-out'
        }}
      >
        {/* Premium Sticky Header Morphing from Miniplayer */}
        <div 
          className="relative bg-zinc-950 overflow-hidden shrink-0 border-b border-white/5 shadow-2xl"
          onTouchStart={onQueueTouchStart}
          onTouchMove={onQueueTouchMove}
          onTouchEnd={onQueueTouchEnd}
        >
          {/* Subtle blurred background based on cover art */}
          <div 
            className="absolute inset-0 bg-cover bg-center blur-[50px] opacity-30 transition-all duration-700"
            style={{ backgroundImage: `url(${(!pendingTrack?.thumbnail || pendingTrack?.thumbnail === '/logo.svg') ? '/default-cover.svg' : pendingTrack.thumbnail})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-zinc-950/80 to-zinc-950" />

          <div className="relative z-10 pt-2 pb-5 px-5 flex flex-col gap-4">
            {/* Swipe Handle & Top Bar */}
            <div className="flex flex-col items-center justify-center">
              <div className="w-12 h-1.5 bg-white/20 rounded-full mb-4" />
              <div className="w-full flex items-center justify-between">
                <button 
                  onClick={() => setIsMobileQueueOpen(false)}
                  className="p-2 -ml-2 rounded-full bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-all active:scale-95"
                  aria-label="Close Queue"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
                <span className="text-[10px] font-bold tracking-[0.2em] text-white/60 uppercase">Now Playing</span>
                <div className="w-9" /> {/* Spacer for centering */}
              </div>
            </div>

            {/* Now Playing Info & Controls */}
            <div className="flex flex-col items-center gap-4 mt-4 mb-2">
              {/* Large Artwork */}
              <div className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-xl shadow-2xl shrink-0 overflow-hidden ring-1 ring-white/10 group">
                <img 
                  src={(!pendingTrack?.thumbnail || pendingTrack?.thumbnail === '/logo.svg') ? '/default-cover.svg' : pendingTrack.thumbnail} 
                  alt="Current" 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 bg-black"
                  onError={(e) => {
                    e.target.src = '/default-cover.svg';
                  }}
                />
              </div>

              {/* Details & Main Controls */}
              <div className="flex flex-col items-center w-full min-w-0 justify-center text-center">
                <span className="text-xl sm:text-2xl font-bold text-white truncate drop-shadow-sm mb-1 w-full px-4" title={currentTitle || "Unknown Track"}>{currentTitle || "Unknown Track"}</span>
                <span className="text-sm sm:text-base text-white/60 truncate mb-6 font-medium w-full px-4" title={pendingTrack?.channelTitle || pendingTrack?.artist || 'Unknown Artist'}>{pendingTrack?.channelTitle || pendingTrack?.artist || 'Unknown Artist'}</span>

                <div className="flex items-center justify-center gap-8 w-full">
                  <button 
                    type="button" 
                    className="text-zinc-400 hover:text-white transition-colors disabled:opacity-40 p-2"
                    onClick={playPreviousTrack}
                    disabled={!hasPrevious}
                    aria-label="Previous track"
                  >
                    <SkipBack className="w-8 h-8" />
                  </button>

                  <button 
                    type="button" 
                    className="text-white hover:scale-105 active:scale-95 transition-all flex items-center justify-center p-2"
                    onClick={playPause}
                    aria-label="Play/Pause"
                  >
                    {isPlaying ? (
                      <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                        <rect x="6.25" y="5.25" width="3.5" height="14.5" rx="0.75" />
                        <rect x="14.25" y="5.25" width="3.5" height="14.5" rx="0.75" />
                      </svg>
                    ) : (
                      <svg className="w-12 h-12 text-white translate-x-[2px]" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                        <path d="M7 4.5v15l12-7.5z" />
                      </svg>
                    )}
                  </button>

                  <button 
                    type="button" 
                    className="text-zinc-400 hover:text-white transition-colors disabled:opacity-40 p-2"
                    onClick={playNextTrack}
                    disabled={!hasNext}
                    aria-label="Next track"
                  >
                    <SkipForward className="w-8 h-8" />
                  </button>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[10px] text-white/40 font-mono w-8 text-right">{formatTime(currentTime)}</span>
              <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden relative cursor-pointer" onClick={(e) => {
                // Optional: basic tap to seek support for mobile queue header
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                seekToPercent(pos * 100);
              }}>
                <div className="absolute top-0 left-0 h-full bg-white rounded-full" style={{ width: `${progress || 0}%` }} />
              </div>
              <span className="text-[10px] text-white/40 font-mono w-8">{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        {/* Scrollable Queue */}
        <div className="flex-1 overflow-y-auto p-4 pb-20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold text-lg">Up Next</h3>
            <button
              type="button"
              onClick={refreshUpNext}
              disabled={isRefreshingUpNext}
              title="Refresh recommendations"
              aria-label="Refresh recommendations"
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded-full transition-colors flex items-center justify-center disabled:opacity-50 active:scale-95 group"
            >
              <RotateCw className={`w-4 h-4 transition-transform ${isRefreshingUpNext ? 'animate-spin text-green-500' : 'group-hover:rotate-180 duration-500'}`} />
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {(trackQueue.length > 0 ? trackQueue : recommendationQueue)
              .filter(t => t.videoId !== pendingTrack?.videoId)
              .map((track, idx) => (
              <div 
                key={`${track.videoId}-${idx}`}
                className="flex items-center gap-3 cursor-pointer group hover:bg-zinc-800/50 p-2 rounded-lg transition-colors"
                onClick={() => {
                  selectAndPlayTrack(track.videoId, track.title, track.artist, track.thumbnail);
                  setIsMobileQueueOpen(false);
                }}
              >
                <img 
                  src={(!track.thumbnail || track.thumbnail === '/logo.svg') ? '/default-cover.svg' : track.thumbnail} 
                  className="w-12 h-12 rounded-md object-cover shrink-0 bg-black border border-white/5" 
                  onError={(e) => {
                    e.target.src = '/default-cover.svg';
                  }}
                />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm text-white font-medium truncate group-hover:text-green-400 transition-colors">{track.title}</span>
                  <span className="text-xs text-zinc-400 truncate mt-0.5">{track.artist}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fullscreen Expanded Player Modal (Deferred on initial load) */}
      {(isExpanded || hasOpenedFullPlayer) && (
        <Suspense fallback={null}>
          <FullPlayer 
            isOpen={isExpanded}
            onClose={closeFullPlayer}
            initialShowLyrics={initialShowLyrics}
            pendingTrack={pendingTrack}
            isPlaying={isPlaying}
            playPause={playPause}
            currentTitle={currentTitle}
            playerStatus={playerStatus}
            progress={progress}
            currentTime={currentTime}
            duration={duration}
            playNextTrack={playNextTrack}
            playPreviousTrack={playPreviousTrack}
            seekBy={seekBy}
            seekToPercent={seekToPercent}
            isRepeatEnabled={isRepeatEnabled}
            setIsRepeatEnabled={setIsRepeatEnabled}
            isShuffleEnabled={isShuffleEnabled}
            setIsShuffleEnabled={setIsShuffleEnabled}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
            formatTime={formatTime}
          />
        </Suspense>
      )}
    </>
  );
}

