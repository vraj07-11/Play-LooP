import React, { useEffect, useState } from 'react';
import { ChevronDown, Play, Pause, Shuffle, SkipBack, SkipForward, Repeat1 } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

export default function FullPlayer({
  isOpen,
  onClose,
  pendingTrack,
  isPlaying,
  playPause,
  currentTitle,
  playerStatus,
  progress,
  currentTime,
  duration,
  playNextTrack,
  playPreviousTrack,
  seekBy,
  seekToPercent,
  isRepeatEnabled,
  setIsRepeatEnabled,
  isShuffleEnabled,
  setIsShuffleEnabled,
  hasPrevious,
  hasNext,
  formatTime
}) {
  const { playerButtonStyle = 'white' } = usePlayer();

  // HD Thumbnail resolution handling with fallback
  const [imgSrc, setImgSrc] = useState('/logo.svg');
  const [fallbackIndex, setFallbackIndex] = useState(0);

  useEffect(() => {
    if (!pendingTrack) return;

    const videoId = pendingTrack.videoId;
    const rawThumb = pendingTrack.thumbnail || '';

    const candidates = [];
    if (videoId) {
      candidates.push(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`);
      candidates.push(`https://i.ytimg.com/vi/${videoId}/sddefault.jpg`);
      candidates.push(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);
    } else if (rawThumb && rawThumb !== '/logo.svg') {
      candidates.push(rawThumb.replace(/hqdefault|mqdefault|default|sddefault/g, 'maxresdefault'));
      candidates.push(rawThumb.replace(/hqdefault|mqdefault|default/g, 'sddefault'));
      candidates.push(rawThumb);
    }
    candidates.push('/logo.svg');

    setFallbackIndex(0);
    setImgSrc(candidates[0]);
  }, [pendingTrack]);

  const handleImageError = () => {
    if (!pendingTrack) return;
    const videoId = pendingTrack.videoId;
    const rawThumb = pendingTrack.thumbnail || '';

    const candidates = [];
    if (videoId) {
      candidates.push(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`);
      candidates.push(`https://i.ytimg.com/vi/${videoId}/sddefault.jpg`);
      candidates.push(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);
    } else if (rawThumb && rawThumb !== '/logo.svg') {
      candidates.push(rawThumb.replace(/hqdefault|mqdefault|default|sddefault/g, 'maxresdefault'));
      candidates.push(rawThumb.replace(/hqdefault|mqdefault|default/g, 'sddefault'));
      candidates.push(rawThumb);
    }
    candidates.push('/logo.svg');

    const nextIndex = fallbackIndex + 1;
    if (nextIndex < candidates.length) {
      setFallbackIndex(nextIndex);
      setImgSrc(candidates[nextIndex]);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !pendingTrack) return null;

  const handleProgressChange = (e) => {
    seekToPercent(e.target.value);
  };

  // Helper for rendering Play/Pause main button
  const renderPlayPauseButton = () => {
    if (playerButtonStyle === 'emerald') {
      return (
        <button 
          type="button" 
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-emerald-500 to-emerald-400 text-black flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.55)] hover:shadow-[0_0_35px_rgba(16,185,129,0.8)] hover:scale-105 active:scale-95 transition-all cursor-pointer border border-emerald-300/30 shrink-0"
          onClick={playPause}
          aria-label="Play or Pause"
        >
          {isPlaying ? (
            <Pause className="w-7 h-7 sm:w-8 sm:h-8 fill-black text-black" />
          ) : (
            <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-black text-black translate-x-[2px]" />
          )}
        </button>
      );
    }

    if (playerButtonStyle === 'glass') {
      return (
        <button 
          type="button" 
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-zinc-900/80 backdrop-blur-md text-emerald-400 border-2 border-emerald-400/60 flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.35)] hover:shadow-[0_0_35px_rgba(16,185,129,0.6)] hover:border-emerald-400 hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
          onClick={playPause}
          aria-label="Play or Pause"
        >
          {isPlaying ? (
            <Pause className="w-7 h-7 sm:w-8 sm:h-8 fill-emerald-400 text-emerald-400" />
          ) : (
            <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-emerald-400 text-emerald-400 translate-x-[2px]" />
          )}
        </button>
      );
    }

    // Default 'white' style (Ultra-Clean White Pearl)
    return (
      <button 
        type="button" 
        className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_25px_rgba(255,255,255,0.4)] hover:shadow-[0_0_35px_rgba(255,255,255,0.65)] hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
        onClick={playPause}
        aria-label="Play or Pause"
      >
        {isPlaying ? (
          <Pause className="w-7 h-7 sm:w-8 sm:h-8 fill-black text-black" />
        ) : (
          <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-black text-black translate-x-[2px]" />
        )}
      </button>
    );
  };

  // Helper classes for secondary toolbar buttons depending on theme
  const getSecondaryBtnClass = (isActive = false) => {
    if (playerButtonStyle === 'emerald') {
      return isActive 
        ? 'text-emerald-400 hover:text-emerald-300 drop-shadow-[0_0_8px_rgba(16,185,129,0.7)]' 
        : 'text-zinc-400 hover:text-emerald-400';
    }
    if (playerButtonStyle === 'glass') {
      return isActive 
        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.3)]' 
        : 'bg-zinc-900/60 border border-white/10 text-zinc-300 hover:text-white hover:border-emerald-400/40';
    }
    // White Pearl default
    return isActive 
      ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' 
      : 'text-zinc-400 hover:text-white';
  };

  const isDefaultLogo = !imgSrc || imgSrc === '/logo.svg';

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col justify-between bg-zinc-950/95 text-white backdrop-blur-2xl transition-all duration-300 animate-slide-up select-none overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Expanded Music Player"
    >
      {/* Background Ambient Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10 opacity-35">
        {!isDefaultLogo ? (
          <img 
            src={imgSrc} 
            alt="" 
            className="w-full h-full object-cover blur-3xl scale-150 transition-all duration-700"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-emerald-950/40 via-zinc-950/80 to-zinc-950 blur-2xl" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/60 via-zinc-950/85 to-zinc-950" />
      </div>

      {/* Header */}
      <header className="flex items-center justify-between px-6 pt-6 pb-2 shrink-0">
        <button 
          type="button"
          onClick={onClose}
          className="p-2 -ml-2 rounded-full text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Minimize player"
        >
          <ChevronDown className="w-7 h-7" />
        </button>

        <div className="flex flex-col items-center">
          <span className="text-[10px] sm:text-xs uppercase tracking-widest text-zinc-400 font-semibold">
            Playing From Queue
          </span>
          <span className="text-xs sm:text-sm font-medium text-emerald-400 truncate max-w-[200px] sm:max-w-xs">
            {playerStatus || "Playing"}
          </span>
        </div>

        <div className="w-7 h-7" aria-hidden="true" />
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-4 max-w-lg mx-auto w-full">
        {/* Album Artwork Container */}
        <div className="relative w-full max-w-[320px] sm:max-w-[360px] aspect-square mb-8 rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/10 group flex items-center justify-center bg-zinc-950">
          {!isDefaultLogo ? (
            <img 
              src={imgSrc} 
              alt={currentTitle || 'Track cover'} 
              onError={handleImageError}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black relative">
              <div className="absolute inset-0 bg-emerald-500/10 blur-2xl rounded-full scale-75 pointer-events-none" />
              <img 
                src="/logo.svg" 
                alt="Play LooP" 
                className="w-24 h-24 sm:w-28 sm:h-28 object-contain drop-shadow-[0_0_20px_rgba(16,185,129,0.6)] mb-3 transition-transform duration-500 group-hover:scale-110" 
              />
              <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400/80">Play LooP</span>
            </div>
          )}
        </div>

        {/* Track Title and Artist */}
        <div className="w-full text-left mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight line-clamp-2 mb-1">
            {currentTitle || "Unknown Track"}
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base font-medium truncate">
            {pendingTrack?.channelTitle || pendingTrack?.artist || "Play LooP"}
          </p>
        </div>

        {/* Scrubbing / Progress Bar */}
        <div className="w-full flex flex-col gap-2 mb-6">
          <input 
            className="progress-bar flex-1 cursor-pointer outline-none h-2"
            style={{ '--progress': `${progress || 0}%` }}
            type="range" 
            min="0" max="100" step="0.1"
            value={progress || 0}
            onChange={handleProgressChange}
            onInput={handleProgressChange}
            aria-label="Track progress slider"
          />
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Media Control Toolbar */}
        <div className="w-full flex items-center justify-between px-1">
          {/* Shuffle */}
          <button 
            type="button" 
            className={`p-2 sm:p-2.5 rounded-full transition-all cursor-pointer ${getSecondaryBtnClass(isShuffleEnabled)}`}
            onClick={() => setIsShuffleEnabled(!isShuffleEnabled)}
            aria-label="Shuffle"
          >
            <Shuffle className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          {/* Previous Track */}
          <button 
            type="button" 
            className={`p-2 sm:p-2.5 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer ${getSecondaryBtnClass(false)}`}
            onClick={playPreviousTrack}
            disabled={!hasPrevious}
            aria-label="Previous track"
          >
            <SkipBack className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>

          {/* Rewind 10s */}
          <button 
            type="button" 
            className={`p-2.5 sm:p-3 rounded-full transition-all cursor-pointer ${getSecondaryBtnClass(false)}`}
            onClick={() => seekBy(-10)} 
            aria-label="Rewind 10 seconds"
            title="Rewind 10 seconds"
          >
            <svg className="w-8 h-8 sm:w-9 sm:h-9" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" strokeWidth="3.2" stroke="currentColor" fill="none">
              <polyline points="9.57 15.41 12.17 24.05 20.81 21.44" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M26.93,41.41V23a.09.09,0,0,0-.16-.07s-2.58,3.69-4.17,4.78" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="32.19" y="22.52" width="11.41" height="18.89" rx="5.7" />
              <path d="M12.14,23.94a21.91,21.91,0,1,1-.91,13.25" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Main Play / Pause Button */}
          {renderPlayPauseButton()}

          {/* Forward 10s */}
          <button 
            type="button" 
            className={`p-2.5 sm:p-3 rounded-full transition-all cursor-pointer ${getSecondaryBtnClass(false)}`}
            onClick={() => seekBy(10)} 
            aria-label="Forward 10 seconds"
            title="Forward 10 seconds"
          >
            <svg className="w-8 h-8 sm:w-9 sm:h-9" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" strokeWidth="3.2" stroke="currentColor" fill="none">
              <path d="M23.93,41.41V23a.09.09,0,0,0-.16-.07s-2.58,3.69-4.17,4.78" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="29.19" y="22.52" width="11.41" height="18.89" rx="5.7" />
              <polyline points="54.43 15.41 51.83 24.05 43.19 21.44" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M51.86,23.94a21.91,21.91,0,1,0,.91,13.25" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Next Track */}
          <button 
            type="button" 
            className={`p-2 sm:p-2.5 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer ${getSecondaryBtnClass(false)}`}
            onClick={playNextTrack}
            disabled={!hasNext}
            aria-label="Next track"
          >
            <SkipForward className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>

          {/* Repeat */}
          <button 
            type="button" 
            className={`p-2 sm:p-2.5 rounded-full transition-all cursor-pointer ${getSecondaryBtnClass(isRepeatEnabled)}`}
            onClick={() => setIsRepeatEnabled(!isRepeatEnabled)}
            aria-label="Repeat"
          >
            <Repeat1 className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="py-4 px-6 shrink-0 flex items-center justify-center text-xs text-zinc-500 border-t border-white/5">
        <span>Play LooP Player</span>
      </footer>
    </div>
  );
}

