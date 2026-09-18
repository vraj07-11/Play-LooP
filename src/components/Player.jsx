import React, { useEffect, useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { Play, Pause, Shuffle, SkipBack, SkipForward, Repeat1 } from 'lucide-react';

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

  const progressRef = useRef(null);

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleProgressChange = (e) => {
    seekToPercent(e.target.value);
  };

  // The original UI hides the player bar if nothing is pending
  if (!pendingTrack) return null;

  return (
    <footer className="player-bar z-40 bg-zinc-900 border-t border-zinc-800 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="player-track flex items-center gap-4 w-full md:w-1/3 min-w-0">
        {pendingTrack?.thumbnail && (
          <img src={pendingTrack.thumbnail} alt="Track thumbnail" className="w-14 h-14 rounded-md object-cover shrink-0" />
        )}
        <div className="flex flex-col flex-1 min-w-0">
          <span className="player-status text-xs text-green-500 font-semibold uppercase tracking-wider mb-1 truncate" data-player-status>
            {playerStatus}
          </span>
          <div className="player-title-row flex items-center gap-2">
            <span className="player-title text-sm font-semibold truncate text-white" data-current-title>
              {currentTitle}
            </span>
          </div>
        </div>
      </div>

      <div className="player-controls flex flex-col items-center w-full md:w-1/3 max-w-lg">
        <div className="player-buttons flex items-center gap-3 md:gap-4 mb-2">
          <button 
            type="button" 
            className={`player-skip-button repeat-button ${isRepeatEnabled ? 'is-active text-emerald-500' : 'text-zinc-400 hover:text-white'}`}
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
          >
            <svg className="seek-icon w-[1.65rem] h-[1.65rem] sm:w-[1.25rem] sm:h-[1.25rem]" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" strokeWidth="3.2" stroke="currentColor" fill="none">
              <polyline points="9.57 15.41 12.17 24.05 20.81 21.44" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M26.93,41.41V23a.09.09,0,0,0-.16-.07s-2.58,3.69-4.17,4.78" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="32.19" y="22.52" width="11.41" height="18.89" rx="5.7" />
              <path d="M12.14,23.94a21.91,21.91,0,1,1-.91,13.25" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
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
          >
            <svg className="seek-icon w-[1.65rem] h-[1.65rem] sm:w-[1.25rem] sm:h-[1.25rem]" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" strokeWidth="3.2" stroke="currentColor" fill="none">
              <path d="M23.93,41.41V23a.09.09,0,0,0-.16-.07s-2.58,3.69-4.17,4.78" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="29.19" y="22.52" width="11.41" height="18.89" rx="5.7" />
              <polyline points="54.43 15.41 51.83 24.05 43.19 21.44" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M51.86,23.94a21.91,21.91,0,1,0,.91,13.25" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
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
            className={`player-skip-button shuffle-button ${isShuffleEnabled ? 'is-active text-emerald-500' : 'text-zinc-400 hover:text-white'}`}
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
  );
}
