import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { usePlayer, fetchApi } from '../context/PlayerContext';
import { Menu, X, Search, User } from 'lucide-react';

export default function Header({ isSidebarOpen, setIsSidebarOpen, setCurrentView }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchTimeout = useRef(null);
  const searchFormRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    const handlePointerDown = (e) => {
      if (searchFormRef.current && !searchFormRef.current.contains(e.target)) {
        setShowSuggestions(false);
        if (window.innerWidth <= 640) {
          setIsSearchOpen(false);
        }
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (isSearchOpen) {
      document.body.classList.add("mobile-search-open");
    } else {
      document.body.classList.remove("mobile-search-open");
    }
  }, [isSearchOpen]);

  const fetchSuggestions = async (searchTerm) => {
    if (searchTerm.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      setHasSearched(false);
      setShowSuggestions(false);
      return;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsSearching(true);
    setHasSearched(false);
    setShowSuggestions(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchTerm)}`, {
        signal: abortControllerRef.current.signal
      });
      if (res.ok) {
        const data = await res.json();
        const mapped = data
          .map((song) => ({
            title: song.name || "Unknown track",
            artist: song.artist?.name || "Unknown artist"
          }))
          .filter((song, index, allSongs) => allSongs.findIndex((item) => item.title === song.title && item.artist === song.artist) === index)
          .slice(0, 6);
        setSuggestions(mapped);
        setHasSearched(true);
        setShowSuggestions(true);
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        console.error(e);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const onSearchInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    const trimmed = val.trim();
    if (trimmed.length >= 2) {
      setShowSuggestions(true);
      setIsSearching(true);
      setHasSearched(false);
    } else {
      setShowSuggestions(false);
      setIsSearching(false);
      setHasSearched(false);
      setSuggestions([]);
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      fetchSuggestions(trimmed);
    }, 60);
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    if (query.trim()) {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
      
      setShowSuggestions(false);
      setIsSearching(false);
      setHasSearched(false);
      window.location.hash = `#search?q=${encodeURIComponent(query.trim())}`;
      setCurrentView('search');
      
      const input = searchFormRef.current?.querySelector('input');
      if (input) input.blur();
      
      if (window.innerWidth <= 640) setIsSearchOpen(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    
    setShowSuggestions(false);
    setIsSearching(false);
    setHasSearched(false);
    window.location.hash = `#search?q=${encodeURIComponent(suggestion)}`;
    setCurrentView('search');
    
    const input = searchFormRef.current?.querySelector('input');
    if (input) input.blur();
    
    if (window.innerWidth <= 640) setIsSearchOpen(false);
  };

  return (
    <header className="relative z-30 w-full shrink-0 border-b border-zinc-800 bg-black">
      <nav className="relative flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="sidebar-controls" aria-live="polite">
            <button 
              type="button" 
              className={`sidebar-control toggle-sidebar ${isSidebarOpen ? 'is-hidden' : ''}`}
              aria-label="Open menu" 
              aria-expanded={isSidebarOpen}
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-7 h-7" />
            </button>
            <button 
              type="button" 
              className={`sidebar-control close-sidebar ${!isSidebarOpen ? 'is-hidden' : ''}`}
              aria-label="Close menu" 
              aria-expanded={isSidebarOpen}
              tabIndex={isSidebarOpen ? 0 : -1}
              onClick={() => setIsSidebarOpen(false)}
            >
              <X className="w-7 h-7" />
            </button>
          </div>
          <h1 className="header-title text-2xl font-bold">
            <a 
              className="brand-link" 
              href="#home" 
              onClick={(e) => { e.preventDefault(); window.location.hash = ''; setCurrentView('home'); }}
            >
              <img className="brand-logo" src="/logo.svg" alt="Play LooP logo" />
              LooP
            </a>
          </h1>
        </div>
        
        <div className="header-actions flex items-center gap-3">
          <form 
            ref={searchFormRef}
            className={`search-form ${isSearchOpen ? 'is-open' : ''}`}
            role="search"
            onSubmit={handleSearchSubmit}
          >
            <input 
              className="search-input" 
              type="search" 
              name="search" 
              autoComplete="off" 
              autoCorrect="off"
              autoCapitalize="none" 
              spellCheck="false" 
              inputMode="search"
              placeholder="What do you want to play?" 
              aria-label="Search music"
              value={query}
              onChange={onSearchInput}
              onFocus={() => {
                if (query.trim().length >= 2) setShowSuggestions(true);
              }}
            />
            
            {showSuggestions && (
              <div className="search-suggestions" role="listbox" style={{ display: 'block' }}>
                {isSearching || !hasSearched ? (
                  <div className="mini-infinity-loader">
                    <svg className="mini-infinity-svg" viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
                      <path className="infinity-path-bg" d="M 40,50 C 40,15 85,15 100,50 C 115,85 160,85 160,50 C 160,15 115,15 100,50 C 85,85 40,85 40,50 Z" />
                      <path className="infinity-path-stroke" d="M 40,50 C 40,15 85,15 100,50 C 115,85 160,85 160,50 C 160,15 115,15 100,50 C 85,85 40,85 40,50 Z" />
                    </svg>
                    <span>
                      Searching for suggestions<span className="infinity-dots"><span>.</span><span>.</span><span>.</span></span>
                    </span>
                  </div>
                ) : suggestions.length > 0 ? (
                  suggestions.map((s, i) => (
                    <button 
                      key={i} 
                      type="button" 
                      className="search-suggestion"
                      onClick={() => handleSuggestionClick(s.title)}
                    >
                      <Search className="w-4 h-4 shrink-0 text-zinc-400" />
                      <span>
                        <strong>{s.title}</strong>
                        <small>{s.artist}</small>
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-xs text-zinc-400 text-center">No suggestions found</div>
                )}
              </div>
            )}
            <button 
              type="button" 
              className={`clear-search ${!query ? 'is-hidden' : ''}`} 
              onClick={() => {
                setQuery('');
                setShowSuggestions(false);
                setIsSearching(false);
                setSuggestions([]);
              }} 
              aria-label="Clear search"
            >
              <X className="w-6 h-6" />
            </button>
            <button 
              type="button"
              className="search-button" 
              aria-label="Search"
              onClick={(e) => {
                if (window.innerWidth <= 640 && !isSearchOpen) {
                  flushSync(() => {
                    setIsSearchOpen(true);
                  });
                  const input = searchFormRef.current?.querySelector('input');
                  if (input) input.focus();
                } else if (query.trim()) {
                  handleSearchSubmit(e);
                } else {
                  const input = searchFormRef.current?.querySelector('input');
                  if (input) input.focus();
                }
              }}
            >
              <Search className="w-6 h-6" />
            </button>
          </form>
          <button type="button" className="profile-button bg-zinc-900 p-2 rounded-full hover:bg-zinc-800 transition-colors" aria-label="Profile">
            <User className="w-6 h-6" />
          </button>
        </div>
      </nav>
    </header>
  );
}
