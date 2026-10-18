import React, { useMemo } from 'react';
import { Home, Search, Library, User, Settings } from 'lucide-react';

export default function MobileBottomNav({ currentView, setCurrentView, swipeHandlers = {} }) {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'library', label: 'Your Library', icon: Library },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const activeIndex = useMemo(() => {
    if (currentView === 'home' || currentView === 'liked-songs' || currentView === 'liked') return 0;
    if (currentView === 'search' || (typeof window !== 'undefined' && window.location.hash.includes('search'))) return 1;
    if (currentView === 'library') return 2;
    if (currentView === 'profile') return 3;
    if (currentView === 'settings') return 4;
    return 0;
  }, [currentView]);

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
      {...swipeHandlers}
      className="md:hidden z-30 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800/80 px-2 py-1.5 flex items-center justify-around select-none shrink-0 shadow-[0_-8px_20px_rgba(0,0,0,0.7)] touch-pan-y"
    >
      {navItems.map((item, index) => {
        const Icon = item.icon;
        const isActive = activeIndex === index;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleNavClick(item.id)}
            className="flex flex-col items-center justify-center flex-1 py-1 px-1 cursor-pointer transition-all duration-200 select-none"
          >
            <div className={`transition-all duration-300 ${isActive ? 'scale-110 -translate-y-0.5' : 'scale-100 translate-y-0'}`}>
              <Icon 
                className={`w-5 h-5 mb-0.5 transition-colors duration-200 ${
                  isActive ? 'text-white stroke-[2.2px]' : 'text-zinc-400 hover:text-zinc-200 stroke-[1.7px]'
                }`} 
              />
            </div>
            <span className={`text-[10px] tracking-tight transition-colors duration-200 ${
              isActive ? 'text-white font-medium' : 'text-zinc-400 font-normal'
            }`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
