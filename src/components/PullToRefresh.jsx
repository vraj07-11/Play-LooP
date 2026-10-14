import React from 'react';

export default function PullToRefresh({
  pullDistance = 0,
  isRefreshing = false,
  threshold = 65,
  currentView = 'home'
}) {
  if (pullDistance <= 0 && !isRefreshing) return null;

  const progress = Math.min(1, pullDistance / threshold);
  const translateY = isRefreshing ? 18 : Math.min(pullDistance - 8, 32);
  const rotation = isRefreshing ? 0 : progress * 360;

  const viewName = currentView === 'home' 
    ? 'Home' 
    : currentView === 'search' 
    ? 'Search' 
    : currentView === 'library' 
    ? 'Library' 
    : currentView === 'settings' 
    ? 'Settings' 
    : currentView === 'download' 
    ? 'Downloads' 
    : 'Page';

  return (
    <div
      className="pointer-events-none fixed left-0 right-0 top-16 z-50 flex justify-center transition-transform duration-200 ease-out"
      style={{
        transform: `translate3d(0, ${translateY}px, 0)`,
        opacity: isRefreshing ? 1 : Math.max(0.15, progress)
      }}
    >
      <div className="flex items-center gap-2.5 rounded-full border border-white/20 bg-[#121214]/95 px-4 py-2 shadow-[0_10px_32px_rgba(0,0,0,0.85),0_0_20px_rgba(255,255,255,0.08)] backdrop-blur-xl">
        <div className="relative flex h-5 w-5 items-center justify-center">
          {isRefreshing ? (
            <div className="h-4 w-4 rounded-full border-2 border-white/25 border-t-white animate-spin" />
          ) : (
            <svg
              className="h-4 w-4 text-white transition-transform duration-75"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              <polyline points="21 3 21 9 15 9" />
            </svg>
          )}
        </div>
        <span className="text-xs font-medium tracking-tight text-white">
          {isRefreshing
            ? `Refreshing ${viewName}...`
            : progress >= 1
            ? `Release to refresh`
            : `Pull to refresh`}
        </span>
      </div>
    </div>
  );
}
