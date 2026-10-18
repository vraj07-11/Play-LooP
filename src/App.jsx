import React, { useEffect, useState, useRef, useCallback, lazy, Suspense } from 'react';
import { usePlayer } from './context/PlayerContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import RightSidebar from './components/RightSidebar';
import Player from './components/Player';
import Home from './pages/Home';
import LanguageSelector from './components/LanguageSelector';
import ErrorBoundary from './components/ErrorBoundary';
import MobileBottomNav from './components/MobileBottomNav';
import PullToRefresh from './components/PullToRefresh';
import { useSwipeTabs } from './hooks/useSwipeTabs';
import { usePullToRefresh } from './hooks/usePullToRefresh';
import { initNavigationHistory } from './utils/navigationHistory';

const SearchPage = lazy(() => import('./pages/SearchPage'));
const LibraryPage = lazy(() => import('./pages/LibraryPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const DownloadPage = lazy(() => import('./pages/DownloadPage'));
const PlaceholderPage = lazy(() => import('./pages/PlaceholderPage'));
const ShareModal = lazy(() => import('./components/ShareModal'));

function App() {
  const { selectAndPlayTrack } = usePlayer();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState('home');
  const [visitedViews, setVisitedViews] = useState(() => new Set(['home']));
  const [pageRefreshKeys, setPageRefreshKeys] = useState({
    home: 0,
    search: 0,
    library: 0,
    profile: 0,
    settings: 0,
    download: 0
  });
  const [languagesReady, setLanguagesReady] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState(null);
  const contentRef = useRef(null);
  const handledDeepLinkRef = useRef(null);

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
    const handleDeepLink = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        let trackId = searchParams.get('track') || searchParams.get('v') || searchParams.get('id');
        let title = searchParams.get('title') ? decodeURIComponent(searchParams.get('title')) : '';
        let artist = searchParams.get('artist') ? decodeURIComponent(searchParams.get('artist')) : '';
        let cover = searchParams.get('cover') ? decodeURIComponent(searchParams.get('cover')) : '';

        const pathname = window.location.pathname || '';
        const pathMatch = pathname.match(/^\/(?:track|s)\/([^/?#&]+)/);
        if (pathMatch && pathMatch[1]) {
          trackId = decodeURIComponent(pathMatch[1]);
        }

        const hash = window.location.hash || '';
        const trackMatch = hash.match(/#\/track\/([^/?#&]+)/);
        if (trackMatch && trackMatch[1]) {
          trackId = trackMatch[1];
        }
        const searchMatch = hash.match(/[?&]v=([^/?#&]+)/);
        if (!trackId && searchMatch && searchMatch[1]) {
          trackId = searchMatch[1];
        }

        if (!trackId || handledDeepLinkRef.current === trackId) {
          return;
        }

        handledDeepLinkRef.current = trackId;
        setLanguagesReady(true);

        if (title && cover) {
          selectAndPlayTrack(trackId, title, artist || 'Unknown Artist', cover);
        }

        try {
          const res = await fetch(`/api/song?id=${encodeURIComponent(trackId)}`);
          if (res.ok) {
            const song = await res.json();
            if (song && song.videoId) {
              if (!title || !cover) {
                selectAndPlayTrack(
                  song.videoId,
                  song.title || title || 'Unknown Track',
                  song.artist || artist || 'Unknown Artist',
                  song.thumbnail || cover || '/default-cover.svg'
                );
              }
            }
          }
        } catch (fetchErr) {
          console.warn('[DeepLink] Failed to fetch song details:', fetchErr);
          if (!title) {
            selectAndPlayTrack(trackId, 'Shared Track', 'Unknown Artist', '/default-cover.svg');
          }
        }
      } catch (e) {
        console.error('[DeepLink] Error handling deep link:', e);
      }
    };

    handleDeepLink();
    window.addEventListener('hashchange', handleDeepLink);
    window.addEventListener('popstate', handleDeepLink);
    return () => {
      window.removeEventListener('hashchange', handleDeepLink);
      window.removeEventListener('popstate', handleDeepLink);
    };
  }, [selectAndPlayTrack]);

  useEffect(() => {
    initNavigationHistory();

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
        if (contentRef.current) contentRef.current.scrollTop = 0;
      } else if (hash.includes('playlist/')) {
        setCurrentView('home');
        if (contentRef.current) contentRef.current.scrollTop = 0;
      } else if (hash.includes('track/')) {
        setCurrentView('home');
        if (contentRef.current) contentRef.current.scrollTop = 0;
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

                  <Suspense fallback={<div className="w-full min-h-full" />}>
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

                    {visitedViews.has('profile') && (
                      <div className={`w-full min-h-full ${currentView === 'profile' ? `block ${slideClass}` : 'hidden'}`}>
                        <ProfilePage setCurrentView={handleSetCurrentView} refreshKey={pageRefreshKeys.profile} />
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

                    {currentView !== 'home' && currentView !== 'liked-songs' && currentView !== 'liked' && currentView !== 'library' && currentView !== 'profile' && currentView !== 'settings' && currentView !== 'search' && currentView !== 'download' && currentView !== 'Download' && (
                      <PlaceholderPage view={currentView} />
                    )}
                  </Suspense>
                </ErrorBoundary>
              </div>
            </section>
            <RightSidebar />
          </main>
          <Player />
          <MobileBottomNav currentView={currentView} setCurrentView={handleSetCurrentView} swipeHandlers={swipeHandlers} />
        </>
      )}
      <Suspense fallback={null}>
        <ShareModal />
      </Suspense>
    </div>
  );
}

export default App;
