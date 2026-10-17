import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { fetchApi, getAudioUrl } from '../services/api.js';
import { fetchSyncedLyrics } from '../services/lyrics.js';
import { generateRecommendations } from '../services/recommendationEngine.js';
import { filterValidDurationTracks } from '../utils/durationUtils.js';

let hlsModulePromise = null;
const getHlsModule = () => {
  if (!hlsModulePromise) {
    hlsModulePromise = import('hls.js').then((m) => m.default || m);
  }
  return hlsModulePromise;
};

export { fetchApi, getAudioUrl };

const cleanTitle = (title) => {
  if (!title) return "";
  return title.toLowerCase()
    .replace(/\(official.*?\)/g, '')
    .replace(/\[official.*?\]/g, '')
    .replace(/\(lyric.*?\)/g, '')
    .replace(/\[lyric.*?\]/g, '')
    .replace(/\(music video\)/g, '')
    .replace(/\[music video\]/g, '')
    .replace(/\(audio\)/g, '')
    .replace(/\[audio\]/g, '')
    .replace(/ft\..*$/g, '')
    .replace(/feat\..*$/g, '')
    .replace(/\|.*$/g, '')
    .trim();
};

const PlayerContext = createContext();

export function usePlayer() {
  return useContext(PlayerContext);
}

