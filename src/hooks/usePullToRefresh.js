import { useState, useRef, useCallback, useEffect } from 'react';

export function usePullToRefresh({
  containerRef,
  onRefresh,
  threshold = 65,
  enabled = true
}) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const isPullingRef = useRef(false);
  const isRefreshingRef = useRef(false);

  isRefreshingRef.current = isRefreshing;

  const handleTouchStart = useCallback((e) => {
    if (!enabled || isRefreshingRef.current) return;

    // Check if player modal or full player is open
    if (document.querySelector('.full-player-open')) return;
    if (window.location.hash.includes('player')) return;

    const container = containerRef?.current;
    let currentScrollTop = container ? container.scrollTop : window.scrollY;
    const activeScrollChild = container ? container.querySelector('.overflow-y-auto') : null;
    if (activeScrollChild && activeScrollChild.scrollTop > 2) {
      currentScrollTop = activeScrollChild.scrollTop;
    }

    // Only allow pull-down if already scrolled to the very top
    if (currentScrollTop <= 2) {
      const touch = e.touches[0];
      startYRef.current = touch.clientY;
      startXRef.current = touch.clientX;
      isPullingRef.current = true;
    } else {
      isPullingRef.current = false;
    }
  }, [containerRef, enabled]);

  const handleTouchMove = useCallback((e) => {
    if (!isPullingRef.current || isRefreshingRef.current) return;

    const container = containerRef?.current;
    let currentScrollTop = container ? container.scrollTop : window.scrollY;
    const activeScrollChild = container ? container.querySelector('.overflow-y-auto') : null;
    if (activeScrollChild && activeScrollChild.scrollTop > 2) {
      currentScrollTop = activeScrollChild.scrollTop;
    }
    if (currentScrollTop > 2) {
      isPullingRef.current = false;
      setPullDistance(0);
      return;
    }

    const touch = e.touches[0];
    const deltaY = touch.clientY - startYRef.current;
    const deltaX = touch.clientX - startXRef.current;

    // If swiping horizontally more than vertically, cancel pull-to-refresh
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      isPullingRef.current = false;
      setPullDistance(0);
      return;
    }

    if (deltaY > 0) {
      // Damped rubber-band formula for natural spring feel
      const distance = Math.min(95, Math.pow(deltaY, 0.82));
      setPullDistance(distance);
      // Prevent browser default overscroll reload
      if (e.cancelable && distance > 10) {
        e.preventDefault();
      }
    } else {
      setPullDistance(0);
    }
  }, [containerRef]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current || isRefreshingRef.current) {
      isPullingRef.current = false;
      setPullDistance(0);
      return;
    }

    isPullingRef.current = false;

    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      setPullDistance(threshold);

      const minDisplayTime = new Promise((resolve) => setTimeout(resolve, 750));
      try {
        if (onRefresh) {
          await Promise.all([onRefresh(), minDisplayTime]);
        } else {
          await minDisplayTime;
        }
      } catch (err) {
        console.warn('Pull-to-refresh error:', err);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, onRefresh]);

  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return;

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [containerRef, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    pullDistance,
    isRefreshing
  };
}
