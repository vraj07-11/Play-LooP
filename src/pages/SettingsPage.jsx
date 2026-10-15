import React, { useState, useEffect } from 'react';
import { Download, Link, FileText, Upload, CheckCircle, AlertCircle, Trash2, Check, RefreshCw } from 'lucide-react';
import { fetchApi } from '../services/api';
import { usePlayer } from '../context/PlayerContext';

const AVAILABLE_LANGUAGES = [
  { id: 'english', label: 'English' },
  { id: 'hindi', label: 'Hindi' },
  { id: 'gujarati', label: 'Gujarati' },
  { id: 'punjabi', label: 'Punjabi' },
  { id: 'tamil', label: 'Tamil' },
  { id: 'telugu', label: 'Telugu' },
  { id: 'spanish', label: 'Spanish' },
  { id: 'marathi', label: 'Marathi' },
  { id: 'bhojpuri', label: 'Bhojpuri' },
  { id: 'malayalam', label: 'Malayalam' },
  { id: 'bengali', label: 'Bengali' },
  { id: 'kannada', label: 'Kannada' }
];

export default function SettingsPage({ setCurrentView, refreshKey = 0 }) {
  const { crossfadeDuration = 0, setCrossfadeDuration } = usePlayer() || {};
  const [activeTab, setActiveTab] = useState('link'); // 'link' | 'file'
  const [playlistLink, setPlaylistLink] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, statusText: '' });
  const [importError, setImportError] = useState('');
  const [previewPlaylist, setPreviewPlaylist] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedPlaylistId, setSavedPlaylistId] = useState('');
  const [showUnmatched, setShowUnmatched] = useState(false);

  const [lastNonZeroDuration, setLastNonZeroDuration] = useState(() => {
    return crossfadeDuration > 0 ? crossfadeDuration : 4;
  });

  const isCrossfadeEnabled = crossfadeDuration > 0;

  const handleToggleCrossfade = () => {
    if (isCrossfadeEnabled) {
      if (typeof setCrossfadeDuration === 'function') {
        setCrossfadeDuration(0);
      }
    } else {
      const targetDuration = lastNonZeroDuration > 0 ? lastNonZeroDuration : 4;
      if (typeof setCrossfadeDuration === 'function') {
        setCrossfadeDuration(targetDuration);
      }
    }
  };

  const handleCrossfadeChange = (val) => {
    const num = Math.max(1, Math.min(12, Number(val) || 1));
    setLastNonZeroDuration(num);
    if (typeof setCrossfadeDuration === 'function') {
      setCrossfadeDuration(num);
    }
  };

  // Preferred Languages State
  const [selectedLangs, setSelectedLangs] = useState([]);
  const [audioQuality, setAudioQuality] = useState('320');

  useEffect(() => {
    try {
      const prefStr = localStorage.getItem('preferred_languages');
      if (prefStr) {
        const parsed = JSON.parse(prefStr);
        if (Array.isArray(parsed)) {
          setSelectedLangs(parsed.map(l => String(l).toLowerCase()));
        }
      } else {
        setSelectedLangs(['english', 'hindi']);
      }
      const qual = localStorage.getItem('playloop_audio_quality') || '320';
      setAudioQuality(qual);
    } catch (e) {
      console.error(e);
    }

    if (window.location.hash.includes('import')) {
      const el = document.getElementById('import-section');
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, [refreshKey]);

  const toggleLanguage = (langId) => {
    const id = langId.toLowerCase();
    let updated;
    if (selectedLangs.includes(id)) {
      updated = selectedLangs.filter(l => l !== id);
    } else {
      updated = [...selectedLangs, id];
    }
    setSelectedLangs(updated);
    localStorage.setItem('preferred_languages', JSON.stringify(updated));
    window.dispatchEvent(new Event('playloop-languages-updated'));
  };

  const handleQualityChange = (e) => {
    const val = e.target.value;
    setAudioQuality(val);
    localStorage.setItem('playloop_audio_quality', val);
  };

  // --- Link Importer Logic ---
  const handleProcessLink = async (e) => {
    if (e) e.preventDefault();
    if (!playlistLink.trim()) return;

    setIsProcessing(true);
    setImportError('');
    setSaveSuccess(false);
    setPreviewPlaylist(null);
    setImportProgress({ current: 0, total: 0, statusText: 'Connecting to playlist source...' });

    try {
      const res = await fetch(`/api/import-playlist?url=${encodeURIComponent(playlistLink.trim())}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to parse playlist URL');
      }

      const data = await res.json();

      // If JioSaavn or SoundCloud playlist with direct tracks
      if ((data.source === 'jiosaavn' || data.source === 'soundcloud') && Array.isArray(data.tracks)) {
        setPreviewPlaylist({
          title: data.title || (data.source === 'soundcloud' ? 'SoundCloud Playlist' : 'JioSaavn Playlist'),
          author: data.author || (data.source === 'soundcloud' ? 'SoundCloud' : 'JioSaavn'),
          thumbnail: data.thumbnail || '/default-cover.svg',
          tracks: data.tracks
        });
        setIsProcessing(false);
        return;
      }

      // If Spotify or YouTube playlist requiring track search matching
      if (Array.isArray(data.songsToSearch) && data.songsToSearch.length > 0) {
        const total = Math.min(data.songsToSearch.length, 250);
        const matchedTracks = [];
        const unmatchedTracks = [];

        for (let i = 0; i < total; i++) {
          const songQuery = data.songsToSearch[i];
          setImportProgress({
            current: i + 1,
            total,
            statusText: `Matching track ${i + 1} of ${total}: "${songQuery.slice(0, 30)}..."`
          });

          // Multi-step query matching
          let matched = null;
          try {
            // Attempt 1: Full Query (Title + Artist)
            const res1 = await fetchApi(`/api/search?q=${encodeURIComponent(songQuery)}`);
            if (res1.ok) {
              const songs1 = await res1.json();
              if (Array.isArray(songs1) && songs1.length > 0) matched = songs1[0];
            }

            // Attempt 2: Clean Title (remove feat, brackets)
            if (!matched) {
              const cleanTitle = songQuery.replace(/[\(\[\{].*?[\)\]\}]/g, '').replace(/feat\..*/i, '').trim();
              if (cleanTitle && cleanTitle !== songQuery) {
                const res2 = await fetchApi(`/api/search?q=${encodeURIComponent(cleanTitle)}`);
                if (res2.ok) {
                  const songs2 = await res2.json();
                  if (Array.isArray(songs2) && songs2.length > 0) matched = songs2[0];
                }
              }
            }

            // Attempt 3: First 3 words fallback
            if (!matched && songQuery.includes(' ')) {
              const wordsQuery = songQuery.split(' ').slice(0, 3).join(' ');
              const res3 = await fetchApi(`/api/search?q=${encodeURIComponent(wordsQuery)}`);
              if (res3.ok) {
                const songs3 = await res3.json();
                if (Array.isArray(songs3) && songs3.length > 0) matched = songs3[0];
              }
            }
          } catch (err) {
            console.error(`Failed matching track ${songQuery}:`, err);
          }

          if (matched) {
            matchedTracks.push(matched);
          } else {
            const parts = songQuery.split(/ - | by | – /);
            const trackTitle = parts[0]?.trim() || songQuery;
            const trackArtist = parts[1]?.trim() || 'Imported Song';

            matchedTracks.push({
              videoId: `QUERY:${encodeURIComponent(songQuery)}`,
              title: trackTitle,
              artist: trackArtist,
              thumbnail: data.thumbnail || '/default-cover.svg',
              duration: 180,
              isImportedQuery: true
            });
          }
        }

        if (matchedTracks.length === 0) {
          throw new Error('Could not find matching audio streams for tracks in this playlist.');
        }

        setPreviewPlaylist({
          title: data.title || 'Imported Playlist',
          author: `${data.source.toUpperCase()} Import`,
          thumbnail: data.thumbnail || matchedTracks[0]?.thumbnail || '/default-cover.svg',
          tracks: matchedTracks,
          totalExtracted: total
        });
      } else {
        throw new Error('No songs could be extracted from this playlist link.');
      }
    } catch (err) {
      console.error('Import failed:', err);
      setImportError(err.message || 'Failed to import playlist.');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- File Importer Logic (JSON / CSV) ---
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    setIsProcessing(true);
    setImportError('');
    setSaveSuccess(false);
    setPreviewPlaylist(null);

    reader.onload = async (event) => {
      try {
        const content = event.target?.result;
        if (typeof content !== 'string') return;

        let songsToSearch = [];
        let fileNameTitle = file.name.replace(/\.[^/.]+$/, "");

        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(content);
          const list = Array.isArray(parsed) ? parsed : (parsed.tracks || parsed.songs || []);
          songsToSearch = list.map(item => {
            if (typeof item === 'string') return item;
            return `${item.title || item.name || ''} ${item.artist || item.artistName || ''}`.trim();
          }).filter(Boolean);
        } else {
          const lines = content.split('\n');
          for (let line of lines) {
            const parts = line.split(',').map(p => p.replace(/^"|"$/g, '').trim());
            if (parts.length >= 1 && parts[0] && !parts[0].toLowerCase().includes('title') && !parts[0].toLowerCase().includes('track')) {
              const query = parts.slice(0, 2).join(' ');
              if (query) songsToSearch.push(query);
            }
          }
        }

        if (songsToSearch.length === 0) {
          throw new Error('No valid song entries found in file.');
        }

        const total = Math.min(songsToSearch.length, 250);
        const matchedTracks = [];

        for (let i = 0; i < total; i++) {
          const songQuery = songsToSearch[i];
          setImportProgress({
            current: i + 1,
            total,
            statusText: `Matching ${i + 1} of ${total}: "${songQuery.slice(0, 25)}..."`
          });

          let matched = null;
          try {
            const searchRes = await fetchApi(`/api/search?q=${encodeURIComponent(songQuery)}`);
            if (searchRes.ok) {
              const songs = await searchRes.json();
              if (Array.isArray(songs) && songs.length > 0) matched = songs[0];
            }
          } catch (err) {
            console.error(`Failed matching track ${songQuery}:`, err);
          }

          if (matched) {
            matchedTracks.push(matched);
          } else {
            const parts = songQuery.split(/ - | by | – /);
            const trackTitle = parts[0]?.trim() || songQuery;
            const trackArtist = parts[1]?.trim() || 'Imported Song';

            matchedTracks.push({
              videoId: `QUERY:${encodeURIComponent(songQuery)}`,
              title: trackTitle,
              artist: trackArtist,
              thumbnail: '/default-cover.svg',
              duration: 180,
              isImportedQuery: true
            });
          }
        }

        if (matchedTracks.length === 0) {
          throw new Error('Could not find matches for songs in the uploaded file.');
        }

        setPreviewPlaylist({
          title: fileNameTitle || 'File Playlist Import',
          author: 'File Import',
          thumbnail: matchedTracks[0]?.thumbnail || '/default-cover.svg',
          tracks: matchedTracks
        });
      } catch (err) {
        console.error('File import error:', err);
        setImportError(err.message || 'Failed to process file.');
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsText(file);
  };

  // --- Save Playlist to Storage ---
  const handleSaveImportedPlaylist = () => {
    if (!previewPlaylist) return;
    try {
      const saved = JSON.parse(localStorage.getItem('playloop_saved_playlists') || '[]');
      const pid = `imported_${Date.now()}`;
      const newPlaylist = {
        playlistId: pid,
        title: previewPlaylist.title,
        author: previewPlaylist.author,
        thumbnail: previewPlaylist.thumbnail,
        description: `Imported playlist containing ${previewPlaylist.tracks.length} tracks.`,
        count: previewPlaylist.tracks.length,
        tracks: previewPlaylist.tracks
      };
      saved.unshift(newPlaylist);
      localStorage.setItem('playloop_saved_playlists', JSON.stringify(saved));
      window.dispatchEvent(new Event('playloop-saved-playlists-updated'));
      setSavedPlaylistId(pid);
      setSaveSuccess(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearSavedPlaylists = () => {
    if (window.confirm("Are you sure you want to clear all saved playlists?")) {
      localStorage.removeItem('playloop_saved_playlists');
      window.dispatchEvent(new Event('playloop-saved-playlists-updated'));
    }
  };

  const handleClearLikedSongs = () => {
    if (window.confirm("Are you sure you want to clear all liked songs?")) {
      localStorage.removeItem('playloop_liked_tracks');
      localStorage.removeItem('playloop_liked_tracks_list');
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-6 sm:space-y-8 pb-24 px-4 sm:px-6 lg:px-8 mt-6">
      {/* Play LooP Page Header */}
      <div className="page-header">
        <h2>Settings</h2>
        <p>Manage your Play LooP preferences and import music from external apps.</p>
      </div>

      {/* --- IMPORT PLAYLISTS CARD --- */}
      <div id="import-section" className="page-card space-y-6">
        <div className="flex items-center gap-3">
          <img src="/brand-logo.svg" alt="Play LooP Logo" className="w-8 h-8 shrink-0" />
          <div>
            <h3 className="text-xl font-semibold text-white">Import Playlists</h3>
            <p className="text-xs text-zinc-400">Bring music from Spotify, YT Music, SoundCloud, JioSaavn, or local JSON/CSV files</p>
          </div>
        </div>

        {/* Notice on catalog differences */}
        <div className="p-3 bg-black/40 border border-zinc-800/80 rounded-xl flex items-start gap-2.5 text-zinc-400 text-xs leading-relaxed">
          <AlertCircle className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
          <p className="font-normal text-zinc-400">
            <span className="text-zinc-300 font-medium">Note:</span> Imported playlists are matched against Play LooP's streaming catalog. Minor track variations or omissions may occur if specific songs are unavailable in our library.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'link'
                ? 'bg-white text-black'
                : 'bg-zinc-900 text-zinc-400 border border-zinc-700/80 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Link className="w-3.5 h-3.5" />
            <span>Link Importer</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('file')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'file'
                ? 'bg-white text-black'
                : 'bg-zinc-900 text-zinc-400 border border-zinc-700/80 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>CSV / JSON File</span>
          </button>
        </div>

        {/* TAB 1: Link Importer */}
        {activeTab === 'link' && (
          <form onSubmit={handleProcessLink} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="url"
                required
                value={playlistLink}
                onChange={(e) => setPlaylistLink(e.target.value)}
                placeholder="Paste Spotify, YT Music, SoundCloud, or JioSaavn link..."
                className="flex-1 bg-black/50 border border-zinc-700/80 focus:border-zinc-400 focus:outline-none text-white placeholder-zinc-500 px-4 py-2.5 rounded-lg text-sm transition"
              />
              <button
                type="submit"
                disabled={isProcessing || !playlistLink.trim()}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-white hover:bg-zinc-200 text-black font-semibold text-sm rounded-lg transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Fetch Playlist</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Supports public playlist URLs (up to 200 tracks) from Spotify, YouTube Music, and JioSaavn.
            </p>
          </form>
        )}

        {/* TAB 2: File Importer */}
        {activeTab === 'file' && (
          <div className="space-y-4">
            <label className="border border-dashed border-zinc-700 hover:border-zinc-500 bg-black/30 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition">
              <Upload className="w-8 h-8 text-zinc-400 mb-2" />
              <p className="text-sm font-medium text-white mb-1">Upload a playlist file</p>
              <p className="text-xs text-zinc-400 text-center">Select a .json or .csv file from your device</p>
              <input
                type="file"
                accept=".json,.csv"
                onChange={handleFileUpload}
                disabled={isProcessing}
                className="hidden"
              />
            </label>

            <p className="text-xs text-zinc-400 leading-relaxed">
              File entries should contain song titles and artist names (up to 200 tracks per file).
            </p>
          </div>
        )}

        {/* Status / Progress Indicator */}
        {isProcessing && importProgress.total > 0 && (
          <div className="p-4 bg-black/40 rounded-xl border border-zinc-800/80 space-y-2">
            <div className="flex justify-between text-xs text-zinc-300">
              <span>{importProgress.statusText}</span>
              <span>{Math.round((importProgress.current / importProgress.total) * 100)}%</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-white h-full transition-all duration-300"
                style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Alert */}
        {importError && (
          <div className="p-4 bg-red-950/20 border border-red-900/50 rounded-xl flex items-center gap-3 text-red-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{importError}</span>
          </div>
        )}

        {/* Preview & Save View */}
        {previewPlaylist && (
          <div className="p-5 bg-black/40 rounded-xl border border-zinc-800/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <img
                  src={(!previewPlaylist.thumbnail || previewPlaylist.thumbnail === '/logo.svg') ? '/default-cover.svg' : previewPlaylist.thumbnail}
                  alt={previewPlaylist.title}
                  className="w-12 h-12 rounded-lg object-cover shrink-0 bg-black border border-white/5"
                />
                <div>
                  <h4 className="text-base font-medium text-white">{previewPlaylist.title}</h4>
                  <p className="text-xs text-zinc-400">{previewPlaylist.tracks.length} tracks ready to import</p>
                </div>
              </div>

              {!saveSuccess ? (
                <button
                  type="button"
                  onClick={handleSaveImportedPlaylist}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-zinc-200 text-black font-semibold text-xs rounded-lg transition shadow-md cursor-pointer self-start sm:self-auto"
                >
                  <Check className="w-4 h-4" />
                  <span>Save to Your Library</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (savedPlaylistId) {
                      window.location.hash = `#/playlist/${savedPlaylistId}`;
                    } else {
                      if (setCurrentView) setCurrentView('library');
                      window.location.hash = '#/library';
                    }
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-zinc-200 text-black font-semibold text-xs rounded-lg transition shadow-md cursor-pointer self-start sm:self-auto"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Open Playlist Now</span>
                </button>
              )}
            </div>

            {saveSuccess && (
              <div className="flex items-center gap-2 text-zinc-200 text-xs font-medium">
                <CheckCircle className="w-4 h-4 shrink-0 text-green-400" />
                <span>Playlist imported and saved to Your Library!</span>
              </div>
            )}

            {previewPlaylist.unmatchedTracks && previewPlaylist.unmatchedTracks.length > 0 && (
              <div className="p-3 bg-zinc-900/70 border border-zinc-800 rounded-lg text-xs space-y-2">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>
                    Matched <strong className="text-white">{previewPlaylist.tracks.length}</strong> of <strong className="text-white">{previewPlaylist.totalExtracted || (previewPlaylist.tracks.length + previewPlaylist.unmatchedTracks.length)}</strong> tracks from link.
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowUnmatched(!showUnmatched)}
                    className="text-zinc-400 hover:text-white underline cursor-pointer"
                  >
                    {showUnmatched ? 'Hide' : `View ${previewPlaylist.unmatchedTracks.length} unavailable tracks`}
                  </button>
                </div>

                {showUnmatched && (
                  <div className="pt-2 border-t border-zinc-800/80 space-y-1 max-h-36 overflow-y-auto">
                    {previewPlaylist.unmatchedTracks.map((query, idx) => (
                      <div key={idx} className="text-zinc-500 flex items-center justify-between py-0.5">
                        <span className="truncate">{idx + 1}. {query}</span>
                        <span className="text-[10px] text-zinc-600 shrink-0 ml-2">Not found in catalog</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Track List Preview using LooP design */}
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {previewPlaylist.tracks.map((track, idx) => (
                <div key={track.videoId || idx} className="flex items-center gap-3 p-2 rounded-md bg-zinc-900/60 border border-zinc-800/60 text-xs">
                  <span className="text-zinc-500 w-5 text-center">{idx + 1}</span>
                  <img src={(!track.thumbnail || track.thumbnail === '/logo.svg') ? '/default-cover.svg' : track.thumbnail} alt={track.title} className="w-8 h-8 rounded object-cover shrink-0 bg-black border border-white/5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium truncate">{track.title}</p>
                    <p className="text-zinc-400 text-[11px] truncate">{track.artist}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* --- PREFERRED LANGUAGES CARD --- */}
      <div className="page-card space-y-4">
        <div>
          <h3 className="text-lg font-medium text-white mb-1">Music Language Preferences</h3>
          <p className="text-xs text-zinc-400">Select languages to personalize recommendations across Home and Search.</p>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {AVAILABLE_LANGUAGES.map((lang) => {
            const isSelected = selectedLangs.includes(lang.id.toLowerCase()) || selectedLangs.includes(lang.label.toLowerCase());
            return (
              <button
                key={lang.id}
                type="button"
                onClick={() => toggleLanguage(lang.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border cursor-pointer ${
                  isSelected
                    ? 'bg-white text-black border-white font-semibold shadow-[0_0_12px_rgba(255,255,255,0.15)]'
                    : 'bg-zinc-900/90 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 hover:bg-zinc-800/60'
                }`}
              >
                {isSelected ? `✓ ${lang.label}` : `+ ${lang.label}`}
              </button>
            );
          })}
        </div>
      </div>

      {/* --- AUDIO STREAM QUALITY CARD --- */}
      <div className="page-card space-y-4">
        <div>
          <h3 className="text-lg font-medium text-white mb-1">Audio Stream Quality</h3>
          <p className="text-xs text-zinc-400">Configure your default streaming playback quality.</p>
        </div>

        <div className="max-w-xs pt-1">
          <select
            value={audioQuality}
            onChange={handleQualityChange}
            className="w-full bg-zinc-900/90 border border-zinc-700/80 rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-zinc-500 cursor-pointer"
          >
            <option value="320">Extreme (320 kbps High Quality)</option>
            <option value="160">High (160 kbps Standard)</option>
            <option value="96">Normal (96 kbps Data Saver)</option>
          </select>
        </div>
      </div>

      {/* --- AUDIO CROSSFADE CARD --- */}
      <div className="page-card space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-medium text-white mb-1">Audio Crossfade</h3>
            <p className="text-xs text-zinc-400">
              Allows consecutive songs to blend into each other without gaps or silence.
            </p>
          </div>
          {/* On/Off Switch Button */}
          <button
            type="button"
            role="switch"
            aria-checked={isCrossfadeEnabled}
            aria-label="Toggle Audio Crossfade"
            onClick={handleToggleCrossfade}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-white/20 ${
              isCrossfadeEnabled ? 'bg-white' : 'bg-zinc-800'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full shadow-md ring-0 transition duration-200 ease-in-out ${
                isCrossfadeEnabled ? 'translate-x-5 bg-black' : 'translate-x-0 bg-zinc-400'
              }`}
            />
          </button>
        </div>

        {/* Slider & End Display - Only shown when On */}
        {isCrossfadeEnabled && (
          <div className="pt-2 border-t border-zinc-800/60 space-y-2">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 flex items-center">
                <input
                  type="range"
                  min="1"
                  max="12"
                  step="1"
                  value={crossfadeDuration || lastNonZeroDuration}
                  onChange={(e) => handleCrossfadeChange(Number(e.target.value))}
                  style={{
                    background: `linear-gradient(to right, #ffffff ${Math.round((((crossfadeDuration || lastNonZeroDuration) - 1) / 11) * 100)}%, #27272a ${Math.round((((crossfadeDuration || lastNonZeroDuration) - 1) / 11) * 100)}%)`
                  }}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-white"
                />
              </div>
              <span className="text-xs font-semibold font-mono text-white bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700/60 shrink-0 min-w-[44px] text-center select-none shadow-sm">
                {crossfadeDuration || lastNonZeroDuration}s
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-zinc-500 font-mono select-none px-0.5">
              <span>1s</span>
              <span>12s</span>
            </div>
          </div>
        )}
      </div>

      {/* --- DATA & STORAGE CARD --- */}
      <div className="page-card space-y-4">
        <div>
          <h3 className="text-lg font-medium text-white mb-1">Data & Storage</h3>
          <p className="text-xs text-zinc-400">Manage locally saved library data and preferences.</p>
        </div>

        <div className="flex flex-wrap gap-3 pt-1">
          <button
            type="button"
            onClick={handleClearSavedPlaylists}
            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-red-950/40 border border-zinc-800 hover:border-red-800 text-zinc-300 hover:text-red-400 text-xs font-medium rounded-lg transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Saved Playlists</span>
          </button>
          <button
            type="button"
            onClick={handleClearLikedSongs}
            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-red-950/40 border border-zinc-800 hover:border-red-800 text-zinc-300 hover:text-red-400 text-xs font-medium rounded-lg transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Liked Songs</span>
          </button>
        </div>
      </div>
    </div>
  );
}
