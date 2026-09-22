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
  const [isStandalone, setIsStandalone] = useState(true);

  const isSidebarOpenRef = useRef(isSidebarOpen);
  useEffect(() => {
    isSidebarOpenRef.current = isSidebarOpen;
  }, [isSidebarOpen]);

  useEffect(() => {
    // Check if running in browser
    const checkDisplayMode = () => {
      const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
      setIsStandalone(isPWA);
    };
    checkDisplayMode();
    window.matchMedia('(display-mode: standalone)').addEventListener('change', checkDisplayMode);

    // Prevent refresh when app is focused via a deep link or launch_handler
    if ('launchQueue' in window) {
      window.launchQueue.setConsumer((launchParams) => {
        // Just consume it without doing a full page reload.
        // We can access launchParams.targetURL if we ever need to route, 
        // but for now, we just want to bring the app to the front seamlessly.
        console.log('App focused via launchQueue:', launchParams.targetURL);
      });
    }

    // Set initial history state if none exists
    if (!window.history.state) {
      const initialHash = window.location.hash;
      window.history.replaceState({ view: 'home', root: true }, '', initialHash || '#/home');
    }

    const handlePopState = (event) => {
      // If mobile sidebar is open, close it first
      if (isSidebarOpenRef.current) {
        setIsSidebarOpen(false);
      }

      const state = event.state;
      const hash = window.location.hash;

      if (state && state.view) {
        setCurrentView(state.view);
      } else if (hash.includes('search')) {
        setCurrentView('search');
      } else if (hash.includes('download') || hash.includes('Download')) {
        setCurrentView('download');
      } else if (!hash.includes('player')) {
        setCurrentView('home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  const handleSetCurrentView = (view) => {
    if (view === 'home') {
      setHomeKey((prev) => prev + 1);
    }

    if (view !== currentView) {
      const currentHash = window.location.hash;
      const targetHash = currentHash.startsWith(`#/${view}`) || currentHash.startsWith(`#${view}`)
        ? currentHash
        : `#/${view}`;
      window.history.pushState({ view }, '', targetHash);
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
      {!isStandalone && (
        <div className="absolute inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm text-white p-6">
          <h1 className="text-3xl font-bold mb-4 text-center">Open Play LooP App</h1>
          <p className="text-gray-400 text-center mb-8 max-w-md">
            For the best experience and background playback, please open this app in the installed PWA.
          </p>
          <div className="flex flex-col gap-4 w-full max-w-xs">
            <button 
              onClick={() => window.location.href = "web+playloop://open"}
              className="bg-white text-black font-bold py-3 px-6 rounded-full hover:bg-gray-200 transition-colors"
            >
              Open in App
            </button>
            <button 
              onClick={() => setIsStandalone(true)}
              className="bg-transparent border border-gray-600 text-gray-300 font-bold py-3 px-6 rounded-full hover:bg-gray-800 transition-colors"
            >
              Continue in Browser
            </button>
          </div>
        </div>
      )}
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
