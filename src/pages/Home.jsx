import React, { useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { fetchRecommendedPlaylists, fetchPlaylistDetails } from '../services/api.js';
import Carousel from '../components/Carousel';
import { ArrowLeft, Play } from 'lucide-react';

export default function Home() {
  const [greeting, setGreeting] = useState('');
  const [playlists, setPlaylists] = useState([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [loadingPlaylistDetails, setLoadingPlaylistDetails] = useState(false);

  const { selectAndPlayTrack, playPlaylist, recentlyPlayed = [] } = usePlayer();

  useEffect(() => {
    const currentHour = new Date().getHours();
    if (currentHour < 12) setGreeting("Good morning");
    else if (currentHour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");

    let isMounted = true;
    fetchRecommendedPlaylists()
      .then((data) => {
        if (isMounted) {
          setPlaylists(Array.isArray(data) ? data : []);
          setLoadingPlaylists(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load recommended playlists:", err);
        if (isMounted) {
          setPlaylists([]);
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
            className={`w-44 h-44 sm:w-52 sm:h-52 rounded-xl shadow-2xl shrink-0 ${(!selectedPlaylist.thumbnail || selectedPlaylist.thumbnail === '/logo.svg') ? 'object-contain p-6 bg-zinc-800 border border-zinc-700' : 'object-cover'}`}
            onError={(e) => {
              e.target.src = '/logo.svg';
              e.target.className = 'w-44 h-44 sm:w-52 sm:h-52 rounded-xl shadow-2xl shrink-0 object-contain p-6 bg-zinc-800 border border-zinc-700';
            }}
          />
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left min-w-0">
            <span className="text-xs uppercase font-semibold text-zinc-400 tracking-wider mb-1">Playlist</span>
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
                className="inline-flex items-center gap-2 px-6 py-3 bg-white hover:bg-zinc-200 text-black font-semibold text-sm rounded-full transition shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
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
                  <Play className="w-4 h-4 text-white fill-current inline-block" />
                </span>
                <img
                  src={track.thumbnail || selectedPlaylist.thumbnail || '/logo.svg'}
                  alt={track.title}
                  className={`track-art ${(!track.thumbnail || track.thumbnail === '/logo.svg') ? 'object-contain p-2 bg-zinc-800' : 'object-cover'}`}
                  onError={(e) => {
                    e.target.src = '/logo.svg';
                    e.target.className = 'track-art object-contain p-2 bg-zinc-800';
                  }}
                  loading="lazy"
                />
                <div className="track-info">
                  <h3 className="group-hover:text-white transition-colors">{track.title}</h3>
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
        <div className="p-4 mb-6 bg-zinc-900/90 border border-zinc-800 text-white rounded-xl text-sm flex items-center justify-center gap-3 shadow-lg">
          <div className="mini-infinity-loader py-0 px-0">
            <svg className="mini-infinity-svg" viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
              <path className="infinity-path-bg" d="M 40,50 C 40,15 85,15 100,50 C 115,85 160,85 160,50 C 160,15 115,15 100,50 C 85,85 40,85 40,50 Z" />
              <path className="infinity-path-stroke" d="M 40,50 C 40,15 85,15 100,50 C 115,85 160,85 160,50 C 160,15 115,15 100,50 C 85,85 40,85 40,50 Z" />
            </svg>
          </div>
          <span className="font-medium">
            Loading playlist details<span className="infinity-dots"><span>.</span><span>.</span><span>.</span></span>
          </span>
        </div>
      )}

      {/* Recommended Playlists Section */}
      {loadingPlaylists ? (
        <div className="mb-8 min-h-[220px] flex flex-col justify-center items-center">
          <div className="infinity-loader-container py-8" role="status" aria-label="Curating playlists">
            <div className="infinity-loader-wrapper">
              <svg className="infinity-svg" viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
                <path className="infinity-path-bg" d="M 40,50 C 40,15 85,15 100,50 C 115,85 160,85 160,50 C 160,15 115,15 100,50 C 85,85 40,85 40,50 Z" />
                <path className="infinity-path-stroke" d="M 40,50 C 40,15 85,15 100,50 C 115,85 160,85 160,50 C 160,15 115,15 100,50 C 85,85 40,85 40,50 Z" />
              </svg>
            </div>
            <p className="infinity-loader-text">
              <span>Curating playlists for you</span>
              <span className="infinity-dots"><span>.</span><span>.</span><span>.</span></span>
            </p>
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
