import React from 'react';
import { Home, Repeat, Search, Library, Download, PlusSquare, Heart, User, Settings } from 'lucide-react';

export default function Sidebar({ isSidebarOpen, setIsSidebarOpen, setCurrentView, currentView }) {
  const handleNavClick = (e, view) => {
    e.preventDefault();
    setCurrentView(view);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const getLinkClass = (view) => {
    const isActive = currentView === view || (view === 'home' && (currentView === 'home' || currentView === 'liked-songs' || currentView === 'liked'));
    return `underline-link flex items-center gap-3 transition-colors ${isActive ? 'text-white' : 'text-zinc-400 hover:text-white'}`;
  };

  return (
    <aside
      className={`sidebar w-70 bg-black border-r flex flex-col overflow-y-auto border-zinc-800 text-white p-5 transition-transform duration-300 ${isSidebarOpen ? '' : 'is-closed'} md:static absolute inset-y-0 left-0 z-20`}
    >
      <nav className="mt-1">
        <ul className="border-b border-zinc-800 pb-5">
          <li className="mb-5 border-white">
            <a href="#" className={getLinkClass('home')} onClick={(e) => handleNavClick(e, 'home')}>
              <Home className="w-6 h-6" />
              <span className="font-semibold">Home</span>
            </a>
          </li>
          <li className="mb-5">
            <a href="#loops" className={getLinkClass('loops')} onClick={(e) => handleNavClick(e, 'loops')}>
              <Repeat className="w-6 h-6" />
              <span className="font-semibold">Loops</span>
            </a>
          </li>
          <li className="mb-5">
            <a href="#search" className={getLinkClass('search')} onClick={(e) => handleNavClick(e, 'search')}>
              <Search className="w-6 h-6" />
              <span className="font-semibold">Search</span>
            </a>
          </li>
          <li className="mb-5">
            <a href="#library" className={getLinkClass('library')} onClick={(e) => handleNavClick(e, 'library')}>
              <Library className="w-6 h-6" />
              <span className="font-semibold">Your Library</span>
            </a>
          </li>
          <li className="">
            <a href="#Download" className={getLinkClass('download')} onClick={(e) => handleNavClick(e, 'download')}>
              <Download className="w-6 h-6" />
              <span className="font-semibold">Download App</span>
            </a>
          </li>
        </ul>
        <ul className="mt-5 border-b border-zinc-800 pb-5">
          <li className="mb-5">
            <a href="#create-playlist" className={getLinkClass('create-playlist')} onClick={(e) => handleNavClick(e, 'create-playlist')}>
              <PlusSquare className="w-6 h-6" />
              <span className="font-semibold">Create Playlist</span>
            </a>
          </li>
          <li className="">
            <a href="#liked-songs" className={getLinkClass('liked-songs')} onClick={(e) => handleNavClick(e, 'liked-songs')}>
              <Heart className="w-6 h-6" />
              <span className="font-semibold">Liked Songs</span>
            </a>
          </li>
        </ul>
      </nav>
      <ul className="mt-auto pt-5">
        <li className="mb-5">
          <a href="#profile" className={getLinkClass('profile')} onClick={(e) => handleNavClick(e, 'profile')}>
            <User className="w-6 h-6" />
            <span className="font-semibold">Profile</span>
          </a>
        </li>
        <li className="">
          <a href="#settings" className={getLinkClass('settings')} onClick={(e) => handleNavClick(e, 'settings')}>
            <Settings className="w-6 h-6" />
            <span className="font-semibold">Settings</span>
          </a>
        </li>
      </ul>
    </aside>
  );
}
