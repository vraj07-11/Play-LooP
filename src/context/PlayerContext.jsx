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

  const nativeAudioPlayer = useRef(new Audio());
  const youtubePlayer = useRef(null);
  const currentActiveEngine = useRef("native");
  const pendingTrackRef = useRef(null);

  useEffect(() => {
    pendingTrackRef.current = pendingTrack;
  }, [pendingTrack]);
  
  // Basic states for button disabling
  const hasPrevious = trackHistory.length > 1;
  const hasNext = trackQueue.length > 0 || recommendationQueue.length > 0;

  useEffect(() => {
    nativeAudioPlayer.current.preload = "auto";
    
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
    } else {
      if (currentActiveEngine.current === "native") {
        nativeAudioPlayer.current.play().catch(e => console.error(e));
      } else if (youtubePlayer.current) {
        youtubePlayer.current.playVideo();
      }
      setIsPlaying(true);
      setPlayerStatus("Playing");
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
    let nextTrackObj = null;

    if (trackQueue.length > 0) {
      // If playing within a playlist queue
      if (isShuffleEnabled) {
        const randomIndex = Math.floor(Math.random() * trackQueue.length);
        setCurrentTrackIndex(randomIndex);
        nextTrackObj = trackQueue[randomIndex];
      } else {
        const nextIndex = (currentTrackIndex + 1) % trackQueue.length;
        setCurrentTrackIndex(nextIndex);
        nextTrackObj = trackQueue[nextIndex];
      }
    } else if (recommendationQueue.length > 0) {
      // Fallback recommendation queue
      if (isShuffleEnabled) {
        const randomIndex = Math.floor(Math.random() * recommendationQueue.length);
        nextTrackObj = recommendationQueue[randomIndex];
      } else {
        nextTrackObj = recommendationQueue[0];
      }
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
