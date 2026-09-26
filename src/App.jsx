import React, { useEffect, useState, useRef } from 'react';
import { usePlayer } from './context/PlayerContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import RightSidebar from './components/RightSidebar';
import Player from './components/Player';
import Home from './pages/Home';
import SearchPage from './pages/SearchPage';
import DownloadPage from './pages/DownloadPage';
import PlaceholderPage from './pages/PlaceholderPage';
import LanguageSelector from './components/LanguageSelector';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState('home');
  const [homeKey, setHomeKey] = useState(0);
  const [languagesReady, setLanguagesReady] = useState(false);

  const isSidebarOpenRef = useRef(isSidebarOpen);
  useEffect(() => {
    isSidebarOpenRef.current = isSidebarOpen;
  }, [isSidebarOpen]);

  useEffect(() => {
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
      <Header 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={handleSetIsSidebarOpen}
        setCurrentView={handleSetCurrentView}
      />
      <LanguageSelector onComplete={() => setLanguagesReady(true)} />
      
      {languagesReady && (
        <>
          <main className="relative flex min-h-0 flex-1 select-none">
            <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={handleSetIsSidebarOpen} setCurrentView={handleSetCurrentView} />
            <section className="app-content select-none" aria-live="polite">
              {currentView === 'home' && <Home key={homeKey} setCurrentView={handleSetCurrentView} />}
              {currentView === 'search' && <SearchPage />}
              {(currentView === 'download' || currentView === 'Download') && <DownloadPage />}
              {currentView !== 'home' && currentView !== 'search' && currentView !== 'download' && currentView !== 'Download' && (
                <PlaceholderPage view={currentView} />
              )}
            </section>
            <RightSidebar />
          </main>
          <Player />
        </>
      )}
    </div>
  );
}

export default App;
