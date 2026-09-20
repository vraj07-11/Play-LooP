import React, { useEffect, useState, useRef } from 'react';
import { usePlayer } from './context/PlayerContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Player from './components/Player';
import Home from './pages/Home';
import SearchPage from './pages/SearchPage';
import DownloadPage from './pages/DownloadPage';
import PlaceholderPage from './pages/PlaceholderPage';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState('home');
  const [homeKey, setHomeKey] = useState(0);

  const isSidebarOpenRef = useRef(isSidebarOpen);
  useEffect(() => {
    isSidebarOpenRef.current = isSidebarOpen;
  }, [isSidebarOpen]);

  useEffect(() => {
    // Set initial history state if none exists
    if (!window.history.state) {
      window.history.replaceState({ view: 'home', root: true }, '', '#/home');
    }

    const handlePopState = (event) => {
      // If mobile sidebar is open, close it first
      if (isSidebarOpenRef.current) {
        setIsSidebarOpen(false);
      }

      const state = event.state;
      if (state && state.view) {
        setCurrentView(state.view);
      } else {
        setCurrentView('home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSetCurrentView = (view) => {
    if (view === 'home') {
      setHomeKey((prev) => prev + 1);
    }

    if (view !== currentView) {
      window.history.pushState({ view }, '', `#/${view}`);
      setCurrentView(view);
    }

    if (isSidebarOpen) {
      setIsSidebarOpen(false);
    }
  };

  const handleSetIsSidebarOpen = (openState) => {
    const nextState = typeof openState === 'function' ? openState(isSidebarOpen) : openState;
    if (nextState && !isSidebarOpen) {
      window.history.pushState({ view: currentView, sidebarOpen: true }, '', '#/menu');
    }
    setIsSidebarOpen(nextState);
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden select-none">
      <Header 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={handleSetIsSidebarOpen}
        setCurrentView={handleSetCurrentView}
      />
      <main className="relative flex min-h-0 flex-1 select-none">
        <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={handleSetIsSidebarOpen} setCurrentView={handleSetCurrentView} />
        <section className="app-content select-none" aria-live="polite">
          {currentView === 'home' && <Home key={homeKey} />}
          {currentView === 'search' && <SearchPage />}
          {(currentView === 'download' || currentView === 'Download') && <DownloadPage />}
          {currentView !== 'home' && currentView !== 'search' && currentView !== 'download' && currentView !== 'Download' && (
            <PlaceholderPage view={currentView} />
          )}
        </section>
      </main>
      <Player />
      <div aria-hidden="true" style={{ display: 'none' }}>
        <div className="youtube-player" id="youtubePlayer"></div>
      </div>
    </div>
  );
}

export default App;
