import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Copy, 
  Check, 
  Play, 
  Pause, 
  RefreshCw, 
  Settings, 
  ChevronRight, 
  Disc3, 
  Pencil, 
  Camera, 
  X, 
  ExternalLink 
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { 
  getUserUuid, 
  fetchUserProfile, 
  saveUserProfile, 
  PROFILE_NAME_KEY, 
  PROFILE_AVATAR_KEY,
  PLAYLIST_HISTORY_KEY 
} from '../services/api';
import { 
  RECENTLY_PLAYED_KEY, 
  deriveProfileHistory, 
  mergeHistoryLists 
} from '../utils/historyManager';

const TIMEFRAMES = [
  { id: '7d',   label: 'Last 7 Days' },
  { id: '30d',  label: 'Last 30 Days' },
  { id: 'all',  label: 'All Time' },
];

const AVATAR_PRESETS = [
  {
    id: 'headphones',
    label: 'Headphones',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="20" fill="%23121214"/><path d="M26 50v18c0 4.4 3.6 8 8 8h2c2.2 0 4-1.8 4-4V52c0-2.2-1.8-4-4-4h-6c-2.2 0-4 1.8-4 2zm48-2h-6c-2.2 0-4 1.8-4 4v20c0 2.2 1.8 4 4 4h2c4.4 0 8-3.6 8-8V50c0-1.1-.9-2-2-2z" fill="%23ffffff"/><path d="M30 50c0-11 9-20 20-20s20 9 20 20" stroke="%23ffffff" stroke-width="5" stroke-linecap="round"/></svg>'
  },
  {
    id: 'vinyl',
    label: 'Vinyl',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="20" fill="%23121214"/><circle cx="50" cy="50" r="32" stroke="%23ffffff" stroke-width="4"/><circle cx="50" cy="50" r="23" stroke="%2371717a" stroke-width="2"/><circle cx="50" cy="50" r="14" fill="%23ffffff"/><circle cx="50" cy="50" r="4" fill="%23121214"/></svg>'
  },
  {
    id: 'waves',
    label: 'Waveform',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="20" fill="%23121214"/><rect x="22" y="42" width="6" height="16" rx="3" fill="%23ffffff"/><rect x="34" y="30" width="6" height="40" rx="3" fill="%23ffffff"/><rect x="47" y="20" width="6" height="60" rx="3" fill="%23ffffff"/><rect x="60" y="34" width="6" height="32" rx="3" fill="%23ffffff"/><rect x="72" y="44" width="6" height="12" rx="3" fill="%23ffffff"/></svg>'
  },
  {
    id: 'user',
    label: 'Minimal User',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="20" fill="%23121214"/><circle cx="50" cy="38" r="14" fill="%23ffffff"/><path d="M26 74c0-13.2 10.8-24 24-24s24 10.8 24 24" fill="%23ffffff"/></svg>'
  }
];

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Recently';
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - Number(timestamp)) / 1000));
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

function formatDurationText(secs) {
  if (!secs || secs <= 0) return '0s';
  const s = Math.max(0, Math.round(secs));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
}

