import React, { useState, useEffect } from 'react';
import { fetchApi, usePlayer } from '../context/PlayerContext';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const { selectAndPlayTrack } = usePlayer();

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const match = hash.match(/#search\?q=(.+)/);
      if (match) {
        const q = decodeURIComponent(match[1]);
        setQuery(q);
        performSearch(q);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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

  const handleTrackClick = (track) => {
    selectAndPlayTrack(
      track.videoId,
      track.title || "Unknown track",
      track.artists || "Unknown artist",
      `https://img.youtube.com/vi/${track.videoId}/hqdefault.jpg`
    );
  };

  return (
    <>
      <div className="page-header search-page-header">
        <h2>{query ? `Search Results for "${query}"` : "Search"}</h2>
        <p>Find your favorite songs, artists, and albums.</p>
      </div>
      
      {loading ? (
        <div className="track-list" data-track-list>
          <div className="infinity-loader-container" role="status" aria-label="Searching for music">
            <div className="infinity-loader-wrapper">
              <svg className="infinity-svg" viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
                <path className="infinity-path-bg" d="M 40,50 C 40,15 85,15 100,50 C 115,85 160,85 160,50 C 160,15 115,15 100,50 C 85,85 40,85 40,50 Z" />
                <path className="infinity-path-stroke" d="M 40,50 C 40,15 85,15 100,50 C 115,85 160,85 160,50 C 160,15 115,15 100,50 C 85,85 40,85 40,50 Z" />
              </svg>
            </div>
            <p className="infinity-loader-text">
              <span>Searching for "{query}"</span>
              <span className="infinity-dots"><span>.</span><span>.</span><span>.</span></span>
            </p>
          </div>
        </div>
      ) : (
        <div className="track-list" data-track-list>
          {!query ? (
            <p className="muted-text">Search for a song to begin.</p>
          ) : results.length === 0 ? (
            <p className="muted-text">No tracks found.</p>
          ) : (
            results.map((track, idx) => {
              const title = track.name || "Unknown track";
              const artist = track.artist?.name || "Unknown artist";
              const thumbnail = track.thumbnails?.find((item) => item?.url)?.url || `https://img.youtube.com/vi/${track.videoId}/hqdefault.jpg`;
              
              return (
                <article key={idx} className="track-card">
                  <img 
                    src={thumbnail} 
                    alt="" 
                    className="track-art" 
                    onError={(e) => { e.target.src = "/logo.svg"; }}
                  />
                  <div className="track-info">
                    <h3>{title}</h3>
                    <p>{artist}</p>
                  </div>
                  <button 
                    type="button" 
                    className="track-play" 
                    aria-label={`Play ${title}`}
                    onClick={() => selectAndPlayTrack(track.videoId, title, artist, thumbnail)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <polygon points="6 3 20 12 6 21 6 3"></polygon>
                    </svg>
                  </button>
                </article>
              );
            })
          )}
        </div>
      )}
    </>
  );
}
