import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Library, Play, Heart, ArrowUpDown, Check, Download } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

export default function LibraryPage({ setCurrentView, refreshKey = 0 }) {
  const [savedPlaylists, setSavedPlaylists] = useState([]);
  const [likedCount, setLikedCount] = useState(0);
  const [sortOption, setSortOption] = useState('recent');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortRef = useRef(null);

  useEffect(() => {
    const fetchSaved = () => {
      try {
        const saved = JSON.parse(localStorage.getItem('playloop_saved_playlists') || '[]');
        setSavedPlaylists(saved);
        const likedList = JSON.parse(localStorage.getItem('playloop_liked_tracks_list') || '[]');
        setLikedCount(likedList.length);
      } catch (e) {
        console.error(e);
      }
    };
    
    fetchSaved();
    window.addEventListener('playloop-saved-playlists-updated', fetchSaved);
    return () => window.removeEventListener('playloop-saved-playlists-updated', fetchSaved);
  }, [refreshKey]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  const sortedSavedPlaylists = useMemo(() => {
    const list = [...savedPlaylists];
    if (sortOption === 'recent-reverse') {
      return list.reverse();
    } else if (sortOption === 'name-asc') {
      return list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (sortOption === 'name-desc') {
      return list.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
    }
    return list;
  }, [savedPlaylists, sortOption]);

  const handlePlaylistClick = (playlist) => {
    window.location.hash = `#/playlist/${playlist.playlistId}`;
  };

  const handleLikedClick = () => {
    window.location.hash = '#/playlist/liked_songs';
  };

  const handleImportClick = () => {
    if (setCurrentView) {
      setCurrentView('settings');
    }
    window.location.hash = '#/settings#import';
  };

  const handleKeyDown = (e, action, param) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (action === 'liked') {
        handleLikedClick();
      } else if (action === 'playlist') {
        handlePlaylistClick(param);
      }
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-24 px-4 sm:px-6 lg:px-8 mt-6 select-none">
      <div className="mb-6 sm:mb-8 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap w-full">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <Library className="w-6 h-6 sm:w-8 sm:h-8 text-white shrink-0" />
          <h2 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight truncate">Your Library</h2>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 ml-auto shrink-0">
          <button
            type="button"
            onClick={handleImportClick}
            className="hidden sm:inline-flex text-xs sm:text-sm font-normal text-zinc-300 hover:text-white bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/60 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 items-center gap-1.5 sm:gap-2 transition cursor-pointer shadow-sm hover:scale-105 active:scale-95 shrink-0"
            title="Import playlists from Spotify, YT Music, JioSaavn or files"
          >
            <Download className="w-3.5 h-3.5 text-white shrink-0" />
            <span>Import</span>
          </button>

          <div className="relative z-20 shrink-0" ref={sortRef}>
            <button
              type="button"
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="text-xs sm:text-sm font-normal text-zinc-300 hover:text-white bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/60 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-2 transition cursor-pointer shadow-sm hover:scale-105 active:scale-95 shrink-0"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" />
              <span>
                Sort: {
                  sortOption === 'recent' ? 'Newest First' :
                  sortOption === 'recent-reverse' ? 'Oldest First' :
                  sortOption === 'name-asc' ? 'Name (A-Z)' :
                  sortOption === 'name-desc' ? 'Name (Z-A)' : 'Newest First'
                }
              </span>
              <span className="text-[10px] text-zinc-400">▼</span>
            </button>

            {isSortOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-900/95 backdrop-blur-md border border-zinc-700/80 rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wider border-b border-zinc-800 mb-1">
                  Sort Playlists By
                </div>
                {[
                  { id: 'recent', label: 'Newest First' },
                  { id: 'recent-reverse', label: 'Oldest First' },
                  { id: 'name-asc', label: 'Name (A – Z)' },
                  { id: 'name-desc', label: 'Name (Z – A)' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSortOption(opt.id);
                      setIsSortOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs font-normal flex items-center justify-between transition cursor-pointer ${
                      sortOption === opt.id ? 'bg-white/10 text-white font-medium' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {sortOption === opt.id && <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
        {/* Liked Songs Card */}
        <div 
          onClick={handleLikedClick}
          onKeyDown={(e) => handleKeyDown(e, 'liked')}
          tabIndex={0}
          role="button"
          aria-label="Liked Songs"
          className="group flex flex-col p-3.5 rounded bg-[#181818] hover:bg-[#282828] focus:bg-[#282828] focus:outline-none focus:ring-2 focus:ring-white cursor-pointer transition-colors duration-300"
        >
          <div className="relative w-full aspect-square rounded-[2px] shadow-[0_8px_24px_rgba(0,0,0,0.5)] overflow-hidden mb-4 bg-gradient-to-br from-[#450af5] to-[#c4efd9] flex items-center justify-center">
            <Heart className="w-16 h-16 text-white fill-current drop-shadow-md" />
            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 z-20">
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-xl hover:scale-105 hover:bg-gray-50 text-black">
                <Play className="w-5 h-5 fill-current translate-x-[2px]" />
              </div>
            </div>
          </div>
          <h4 className="font-bold text-white text-[15px] truncate mb-1.5 tracking-tight">
            Liked Songs
          </h4>
          <p className="font-medium text-zinc-400 text-[13px] line-clamp-2 leading-snug">
            {likedCount} {likedCount === 1 ? 'song' : 'songs'}
          </p>
        </div>

        {/* Import Playlist Card (Mobile Grid Tile) */}
        <div
          onClick={handleImportClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleImportClick();
            }
          }}
          tabIndex={0}
          role="button"
          aria-label="Import Playlist"
          className="group flex flex-col p-3.5 rounded bg-[#181818] hover:bg-[#282828] focus:bg-[#282828] focus:outline-none focus:ring-2 focus:ring-white cursor-pointer transition-colors duration-300 sm:hidden"
        >
          <div className="relative w-full aspect-square rounded-[2px] shadow-[0_8px_24px_rgba(0,0,0,0.5)] overflow-hidden mb-4 bg-gradient-to-br from-zinc-700 via-zinc-850 to-black flex items-center justify-center">
            <Download className="w-12 h-12 text-white drop-shadow-md transition-transform duration-300 group-hover:scale-110" />
            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 z-20">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-xl hover:scale-105 text-black">
                <Download className="w-4 h-4 text-black" />
              </div>
            </div>
          </div>
          <h4 className="font-bold text-white text-[15px] truncate mb-1.5 tracking-tight">
            Import Playlist
          </h4>
          <p className="font-medium text-zinc-400 text-[13px] line-clamp-2 leading-snug">
            Spotify, YT & Files
          </p>
        </div>

        {/* Saved Playlists */}
        {sortedSavedPlaylists.map((item, index) => (
          <div
            key={`${item.playlistId}-${index}`}
            onClick={() => handlePlaylistClick(item)}
            onKeyDown={(e) => handleKeyDown(e, 'playlist', item)}
            tabIndex={0}
            role="button"
            aria-label={`Playlist: ${item.title}`}
            className="group flex flex-col p-3.5 rounded bg-[#181818] hover:bg-[#282828] focus:bg-[#282828] focus:outline-none focus:ring-2 focus:ring-white cursor-pointer transition-colors duration-300"
          >
            <div className={`relative w-full aspect-square shadow-[0_8px_24px_rgba(0,0,0,0.5)] overflow-hidden mb-4 bg-black border border-white/5 ${item.isArtist ? 'rounded-full' : 'rounded-[2px]'}`}>
              <img
                src={(!item.thumbnail || item.thumbnail === '/logo.svg') ? '/default-cover.svg' : item.thumbnail}
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={(e) => {
                  e.target.src = '/default-cover.svg';
                }}
                loading="lazy"
              />
              
              <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 z-20">
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-xl hover:scale-105 hover:bg-gray-50 text-black">
                  <Play className="w-5 h-5 fill-current translate-x-[2px]" />
                </div>
              </div>
            </div>

            <h4 className="font-bold text-white text-[15px] truncate mb-1.5 tracking-tight">
              {item.title}
            </h4>
            <p className="font-medium text-zinc-400 text-[13px] line-clamp-2 leading-snug">
              {item.author || item.artist || 'Collection'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
