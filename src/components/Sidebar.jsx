import React, { useState } from 'react';
import { 
  Home, Search, Library, User, Repeat, 
  Heart, Settings, Download 
} from 'lucide-react';

export default function Sidebar({ isSidebarOpen, setIsSidebarOpen, setCurrentView, currentView }) {
  const [isHovered, setIsHovered] = useState(false);
  const isExpandedDesktop = isHovered || isSidebarOpen;

  // Navigation handlers
  const handleMobileNav = (e, view, hash) => {
    e.preventDefault();
    if (hash) window.location.hash = hash;
    setCurrentView(view);
    setIsSidebarOpen(false);
  };

  const handleDesktopNav = (e, item) => {
    e.preventDefault();
    if (item.hash) window.location.hash = item.hash;
    setCurrentView(item.id);
  };

  const isHomeActive = currentView === 'home' || currentView === 'liked-songs' || currentView === 'liked';

  // Desktop Navigation Items
  const desktopPrimary = [
    { id: 'home', name: 'Home', icon: Home, hash: '#/' },
    { id: 'loops', name: 'Loops', icon: Repeat, hash: '#/loops' },
    { id: 'search', name: 'Search', icon: Search, hash: '#/search' },
    { id: 'library', name: 'Library', icon: Library, hash: '#/library' },
    { id: 'liked-songs', name: 'Liked Songs', icon: Heart, hash: '#/playlist/liked_songs' },
  ];

  const desktopBottom = [
    { id: 'profile', name: 'Profile', icon: User, hash: '#/profile' },
    { id: 'settings', name: 'Settings', icon: Settings, hash: '#/settings' },
    { id: 'download', name: 'Download App', icon: Download, hash: '#/download' },
  ];

  const renderDesktopItem = (item) => {
    const isActive = item.id === 'home' ? isHomeActive : currentView === item.id;
    const Icon = item.icon;

    return (
      <li key={item.id} className="relative group/nav mb-1.5 w-full flex justify-center">
        <a
          href={item.hash || '#'}
          onClick={(e) => handleDesktopNav(e, item)}
          className={`cursor-pointer select-none transition-all duration-200 flex items-center ${
            isExpandedDesktop
              ? `w-[calc(100%-0.5rem)] mx-1 h-11 px-3 rounded-xl gap-3.5 ${
                  isActive
                    ? 'bg-white/10 border border-white/15 text-white font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5 font-medium'
                }`
              : `w-11 h-11 rounded-xl justify-center ${
                  isActive
                    ? 'bg-white/10 border border-white/20 text-white shadow-[0_0_16px_rgba(255,255,255,0.12)] scale-105'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5 active:scale-95'
                }`
          }`}
        >
          {/* Icon */}
          <div className="flex items-center justify-center shrink-0">
            <Icon className={`w-5 h-5 transition-transform ${
              isActive ? 'text-white stroke-[2.2]' : 'text-zinc-400 group-hover/nav:text-white stroke-[1.8] group-hover/nav:scale-110'
            }`} />
          </div>

          {/* Label inside expanding sidebar */}
          <div className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isExpandedDesktop ? 'opacity-100 max-w-[140px] flex-1' : 'opacity-0 max-w-0 pointer-events-none'
          }`}>
            <span className={`text-sm tracking-tight transition-colors truncate block ${
              isActive 
                ? 'text-white font-bold' 
                : 'text-zinc-400 group-hover/nav:text-white'
            }`}>
              {item.name}
            </span>
          </div>

          {/* Floating animated badge on icon hover when collapsed */}
          {!isExpandedDesktop && (
            <div className="hidden md:flex absolute left-full ml-3 px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/15 text-white text-xs font-semibold shadow-[0_10px_30px_rgba(0,0,0,0.8)] opacity-0 translate-x-[-8px] group-hover/nav:opacity-100 group-hover/nav:translate-x-0 pointer-events-none transition-all duration-200 ease-out z-50 whitespace-nowrap items-center">
              <span>{item.name}</span>
            </div>
          )}
        </a>
      </li>
    );
  };

  return (
    <>
      {/* ========================================================
          MOBILE SIDEBAR (Screens < 768px): Exact classic original layout
          No header inside drawer, no blur, standard clean links
      ======================================================== */}
      {isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 z-40 transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sidebar md:hidden w-70 bg-black border-r flex flex-col overflow-y-auto border-zinc-800 text-white p-5 transition-transform duration-300 ${
          isSidebarOpen ? '' : 'is-closed'
        } fixed inset-y-0 left-0 z-50 select-none`}
      >
        <nav className="mt-1 flex-1 flex flex-col justify-between">
          <div>
            <ul className="border-b border-zinc-800 pb-5">
              <li className="mb-5">
                <a
                  href="#"
                  className={`underline-link flex items-center gap-3 transition-colors ${
                    isHomeActive ? 'text-white font-semibold' : 'text-zinc-400 hover:text-white'
                  }`}
                  onClick={(e) => handleMobileNav(e, 'home', '#/')}
                >
                  <Home className="w-6 h-6 shrink-0" />
                  <span className="font-semibold">Home</span>
                </a>
              </li>
              <li className="mb-5">
                <a
                  href="#loops"
                  className={`underline-link flex items-center gap-3 transition-colors ${
                    currentView === 'loops' ? 'text-white font-semibold' : 'text-zinc-400 hover:text-white'
                  }`}
                  onClick={(e) => handleMobileNav(e, 'loops', '#/loops')}
                >
                  <Repeat className="w-6 h-6 shrink-0" />
                  <span className="font-semibold">Loops</span>
                </a>
              </li>
              <li className="mb-5">
                <a
                  href="#search"
                  className={`underline-link flex items-center gap-3 transition-colors ${
                    currentView === 'search' ? 'text-white font-semibold' : 'text-zinc-400 hover:text-white'
                  }`}
                  onClick={(e) => handleMobileNav(e, 'search', '#/search')}
                >
                  <Search className="w-6 h-6 shrink-0" />
                  <span className="font-semibold">Search</span>
                </a>
              </li>
              <li className="mb-5">
                <a
                  href="#library"
                  className={`underline-link flex items-center gap-3 transition-colors ${
                    currentView === 'library' ? 'text-white font-semibold' : 'text-zinc-400 hover:text-white'
                  }`}
                  onClick={(e) => handleMobileNav(e, 'library', '#/library')}
                >
                  <Library className="w-6 h-6 shrink-0" />
                  <span className="font-semibold">Your Library</span>
                </a>
              </li>
              <li className="">
                <a
                  href="#download"
                  className={`underline-link flex items-center gap-3 transition-colors ${
                    currentView === 'download' ? 'text-white font-semibold' : 'text-zinc-400 hover:text-white'
                  }`}
                  onClick={(e) => handleMobileNav(e, 'download', '#/download')}
                >
                  <Download className="w-6 h-6 shrink-0" />
                  <span className="font-semibold">Download App</span>
                </a>
              </li>
            </ul>

            <ul className="mt-5 border-b border-zinc-800 pb-5">
              <li className="">
                <a
                  href="#/playlist/liked_songs"
                  className={`underline-link flex items-center gap-3 transition-colors ${
                    currentView === 'liked-songs' ? 'text-white font-semibold' : 'text-zinc-400 hover:text-white'
                  }`}
                  onClick={(e) => handleMobileNav(e, 'liked-songs', '#/playlist/liked_songs')}
                >
                  <Heart className="w-6 h-6 shrink-0" />
                  <span className="font-semibold">Liked Songs</span>
                </a>
              </li>
            </ul>
          </div>

          <ul className="mt-auto pt-5">
            <li className="mb-5">
              <a
                href="#profile"
                className={`underline-link flex items-center gap-3 transition-colors ${
                  currentView === 'profile' ? 'text-white font-semibold' : 'text-zinc-400 hover:text-white'
                }`}
                onClick={(e) => handleMobileNav(e, 'profile', '#/profile')}
              >
                <User className="w-6 h-6 shrink-0" />
                <span className="font-semibold">Profile</span>
              </a>
            </li>
            <li className="">
              <a
                href="#settings"
                className={`underline-link flex items-center gap-3 transition-colors ${
                  currentView === 'settings' ? 'text-white font-semibold' : 'text-zinc-400 hover:text-white'
                }`}
                onClick={(e) => handleMobileNav(e, 'settings', '#/settings')}
              >
                <Settings className="w-6 h-6 shrink-0" />
                <span className="font-semibold">Settings</span>
              </a>
            </li>
          </ul>
        </nav>
      </aside>

      {/* ========================================================
          DESKTOP SIDEBAR (Screens >= 768px): Sleek docked rail,
          expand on hover & toggle via Header Menu/Close button
      ======================================================== */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`hidden md:flex sidebar bg-black border-r border-zinc-800 text-white flex-col justify-between select-none relative h-full py-4 px-2 z-30 transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isExpandedDesktop ? 'w-[220px]' : 'w-[72px]'
        }`}
      >
        {/* Top Section */}
        <div className="flex flex-col w-full">
          <nav className="w-full">
            <ul className="w-full flex flex-col items-center">
              {desktopPrimary.map(renderDesktopItem)}
            </ul>
          </nav>
        </div>

        {/* Bottom Section */}
        <div className="w-full pt-3 border-t border-white/10">
          <ul className="w-full flex flex-col items-center">
            {desktopBottom.map(renderDesktopItem)}
          </ul>
        </div>
      </aside>
    </>
  );
}
