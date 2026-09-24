import React, { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { Play, Pause, Shuffle, SkipBack, SkipForward, Repeat1, ChevronUp, RotateCcw, RotateCw } from 'lucide-react';
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
    pendingTrack
  } = usePlayer();

  const [isExpanded, setIsExpanded] = useState(false);
  const progressRef = useRef(null);

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

  const openFullPlayer = () => {
    if (!isExpanded) {
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
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const minSwipeDistance = 50;

  // Hide the player bar if nothing is pending
  if (!pendingTrack) return null;

  const onTouchStart = (e) => {
    touchStartX.current = e.targetTouches[0].clientX;
    setIsSwiping(true);
  };

  const onTouchMove = (e) => {
    if (!touchStartX.current) return;
    const currentX = e.targetTouches[0].clientX;
    const diff = currentX - touchStartX.current;
    
    // Add resistance if they are swiping but can't go that way
    if ((diff < 0 && !hasPrevious) || (diff > 0 && !hasNext)) {
      setSwipeOffset(diff * 0.2);
    } else {
      setSwipeOffset(diff);
    }
  };

  const onTouchEnd = () => {
    if (!touchStartX.current) return;
    const distance = -swipeOffset; // positive = left swipe (finger moved left)
    
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    // Swipe Left = Next Track
    if (isLeftSwipe && hasNext) {
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
          onClick={openFullPlayer}
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
        
        <div className="hidden md:flex w-1/3 justify-end items-center" />
      </footer>

      {/* Fullscreen Expanded Player Modal */}
      <FullPlayer 
        isOpen={isExpanded}
        onClose={closeFullPlayer}
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

