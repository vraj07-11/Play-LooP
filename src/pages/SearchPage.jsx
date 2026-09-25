import React, { useState, useEffect } from 'react';
import { fetchApi, usePlayer } from '../context/PlayerContext';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const { selectAndPlayTrack } = usePlayer();

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const match = hash.match(/#\/?search\?q=(.+)/);
      if (match) {
        const q = decodeURIComponent(match[1]);
        setQuery(q);
        performSearch(q);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [results]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const active = document.activeElement;
      if (
        active && (
          active.tagName === 'INPUT' || 
          active.tagName === 'TEXTAREA' || 
          active.isContentEditable ||
          active.getAttribute('role') === 'textbox' ||
          active.getAttribute('role') === 'searchbox'
        )
      ) {
        return;
      }

      if (!results || results.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % results.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev <= 0 ? results.length - 1 : prev - 1));
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          e.preventDefault();
          const track = results[selectedIndex];
          if (track) {
            const title = track.title || track.name || "Unknown track";
            const artist = typeof track.artist === 'string' ? track.artist : (track.artist?.name || track.artists || "Unknown artist");
            const thumbnail = track.thumbnail || track.thumbnails?.find((item) => item?.url)?.url || '/logo.svg';
            selectAndPlayTrack(track.videoId, title, artist, thumbnail);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [results, selectedIndex, selectAndPlayTrack]);

  const performSearch = async (searchTerm) => {
    setLoading(true);
    try {
      const response = await fetchApi(`/api/search?q=${encodeURIComponent(searchTerm)}`);
      if (response.ok) {
        const data = await response.json();
        setResults(data);
      } else {
        setResults([]);
      }
    } catch (e) {
      console.error(e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="page-header search-page-header">
        <h2>{query ? `Search Results for "${query}"` : "Search"}</h2>
        <p>Find your favorite songs, artists, and albums.</p>
      </div>
      
      {loading ? (
        <div className="track-list" data-track-list>
          {[...Array(6)].map((_, idx) => (
            <div key={idx} className="track-card bg-[#121212] border border-zinc-800/60 rounded-lg p-3 flex items-center gap-4 animate-pulse skeleton-shimmer-card">
              <div className="w-12 h-12 rounded bg-zinc-800/90 shrink-0" />
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <div className="w-1/2 h-4 bg-zinc-800/90 rounded" />
                <div className="w-1/3 h-3 bg-zinc-800/50 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="track-list" data-track-list>
          {!query ? (
            <p className="muted-text">Search for a song to begin.</p>
          ) : results.length === 0 ? (
            <p className="muted-text">No tracks found.</p>
          ) : (
            results.map((track, idx) => {
              const title = track.title || track.name || "Unknown track";
              const artist = typeof track.artist === 'string' ? track.artist : (track.artist?.name || track.artists || "Unknown artist");
              const thumbnail = track.thumbnail || track.thumbnails?.find((item) => item?.url)?.url || '/logo.svg';
              const isSelected = idx === selectedIndex;
              
              return (
                <article 
                  key={idx} 
                  className={`track-card cursor-pointer select-none group ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => selectAndPlayTrack(track.videoId, title, artist, thumbnail)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectAndPlayTrack(track.videoId, title, artist, thumbnail);
                    }
                  }}
                >
                  <img 
                    src={thumbnail} 
                    alt="" 
                    className="track-art" 
                    onError={(e) => {
                      e.target.src = "/logo.svg";
                      e.target.className = "track-art object-contain p-1.5 bg-black border border-zinc-900";
                    }}
                  />
                  <div className="track-info">
                    <h3>{title}</h3>
                    <p>{artist}</p>
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}
    </>
  );
}
