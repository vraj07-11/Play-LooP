import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { canNavigateBack, navigateBack } from '../utils/navigationHistory';

let isBackButtonListenerRegistered = false;

export function setupNativeAppBackButton() {
  if (!Capacitor.isNativePlatform() || isBackButtonListenerRegistered) return;
  isBackButtonListenerRegistered = true;

  App.addListener('backButton', () => {
    // 1. If any modal, dropdown or dialog overlay is open, dismiss it first
    const openModal = document.querySelector('[role="dialog"], .modal-overlay, .modal-open, .fixed.inset-0.z-50');
    if (openModal) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return;
    }

    // 2. If FullPlayer is open (hash has player or state has fullPlayer)
    if (window.location.hash.includes('player') || window.history.state?.fullPlayer) {
      window.history.back();
      return;
    }

    // 3. If sidebar is open, close it
    const sidebar = document.querySelector('.sidebar-open, [data-sidebar-open="true"]');
    if (sidebar) {
      window.dispatchEvent(new CustomEvent('playloop-close-sidebar'));
      return;
    }

    // 4. If in-app page history can navigate back, return to previous page
    if (canNavigateBack()) {
      navigateBack();
      return;
    }

    // 5. If currently on a non-home tab (e.g. search, library, loops, settings), navigate to home
    const currentHash = window.location.hash || '';
    if (currentHash && currentHash !== '#/home' && currentHash !== '#' && currentHash !== '#/') {
      window.location.hash = '#/home';
      return;
    }

    // 6. At root Home view with no prior history: minimize app so background playback continues seamlessly
    App.minimizeApp();
  });
}
