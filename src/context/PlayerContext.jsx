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

  const selectAndPlayTrack = async (videoId, title, artist, thumbnail = null, fromHistory = false) => {
    const selectedTrack = { videoId, title, artist, thumbnail };
    setPendingTrack(selectedTrack);
    setCurrentTitle(`${title} - ${artist}`);
    setPlayerStatus("Loading");
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    
    if (!fromHistory) {
      setTrackHistory(prev => {
        const last = prev[prev.length - 1];
        if (!last || last.videoId !== videoId) return [...prev, selectedTrack];
        return prev;
      });
    }

    // Load recommendations
    try {
      const response = await fetchApi(`/api/recommendations?id=${encodeURIComponent(videoId)}`);
      if (response.ok) {
        const data = await response.json();
        setRecommendationQueue(data
          .filter((t) => t.videoId && t.videoId !== videoId)
          .map((t) => ({
            videoId: t.videoId,
            title: t.title || "Unknown track",
            artist: t.artists || "Unknown artist",
            thumbnail: `https://img.youtube.com/vi/${t.videoId}/hqdefault.jpg`
          })));
      }
    } catch (e) {
      console.error(e);
    }

    // Load audio
    currentActiveEngine.current = "native";
    nativeAudioPlayer.current.src = getAudioUrl(videoId);
    nativeAudioPlayer.current.load();
    nativeAudioPlayer.current.play().then(() => {
      setIsPlaying(true);
      setPlayerStatus("Playing");
    }).catch(() => {
       // fallback could go here
       console.log("Audio play failed, requires user interaction or fallback");
    });
  };

  const playNextTrack = useCallback(() => {
    let nextTrackObj = null;
    if (isShuffleEnabled) {
       const pool = recommendationQueue.length ? recommendationQueue : trackQueue;
       if (pool.length) {
         const currentId = pendingTrack?.videoId;
         const filtered = pool.filter(t => t.videoId !== currentId);
         const selectionPool = filtered.length ? filtered : pool;
         nextTrackObj = selectionPool[Math.floor(Math.random() * selectionPool.length)];
       }
    } else {
       if (trackQueue.length > 0) {
          let nextIndex = currentTrackIndex >= 0 && currentTrackIndex < trackQueue.length - 1 ? currentTrackIndex + 1 : 0;
          nextTrackObj = trackQueue[nextIndex];
          setCurrentTrackIndex(nextIndex);
       } else if (recommendationQueue.length > 0) {
          nextTrackObj = recommendationQueue[0];
       }
    }
    
    if (nextTrackObj) {
      selectAndPlayTrack(nextTrackObj.videoId, nextTrackObj.title, nextTrackObj.artist, nextTrackObj.thumbnail);
    }
  }, [isShuffleEnabled, recommendationQueue, trackQueue, currentTrackIndex, pendingTrack]);

  const playPreviousTrack = useCallback(() => {
    if (trackHistory.length < 2) return;
    const historyCopy = [...trackHistory];
    historyCopy.pop(); // remove current
    const previousTrack = historyCopy[historyCopy.length - 1];
    setTrackHistory(historyCopy);
    selectAndPlayTrack(previousTrack.videoId, previousTrack.title, previousTrack.artist, previousTrack.thumbnail, true);
  }, [trackHistory]);

  const seekBy = (seconds) => {
    if (!Number.isFinite(duration)) return;
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    nativeAudioPlayer.current.currentTime = newTime;
    setCurrentTime(newTime);
  };
  
  const seekToPercent = (percent) => {
    if (!Number.isFinite(duration)) return;
    const newTime = (percent / 100) * duration;
    nativeAudioPlayer.current.currentTime = newTime;
    setCurrentTime(newTime);
  }

  const value = {
    isPlaying, playPause,
    pendingTrack, currentTitle, playerStatus,
    progress, currentTime, duration,
    trackQueue, setTrackQueue,
    selectAndPlayTrack,
    playNextTrack, playPreviousTrack,
    seekBy, seekToPercent,
    isRepeatEnabled, setIsRepeatEnabled,
    isShuffleEnabled, setIsShuffleEnabled,
    hasPrevious, hasNext
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
}
