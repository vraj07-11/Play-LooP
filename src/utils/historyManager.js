/**
 * Unified Listening History Manager
 * Keeps track of the last 20 songs, supports playlist playback context,
 * multi-device synchronization by played_at timestamps, and separate profile feeds.
 */

export const RECENTLY_PLAYED_KEY = 'playloop_recently_played';
export const MAX_HISTORY_ITEMS = 20;

export function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Recently';
  const diffSec = Math.max(0, Math.floor((Date.now() - Number(timestamp)) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  return new Date(Number(timestamp)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function normalizeHistoryTrack(trackObj, playlistContext = null) {
  if (!trackObj) return null;
  const trackId = String(trackObj.videoId || trackObj.track_id || trackObj.id || '').trim();
  if (!trackId) return null;

  const artUrl = trackObj.cover || trackObj.thumbnail || trackObj.artwork || trackObj.albumArt || trackObj.image || null;
  const cleanCover = (!artUrl || artUrl === '/logo.svg') ? '/default-cover.svg' : artUrl;

  const playlistId = playlistContext?.id ? String(playlistContext.id) : null;
  const playlistName = playlistContext?.name || playlistContext?.title || null;
  const playlistArt = playlistContext?.cover || playlistContext?.thumbnail || null;
  const cleanPlaylistCover = (!playlistArt || playlistArt === '/logo.svg') ? cleanCover : playlistArt;
  const playlistCount = playlistContext?.count != null
    ? Number(playlistContext.count)
    : (Array.isArray(playlistContext?.tracks) ? playlistContext.tracks.length : null);
  const isImported = Boolean(playlistContext?.isImported);

  return {
    id: `hist_${trackId}_${Date.now()}`,
    track_id: trackId,
    videoId: trackId,
    title: String(trackObj.title || 'Unknown Track'),
    artist: String(trackObj.artist || 'Unknown Artist'),
    album: trackObj.album || null,
    cover: cleanCover,
    thumbnail: cleanCover,
    duration: trackObj.duration != null && !isNaN(trackObj.duration) ? Math.round(Number(trackObj.duration)) : null,
    played_at: Number(trackObj.played_at) || Date.now(),
    playlist_id: playlistId,
    playlist_name: playlistName,
    playlist_cover: playlistId ? cleanPlaylistCover : null,
    playlist_count: playlistCount,
    playlist_is_imported: isImported
  };
}

export function mergeHistoryLists(localList = [], incomingList = []) {
  const map = new Map();

  const add = (item) => {
    if (!item) return;
    const tid = String(item.videoId || item.track_id || item.id || '').trim();
    if (!tid) return;
    const existing = map.get(tid);
    const itemTime = Number(item.played_at) || 0;
    const existingTime = existing ? (Number(existing.played_at) || 0) : -1;

    if (!existing || itemTime >= existingTime) {
      map.set(tid, {
        ...existing,
        ...item,
        track_id: tid,
        videoId: tid,
        cover: item.cover || item.thumbnail || existing?.cover || existing?.thumbnail || '/default-cover.svg',
        thumbnail: item.thumbnail || item.cover || existing?.thumbnail || existing?.cover || '/default-cover.svg',
        played_at: itemTime > 0 ? itemTime : (existingTime > 0 ? existingTime : Date.now())
      });
    }
  };

  if (Array.isArray(localList)) localList.forEach(add);
  if (Array.isArray(incomingList)) incomingList.forEach(add);

  return Array.from(map.values())
    .sort((a, b) => (Number(b.played_at) || 0) - (Number(a.played_at) || 0))
    .slice(0, MAX_HISTORY_ITEMS);
}

export function deriveProfileHistory(historyList = [], savedPlaylists = []) {
  if (!Array.isArray(historyList)) return { all: [], songs: [], playlists: [] };

  // 1. Songs: all tracks in history formatted for the songs tab
  const songs = historyList.map((t, idx) => {
    const artUrl = t.cover || t.thumbnail || t.artwork || t.albumArt || t.image || '/default-cover.svg';
    const cleanCover = (!artUrl || artUrl === '/logo.svg') ? '/default-cover.svg' : artUrl;
    const trackId = t.videoId || t.track_id || t.id;
    const playedAt = Number(t.played_at) || (Date.now() - idx * 1000);
    return {
      id: `song_${trackId}_${playedAt}`,
      type: 'song',
      track_id: trackId,
      videoId: trackId,
      title: t.title || 'Unknown Track',
      artist: t.artist || 'Unknown Artist',
      album: t.album || null,
      cover: cleanCover,
      thumbnail: cleanCover,
      duration: t.duration || null,
      played_at: playedAt,
      last_played_at: formatRelativeTime(playedAt),
      playlist_id: t.playlist_id || null
    };
  });

  // Map of saved playlists for metadata enrichment
  const savedMap = new Map();
  if (Array.isArray(savedPlaylists)) {
    for (const p of savedPlaylists) {
      const pid = String(p.id || p.playlistId || p.playlist_id || '');
      if (pid) savedMap.set(pid, p);
    }
  }

  // 2. Playlists tab: unique played playlists from history + saved library playlists
  const playlistMap = new Map();
  for (const t of historyList) {
    if (t.playlist_id) {
      const pid = String(t.playlist_id);
      if (!playlistMap.has(pid)) {
        const saved = savedMap.get(pid);
        const name = t.playlist_name || saved?.name || saved?.title || (pid === 'liked_songs' ? 'Liked Songs' : 'Playlist');
        const art = t.playlist_cover || saved?.cover || saved?.thumbnail || t.cover || '/default-cover.svg';
        const cleanCover = (!art || art === '/logo.svg') ? '/default-cover.svg' : art;
        const count = t.playlist_count != null ? t.playlist_count : (saved?.count || saved?.tracks?.length || 0);
        const isImported = Boolean(t.playlist_is_imported ?? saved?.isImported);
        const playedAt = Number(t.played_at) || Date.now();
        playlistMap.set(pid, {
          id: `playlist_${pid}`,
          type: 'playlist',
          playlist_id: pid,
          playlistId: pid,
          title: name,
          name: name,
          artist: isImported ? 'Imported Playlist' : 'Playlist',
          author: isImported ? 'Imported Playlist' : 'Playlist',
          cover: cleanCover,
          thumbnail: cleanCover,
          count,
          tracks: saved?.tracks || [],
          isImported,
          played_at: playedAt,
          last_played_at: formatRelativeTime(playedAt),
          playCount: saved?.playCount || 1
        });
      }
    }
  }

  if (Array.isArray(savedPlaylists)) {
    for (const p of savedPlaylists) {
      const pid = String(p.id || p.playlistId || p.playlist_id || '');
      if (pid && !playlistMap.has(pid) && (p.lastPlayedAt || p.played_at || p.updated_at)) {
        const time = Number(p.played_at || (p.lastPlayedAt ? new Date(p.lastPlayedAt).getTime() : p.updated_at)) || 0;
        const art = p.cover || p.thumbnail || p.tracks?.[0]?.cover || '/default-cover.svg';
        playlistMap.set(pid, {
          id: `playlist_${pid}`,
          type: 'playlist',
          playlist_id: pid,
          playlistId: pid,
          title: p.title || p.name || 'Playlist',
          name: p.title || p.name || 'Playlist',
          artist: p.isImported ? 'Imported Playlist' : 'Playlist',
          author: p.isImported ? 'Imported Playlist' : 'Playlist',
          cover: (!art || art === '/logo.svg') ? '/default-cover.svg' : art,
          thumbnail: (!art || art === '/logo.svg') ? '/default-cover.svg' : art,
          count: p.count || p.tracks?.length || 0,
          tracks: p.tracks || [],
          isImported: Boolean(p.isImported),
          played_at: time,
          last_played_at: formatRelativeTime(time),
          playCount: p.playCount || 1
        });
      }
    }
  }
  const playlists = Array.from(playlistMap.values()).sort((a, b) => b.played_at - a.played_at);

  // 3. 'all' tab:
  // If songs were played from playlist, show only the playlist (not its tracks).
  // If songs were played outside the playlist, show the song cards.
  const all = [];
  const seenPlaylistIds = new Set();

  for (let i = 0; i < historyList.length; i++) {
    const item = historyList[i];
    if (item.playlist_id) {
      const pid = String(item.playlist_id);
      if (!seenPlaylistIds.has(pid)) {
        seenPlaylistIds.add(pid);
        const saved = savedMap.get(pid);
        const name = item.playlist_name || saved?.name || saved?.title || (pid === 'liked_songs' ? 'Liked Songs' : 'Playlist');
        const art = item.playlist_cover || saved?.cover || saved?.thumbnail || item.cover || '/default-cover.svg';
        const cleanCover = (!art || art === '/logo.svg') ? '/default-cover.svg' : art;
        const count = item.playlist_count != null ? item.playlist_count : (saved?.count || saved?.tracks?.length || 0);
        const isImported = Boolean(item.playlist_is_imported ?? saved?.isImported);
        const playedAt = Number(item.played_at) || (Date.now() - i * 1000);
        all.push({
          id: `playlist_${pid}_${playedAt}`,
          type: 'playlist',
          playlist_id: pid,
          playlistId: pid,
          title: name,
          name: name,
          artist: isImported ? 'Imported Playlist' : 'Playlist',
          author: isImported ? 'Imported Playlist' : 'Playlist',
          cover: cleanCover,
          thumbnail: cleanCover,
          count,
          tracks: saved?.tracks || [],
          isImported,
          played_at: playedAt,
          last_played_at: formatRelativeTime(playedAt),
          playCount: saved?.playCount || 1
        });
      }
      // Individual songs played from playlist are intentionally omitted from 'all'
    } else {
      // Standalone track played outside playlist
      const artUrl = item.cover || item.thumbnail || item.artwork || item.albumArt || item.image || '/default-cover.svg';
      const cleanCover = (!artUrl || artUrl === '/logo.svg') ? '/default-cover.svg' : artUrl;
      const trackId = item.videoId || item.track_id || item.id;
      const playedAt = Number(item.played_at) || (Date.now() - i * 1000);
      all.push({
        id: `song_${trackId}_${playedAt}`,
        type: 'song',
        track_id: trackId,
        videoId: trackId,
        title: item.title || 'Unknown Track',
        artist: item.artist || 'Unknown Artist',
        album: item.album || null,
        cover: cleanCover,
        thumbnail: cleanCover,
        duration: item.duration || null,
        played_at: playedAt,
        last_played_at: formatRelativeTime(playedAt)
      });
    }
  }

  return { all, songs, playlists };
}
