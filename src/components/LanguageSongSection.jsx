import React, { useRef } from 'react';
import { Play, Shuffle, ChevronLeft, ChevronRight, Sparkles, Music } from 'lucide-react';

const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds)) return null;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

export default function LanguageSongSection({
  lang,
  meta,
  songs = [],
  isLoading = false,
  onPlayTrack,
  onPlayAll,
  onShuffle
}) {
  const scrollRef = useRef(null);

  const handleScroll = (direction) => {
    if (!scrollRef.current) return;
    const scrollAmount = direction === 'left' ? -380 : 380;
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  if (!isLoading && (!songs || songs.length === 0)) return null;

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#121216]/90 via-[#0a0a0d]/95 to-[#050507] border border-white/[0.08] p-4 sm:p-6 mb-10 sm:mb-14 shadow-[0_12px_40px_rgba(0,0,0,0.7)] backdrop-blur-xl group/container">
      {/* Top subtle ambient highlight */}
      <div className="absolute top-0 left-12 right-12 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

      {/* Giant typography watermark in the background */}
      <div 
        aria-hidden="true"
        className="absolute right-4 -top-3 sm:-top-4 select-none pointer-events-none font-black text-6xl sm:text-8xl md:text-9xl text-white/[0.035] tracking-tighter uppercase whitespace-nowrap overflow-hidden transition-all duration-700 group-hover/container:text-white/[0.055]"
      >
        {meta?.watermark || meta?.native || meta?.label || lang}
      </div>

      {/* Section Header */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          {/* Language tag pill without animation */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-white border border-white/15 backdrop-blur-md shadow-sm">
              <span>{meta?.native || meta?.label}</span>
            </span>
            <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-zinc-400 bg-white/[0.04] px-2.5 py-0.5 rounded-full border border-white/5">
              Top Trending
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Popular in {meta?.label || lang}
          </h3>

          <p className="text-xs sm:text-[13px] text-zinc-400 mt-1 flex items-center gap-2 flex-wrap">
            <span>{meta?.tag || 'Curated Top Chart Hits'}</span>
            <span className="w-1 h-1 rounded-full bg-zinc-600 hidden sm:inline-block" />
            <span className="text-zinc-500 font-mono text-xs">
              {songs.length > 0 ? `${songs.length} Tracks Selected` : 'Refreshing Charts...'}
            </span>
          </p>
        </div>

        {/* Action Controls & Scroll Arrows */}
        <div className="flex items-center gap-2.5 self-start md:self-end shrink-0">
          {songs.length > 0 && (
            <>
              {onPlayAll && (
                <button
                  type="button"
                  onClick={onPlayAll}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black font-semibold text-xs hover:bg-zinc-200 active:scale-95 transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.18)] cursor-pointer"
                  aria-label={`Play all popular songs in ${meta?.label}`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play All</span>
                </button>
              )}

              {onShuffle && (
                <button
                  type="button"
                  onClick={onShuffle}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-200 hover:text-white border border-white/10 text-xs font-medium active:scale-95 transition-all duration-200 cursor-pointer"
                  aria-label={`Shuffle popular songs in ${meta?.label}`}
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  <span>Shuffle</span>
                </button>
              )}
            </>
          )}

          {/* Navigation Scroll Buttons (desktop/tablet) */}
          <div className="flex items-center gap-1.5 ml-1">
            <button
              type="button"
              onClick={() => handleScroll('left')}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 active:scale-90 text-zinc-300 hover:text-white border border-white/10 flex items-center justify-center transition-all cursor-pointer"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleScroll('right')}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 active:scale-90 text-zinc-300 hover:text-white border border-white/10 flex items-center justify-center transition-all cursor-pointer"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Track Carousel */}
      <div
        ref={scrollRef}
        className="horizontal-scroll-row relative z-10 flex gap-3.5 sm:gap-4 overflow-x-auto scroll-smooth no-scrollbar -mx-4 px-4 sm:-mx-6 sm:px-6 py-2"
      >
        {isLoading && (!songs || songs.length === 0) ? (
          /* Sleek Billboard Skeleton Cards */
          [...Array(6)].map((_, idx) => (
            <div
              key={`loading-${lang}-${idx}`}
              className="w-[160px] sm:w-[185px] md:w-[205px] flex-shrink-0 bg-[#0d0d10] border border-white/5 rounded-2xl p-3 flex flex-col gap-3 skeleton-shimmer-card"
            >
              <div className="w-full aspect-square rounded-xl bg-zinc-800/80 shadow-md" />
              <div className="h-4 bg-zinc-700/80 rounded w-5/6" />
              <div className="h-3 bg-zinc-800/60 rounded w-3/5" />
              <div className="h-2.5 bg-zinc-900/80 rounded w-1/3 mt-2" />
            </div>
          ))
        ) : (
          songs.map((track, index) => {
            const formattedDuration = formatDuration(track.duration);
            return (
              <div
                key={`${lang}-${track.videoId}-${index}`}
                onClick={() => onPlayTrack && onPlayTrack(track, index)}
                className="w-[160px] sm:w-[185px] md:w-[205px] flex-shrink-0 bg-[#0e0e12] hover:bg-[#15151b] border border-white/[0.07] hover:border-white/30 rounded-2xl p-3 flex flex-col transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_14px_30px_rgba(0,0,0,0.85),0_0_20px_rgba(255,255,255,0.04)] group/track relative cursor-pointer select-none"
              >
                {/* Artwork Box with Rank Badge and Center Play Orb */}
                <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-black/60 shadow-md">
                  {/* Rank Stamp Pill (e.g. #01, #02) */}
                  <div className="absolute top-2 left-2 z-10 flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-md border border-white/15 text-[10px] font-mono font-bold text-white shadow-lg pointer-events-none">
                    <span className="text-zinc-500">#</span>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                  </div>

                  {/* Duration Chip (if available) */}
                  {formattedDuration && (
                    <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-md border border-white/10 text-[9px] font-mono text-zinc-300 pointer-events-none">
                      {formattedDuration}
                    </div>
                  )}

                  {/* Artwork Image */}
                  <img
                    src={(!track.thumbnail && !track.cover && !track.artwork) ? '/default-cover.svg' : (track.thumbnail || track.cover || track.artwork || track.albumArt || '/default-cover.svg').replace('/logo.svg', '/default-cover.svg')}
                    alt={track.title}
                    className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover/track:scale-105"
                    onError={(e) => {
                      e.target.src = '/default-cover.svg';
                    }}
                    loading="lazy"
                    decoding="async"
                  />

                  {/* Gradient Vignette */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none opacity-60 group-hover/track:opacity-90 transition-opacity" />

                  {/* Central Frosted Play Orb (Distinctive Modern Glass Style) */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow-[0_4px_25px_rgba(0,0,0,0.9)] opacity-0 scale-75 group-hover/track:opacity-100 group-hover/track:scale-100 transition-all duration-300 ease-out">
                      <Play className="w-4 h-4 fill-current translate-x-[1px]" />
                    </div>
                  </div>
                </div>

                {/* Track Metadata */}
                <div className="mt-2.5 flex flex-col flex-1 min-w-0">
                  <h4 className="text-white font-semibold text-[13px] sm:text-sm truncate leading-snug group-hover/track:text-white transition-colors">
                    {track.title}
                  </h4>
                  <p className="text-zinc-400 text-[11px] sm:text-xs truncate mt-0.5">
                    {track.artist || meta?.label || 'Hit Track'}
                  </p>

                  {/* Bottom Chart Footer Strip */}
                  <div className="mt-auto pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-zinc-400 font-medium">
                    <span className="uppercase tracking-widest text-[9px] font-mono text-zinc-400 group-hover/track:text-zinc-300 transition-colors">
                      {index < 5 ? 'Top 5 Hit' : 'Trending'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-400 font-mono text-[9px] border border-white/5">
                      HQ
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
