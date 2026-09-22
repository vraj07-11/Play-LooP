import React from 'react';
import { Home, Search, Library, Download, PlusSquare, Heart, LogOut, Settings } from 'lucide-react';

export default function Sidebar({ isSidebarOpen, setIsSidebarOpen, setCurrentView }) {
  const handleNavClick = (e, view) => {
    e.preventDefault();
    setCurrentView(view);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  return (
    <aside
      className={`sidebar w-70 bg-black border-r flex flex-col overflow-y-auto border-zinc-800 text-white p-5 transition-transform duration-300 ${isSidebarOpen ? '' : 'is-closed'} md:static absolute inset-y-0 left-0 z-20`}
    >
      <nav className="mt-1">
        <ul className="border-b border-zinc-800 pb-5">
          <li className="mb-5 border-white">
            <a href="#" className="underline-link flex items-center gap-3 text-zinc-400 hover:text-white transition-colors" onClick={(e) => handleNavClick(e, 'home')}>
              <Home className="w-6 h-6" />
              <span className="font-semibold">Home</span>
            </a>
          </li>
          <li className="mb-5">
            <a href="#search" className="underline-link flex items-center gap-3 text-zinc-400 hover:text-white transition-colors" onClick={(e) => handleNavClick(e, 'search')}>
              <Search className="w-6 h-6" />
              <span className="font-semibold">Search</span>
            </a>
          </li>
          <li className="mb-5">
            <a href="#library" className="underline-link flex items-center gap-3 text-zinc-400 hover:text-white transition-colors" onClick={(e) => handleNavClick(e, 'library')}>
              <Library className="w-6 h-6" />
              <span className="font-semibold">Your Library</span>
            </a>
          </li>
          <li className="">
            <a href="#Download" className="underline-link flex items-center gap-3 text-zinc-400 hover:text-white transition-colors" onClick={(e) => handleNavClick(e, 'download')}>
              <Download className="w-6 h-6" />
              <span className="font-semibold">Download App</span>
            </a>
          </li>
        </ul>
        <ul className="mt-5 border-b border-zinc-800 pb-5">
          <li className="mb-5">
            <a href="#create-playlist" className="underline-link flex items-center gap-3 text-zinc-400 hover:text-white transition-colors" onClick={(e) => handleNavClick(e, 'create-playlist')}>
              <PlusSquare className="w-6 h-6" />
              <span className="font-semibold">Create Playlist</span>
            </a>
          </li>
          <li className="">
            <a href="#liked-songs" className="underline-link flex items-center gap-3 text-zinc-400 hover:text-white transition-colors" onClick={(e) => handleNavClick(e, 'liked-songs')}>
              <Heart className="w-6 h-6" />
              <span className="font-semibold">Liked Songs</span>
            </a>
          </li>
        </ul>
      </nav>
      <ul className="mt-auto pt-5">
        <li className="mb-5">
          <a href="#logout" className="underline-link flex items-center gap-3 text-zinc-400 hover:text-white transition-colors" onClick={(e) => handleNavClick(e, 'logout')}>
            <LogOut className="w-6 h-6" />
            <span className="font-semibold">Logout</span>
          </a>
        </li>
        <li className="">
          <a href="#settings" className="underline-link flex items-center gap-3 text-zinc-400 hover:text-white transition-colors" onClick={(e) => handleNavClick(e, 'settings')}>
            <Settings className="w-6 h-6" />
            <span className="font-semibold">Settings</span>
          </a>
        </li>
      </ul>
    </aside>
  );
}
