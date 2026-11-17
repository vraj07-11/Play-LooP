import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  RotateCcw,
  RotateCw,
  Heart,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  X,
  Music,
  Check,
  Repeat,
  Search,
  Library,
  Play
} from 'lucide-react';

export const GESTURE_TUTORIAL_SEEN_KEY = 'playloop_gesture_tutorial_seen';

export default function MobileGestureTutorial({ forceOpen = false, onClose }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepFeedback, setStepFeedback] = useState(null);
  const [hasTestedCurrent, setHasTestedCurrent] = useState(false);

  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
  const isDraggingRef = useRef(false);
  const playgroundTapRef = useRef({ time: 0, x: 0, y: 0 });

  const [swipeOffset, setSwipeOffset] = useState(0);
  const [verticalSwipeOffset, setVerticalSwipeOffset] = useState(0);
  const [mockLyricsOpen, setMockLyricsOpen] = useState(false);
  const [mockFullPlayerOpen, setMockFullPlayerOpen] = useState(false);
  const [mockTabIndex, setMockTabIndex] = useState(0);

  useEffect(() => {
    const handleOpenEvent = (e) => {
      const step = e?.detail?.step !== undefined ? Number(e.detail.step) : 0;
      setCurrentStep(step);
      setIsOpen(true);
      setStepFeedback(null);
      setHasTestedCurrent(false);
      setMockLyricsOpen(false);
      setMockFullPlayerOpen(false);
      setMockTabIndex(0);
    };

    window.addEventListener('playloop-open-gesture-tutorial', handleOpenEvent);

    if (forceOpen) {
      setIsOpen(true);
    }

    return () => {
      window.removeEventListener('playloop-open-gesture-tutorial', handleOpenEvent);
    };
  }, [forceOpen]);

  const handleClose = useCallback(() => {
    try {
      localStorage.setItem(GESTURE_TUTORIAL_SEEN_KEY, 'true');
    } catch (_) {}
    setIsOpen(false);
    setStepFeedback(null);
    if (typeof onClose === 'function') {
      onClose();
    }
  }, [onClose]);

  const triggerHaptic = (pattern = 15) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch (_) {}
    }
  };

  const steps = [
    {
      id: 'skip',
      tag: 'DOUBLE TAP',
      title: 'Skip 10 Seconds',
      description: 'Double tap the left side to rewind 10s, or the right side to jump ahead 10s.',
      hint: 'Double tap left or right on the artwork'
    },
    {
      id: 'like',
      tag: 'DOUBLE TAP',
      title: 'Double Tap to Like',
      description: 'Double tap the center of the cover art to save the song to your liked tracks.',
      hint: 'Double tap the center of the artwork'
    },
    {
      id: 'track-swipe',
      tag: 'SWIPE',
      title: 'Change Song',
      description: 'Swipe left across the artwork for the next song, or swipe right for the previous one.',
      hint: 'Swipe horizontally across the card'
    },
    {
      id: 'lyrics-swipe',
      tag: 'SWIPE UP',
      title: 'Open Lyrics',
      description: 'Swipe up on the cover art to open synchronized lyrics. Swipe down to return to cover art.',
      hint: 'Swipe up to open, swipe down to close'
    },
    {
      id: 'miniplayer-swipe',
      tag: 'SWIPE UP',
      title: 'Expand Player',
      description: 'Swipe up on the bottom miniplayer to expand to full player. Swipe down from top to minimize.',
      hint: 'Swipe up on the miniplayer bar'
    },
    {
      id: 'tab-swipe',
      tag: 'SWIPE',
      title: 'Switch Views',
      description: 'Swipe left or right anywhere across the screen to glide between Home, Loops, Search, and Library.',
      hint: 'Swipe left or right to switch views'
    }
  ];

  const handleNext = () => {
    triggerHaptic(10);
    setStepFeedback(null);
    setHasTestedCurrent(false);
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    triggerHaptic(10);
    setStepFeedback(null);
    setHasTestedCurrent(false);
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // Card Touch gesture handlers for interactive testing
  const handleCardTouchStart = (e) => {
    if (!e.touches || !e.touches[0]) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now()
    };
    isDraggingRef.current = true;
  };

  const handleCardTouchMove = (e) => {
    if (!isDraggingRef.current || !e.touches || !e.touches[0]) return;
    const deltaX = e.touches[0].clientX - touchStartRef.current.x;
    const deltaY = e.touches[0].clientY - touchStartRef.current.y;

    if (currentStep === 2 || currentStep === 5) {
      setSwipeOffset(deltaX * 0.7);
    } else if (currentStep === 3 || currentStep === 4) {
      setVerticalSwipeOffset(deltaY * 0.7);
    }
  };

  const handleCardTouchEnd = (e) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const endX = e.changedTouches?.[0]?.clientX || 0;
    const endY = e.changedTouches?.[0]?.clientY || 0;
    const deltaX = endX - touchStartRef.current.x;
    const deltaY = endY - touchStartRef.current.y;

    if (currentStep === 2) {
      if (deltaX < -35) {
        triggerHaptic(20);
        setStepFeedback({ type: 'next', text: 'Next Track' });
        setHasTestedCurrent(true);
      } else if (deltaX > 35) {
        triggerHaptic(20);
        setStepFeedback({ type: 'prev', text: 'Previous Track' });
        setHasTestedCurrent(true);
      }
    }

    if (currentStep === 3) {
      if (deltaY < -25) {
        triggerHaptic(20);
        setMockLyricsOpen(true);
        setStepFeedback({ type: 'lyrics', text: 'Lyrics Opened' });
        setHasTestedCurrent(true);
      } else if (deltaY > 25) {
        triggerHaptic(20);
        setMockLyricsOpen(false);
      }
    }

    if (currentStep === 4) {
      if (deltaY < -25) {
        triggerHaptic(20);
        setMockFullPlayerOpen(true);
        setStepFeedback({ type: 'expand', text: 'Player Expanded' });
        setHasTestedCurrent(true);
      } else if (deltaY > 25) {
        triggerHaptic(20);
        setMockFullPlayerOpen(false);
      }
    }

    if (currentStep === 5) {
      if (deltaX < -30) {
        triggerHaptic(15);
        setMockTabIndex(prev => Math.min(prev + 1, 3));
        setStepFeedback({ type: 'tab', text: 'View Switched' });
        setHasTestedCurrent(true);
      } else if (deltaX > 30) {
        triggerHaptic(15);
        setMockTabIndex(prev => Math.max(prev - 1, 0));
        setStepFeedback({ type: 'tab', text: 'View Switched' });
        setHasTestedCurrent(true);
      }
    }

    // Double tap handling on touch
    if (currentStep === 0 || currentStep === 1) {
      const now = Date.now();
      const last = playgroundTapRef.current;
      const diff = now - last.time;
      const dist = Math.hypot(endX - last.x, endY - last.y);

      if (diff > 30 && diff < 380 && dist < 50) {
        const rect = e.currentTarget.getBoundingClientRect();
        const relX = (endX - rect.left) / rect.width;
        playgroundTapRef.current = { time: 0, x: 0, y: 0 };
        triggerHaptic([15, 35, 15]);

        if (currentStep === 0) {
          if (relX < 0.45) {
            setStepFeedback({ type: 'rewind', text: '-10s' });
          } else {
            setStepFeedback({ type: 'forward', text: '+10s' });
          }
          setHasTestedCurrent(true);
        } else if (currentStep === 1) {
          setStepFeedback({ type: 'like', text: 'Liked' });
          setHasTestedCurrent(true);
        }
      } else {
        playgroundTapRef.current = { time: now, x: endX, y: endY };
      }
    }

    setSwipeOffset(0);
    setVerticalSwipeOffset(0);
  };

  const handlePlaygroundClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const relX = x / rect.width;
    const now = Date.now();
    const last = playgroundTapRef.current;
    const diff = now - last.time;

    if (diff > 30 && diff < 380) {
      playgroundTapRef.current = { time: 0, x: 0, y: 0 };
      triggerHaptic([15, 40, 15]);

      if (currentStep === 0) {
        if (relX < 0.45) {
          setStepFeedback({ type: 'rewind', text: '-10 SEC' });
        } else {
          setStepFeedback({ type: 'forward', text: '+10 SEC' });
        }
        setHasTestedCurrent(true);
      } else if (currentStep === 1) {
        setStepFeedback({ type: 'like', text: 'Liked' });
        setHasTestedCurrent(true);
      }

      setTimeout(() => {
        setStepFeedback(prev => (prev?.id === now ? null : prev));
      }, 1000);
    } else {
      playgroundTapRef.current = { time: now, x, y: e.clientY - rect.top };
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStep, handleClose]);

  if (!isOpen) return null;

  const current = steps[currentStep];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mobile Gestures Tutorial"
      className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center bg-black/90 backdrop-blur-md animate-fade-in select-none p-0 sm:p-4 touch-none"
    >
      {/* Modal Container: Solid Monochrome AMOLED */}
      <div className="relative w-full max-w-sm bg-[#000000] border-t sm:border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Top Bar */}
        <div className="px-5 pt-4 pb-2 flex items-center justify-between border-b border-white/10">
          <span className="text-xs uppercase font-bold tracking-wider text-white">
            Mobile Gestures
          </span>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-zinc-400">
              {currentStep + 1} / {steps.length}
            </span>
            <button
              type="button"
              onClick={handleClose}
              className="p-1 rounded-full text-zinc-400 hover:text-white transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Segmented Step Progress Bar */}
        <div className="px-5 pt-3 pb-1 flex items-center gap-1.5">
          {steps.map((st, idx) => (
            <button
              key={st.id}
              type="button"
              onClick={() => {
                triggerHaptic(10);
                setCurrentStep(idx);
                setStepFeedback(null);
              }}
              className="flex-1 h-1 rounded-full transition-all duration-200 cursor-pointer overflow-hidden bg-zinc-800"
              aria-label={`Step ${idx + 1}`}
            >
              <div
                className={`h-full transition-all duration-200 ${
                  idx <= currentStep ? 'bg-white w-full' : 'w-0'
                }`}
              />
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="px-5 pt-3 pb-3 flex flex-col items-center flex-1 overflow-y-auto">
          <div className="mb-1 text-[11px] font-mono tracking-widest uppercase text-zinc-400">
            {current.tag}
          </div>

          <h2 className="text-lg font-bold text-white text-center mb-1">
            {current.title}
          </h2>
          <p className="text-xs text-zinc-400 text-center leading-relaxed max-w-xs mb-3">
            {current.description}
          </p>

          {/* Interactive Preview Canvas */}
          <div className="w-full flex flex-col items-center">
            <div
              onTouchStart={handleCardTouchStart}
              onTouchMove={handleCardTouchMove}
              onTouchEnd={handleCardTouchEnd}
              onClick={handlePlaygroundClick}
              className="relative w-60 h-60 rounded-xl bg-[#0e0e11] border border-white/10 overflow-hidden cursor-pointer flex flex-col items-center justify-center select-none active:border-white/30 transition-colors"
            >
              {/* STEP 0: SKIP 10s */}
              {currentStep === 0 && (
                <div className="relative w-full h-full flex items-center justify-center p-3">
                  <div className="absolute inset-0 bg-[#121216] flex items-center justify-center">
                    <div className="w-24 h-24 rounded-lg bg-black/70 border border-white/10 flex flex-col items-center justify-center">
                      <Music className="w-8 h-8 text-white/40 mb-1" />
                      <span className="text-[10px] font-mono text-zinc-400">Cover Art</span>
                    </div>
                  </div>

                  <div className="absolute inset-y-0 left-0 w-1/2 border-r border-white/10 flex flex-col items-center justify-center bg-black/30">
                    <RotateCcw className="w-5 h-5 text-white/70 mb-0.5" />
                    <span className="text-[9px] font-bold text-white tracking-widest">-10 SEC</span>
                    <span className="text-[8px] text-zinc-400">Double tap</span>
                  </div>

                  <div className="absolute inset-y-0 right-0 w-1/2 flex flex-col items-center justify-center bg-black/30">
                    <RotateCw className="w-5 h-5 text-white/70 mb-0.5" />
                    <span className="text-[9px] font-bold text-white tracking-widest">+10 SEC</span>
                    <span className="text-[8px] text-zinc-400">Double tap</span>
                  </div>

                  {/* Looping Touch Animation */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div
                      className="w-8 h-8 rounded-full border border-white bg-white/20"
                      style={{ animation: 'gesture-hand-double-tap-left 3.2s ease-in-out infinite' }}
                    />
                  </div>

                  {stepFeedback && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 animate-gesture-badge-pop">
                      <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mb-1">
                        {stepFeedback.type === 'rewind' ? (
                          <RotateCcw className="w-6 h-6 text-white" />
                        ) : (
                          <RotateCw className="w-6 h-6 text-white" />
                        )}
                      </div>
                      <span className="text-xs font-bold text-white tracking-widest">
                        {stepFeedback.text}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 1: INSTANT LIKE */}
              {currentStep === 1 && (
                <div className="relative w-full h-full flex items-center justify-center p-3">
                  <div className="absolute inset-0 bg-[#121216] flex items-center justify-center">
                    <div className="w-24 h-24 rounded-lg bg-black/70 border border-white/10 flex items-center justify-center">
                      <Heart className="w-10 h-10 text-white/30" />
                    </div>
                  </div>

                  <div className="relative z-10 w-20 h-20 rounded-full border border-dashed border-white/30 flex flex-col items-center justify-center bg-black/40">
                    <Heart className="w-7 h-7 text-white" />
                    <span className="text-[8px] font-medium text-zinc-300 mt-1">Tap Center</span>
                  </div>

                  {/* Finger animation */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div
                      className="w-8 h-8 rounded-full border border-white bg-white/20"
                      style={{ animation: 'gesture-hand-double-tap-center 2.8s ease-in-out infinite' }}
                    />
                  </div>

                  {stepFeedback && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 animate-gesture-badge-pop">
                      <div className="w-14 h-14 rounded-full bg-white/15 border border-white/30 flex items-center justify-center mb-1">
                        <Heart className="w-8 h-8 text-white fill-white" />
                      </div>
                      <span className="text-xs font-bold text-white tracking-widest mt-1">
                        Liked
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: SWIPE TO CHANGE TRACK */}
              {currentStep === 2 && (
                <div className="relative w-full h-full flex items-center justify-center p-3 overflow-hidden">
                  <div
                    className="w-44 h-44 rounded-lg bg-[#141418] border border-white/15 flex flex-col items-center justify-center p-3 transition-transform duration-200"
                    style={{ transform: `translateX(${swipeOffset}px)` }}
                  >
                    <div className="w-16 h-16 rounded bg-black/60 border border-white/10 flex items-center justify-center mb-2">
                      <Music className="w-7 h-7 text-white/60" />
                    </div>
                    <span className="text-xs font-bold text-white text-center truncate max-w-[130px]">
                      {stepFeedback ? stepFeedback.text : 'Now Playing'}
                    </span>
                    <span className="text-[10px] text-zinc-400">Play LooP</span>

                    <div className="w-full flex items-center justify-between mt-2.5 px-2 text-zinc-500">
                      <ChevronLeft className="w-4 h-4" />
                      <span className="text-[8px] uppercase tracking-wider text-zinc-400">Swipe</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div
                      className="w-8 h-8 rounded-full border border-white bg-white/20"
                      style={{ animation: 'gesture-hand-swipe-left 2.5s ease-in-out infinite' }}
                    />
                  </div>

                  {stepFeedback && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white text-black text-[10px] font-bold tracking-wider animate-gesture-badge-pop whitespace-nowrap shadow-md">
                      {stepFeedback.text}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: SWIPE UP FOR LYRICS */}
              {currentStep === 3 && (
                <div className="relative w-full h-full flex flex-col items-center justify-center p-3 overflow-hidden">
                  <div
                    className={`w-full h-full rounded-lg transition-all duration-300 flex flex-col items-center justify-center p-3 ${
                      mockLyricsOpen
                        ? 'bg-[#141418] border border-white/20'
                        : 'bg-[#101014] border border-white/10'
                    }`}
                    style={{ transform: `translateY(${verticalSwipeOffset}px)` }}
                  >
                    {mockLyricsOpen ? (
                      <div className="w-full space-y-2 text-center animate-fade-in">
                        <span className="text-[9px] font-mono tracking-widest uppercase text-zinc-400">
                          Synced Lyrics
                        </span>
                        <p className="text-[10px] text-zinc-500">Previous line...</p>
                        <p className="text-xs font-bold text-white bg-white/10 py-1 rounded px-2">
                          Active lyrical line
                        </p>
                        <p className="text-[10px] text-zinc-400">Upcoming line...</p>
                        <span className="text-[8px] text-zinc-500 block pt-1">Swipe down to close</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-16 rounded bg-black/60 border border-white/10 flex items-center justify-center mb-2">
                          <Music className="w-7 h-7 text-white/50" />
                        </div>
                        <div className="flex items-center gap-1 text-zinc-300 mt-1">
                          <ChevronUp className="w-4 h-4" />
                          <span className="text-[9px] font-bold tracking-wider uppercase">
                            Swipe Up for Lyrics
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {!mockLyricsOpen && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div
                        className="w-8 h-8 rounded-full border border-white bg-white/20"
                        style={{ animation: 'gesture-hand-swipe-up 2.6s ease-in-out infinite' }}
                      />
                    </div>
                  )}

                  {stepFeedback && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white text-black text-[10px] font-bold tracking-wider animate-gesture-badge-pop whitespace-nowrap shadow-md">
                      {stepFeedback.text}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: SWIPE UP ON MINIPLAYER */}
              {currentStep === 4 && (
                <div className="relative w-full h-full flex flex-col justify-end p-2.5 overflow-hidden bg-[#0c0c0e]">
                  {mockFullPlayerOpen ? (
                    <div className="absolute inset-0 bg-black p-3 flex flex-col items-center justify-between animate-fade-in z-20">
                      <div className="flex items-center justify-between w-full text-zinc-400">
                        <ChevronDown className="w-4 h-4 text-white" />
                        <span className="text-[9px] font-bold tracking-widest uppercase">Full Player</span>
                        <div className="w-4" />
                      </div>
                      <div className="w-20 h-20 rounded bg-[#141418] border border-white/10 flex items-center justify-center">
                        <Music className="w-8 h-8 text-white/60" />
                      </div>
                      <span className="text-[9px] text-zinc-400">Swipe down to minimize</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 flex flex-col items-center justify-center text-zinc-600">
                        <span className="text-[9px] uppercase font-bold tracking-wider mb-1">Page View</span>
                        <div className="w-24 h-1.5 rounded bg-zinc-800 mb-1" />
                        <div className="w-16 h-1.5 rounded bg-zinc-800" />
                      </div>

                      {/* MiniPlayer */}
                      <div
                        className="w-full h-12 rounded-lg bg-[#141418] border border-white/15 p-2 flex items-center justify-between"
                        style={{ transform: `translateY(${verticalSwipeOffset}px)` }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded bg-black border border-white/10 flex items-center justify-center">
                            <Music className="w-3.5 h-3.5 text-white/70" />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-white block">Song Title</span>
                            <span className="text-[8px] text-zinc-400 block">Artist</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <ChevronUp className="w-3.5 h-3.5 text-white/60" />
                          <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-black">
                            <Play className="w-2.5 h-2.5 fill-black ml-0.5" />
                          </div>
                        </div>
                      </div>

                      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 pointer-events-none">
                        <div
                          className="w-8 h-8 rounded-full border border-white bg-white/20"
                          style={{ animation: 'gesture-hand-swipe-up 2.4s ease-in-out infinite' }}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* STEP 5: GLIDE BETWEEN TABS */}
              {currentStep === 5 && (
                <div className="relative w-full h-full flex flex-col justify-between p-2.5 bg-[#0a0a0c]">
                  <div
                    className="flex-1 rounded-lg bg-[#121216] border border-white/10 p-3 flex flex-col items-center justify-center transition-transform duration-200"
                    style={{ transform: `translateX(${swipeOffset}px)` }}
                  >
                    <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-1">
                      {['Home', 'Loops', 'Search', 'Library'][mockTabIndex]}
                    </span>
                    <span className="text-xs font-bold text-white">
                      {['Discover Feed', 'Short Loops', 'Search Catalog', 'Your Playlists'][mockTabIndex]}
                    </span>
                  </div>

                  <div className="w-full h-10 rounded bg-[#121216] border border-white/10 flex items-center justify-around px-2 mt-2">
                    {[
                      { icon: Music, label: 'Home' },
                      { icon: Repeat, label: 'Loops' },
                      { icon: Search, label: 'Search' },
                      { icon: Library, label: 'Library' }
                    ].map((tab, idx) => {
                      const Icon = tab.icon;
                      const active = mockTabIndex === idx;
                      return (
                        <div
                          key={tab.label}
                          className={`flex flex-col items-center transition-all ${
                            active ? 'text-white' : 'text-zinc-600'
                          }`}
                        >
                          <Icon className="w-3 h-3" />
                          <span className="text-[7px] font-bold mt-0.5">{tab.label}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div
                      className="w-8 h-8 rounded-full border border-white bg-white/20"
                      style={{ animation: 'gesture-hand-swipe-left 2.5s ease-in-out infinite' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Hint text */}
            <div className="mt-2 text-center">
              {hasTestedCurrent ? (
                <div className="inline-flex items-center gap-1 text-white text-xs font-medium">
                  <Check className="w-3.5 h-3.5" />
                  <span>Tested successfully</span>
                </div>
              ) : (
                <span className="text-[11px] text-zinc-500">
                  {current.hint}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="px-5 py-3 border-t border-white/10 flex items-center justify-between gap-3 bg-[#000000]">
          {currentStep > 0 ? (
            <button
              type="button"
              onClick={handlePrev}
              className="px-4 py-2 rounded-full border border-white/10 text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          )}

          <button
            type="button"
            onClick={handleNext}
            className="flex-1 py-2 px-5 rounded-full bg-white hover:bg-zinc-200 active:scale-95 text-black text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>{currentStep === steps.length - 1 ? 'Start Listening' : 'Next'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
}
