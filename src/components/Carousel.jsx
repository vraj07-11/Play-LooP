import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';

export default function Carousel({ 
  title, 
  items, 
  onItemClick, 
  onPlayClick, 
  renderSubtitle, 
  keyExtractor, 
  cardType = 'square', 
  onEndReached,
  isLoadingMore = false 
}) {
  const rowRef = useRef(null);

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

  if (!items || items.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-medium tracking-tight text-white">{title}</h3>
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
          {items.map((item, index) => {
            if (cardType === 'wide') {
              return (
                <div 
                  key={keyExtractor ? keyExtractor(item, index) : index} 
                  className="wide-card group"
                  onClick={() => onItemClick && onItemClick(item)}
                >
                  <img 
                    src={item.thumbnail || '/logo.svg'} 
                    alt={item.title} 
                    className="wide-card-art"
                    onError={(e) => {
                      e.target.src = '/logo.svg';
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
                        if (onPlayClick) onPlayClick(item);
                        else if (onItemClick) onItemClick(item);
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
                  onClick={() => onItemClick && onItemClick(item)}
                >
                  <div className="relative w-full aspect-square rounded-full overflow-hidden shadow-xl bg-zinc-900 border border-zinc-800/40">
                    <img 
                      src={item.thumbnail || '/logo.svg'} 
                      alt={item.title} 
                      className={`w-full h-full ${(!item.thumbnail || item.thumbnail === '/logo.svg') ? 'object-contain p-6 bg-black' : 'object-cover'} transition-transform duration-500 group-hover:scale-110`}
                      onError={(e) => {
                        e.target.src = '/logo.svg';
                        e.target.className = 'w-full h-full object-contain p-6 bg-black';
                      }}
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <button 
                        type="button" 
                        className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-transform"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onPlayClick) onPlayClick(item);
                          else if (onItemClick) onItemClick(item);
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
                className="square-card"
                onClick={() => onItemClick && onItemClick(item)}
              >
                <div className="square-card-art-wrapper">
                  <div className="square-card-vinyl-container">
                    <div className="square-card-vinyl"></div>
                  </div>
                  <div className="square-card-art-container">
                    <img 
                      src={item.thumbnail || '/logo.svg'} 
                      alt={item.title} 
                      className={`square-card-art ${(!item.thumbnail || item.thumbnail === '/logo.svg') ? 'object-contain p-6 bg-black border border-zinc-900' : 'object-cover'}`}
                      onError={(e) => {
                        e.target.src = '/logo.svg';
                        e.target.className = 'square-card-art object-contain p-6 bg-black border border-zinc-900';
                      }}
                      loading="lazy"
                    />
                    <button 
                      type="button" 
                      className="square-card-play-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onPlayClick) onPlayClick(item);
                        else if (onItemClick) onItemClick(item);
                      }}
                      aria-label={`Play ${item.title}`}
                    >
                      <Play className="w-5 h-5 fill-current text-black translate-x-[1px]" />
                    </button>
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

          {isLoadingMore && (
            <>
              {[...Array(2)].map((_, idx) => (
                cardType === 'wide' ? (
                  <div 
                    key={`loading-wide-${idx}`} 
                    className="skeleton-shimmer-card shrink-0 w-[240px] sm:w-[320px] h-[120px] sm:h-[150px] rounded-lg bg-[#121212] border border-zinc-800/80 p-3 sm:p-4 flex flex-col justify-between relative overflow-hidden shadow-lg animate-pulse"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-md bg-zinc-800/80 shrink-0" />
                      <div className="flex flex-col gap-2 flex-1 min-w-0">
                        <div className="h-3.5 sm:h-4 bg-zinc-800/90 rounded-md w-3/4" />
                        <div className="h-2.5 sm:h-3 bg-zinc-800/50 rounded-md w-1/2" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-zinc-800/50">
                      <div className="h-3 bg-zinc-800/60 rounded-md w-1/3" />
                      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-zinc-800/80" />
                    </div>
                  </div>
                ) : (
                  <div 
                    key={`loading-square-${idx}`} 
                    className="skeleton-shimmer-card shrink-0 w-[130px] sm:w-[180px] flex flex-col relative animate-pulse"
                  >
                    <div className="w-full aspect-square bg-zinc-800/90 rounded-[8px] mb-3 shadow-md" />
                    <div className="h-4 bg-zinc-800/90 rounded-sm w-5/6 mb-2" />
                    <div className="h-3 bg-zinc-800/50 rounded-sm w-3/5" />
                  </div>
                )
              ))}
            </>
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
