import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { fetchApi, getAudioUrl } from '../services/api.js';
import { fetchSyncedLyrics } from '../services/lyrics.js';
import { generateRecommendations } from '../services/recommendationEngine.js';

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
      const src = track?.thumbnail || '/logo.svg';
      const img = new Image();
      img.onload = () => setPreloadedCovers(prev => ({ ...prev, [id]: src }));
      img.onerror = () => setPreloadedCovers(prev => ({ ...prev, [id]: '/logo.svg' }));
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

  const nativeAudioPlayer = useRef(new Audio());
  const upcomingAudioPlayer = useRef(new Audio());
  const pendingTrackRef = useRef(null);
  const upcomingTrackRef = useRef(null);
  const shuffleCycleStartIndexRef = useRef(0);

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
  
  const hasPrevious = trackQueue.length > 0 ? true : currentHistoryIndex > 0;
  const hasNext = pendingTrack !== null;

  useEffect(() => {
    nativeAudioPlayer.current.preload = "auto";
    upcomingAudioPlayer.current.preload = "auto";
    
    // Register Browser Media Session API Action Handlers for Mobile Background Controls
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('play', () => {
          if (nativeAudioPlayer.current) {
            nativeAudioPlayer.current.play().catch(console.error);
          }
          setIsPlaying(true);
          setPlayerStatus("Playing");
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          if (nativeAudioPlayer.current) {
            nativeAudioPlayer.current.pause();
          }
          setIsPlaying(false);
          setPlayerStatus("Paused");
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => playPreviousTrack());
        navigator.mediaSession.setActionHandler('nexttrack', () => playNextTrack());
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime !== undefined && nativeAudioPlayer.current) {
            nativeAudioPlayer.current.currentTime = details.seekTime;
          }
        });
        navigator.mediaSession.setActionHandler('seekforward', () => seekBy(10));
        navigator.mediaSession.setActionHandler('seekbackward', () => seekBy(-10));
      } catch (e) {
        console.warn("MediaSession handler error:", e);
      }
    }
    
    const handleTimeUpdate = () => {
      if (Number.isFinite(nativeAudioPlayer.current.duration) && nativeAudioPlayer.current.duration > 0) {
        setCurrentTime(nativeAudioPlayer.current.currentTime);
        setDuration(nativeAudioPlayer.current.duration);
        setProgress((nativeAudioPlayer.current.currentTime / nativeAudioPlayer.current.duration) * 100);

        if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
          try {
            navigator.mediaSession.setPositionState({
              duration: nativeAudioPlayer.current.duration,
              playbackRate: nativeAudioPlayer.current.playbackRate || 1,
              position: nativeAudioPlayer.current.currentTime
            });
          } catch (e) {}
        }
      }
    };

    const handleEnded = () => {
      if (isRepeatEnabledRef.current && !hasRepeatedCurrentTrackRef.current) {
        hasRepeatedCurrentTrackRef.current = true;
        nativeAudioPlayer.current.currentTime = 0;
        nativeAudioPlayer.current.play().catch(e => console.error(e));
        setIsRepeatEnabled(false);
      } else {
        playNextTrack();
      }
    };

    const handleError = (e) => {
      console.error("[Audio Engine] Native audio playback error:", e);
      setPlayerStatus("Playback failed");
      setIsPlaying(false);
    };
    
    const nativeAudio = nativeAudioPlayer.current;
    const upcomingAudio = upcomingAudioPlayer.current;

    nativeAudio.addEventListener('timeupdate', handleTimeUpdate);
    nativeAudio.addEventListener('ended', handleEnded);
    nativeAudio.addEventListener('error', handleError);

    upcomingAudio.addEventListener('timeupdate', handleTimeUpdate);
    upcomingAudio.addEventListener('ended', handleEnded);
    upcomingAudio.addEventListener('error', handleError);

    return () => {
      nativeAudio.removeEventListener('timeupdate', handleTimeUpdate);
      nativeAudio.removeEventListener('ended', handleEnded);
      nativeAudio.removeEventListener('error', handleError);
      upcomingAudio.removeEventListener('timeupdate', handleTimeUpdate);
      upcomingAudio.removeEventListener('ended', handleEnded);
      upcomingAudio.removeEventListener('error', handleError);
    };
  }, []);

  const playPause = useCallback(() => {
    if (isPlaying) {
      if (nativeAudioPlayer.current) {
        nativeAudioPlayer.current.pause();
      }
      setIsPlaying(false);
      setPlayerStatus("Paused");
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = "paused";
      }
    } else {
      if (nativeAudioPlayer.current) {
        nativeAudioPlayer.current.play().catch(e => console.error(e));
      }
      setIsPlaying(true);
      setPlayerStatus("Playing");
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = "playing";
      }
    }
  }, [isPlaying]);

  const stopAllPlayback = () => {
    try {
      if (nativeAudioPlayer.current) {
        nativeAudioPlayer.current.pause();
        nativeAudioPlayer.current.currentTime = 0;
        nativeAudioPlayer.current.src = "";
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
            { src: thumbnail || '/logo.svg', sizes: "512x512", type: "image/jpeg" }
          ]
        });
        navigator.mediaSession.playbackState = "playing";
      } catch (e) {
        console.warn("MediaMetadata update error:", e);
      }
    }
  };

  const selectAndPlayTrack = (videoId, title, artist, thumbnail, isHistoryNavigation = false) => {
    const trackObj = { videoId, title, artist, thumbnail };

    stopAllPlayback();

    setPendingTrack(trackObj);
    pendingTrackRef.current = trackObj;
    setUpcoming(null);
    setCurrentTitle(title);
    setPlayerStatus("Loading...");
    setProgress(0);
    setCurrentTime(0);

    addToRecentlyPlayed(trackObj);

    if (!isHistoryNavigation) {
      const hIndex = currentHistoryIndexRef.current;
      const newHistory = trackHistoryRef.current.slice(0, hIndex + 1);
      const updatedHistory = [...newHistory, trackObj];
      
      trackHistoryRef.current = updatedHistory;
      currentHistoryIndexRef.current = hIndex + 1;
      
      setTrackHistory(updatedHistory);
      setCurrentHistoryIndex(hIndex + 1);
    }

    applyMediaSessionMetadata(title, artist, thumbnail, videoId);

    // Playback using Native Audio with direct JioSaavn URL
    console.log(`[Audio Engine] Playing track (${title}) via native audio stream...`);
    const targetUrl = getAudioUrl(videoId);
    nativeAudioPlayer.current.src = targetUrl;
    nativeAudioPlayer.current.load();
    nativeAudioPlayer.current.play().then(() => {
      setIsPlaying(true);
      setPlayerStatus("Playing");
    }).catch(console.error);

    // Hybrid Recommendations Engine for Queue
    setTimeout(() => {
      try {
        const queryParams = new URLSearchParams({
          id: videoId || "",
          artist: artist || "",
          title: title || ""
        }).toString();

        fetchApi(`/api/recommendations?${queryParams}`)
          .then((res) => (res.ok ? res.json() : []))
          .then((data) => {
            if (Array.isArray(data) && data.length > 0) {
              const currentPlayingTrack = { videoId, title, artist, thumbnail };
              const scoredRecs = generateRecommendations({
                currentTrack: currentPlayingTrack,
                candidatePool: data,
                history: trackHistoryRef.current || [],
                likedSongs: [],
                limit: 10
              });

              if (scoredRecs.length > 0) {
                recommendationQueueRef.current = scoredRecs;
                setRecommendationQueue(scoredRecs);

                // Immediately sync top recommended track to upcoming
                const topNext = scoredRecs[0];
                if (topNext && topNext.videoId !== videoId) {
                  setUpcoming(topNext);
                  if (upcomingAudioPlayer.current) {
                    upcomingAudioPlayer.current.preload = "auto";
                    upcomingAudioPlayer.current.src = getAudioUrl(topNext.videoId);
                    upcomingAudioPlayer.current.load();
                  }
                }
              }
            }
          })
          .catch((e) => console.error(e));
      } catch (e) {
        console.error(e);
      }
    }, 300);
  };

  const playPlaylist = (tracks, startIndex = 0) => {
    if (!Array.isArray(tracks) || tracks.length === 0) return;
    
    trackQueueRef.current = tracks;
    setTrackQueue(tracks);
    
    currentTrackIndexRef.current = startIndex;
    setCurrentTrackIndex(startIndex);
    
    shuffleCycleStartIndexRef.current = trackHistoryRef.current.length;
    
    const startTrack = tracks[startIndex];
    if (startTrack && startTrack.videoId) {
      selectAndPlayTrack(startTrack.videoId, startTrack.title, startTrack.artist, startTrack.thumbnail);
    }
  };

  const playNextTrack = useCallback(async () => {
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
      const newCurrent = newWindow[CENTER_INDEX];
      if (newCurrent) {
        selectAndPlayTrack(newCurrent.videoId, newCurrent.title, newCurrent.artist, newCurrent.thumbnail);
      }
      preloadCoverImages(newWindow);
      return;
    }

    // 2. Check if we can go forward in history
    if (cHistoryIndex >= 0 && cHistoryIndex < tHistory.length - 1) {
      const newIndex = cHistoryIndex + 1;
      const nextTrack = tHistory[newIndex];
      
      currentHistoryIndexRef.current = newIndex;
      setCurrentHistoryIndex(newIndex);
      
      selectAndPlayTrack(nextTrack.videoId, nextTrack.title, nextTrack.artist, nextTrack.thumbnail, true);
      return;
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

    // 4. Instant Search Fallback if no queue item is available yet
    if (!nextTrackObj || (currentTrack && nextTrackObj.videoId === currentTrack.videoId)) {
      console.warn("[PlayerContext] Next button clicked with empty queue - fetching instant search fallback...");
      try {
        let cleanArtist = "";
        if (currentTrack?.artist) {
          cleanArtist = currentTrack.artist.split(",")[0].split("ft.")[0].split("feat.")[0].trim();
        }
        const query = cleanArtist ? `${cleanArtist}` : "Top Hits";
        
        let res = await fetchApi(`/api/search?q=${encodeURIComponent(query)}`);
        let results = res.ok ? await res.json() : [];
        
        let fallbackTrack = Array.isArray(results) ? results.find(t => 
          t.videoId !== currentTrack?.videoId &&
          (!currentTrack || cleanTitle(t.title) !== cleanTitle(currentTrack.title))
        ) : null;

        if (!fallbackTrack) {
          // If no different track found, try a generic Top Hits query
          res = await fetchApi(`/api/search?q=Top Hits`);
          results = res.ok ? await res.json() : [];
          fallbackTrack = Array.isArray(results) ? results.find(t => 
            t.videoId !== currentTrack?.videoId &&
            (!currentTrack || cleanTitle(t.title) !== cleanTitle(currentTrack.title))
          ) : null;
        }

        if (fallbackTrack) {
          nextTrackObj = fallbackTrack;
        } else if (results.length > 0) {
          nextTrackObj = results[0];
        }
      } catch (e) {
        console.error("[PlayerContext] Fallback next track error:", e);
      }
    }

    if (nextTrackObj && tQueue.length > 0) {
      const idx = tQueue.findIndex((t) => t.videoId === nextTrackObj.videoId);
      if (idx !== -1) {
        currentTrackIndexRef.current = idx;
        setCurrentTrackIndex(idx);
      }
    }

    if (nextTrackObj && nextTrackObj.videoId) {
      selectAndPlayTrack(nextTrackObj.videoId, nextTrackObj.title, nextTrackObj.artist, nextTrackObj.thumbnail);
    }
  }, [fetchNextRandomTrack, preloadCoverImages, setPendingTrack, setTrackWindow, trackWindow]);

  const playPreviousTrack = useCallback(() => {
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
        selectAndPlayTrack(newCurrent.videoId, newCurrent.title, newCurrent.artist, newCurrent.thumbnail, true);
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
      
      selectAndPlayTrack(previousTrack.videoId, previousTrack.title, previousTrack.artist, previousTrack.thumbnail, true);
    }
  }, [preloadCoverImages, setTrackWindow]);

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

    if (nextTrackObj?.videoId && nextTrackObj.videoId !== pendingTrack.videoId) {
      console.log(`[Audio Engine] Auto pre-buffering next track (${nextTrackObj.title || nextTrackObj.videoId})...`);
      // Client browser audio pre-buffer
      if (upcomingAudioPlayer.current) {
        upcomingAudioPlayer.current.preload = "auto";
        upcomingAudioPlayer.current.src = getAudioUrl(nextTrackObj.videoId);
        upcomingAudioPlayer.current.load();
      }
    }
  }, [pendingTrack, currentTrackIndex, trackQueue, recommendationQueue, isShuffleEnabled]);

  const seekBy = (seconds) => {
    if (!Number.isFinite(duration) || duration <= 0) return;
    if (nativeAudioPlayer.current) {
      const cTime = nativeAudioPlayer.current.currentTime || currentTime;
      const newTime = Math.max(0, Math.min(duration, cTime + seconds));
      nativeAudioPlayer.current.currentTime = newTime;
      setCurrentTime(newTime);
      setProgress((newTime / duration) * 100);
    }
  };
  
  const seekToPercent = (percent) => {
    const numericPercent = parseFloat(percent);
    if (isNaN(numericPercent) || !Number.isFinite(duration) || duration <= 0) return;
    const newTime = (numericPercent / 100) * duration;
    
    if (nativeAudioPlayer.current) {
      nativeAudioPlayer.current.currentTime = newTime;
      setCurrentTime(newTime);
      setProgress(numericPercent);
    }
  };

  const seekToTime = (timeInSeconds) => {
    const targetTime = Math.max(0, Math.min(duration || 3600, timeInSeconds));
    if (nativeAudioPlayer.current) {
      nativeAudioPlayer.current.currentTime = targetTime;
      setCurrentTime(targetTime);
      if (duration > 0) setProgress((targetTime / duration) * 100);
    }
  };

  const setVolume = useCallback((val) => {
    setVolumeState(prevVol => {
      const newVol = typeof val === 'function' ? val(prevVol) : val;
      const clamped = Math.max(0, Math.min(1, newVol));
      if (nativeAudioPlayer.current) {
        nativeAudioPlayer.current.volume = isMuted ? 0 : clamped;
      }
      return clamped;
    });
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted(prevMuted => {
      const nextMuted = !prevMuted;
      if (nativeAudioPlayer.current) {
        nativeAudioPlayer.current.volume = nextMuted ? 0 : volume;
      }
      return nextMuted;
    });
  }, [volume]);

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
    stableShuffledQueue,
    trackHistory,
    shuffleCycleStartIndex: shuffleCycleStartIndexRef.current
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
}
