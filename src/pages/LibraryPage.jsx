import React, { useState, useEffect } from 'react';
import { Library, Play, Heart } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

export default function LibraryPage({ setCurrentView }) {
  const [savedPlaylists, setSavedPlaylists] = useState([]);
  const [likedCount, setLikedCount] = useState(0);

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
    return () => window.removeEventListener('playloop-saved-playlists-updated', fetchSaved);
  }, []);

  const handlePlaylistClick = (playlist) => {
    window.location.hash = `#/playlist/${playlist.playlistId}`;
  };

  const handleLikedClick = () => {
    window.location.hash = '#/playlist/liked_songs';
  };

  const handleKeyDown = (e, action, param) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (action === 'liked') {
        handleLikedClick();
      } else if (action === 'playlist') {
        handlePlaylistClick(param);
      }
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-24 px-4 sm:px-6 lg:px-8 mt-6 select-none">
      <div className="mb-8 pl-1 flex items-center gap-3">
        <Library className="w-8 h-8 text-white" />
        <h2 className="text-3xl font-extrabold text-white tracking-tight">Your Library</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
        {/* Liked Songs Card */}
        <div 
          onClick={handleLikedClick}
          onKeyDown={(e) => handleKeyDown(e, 'liked')}
          tabIndex={0}
          role="button"
          aria-label="Liked Songs"
          className="group flex flex-col p-3.5 rounded bg-[#181818] hover:bg-[#282828] focus:bg-[#282828] focus:outline-none focus:ring-2 focus:ring-white cursor-pointer transition-colors duration-300"
        >
          <div className="relative w-full aspect-square rounded-[2px] shadow-[0_8px_24px_rgba(0,0,0,0.5)] overflow-hidden mb-4 bg-gradient-to-br from-[#450af5] to-[#c4efd9] flex items-center justify-center">
            <Heart className="w-16 h-16 text-white fill-current drop-shadow-md" />
            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 z-20">
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-xl hover:scale-105 hover:bg-gray-50 text-black">
                <Play className="w-5 h-5 fill-current translate-x-[2px]" />
              </div>
            </div>
          </div>
          <h4 className="font-bold text-white text-[15px] truncate mb-1.5 tracking-tight">
            Liked Songs
          </h4>
          <p className="font-medium text-zinc-400 text-[13px] line-clamp-2 leading-snug">
            {likedCount} {likedCount === 1 ? 'song' : 'songs'}
          </p>
        </div>

        {/* Saved Playlists */}
        {savedPlaylists.map((item, index) => (
          <div
            key={`${item.playlistId}-${index}`}
            onClick={() => handlePlaylistClick(item)}
            onKeyDown={(e) => handleKeyDown(e, 'playlist', item)}
            tabIndex={0}
            role="button"
            aria-label={`Playlist: ${item.title}`}
            className="group flex flex-col p-3.5 rounded bg-[#181818] hover:bg-[#282828] focus:bg-[#282828] focus:outline-none focus:ring-2 focus:ring-white cursor-pointer transition-colors duration-300"
          >
            <div className={`relative w-full aspect-square shadow-[0_8px_24px_rgba(0,0,0,0.5)] overflow-hidden mb-4 bg-zinc-800 ${item.isArtist ? 'rounded-full' : 'rounded-[2px]'}`}>
              <img
                src={item.thumbnail || '/logo.svg'}
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={(e) => {
                  e.target.src = '/logo.svg';
                  e.target.className = `w-full h-full object-contain p-6 bg-black ${item.isArtist ? 'rounded-full' : 'rounded-[2px]'}`;
                }}
                loading="lazy"
              />
              
              <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 z-20">
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-xl hover:scale-105 hover:bg-gray-50 text-black">
                  <Play className="w-5 h-5 fill-current translate-x-[2px]" />
                </div>
              </div>
            </div>

            <h4 className="font-bold text-white text-[15px] truncate mb-1.5 tracking-tight">
              {item.title}
            </h4>
            <p className="font-medium text-zinc-400 text-[13px] line-clamp-2 leading-snug">
              {item.author || item.artist || 'Collection'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
