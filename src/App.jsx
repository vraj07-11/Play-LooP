import React, { useEffect, useState } from 'react';
import { usePlayer } from './context/PlayerContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Player from './components/Player';
import Home from './pages/Home';
import SearchPage from './pages/SearchPage';
import DownloadPage from './pages/DownloadPage';
import PlaceholderPage from './pages/PlaceholderPage';
import { Play, Pause, Search, User, Menu, X, Home as HomeIcon, Library, Download, PlusSquare, Heart, LogOut, Settings, Shuffle, SkipBack, SkipForward, Repeat1 } from 'lucide-react';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState('home');

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Header 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={setIsSidebarOpen}
        setCurrentView={setCurrentView}
      />
      <main className="relative flex min-h-0 flex-1">
        <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} setCurrentView={setCurrentView} />
        <section className="app-content" aria-live="polite">
          {currentView === 'home' && <Home />}
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
