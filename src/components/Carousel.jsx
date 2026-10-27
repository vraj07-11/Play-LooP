import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Play, FolderPlus, ListStart, ListMusic, Share2, X } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

export default function Carousel({ 
  title, 
  headerSubtitle,
  headerAction,
  items, 
  onItemClick, 
  onPlayClick, 
  renderSubtitle, 
  keyExtractor, 
  cardType = 'square', 
  onEndReached,
  isLoading = false,
  isLoadingMore = false 
}) {
  const rowRef = useRef(null);
  const { addToUpNext, addToQueue } = usePlayer();
  const [activeMenuIndex, setActiveMenuIndex] = useState(null);

  const longPressTimerRef = useRef(null);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const isLongPressActiveRef = useRef(false);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.carousel-card-menu-container')) {
        setActiveMenuIndex(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setActiveMenuIndex(null);
    };
    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleTouchStart = (index, e) => {
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    isLongPressActiveRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(40); } catch (_) {}
      }
      setActiveMenuIndex(index);
    }, 450);
  };

  const handleTouchMove = (e) => {
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

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleMenuAction = (action, item) => {
    setActiveMenuIndex(null);
    const trackObj = {
      videoId: item.videoId || item.id,
      title: item.title,
      artist: item.artist || item.author,
      thumbnail: item.thumbnail || item.cover || item.artwork || item.albumArt || '/default-cover.svg'
    };

    if (action === 'playlist') {
      window.dispatchEvent(new CustomEvent('playloop-open-add-to-playlist', { detail: trackObj }));
    } else if (action === 'playNext') {
      if (typeof addToUpNext === 'function') addToUpNext(trackObj);
    } else if (action === 'queue') {
      if (typeof addToQueue === 'function') addToQueue(trackObj);
    } else if (action === 'share') {
      window.dispatchEvent(new CustomEvent('playloop-open-share', { detail: trackObj }));
    }
  };

  const scroll = (direction) => {
    if (!rowRef.current) return;
    const scrollAmount = direction === 'left' ? -350 : 350;
    
    if (direction === 'right' && onEndReached) {
      const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
      if (scrollWidth - (scrollLeft + scrollAmount) - clientWidth < 300) {
        onEndReached();
      }
    }
    
    rowRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  const handleScroll = (e) => {
    if (!onEndReached) return;
    const { scrollLeft, scrollWidth, clientWidth } = e.currentTarget;
    if (scrollWidth - scrollLeft - clientWidth < 300) {
      onEndReached();
    }
  };

  const renderSkeletonCard = (type, index) => {
    if (type === 'wide') {
      return (
        <div 
          key={`loading-wide-${index}`} 
          className="wide-card relative bg-[#141416] border border-white/5 overflow-hidden skeleton-shimmer-card flex-shrink-0"
        >
          <div className="wide-card-overlay flex items-end justify-between p-3 sm:p-4">
            <div className="wide-card-info flex flex-col gap-1.5 min-w-0 flex-1">
              <div className="h-4 sm:h-4.5 bg-zinc-700/80 rounded w-2/3" />
              <div className="h-3 sm:h-3.5 bg-zinc-800/60 rounded w-1/3" />
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-800/80 shrink-0 ml-2" />
          </div>
        </div>
      );
    }
    if (type === 'circle') {
      return (
        <div 
          key={`loading-circle-${index}`} 
          className="flex-none w-[150px] md:w-[170px] flex flex-col items-center gap-3 p-2 relative"
        >
          <div className="w-full aspect-square rounded-full shadow-xl bg-zinc-800/90 border border-white/5 overflow-hidden skeleton-shimmer-card" />
          <div className="w-full px-1 flex flex-col items-center gap-1.5">
            <div className="h-4 bg-zinc-700/80 rounded w-3/4" />
            <div className="h-3 bg-zinc-800/50 rounded w-1/2" />
          </div>
        </div>
      );
    }
    return (
      <div 
        key={`loading-square-${index}`} 
        className="square-card relative flex-shrink-0"
      >
        <div className="square-card-art-wrapper">
          <div className="w-full aspect-square rounded-lg bg-zinc-800/90 border border-white/5 overflow-hidden skeleton-shimmer-card shadow-md" />
        </div>
        <div className="square-card-info flex flex-col gap-1.5">
          <div className="h-4 bg-zinc-700/80 rounded w-5/6" />
          <div className="h-3 bg-zinc-800/50 rounded w-3/5" />
        </div>
      </div>
    );
  };

  if ((!items || items.length === 0) && !isLoading) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          {typeof title === 'string' ? (
            <h3 className="text-xl font-medium tracking-tight text-white">{title}</h3>
          ) : (
            title
          )}
          {headerSubtitle}
        </div>
        {headerAction}
      </div>

      <div className="carousel-wrapper relative group/carousel">
        <button 
          type="button" 
          onClick={() => scroll('left')}
          className="carousel-arrow-btn left-arrow opacity-0 group-hover/carousel:opacity-100 transition-opacity"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>

        <div ref={rowRef} className="horizontal-scroll-row" onScroll={handleScroll}>
          {(items || []).map((item, index) => {
            if (cardType === 'wide') {
              return (
                <div 
                  key={keyExtractor ? keyExtractor(item, index) : index} 
                  className="wide-card group"
                  onClick={() => onItemClick && onItemClick(item, index)}
                >
                  <img 
                    src={(!item.thumbnail && !item.cover && !item.artwork) ? '/default-cover.svg' : (item.thumbnail || item.cover || item.artwork || item.albumArt || '/default-cover.svg').replace('/logo.svg', '/default-cover.svg')} 
                    alt={item.title} 
                    className="wide-card-art"
                    onError={(e) => {
                      e.target.src = '/default-cover.svg';
                    }}
                    loading="lazy"
                  />
                  <div className="wide-card-overlay">
                    <div className="wide-card-info">
                      <h4 className="wide-card-title">{item.title}</h4>
                      <p className="wide-card-subtitle">
                        {renderSubtitle ? renderSubtitle(item) : (item.author || item.artist || 'Collection')}
                      </p>
                    </div>
                    <button 
                      type="button" 
                      className="wide-card-play-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onPlayClick) onPlayClick(item, index);
                        else if (onItemClick) onItemClick(item, index);
                      }}
                      aria-label={`Play ${item.title}`}
                    >
                      <Play className="w-5 h-5 fill-current text-black translate-x-[1px]" />
                    </button>
                  </div>
                </div>
              );
            }

            if (cardType === 'circle') {
              return (
                <div 
                  key={keyExtractor ? keyExtractor(item, index) : index} 
                  className="flex-none w-[150px] md:w-[170px] flex flex-col items-center gap-3 p-2 cursor-pointer group transition-transform hover:-translate-y-1"
                  onClick={() => onItemClick && onItemClick(item, index)}
                >
                  <div className="relative w-full aspect-square rounded-full overflow-hidden shadow-xl bg-black border border-white/5">
                    <img 
                    src={(!item.thumbnail && !item.cover && !item.artwork) ? '/default-cover.svg' : (item.thumbnail || item.cover || item.artwork || item.albumArt || '/default-cover.svg').replace('/logo.svg', '/default-cover.svg')} 
                    alt={item.title} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    onError={(e) => {
                      e.target.src = '/default-cover.svg';
                    }}
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <button 
                      type="button" 
                      className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-transform"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onPlayClick) onPlayClick(item, index);
                        else if (onItemClick) onItemClick(item, index);
                      }}
                      aria-label={`Play ${item.title}`}
                    >
                      <Play className="w-5 h-5 fill-current text-black translate-x-[2px]" />
                    </button>
                  </div>
                </div>
                <div className="text-center w-full px-1">
                  <h4 className="text-[15px] font-bold text-white truncate">{item.title}</h4>
                  <p className="text-[13px] text-zinc-400 font-medium truncate mt-0.5">
                    {renderSubtitle ? renderSubtitle(item) : 'Artist'}
                  </p>
                </div>
              </div>
            );
          }

          return (
            <div 
              key={keyExtractor ? keyExtractor(item, index) : index} 
              className="square-card relative select-none"
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveMenuIndex(activeMenuIndex === index ? null : index);
              }}
              onTouchStart={(e) => handleTouchStart(index, e)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              onClick={() => {
                if (isLongPressActiveRef.current) {
                  isLongPressActiveRef.current = false;
                  return;
                }
                if (onItemClick) onItemClick(item, index);
              }}
            >
              <div className="square-card-art-wrapper">
                <div className="square-card-vinyl-container">
                  <div className="square-card-vinyl"></div>
                </div>
                <div className="square-card-art-container bg-black border border-white/5">
                  <img 
                    src={(!item.thumbnail && !item.cover && !item.artwork) ? '/default-cover.svg' : (item.thumbnail || item.cover || item.artwork || item.albumArt || '/default-cover.svg').replace('/logo.svg', '/default-cover.svg')} 
                    alt={item.title} 
                    className="square-card-art object-cover"
                    onError={(e) => {
                      e.target.src = '/default-cover.svg';
                    }}
                    loading="lazy"
                    decoding="async"
                  />
                  <button 
                    type="button" 
                    className="square-card-play-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onPlayClick) onPlayClick(item, index);
                      else if (onItemClick) onItemClick(item, index);
                    }}
                    aria-label={`Play ${item.title}`}
                  >
                    <Play className="w-5 h-5 fill-current text-black translate-x-[1px]" />
                  </button>

                  {/* Context / Hold Options Menu Overlay */}
                  {activeMenuIndex === index && (
                    <div
                      className="carousel-card-menu-container absolute inset-0 bg-zinc-950/95 backdrop-blur-md rounded-lg p-2.5 z-30 flex flex-col justify-between shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-150"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between pb-1 border-b border-white/10">
                        <span className="text-[11px] font-bold text-white truncate max-w-[120px]">{item.title}</span>
                        <button
                          type="button"
                          onClick={() => setActiveMenuIndex(null)}
                          className="p-1 text-zinc-400 hover:text-white cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex flex-col gap-1 py-0.5">
                        <button
                          type="button"
                          onClick={() => handleMenuAction('playlist', item)}
                          className="w-full px-2 py-1.5 text-xs text-left text-zinc-200 hover:text-white hover:bg-white/10 rounded-lg flex items-center gap-2 transition cursor-pointer"
                        >
                          <FolderPlus className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Add to Playlist</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMenuAction('playNext', item)}
                          className="w-full px-2 py-1.5 text-xs text-left text-zinc-200 hover:text-white hover:bg-white/10 rounded-lg flex items-center gap-2 transition cursor-pointer"
                        >
                          <ListStart className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Play Next</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMenuAction('queue', item)}
                          className="w-full px-2 py-1.5 text-xs text-left text-zinc-200 hover:text-white hover:bg-white/10 rounded-lg flex items-center gap-2 transition cursor-pointer"
                        >
                          <ListMusic className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Add to Queue</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMenuAction('share', item)}
                          className="w-full px-2 py-1.5 text-xs text-left text-zinc-200 hover:text-white hover:bg-white/10 rounded-lg flex items-center gap-2 transition cursor-pointer"
                        >
                          <Share2 className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Share Track</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
                <div className="square-card-info">
                  <h4 className="square-card-title">{item.title}</h4>
                  <p className="square-card-subtitle">
                    {renderSubtitle ? renderSubtitle(item) : (item.author || item.artist || 'Collection')}
                  </p>
                </div>
              </div>
            );
          })}

          {isLoading && (!items || items.length === 0) && (
            [...Array(6)].map((_, idx) => renderSkeletonCard(cardType, idx))
          )}

          {isLoadingMore && (
            [...Array(2)].map((_, idx) => renderSkeletonCard(cardType, idx))
          )}
        </div>

        <button 
          type="button" 
          onClick={() => scroll('right')}
          className="carousel-arrow-btn right-arrow opacity-0 group-hover/carousel:opacity-100 transition-opacity"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );
}
