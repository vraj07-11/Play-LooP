import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Library, Play, Heart, ArrowUpDown, Check, Download, Plus, MoreVertical, Edit3, Share2, Trash2, X } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { deleteUserPlaylist } from '../utils/playlistManager';

// ---------------------------------------------------------------------------
// Main LibraryPage
// ---------------------------------------------------------------------------
export default function LibraryPage({ setCurrentView, refreshKey = 0 }) {
  const { selectAndPlayTrack } = usePlayer() || {};

  const [savedPlaylists, setSavedPlaylists] = useState([]);
  const [likedCount, setLikedCount]         = useState(0);
  const [sortOption, setSortOption]         = useState('recent');
  const [isSortOpen, setIsSortOpen]         = useState(false);
  const [openMenuPlaylistId, setOpenMenuPlaylistId] = useState(null);
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
    window.addEventListener('playloop-liked-songs-updated', fetchSaved);
    return () => {
      window.removeEventListener('playloop-saved-playlists-updated', fetchSaved);
      window.removeEventListener('playloop-liked-songs-updated', fetchSaved);
    };
  }, [refreshKey]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setIsSortOpen(false);
      }
      if (!e.target.closest('.playlist-menu-container')) {
        setOpenMenuPlaylistId(null);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  const sortedSavedPlaylists = useMemo(() => {
    const list = [...savedPlaylists];
    if (sortOption === 'recent-reverse') {
      return list.sort((a, b) => {
        const timeA = a.lastPlayedAt ? new Date(a.lastPlayedAt).getTime() : (a.updated_at || 0);
        const timeB = b.lastPlayedAt ? new Date(b.lastPlayedAt).getTime() : (b.updated_at || 0);
        return timeA - timeB;
      });
    } else if (sortOption === 'recent') {
      return list.sort((a, b) => {
        const timeA = a.lastPlayedAt ? new Date(a.lastPlayedAt).getTime() : (a.updated_at || 0);
        const timeB = b.lastPlayedAt ? new Date(b.lastPlayedAt).getTime() : (b.updated_at || 0);
        return timeB - timeA;
      });
    } else if (sortOption === 'name-asc') {
      return list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (sortOption === 'name-desc') {
      return list.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
    }
    return list;
  }, [savedPlaylists, sortOption]);

  const handlePlaylistClick = (playlist) => {
    window.location.hash = `#/playlist/${playlist.playlistId || playlist.id}`;
  };

  const handleLikedClick = () => {
    window.location.hash = '#/playlist/liked_songs';
  };

  const handleImportClick = () => {
    if (setCurrentView) setCurrentView('settings');
    window.location.hash = '#/settings#import';
  };

  const handleCreatePlaylistClick = () => {
    window.dispatchEvent(
      new CustomEvent('playloop-open-playlist-edit', {
        detail: { defaultName: `My Playlist #${savedPlaylists.length + 1}` }
      })
    );
  };

  const handleRenamePlaylist = (e, playlist) => {
    e.stopPropagation();
    setOpenMenuPlaylistId(null);
    window.dispatchEvent(
      new CustomEvent('playloop-open-playlist-edit', {
        detail: {
          playlistId: playlist.playlistId || playlist.id,
          title: playlist.title || playlist.name,
          description: playlist.description || ''
        }
      })
    );
  };

  const handleSharePlaylist = (e, playlist) => {
    e.stopPropagation();
    setOpenMenuPlaylistId(null);
    window.dispatchEvent(
      new CustomEvent('playloop-open-share', {
        detail: {
          type: 'playlist',
          isPlaylist: true,
          playlistId: playlist.playlistId || playlist.id,
          title: playlist.title || playlist.name || 'Playlist',
          author: playlist.author || 'You',
          thumbnail: playlist.thumbnail || '/default-cover.svg',
          count: playlist.tracks ? playlist.tracks.length : (playlist.count || 0)
        }
      })
    );
  };

  const handleDeletePlaylist = (e, playlistId) => {
    e.stopPropagation();
    setOpenMenuPlaylistId(null);
    try {
      const pid = String(playlistId);
      const updated = deleteUserPlaylist(pid);
      setSavedPlaylists(updated);
      window.dispatchEvent(new CustomEvent('playloop-toast', { detail: 'Playlist removed from library' }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleKeyDown = (e, action, param) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (action === 'liked') handleLikedClick();
      else if (action === 'playlist') handlePlaylistClick(param);
      else if (action === 'create') handleCreatePlaylistClick();
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-24 px-4 sm:px-6 lg:px-8 mt-6 select-none">

      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-6 sm:mb-8 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap w-full">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <Library className="w-6 h-6 sm:w-8 sm:h-8 text-white shrink-0" />
          <h2 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight truncate">
            Your Library
          </h2>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 ml-auto shrink-0 flex-wrap sm:flex-nowrap">
          {/* Create Playlist Button */}
          <button
            type="button"
            onClick={handleCreatePlaylistClick}
            className="text-xs sm:text-sm font-bold text-black bg-white hover:bg-zinc-200 rounded-full px-3.5 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-2 transition cursor-pointer shadow-md hover:scale-105 active:scale-95 shrink-0"
            title="Create a new playlist"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
            <span>New Playlist</span>
          </button>

          {/* Import button */}
          <button
            type="button"
            onClick={handleImportClick}
            className="hidden sm:inline-flex text-xs sm:text-sm font-normal text-zinc-300 hover:text-white bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/60 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 items-center gap-1.5 sm:gap-2 transition cursor-pointer shadow-sm hover:scale-105 active:scale-95 shrink-0"
            title="Import playlists from Spotify, YT Music, JioSaavn or files"
          >
            <Download className="w-3.5 h-3.5 text-white shrink-0" />
            <span>Import</span>
          </button>

          {/* Sort dropdown */}
          <div className="relative z-20 shrink-0" ref={sortRef}>
            <button
              type="button"
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="text-xs sm:text-sm font-normal text-zinc-300 hover:text-white bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/60 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-2 transition cursor-pointer shadow-sm hover:scale-105 active:scale-95 shrink-0"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" />
              <span>
                Sort: {
                  sortOption === 'recent'         ? 'Newest First'  :
                  sortOption === 'recent-reverse' ? 'Oldest First'  :
                  sortOption === 'name-asc'       ? 'Name (A-Z)'    :
                  sortOption === 'name-desc'      ? 'Name (Z-A)'    : 'Newest First'
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
                  { id: 'recent',         label: 'Newest First'  },
                  { id: 'recent-reverse', label: 'Oldest First'  },
                  { id: 'name-asc',       label: 'Name (A – Z)' },
                  { id: 'name-desc',      label: 'Name (Z – A)' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { setSortOption(opt.id); setIsSortOpen(false); }}
                    className={`w-full text-left px-3.5 py-2 text-xs font-normal flex items-center justify-between transition cursor-pointer ${
                      sortOption === opt.id
                        ? 'bg-white/10 text-white font-medium'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {sortOption === opt.id && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Playlist Grid                                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">

        {/* 1. Import Playlist Card */}
        <div
          onClick={handleImportClick}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleImportClick(); } }}
          tabIndex={0}
          role="button"
          aria-label="Import Playlist"
          className="group flex flex-col p-3.5 rounded-2xl bg-[#181818] hover:bg-[#222222] focus:outline-none focus:ring-2 focus:ring-white border border-white/5 hover:border-white/15 cursor-pointer transition-all duration-300 shadow-lg"
        >
          <div className="relative w-full aspect-square rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.5)] overflow-hidden mb-4 bg-gradient-to-br from-zinc-700 via-zinc-850 to-black flex items-center justify-center">
            <Download className="w-12 h-12 text-white drop-shadow-md transition-transform duration-300 group-hover:scale-110" />
          </div>
          <h4 className="font-bold text-white text-[15px] truncate mb-1 tracking-tight">
            Import Playlist
          </h4>
          <p className="font-medium text-zinc-400 text-[13px] line-clamp-1 leading-snug">
            Spotify, YT &amp; Files
          </p>
        </div>

        {/* 2. Create Playlist Tile */}
        <div
          onClick={handleCreatePlaylistClick}
          onKeyDown={(e) => handleKeyDown(e, 'create')}
          tabIndex={0}
          role="button"
          aria-label="Create Playlist"
          className="group flex flex-col p-3.5 rounded-2xl bg-[#181818] hover:bg-[#222222] focus:outline-none focus:ring-2 focus:ring-white border border-white/5 hover:border-white/15 cursor-pointer transition-all duration-300 shadow-lg"
        >
          <div className="relative w-full aspect-square rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.5)] overflow-hidden mb-4 bg-gradient-to-br from-zinc-700 via-zinc-850 to-black flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-white/10 group-hover:bg-white text-zinc-300 group-hover:text-black flex items-center justify-center transition-all duration-300 group-hover:scale-105">
              <Plus className="w-7 h-7 stroke-[2.5]" />
            </div>
          </div>
          <h4 className="font-bold text-white text-[15px] truncate mb-1 tracking-tight">
            Create Playlist
          </h4>
          <p className="font-medium text-zinc-400 text-[13px] line-clamp-1 leading-snug">
            Add your favorite songs
          </p>
        </div>

        {/* 3. Liked Songs Card */}
        <div
          onClick={handleLikedClick}
          onKeyDown={(e) => handleKeyDown(e, 'liked')}
          tabIndex={0}
          role="button"
          aria-label="Liked Songs"
          className="group flex flex-col p-3.5 rounded-2xl bg-[#181818] hover:bg-[#222222] focus:outline-none focus:ring-2 focus:ring-white border border-white/5 hover:border-white/15 cursor-pointer transition-all duration-300 shadow-lg"
        >
          <div className="relative w-full aspect-square rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.5)] overflow-hidden mb-4 bg-gradient-to-br from-[#450af5] to-[#c4efd9] flex items-center justify-center">
            <Heart className="w-16 h-16 text-white fill-current drop-shadow-md group-hover:scale-105 transition-transform duration-300" />
            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 z-20">
              <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-xl hover:scale-105 hover:bg-gray-50 text-black">
                <Play className="w-5 h-5 fill-current translate-x-[2px]" />
              </div>
            </div>
          </div>
          <h4 className="font-bold text-white text-[15px] truncate mb-1 tracking-tight">
            Liked Songs
          </h4>
          <p className="font-medium text-zinc-400 text-[13px] line-clamp-1 leading-snug">
            {likedCount} {likedCount === 1 ? 'song' : 'songs'}
          </p>
        </div>

        {/* Saved Playlists */}
        {sortedSavedPlaylists.map((item, index) => {
          const pid = String(item.playlistId || item.id);
          const isMenuOpen = openMenuPlaylistId === pid;
          const count = item.tracks ? item.tracks.length : (item.count || 0);

          return (
            <div
              key={`${pid}-${index}`}
              onClick={() => handlePlaylistClick(item)}
              onKeyDown={(e) => handleKeyDown(e, 'playlist', item)}
              tabIndex={0}
              role="button"
              aria-label={`Playlist: ${item.title}`}
              className={`group relative flex flex-col p-3.5 rounded-2xl bg-[#181818] hover:bg-[#222222] focus:outline-none focus:ring-2 focus:ring-white border border-white/5 hover:border-white/15 cursor-pointer transition-all duration-300 shadow-lg ${
                isMenuOpen ? 'z-40' : 'z-10'
              }`}
            >
              <div className="relative w-full aspect-square mb-4">
                {/* Cover Image Container */}
                <div className={`w-full h-full shadow-[0_8px_24px_rgba(0,0,0,0.5)] overflow-hidden bg-black border border-white/5 ${item.isArtist ? 'rounded-full' : 'rounded-xl'}`}>
                  <img
                    src={(!item.thumbnail || item.thumbnail === '/logo.svg') ? '/default-cover.svg' : item.thumbnail}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => { e.target.src = '/default-cover.svg'; }}
                    loading="lazy"
                  />
                </div>

                {/* Top Options Menu trigger - Outside overflow-hidden so menu doesn't get clipped */}
                <div className="playlist-menu-container absolute top-2 right-2 z-40">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuPlaylistId(isMenuOpen ? null : pid);
                    }}
                    title="Playlist options"
                    aria-label="Playlist options"
                    className="w-8 h-8 rounded-full bg-black/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/10 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200 cursor-pointer shadow-md hover:scale-105 active:scale-95"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {/* Dropdown Menu */}
                  {isMenuOpen && (
                    <div
                      className="absolute right-0 top-full mt-1.5 w-44 bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl py-1.5 z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={(e) => handleRenamePlaylist(e, item)}
                        className="w-full px-3.5 py-2 text-xs text-left text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2.5 transition cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Edit Details</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleSharePlaylist(e, item)}
                        className="w-full px-3.5 py-2 text-xs text-left text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2.5 transition cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Share Playlist</span>
                      </button>
                      <div className="my-1 border-t border-zinc-800" />
                      <button
                        type="button"
                        onClick={(e) => handleDeletePlaylist(e, pid)}
                        className="w-full px-3.5 py-2 text-xs text-left text-red-400 hover:text-red-300 hover:bg-zinc-800 flex items-center gap-2.5 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Playlist</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Hover Play Button */}
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 z-20 pointer-events-none">
                  <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-xl hover:scale-105 hover:bg-gray-50 text-black">
                    <Play className="w-5 h-5 fill-current translate-x-[2px]" />
                  </div>
                </div>
              </div>

              <h4 className="font-bold text-white text-[15px] truncate mb-1 tracking-tight">
                {item.title || item.name}
              </h4>
              <p className="font-medium text-zinc-400 text-[13px] line-clamp-1 leading-snug">
                {item.author || (item.isUserCreated ? 'By You' : 'Collection')} • {count} {count === 1 ? 'song' : 'songs'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
