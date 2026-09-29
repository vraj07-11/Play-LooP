import React from 'react';
import { Home, Search, Library, Settings } from 'lucide-react';

export default function MobileBottomNav({ currentView, setCurrentView }) {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'library', label: 'Your Library', icon: Library },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (id) => {
    if (id === 'home') {
      window.location.hash = '#/home';
    } else {
      window.location.hash = `#/${id}`;
    }
    if (typeof setCurrentView === 'function') {
      setCurrentView(id);
    }
  };

  return (
    <nav 
      aria-label="Mobile Bottom Navigation"
      className="md:hidden z-30 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800/80 px-2 py-1.5 flex items-center justify-around select-none shrink-0 shadow-[0_-8px_20px_rgba(0,0,0,0.7)]"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = 
          currentView === item.id || 
          (item.id === 'home' && (currentView === 'liked-songs' || currentView === 'liked')) ||
          (item.id === 'search' && window.location.hash.includes('search'));

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleNavClick(item.id)}
            className={`flex flex-col items-center justify-center flex-1 py-0.5 px-1 transition-all duration-200 cursor-pointer ${
              isActive ? 'text-white font-medium scale-105' : 'text-zinc-400 hover:text-zinc-200 font-normal'
            }`}
          >
            <Icon className={`w-5 h-5 mb-0.5 transition-transform ${isActive ? 'stroke-[2.2px]' : 'stroke-[1.7px]'}`} />
            <span className="text-[10px] tracking-tight mt-0.5">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
