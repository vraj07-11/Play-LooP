import React, { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { Play, Pause, Shuffle, SkipBack, SkipForward, Repeat1, ChevronUp, ChevronDown, RotateCcw, RotateCw, ListMusic } from 'lucide-react';
import FullPlayer from './FullPlayer';

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
    pendingTrack,
    isRightSidebarOpen, setIsRightSidebarOpen,
    trackQueue, recommendationQueue, selectAndPlayTrack
  } = usePlayer();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobileQueueOpen, setIsMobileQueueOpen] = useState(false);
  const [initialShowLyrics, setInitialShowLyrics] = useState(false);
  const progressRef = useRef(null);

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

    window.addEventListener('playloop-toggle-lyrics', handleToggleLyrics);
    window.addEventListener('playloop-toggle-full-player', handleToggleFullPlayer);
    return () => {
      window.removeEventListener('playloop-toggle-lyrics', handleToggleLyrics);
      window.removeEventListener('playloop-toggle-full-player', handleToggleFullPlayer);
    };
  }, [pendingTrack, isExpanded]);

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
      setIsMobileQueueOpen(true);
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

  return (
    <>
      <footer 
        className="player-bar z-40 bg-zinc-900 border-t border-zinc-800 p-4 flex flex-col md:flex-row items-center justify-between gap-4 overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Clickable track cover & title section */}
        <div 
          className={`player-track flex items-center gap-4 w-full md:w-1/3 min-w-0 cursor-pointer group hover:opacity-95 select-none ${isSwiping ? '' : 'transition-transform duration-300 ease-out'}`}
          style={{ transform: `translateX(${swipeOffset}px)` }}
          onClick={() => openFullPlayer(false)}
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
              src={pendingTrack?.thumbnail || '/logo.svg'} 
              alt="Track thumbnail" 
              className={`w-14 h-14 rounded-md ${(!pendingTrack?.thumbnail || pendingTrack?.thumbnail === '/logo.svg') ? 'object-contain p-2 bg-black border border-zinc-900' : 'object-cover'}`}
              onError={(e) => {
                e.target.src = '/logo.svg';
                e.target.className = 'w-14 h-14 rounded-md shrink-0 object-contain p-2 bg-black border border-zinc-900';
              }}
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
              <ChevronUp className="w-6 h-6 text-white translate-y-0.5" />
            </div>
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="player-status text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-1 truncate" data-player-status>
              {playerStatus}
            </span>
            <div className="player-title-row flex items-center gap-2">
              <span className="player-title text-sm font-semibold truncate text-white group-hover:text-zinc-200 transition-colors" data-current-title>
                {currentTitle}
              </span>
            </div>
          </div>
        </div>

        <div className="player-controls flex flex-col items-center w-full md:w-1/3 max-w-lg">
          <div className="player-buttons flex items-center gap-3 md:gap-4 mb-2">
            <button 
              type="button" 
              className={`player-skip-button repeat-button ${isRepeatEnabled ? 'is-active text-white' : 'text-zinc-400 hover:text-white'}`}
              onClick={() => setIsRepeatEnabled(!isRepeatEnabled)}
              aria-label="Repeat"
            >
              <Repeat1 className="w-5 h-5" />
            </button>
            <button 
              type="button" 
              className="player-skip-button text-zinc-400 hover:text-white transition-colors disabled:opacity-40"
              onClick={playPreviousTrack}
              disabled={!hasPrevious}
              aria-label="Previous track"
            >
              <SkipBack className="w-5 h-5" />
            </button>
            <button 
              type="button" 
              className="player-skip-button seek-button text-zinc-400 hover:text-white transition-colors"
              onClick={() => seekBy(-10)} 
              aria-label="Rewind 10 seconds"
              title="Rewind 10 seconds"
            >
              <div className="relative flex items-center justify-center">
                <RotateCcw className="w-5 h-5" />
                <span className="absolute text-[8px] font-bold font-sans translate-y-[0.5px]">10</span>
              </div>
            </button>
            <button 
              type="button" 
              className="player-button play-pause-btn text-white hover:text-white transition-colors"
              onClick={playPause}
              aria-label="Play/Pause"
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
            <button 
              type="button" 
              className="player-skip-button seek-button text-zinc-400 hover:text-white transition-colors"
              onClick={() => seekBy(10)} 
              aria-label="Forward 10 seconds"
              title="Forward 10 seconds"
            >
              <div className="relative flex items-center justify-center">
                <RotateCw className="w-5 h-5" />
                <span className="absolute text-[8px] font-bold font-sans translate-y-[0.5px]">10</span>
              </div>
            </button>
            <button 
              type="button" 
              className="player-skip-button text-zinc-400 hover:text-white transition-colors disabled:opacity-40"
              onClick={playNextTrack}
              disabled={!hasNext}
              aria-label="Next track"
            >
              <SkipForward className="w-5 h-5" />
            </button>
            <button 
              type="button" 
              className={`player-skip-button shuffle-button ${isShuffleEnabled ? 'is-active text-white' : 'text-zinc-400 hover:text-white'}`}
              onClick={() => setIsShuffleEnabled(!isShuffleEnabled)}
              aria-label="Shuffle"
            >
              <Shuffle className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2 w-full">
            <span className="text-xs text-zinc-400 min-w-[40px] text-right font-mono">{formatTime(currentTime)}</span>
            <input 
              ref={progressRef}
              className="progress-bar flex-1 cursor-pointer outline-none"
              style={{ '--progress': `${progress || 0}%` }}
              type="range" 
              min="0" max="100" step="0.1"
              value={progress || 0}
              onChange={handleProgressChange}
              onInput={handleProgressChange}
              aria-label="Track progress"
            />
            <span className="text-xs text-zinc-400 min-w-[40px] font-mono">{formatTime(duration)}</span>
          </div>
        </div>
        
        <div className="hidden md:flex w-1/3 justify-end items-center pr-2">
          <button
            type="button"
            className={`p-2 rounded-full transition-colors ${isRightSidebarOpen ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
            onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
            aria-label="Toggle right sidebar"
            title="Now Playing View"
          >
            <ListMusic className="w-5 h-5" />
          </button>
        </div>
      </footer>

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
            style={{ backgroundImage: `url(${pendingTrack?.thumbnail || '/logo.svg'})` }}
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
                  src={pendingTrack?.thumbnail || '/logo.svg'} 
                  alt="Current" 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  onError={(e) => {
                    e.target.src = '/logo.svg';
                  }}
                />
              </div>

              {/* Details & Main Controls */}
              <div className="flex flex-col items-center w-full min-w-0 justify-center text-center">
                <span className="text-xl sm:text-2xl font-bold text-white truncate drop-shadow-sm mb-1 w-full px-4">{currentTitle}</span>
                <span className="text-sm sm:text-base text-white/60 truncate mb-6 font-medium w-full px-4">{pendingTrack?.artist || 'Unknown Artist'}</span>

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
          <h3 className="text-white font-semibold mb-4 text-lg">Up Next</h3>
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
                  src={track.thumbnail || '/logo.svg'} 
                  className="w-12 h-12 rounded-md object-cover shrink-0" 
                  onError={(e) => {
                    e.target.src = '/logo.svg';
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

      {/* Fullscreen Expanded Player Modal */}
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
    </>
  );
}

