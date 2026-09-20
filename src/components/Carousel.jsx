import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';

export default function Carousel({ title, items, onItemClick, onPlayClick, renderSubtitle, keyExtractor }) {
  const rowRef = useRef(null);

  const scroll = (direction) => {
    if (!rowRef.current) return;
    const scrollAmount = direction === 'left' ? -350 : 350;
    rowRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-medium tracking-tight text-white">{title}</h3>
      </div>

      <div className="carousel-wrapper relative group">
        <button 
          type="button" 
          onClick={() => scroll('left')}
          className="carousel-arrow-btn left-arrow opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>

        <div ref={rowRef} className="horizontal-scroll-row">
          {items.map((item, index) => (
            <div 
              key={keyExtractor ? keyExtractor(item, index) : index} 
              className="square-card"
              onClick={() => onItemClick && onItemClick(item)}
            >
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
              <h4 className="square-card-title">{item.title}</h4>
              <p className="square-card-subtitle">
                {renderSubtitle ? renderSubtitle(item) : (item.author || item.artist || 'Collection')}
              </p>
            </div>
          ))}
        </div>

        <button 
          type="button" 
          onClick={() => scroll('right')}
          className="carousel-arrow-btn right-arrow opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );
}