export default function ProfilePage({ setCurrentView, refreshKey = 0 }) {
  const { pendingTrack, currentTrack, isPlaying, playPause, selectAndPlayTrack } = usePlayer() || {};
  const activeTrack = currentTrack || pendingTrack;

  const [timeframe, setTimeframe] = useState('7d');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedSyncId, setCopiedSyncId] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all' | 'songs' | 'playlists'

  // Profile Identity (Synced with Turso & localStorage)
  const [displayName, setDisplayName] = useState(() => {
    try {
      return localStorage.getItem(PROFILE_NAME_KEY) || 'Loopner';
    } catch (_) {
      return 'Loopner';
    }
  });
  const [avatarUrl, setAvatarUrl] = useState(() => {
    try {
      return localStorage.getItem(PROFILE_AVATAR_KEY) || '';
    } catch (_) {
      return '';
    }
  });

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(displayName);

  // Avatar modal state
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [customAvatarInput, setCustomAvatarInput] = useState('');

  const userUuid = useMemo(() => getUserUuid(), []);
  const shortUuid = useMemo(() => {
    if (!userUuid) return 'device';
    if (userUuid.length > 10) {
      return `${userUuid.slice(0, 4)}...${userUuid.slice(-4)}`;
    }
    return userUuid;
  }, [userUuid]);

  // Sync profile data with backend on mount
  useEffect(() => {
    let isMounted = true;
    fetchUserProfile(userUuid)
      .then((profile) => {
        if (!isMounted || !profile) return;
        if (profile.display_name) {
          setDisplayName(profile.display_name);
          try {
            localStorage.setItem(PROFILE_NAME_KEY, profile.display_name);
          } catch (_) {}
        }
        if (profile.avatar_url !== undefined) {
          setAvatarUrl(profile.avatar_url || '');
          try {
            localStorage.setItem(PROFILE_AVATAR_KEY, profile.avatar_url || '');
          } catch (_) {}
        }
      })
      .catch((err) => {
        console.warn('Failed to load user profile from server:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [userUuid]);

  // Save display name changes
  const handleSaveName = async () => {
    const trimmed = tempName.trim() || 'Loopner';
    setDisplayName(trimmed);
    setIsEditingName(false);
    try {
      localStorage.setItem(PROFILE_NAME_KEY, trimmed);
    } catch (_) {}
    await saveUserProfile({
      user_uuid: userUuid,
      display_name: trimmed,
      avatar_url: avatarUrl
    });
  };

  // Save avatar change
  const handleSelectAvatar = async (url) => {
    setAvatarUrl(url);
    setIsAvatarModalOpen(false);
    try {
      localStorage.setItem(PROFILE_AVATAR_KEY, url);
    } catch (_) {}
    await saveUserProfile({
      user_uuid: userUuid,
      display_name: displayName,
      avatar_url: url
    });
  };

  const handleCustomAvatarSubmit = async (e) => {
    e.preventDefault();
    const trimmed = customAvatarInput.trim();
    if (!trimmed) return;
    await handleSelectAvatar(trimmed);
    setCustomAvatarInput('');
  };



  // Fetch listening stats from backend with local fallback
  const fetchProfileStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/user/stats?user_uuid=${encodeURIComponent(userUuid)}&timeframe=${timeframe}`);
      if (res.ok) {
        const data = await res.json();
        
        let localRecently = [];
        try {
          localRecently = JSON.parse(localStorage.getItem(RECENTLY_PLAYED_KEY) || '[]');
        } catch (_) {}

        const mergedHistory = mergeHistoryLists(localRecently, data.history || []);
        let savedPlaylists = [];
        try {
          savedPlaylists = JSON.parse(localStorage.getItem('playloop_saved_playlists') || '[]');
        } catch (_) {}

        const derived = deriveProfileHistory(mergedHistory, savedPlaylists);

        setStats({
          ...data,
          history: derived.all,
          songHistory: derived.songs,
          playlistHistory: derived.playlists,
          rawHistory: mergedHistory
        });
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      console.warn('[ProfilePage] Server stats fetch failed, generating fallback:', err);
      try {
        let localRecently = [];
        try {
          localRecently = JSON.parse(localStorage.getItem(RECENTLY_PLAYED_KEY) || '[]');
        } catch (_) {}

        let savedPlaylists = [];
        try {
          savedPlaylists = JSON.parse(localStorage.getItem('playloop_saved_playlists') || '[]');
        } catch (_) {}

        const derived = deriveProfileHistory(localRecently, savedPlaylists);

        const totalPlays = localRecently.length;
        const uniqueTitles = new Set(localRecently.map((p) => `${p.title}||${p.artist}`));
        const totalSongs = uniqueTitles.size || totalPlays;
        const totalSeconds = localRecently.reduce((acc, cur) => acc + (Number(cur.duration || 180)), 0);

        const artistMap = {};
        const trackMap = {};
        localRecently.forEach((p) => {
          if (p.artist) {
            artistMap[p.artist] = (artistMap[p.artist] || 0) + 1;
          }
          if (p.title) {
            const k = `${p.title}||${p.artist}||${p.track_id || p.videoId || ''}`;
            if (!trackMap[k]) {
              trackMap[k] = {
                title: p.title,
                artist: p.artist,
                track_id: p.track_id || p.videoId,
                cover: p.cover || p.thumbnail || '/default-cover.svg',
                playCount: 0
              };
            }
            trackMap[k].playCount += 1;
          }
        });

        const topArtists = Object.entries(artistMap)
          .map(([artist, playCount]) => ({ artist, playCount }))
          .sort((a, b) => b.playCount - a.playCount)
          .slice(0, 5);

        const topTracks = Object.values(trackMap)
          .sort((a, b) => b.playCount - a.playCount)
          .slice(0, 5);

        setStats({
          totalPlays,
          totalSongs,
          totalListeningTime: formatDurationText(totalSeconds),
          listeningTimeFormatted: formatDurationText(totalSeconds),
          topArtists,
          topTracks,
          history: derived.all,
          songHistory: derived.songs,
          playlistHistory: derived.playlists,
          rawHistory: localRecently
        });
      } catch (fallbackErr) {
        console.error('[ProfilePage] Fallback generation error:', fallbackErr);
        setError('Could not load listening activity.');
      }
    } finally {
      setLoading(false);
    }
  }, [userUuid, timeframe]);

  useEffect(() => {
    fetchProfileStats();
  }, [fetchProfileStats, refreshKey]);

  useEffect(() => {
    const handleHistoryUpdated = (e) => {
      const updated = e.detail;
      if (Array.isArray(updated)) {
        try {
          const savedPlaylists = JSON.parse(localStorage.getItem('playloop_saved_playlists') || '[]');
          const derived = deriveProfileHistory(updated, savedPlaylists);
          setStats((prev) => prev ? {
            ...prev,
            rawHistory: updated,
            history: derived.all,
            songHistory: derived.songs,
            playlistHistory: derived.playlists
          } : prev);
        } catch (_) {}
      }
    };
    const handlePlaylistActivity = () => {
      fetchProfileStats();
    };
    window.addEventListener('playloop-history-updated', handleHistoryUpdated);
    window.addEventListener('playloop-playlist-activity', handlePlaylistActivity);
    window.addEventListener('playloop-saved-playlists-updated', handlePlaylistActivity);
    return () => {
      window.removeEventListener('playloop-history-updated', handleHistoryUpdated);
      window.removeEventListener('playloop-playlist-activity', handlePlaylistActivity);
      window.removeEventListener('playloop-saved-playlists-updated', handlePlaylistActivity);
    };
  }, [fetchProfileStats]);

  // Handle Copy Sync ID
  const handleCopySyncId = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(userUuid);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = userUuid;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedSyncId(true);
      setTimeout(() => setCopiedSyncId(false), 2000);
    } catch (e) {
      console.warn('Failed to copy Sync ID:', e);
    }
  };

  // Play track immediately
  const handlePlayTrack = (track) => {
    if (!track) return;
    const trackId = track.track_id || track.videoId || track.id;
    if (!trackId) return;

    if (activeTrack && (activeTrack.videoId === trackId || activeTrack.track_id === trackId)) {
      if (typeof playPause === 'function') {
        playPause();
      }
      return;
    }

    if (typeof selectAndPlayTrack === 'function') {
      selectAndPlayTrack(
        trackId,
        track.title || 'Unknown Track',
        track.artist || 'Unknown Artist',
        track.cover || track.thumbnail || '/default-cover.svg'
      );
    }
  };

  // Open playlist
  const handlePlaylistClick = (playlist) => {
    const pid = playlist.playlist_id || playlist.id || playlist.playlistId;
    if (pid) {
      window.location.hash = `#/playlist/${pid}`;
    }
  };

  const isCurrentPlaying = (trackId) => {
    if (!activeTrack || !isPlaying) return false;
    return (activeTrack.videoId === trackId || activeTrack.track_id === trackId);
  };

  const totalPlays = stats?.totalPlays || 0;
  const totalSongs = stats?.totalSongs || stats?.uniqueSongs || totalPlays;
  const uniqueSongs = stats?.uniqueSongs || totalSongs;
  const listeningTime = stats?.listeningTimeFormatted || stats?.totalListeningTime || (totalPlays > 0 ? formatDurationText(totalPlays * 210) : '0s');
  const topTracks = stats?.topTracks || [];
  const topArtists = stats?.topArtists || [];
  const historyItems = stats?.history || [];

  // Spotlight Track (#1 Most Played)
  const spotlightTrack = topTracks[0] || null;
  const isSpotlightActive = spotlightTrack && isCurrentPlaying(spotlightTrack.track_id);

  // Filter history
  const filteredHistory = useMemo(() => {
    if (historyFilter === 'songs') {
      return stats?.songHistory || [];
    }
    if (historyFilter === 'playlists') {
      return stats?.playlistHistory || [];
    }
    return stats?.history || [];
  }, [stats?.history, stats?.songHistory, stats?.playlistHistory, historyFilter]);

  const isColdStart = !loading && totalPlays === 0 && historyItems.length === 0;

  return (
    <div className="w-full max-w-6xl mx-auto pb-32 px-4 sm:px-6 lg:px-8 mt-4 sm:mt-6 select-none bg-black text-white animate-in fade-in duration-200">

      {/* ------------------------------------------------------------------ */}
      {/* 1. Header & Profile Identity                                       */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-5 sm:p-7 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          
          {/* Avatar & Display Name */}
          <div className="flex items-center gap-3.5 sm:gap-5 min-w-0 w-full sm:w-auto">
            {/* Avatar container with hover edit button */}
            <div 
              onClick={() => setIsAvatarModalOpen(true)}
              className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center cursor-pointer group shadow-md"
              title="Change profile avatar"
            >
              <img
                src={avatarUrl || '/default-cover.svg'}
                alt={displayName}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={(e) => { e.target.src = '/default-cover.svg'; }}
              />
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-5 h-5 text-white" />
              </div>
            </div>

            {/* Profile Identity Details */}
            <div className="min-w-0 flex-1">
              {isEditingName ? (
                <form 
                  onSubmit={(e) => { e.preventDefault(); handleSaveName(); }}
                  className="flex items-center gap-2 mb-1 w-full min-w-0"
                >
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onBlur={handleSaveName}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setTempName(displayName);
                        setIsEditingName(false);
                      }
                    }}
                    maxLength={32}
                    autoFocus
                    className="bg-black border border-zinc-700 focus:border-white focus:outline-none text-white text-lg sm:text-2xl font-bold px-3 py-1 rounded-xl flex-1 min-w-0 w-full sm:w-auto sm:max-w-[280px]"
                  />
                  <button
                    type="submit"
                    onMouseDown={(e) => e.preventDefault()}
                    className="shrink-0 p-1.5 rounded-full bg-white text-black hover:bg-zinc-200 transition cursor-pointer"
                    title="Save name"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2 group/edit mb-1 min-w-0">
                  <h1 
                    onClick={() => { setTempName(displayName); setIsEditingName(true); }}
                    className="text-xl sm:text-3xl font-extrabold text-white tracking-tight cursor-pointer hover:text-zinc-200 transition-colors truncate"
                    title="Click to edit name"
                  >
                    {displayName}
                  </h1>
                  <button
                    type="button"
                    onClick={() => { setTempName(displayName); setIsEditingName(true); }}
                    className="shrink-0 p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition opacity-70 group-hover/edit:opacity-100 cursor-pointer"
                    aria-label="Edit display name"
                    title="Edit display name"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              )}

              <p className="text-xs text-zinc-400 font-mono flex items-center gap-1.5">
                <span>Play LooP Member</span>
              </p>
            </div>
          </div>

          {/* Device Sync ID Pill & Settings Link */}
          <div className="flex flex-wrap items-center gap-3 self-start sm:self-center">
            {/* Sync ID Pill */}
            <div className="inline-flex items-center gap-2 bg-zinc-900/60 border border-zinc-800 rounded-full px-3.5 py-1.5 text-xs text-zinc-400 font-mono">
              <span className="text-zinc-500">ID:</span>
              <span className="text-zinc-300 font-medium select-all">{shortUuid}</span>
              <button
                type="button"
                onClick={handleCopySyncId}
                className="ml-1 text-zinc-400 hover:text-white transition cursor-pointer flex items-center gap-1"
                title="Copy full Device Sync UUID"
              >
                {copiedSyncId ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span className="text-white text-[11px] font-medium">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Subtle Link to Settings */}
            <button
              type="button"
              onClick={() => {
                if (typeof setCurrentView === 'function') setCurrentView('settings');
                window.location.hash = '#/settings';
              }}
              className="inline-flex items-center gap-1.5 bg-zinc-800/80 text-zinc-300 rounded-full px-4 py-1.5 text-sm hover:text-white border border-transparent hover:border-zinc-700 transition cursor-pointer"
              title="Pair device in Settings"
            >
              <Settings className="w-3.5 h-3.5 text-zinc-400" />
              <span>Settings</span>
            </button>
          </div>

        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Listening Highlights & Timeframe Filter                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-8">
        
        {/* Timeframe Control Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Listening Highlights
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Personalized activity and playback breakdown
            </p>
          </div>

          <div className="flex items-center gap-2">
            {TIMEFRAMES.map((tf) => {
              const isSelected = timeframe === tf.id;
              return (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => setTimeframe(tf.id)}
                  className={`cursor-pointer ${
                    isSelected
                      ? 'bg-white text-black font-medium rounded-full px-4 py-1.5 text-sm'
                      : 'bg-zinc-800/80 text-zinc-300 rounded-full px-4 py-1.5 text-sm hover:text-white border border-transparent hover:border-zinc-700 transition'
                  }`}
                >
                  {tf.label}
                </button>
              );
            })}

            <button
              type="button"
              onClick={fetchProfileStats}
              disabled={loading}
              className="p-2 rounded-full bg-zinc-800/80 text-zinc-300 hover:text-white border border-transparent hover:border-zinc-700 transition disabled:opacity-40 cursor-pointer ml-1"
              aria-label="Refresh listening statistics"
              title="Refresh stats"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-white' : ''}`} />
            </button>
          </div>
        </div>

        {/* Asymmetric 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          
          {/* Spotlight Featured Card (Left / Top on mobile) */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-3xl p-5 sm:p-6 flex flex-col justify-between h-full relative group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Spotlight • #1 Most Played
                  </span>
                  {spotlightTrack && (
                    <span className="text-xs font-mono text-zinc-400 bg-zinc-800/80 border border-zinc-700/60 rounded-full px-2.5 py-0.5">
                      {spotlightTrack.playCount} {spotlightTrack.playCount === 1 ? 'play' : 'plays'}
                    </span>
                  )}
                </div>

                {spotlightTrack ? (
                  <div>
                    {/* Artwork with overlay circular play button */}
                    <div className="relative w-full aspect-square max-h-64 sm:max-h-72 rounded-2xl overflow-hidden bg-black/50 border border-zinc-800/80 my-3 shadow-2xl">
                      <img
                        src={spotlightTrack.cover || '/default-cover.svg'}
                        alt={spotlightTrack.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => { e.target.src = '/default-cover.svg'; }}
                      />
                      {/* Play Button Overlay */}
                      <button
                        type="button"
                        onClick={() => handlePlayTrack(spotlightTrack)}
                        className="absolute bottom-4 right-4 w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:bg-zinc-200 hover:scale-105 active:scale-95 transition shadow-2xl cursor-pointer"
                        aria-label={`Play ${spotlightTrack.title}`}
                      >
                        {isSpotlightActive ? (
                          <Pause className="w-5 h-5 fill-current" />
                        ) : (
                          <Play className="w-5 h-5 fill-current translate-x-[1px]" />
                        )}
                      </button>
                    </div>

                    <div className="mt-3">
                      <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate leading-tight">
                        {spotlightTrack.title}
                      </h3>
                      <p className="text-sm text-zinc-400 truncate mt-1">
                        {spotlightTrack.artist}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 sm:py-16 text-center flex flex-col items-center justify-center">
                    <Disc3 className="w-12 h-12 text-zinc-600 mb-3" />
                    <h4 className="text-base font-bold text-white mb-1">
                      No top track yet
                    </h4>
                    <p className="text-xs text-zinc-400 max-w-xs mb-5">
                      Start listening to tracks on Play LooP to showcase your #1 most played track here.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof setCurrentView === 'function') setCurrentView('home');
                        window.location.hash = '#/home';
                      }}
                      className="bg-white text-black font-medium rounded-full px-5 py-2 hover:bg-zinc-200 transition text-xs sm:text-sm cursor-pointer"
                    >
                      Listen Now
                    </button>
                  </div>
                )}
              </div>

              {spotlightTrack && (
                <div className="pt-4 mt-4 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
                  <span>Based on active listening duration</span>
                  <button
                    type="button"
                    onClick={() => handlePlayTrack(spotlightTrack)}
                    className="hover:text-white transition font-medium cursor-pointer"
                  >
                    {isSpotlightActive ? 'Pause' : 'Play Track'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Volume & Stats Column (Right / Bottom on mobile) */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            
            {/* Time Listened Card */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6 sm:p-7 flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Time Listened
                </span>
                <p className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight tabular-nums mt-3 mb-2">
                  {loading && !stats ? '—' : listeningTime}
                </p>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Second-accurate playback time recorded across all your sessions.
                </p>
              </div>
            </div>

            {/* Top Artist Card */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6 sm:p-7 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Top Artist
                  </span>
                  <span className="text-xs text-zinc-500 font-mono">
                    {topArtists[0]?.playCount ? `${topArtists[0].playCount} plays` : ''}
                  </span>
                </div>

                <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight truncate mt-1">
                  {loading && !stats ? '—' : (topArtists[0]?.artist || 'No artists recorded yet')}
                </p>
                
                {/* Secondary artist breakdown if available */}
                {topArtists.length > 1 && (
                  <div className="mt-4 pt-3 border-t border-zinc-800/60 space-y-2">
                    {topArtists.slice(1, 4).map((a, idx) => (
                      <div key={`${a.artist}-${idx}`} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-300 truncate max-w-[200px]">{a.artist}</span>
                        <span className="text-zinc-500 font-mono">{a.playCount} plays</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Total Songs and Unique Tracks Horizontal Strip */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 sm:p-5 flex items-center justify-around text-center">
              <div className="flex-1">
                <p className="text-2xl sm:text-3xl font-extrabold text-white tabular-nums tracking-tight">
                  {loading && !stats ? '—' : totalPlays.toLocaleString()}
                </p>
                <p className="text-xs font-medium text-zinc-400 mt-1">
                  Total Songs Played
                </p>
              </div>

              <div className="h-10 w-px bg-zinc-800 shrink-0" />

              <div className="flex-1">
                <p className="text-2xl sm:text-3xl font-extrabold text-white tabular-nums tracking-tight">
                  {loading && !stats ? '—' : uniqueSongs.toLocaleString()}
                </p>
                <p className="text-xs font-medium text-zinc-400 mt-1">
                  Unique Tracks
                </p>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Listening History Feed                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-5 sm:p-7">
        
        {/* History Header & Category Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-zinc-800/60">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Listening History
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Chronological feed of played songs and imported playlists
            </p>
          </div>

          <div className="flex items-center gap-2">
            {[
              { id: 'all',       label: 'All Activity' },
              { id: 'songs',     label: 'Tracks' },
              { id: 'playlists', label: 'Playlists' },
            ].map((pill) => {
              const isSelected = historyFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setHistoryFilter(pill.id)}
                  className={`cursor-pointer ${
                    isSelected
                      ? 'bg-white text-black font-medium rounded-full px-4 py-1.5 text-sm'
                      : 'bg-zinc-800/80 text-zinc-300 rounded-full px-4 py-1.5 text-sm hover:text-white border border-transparent hover:border-zinc-700 transition'
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* History List or Empty State */}
        {filteredHistory.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Disc3 className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-zinc-300">
              No listening history yet.
            </p>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
              Start playing tracks on Loop to build your profile.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredHistory.map((item, idx) => {
              const isSong = item.type === 'song';
              const isTrackActive = isSong && isCurrentPlaying(item.track_id);

              return (
                <div
                  key={`${item.id || item.track_id || item.playlist_id}-${idx}`}
                  onClick={() => {
                    if (isSong) handlePlayTrack(item);
                    else handlePlaylistClick(item);
                  }}
                  className="rounded-2xl hover:bg-zinc-900 transition p-3 sm:p-3.5 flex items-center justify-between gap-4 border border-transparent hover:border-zinc-800/80 cursor-pointer group"
                >
                  {/* Left: Thumbnail & Details */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-zinc-800 border border-zinc-800 shadow-sm">
                      <img
                        src={item.cover || '/default-cover.svg'}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.src = '/default-cover.svg'; }}
                        loading="lazy"
                      />
                      {isSong ? (
                        <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity ${
                          isTrackActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}>
                          {isTrackActive ? (
                            <Pause className="w-4 h-4 text-white fill-current" />
                          ) : (
                            <Play className="w-4 h-4 text-white fill-current translate-x-[1px]" />
                          )}
                        </div>
                      ) : (
                        <div className="absolute bottom-1 right-1 bg-black/80 rounded px-1 text-[9px] text-zinc-300 font-mono">
                          {item.count || 0}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm sm:text-base font-medium truncate ${
                          isTrackActive ? 'text-white font-bold' : 'text-white'
                        }`}>
                          {item.title}
                        </p>
                        {!isSong && (
                          <span className="text-[10px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/60 rounded-full px-2 py-0.5 shrink-0">
                            Playlist
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 truncate mt-0.5">
                        {item.artist || 'Unknown Artist'}
                      </p>
                    </div>
                  </div>

                  {/* Right: Timestamp & Action */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-zinc-500 font-mono whitespace-nowrap">
                      {item.last_played_at || formatRelativeTime(item.played_at)}
                    </span>

                    {isSong ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayTrack(item);
                        }}
                        className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:bg-zinc-200 hover:scale-105 active:scale-95 transition shadow opacity-0 group-hover:opacity-100 sm:opacity-0 max-sm:opacity-100 cursor-pointer"
                        aria-label={`Play ${item.title}`}
                      >
                        {isTrackActive ? (
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current translate-x-[1px]" />
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlaylistClick(item);
                        }}
                        className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition opacity-0 group-hover:opacity-100 sm:opacity-0 max-sm:opacity-100 cursor-pointer"
                        aria-label={`Open ${item.title}`}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 4. Minimal Monochrome Avatar Picker Modal                          */}
      {/* ------------------------------------------------------------------ */}
      {isAvatarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-2xl relative">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-zinc-800">
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Choose Avatar
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Select a monochrome avatar or enter an image URL
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(false)}
                className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 4 Monochrome Presets Grid */}
            <div className="mb-6">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-3">
                Minimalist Presets
              </span>
              <div className="grid grid-cols-4 gap-3">
                {AVATAR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectAvatar(preset.url)}
                    className="flex flex-col items-center gap-2 p-2 rounded-2xl bg-zinc-950/60 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-600 transition group cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 flex items-center justify-center">
                      <img
                        src={preset.url}
                        alt={preset.label}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-[11px] font-medium text-zinc-400 group-hover:text-white truncate max-w-full">
                      {preset.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom URL Input Form */}
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
                Custom Image URL
              </span>
              <form onSubmit={handleCustomAvatarSubmit} className="space-y-3">
                <input
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  value={customAvatarInput}
                  onChange={(e) => setCustomAvatarInput(e.target.value)}
                  className="w-full bg-black border border-zinc-800 focus:border-white focus:outline-none text-white text-xs sm:text-sm px-3.5 py-2.5 rounded-xl placeholder-zinc-500"
                />
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAvatarModalOpen(false)}
                    className="bg-zinc-800/80 text-zinc-300 rounded-full px-4 py-1.5 text-sm hover:text-white border border-transparent hover:border-zinc-700 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!customAvatarInput.trim()}
                    className="bg-white text-black font-medium rounded-full px-5 py-1.5 text-sm hover:bg-zinc-200 transition disabled:opacity-40 cursor-pointer"
                  >
                    Apply URL
                  </button>
                </div>
              </form>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
