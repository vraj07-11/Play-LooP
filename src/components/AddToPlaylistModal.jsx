import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Check, Music2, FolderPlus, Search } from 'lucide-react';
import { getSavedPlaylists, createUserPlaylist, syncSongInPlaylists } from '../utils/playlistManager';

export default function AddToPlaylistModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [song, setSong] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState(new Set());
  const [initialPlaylistIds, setInitialPlaylistIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Listen to open event
  useEffect(() => {
    const handleOpen = (e) => {
      if (e.detail) {
        const vid = e.detail.videoId || e.detail.id;
        if (!vid) return;
        const targetSong = {
          videoId: vid,
          title: e.detail.title || e.detail.name || 'Unknown Track',
          artist: e.detail.artist || e.detail.channelTitle || e.detail.singers || 'Unknown Artist',
          thumbnail: (!e.detail.thumbnail || e.detail.thumbnail === '/logo.svg') ? (e.detail.image || '/default-cover.svg') : e.detail.thumbnail,
          duration: Number(e.detail.duration) || 180,
          album: e.detail.album || ''
        };
        setSong(targetSong);

        // Load existing saved playlists
        const allSaved = getSavedPlaylists();
        setPlaylists(allSaved);

        // Determine which playlists already contain this song
        const existingContains = new Set();
        allSaved.forEach((p) => {
          const pid = String(p.playlistId || p.id);
          const hasSong = Array.isArray(p.tracks) && p.tracks.some((t) => String(t.videoId || t.id) === String(targetSong.videoId));
          if (hasSong) {
            existingContains.add(pid);
          }
        });

        setSelectedPlaylistIds(new Set(existingContains));
        setInitialPlaylistIds(new Set(existingContains));
        setIsCreatingNew(false);
        setNewPlaylistName('');
        setSearchQuery('');
        setIsOpen(true);
      }
    };

    window.addEventListener('playloop-open-add-to-playlist', handleOpen);
    return () => window.removeEventListener('playloop-open-add-to-playlist', handleOpen);
  }, []);

  // Listen for external playlist updates while open
  useEffect(() => {
    if (!isOpen) return;
    const refreshPlaylists = () => {
      const allSaved = getSavedPlaylists();
      setPlaylists(allSaved);
    };
    window.addEventListener('playloop-saved-playlists-updated', refreshPlaylists);
    return () => window.removeEventListener('playloop-saved-playlists-updated', refreshPlaylists);
  }, [isOpen]);

  const filteredPlaylists = useMemo(() => {
    if (!searchQuery.trim()) return playlists;
    const q = searchQuery.toLowerCase().trim();
    return playlists.filter((p) => (p.title || p.name || '').toLowerCase().includes(q));
  }, [playlists, searchQuery]);

  const handleTogglePlaylist = (playlistId) => {
    const pid = String(playlistId);
    setSelectedPlaylistIds((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) {
        next.delete(pid);
      } else {
        next.add(pid);
      }
      return next;
    });
  };

  const handleCreateInlinePlaylist = (e) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;

    const created = createUserPlaylist(newPlaylistName.trim());
    if (created) {
      const newPid = String(created.playlistId || created.id);
      setPlaylists((prev) => [created, ...prev]);
      setSelectedPlaylistIds((prev) => new Set([...prev, newPid]));
      setNewPlaylistName('');
      setIsCreatingNew(false);
    }
  };

  const handleSave = () => {
    if (!song) {
      setIsOpen(false);
      return;
    }

    const allPids = playlists.map((p) => String(p.playlistId || p.id));
    const targetPids = Array.from(selectedPlaylistIds);

    // Calculate changes
    const addedCount = targetPids.filter((id) => !initialPlaylistIds.has(id)).length;
    const removedCount = Array.from(initialPlaylistIds).filter((id) => !selectedPlaylistIds.has(id)).length;

    syncSongInPlaylists(song, targetPids, allPids);

    if (addedCount > 0 && removedCount === 0) {
      window.dispatchEvent(
        new CustomEvent('playloop-toast', {
          detail: `Added to ${addedCount === 1 ? 'playlist' : `${addedCount} playlists`}`
        })
      );
    } else if (removedCount > 0 && addedCount === 0) {
      window.dispatchEvent(
        new CustomEvent('playloop-toast', {
          detail: `Removed from ${removedCount === 1 ? 'playlist' : `${removedCount} playlists`}`
        })
      );
    } else if (addedCount > 0 || removedCount > 0) {
      window.dispatchEvent(new CustomEvent('playloop-toast', { detail: 'Playlists updated' }));
    }

    setIsOpen(false);
  };

  if (!isOpen || !song) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none"
      onClick={() => setIsOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Add to Playlist"
    >
      <div
        className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white">
              <FolderPlus className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight">
                Add to Playlist
              </h2>
              <p className="text-xs text-zinc-400">Select one or multiple playlists</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close dialog"
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Song Preview Banner */}
        <div className="flex items-center gap-3 py-3 my-2 px-3 bg-zinc-900/60 border border-zinc-800/60 rounded-xl shrink-0">
          <img
            src={song.thumbnail}
            alt={song.title}
            className="w-10 h-10 rounded-lg object-cover bg-black border border-white/5 shrink-0"
            onError={(e) => {
              e.target.src = '/default-cover.svg';
            }}
          />
          <div className="flex-1 min-w-0">
            <h4 className="text-xs sm:text-sm font-semibold text-white truncate">{song.title}</h4>
            <p className="text-[11px] text-zinc-400 truncate">{song.artist}</p>
          </div>
        </div>

        {/* Inline Create New Playlist Section */}
        <div className="py-2 shrink-0">
          {!isCreatingNew ? (
            <button
              type="button"
              onClick={() => setIsCreatingNew(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-white font-medium text-xs sm:text-sm rounded-xl transition cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>New Playlist</span>
            </button>
          ) : (
            <form onSubmit={handleCreateInlinePlaylist} className="flex items-center gap-2">
              <input
                type="text"
                autoFocus
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Playlist name..."
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white transition"
              />
              <button
                type="submit"
                disabled={!newPlaylistName.trim()}
                className="px-4 py-2 bg-white text-black font-semibold text-xs sm:text-sm rounded-xl hover:bg-zinc-200 transition disabled:opacity-50 cursor-pointer shrink-0"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingNew(false);
                  setNewPlaylistName('');
                }}
                className="p-2 text-zinc-400 hover:text-white rounded-xl transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>

        {/* Search Input (if user has 4+ playlists) */}
        {playlists.length >= 4 && (
          <div className="relative my-1 shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter playlists..."
              className="w-full bg-zinc-900/80 border border-zinc-800/80 rounded-xl pl-8.5 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition"
            />
          </div>
        )}

        {/* Playlists List */}
        <div className="flex-1 overflow-y-auto hide-scrollbar py-2 my-1 space-y-1.5 min-h-[160px] max-h-[300px]">
          {filteredPlaylists.length > 0 ? (
            filteredPlaylists.map((pl) => {
              const pid = String(pl.playlistId || pl.id);
              const isChecked = selectedPlaylistIds.has(pid);
              const count = pl.tracks ? pl.tracks.length : (pl.count || 0);

              return (
                <div
                  key={pid}
                  onClick={() => handleTogglePlaylist(pid)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer select-none ${
                    isChecked
                      ? 'bg-zinc-800/80 border-white/20 text-white'
                      : 'bg-zinc-900/40 hover:bg-zinc-800/40 border-zinc-800/60 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                    <img
                      src={pl.thumbnail || '/default-cover.svg'}
                      alt={pl.title || pl.name}
                      className="w-9 h-9 rounded-lg object-cover bg-black border border-white/5 shrink-0"
                      onError={(e) => {
                        e.target.src = '/default-cover.svg';
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs sm:text-sm font-semibold truncate text-white">
                        {pl.title || pl.name || 'Untitled Playlist'}
                      </h4>
                      <p className="text-[11px] text-zinc-400 truncate">
                        {count} {count === 1 ? 'song' : 'songs'}
                      </p>
                    </div>
                  </div>

                  {/* Checkbox indicator */}
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition shrink-0 ${
                      isChecked
                        ? 'bg-white border-white text-black'
                        : 'border-zinc-600 bg-zinc-900/80'
                    }`}
                  >
                    {isChecked && <Check className="w-3.5 h-3.5 stroke-[3] text-black" />}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-zinc-500 text-xs sm:text-sm">
              {searchQuery ? 'No playlists found.' : 'No playlists yet. Create one above!'}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-zinc-400">
            {selectedPlaylistIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-xs sm:text-sm text-zinc-400 hover:text-white rounded-full transition cursor-pointer font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2 bg-white hover:bg-zinc-200 text-black font-bold text-xs sm:text-sm rounded-full transition shadow-md cursor-pointer hover:scale-105 active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
