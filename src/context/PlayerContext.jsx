import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { fetchApi, getAudioUrl } from '../services/api.js';

export { fetchApi, getAudioUrl };

const PlayerContext = createContext();

export function usePlayer() {
  return useContext(PlayerContext);
}

export function PlayerProvider({ children }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [pendingTrack, setPendingTrack] = useState(null);
  const [currentTitle, setCurrentTitle] = useState("Select a song to start listening");
  const [playerStatus, setPlayerStatus] = useState("Nothing playing");
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trackQueue, setTrackQueue] = useState([]);
  const [recommendationQueue, setRecommendationQueue] = useState([]);
  const [trackHistory, setTrackHistory] = useState([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
  const [recentlyPlayed, setRecentlyPlayed] = useState(() => {
    try {
      const saved = localStorage.getItem("playloop_recently_played");
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
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

  const nativeAudioPlayer = useRef(new Audio());
  const upcomingAudioPlayer = useRef(new Audio());
  const youtubePlayer = useRef(null);
  const currentActiveEngine = useRef("native");
  const pendingTrackRef = useRef(null);
  const upcomingTrackRef = useRef(null);

  const setUpcoming = (track) => {
    upcomingTrackRef.current = track;
    setUpcomingTrack(track);
  };

  useEffect(() => {
    pendingTrackRef.current = pendingTrack;
  }, [pendingTrack]);
  
  // Basic states for button disabling
  const hasPrevious = trackHistory.length > 1;
  const hasNext = trackQueue.length > 0 || recommendationQueue.length > 0;

  useEffect(() => {
    nativeAudioPlayer.current.preload = "auto";
    upcomingAudioPlayer.current.preload = "auto";
    
    // Register Browser Media Session API Action Handlers for Mobile Background Controls
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('play', () => {
          if (currentActiveEngine.current === "native" && nativeAudioPlayer.current) {
            nativeAudioPlayer.current.play().catch(console.error);
          } else if (youtubePlayer.current?.playVideo) {
            youtubePlayer.current.playVideo();
          }
          setIsPlaying(true);
          setPlayerStatus("Playing");
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          if (currentActiveEngine.current === "native" && nativeAudioPlayer.current) {
            nativeAudioPlayer.current.pause();
          } else if (youtubePlayer.current?.pauseVideo) {
            youtubePlayer.current.pauseVideo();
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
    
    // Initialize YouTube Player Fallback
    window.onYouTubeIframeAPIReady = () => {
      if (youtubePlayer.current || !document.getElementById("youtubePlayer")) return;
      try {
        youtubePlayer.current = new window.YT.Player("youtubePlayer", {
          height: "1",
          width: "1",
          playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, origin: window.location.origin },
          events: {
            onReady: () => console.log("YouTube Player ready"),
            onStateChange: (event) => {
               if (currentActiveEngine.current === "youtube") {
                  if (event.data === window.YT.PlayerState.ENDED) {
                     playNextTrack();
                  } else if (event.data === window.YT.PlayerState.PLAYING) {
                     setIsPlaying(true);
                     setPlayerStatus("Playing");
                  } else if (event.data === window.YT.PlayerState.PAUSED) {
                     setIsPlaying(false);
                     setPlayerStatus("Paused");
                  }
               }
            }
          }
        });
      } catch (err) {
        console.warn("YouTube player init error:", err);
      }
    };
    
    if (window.YT && window.YT.Player) {
      window.onYouTubeIframeAPIReady();
    }
    
    const handleTimeUpdate = () => {
      if (currentActiveEngine.current === "native" && Number.isFinite(nativeAudioPlayer.current.duration) && nativeAudioPlayer.current.duration > 0) {
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
      playNextTrack();
    };

    const handleError = (e) => {
      if (currentActiveEngine.current === "native" && pendingTrackRef.current?.videoId) {
        console.warn("[Audio Engine] Native audio playback error, switching to YouTube fallback...", e);
        currentActiveEngine.current = "youtube";
        if (youtubePlayer.current?.loadVideoById) {
          youtubePlayer.current.loadVideoById(pendingTrackRef.current.videoId);
          setIsPlaying(true);
          setPlayerStatus("Playing");
        } else {
          setPlayerStatus("Playback failed");
          setIsPlaying(false);
        }
      }
    };
    
    const nativeAudio = nativeAudioPlayer.current;
    nativeAudio.addEventListener('timeupdate', handleTimeUpdate);
    nativeAudio.addEventListener('ended', handleEnded);
    nativeAudio.addEventListener('error', handleError);
    
    const ytInterval = setInterval(() => {
      if (currentActiveEngine.current === "youtube" && youtubePlayer.current?.getCurrentTime) {
         const cTime = youtubePlayer.current.getCurrentTime();
         const dur = youtubePlayer.current.getDuration();
         if (dur > 0) {
            setCurrentTime(cTime);
            setDuration(dur);
            setProgress((cTime / dur) * 100);
         }
      }
    }, 500);
    
    return () => {
      nativeAudio.removeEventListener('timeupdate', handleTimeUpdate);
      nativeAudio.removeEventListener('ended', handleEnded);
      nativeAudio.removeEventListener('error', handleError);
      clearInterval(ytInterval);
    };
  }, []);

  const playPause = useCallback(() => {
    if (isPlaying) {
      if (currentActiveEngine.current === "native") {
        nativeAudioPlayer.current.pause();
      } else if (youtubePlayer.current) {
        youtubePlayer.current.pauseVideo();
      }
      setIsPlaying(false);
      setPlayerStatus("Paused");
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = "paused";
      }
    } else {
      if (currentActiveEngine.current === "native") {
        nativeAudioPlayer.current.play().catch(e => console.error(e));
      } else if (youtubePlayer.current) {
        youtubePlayer.current.playVideo();
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

    try {
      if (youtubePlayer.current && typeof youtubePlayer.current.stopVideo === 'function') {
        youtubePlayer.current.stopVideo();
      }
    } catch (e) {}
  };

  const selectAndPlayTrack = (videoId, title, artist, thumbnail, isFromHistory = false) => {
    stopAllPlayback();

    const trackObj = { videoId, title, artist, thumbnail };
    setPendingTrack(trackObj);
    setCurrentTitle(title);
    setPlayerStatus("Loading...");
    setProgress(0);
    setCurrentTime(0);

    addToRecentlyPlayed(trackObj);

    if (!isFromHistory) {
      setTrackHistory((prev) => [...prev, trackObj]);
    }

    // Set Media Session Metadata for Mobile Background Playback & Lock Screen
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: title || "Play LooP Track",
          artist: artist || "Play LooP",
          album: "Play LooP",
          artwork: [
            { src: thumbnail || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`, sizes: "512x512", type: "image/jpeg" }
          ]
        });
        navigator.mediaSession.playbackState = "playing";
      } catch (e) {
        console.warn("MediaMetadata update error:", e);
      }
    }

    currentActiveEngine.current = "native";
    nativeAudioPlayer.current.src = getAudioUrl(videoId);
    nativeAudioPlayer.current.load();
    nativeAudioPlayer.current
      .play()
      .then(() => {
        setIsPlaying(true);
        setPlayerStatus("Playing");
      })
      .catch(() => {
        console.log("Audio play failed, requires user interaction or fallback");
      });

    // Fetch background recommendations after 1s delay to prioritize audio stream on mobile PWA
    setTimeout(() => {
      try {
        fetchApi(`/api/recommendations?id=${encodeURIComponent(videoId)}`)
          .then((res) => (res.ok ? res.json() : []))
          .then((data) => {
            if (Array.isArray(data)) {
              setRecommendationQueue(
                data
                  .filter((t) => t.videoId && t.videoId !== videoId)
                  .map((t) => ({
                    videoId: t.videoId,
                    title: t.title || "Unknown track",
                    artist: t.artists || "Unknown artist",
                    thumbnail: `https://img.youtube.com/vi/${t.videoId}/hqdefault.jpg`
                  }))
              );
            }
          })
          .catch((e) => console.error(e));
      } catch (e) {
        console.error(e);
      }
    }, 1200);
  };

  const playPlaylist = (tracks, startIndex = 0) => {
    if (!Array.isArray(tracks) || tracks.length === 0) return;
    setTrackQueue(tracks);
    setCurrentTrackIndex(startIndex);
    const startTrack = tracks[startIndex];
    if (startTrack && startTrack.videoId) {
      selectAndPlayTrack(startTrack.videoId, startTrack.title, startTrack.artist, startTrack.thumbnail);
    }
  };

  const playNextTrack = useCallback(() => {
    let nextTrackObj = upcomingTrackRef.current;

    if (!nextTrackObj || nextTrackObj.videoId === pendingTrackRef.current?.videoId) {
      if (trackQueue.length > 0) {
        if (isShuffleEnabled) {
          const candidates = trackQueue.filter((t) => t.videoId !== pendingTrackRef.current?.videoId);
          const pool = candidates.length > 0 ? candidates : trackQueue;
          const randomIndex = Math.floor(Math.random() * pool.length);
          nextTrackObj = pool[randomIndex];
        } else {
          const nextIndex = (currentTrackIndex + 1) % trackQueue.length;
          nextTrackObj = trackQueue[nextIndex];
        }
      } else if (recommendationQueue.length > 0) {
        const candidates = recommendationQueue.filter((t) => t.videoId !== pendingTrackRef.current?.videoId);
        const pool = candidates.length > 0 ? candidates : recommendationQueue;
        nextTrackObj = isShuffleEnabled
          ? pool[Math.floor(Math.random() * pool.length)]
          : pool[0];
      }
    }

    if (nextTrackObj && trackQueue.length > 0) {
      const idx = trackQueue.findIndex((t) => t.videoId === nextTrackObj.videoId);
      if (idx !== -1) setCurrentTrackIndex(idx);
    }

    if (nextTrackObj) {
      selectAndPlayTrack(nextTrackObj.videoId, nextTrackObj.title, nextTrackObj.artist, nextTrackObj.thumbnail);
    }
  }, [isShuffleEnabled, recommendationQueue, trackQueue, currentTrackIndex]);

  const playPreviousTrack = useCallback(() => {
    if (trackHistory.length < 2) return;
    const historyCopy = [...trackHistory];
    historyCopy.pop();
    const previousTrack = historyCopy[historyCopy.length - 1];
    setTrackHistory(historyCopy);
    selectAndPlayTrack(previousTrack.videoId, previousTrack.title, previousTrack.artist, previousTrack.thumbnail, true);
  }, [trackHistory]);

  // Auto-Pre-Download & Pre-buffer Next Track in Queue/Recommendations for Instant 0-Latency Transition
  useEffect(() => {
    if (!pendingTrack?.videoId) return;

    let nextTrackObj = null;
    if (trackQueue.length > 0) {
      if (isShuffleEnabled) {
        const candidates = trackQueue.filter((t) => t.videoId !== pendingTrack.videoId);
        const pool = candidates.length > 0 ? candidates : trackQueue;
        const randomIndex = Math.floor(Math.random() * pool.length);
        nextTrackObj = pool[randomIndex];
      } else {
        const nextIndex = (currentTrackIndex + 1) % trackQueue.length;
        nextTrackObj = trackQueue[nextIndex];
      }
    } else if (recommendationQueue.length > 0) {
      const candidates = recommendationQueue.filter((t) => t.videoId !== pendingTrack.videoId);
      const pool = candidates.length > 0 ? candidates : recommendationQueue;
      nextTrackObj = isShuffleEnabled
        ? pool[Math.floor(Math.random() * pool.length)]
        : pool[0];
    }

    setUpcoming(nextTrackObj);

    if (nextTrackObj?.videoId && nextTrackObj.videoId !== pendingTrack.videoId) {
      console.log(`[Audio Engine] Auto pre-downloading & preloading next track (${nextTrackObj.title || nextTrackObj.videoId})...`);
      // 1. Server pre-download & direct URL cache trigger
      fetchApi(`/api/audio/preload?id=${encodeURIComponent(nextTrackObj.videoId)}`).catch((err) => {
        console.warn("[Audio Engine] Preload trigger warning:", err);
      });

      // 2. Client browser audio pre-buffer
      if (upcomingAudioPlayer.current) {
        upcomingAudioPlayer.current.preload = "auto";
        upcomingAudioPlayer.current.src = getAudioUrl(nextTrackObj.videoId);
        upcomingAudioPlayer.current.load();
      }
    }
  }, [pendingTrack, currentTrackIndex, trackQueue, recommendationQueue, isShuffleEnabled]);

  const seekBy = (seconds) => {
    if (!Number.isFinite(duration) || duration <= 0) return;
    if (currentActiveEngine.current === "native" && nativeAudioPlayer.current) {
      const cTime = nativeAudioPlayer.current.currentTime || currentTime;
      const newTime = Math.max(0, Math.min(duration, cTime + seconds));
      nativeAudioPlayer.current.currentTime = newTime;
      setCurrentTime(newTime);
      setProgress((newTime / duration) * 100);
    } else if (currentActiveEngine.current === "youtube" && youtubePlayer.current?.seekTo) {
      const cTime = youtubePlayer.current.getCurrentTime ? youtubePlayer.current.getCurrentTime() : currentTime;
      const newTime = Math.max(0, Math.min(duration, cTime + seconds));
      youtubePlayer.current.seekTo(newTime, true);
      setCurrentTime(newTime);
      setProgress((newTime / duration) * 100);
    }
  };
  
  const seekToPercent = (percent) => {
    const numericPercent = parseFloat(percent);
    if (isNaN(numericPercent) || !Number.isFinite(duration) || duration <= 0) return;
    const newTime = (numericPercent / 100) * duration;
    
    if (currentActiveEngine.current === "native" && nativeAudioPlayer.current) {
      nativeAudioPlayer.current.currentTime = newTime;
      setCurrentTime(newTime);
      setProgress(numericPercent);
    } else if (currentActiveEngine.current === "youtube" && youtubePlayer.current?.seekTo) {
      youtubePlayer.current.seekTo(newTime, true);
      setCurrentTime(newTime);
      setProgress(numericPercent);
    }
  };

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
    isRepeatEnabled,
    setIsRepeatEnabled,
    isShuffleEnabled,
    setIsShuffleEnabled,
    hasPrevious,
    hasNext
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
}
