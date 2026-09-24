import React, { useEffect, useState, useRef } from 'react';
import { ChevronDown, Play, Pause, Shuffle, SkipBack, SkipForward, Repeat1, ChartBar, RotateCcw, RotateCw } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

export default function FullPlayer({
  isOpen,
  onClose,
  initialShowLyrics = false,
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
  const { playerButtonStyle = 'white', lyricsData, isLyricsLoading, seekToTime } = usePlayer();
  const [showLyrics, setShowLyrics] = useState(initialShowLyrics);
  const [coverAnim, setCoverAnim] = useState('');
  const mobileLyricsScrollRef = useRef(null);
  const mobileLyricsListRef = useRef(null);
  const desktopLyricsScrollRef = useRef(null);
  const desktopLyricsListRef = useRef(null);
  const touchStartY = useRef(null);
  const touchStartX = useRef(null);
  const userInteractingRef = useRef(false);
  const userInteractionTimer = useRef(null);

  // Reset animation when track changes
  useEffect(() => {
    setCoverAnim('');
  }, [pendingTrack]);

  useEffect(() => {
    if (isOpen) {
      setShowLyrics(Boolean(initialShowLyrics));
      userInteractingRef.current = false;
    }
  }, [isOpen, initialShowLyrics]);

  // HD Thumbnail resolution handling with fallback
  const [imgSrc, setImgSrc] = useState('/logo.svg');
  const [fallbackIndex, setFallbackIndex] = useState(0);

  useEffect(() => {
    if (!pendingTrack) return;

    // Always reset to cover art when switching tracks
    setShowLyrics(false);
    userInteractingRef.current = false;

    const videoId = pendingTrack.videoId;
    const rawThumb = pendingTrack.thumbnail || '';

    const candidates = [];
    if (rawThumb && rawThumb.includes('saavncdn.com')) {
      candidates.push(rawThumb.replace('150x150', '500x500'));
      candidates.push(rawThumb);
    } else if (videoId && (rawThumb.includes('ytimg.com') || !rawThumb)) {
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
    if (rawThumb && rawThumb.includes('saavncdn.com')) {
      candidates.push(rawThumb.replace('150x150', '500x500'));
      candidates.push(rawThumb);
    } else if (videoId && (rawThumb.includes('ytimg.com') || !rawThumb)) {
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

  const syncedLyrics = Array.isArray(lyricsData?.syncedLyrics) ? lyricsData.syncedLyrics : [];

  let activeLyricIndex = -1;
  if (syncedLyrics.length > 0) {
    for (let i = syncedLyrics.length - 1; i >= 0; i--) {
      if (currentTime >= syncedLyrics[i].time) {
        activeLyricIndex = i;
        break;
      }
    }
  }

  // Handle user interaction with lyrics to pause auto-scrolling for 3 seconds
  const handleUserInteraction = () => {
    userInteractingRef.current = true;
    if (userInteractionTimer.current) {
      clearTimeout(userInteractionTimer.current);
    }
    userInteractionTimer.current = setTimeout(() => {
      userInteractingRef.current = false;
    }, 3000);
  };

  useEffect(() => {
    if (activeLyricIndex >= 0 && !userInteractingRef.current) {
      try {
        if (showLyrics && mobileLyricsListRef.current) {
          const activeEl = mobileLyricsListRef.current.children?.[activeLyricIndex];
          if (activeEl && typeof activeEl.scrollIntoView === 'function') {
            activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
        if (desktopLyricsListRef.current) {
          const activeEl = desktopLyricsListRef.current.children?.[activeLyricIndex];
          if (activeEl && typeof activeEl.scrollIntoView === 'function') {
            activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      } catch (e) { }
    }
  }, [activeLyricIndex, showLyrics]);

  if (!pendingTrack) return null;

  const isDefaultLogo = !imgSrc || imgSrc === '/logo.svg';

  const renderLyricsContent = (listRef) => {
    if (isLyricsLoading) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center space-y-3 h-full min-h-[200px]">
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-zinc-400 font-medium">Fetching synchronized lyrics...</span>
        </div>
      );
    }
    if (lyricsData?.isInstrumental) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4 h-full min-h-[200px]">
          <span className="text-white font-semibold text-sm mb-1">Instrumental Track</span>
          <span className="text-xs text-zinc-400">This track does not contain vocal lyrics.</span>
        </div>
      );
    }
    if (syncedLyrics.length > 0) {
      return (
        <div ref={listRef} className="space-y-3 py-16 text-center md:text-left my-auto">
          {syncedLyrics.map((line, idx) => {
            const isActive = idx === activeLyricIndex;
            return (
              <p
                key={idx}
                onClick={() => {
                  if (seekToTime) seekToTime(line.time);
                  userInteractingRef.current = false;
                  if (userInteractionTimer.current) clearTimeout(userInteractionTimer.current);
                }}
                className={`cursor-pointer transition-all duration-300 px-3 py-2 rounded-xl select-none ${isActive
                  ? 'text-white font-extrabold text-lg sm:text-xl md:text-2xl scale-105 drop-shadow-[0_0_16px_rgba(255,255,255,0.8)] md:drop-shadow-none bg-white/10 md:bg-transparent backdrop-blur-md md:backdrop-blur-none border-l-2 border-white md:border-none pl-4 md:pl-0 md:scale-100'
                  : 'text-zinc-400 hover:text-zinc-200 text-sm sm:text-base md:text-lg opacity-60 hover:opacity-100'
                  }`}
              >
                {line.text}
              </p>
            );
          })}
        </div>
      );
    }
    if (lyricsData?.plainLyrics) {
      return (
        <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap text-center md:text-left py-4 h-full min-h-[200px]">
          {lyricsData.plainLyrics}
        </div>
      );
    }
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-4 h-full min-h-[200px]">
        <ChartBar className="w-8 h-8 text-zinc-600 mb-2" />
        <span className="text-sm text-zinc-300 font-medium">No Synced Lyrics Found</span>
        <span className="text-xs text-zinc-500 mt-1">Enjoy the music!</span>
      </div>
    );
  };

  const handleProgressChange = (e) => {
    seekToPercent(e.target.value);
  };

  const renderPlayPauseButton = () => {
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

  const getSecondaryBtnClass = (isActive = false) => {
    return isActive
      ? 'text-white filter drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]'
      : 'text-zinc-400 hover:text-white';
  };

  const handleTouchStart = (e) => {
    if (e.touches && e.touches[0]) {
      touchStartY.current = e.touches[0].clientY;
      touchStartX.current = e.touches[0].clientX;
    }
  };

  const handleTouchMoveCover = (e) => {
    if (touchStartY.current !== null && touchStartX.current !== null && e.touches && e.touches[0]) {
      const deltaY = e.touches[0].clientY - touchStartY.current;
      const deltaX = e.touches[0].clientX - touchStartX.current;
      // Vertical swipe up to show lyrics
      if (deltaY < -20) {
        setShowLyrics(true);
        touchStartY.current = null;
        touchStartX.current = null;
        return;
      }
      // Swipe left for next track
      if (deltaX < -30) {
        setCoverAnim('animate-slide-left');
        setTimeout(() => {
          playNextTrack();
          setCoverAnim('');
        }, 500);
        touchStartY.current = null;
        touchStartX.current = null;
        return;
      }
      // Swipe right for previous track
      if (deltaX > 30) {
        setCoverAnim('animate-slide-right');
        setTimeout(() => {
          playPreviousTrack();
          setCoverAnim('');
        }, 500);
        touchStartY.current = null;
        touchStartX.current = null;
        return;
      }
    }
  };

  const handleTouchMoveLyrics = (e) => {
    if (touchStartY.current !== null && e.touches && e.touches[0]) {
      const deltaY = e.touches[0].clientY - touchStartY.current;
      const scrollTop = mobileLyricsScrollRef.current?.scrollTop || 0;
      // Swiping DOWN (deltaY > 25) ONLY at top of lyrics (scrollTop <= 5) returns to cover art
      if (deltaY > 25 && scrollTop <= 5) {
        setShowLyrics(false);
        touchStartY.current = null;
      }
    }
  };

  const handleWheelCover = (e) => {
    if (e.deltaY > 10 || e.deltaY < -10) {
      setShowLyrics(true);
    }
  };

  const handleWheelLyrics = (e) => {
    const scrollTop = mobileLyricsScrollRef.current?.scrollTop || 0;
    if (e.deltaY < -10 && scrollTop <= 5) {
      setShowLyrics(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col justify-between bg-zinc-950 text-white transition-all duration-300 ${isOpen ? 'animate-slide-up' : 'animate-slide-down'} select-none overflow-y-auto md:overflow-hidden overscroll-none`}
      role="dialog"
      aria-modal="true"
      aria-label="Expanded Music Player"
    >
      {/* Background Ambient Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10 opacity-30">
        {!isDefaultLogo ? (
          <img
            src={imgSrc}
            alt=""
            className="w-full h-full object-cover blur-3xl scale-150 transition-all duration-700"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-zinc-800/40 via-zinc-950/90 to-zinc-950 blur-2xl" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/70 via-zinc-950/90 to-zinc-950" />
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
          <span className="text-xs sm:text-sm font-medium text-white/90 truncate max-w-[200px] sm:max-w-xs">
            {playerStatus || "Playing"}
          </span>
        </div>

        <div className="w-10" />
      </header>

      {/* Main Content Area */}
      <main className={`flex-1 flex flex-col md:flex-row items-center md:items-stretch justify-center px-6 py-4 mx-auto w-full h-full min-h-0 transition-all duration-500 ease-in-out ${
        showLyrics 
          ? 'max-w-lg md:max-w-5xl lg:max-w-6xl md:gap-12 lg:gap-20' 
          : 'max-w-lg md:gap-0'
      }`}>

        {/* Left Side: Art & Controls */}
        <div className={`w-full flex flex-col items-center justify-center transition-all duration-500 ease-in-out shrink-0 ${
          showLyrics
            ? 'max-w-[300px] sm:max-w-[340px] md:max-w-[340px] lg:max-w-[360px]'
            : 'max-w-[340px] sm:max-w-[380px] md:max-w-[380px]'
        }`}>
          {/* Animated Dual Viewport Container for Artwork & Lyrics */}
          <div className={`relative w-full aspect-square overflow-hidden rounded-2xl select-none shadow-[0_25px_60px_rgba(0,0,0,0.9)] z-10 shrink-0 transition-all duration-500 ease-in-out ${
            showLyrics
              ? 'max-w-[300px] sm:max-w-[340px] md:max-w-[340px] lg:max-w-[360px] mb-4 md:mb-6'
              : 'max-w-[340px] sm:max-w-[380px] md:max-w-[380px] mb-6'
          }`}>
            {/* Album Artwork Container */}
            <div
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMoveCover}
              onWheel={handleWheelCover}
              title="Scroll or swipe UP to view lyrics"
              className={`absolute inset-0 w-full h-full rounded-2xl overflow-hidden border border-white/10 group flex items-center justify-center bg-zinc-950 touch-none transition-all duration-500 ease-out transform ${coverAnim} ${showLyrics
                ? '-translate-y-full opacity-0 pointer-events-none scale-95 md:translate-y-0 md:opacity-100 md:pointer-events-auto md:scale-100'
                : 'translate-y-0 opacity-100 pointer-events-auto scale-100 z-10'
                }`}
            >
              {!isDefaultLogo ? (
                <img
                  src={imgSrc}
                  alt={currentTitle || 'Track cover'}
                  onError={handleImageError}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black relative">
                  <div className="absolute inset-0 bg-white/5 blur-2xl rounded-full scale-75 pointer-events-none" />
                  <img
                    src="/logo.svg"
                    alt="Play LooP"
                    className="w-24 h-24 sm:w-28 sm:h-28 object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.4)] mb-3 transition-transform duration-500 group-hover:scale-110"
                  />
                  <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Play LooP</span>
                </div>
              )}

              {/* Micro hint overlay */}
              <div className="absolute bottom-3 inset-x-0 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none md:hidden">
                <span className="bg-black/75 backdrop-blur-md text-[11px] font-medium text-white px-3.5 py-1.5 rounded-full border border-white/20 flex items-center gap-1.5 shadow-lg">
                  <ChartBar className="w-3.5 h-3.5" /> Scroll / Swipe UP for Lyrics
                </span>
              </div>
            </div>

            {/* Mobile Lyrics Container */}
            <div
              ref={mobileLyricsScrollRef}
              onScroll={handleUserInteraction}
              onTouchStart={(e) => {
                handleTouchStart(e);
                handleUserInteraction();
              }}
              onTouchMove={handleTouchMoveLyrics}
              onWheel={(e) => {
                handleWheelLyrics(e);
                handleUserInteraction();
              }}
              className={`absolute inset-0 w-full h-full rounded-2xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl p-4 overflow-y-auto flex flex-col scrollbar-none shadow-[0_20px_50px_rgba(0,0,0,0.9)] transition-all duration-500 ease-out transform md:hidden ${showLyrics
                ? 'translate-y-0 opacity-100 pointer-events-auto scale-100 z-10'
                : 'translate-y-full opacity-0 pointer-events-none scale-95'
                }`}
            >
              {renderLyricsContent(mobileLyricsListRef)}
            </div>
          </div>

          {/* Track Title, Artist, and Right-Aligned YouTube Music Style Lyrics Pill Button */}
          <div className="w-full flex items-end justify-between gap-4 mb-5 select-none relative z-20">
            <div className="flex-1 min-w-0 text-left">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight line-clamp-2 mb-1 drop-shadow-none">
                {currentTitle || "Unknown Track"}
              </h2>
              <p className="text-zinc-400 text-sm sm:text-base font-medium truncate">
                {pendingTrack?.channelTitle || pendingTrack?.artist || "Play LooP"}
              </p>
            </div>

            {/* YouTube Music style Circular Rectangle (Pill) Lyrics Button */}
            <button
              type="button"
              onClick={() => setShowLyrics(!showLyrics)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium tracking-normal transition-all cursor-pointer border shrink-0 select-none ${showLyrics
                ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.4)] scale-105 font-medium'
                : 'bg-white/10 hover:bg-white/20 text-white border-white/15 backdrop-blur-md shadow-md active:scale-95'
                }`}
              title={showLyrics ? "Close Lyrics" : "Show Lyrics"}
              aria-label={showLyrics ? "Close Lyrics" : "Show Lyrics"}
            >
              <ChartBar className={`w-4 h-4 ${showLyrics ? 'text-black' : 'text-white'}`} />
              <span>Lyrics</span>
            </button>
          </div>

          {/* Scrubbing / Progress Bar */}
          <div className="w-full flex flex-col gap-2 mb-6 relative z-20">
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
          <div className="w-full flex items-center justify-between px-1 relative z-20">
            {/* Repeat */}
            <button
              type="button"
              className={`p-2 sm:p-2.5 rounded-full transition-all cursor-pointer ${getSecondaryBtnClass(isRepeatEnabled)}`}
              onClick={() => setIsRepeatEnabled(!isRepeatEnabled)}
              aria-label="Repeat"
            >
              <Repeat1 className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Previous Track */}
            <button
              type="button"
              className={`p-2 sm:p-2.5 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer ${getSecondaryBtnClass(false)}`}
              onClick={() => {
                setCoverAnim('animate-slide-right');
                setTimeout(() => {
                  playPreviousTrack();
                  setCoverAnim('');
                }, 500);
              }}
              disabled={!hasPrevious}
              aria-label="Previous track"
            >
              <SkipBack className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>

            {/* Rewind 10s */}
            <button
              type="button"
              className={`p-2.5 sm:p-3 rounded-full transition-all cursor-pointer hidden sm:flex ${showLyrics ? 'md:hidden lg:flex' : ''} ${getSecondaryBtnClass(false)}`}
              onClick={() => seekBy(-10)}
              aria-label="Rewind 10 seconds"
              title="Rewind 10 seconds"
            >
              <div className="relative flex items-center justify-center">
                <RotateCcw className="w-6 h-6 sm:w-7 sm:h-7" />
                <span className="absolute text-[9px] font-bold font-sans translate-y-[0.5px]">10</span>
              </div>
            </button>

            {/* Main Play / Pause Button */}
            {renderPlayPauseButton()}

            {/* Forward 10s */}
            <button
              type="button"
              className={`p-2.5 sm:p-3 rounded-full transition-all cursor-pointer hidden sm:flex ${showLyrics ? 'md:hidden lg:flex' : ''} ${getSecondaryBtnClass(false)}`}
              onClick={() => seekBy(10)}
              aria-label="Forward 10 seconds"
              title="Forward 10 seconds"
            >
              <div className="relative flex items-center justify-center">
                <RotateCw className="w-6 h-6 sm:w-7 sm:h-7" />
                <span className="absolute text-[9px] font-bold font-sans translate-y-[0.5px]">10</span>
              </div>
            </button>

            {/* Next Track */}
            <button
              type="button"
              className={`p-2 sm:p-2.5 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer ${getSecondaryBtnClass(false)}`}
              onClick={() => {
                setCoverAnim('animate-slide-left');
                setTimeout(() => {
                  playNextTrack();
                  setCoverAnim('');
                }, 500);
              }}
              disabled={!hasNext}
              aria-label="Next track"
            >
              <SkipForward className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>

            {/* Shuffle */}
            <button
              type="button"
              className={`p-2 sm:p-2.5 rounded-full transition-all cursor-pointer ${getSecondaryBtnClass(isShuffleEnabled)}`}
              onClick={() => setIsShuffleEnabled(!isShuffleEnabled)}
              aria-label="Shuffle"
            >
              <Shuffle className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>

        {/* Right Side: Desktop Lyrics */}
        <div className={`hidden md:flex flex-col h-full relative mt-8 md:mt-0 min-h-0 transition-all duration-500 ease-in-out overflow-hidden ${
          showLyrics 
            ? 'w-[50%] max-w-[500px] opacity-100 translate-x-0' 
            : 'w-0 opacity-0 translate-x-10'
        }`}>
          <div
            ref={desktopLyricsScrollRef}
            onScroll={handleUserInteraction}
            onWheel={(e) => {
              handleUserInteraction();
            }}
            className="w-full h-full overflow-y-auto scrollbar-none py-32 px-4 md:px-8 flex flex-col"
            style={{ WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)' }}
          >
            {renderLyricsContent(desktopLyricsListRef)}
          </div>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="py-4 px-6 shrink-0 flex items-center justify-center text-xs text-zinc-500 border-t border-white/5">
        <span>Play LooP Player</span>
      </footer>
    </div>
  );
}