export function PlayerProvider({ children }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [pendingTrack, setPendingTrack] = useState(null);
  const [currentTitle, setCurrentTitle] = useState("Select a song to start listening");
  const [playerStatus, setPlayerStatus] = useState("Nothing playing");
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trackQueue, setTrackQueue] = useState([]);
  const [recommendationQueue, setRecommendationQueue] = useState([]);
  const [isRefreshingUpNext, setIsRefreshingUpNext] = useState(false);
  const [trackHistory, setTrackHistory] = useState([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
  const [recentlyPlayed, setRecentlyPlayed] = useState(() => {
    try {
      const saved = localStorage.getItem("playloop_recently_played");
      const parsed = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed)) {
        // Drop old YouTube history to prevent playback crashes
        if (parsed.some(t => t.videoId && t.videoId.length === 11)) {
           localStorage.removeItem("playloop_recently_played");
           return [];
        }
        return parsed;
      }
      return [];
    } catch (e) {
      return [];
    }
  });

  const addToRecentlyPlayed = (trackObj) => {
    if (!trackObj || !trackObj.videoId) return;
    setRecentlyPlayed((prev) => {
      const currentList = Array.isArray(prev) ? prev : [];
      const filtered = currentList.filter((t) => t.videoId !== trackObj.videoId);
      const updated = [trackObj, ...filtered].slice(0, 20); // Cap at max 20
      try {
        localStorage.setItem("playloop_recently_played", JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save history", e);
      }
      return updated;
    });
  };
  
  const recentlyPlayedRef = useRef(recentlyPlayed);
  useEffect(() => {
    recentlyPlayedRef.current = recentlyPlayed;
  }, [recentlyPlayed]);

  const [isRepeatEnabled, setIsRepeatEnabled] = useState(false);
  const [isShuffleEnabled, setIsShuffleEnabled] = useState(false);
  const [upcomingTrack, setUpcomingTrack] = useState(null);
  
  const [stableShuffledQueue, setStableShuffledQueue] = useState([]);
  const stableShuffledQueueRef = useRef([]);

  useEffect(() => {
    const activeQueue = trackQueue.length > 0 ? trackQueue : recommendationQueue;
    if (isShuffleEnabled && activeQueue.length > 0) {
      const shuffled = [...activeQueue].sort(() => 0.5 - Math.random());
      setStableShuffledQueue(shuffled);
      stableShuffledQueueRef.current = shuffled;
    } else {
      setStableShuffledQueue([]);
      stableShuffledQueueRef.current = [];
    }
  }, [trackQueue, recommendationQueue, isShuffleEnabled]);

  const sessionSeenIdsRef = useRef(new Set());
  const sessionSeenTitlesRef = useRef(new Set());

  const markTrackSeen = (track) => {
    if (!track) return;
    if (track.videoId) sessionSeenIdsRef.current.add(track.videoId);
    if (track.title) {
      const cleanT = cleanTitle(track.title).replace(/[^a-z0-9]/g, "");
      if (cleanT) sessionSeenTitlesRef.current.add(cleanT);
    }
  };

  // ----- Deterministic 5‑track window -----
  const WINDOW_SIZE = 5;
  const CENTER_INDEX = 2; // current track sits at index 2
  const [trackWindow, setTrackWindow] = useState([]); // up to 5 track objects
  const [preloadedCovers, setPreloadedCovers] = useState({}); // videoId -> image src

  // Helper to fetch a random track from queues
  const fetchNextRandomTrack = useCallback(() => {
    if (trackQueue.length) {
      return trackQueue[Math.floor(Math.random() * trackQueue.length)];
    }
    if (recommendationQueue.length) {
      const next = recommendationQueue[0];
      setRecommendationQueue(q => q.slice(1));
      return next;
    }
    return null;
  }, [trackQueue, recommendationQueue]);

  // Helper to fetch a random previous track (prefer history)
  const fetchPrevRandomTrack = useCallback(() => {
    if (currentHistoryIndex > 0) {
      const prev = trackHistory[currentHistoryIndex - 1];
      setCurrentHistoryIndex(currentHistoryIndex - 1);
      return prev;
    }
    return fetchNextRandomTrack();
  }, [trackHistory, currentHistoryIndex, fetchNextRandomTrack]);

  // Preload cover images for neighbour tracks
  const preloadCoverImages = useCallback((windowArr) => {
    const ids = [];
    if (windowArr[1]) ids.push(windowArr[1].videoId);
    if (windowArr[3]) ids.push(windowArr[3].videoId);
    ids.forEach(id => {
      const track = windowArr.find(t => t && t.videoId === id);
      const rawSrc = track?.thumbnail;
      const src = (!rawSrc || rawSrc === '/logo.svg') ? '/default-cover.svg' : rawSrc;
      const img = new Image();
      img.onload = () => setPreloadedCovers(prev => ({ ...prev, [id]: src }));
      img.onerror = () => setPreloadedCovers(prev => ({ ...prev, [id]: '/default-cover.svg' }));
      img.src = src;
    });
  }, []);

  // Initialise the track window when the first pendingTrack arrives
  useEffect(() => {
    if (pendingTrack && trackWindow.length === 0) {
      if (!isShuffleEnabled && trackQueue.length > 0 && currentTrackIndex !== -1) {
        const getTrackSafe = (idx) => {
          let safeIdx = idx % trackQueue.length;
          if (safeIdx < 0) safeIdx += trackQueue.length;
          return trackQueue[safeIdx] || null;
        };
        const filled = [
          getTrackSafe(currentTrackIndex - 2),
          getTrackSafe(currentTrackIndex - 1),
          getTrackSafe(currentTrackIndex),
          getTrackSafe(currentTrackIndex + 1),
          getTrackSafe(currentTrackIndex + 2),
        ];
        setTrackWindow(filled);
        preloadCoverImages(filled);
      } else {
        const initial = [null, null, pendingTrack, null, null];
        const fill = (arr) => {
          const newArr = [...arr];
          for (let i = 0; i < newArr.length; i++) {
            if (!newArr[i]) {
              const random = fetchNextRandomTrack();
              if (random) newArr[i] = random;
            }
          }
          return newArr;
        };
        const filled = fill(initial);
        setTrackWindow(filled);
        preloadCoverImages(filled);
      }
    }
  }, [pendingTrack, trackWindow.length, fetchNextRandomTrack, preloadCoverImages, isShuffleEnabled, trackQueue, currentTrackIndex]);

  const [playerButtonStyle, setPlayerButtonStyleState] = useState(() => {
    try {
      return localStorage.getItem("playloop_button_style") || "white";
    } catch (e) {
      return "white";
    }
  });

  const setPlayerButtonStyle = (style) => {
    setPlayerButtonStyleState(style);
    try {
      localStorage.setItem("playloop_button_style", style);
    } catch (e) {
      console.error("Failed to save player button style", e);
    }
  };

  const audioPlayerA = useRef(new Audio());
  const audioPlayerB = useRef(new Audio());
  const hlsPlayerA = useRef(null);
  const hlsPlayerB = useRef(null);
  const activePlayerSlotRef = useRef('A'); // 'A' | 'B'
  const isCrossfadingRef = useRef(false);
  const crossfadeTimerRef = useRef(null);
  const hasCrossfadeTriggeredRef = useRef(false);

  const getActiveAudio = () => activePlayerSlotRef.current === 'A' ? audioPlayerA.current : audioPlayerB.current;
  const getInactiveAudio = () => activePlayerSlotRef.current === 'A' ? audioPlayerB.current : audioPlayerA.current;

  const destroyHls = useCallback((slot) => {
    const hlsRef = slot === 'A' ? hlsPlayerA : hlsPlayerB;
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch (e) {}
      hlsRef.current = null;
    }
  }, []);

  const loadAudioSource = useCallback((slot, videoId, audioEl) => {
    destroyHls(slot);
    const targetUrl = getAudioUrl(videoId);

    if (videoId && videoId.startsWith('sc:')) {
      if (audioEl.canPlayType('application/vnd.apple.mpegurl')) {
        audioEl.src = targetUrl;
      } else {
        getHlsModule().then(Hls => {
          if (Hls && Hls.isSupported()) {
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: true,
              backBufferLength: 90
            });
            hls.loadSource(targetUrl);
            hls.attachMedia(audioEl);
            if (slot === 'A') hlsPlayerA.current = hls;
            else hlsPlayerB.current = hls;
          } else {
            audioEl.src = targetUrl;
          }
        }).catch(() => {
          audioEl.src = targetUrl;
        });
      }
    } else {
      audioEl.src = targetUrl;
    }
  }, [destroyHls]);

  // Backward-compatible accessor for any callers expecting nativeAudioPlayer.current
  const nativeAudioPlayer = {
    get current() {
      return getActiveAudio();
    }
  };

  const [crossfadeDuration, setCrossfadeDurationState] = useState(() => {
    try {
      const saved = localStorage.getItem("playloop_crossfade");
      return saved !== null ? parseInt(saved, 10) : 0;
    } catch (e) {
      return 0;
    }
  });
  const crossfadeDurationRef = useRef(crossfadeDuration);
  useEffect(() => {
    crossfadeDurationRef.current = crossfadeDuration;
  }, [crossfadeDuration]);

  const setCrossfadeDuration = useCallback((seconds) => {
    const val = Math.max(0, Math.min(12, parseInt(seconds, 10) || 0));
    setCrossfadeDurationState(val);
    crossfadeDurationRef.current = val;
    try {
      localStorage.setItem("playloop_crossfade", String(val));
      window.dispatchEvent(new CustomEvent('playloop-crossfade-updated', { detail: val }));
    } catch (e) {}
  }, []);

  useEffect(() => {
    const handleCrossfadeSync = (e) => {
      const val = e.detail !== undefined ? Number(e.detail) : Number(localStorage.getItem('playloop_crossfade') || 0);
      setCrossfadeDurationState(val);
      crossfadeDurationRef.current = val;
    };
    window.addEventListener('playloop-crossfade-updated', handleCrossfadeSync);
    return () => window.removeEventListener('playloop-crossfade-updated', handleCrossfadeSync);
  }, []);

  const pendingTrackRef = useRef(null);
  const upcomingTrackRef = useRef(null);
  const shuffleCycleStartIndexRef = useRef(0);

  const [playbackSpeed, setPlaybackSpeedState] = useState(1);
  const playbackSpeedRef = useRef(1);

  const setPlaybackSpeed = useCallback((speed) => {
    playbackSpeedRef.current = speed;
    setPlaybackSpeedState(speed);
    [audioPlayerA.current, audioPlayerB.current].forEach(player => {
      if (player) {
        player.playbackRate = speed;
        player.defaultPlaybackRate = speed;
        if ('preservesPitch' in player) {
          player.preservesPitch = true;
        }
      }
    });
  }, []);

  const setUpcoming = (track) => {
    upcomingTrackRef.current = track;
    setUpcomingTrack(track);
  };

  const isRepeatEnabledRef = useRef(isRepeatEnabled);
  useEffect(() => {
    isRepeatEnabledRef.current = isRepeatEnabled;
  }, [isRepeatEnabled]);

  const hasRepeatedCurrentTrackRef = useRef(false);

  const trackHistoryRef = useRef(trackHistory);
  const currentHistoryIndexRef = useRef(currentHistoryIndex);
  const trackQueueRef = useRef(trackQueue);
  const currentTrackIndexRef = useRef(currentTrackIndex);
  const isShuffleEnabledRef = useRef(isShuffleEnabled);
  const recommendationQueueRef = useRef(recommendationQueue);

  useEffect(() => {
    trackHistoryRef.current = trackHistory;
    currentHistoryIndexRef.current = currentHistoryIndex;
    trackQueueRef.current = trackQueue;
    currentTrackIndexRef.current = currentTrackIndex;
    isShuffleEnabledRef.current = isShuffleEnabled;
    recommendationQueueRef.current = recommendationQueue;
  }, [trackHistory, currentHistoryIndex, trackQueue, currentTrackIndex, isShuffleEnabled, recommendationQueue]);

  useEffect(() => {
    pendingTrackRef.current = pendingTrack;
    hasRepeatedCurrentTrackRef.current = false;
  }, [pendingTrack]);
  
  const volumeRef = useRef(volume);
  const isMutedRef = useRef(isMuted);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const clearCrossfadeTimer = useCallback(() => {
    if (crossfadeTimerRef.current) {
      clearInterval(crossfadeTimerRef.current);
      crossfadeTimerRef.current = null;
    }
    isCrossfadingRef.current = false;
  }, []);

  const hasPrevious = trackQueue.length > 0 ? true : currentHistoryIndex > 0;
  const hasNext = pendingTrack !== null;

  const playNextTrackRef = useRef(null);
  const triggerAutoCrossfadeRef = useRef(null);

  useEffect(() => {
    const audioA = audioPlayerA.current;
    const audioB = audioPlayerB.current;
    audioA.preload = "auto";
    audioB.preload = "auto";
    
    // Register Browser Media Session API Action Handlers for Mobile Background Controls
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('play', () => {
          const active = getActiveAudio();
          if (active) {
            active.play().catch(console.error);
          }
          setIsPlaying(true);
          setPlayerStatus("Playing");
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          const active = getActiveAudio();
          if (active) {
            active.pause();
          }
          setIsPlaying(false);
          setPlayerStatus("Paused");
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => playPreviousTrack());
        navigator.mediaSession.setActionHandler('nexttrack', () => playNextTrackRef.current?.());
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          const active = getActiveAudio();
          if (details.seekTime !== undefined && active) {
            active.currentTime = details.seekTime;
          }
        });
        navigator.mediaSession.setActionHandler('seekforward', () => seekBy(10));
        navigator.mediaSession.setActionHandler('seekbackward', () => seekBy(-10));
      } catch (e) {
        console.warn("MediaSession handler error:", e);
      }
    }
    
    const createTimeUpdateHandler = (slot) => () => {
      if (activePlayerSlotRef.current !== slot) return;
      const currentAudio = slot === 'A' ? audioA : audioB;
      const curTime = currentAudio.currentTime || 0;
      const rawAudioDur = currentAudio.duration;
      const knownDur = pendingTrackRef.current?.duration;

      // Prioritize known duration for chunked/streaming tracks (like SoundCloud HLS)
      // where the browser audio element initially only sees the first chunk (~10s)
      let dur = 0;
      if (knownDur && knownDur > 0 && (!Number.isFinite(rawAudioDur) || rawAudioDur < knownDur - 3)) {
        dur = knownDur;
      } else if (Number.isFinite(rawAudioDur) && rawAudioDur > 0) {
        dur = rawAudioDur;
      }

      if (dur > 0) {
        setCurrentTime(curTime);
        setDuration(dur);
        setProgress((curTime / dur) * 100);

        if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
          try {
            navigator.mediaSession.setPositionState({
              duration: dur,
              playbackRate: currentAudio.playbackRate || 1,
              position: curTime
            });
          } catch (e) {}
        }

        // Check if auto-crossfade to next track should be triggered
        const fadeSec = crossfadeDurationRef.current;
        if (fadeSec > 0 && !hasCrossfadeTriggeredRef.current && !isRepeatEnabledRef.current && isPlayingRef.current) {
          const timeLeft = dur - curTime;
          if (timeLeft <= fadeSec && timeLeft > 0.4) {
            hasCrossfadeTriggeredRef.current = true;
            triggerAutoCrossfadeRef.current?.();
          }
        }
      }
    };

    const createEndedHandler = (slot) => () => {
      if (activePlayerSlotRef.current !== slot) return;

      if (isRepeatEnabledRef.current && !hasRepeatedCurrentTrackRef.current) {
        hasRepeatedCurrentTrackRef.current = true;
        const currentAudio = slot === 'A' ? audioA : audioB;
        currentAudio.currentTime = 0;
        currentAudio.play().catch(e => console.error(e));
        setIsRepeatEnabled(false);
      } else {
        playNextTrackRef.current?.();
      }
    };

    const createErrorHandler = (slot) => (e) => {
      if (activePlayerSlotRef.current !== slot) {
        // Silently ignore errors on inactive or cleaning-up audio
        return;
      }
      console.error(`[Audio Engine] Native audio playback error (slot ${slot}):`, e);
      setPlayerStatus("Playback failed");
      setIsPlaying(false);
      setTimeout(() => {
        if (pendingTrackRef.current) {
          console.log("[Audio Engine] Attempting background auto-recovery to next track...");
          playNextTrackRef.current?.();
        }
      }, 1500);
    };

    const timeUpdateA = createTimeUpdateHandler('A');
    const timeUpdateB = createTimeUpdateHandler('B');
    const endedA = createEndedHandler('A');
    const endedB = createEndedHandler('B');
    const errorA = createErrorHandler('A');
    const errorB = createErrorHandler('B');

    audioA.addEventListener('timeupdate', timeUpdateA);
    audioA.addEventListener('ended', endedA);
    audioA.addEventListener('error', errorA);

    audioB.addEventListener('timeupdate', timeUpdateB);
    audioB.addEventListener('ended', endedB);
    audioB.addEventListener('error', errorB);

    return () => {
      audioA.removeEventListener('timeupdate', timeUpdateA);
      audioA.removeEventListener('ended', endedA);
      audioA.removeEventListener('error', errorA);

      audioB.removeEventListener('timeupdate', timeUpdateB);
      audioB.removeEventListener('ended', endedB);
      audioB.removeEventListener('error', errorB);
    };
  }, []);

  const playPause = useCallback(() => {
    const activeAudio = getActiveAudio();
    const inactiveAudio = getInactiveAudio();
    if (isPlaying) {
      if (activeAudio) {
        activeAudio.pause();
      }
      if (isCrossfadingRef.current && inactiveAudio) {
        inactiveAudio.pause();
      }
      setIsPlaying(false);
      setPlayerStatus("Paused");
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = "paused";
      }
    } else {
      if (activeAudio) {
        activeAudio.play().catch(e => console.error(e));
      }
      if (isCrossfadingRef.current && inactiveAudio) {
        inactiveAudio.play().catch(e => console.error(e));
      }
      setIsPlaying(true);
      setPlayerStatus("Playing");
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = "playing";
      }
    }
  }, [isPlaying]);

  const stopAllPlayback = () => {
    clearCrossfadeTimer();
    hasCrossfadeTriggeredRef.current = false;
    destroyHls('A');
    destroyHls('B');
    try {
      if (audioPlayerA.current) {
        audioPlayerA.current.pause();
        audioPlayerA.current.currentTime = 0;
      }
    } catch (e) {}
    try {
      if (audioPlayerB.current) {
        audioPlayerB.current.pause();
        audioPlayerB.current.currentTime = 0;
      }
    } catch (e) {}
  };

  const applyMediaSessionMetadata = (title, artist, thumbnail, videoId) => {
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: title || "Play LooP Track",
          artist: artist || "Play LooP",
          album: "Play LooP",
          artwork: [
            { src: (!thumbnail || thumbnail === '/logo.svg') ? '/default-cover.svg' : thumbnail, sizes: "512x512", type: "image/jpeg" }
          ]
        });
        navigator.mediaSession.playbackState = "playing";
      } catch (e) {
        console.warn("MediaMetadata update error:", e);
      }
    }
  };

  const performCrossfadeToTrack = useCallback((trackObj, customFadeSec = null) => {
    if (!trackObj || !trackObj.videoId) return;

    let trackDuration = trackObj.duration;
    if (!trackDuration) {
      const foundInQueue = trackQueueRef.current?.find(t => t.videoId === trackObj.videoId) || 
                           recommendationQueueRef.current?.find(t => t.videoId === trackObj.videoId) ||
                           recentlyPlayedRef.current?.find(t => t.videoId === trackObj.videoId);
      if (foundInQueue?.duration) {
        trackDuration = foundInQueue.duration;
      }
    }
    const resolvedTrackObj = { ...trackObj, duration: trackDuration };

    const fadeSec = customFadeSec !== null ? customFadeSec : crossfadeDurationRef.current;
    const currentAudio = activePlayerSlotRef.current === 'A' ? audioPlayerA.current : audioPlayerB.current;
    const nextSlot = activePlayerSlotRef.current === 'A' ? 'B' : 'A';
    const nextAudio = nextSlot === 'A' ? audioPlayerA.current : audioPlayerB.current;

    clearCrossfadeTimer();

    // If current audio is not playing or paused or no track or fadeSec is 0, play standard
    if (fadeSec <= 0 || !currentAudio || (!currentAudio.src && !currentAudio.currentSrc) || currentAudio.paused) {
      selectAndPlayTrack(resolvedTrackObj.videoId, resolvedTrackObj.title, resolvedTrackObj.artist, resolvedTrackObj.thumbnail, false, true, trackDuration);
      return;
    }

    isCrossfadingRef.current = true;
    hasCrossfadeTriggeredRef.current = true;

    // Immediately update track info so mini player & metadata update seamlessly without disappearing
    setPendingTrack(resolvedTrackObj);
    pendingTrackRef.current = resolvedTrackObj;
    setCurrentTitle(resolvedTrackObj.title);
    if (trackDuration > 0) setDuration(trackDuration);
    setPlayerStatus("Playing");
    setIsPlaying(true);
    addToRecentlyPlayed(resolvedTrackObj);
    markTrackSeen(resolvedTrackObj);
    applyMediaSessionMetadata(resolvedTrackObj.title, resolvedTrackObj.artist, resolvedTrackObj.thumbnail, resolvedTrackObj.videoId);

    // If track is a SoundCloud track without duration, fetch duration in background
    if (resolvedTrackObj.videoId.startsWith('sc:') && !trackDuration) {
      fetchApi(`/api/song?id=${encodeURIComponent(resolvedTrackObj.videoId)}`)
        .then(r => r.ok ? r.json() : null)
        .then(songInfo => {
          if (songInfo?.duration && pendingTrackRef.current?.videoId === resolvedTrackObj.videoId) {
            setPendingTrack(prev => prev ? { ...prev, duration: songInfo.duration } : prev);
            pendingTrackRef.current = { ...pendingTrackRef.current, duration: songInfo.duration };
            setDuration(prev => (prev < songInfo.duration - 5 ? songInfo.duration : prev));
          }
        })
        .catch(() => {});
    }

    // Prepare next audio element
    loadAudioSource(nextSlot, trackObj.videoId, nextAudio);
    nextAudio.playbackRate = playbackSpeedRef.current;
    nextAudio.volume = 0; // Starts silent

    // Switch active slot to next audio so UI & controls point to the incoming track
    activePlayerSlotRef.current = nextSlot;

    nextAudio.play().then(() => {
      const startTime = performance.now();
      const durationMs = Math.max(800, fadeSec * 1000);

      crossfadeTimerRef.current = setInterval(() => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        const targetMasterVol = isMutedRef.current ? 0 : volumeRef.current;

        nextAudio.volume = Math.max(0, Math.min(1, progress * targetMasterVol));
        currentAudio.volume = Math.max(0, Math.min(1, (1 - progress) * targetMasterVol));

        if (progress >= 1) {
          clearCrossfadeTimer();
          try {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            destroyHls(activePlayerSlotRef.current === 'A' ? 'B' : 'A');
            currentAudio.removeAttribute('src');
            currentAudio.load();
          } catch (e) {}
          nextAudio.volume = isMutedRef.current ? 0 : volumeRef.current;
        }
      }, 50);
    }).catch(err => {
      console.warn("[Audio Engine] Next audio playback failed during crossfade:", err);
      clearCrossfadeTimer();
      selectAndPlayTrack(trackObj.videoId, trackObj.title, trackObj.artist, trackObj.thumbnail, false, true, trackDuration);
    });
  }, [clearCrossfadeTimer, destroyHls, loadAudioSource]);

  const handleTrackHistoryAndRecommendations = (trackObj, videoId, title, artist, thumbnail, isHistoryNavigation, isAutoPlay) => {
    if (!isHistoryNavigation) {
      const hIndex = currentHistoryIndexRef.current;
      const newHistory = trackHistoryRef.current.slice(0, hIndex + 1);
      const updatedHistory = [...newHistory, trackObj];
      
      trackHistoryRef.current = updatedHistory;
      currentHistoryIndexRef.current = hIndex + 1;
      
      setTrackHistory(updatedHistory);
      setCurrentHistoryIndex(hIndex + 1);
    }

    let clickedFromQueueIndex = recommendationQueueRef.current.findIndex(t => t.videoId === videoId);
    if (!isAutoPlay && !isHistoryNavigation && clickedFromQueueIndex !== -1 && trackQueueRef.current.length === 0) {
      isAutoPlay = true; 
    }

    if (isAutoPlay || isHistoryNavigation) {
      if (trackQueueRef.current.length === 0 && recommendationQueueRef.current.length > 0) {
        let sliceIdx = recommendationQueueRef.current.findIndex(t => t.videoId === videoId);
        if (sliceIdx !== -1) {
          const newQ = recommendationQueueRef.current.slice(sliceIdx + 1);
          recommendationQueueRef.current = newQ;
          setRecommendationQueue(newQ);
        }
      }

      if (recommendationQueueRef.current.length < 5) {
        refreshUpNext(true);
      }
      return;
    }

    // Hybrid Recommendations Engine for Queue (Executed immediately without background timer throttle)
    try {
      const excludeIds = Array.from(sessionSeenIdsRef.current).slice(-40).join(",");
      const excludeTitles = Array.from(sessionSeenTitlesRef.current).slice(-40).map(t => encodeURIComponent(t)).join("|");

      let userLanguages = "english,hindi";
      try {
        const stored = localStorage.getItem('preferred_languages');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            userLanguages = parsed.join(',');
          }
        }
      } catch(e) {}

      const queryParams = new URLSearchParams({
        id: videoId || "",
        artist: artist || "",
        title: title || "",
        excludeIds,
        excludeTitles,
        languages: userLanguages
      }).toString();

      fetchApi(`/api/recommendations?${queryParams}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          const validData = filterValidDurationTracks(data);
          if (validData.length > 0) {
            const currentPlayingTrack = { videoId, title, artist, thumbnail };
            const scoredRecs = generateRecommendations({
              currentTrack: currentPlayingTrack,
              candidatePool: validData,
              history: trackHistoryRef.current || [],
              likedSongs: [],
              seenIds: sessionSeenIdsRef.current,
              seenTitles: sessionSeenTitlesRef.current,
              limit: 10
            });

            if (scoredRecs.length > 0) {
              scoredRecs.forEach(markTrackSeen);
              recommendationQueueRef.current = scoredRecs;
              setRecommendationQueue(scoredRecs);

              const topNext = scoredRecs[0];
              if (topNext && topNext.videoId !== videoId) {
                setUpcoming(topNext);
              }
            }
          }
        })
        .catch((e) => console.error(e));
    } catch (e) {
      console.error(e);
    }
  };

  const selectAndPlayTrack = (videoId, title, artist, thumbnail, isHistoryNavigation = false, isAutoPlay = false, duration = null) => {
    let trackDuration = duration;
    if (!trackDuration) {
      const foundInQueue = trackQueueRef.current?.find(t => t.videoId === videoId) || 
                           recommendationQueueRef.current?.find(t => t.videoId === videoId) ||
                           recentlyPlayedRef.current?.find(t => t.videoId === videoId);
      if (foundInQueue?.duration) {
        trackDuration = foundInQueue.duration;
      }
    }
    const trackObj = { videoId, title, artist, thumbnail, duration: trackDuration };

    clearCrossfadeTimer();
    hasCrossfadeTriggeredRef.current = false;

    // Check if smooth transition crossfade should be used on manual track select
    const activeAudio = getActiveAudio();
    const isCurrentlyPlaying = isPlayingRef.current && activeAudio && !activeAudio.paused && (activeAudio.currentTime > 2);
    const isDifferentTrack = pendingTrackRef.current && pendingTrackRef.current.videoId !== videoId;

    if (crossfadeDurationRef.current > 0 && isCurrentlyPlaying && isDifferentTrack && !isHistoryNavigation) {
      const manualFadeSec = Math.min(crossfadeDurationRef.current, 2);
      performCrossfadeToTrack(trackObj, manualFadeSec);
      handleTrackHistoryAndRecommendations(trackObj, videoId, title, artist, thumbnail, isHistoryNavigation, isAutoPlay);
      return;
    }

    stopAllPlayback();

    setPendingTrack(trackObj);
    pendingTrackRef.current = trackObj;
    setUpcoming(null);
    setCurrentTitle(title);
    setPlayerStatus("Loading...");
    setProgress(0);
    setCurrentTime(0);
    if (trackDuration > 0) {
      setDuration(trackDuration);
    }

    // If track is a SoundCloud track without duration, fetch duration in background
    if (videoId.startsWith('sc:') && !trackDuration) {
      fetchApi(`/api/song?id=${encodeURIComponent(videoId)}`)
        .then(r => r.ok ? r.json() : null)
        .then(songInfo => {
          if (songInfo?.duration && pendingTrackRef.current?.videoId === videoId) {
            setPendingTrack(prev => prev ? { ...prev, duration: songInfo.duration } : prev);
            pendingTrackRef.current = { ...pendingTrackRef.current, duration: songInfo.duration };
            setDuration(prev => (prev < songInfo.duration - 5 ? songInfo.duration : prev));
          }
        })
        .catch(() => {});
    }

    addToRecentlyPlayed(trackObj);
    handleTrackHistoryAndRecommendations(trackObj, videoId, title, artist, thumbnail, isHistoryNavigation, isAutoPlay);

    applyMediaSessionMetadata(title, artist, thumbnail, videoId);

    // Playback using Active Native Audio with direct audio stream URL
    console.log(`[Audio Engine] Playing track (${title}) via audio stream...`);
    const audio = getActiveAudio();
    const currentSlot = activePlayerSlotRef.current;
    loadAudioSource(currentSlot, videoId, audio);
    audio.playbackRate = playbackSpeedRef.current;
    audio.volume = isMutedRef.current ? 0 : volumeRef.current;
    audio.play().then(() => {
      setIsPlaying(true);
      setPlayerStatus("Playing");
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = "playing";
      }
    }).catch(e => {
      console.warn("[Audio Engine] Play error / Autoplay restricted:", e);
      // If browser blocked autoplay before user interaction, unlock on first gesture
      const resumeOnGesture = () => {
        audio.play().then(() => {
          setIsPlaying(true);
          setPlayerStatus("Playing");
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = "playing";
          }
        }).catch(() => {});
        window.removeEventListener('pointerdown', resumeOnGesture);
        window.removeEventListener('keydown', resumeOnGesture);
      };
      window.addEventListener('pointerdown', resumeOnGesture, { once: true });
      window.addEventListener('keydown', resumeOnGesture, { once: true });
    });

    markTrackSeen(trackObj);
  };

  const refreshUpNext = useCallback(async (append = false) => {
    const currentTrack = pendingTrackRef.current;
    if (!currentTrack || !currentTrack.videoId) return;

    setIsRefreshingUpNext(true);

    try {
      const excludeIds = Array.from(sessionSeenIdsRef.current).slice(-40).join(",");
      const excludeTitles = Array.from(sessionSeenTitlesRef.current).slice(-40).map(t => encodeURIComponent(t)).join("|");

      let userLanguages = "english,hindi";
      try {
        const stored = localStorage.getItem('preferred_languages');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            userLanguages = parsed.join(',');
          }
        }
      } catch(e) {}

      const queryParams = new URLSearchParams({
        id: currentTrack.videoId || "",
        artist: currentTrack.artist || "",
        title: currentTrack.title || "",
        refresh: "true",
        t: Date.now().toString(),
        excludeIds,
        excludeTitles,
        languages: userLanguages
      }).toString();

      const res = await fetchApi(`/api/recommendations?${queryParams}`);
      let data = res.ok ? await res.json() : [];

      if (!Array.isArray(data) || data.length === 0) {
        const cleanArtist = currentTrack.artist ? currentTrack.artist.split(",")[0].split("ft.")[0].split("feat.")[0].trim() : "";
        const query = cleanArtist || "Top Hits";
        const searchRes = await fetchApi(`/api/search?q=${encodeURIComponent(query)}`);
        data = searchRes.ok ? await searchRes.json() : [];
      }

      const validData = filterValidDurationTracks(data);
      if (validData.length > 0) {
        const shuffledCandidates = [...validData].sort(() => 0.5 - Math.random());
        
        const scoredRecs = generateRecommendations({
          currentTrack: currentTrack,
          candidatePool: shuffledCandidates,
          history: trackHistoryRef.current || [],
          likedSongs: [],
          seenIds: sessionSeenIdsRef.current,
          seenTitles: sessionSeenTitlesRef.current,
          limit: 15
        });

        const freshQueue = scoredRecs.length > 2
          ? [scoredRecs[0], ...scoredRecs.slice(1).sort(() => 0.5 - Math.random())]
          : scoredRecs;

        if (freshQueue.length > 0) {
          freshQueue.forEach(markTrackSeen);
          
          const combinedQueue = append === true 
            ? [...recommendationQueueRef.current, ...freshQueue]
            : freshQueue;
            
          recommendationQueueRef.current = combinedQueue;
          setRecommendationQueue(combinedQueue);

          if (!append || recommendationQueueRef.current.length === freshQueue.length) {
            const topNext = freshQueue[0];
            if (topNext && topNext.videoId !== currentTrack.videoId) {
              setUpcoming(topNext);
            }
          }
        }
      }
    } catch (e) {
      console.error("[PlayerContext] refreshUpNext error:", e);
    } finally {
      setIsRefreshingUpNext(false);
    }
  }, []);

  const playPlaylist = (tracks, startIndex = 0) => {
    if (!Array.isArray(tracks) || tracks.length === 0) return;
    
    trackQueueRef.current = tracks;
    setTrackQueue(tracks);
    
    currentTrackIndexRef.current = startIndex;
    setCurrentTrackIndex(startIndex);
    
    shuffleCycleStartIndexRef.current = trackHistoryRef.current.length;
    
    const startTrack = tracks[startIndex];
    if (startTrack && startTrack.videoId) {
      selectAndPlayTrack(startTrack.videoId, startTrack.title, startTrack.artist, startTrack.thumbnail, false, false, startTrack.duration);
    }
  };

  const resolveNextTrack = useCallback((advanceTrackWindow = true) => {
    const tQueue = trackQueueRef.current;
    const isShuffle = isShuffleEnabledRef.current;
    const cTrackIndex = currentTrackIndexRef.current;
    const cHistoryIndex = currentHistoryIndexRef.current;
    const tHistory = trackHistoryRef.current;
    const rQueue = recommendationQueueRef.current;
    const currentTrack = pendingTrackRef.current;

    // 1. Deterministic navigation for playlist mode when shuffle is disabled
    if (!isShuffle && tQueue.length > 0) {
      const nextIndex = (cTrackIndex + 1) % tQueue.length;
      if (advanceTrackWindow) {
        currentTrackIndexRef.current = nextIndex;
        setCurrentTrackIndex(nextIndex);
        
        const getTrackSafe = (idx) => {
          let safeIdx = idx % tQueue.length;
          if (safeIdx < 0) safeIdx += tQueue.length;
          return tQueue[safeIdx] || null;
        };
        
        const newWindow = [
          getTrackSafe(nextIndex - 2),
          getTrackSafe(nextIndex - 1),
          getTrackSafe(nextIndex),
          getTrackSafe(nextIndex + 1),
          getTrackSafe(nextIndex + 2),
        ];
        
        setTrackWindow(newWindow);
        preloadCoverImages(newWindow);
      }
      const targetTrack = tQueue[nextIndex];
      return targetTrack ? { trackObj: targetTrack, isHistory: false, isAutoPlay: true } : null;
    }

    // 2. Check if we can go forward in history
    if (cHistoryIndex >= 0 && cHistoryIndex < tHistory.length - 1) {
      const newIndex = cHistoryIndex + 1;
      const nextTrack = tHistory[newIndex];
      if (advanceTrackWindow) {
        currentHistoryIndexRef.current = newIndex;
        setCurrentHistoryIndex(newIndex);
      }
      return nextTrack ? { trackObj: nextTrack, isHistory: true, isAutoPlay: false } : null;
    }

    // 3. Selection from Upcoming / Queue / Recommendation
    let nextTrackObj = upcomingTrackRef.current;

    if (!nextTrackObj || (currentTrack && nextTrackObj.videoId === currentTrack.videoId)) {
      if (tQueue.length > 0) {
        if (isShuffle) {
          let currentCycleHistory = tHistory.slice(shuffleCycleStartIndexRef.current);
          let candidates = stableShuffledQueueRef.current.filter((t) => 
            t.videoId !== currentTrack?.videoId &&
            !currentCycleHistory.some(ht => ht.videoId === t.videoId)
          );
          
          if (candidates.length === 0 && stableShuffledQueueRef.current.length > 0) {
            shuffleCycleStartIndexRef.current = tHistory.length;
            candidates = stableShuffledQueueRef.current.filter((t) => t.videoId !== currentTrack?.videoId);
          }
          
          if (candidates.length > 0) {
            nextTrackObj = candidates[0];
          } else {
            nextTrackObj = tQueue[Math.floor(Math.random() * tQueue.length)];
          }
        } else {
          const nextIndex = (cTrackIndex + 1) % tQueue.length;
          nextTrackObj = tQueue[nextIndex];
        }
      } else if (rQueue.length > 0) {
        const candidates = rQueue.filter((t) => 
          t.videoId !== currentTrack?.videoId &&
          !tHistory.some(ht => 
            ht.videoId === t.videoId || 
            (ht.title && t.title && cleanTitle(ht.title) === cleanTitle(t.title))
          )
        );
        const pool = candidates.length > 0 ? candidates : rQueue.filter((t) => t.videoId !== currentTrack?.videoId);
        const finalPool = pool.length > 0 ? pool : rQueue;
        
        nextTrackObj = isShuffle
          ? finalPool[Math.floor(Math.random() * finalPool.length)]
          : finalPool[0];
      }
    }

    // 4. Synchronous Recently Played Fallback if queue is exhausted
    if (!nextTrackObj || (currentTrack && nextTrackObj.videoId === currentTrack.videoId)) {
      const recentlyPlayedList = Array.isArray(recentlyPlayedRef.current) ? recentlyPlayedRef.current : [];
      const validRecent = recentlyPlayedList.filter(t => t && t.videoId && t.videoId !== currentTrack?.videoId);
      if (validRecent.length > 0) {
        nextTrackObj = validRecent[Math.floor(Math.random() * validRecent.length)];
      }
    }

    if (nextTrackObj && tQueue.length > 0 && advanceTrackWindow) {
      const idx = tQueue.findIndex((t) => t.videoId === nextTrackObj.videoId);
      if (idx !== -1) {
        currentTrackIndexRef.current = idx;
        setCurrentTrackIndex(idx);
      }
    }

    return nextTrackObj ? { trackObj: nextTrackObj, isHistory: false, isAutoPlay: true } : null;
  }, [preloadCoverImages]);

  const triggerAutoCrossfade = useCallback(() => {
    const next = resolveNextTrack(true);
    if (next && next.trackObj && next.trackObj.videoId) {
      console.log(`[Audio Engine] Starting end-of-track auto-crossfade to: ${next.trackObj.title} (${crossfadeDurationRef.current}s)`);
      performCrossfadeToTrack(next.trackObj, crossfadeDurationRef.current);
    }
  }, [resolveNextTrack, performCrossfadeToTrack]);

  useEffect(() => {
    triggerAutoCrossfadeRef.current = triggerAutoCrossfade;
  }, [triggerAutoCrossfade]);

  const playNextTrack = useCallback(() => {
    const next = resolveNextTrack(true);
    if (next && next.trackObj && next.trackObj.videoId) {
      const activeAudio = getActiveAudio();
      const isCurrentlyPlaying = isPlayingRef.current && activeAudio && !activeAudio.paused;
      const fadeSec = crossfadeDurationRef.current;

      if (fadeSec > 0 && isCurrentlyPlaying) {
        performCrossfadeToTrack(next.trackObj, Math.min(fadeSec, 2));
      } else {
        selectAndPlayTrack(next.trackObj.videoId, next.trackObj.title, next.trackObj.artist, next.trackObj.thumbnail, next.isHistory, next.isAutoPlay, next.trackObj.duration);
      }
    }
  }, [resolveNextTrack, performCrossfadeToTrack]);

  useEffect(() => {
    playNextTrackRef.current = playNextTrack;
  }, [playNextTrack]);

  const playPreviousTrack = useCallback(() => {
    clearCrossfadeTimer();
    const tQueue = trackQueueRef.current;
    const isShuffle = isShuffleEnabledRef.current;
    const cTrackIndex = currentTrackIndexRef.current;
    const cHistoryIndex = currentHistoryIndexRef.current;
    const tHistory = trackHistoryRef.current;

    if (!isShuffle && tQueue.length > 0) {
      let prevIndex = (cTrackIndex - 1) % tQueue.length;
      if (prevIndex < 0) prevIndex += tQueue.length;
      
      currentTrackIndexRef.current = prevIndex;
      setCurrentTrackIndex(prevIndex);
      
      const getTrackSafe = (idx) => {
        let safeIdx = idx % tQueue.length;
        if (safeIdx < 0) safeIdx += tQueue.length;
        return tQueue[safeIdx] || null;
      };
      
      const newWindow = [
        getTrackSafe(prevIndex - 2),
        getTrackSafe(prevIndex - 1),
        getTrackSafe(prevIndex),
        getTrackSafe(prevIndex + 1),
        getTrackSafe(prevIndex + 2),
      ];
      
      setTrackWindow(newWindow);
      const newCurrent = newWindow[CENTER_INDEX];
      if (newCurrent) {
        selectAndPlayTrack(newCurrent.videoId, newCurrent.title, newCurrent.artist, newCurrent.thumbnail, true, false, newCurrent.duration);
      }
      preloadCoverImages(newWindow);
      return;
    }
    // Fallback to history navigation for shuffle or random mode
    if (cHistoryIndex > 0) {
      const newIndex = cHistoryIndex - 1;
      const previousTrack = tHistory[newIndex];
      
      currentHistoryIndexRef.current = newIndex;
      setCurrentHistoryIndex(newIndex);
      
      selectAndPlayTrack(previousTrack.videoId, previousTrack.title, previousTrack.artist, previousTrack.thumbnail, true, false, previousTrack.duration);
    }
  }, [clearCrossfadeTimer, preloadCoverImages]);

  // Auto-Pre-Download & Pre-buffer Next Track in Queue/Recommendations for Instant 0-Latency Transition
  useEffect(() => {
    if (!pendingTrack?.videoId) return;

    let nextTrackObj = null;

    if (currentHistoryIndex >= 0 && currentHistoryIndex < trackHistory.length - 1) {
      nextTrackObj = trackHistory[currentHistoryIndex + 1];
    } else {
      if (trackQueue.length > 0) {
        if (isShuffleEnabled) {
          let currentCycleHistory = trackHistory.slice(shuffleCycleStartIndexRef.current);
          let candidates = stableShuffledQueueRef.current.filter((t) => 
            t.videoId !== pendingTrack.videoId && 
            !currentCycleHistory.some(ht => ht.videoId === t.videoId)
          );
          
          if (candidates.length === 0 && stableShuffledQueueRef.current.length > 0) {
            shuffleCycleStartIndexRef.current = trackHistory.length;
            candidates = stableShuffledQueueRef.current.filter((t) => t.videoId !== pendingTrack.videoId);
          }
          
          if (candidates.length > 0) {
            nextTrackObj = candidates[0];
          } else {
            nextTrackObj = trackQueue[Math.floor(Math.random() * trackQueue.length)];
          }
        } else {
          const nextIndex = (currentTrackIndex + 1) % trackQueue.length;
          nextTrackObj = trackQueue[nextIndex];
        }
      } else if (recommendationQueue.length > 0) {
        const candidates = recommendationQueue.filter((t) => 
          t.videoId !== pendingTrack.videoId && 
          !trackHistory.some(ht => 
            ht.videoId === t.videoId || 
            (ht.title && t.title && cleanTitle(ht.title) === cleanTitle(t.title))
          )
        );
        const pool = candidates.length > 0 ? candidates : recommendationQueue.filter((t) => t.videoId !== pendingTrack.videoId);
        const finalPool = pool.length > 0 ? pool : recommendationQueue;
        nextTrackObj = isShuffleEnabled && stableShuffledQueueRef.current.length > 0
          ? stableShuffledQueueRef.current.find(t => 
              t.videoId !== pendingTrack.videoId && 
              !trackHistory.some(ht => ht.videoId === t.videoId || (ht.title && t.title && cleanTitle(ht.title) === cleanTitle(t.title)))
            ) || finalPool[0]
          : finalPool[0];
      }
    }

    setUpcoming(nextTrackObj);
  }, [pendingTrack, currentTrackIndex, trackQueue, recommendationQueue, isShuffleEnabled]);

  const seekBy = (seconds) => {
    const active = getActiveAudio();
    if (active) {
      const cTime = active.currentTime || currentTime || 0;
      const audioDuration = (Number.isFinite(duration) && duration > 0) 
        ? duration 
        : (active.duration || 3600);
      const newTime = Math.max(0, Math.min(audioDuration, cTime + seconds));
      active.currentTime = newTime;
      setCurrentTime(newTime);
      if (audioDuration > 0) {
        setProgress((newTime / audioDuration) * 100);
      }
      if (audioDuration - newTime > (crossfadeDurationRef.current || 0) + 2) {
        hasCrossfadeTriggeredRef.current = false;
      }
    }
  };
  
  const seekToPercent = (percent) => {
    const numericPercent = parseFloat(percent);
    if (isNaN(numericPercent) || !Number.isFinite(duration) || duration <= 0) return;
    const newTime = (numericPercent / 100) * duration;
    const active = getActiveAudio();
    if (active) {
      active.currentTime = newTime;
      setCurrentTime(newTime);
      setProgress(numericPercent);
      if (duration - newTime > (crossfadeDurationRef.current || 0) + 2) {
        hasCrossfadeTriggeredRef.current = false;
      }
    }
  };

  const seekToTime = (timeInSeconds) => {
    const targetTime = Math.max(0, Math.min(duration || 3600, timeInSeconds));
    const active = getActiveAudio();
    if (active) {
      active.currentTime = targetTime;
      setCurrentTime(targetTime);
      if (duration > 0) setProgress((targetTime / duration) * 100);
      if (duration - targetTime > (crossfadeDurationRef.current || 0) + 2) {
        hasCrossfadeTriggeredRef.current = false;
      }
    }
  };

  const setVolume = useCallback((val) => {
    setVolumeState(prevVol => {
      const newVol = typeof val === 'function' ? val(prevVol) : val;
      const clamped = Math.max(0, Math.min(1, newVol));
      volumeRef.current = clamped;
      const effectiveVol = isMutedRef.current ? 0 : clamped;
      if (!isCrossfadingRef.current) {
        const active = getActiveAudio();
        if (active) active.volume = effectiveVol;
      }
      return clamped;
    });
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prevMuted => {
      const nextMuted = !prevMuted;
      isMutedRef.current = nextMuted;
      const effectiveVol = nextMuted ? 0 : volumeRef.current;
      if (!isCrossfadingRef.current) {
        const active = getActiveAudio();
        if (active) active.volume = effectiveVol;
      }
      return nextMuted;
    });
  }, []);

  // Global Keyboard Controls for Player
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const active = document.activeElement;
      if (
        active && (
          active.tagName === 'INPUT' || 
          active.tagName === 'TEXTAREA' || 
          active.isContentEditable ||
          active.getAttribute('role') === 'textbox' ||
          active.getAttribute('role') === 'searchbox'
        )
      ) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          playPause();
          break;

        case 'ArrowLeft':
          e.preventDefault();
          playPreviousTrack();
          break;

        case 'ArrowRight':
          e.preventDefault();
          playNextTrack();
          break;

        case 'ArrowUp':
          e.preventDefault();
          setVolume(v => Math.min(1, Math.round((v + 0.05) * 100) / 100));
          break;

        case 'ArrowDown':
          e.preventDefault();
          setVolume(v => Math.max(0, Math.round((v - 0.05) * 100) / 100));
          break;

        case 'KeyF':
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('playloop-toggle-full-player'));
          break;

        case 'KeyL':
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('playloop-toggle-lyrics'));
          break;

        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;

        case 'KeyN':
          e.preventDefault();
          playNextTrack();
          break;

        case 'KeyP':
          e.preventDefault();
          playPreviousTrack();
          break;

        case 'KeyR':
          e.preventDefault();
          setIsRepeatEnabled(prev => !prev);
          break;

        case 'KeyS':
          e.preventDefault();
          setIsShuffleEnabled(prev => !prev);
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [playPause, playNextTrack, playPreviousTrack, seekBy, setVolume, toggleMute]);

  const [lyricsData, setLyricsData] = useState(null);
  const [isLyricsLoading, setIsLyricsLoading] = useState(false);
  const lastFetchedLyricsRef = useRef({ videoId: null, duration: 0 });

  const roundedDuration = Math.round(pendingTrack?.duration || duration || 0);

  useEffect(() => {
    if (!pendingTrack?.title) {
      setLyricsData(null);
      setIsLyricsLoading(false);
      lastFetchedLyricsRef.current = { videoId: null, duration: 0 };
      return;
    }

    const trackId = pendingTrack.videoId || pendingTrack.title;

    // Skip refetch if already fetched with valid positive duration for this track
    if (
      lastFetchedLyricsRef.current.videoId === trackId &&
      lastFetchedLyricsRef.current.duration > 0
    ) {
      return;
    }

    setIsLyricsLoading(true);
    setLyricsData(null);
    lastFetchedLyricsRef.current = { videoId: trackId, duration: roundedDuration };

    fetchSyncedLyrics(
      pendingTrack.title,
      pendingTrack.artist || pendingTrack.channelTitle || '',
      roundedDuration
    )
      .then((data) => {
        if (lastFetchedLyricsRef.current.videoId === trackId) {
          setLyricsData(data);
          setIsLyricsLoading(false);
        }
      })
      .catch((err) => {
        console.warn('Lyrics fetch failed:', err);
        if (lastFetchedLyricsRef.current.videoId === trackId) {
          setLyricsData(null);
          setIsLyricsLoading(false);
        }
      });
  }, [pendingTrack?.videoId, pendingTrack?.title, roundedDuration]);

  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);

  const value = {
    isPlaying,
    playPause,
    pendingTrack,
    currentTitle,
    playerStatus,
    progress,
    currentTime,
    duration,
    trackQueue,
    setTrackQueue,
    recentlyPlayed,
    selectAndPlayTrack,
    playPlaylist,
    playNextTrack,
    playPreviousTrack,
    seekBy,
    seekToPercent,
    seekToTime,
    lyricsData,
    isLyricsLoading,
    isRepeatEnabled,
    setIsRepeatEnabled,
    isShuffleEnabled,
    setIsShuffleEnabled,
    hasPrevious,
    hasNext,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    playerButtonStyle,
    setPlayerButtonStyle,
    isRightSidebarOpen,
    setIsRightSidebarOpen,
    upcomingTrack,
    recommendationQueue,
    isRefreshingUpNext,
    refreshUpNext,
    stableShuffledQueue,
    trackHistory,
    shuffleCycleStartIndex: shuffleCycleStartIndexRef.current,
    playbackSpeed,
    setPlaybackSpeed,
    crossfadeDuration,
    setCrossfadeDuration
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
}
