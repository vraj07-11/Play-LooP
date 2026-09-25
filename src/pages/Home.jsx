import React, { useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { fetchRecommendedPlaylists, fetchPlaylistDetails, fetchMoreDynamicPlaylists, DEFAULT_PLAYLISTS } from '../services/api.js';
import Carousel from '../components/Carousel';
import { ArrowLeft, Play, Music, Heart, Sparkles, Library, ChevronRight } from 'lucide-react';

export default function Home() {
  const [greeting, setGreeting] = useState('');
  const [playlists, setPlaylists] = useState([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [loadingPlaylistDetails, setLoadingPlaylistDetails] = useState(false);
  
  const [extraMadeForYou, setExtraMadeForYou] = useState([]);
  const [extraPopularAlbums, setExtraPopularAlbums] = useState([]);
  const [loadingMoreMadeForYou, setLoadingMoreMadeForYou] = useState(false);
  const [loadingMorePopularAlbums, setLoadingMorePopularAlbums] = useState(false);

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

  const loadMoreMadeForYou = async () => {
    if (loadingMoreMadeForYou) return;
    setLoadingMoreMadeForYou(true);
    try {
      const more = await fetchMoreDynamicPlaylists(4);
      setExtraMadeForYou(prev => [...prev, ...more]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMoreMadeForYou(false);
    }
  };

  const loadMorePopularAlbums = async () => {
    if (loadingMorePopularAlbums) return;
    setLoadingMorePopularAlbums(true);
    try {
      const more = await fetchMoreDynamicPlaylists(5);
      setExtraPopularAlbums(prev => [...prev, ...more]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMorePopularAlbums(false);
    }
  };

  useEffect(() => {
    const handlePopState = (e) => {
      const state = e.state;
      if (!state || !state.playlistId) {
        setSelectedPlaylist(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handlePlaylistClick = async (playlist) => {
    if (!playlist || !playlist.playlistId) return;
    setLoadingPlaylistDetails(true);
    const details = await fetchPlaylistDetails(playlist.playlistId);
    if (details) {
      window.history.pushState({ view: 'home', playlistId: playlist.playlistId }, '', `#/playlist/${playlist.playlistId}`);
      setSelectedPlaylist(details);
    }
    setLoadingPlaylistDetails(false);
  };

  const handleBackToHome = () => {
    setSelectedPlaylist(null);
    if (window.history.state && window.history.state.playlistId) {
      window.history.back();
    }
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

  // If loading playlist details, render Playlist Skeleton View
  if (loadingPlaylistDetails) {
    return (
      <div className="max-w-[1400px] mx-auto pb-24 px-4 sm:px-6 lg:px-8 mt-4 select-none">
        <div className="w-28 h-9 bg-zinc-900 rounded-full mb-8 animate-pulse" />

        <div className="flex flex-col md:flex-row items-start md:items-end gap-6 sm:gap-8 mb-12">
          <div className="w-44 h-44 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-xl bg-zinc-900 border border-zinc-800/80 shrink-0 skeleton-shimmer-card animate-pulse" />
          <div className="flex flex-col min-w-0 w-full gap-3">
            <div className="w-16 h-3.5 bg-zinc-800/60 rounded-md animate-pulse" />
            <div className="w-3/4 max-w-lg h-9 sm:h-12 bg-zinc-800 rounded-lg animate-pulse" />
            <div className="w-full max-w-md h-4 bg-zinc-800/50 rounded-md animate-pulse" />
            <div className="flex items-center gap-4 mt-2">
              <div className="w-28 sm:w-32 h-11 sm:h-12 rounded-full bg-zinc-800 animate-pulse" />
              <div className="w-16 h-4 bg-zinc-800/50 rounded-md animate-pulse" />
            </div>
          </div>
        </div>

        <div className="track-list">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="track-card bg-[#121212] border border-zinc-800/60 rounded-lg p-3 flex items-center gap-4 animate-pulse skeleton-shimmer-card">
              <div className="w-6 h-4 bg-zinc-800/60 rounded" />
              <div className="w-12 h-12 rounded bg-zinc-800/90 shrink-0" />
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <div className="w-1/2 h-4 bg-zinc-800/90 rounded" />
                <div className="w-1/3 h-3 bg-zinc-800/50 rounded" />
              </div>
              <div className="w-12 h-4 bg-zinc-800/40 rounded hidden sm:block" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // If a playlist is selected, render the Playlist Details View
  if (selectedPlaylist) {
    return (
      <div className="max-w-[1400px] mx-auto pb-24 px-4 sm:px-6 lg:px-8 mt-4 select-none">
        <button
          type="button"
          onClick={handleBackToHome}
          className="inline-flex items-center gap-2 mb-8 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-full text-sm font-medium transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </button>

        <div className="flex flex-col md:flex-row items-start md:items-end gap-8 mb-12">
          <img
            src={selectedPlaylist.thumbnail || '/logo.svg'}
            alt={selectedPlaylist.title}
            className={`w-56 h-56 md:w-64 md:h-64 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] shrink-0 ${(!selectedPlaylist.thumbnail || selectedPlaylist.thumbnail === '/logo.svg') ? 'object-contain p-8 bg-zinc-900 border border-zinc-800' : 'object-cover'}`}
            onError={(e) => {
              e.target.src = '/logo.svg';
              e.target.className = 'w-56 h-56 md:w-64 md:h-64 rounded-xl shadow-2xl shrink-0 object-contain p-8 bg-zinc-900 border border-zinc-800';
            }}
          />
          <div className="flex flex-col min-w-0">
            <span className="text-xs uppercase font-bold text-zinc-400 tracking-widest mb-2 block">Playlist</span>
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-4 tracking-tight leading-tight">
              {selectedPlaylist.title}
            </h2>
            <p className="text-base text-zinc-400 mb-6 max-w-2xl leading-relaxed">
              {selectedPlaylist.description}
            </p>
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={handlePlayPlaylistAll}
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-white hover:bg-zinc-200 text-black font-bold text-sm rounded-full transition shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current translate-x-[1px]" /> Play All
              </button>
              <span className="text-sm font-medium text-zinc-500">
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
                <span className="w-8 text-center text-sm font-medium text-zinc-500 group-hover:hidden">
                  {idx + 1}
                </span>
                <span className="w-8 text-center hidden group-hover:inline-flex justify-center items-center">
                  <Play className="w-4 h-4 text-white fill-current" />
                </span>
                <img
                  src={track.thumbnail || selectedPlaylist.thumbnail || '/logo.svg'}
                  alt={track.title}
                  className={`track-art ${(!track.thumbnail || track.thumbnail === '/logo.svg') ? 'object-contain p-1.5 bg-zinc-900' : 'object-cover'}`}
                  onError={(e) => {
                    e.target.src = '/logo.svg';
                    e.target.className = 'track-art object-contain p-1.5 bg-zinc-900';
                  }}
                  loading="lazy"
                />
                <div className="track-info">
                  <h3 className="group-hover:text-white transition-colors text-zinc-100">{track.title}</h3>
                  <p>{track.artist}</p>
                </div>
                {track.duration > 0 && (
                  <span className="text-sm text-zinc-500 font-medium hidden sm:block pr-4">
                    {formatDuration(track.duration)}
                  </span>
                )}
              </article>
            ))
          ) : (
            <p className="text-zinc-500 text-center py-12">No tracks found in this playlist.</p>
          )}
        </div>
      </div>
    );
  }

  const featuredPlaylist = playlists.length > 0 ? playlists[0] : (DEFAULT_PLAYLISTS[0] || null);
  const madeForYouPlaylists = [...(playlists.length > 1 ? playlists.slice(1, 6) : DEFAULT_PLAYLISTS.slice(1, 6)), ...extraMadeForYou];
  
  const initialPopular = playlists.length >= 16 
    ? playlists.slice(6, 16) 
    : [...playlists.slice(6), ...DEFAULT_PLAYLISTS].filter((item, idx, self) => self.findIndex(t => t.playlistId === item.playlistId) === idx).slice(0, 10);
  const popularAlbumsPlaylists = [...initialPopular, ...extraPopularAlbums];

  const quickAccessItems = [
    { title: 'Browse', subtitle: 'Discover new music', icon: <Music className="w-5 h-5 text-white" />, color: 'bg-[#8938d2]' },
    { title: 'Liked Songs', subtitle: 'Your favorites', icon: <Heart className="w-5 h-5 text-white fill-current" />, color: 'bg-[#d2384a]' },
    { title: 'New Releases', subtitle: 'Fresh drops, weekly', icon: <Sparkles className="w-5 h-5 text-white" />, color: 'bg-[#1e864c]' },
    { title: 'Your Library', subtitle: 'All your music', icon: <Library className="w-5 h-5 text-white" />, color: 'bg-[#d28238]' }
  ];

  return (
    <div className="max-w-[1400px] mx-auto pb-24 px-4 sm:px-6 lg:px-8 mt-6">

      {/* Greeting Section */}
      {!loadingPlaylists && (
        <div className="mb-8 pl-1">
          <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">{greeting}</h2>
          <p className="text-zinc-400 font-medium">Discover your next favorite track.</p>
        </div>
      )}

      {/* Featured Section */}
      {loadingPlaylists ? (
        <div className="flex flex-col xl:grid xl:grid-cols-3 gap-6 mb-12">
          <div className="xl:col-span-2 h-[380px] bg-[#121212] rounded-xl animate-pulse"></div>
          <div className="grid grid-cols-2 xl:grid-cols-1 xl:grid-rows-4 gap-3 xl:gap-4 h-auto xl:h-[380px]">
             {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-[#121212] rounded-lg animate-pulse min-h-[60px]"></div>
             ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col xl:grid xl:grid-cols-3 gap-6 mb-12">
          {/* Hero Featured Playlist */}
          {featuredPlaylist && (
            <div 
              className="xl:col-span-2 relative h-[300px] sm:h-[380px] rounded-xl overflow-hidden group cursor-pointer bg-[#121212] shadow-xl"
              onClick={() => handlePlaylistClick(featuredPlaylist)}
            >
              <img 
                src={featuredPlaylist.thumbnail} 
                alt={featuredPlaylist.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/50 to-transparent"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent"></div>
              
              <div className="absolute bottom-0 left-0 p-6 sm:p-8 md:p-10 w-full md:w-3/4 flex flex-col justify-end h-full">
                <span className="text-[10px] sm:text-xs font-bold tracking-[0.2em] text-white/70 uppercase mb-3 block drop-shadow-md">
                  Featured Playlist
                </span>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-3 tracking-tight drop-shadow-lg">
                  {featuredPlaylist.title}
                </h1>
                <p className="text-zinc-300 text-xs sm:text-sm md:text-base mb-6 sm:mb-8 line-clamp-2 max-w-lg font-medium drop-shadow-md">
                  {featuredPlaylist.description || `A curated collection of ${featuredPlaylist.count || 'great'} songs by ${featuredPlaylist.author}.`}
                </p>
                
                <div className="flex items-center gap-3 sm:gap-4">
                  <button 
                    className="bg-white text-black px-6 sm:px-8 py-2.5 sm:py-3.5 rounded-full font-bold text-sm flex items-center gap-2 hover:scale-105 active:scale-95 transition shadow-xl"
                    onClick={(e) => { e.stopPropagation(); handlePlaylistClick(featuredPlaylist); }}
                  >
                    <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current translate-x-[1px]" /> Play
                  </button>
                  <button 
                    className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/10 px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-full font-bold text-sm flex items-center gap-2 transition"
                    onClick={(e) => { e.stopPropagation(); handlePlaylistClick(featuredPlaylist); }}
                  >
                    <span className="text-lg leading-none mb-0.5">+</span> Save
                  </button>
                  <span className="hidden md:inline-block ml-4 text-zinc-300 text-sm font-medium">
                    {featuredPlaylist.count} songs
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Quick Access Grid */}
          <div className="grid grid-cols-2 xl:flex xl:flex-col gap-3 xl:gap-4 xl:justify-between h-auto xl:h-[380px]">
            {quickAccessItems.map((item, index) => (
              <div 
                key={index}
                className="flex-1 bg-[#121212] hover:bg-[#1a1a1a] rounded-lg p-3 xl:p-4 flex items-center gap-3 xl:gap-4 cursor-pointer transition border border-white/5 hover:border-white/10 shadow-sm group"
              >
                <div className={`w-10 h-10 xl:w-14 xl:h-14 rounded-md flex items-center justify-center shrink-0 shadow-sm ${item.color}`}>
                  {item.icon}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <h3 className="text-white font-bold text-xs xl:text-sm truncate">{item.title}</h3>
                  <p className="text-zinc-400 text-[10px] xl:text-xs truncate mt-0.5">{item.subtitle}</p>
                </div>
                <div className="hidden xl:flex w-8 h-8 rounded-full items-center justify-center text-zinc-500 group-hover:text-white transition-colors mr-1">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recently Played Row */}
      {recentlyPlayed && recentlyPlayed.length > 0 && (
        <div className="mb-10 sm:mb-12">
          <Carousel
            title="Recently Played"
            items={recentlyPlayed}
            onItemClick={(track) => selectAndPlayTrack(track.videoId, track.title, track.artist, track.thumbnail)}
            renderSubtitle={(track) => track.artist}
            keyExtractor={(track, index) => `${track.videoId}-${index}`}
            cardType="square"
          />
        </div>
      )}

      {/* Made For You Row (Wide Cards) */}
      {!loadingPlaylists && madeForYouPlaylists.length > 0 && (
        <div className="mb-10 sm:mb-12">
          <Carousel
            title="Made For You"
            items={madeForYouPlaylists}
            onItemClick={handlePlaylistClick}
            renderSubtitle={(item) => item.author}
            keyExtractor={(item, index) => `${item.playlistId}-${index}`}
            cardType="wide"
            onEndReached={loadMoreMadeForYou}
            isLoadingMore={loadingMoreMadeForYou}
          />
        </div>
      )}
      
      {/* Popular Albums Row */}
      {!loadingPlaylists && popularAlbumsPlaylists.length > 0 && (
        <div className="mb-10 sm:mb-12">
          <Carousel
            title="Popular Albums"
            items={popularAlbumsPlaylists}
            onItemClick={handlePlaylistClick}
            renderSubtitle={(item) => item.author}
            keyExtractor={(item, index) => `${item.playlistId}-${index}`}
            cardType="square"
            onEndReached={loadMorePopularAlbums}
            isLoadingMore={loadingMorePopularAlbums}
          />
        </div>
      )}
    </div>
  );
}
