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
import LibraryPage from './pages/LibraryPage';
import SettingsPage from './pages/SettingsPage';
import LanguageSelector from './components/LanguageSelector';
import ErrorBoundary from './components/ErrorBoundary';

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
        console.log('App focused via launchQueue:', launchParams.targetURL);
      });
    }

    const syncViewFromHash = () => {
      if (isSidebarOpenRef.current) {
        setIsSidebarOpen(false);
      }

      const hash = window.location.hash || '';

      if (hash.includes('playlist/liked_songs') || hash.includes('liked-songs') || hash.includes('liked_songs')) {
        setCurrentView('home');
      } else if (hash.includes('playlist/')) {
        setCurrentView('home');
      } else if (hash.includes('search')) {
        setCurrentView('search');
      } else if (hash.includes('library')) {
        setCurrentView('library');
      } else if (hash.includes('download') || hash.includes('Download')) {
        setCurrentView('download');
      } else if (hash.includes('create-playlist')) {
        setCurrentView('create-playlist');
      } else if (hash.includes('logout')) {
        setCurrentView('logout');
      } else if (hash.includes('settings')) {
        setCurrentView('settings');
      } else if (hash.includes('profile')) {
        setCurrentView('profile');
      } else {
        setCurrentView('home');
      }
    };

    syncViewFromHash();

    window.addEventListener('popstate', syncViewFromHash);
    window.addEventListener('hashchange', syncViewFromHash);
    return () => {
      window.removeEventListener('popstate', syncViewFromHash);
      window.removeEventListener('hashchange', syncViewFromHash);
    };
  }, []);

  const handleSetCurrentView = (view) => {
    if (isSidebarOpen) {
      setIsSidebarOpen(false);
    }

    if (view === 'home') {
      setHomeKey((prev) => prev + 1);
      window.location.hash = '#/home';
      setCurrentView('home');
      return;
    }

    if (view === 'liked-songs' || view === 'liked') {
      window.location.hash = '#/playlist/liked_songs';
      setCurrentView('home');
      return;
    }

    if (!window.location.hash.startsWith(`#/${view}`)) {
      window.location.hash = `#/${view}`;
    }
    setCurrentView(view);
  };

  const handleSetIsSidebarOpen = (openState) => {
    const nextState = typeof openState === 'function' ? openState(isSidebarOpen) : openState;
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
              <ErrorBoundary>
                {(currentView === 'home' || currentView === 'liked-songs' || currentView === 'liked') && (
                  <Home key={homeKey} setCurrentView={handleSetCurrentView} />
                )}
                {currentView === 'library' && <LibraryPage setCurrentView={handleSetCurrentView} />}
                {currentView === 'settings' && <SettingsPage setCurrentView={handleSetCurrentView} />}
                {currentView === 'search' && <SearchPage />}
                {(currentView === 'download' || currentView === 'Download') && <DownloadPage />}
                {currentView !== 'home' && currentView !== 'liked-songs' && currentView !== 'liked' && currentView !== 'library' && currentView !== 'settings' && currentView !== 'search' && currentView !== 'download' && currentView !== 'Download' && (
                  <PlaceholderPage view={currentView} />
                )}
              </ErrorBoundary>
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
