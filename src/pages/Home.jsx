import React, { useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { fetchRecommendedPlaylists, fetchPlaylistDetails } from '../services/api';
import Carousel from '../components/Carousel';
import { ArrowLeft, Play } from 'lucide-react';

export default function Home() {
  const [greeting, setGreeting] = useState('');
  const [playlists, setPlaylists] = useState([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [loadingPlaylistDetails, setLoadingPlaylistDetails] = useState(false);

  const { selectAndPlayTrack, playPlaylist, recentlyPlayed } = usePlayer();

  useEffect(() => {
    const currentHour = new Date().getHours();
    if (currentHour < 12) setGreeting("Good morning");
    else if (currentHour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");

    let isMounted = true;
    fetchRecommendedPlaylists().then((data) => {
      if (isMounted) {
        setPlaylists(data);
        setLoadingPlaylists(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handlePlaylistClick = async (playlist) => {
    if (!playlist || !playlist.playlistId) return;
    setLoadingPlaylistDetails(true);
    const details = await fetchPlaylistDetails(playlist.playlistId);
    if (details) {
      setSelectedPlaylist(details);
    }
    setLoadingPlaylistDetails(false);
  };

  const handlePlayPlaylistAll = () => {
    if (selectedPlaylist && selectedPlaylist.tracks && selectedPlaylist.tracks.length > 0) {
      playPlaylist(selectedPlaylist.tracks, 0);
    }
  };

  const handlePlayTrackInPlaylist = (index) => {
    if (selectedPlaylist && selectedPlaylist.tracks) {
      playPlaylist(selectedPlaylist.tracks, index);
    }
  };

  const formatDuration = (secs) => {
    if (!secs || isNaN(secs)) return '--:--';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // If a playlist is selected, render the Playlist Details View
  if (selectedPlaylist) {
    return (
      <div className="max-w-5xl mx-auto pb-12">
        <button
          type="button"
          onClick={() => setSelectedPlaylist(null)}
          className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-zinc-800/80 hover:bg-zinc-700/80 text-white rounded-full text-sm transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </button>

        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 mb-8 p-6 bg-gradient-to-b from-zinc-800/60 to-zinc-900/60 rounded-2xl border border-zinc-800">
          <img
            src={selectedPlaylist.thumbnail || '/logo.svg'}
            alt={selectedPlaylist.title}
            className="w-44 h-44 sm:w-52 sm:h-52 rounded-xl object-cover shadow-2xl shrink-0"
          />
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left min-w-0">
            <span className="text-xs uppercase font-semibold text-emerald-400 tracking-wider mb-1">Playlist</span>
            <h2 className="text-2xl sm:text-4xl font-normal text-white mb-2 leading-tight">
              {selectedPlaylist.title}
            </h2>
            <p className="text-sm text-zinc-400 mb-4 max-w-xl">
              {selectedPlaylist.description}
            </p>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handlePlayPlaylistAll}
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-full transition shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current translate-x-[1px]" /> Play All
              </button>
              <span className="text-xs text-zinc-400">
                {selectedPlaylist.tracks ? selectedPlaylist.tracks.length : 0} songs
              </span>
            </div>
          </div>
        </div>

        <div className="track-list">
          {selectedPlaylist.tracks && selectedPlaylist.tracks.length > 0 ? (
            selectedPlaylist.tracks.map((track, idx) => (
              <article
                key={track.videoId || idx}
                className="track-card cursor-pointer group"
                onClick={() => handlePlayTrackInPlaylist(idx)}
              >
                <span className="w-6 text-center text-xs font-mono text-zinc-500 group-hover:hidden">
                  {idx + 1}
                </span>
                <span className="w-6 text-center hidden group-hover:inline-block">
                  <Play className="w-4 h-4 text-emerald-400 fill-current inline-block" />
                </span>
                <img
                  src={track.thumbnail || selectedPlaylist.thumbnail || '/logo.svg'}
                  alt={track.title}
                  className="track-art"
                  loading="lazy"
                />
                <div className="track-info">
                  <h3 className="group-hover:text-emerald-400 transition-colors">{track.title}</h3>
                  <p>{track.artist}</p>
                </div>
                {track.duration > 0 && (
                  <span className="text-xs text-zinc-400 font-mono hidden sm:block">
                    {formatDuration(track.duration)}
                  </span>
                )}
              </article>
            ))
          ) : (
            <p className="text-zinc-500 text-center py-8">No tracks found in this playlist.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="page-header">
        <h2>{greeting}</h2>
        <p>Pick something to start listening.</p>
      </div>

      {loadingPlaylistDetails && (
        <div className="p-4 mb-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          Loading playlist details...
        </div>
      )}

      {/* Recommended Playlists Section */}
      {loadingPlaylists ? (
        <div className="mb-8">
          <h3 className="text-xl font-medium text-white mb-4">Recommended Playlists</h3>
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="flex-none w-40 h-52 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      ) : (
        playlists.length > 0 && (
          <Carousel
            title="Recommended Playlists"
            items={playlists}
            onItemClick={handlePlaylistClick}
            renderSubtitle={(item) => `${item.count} songs • ${item.author}`}
            keyExtractor={(item) => item.playlistId}
          />
        )
      )}

      {/* Recently Played Section (Max 20 tracks) */}
      {recentlyPlayed && recentlyPlayed.length > 0 && (
        <Carousel
          title="Recently Played"
          items={recentlyPlayed}
          onItemClick={(track) => selectAndPlayTrack(track.videoId, track.title, track.artist, track.thumbnail)}
          renderSubtitle={(track) => track.artist}
          keyExtractor={(track, index) => `${track.videoId}-${index}`}
        />
      )}
    </div>
  );
}
