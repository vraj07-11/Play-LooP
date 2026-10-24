import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { PROFILE_NAME_KEY, PROFILE_AVATAR_KEY } from '../services/api';
import Carousel from './Carousel';

export default function SpeedDialSection({
  songs = [],
  isLoading = false,
  onPlayTrack,
  currentPlayingTrackId = null
}) {
  const [currentPage, setCurrentPage] = useState(0);
  const containerRef = useRef(null);

  const [userName, setUserName] = useState('Play LooP');
  const [userAvatar, setUserAvatar] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const name = localStorage.getItem(PROFILE_NAME_KEY) || localStorage.getItem('profile_name') || 'Play LooP';
      const avatar = localStorage.getItem(PROFILE_AVATAR_KEY) || localStorage.getItem('profile_avatar') || null;
      setUserName(name);
      setUserAvatar(avatar);
    }
  }, []);

  // Split songs into pages of 9 items (3x3 grid per page) for Mobile Speed Dial
  const pages = useMemo(() => {
    if (!songs || songs.length === 0) return [];
    const pageSize = 9;
    const result = [];
    for (let i = 0; i < Math.min(songs.length, 27); i += pageSize) {
      result.push(songs.slice(i, i + pageSize));
    }
    return result;
  }, [songs]);

  const scrollToPage = (pageIndex) => {
    if (!containerRef.current) return;
    const targetPage = Math.max(0, Math.min(pageIndex, pages.length - 1));
    const pageWidth = containerRef.current.clientWidth;
    containerRef.current.scrollTo({
      left: targetPage * pageWidth,
      behavior: 'smooth'
    });
    setCurrentPage(targetPage);
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollLeft, clientWidth } = containerRef.current;
    if (clientWidth === 0) return;
    const pageIndex = Math.round(scrollLeft / clientWidth);
    if (pageIndex !== currentPage && pageIndex >= 0 && pageIndex < pages.length) {
      setCurrentPage(pageIndex);
    }
  };

  if (!isLoading && (!songs || songs.length === 0)) return null;

  return (
    <>
      {/* MOBILE ONLY: 3x3 YouTube Music Grid Layout */}
      <section className="sm:hidden mb-10 px-0.5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 px-0.5">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-white">
              Speed dial
            </h3>
          </div>
        </div>

        {/* 3x3 Pages Carousel */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="horizontal-scroll-row flex overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth w-full"
        >
          {isLoading && (!songs || songs.length === 0) ? (
            <div className="w-full shrink-0 grid grid-cols-3 gap-2 p-0.5">
              {[...Array(9)].map((_, idx) => (
                <div
                  key={`speed-dial-skeleton-${idx}`}
                  className="aspect-square rounded-xl bg-zinc-800/80 skeleton-shimmer-card"
                />
              ))}
            </div>
          ) : (
            pages.map((pageSongs, pageIdx) => (
              <div
                key={`speed-dial-page-${pageIdx}`}
                className="w-full shrink-0 snap-center grid grid-cols-3 gap-2 p-0.5"
              >
                {pageSongs.map((track, trackIdx) => {
                  const globalIndex = pageIdx * 9 + trackIdx;
                  const isPlaying = currentPlayingTrackId && currentPlayingTrackId === track.videoId;

                  return (
                    <div
                      key={`speed-dial-tile-${track.videoId}-${trackIdx}`}
                      onClick={() => onPlayTrack && onPlayTrack(track, globalIndex)}
                      className={`aspect-square rounded-xl overflow-hidden relative group cursor-pointer bg-black/60 shadow-md select-none transition-all duration-300 ${isPlaying
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-[0.98]'
                        : 'border border-white/5 active:scale-95'
                        }`}
                    >
                      <img
                        src={(!track.thumbnail && !track.cover && !track.artwork) ? '/default-cover.svg' : (track.thumbnail || track.cover || track.artwork || track.albumArt || '/default-cover.svg').replace('/logo.svg', '/default-cover.svg')}
                        alt={track.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = '/default-cover.svg';
                        }}
                        loading="lazy"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent pointer-events-none" />

                      <div className="absolute bottom-0 inset-x-0 p-2 z-10 pointer-events-none">
                        <h4 className="text-white font-semibold text-[11px] line-clamp-1 leading-tight drop-shadow-md">
                          {track.title}
                        </h4>
                        {track.artist && (
                          <p className="text-zinc-300/80 text-[9px] truncate mt-0.5 drop-shadow-sm font-normal">
                            {track.artist}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Pagination Dots */}
        {pages.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {pages.map((_, dotIdx) => (
              <button
                key={`dot-${dotIdx}`}
                type="button"
                onClick={() => scrollToPage(dotIdx)}
                className={`rounded-full transition-all duration-300 cursor-pointer ${currentPage === dotIdx
                  ? 'w-5 h-1.5 bg-white shadow-sm'
                  : 'w-1.5 h-1.5 bg-zinc-600'
                  }`}
                aria-label={`Go to speed dial page ${dotIdx + 1}`}
              />
            ))}
          </div>
        )}
      </section>

      {/* DESKTOP ONLY: Normal section style like Recently Played */}
      <div className="hidden sm:block mb-10 sm:mb-12">
        <Carousel
          title={
            <div>
              <h3 className="text-xl font-medium tracking-tight text-white">Speed dial</h3>
            </div>
          }
          items={songs}
          isLoading={isLoading && (!songs || songs.length === 0)}
          onItemClick={(track, index) => onPlayTrack && onPlayTrack(track, index)}
          renderSubtitle={(track) => track.artist || 'Popular Song'}
          keyExtractor={(track, index) => `speed-dial-desktop-${track.videoId}-${index}`}
          cardType="square"
        />
      </div>
    </>
  );
}
