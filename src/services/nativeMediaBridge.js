import { Capacitor } from '@capacitor/core';
import { MediaSession } from '@capgo/capacitor-media-session';

let isInitialized = false;
let lastPositionUpdate = 0;
let callbacks = {
  onPlay: null,
  onPause: null,
  onNext: null,
  onPrevious: null,
  onSeekTo: null,
  onSeekBy: null,
  onStop: null,
};

export const nativeMediaBridge = {
  isSupported() {
    return Capacitor.isNativePlatform();
  },

  async init(playerHandlers = {}) {
    if (!this.isSupported()) return;

    callbacks = { ...callbacks, ...playerHandlers };
    if (isInitialized) return;
    isInitialized = true;

    try {
      await MediaSession.setActionHandler({ action: 'play' }, () => {
        if (callbacks.onPlay) callbacks.onPlay();
      });

      await MediaSession.setActionHandler({ action: 'pause' }, () => {
        if (callbacks.onPause) callbacks.onPause();
      });

      await MediaSession.setActionHandler({ action: 'nexttrack' }, () => {
        if (callbacks.onNext) callbacks.onNext();
      });

      await MediaSession.setActionHandler({ action: 'previoustrack' }, () => {
        if (callbacks.onPrevious) callbacks.onPrevious();
      });

      await MediaSession.setActionHandler({ action: 'seekto' }, (details) => {
        if (callbacks.onSeekTo && details && details.seekTime !== undefined && details.seekTime !== null) {
          callbacks.onSeekTo(details.seekTime);
        }
      });

      await MediaSession.setActionHandler({ action: 'seekforward' }, () => {
        if (callbacks.onSeekBy) callbacks.onSeekBy(10);
      });

      await MediaSession.setActionHandler({ action: 'seekbackward' }, () => {
        if (callbacks.onSeekBy) callbacks.onSeekBy(-10);
      });

      await MediaSession.setActionHandler({ action: 'stop' }, () => {
        if (callbacks.onStop) callbacks.onStop();
      });
    } catch (err) {
      console.warn('[NativeMediaBridge] Error setting action handlers:', err);
    }
  },

  updateHandlers(playerHandlers = {}) {
    callbacks = { ...callbacks, ...playerHandlers };
  },

  async setMetadata({ title, artist, album, thumbnail }) {
    if (!this.isSupported()) return;
    try {
      let artworkSrc = thumbnail || '';
      if (artworkSrc && !artworkSrc.startsWith('http') && typeof window !== 'undefined') {
        artworkSrc = window.location.origin + (artworkSrc.startsWith('/') ? '' : '/') + artworkSrc;
      }

      await MediaSession.setMetadata({
        title: title || 'Play LooP Track',
        artist: artist || 'Play LooP',
        album: album || 'Play LooP',
        artwork: artworkSrc ? [{ src: artworkSrc, sizes: '512x512', type: 'image/jpeg' }] : []
      });
    } catch (err) {
      console.warn('[NativeMediaBridge] Error setting metadata:', err);
    }
  },

  async setPlaybackState(state) {
    if (!this.isSupported()) return;
    try {
      const validState = state === 'playing' ? 'playing' : state === 'paused' ? 'paused' : 'none';
      await MediaSession.setPlaybackState({ playbackState: validState });
    } catch (err) {
      console.warn('[NativeMediaBridge] Error setting playback state:', err);
    }
  },

  async setPositionState({ duration, position, playbackRate = 1 }) {
    if (!this.isSupported()) return;
    const now = Date.now();
    // Throttle bridge position calls to once every 1000ms to maintain optimal performance
    if (now - lastPositionUpdate < 1000) return;
    lastPositionUpdate = now;

    try {
      if (duration && duration > 0 && position >= 0) {
        await MediaSession.setPositionState({
          duration: Math.round(duration),
          position: Math.round(position),
          playbackRate: Number(playbackRate) || 1
        });
      }
    } catch (_) {
      // Ignore rapid sync errors
    }
  }
};
