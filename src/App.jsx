import React, { useEffect, useState, useRef, useCallback } from 'react';
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
import MobileBottomNav from './components/MobileBottomNav';
import PullToRefresh from './components/PullToRefresh';
import { useSwipeTabs } from './hooks/useSwipeTabs';
import { usePullToRefresh } from './hooks/usePullToRefresh';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState('home');
  const [visitedViews, setVisitedViews] = useState(() => new Set(['home']));
  const [pageRefreshKeys, setPageRefreshKeys] = useState({
    home: 0,
    search: 0,
    library: 0,
    settings: 0,
    download: 0
  });
  const [languagesReady, setLanguagesReady] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState(null);
  const contentRef = useRef(null);

  const isSidebarOpenRef = useRef(isSidebarOpen);
  useEffect(() => {
    isSidebarOpenRef.current = isSidebarOpen;
  }, [isSidebarOpen]);

  useEffect(() => {
    setVisitedViews(prev => {
      if (prev.has(currentView)) return prev;
      const next = new Set(prev);
      next.add(currentView);
      return next;
    });
  }, [currentView]);

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

  const handleSetCurrentView = (view, explicitDirection = null) => {
    if (isSidebarOpen) {
      setIsSidebarOpen(false);
    }

    const prevIndex = getTabIndex ? getTabIndex(currentView) : 0;
    const nextIndex = getTabIndex ? getTabIndex(view) : 0;
    const dir = explicitDirection || (nextIndex > prevIndex ? 'forward' : nextIndex < prevIndex ? 'backward' : null);
    setTransitionDirection(dir);

    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }

    if (view === 'home') {
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

  const handleRefreshCurrentPage = useCallback(async () => {
    const key = (currentView === 'liked-songs' || currentView === 'liked') ? 'home' : currentView;
    setPageRefreshKeys(prev => ({
      ...prev,
      [key]: (prev[key] || 0) + 1
    }));
  }, [currentView]);

  const { pullDistance, isRefreshing } = usePullToRefresh({
    containerRef: contentRef,
    onRefresh: handleRefreshCurrentPage,
    threshold: 65,
    enabled: languagesReady
  });

  const { getTabIndex, swipeHandlers } = useSwipeTabs({
    currentView,
    onNavigate: handleSetCurrentView,
    isSidebarOpen,
    enabled: languagesReady,
  });

  const handleSetIsSidebarOpen = (openState) => {
    const nextState = typeof openState === 'function' ? openState(isSidebarOpen) : openState;
    setIsSidebarOpen(nextState);
  };

  const slideClass = transitionDirection === 'forward' 
    ? 'mobile-tab-slide-forward' 
    : transitionDirection === 'backward' 
    ? 'mobile-tab-slide-backward' 
    : '';

  useEffect(() => {
    if (transitionDirection) {
      const timer = setTimeout(() => {
        setTransitionDirection(null);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [transitionDirection, currentView]);

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
            <section 
              ref={contentRef}
              className="app-content select-none touch-pan-y relative" 
              aria-live="polite"
              {...swipeHandlers}
            >
              <PullToRefresh
                pullDistance={pullDistance}
                isRefreshing={isRefreshing}
                threshold={65}
                currentView={currentView}
              />
              <div className="w-full min-h-full overflow-hidden">
                <ErrorBoundary>
                  <div className={`w-full min-h-full ${currentView === 'home' || currentView === 'liked-songs' || currentView === 'liked' ? `block ${slideClass}` : 'hidden'}`}>
                    <Home setCurrentView={handleSetCurrentView} refreshKey={pageRefreshKeys.home} />
                  </div>

                  {visitedViews.has('search') && (
                    <div className={`w-full min-h-full ${currentView === 'search' ? `block ${slideClass}` : 'hidden'}`}>
                      <SearchPage refreshKey={pageRefreshKeys.search} />
                    </div>
                  )}

                  {visitedViews.has('library') && (
                    <div className={`w-full min-h-full ${currentView === 'library' ? `block ${slideClass}` : 'hidden'}`}>
                      <LibraryPage setCurrentView={handleSetCurrentView} refreshKey={pageRefreshKeys.library} />
                    </div>
                  )}

                  {visitedViews.has('settings') && (
                    <div className={`w-full min-h-full ${currentView === 'settings' ? `block ${slideClass}` : 'hidden'}`}>
                      <SettingsPage setCurrentView={handleSetCurrentView} refreshKey={pageRefreshKeys.settings} />
                    </div>
                  )}

                  {(visitedViews.has('download') || visitedViews.has('Download')) && (
                    <div className={`w-full min-h-full ${currentView === 'download' || currentView === 'Download' ? `block ${slideClass}` : 'hidden'}`}>
                      <DownloadPage />
                    </div>
                  )}

                  {currentView !== 'home' && currentView !== 'liked-songs' && currentView !== 'liked' && currentView !== 'library' && currentView !== 'settings' && currentView !== 'search' && currentView !== 'download' && currentView !== 'Download' && (
                    <PlaceholderPage view={currentView} />
                  )}
                </ErrorBoundary>
              </div>
            </section>
            <RightSidebar />
          </main>
          <Player />
          <MobileBottomNav currentView={currentView} setCurrentView={handleSetCurrentView} swipeHandlers={swipeHandlers} />
        </>
      )}
    </div>
  );
}

export default App;
