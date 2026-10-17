const STORAGE_KEY = 'playloop_nav_stack';

function getMemoryStack() {
  if (typeof window !== 'undefined' && window.__PLAYLOOP_NAV_STACK__) {
    return window.__PLAYLOOP_NAV_STACK__;
  }
  return null;
}

function setMemoryStack(stack) {
  if (typeof window !== 'undefined') {
    window.__PLAYLOOP_NAV_STACK__ = stack;
  }
}

function getStoredStack() {
  const mem = getMemoryStack();
  if (Array.isArray(mem) && mem.length > 0) return mem;

  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMemoryStack(parsed);
          return parsed;
        }
      }
    }
  } catch (e) {
    // ignore storage access errors
  }
  return [];
}

function saveStack(stack) {
  setMemoryStack(stack);
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stack));
    }
  } catch (e) {
    // ignore
  }
}

function normalizeHash(hash) {
  if (!hash || hash === '#' || hash === '#/') return '#/home';
  return hash;
}

function shouldTrackHash(hash) {
  if (!hash) return false;
  // Ignore full-player overlay state which handles its own modal history
  if (hash.includes('player')) return false;
  return true;
}

export function initNavigationHistory() {
  if (typeof window === 'undefined') return;

  const current = normalizeHash(window.location.hash);
  let stack = getStoredStack();

  if (stack.length === 0) {
    if (shouldTrackHash(current)) {
      stack = [current];
      saveStack(stack);
    }
  } else {
    // Ensure the current hash is aligned with the top of stack if valid
    const top = stack[stack.length - 1];
    if (top !== current && shouldTrackHash(current)) {
      if (stack.length >= 2 && stack[stack.length - 2] === current) {
        stack.pop();
      } else {
        stack.push(current);
      }
      saveStack(stack);
    }
  }

  const handleHashChange = () => {
    const newHash = normalizeHash(window.location.hash);
    if (!shouldTrackHash(newHash)) return;

    let currentStack = getStoredStack();
    const len = currentStack.length;

    if (len === 0) {
      currentStack = [newHash];
      saveStack(currentStack);
      return;
    }

    if (currentStack[len - 1] === newHash) {
      return; // Same hash
    }

    // Check if user navigated back to the previous entry
    if (len >= 2 && currentStack[len - 2] === newHash) {
      currentStack.pop();
      saveStack(currentStack);
      return;
    }

    // Forward navigation
    if (currentStack.length > 40) {
      currentStack.shift();
    }
    currentStack.push(newHash);
    saveStack(currentStack);
  };

  window.removeEventListener('hashchange', handleHashChange);
  window.addEventListener('hashchange', handleHashChange);
}

export function canNavigateBack() {
  const stack = getStoredStack();
  return stack.length > 1;
}

export function getPreviousHash() {
  const stack = getStoredStack();
  if (stack.length >= 2) {
    return stack[stack.length - 2];
  }
  return null;
}

export function navigateBack(fallbackHash = '#/home') {
  if (typeof window === 'undefined') return;

  const stack = getStoredStack();
  if (stack.length > 1) {
    const prevHash = stack[stack.length - 2];
    
    if (window.history && window.history.length > 1) {
      window.history.back();

      // Safeguard: if hash hasn't updated after a short duration, force update to prevHash
      setTimeout(() => {
        const cur = normalizeHash(window.location.hash);
        if (cur.includes('playlist/') || cur.includes('liked-songs') || cur.includes('liked_songs')) {
          if (prevHash && prevHash !== cur) {
            window.location.hash = prevHash;
          } else {
            window.location.hash = fallbackHash;
          }
        }
      }, 150);
      return;
    }

    if (prevHash) {
      window.location.hash = prevHash;
      return;
    }
  }

  // Fallback if no prior in-app history entry
  window.location.hash = fallbackHash;
}
