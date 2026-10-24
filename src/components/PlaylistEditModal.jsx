import React, { useState, useEffect } from 'react';
import { X, FolderPlus, Edit3 } from 'lucide-react';
import { createUserPlaylist, renameUserPlaylist } from '../utils/playlistManager';

export default function PlaylistEditModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [playlistId, setPlaylistId] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

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

  useEffect(() => {
    const handleOpen = (e) => {
      const detail = e.detail || {};
      if (detail.playlistId) {
        setIsEditMode(true);
        setPlaylistId(detail.playlistId);
        setName(detail.title || detail.name || '');
        setDescription(detail.description || '');
      } else {
        setIsEditMode(false);
        setPlaylistId(null);
        setName(detail.defaultName || '');
        setDescription('');
      }
      setIsOpen(true);
    };

    window.addEventListener('playloop-open-playlist-edit', handleOpen);
    return () => window.removeEventListener('playloop-open-playlist-edit', handleOpen);
  }, []);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;

    if (isEditMode && playlistId) {
      renameUserPlaylist(playlistId, cleanName, description);
      window.dispatchEvent(
        new CustomEvent('playloop-toast', { detail: 'Playlist updated' })
      );
    } else {
      const created = createUserPlaylist(cleanName, description);
      window.dispatchEvent(
        new CustomEvent('playloop-toast', { detail: 'Playlist created' })
      );
      if (created?.playlistId) {
        window.location.hash = `#/playlist/${created.playlistId}`;
      }
    }

    setIsOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none"
      onClick={() => setIsOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label={isEditMode ? "Edit Playlist Details" : "Create New Playlist"}
    >
      <div
        className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-2xl backdrop-blur-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white">
              {isEditMode ? <Edit3 className="w-4 h-4 text-white" /> : <FolderPlus className="w-4 h-4 text-white" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight leading-tight">
                {isEditMode ? 'Edit Playlist' : 'New Playlist'}
              </h2>
              <p className="text-xs text-zinc-400">
                {isEditMode ? 'Change playlist name and description' : 'Create a custom collection of songs'}
              </p>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Name
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Late Night Vibes"
              maxLength={80}
              className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Description <span className="text-zinc-500 font-normal lowercase">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add an optional description..."
              maxLength={250}
              className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white transition resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-white rounded-full transition cursor-pointer font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-6 py-2 bg-white hover:bg-zinc-200 text-black font-bold text-sm rounded-full transition shadow-md cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
            >
              {isEditMode ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
