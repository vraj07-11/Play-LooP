import { useRef, useCallback } from 'react';
import { navigateBack } from '../utils/navigationHistory';

export const MOBILE_TABS = ['home', 'search', 'library', 'settings'];

export function useSwipeTabs({
  currentView,
  onNavigate,
  isSidebarOpen = false,
  enabled = true,
}) {
  const touchStartRef = useRef(null);

  const getTabIndex = useCallback((view) => {
    if (view === 'liked-songs' || view === 'liked') return 0;
    if (view === 'download' || view === 'Download') return 2;
    const idx = MOBILE_TABS.indexOf(view);
    return idx !== -1 ? idx : 0;
  }, []);

  const handleTouchStart = useCallback((e) => {
    if (!enabled) return;
    if (typeof window !== 'undefined' && window.innerWidth >= 768) return;
    if (isSidebarOpen) return;

    // Check if full player or any full modal is visible
    if (typeof document !== 'undefined' && document.querySelector('.full-player-open')) {
      return;
    }
    if (typeof window !== 'undefined' && window.location.hash.includes('player')) {
      return;
    }

    const touch = e.touches && e.touches[0];
    if (!touch) return;

    const target = e.target;
    const screenWidth = window.innerWidth;
    const isEdgeSwipe = touch.clientX <= 25 || touch.clientX >= screenWidth - 25;

    let isIgnored = false;
    if (!isEdgeSwipe && target && target.closest) {
      // Ignore interactive form controls and sliders
      const isControl = target.closest(
        'input, textarea, select, button, [role="slider"], .progress-bar, .timeline-bar, .volume-slider'
      );
      if (isControl) {
        // If clicking on a standard button or input, don't hijack swipe
        const isInput = isControl.tagName === 'INPUT' || isControl.tagName === 'TEXTAREA' || isControl.getAttribute('role') === 'slider';
        if (isInput) {
          isIgnored = true;
        }
      }

      // Ignore inner horizontal scrollable containers (e.g., song carousels or tag pills)
      const horizontalScrollable = target.closest(
        '.horizontal-scroll-row, .overflow-x-auto, .overflow-x-scroll, .no-scrollbar-mobile'
      );
      if (horizontalScrollable && horizontalScrollable.scrollWidth > horizontalScrollable.clientWidth + 10) {
        isIgnored = true;
      }
    }

    touchStartRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      lockedDirection: null,
      isIgnored,
    };
  }, [enabled, isSidebarOpen]);

  const handleTouchMove = useCallback((e) => {
    if (!touchStartRef.current || touchStartRef.current.isIgnored) return;

    const touch = e.touches && e.touches[0];
    if (!touch) return;

    const deltaX = touch.clientX - touchStartRef.current.startX;
    const deltaY = touch.clientY - touchStartRef.current.startY;

    // Lock direction once movement is detected (> 8px)
    if (!touchStartRef.current.lockedDirection && Math.hypot(deltaX, deltaY) > 8) {
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        touchStartRef.current.lockedDirection = 'vertical';
      } else {
        touchStartRef.current.lockedDirection = 'horizontal';
      }
    }
  }, []);

  const handleTouchEnd = useCallback((e) => {
    const startData = touchStartRef.current;
    touchStartRef.current = null;

    if (!startData || startData.isIgnored || startData.lockedDirection === 'vertical') {
      return;
    }

    const touch = e.changedTouches && e.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - startData.startX;
    const deltaY = touch.clientY - startData.startY;
    const duration = Date.now() - startData.startTime;

    const isValidSwipe =
      duration < 750 &&
      Math.abs(deltaX) >= 42 &&
      Math.abs(deltaX) > Math.abs(deltaY) * 1.25;

    if (!isValidSwipe) return;

    const isSwipingLeft = deltaX < 0;
    const hash = typeof window !== 'undefined' ? window.location.hash || '' : '';

    // If viewing a playlist or liked songs detail on mobile, swiping right returns to previous view
    if (!isSwipingLeft && (hash.includes('playlist/') || hash.includes('liked-songs') || hash.includes('liked_songs'))) {
      navigateBack('#/home');
      return;
    }

    const currentIndex = getTabIndex(currentView);

    if (isSwipingLeft) {
      // Swiping LEFT -> Advance to next tab (forward)
      if (currentIndex < MOBILE_TABS.length - 1) {
        const nextTab = MOBILE_TABS[currentIndex + 1];
        onNavigate(nextTab, 'forward');
      }
    } else {
      // Swiping RIGHT -> Back to previous tab (backward)
      if (currentIndex > 0) {
        const prevTab = MOBILE_TABS[currentIndex - 1];
        onNavigate(prevTab, 'backward');
      }
    }
  }, [currentView, getTabIndex, onNavigate]);

  const handleTouchCancel = useCallback(() => {
    touchStartRef.current = null;
  }, []);

  return {
    getTabIndex,
    swipeHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchCancel,
    },
  };
}
