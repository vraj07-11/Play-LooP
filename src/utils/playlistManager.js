import { savePlaylistApi, unsavePlaylistApi, invalidatePlaylistDetailsCache } from '../services/api.js';

export const SAVED_PLAYLISTS_KEY = 'playloop_saved_playlists';

/**
 * Get all playlists stored in localStorage.
 */
export function getSavedPlaylists() {
  try {
    const raw = localStorage.getItem(SAVED_PLAYLISTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to read saved playlists:', e);
    return [];
  }
}

/**
 * Save playlists array to localStorage, fire update event, and return the list.
 */
export function persistPlaylists(playlists) {
  try {
    localStorage.setItem(SAVED_PLAYLISTS_KEY, JSON.stringify(playlists));
    invalidatePlaylistDetailsCache();
    window.dispatchEvent(new Event('playloop-saved-playlists-updated'));
  } catch (e) {
    console.error('Failed to save playlists to localStorage:', e);
  }
}

/**
 * Create a new user playlist, persist locally, sync with backend, and notify listeners.
 */
export function createUserPlaylist(name, description = '') {
  const playlists = getSavedPlaylists();
  const id = `user_pl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const cleanName = (name && name.trim()) ? name.trim() : `My Playlist #${playlists.length + 1}`;

  const newPlaylist = {
    playlistId: id,
    id: id,
    title: cleanName,
    name: cleanName,
    author: 'You',
    description: description.trim(),
    thumbnail: '/default-cover.svg',
    count: 0,
    tracks: [],
    isUserCreated: true,
    created_at: Date.now(),
    updated_at: Date.now()
  };

  const updated = [newPlaylist, ...playlists];
  persistPlaylists(updated);
  savePlaylistApi(newPlaylist).catch(() => {});

  return newPlaylist;
}

/**
 * Rename and/or update description of a user playlist.
 */
export function renameUserPlaylist(playlistId, newName, newDescription = null) {
  const playlists = getSavedPlaylists();
  const pid = String(playlistId);
  let updatedPlaylist = null;

  const updated = playlists.map((p) => {
    if (String(p.playlistId || p.id) === pid) {
      const cleanTitle = (newName && newName.trim()) ? newName.trim() : (p.title || p.name);
      updatedPlaylist = {
        ...p,
        title: cleanTitle,
        name: cleanTitle,
        description: newDescription !== null ? newDescription.trim() : (p.description || ''),
        updated_at: Date.now()
      };
      return updatedPlaylist;
    }
    return p;
  });

  if (updatedPlaylist) {
    persistPlaylists(updated);
    savePlaylistApi(updatedPlaylist).catch(() => {});
  }

  return updatedPlaylist;
}

/**
 * Delete a user or saved playlist.
 */
export function deleteUserPlaylist(playlistId) {
  const playlists = getSavedPlaylists();
  const pid = String(playlistId);
  const updated = playlists.filter((p) => String(p.playlistId || p.id) !== pid);

  persistPlaylists(updated);
  unsavePlaylistApi(pid).catch(() => {});
  return updated;
}

/**
 * Add or remove a song from multiple playlists simultaneously.
 * @param {Object} song - normalized song object { videoId, title, artist, thumbnail, duration, ... }
 * @param {Array<string>} targetPlaylistIds - list of playlist IDs that should contain this song
 * @param {Array<string>} allPlaylistIds - all playlist IDs considered in the selection modal (to know which were unchecked)
 */
export function syncSongInPlaylists(song, targetPlaylistIds, allPlaylistIds) {
  const vid = song?.videoId || song?.id;
  if (!vid) return;
  const playlists = getSavedPlaylists();
  const targetSet = new Set(targetPlaylistIds.map(String));
  const consideredSet = new Set((allPlaylistIds || targetPlaylistIds).map(String));

  const cleanTrack = {
    videoId: vid,
    title: song.title || song.name || 'Unknown Track',
    artist: song.artist || song.channelTitle || song.singers || 'Unknown Artist',
    thumbnail: (!song.thumbnail || song.thumbnail === '/logo.svg') ? (song.image || '/default-cover.svg') : song.thumbnail,
    duration: Number(song.duration) || 180,
    album: song.album || ''
  };

  const modifiedPlaylists = [];

  const updated = playlists.map((p) => {
    const pid = String(p.playlistId || p.id);
    if (!consideredSet.has(pid)) {
      return p;
    }

    const currentTracks = Array.isArray(p.tracks) ? [...p.tracks] : [];
    const exists = currentTracks.some((t) => String(t.videoId || t.id) === String(cleanTrack.videoId));
    const shouldHave = targetSet.has(pid);

    if (shouldHave && !exists) {
      currentTracks.push(cleanTrack);
      const updatedP = {
        ...p,
        tracks: currentTracks,
        count: currentTracks.length,
        thumbnail: (!p.thumbnail || p.thumbnail === '/default-cover.svg') ? cleanTrack.thumbnail : p.thumbnail,
        updated_at: Date.now()
      };
      modifiedPlaylists.push(updatedP);
      return updatedP;
    } else if (!shouldHave && exists) {
      const filtered = currentTracks.filter((t) => String(t.videoId || t.id) !== String(cleanTrack.videoId));
      const updatedP = {
        ...p,
        tracks: filtered,
        count: filtered.length,
        thumbnail: filtered[0]?.thumbnail || '/default-cover.svg',
        updated_at: Date.now()
      };
      modifiedPlaylists.push(updatedP);
      return updatedP;
    }

    return p;
  });

  if (modifiedPlaylists.length > 0) {
    persistPlaylists(updated);
    modifiedPlaylists.forEach((mp) => {
      savePlaylistApi(mp).catch(() => {});
    });
  }
}

/**
 * Remove a single song from a playlist.
 */
export function removeSongFromPlaylist(playlistId, videoId) {
  const playlists = getSavedPlaylists();
  const pid = String(playlistId);
  const vid = String(videoId);
  let modified = null;

  const updated = playlists.map((p) => {
    if (String(p.playlistId || p.id) === pid) {
      const currentTracks = Array.isArray(p.tracks) ? p.tracks : [];
      const filtered = currentTracks.filter((t) => String(t.videoId || t.id) !== vid);
      modified = {
        ...p,
        tracks: filtered,
        count: filtered.length,
        thumbnail: filtered[0]?.thumbnail || '/default-cover.svg',
        updated_at: Date.now()
      };
      return modified;
    }
    return p;
  });

  if (modified) {
    persistPlaylists(updated);
    savePlaylistApi(modified).catch(() => {});
  }

  return modified;
}

/**
 * Reorder songs in a playlist (move track from fromIndex to toIndex).
 */
export function reorderSongsInPlaylist(playlistId, fromIndex, toIndex) {
  if (fromIndex === toIndex) return null;
  const playlists = getSavedPlaylists();
  const pid = String(playlistId);
  let modified = null;

  const updated = playlists.map((p) => {
    if (String(p.playlistId || p.id) === pid) {
      const tracks = Array.isArray(p.tracks) ? [...p.tracks] : [];
      if (fromIndex < 0 || fromIndex >= tracks.length || toIndex < 0 || toIndex >= tracks.length) {
        return p;
      }

      const [moved] = tracks.splice(fromIndex, 1);
      tracks.splice(toIndex, 0, moved);

      modified = {
        ...p,
        tracks,
        thumbnail: tracks[0]?.thumbnail || p.thumbnail || '/default-cover.svg',
        updated_at: Date.now()
      };
      return modified;
    }
    return p;
  });

  if (modified) {
    persistPlaylists(updated);
    savePlaylistApi(modified).catch(() => {});
  }

  return modified;
}
