const playPauseButton = document.querySelector('[data-action="play-pause"]');
const previousTrackButton = document.querySelector('[data-action="previous-track"]');
const nextTrackButton = document.querySelector('[data-action="next-track"]');
const repeatButton = document.querySelector('[data-action="repeat-track"]');
const shuffleButton = document.querySelector('[data-action="shuffle-track"]');
const rewindButton = document.querySelector('[data-action="rewind-10"]');
const forwardButton = document.querySelector('[data-action="forward-10"]');
const playerBar = document.querySelector("[data-player]");
const youtubePlayerElement = document.querySelector("#youtubePlayer");
const progressBar = document.querySelector("[data-progress]");
const currentTitle = document.querySelector("[data-current-title]");
const playerStatus = document.querySelector("[data-player-status]");
const playerTime = document.querySelector("[data-player-time]");

let pendingTrack;
let isPlaying = false;
let progressAnimationFrame;
let recommendationRequestId = 0;
let trackQueue = [];
let recommendationQueue = [];
let isRepeatEnabled = false;
let isShuffleEnabled = false;
let hasRepeatedCurrentTrack = false;
let forwardTrack;
let currentTrackIndex = -1;
let trackHistory = [];
let youtubePlayer;
let youtubeInitialized = false;
let youtubeReadyResolve;
const youtubeReady = new Promise((resolve) => {
  youtubeReadyResolve = resolve;
});
const playerListeners = new Map();

let currentActiveEngine = "native";
const nativeAudioPlayer = new Audio();
nativeAudioPlayer.preload = "auto";

nativeAudioPlayer.addEventListener("play", () => {
  if (currentActiveEngine === "native") {
    audioPlayer.ended = false;
    audioPlayer.duration = nativeAudioPlayer.duration || 0;
    audioPlayer.dispatchEvent("loadedmetadata");
    audioPlayer.dispatchEvent("play");
  }
});

nativeAudioPlayer.addEventListener("pause", () => {
  if (currentActiveEngine === "native") {
    audioPlayer.dispatchEvent("pause");
  }
});

nativeAudioPlayer.addEventListener("ended", () => {
  if (currentActiveEngine === "native") {
    audioPlayer.ended = true;
    audioPlayer.dispatchEvent("ended");
  }
});

nativeAudioPlayer.addEventListener("loadedmetadata", () => {
  if (currentActiveEngine === "native") {
    audioPlayer.duration = nativeAudioPlayer.duration;
    audioPlayer.dispatchEvent("loadedmetadata");
  }
});

nativeAudioPlayer.addEventListener("error", (e) => {
  if (currentActiveEngine === "native" && pendingTrack) {
    console.warn("[Audio Engine] Native audio playback failed, switching to YouTube player fallback...", e);
    currentActiveEngine = "youtube";
    loadAudioTrackYouTube(pendingTrack);
  }
});

const audioPlayer = {
  duration: 0,
  currentTime: 0,
  ended: false,
  addEventListener(eventName, listener) {
    const listeners = playerListeners.get(eventName) || [];
    listeners.push(listener);
    playerListeners.set(eventName, listeners);
  },
  dispatchEvent(eventName) {
    (playerListeners.get(eventName) || []).forEach((listener) => listener());
  },
  play() {
    if (currentActiveEngine === "native") {
      return nativeAudioPlayer.play();
    }
    if (!youtubePlayer) return Promise.reject(new Error("YouTube player is not ready"));
    youtubePlayer.playVideo();
    return Promise.resolve();
  },
  pause() {
    if (currentActiveEngine === "native") {
      nativeAudioPlayer.pause();
    } else {
      youtubePlayer?.pauseVideo();
    }
  },
  seekTo(time) {
    if (currentActiveEngine === "native") {
      nativeAudioPlayer.currentTime = time;
    } else {
      youtubePlayer?.seekTo(time, true);
    }
  }
};

function initializeYouTubePlayer() {
  if (youtubeInitialized || !window.YT?.Player) return;
  youtubeInitialized = true;
  youtubePlayer = new YT.Player(youtubePlayerElement, {
    width: "1",
    height: "1",
    playerVars: {
      controls: 0,
      disablekb: 1,
      fs: 0,
      modestbranding: 1,
      origin: window.location.origin,
      playsinline: 1,
      rel: 0,
      vq: "small"
    },
    events: {
      onReady: () => youtubeReadyResolve(),
      onError: () => {
        if (currentActiveEngine === "youtube") {
          audioPlayer.dispatchEvent("error");
        }
      },
      onStateChange: ({ data }) => {
        if (currentActiveEngine !== "youtube") return;
        if (data === YT.PlayerState.PLAYING) {
          audioPlayer.ended = false;
          audioPlayer.duration = youtubePlayer.getDuration();
          audioPlayer.dispatchEvent("loadedmetadata");
          audioPlayer.dispatchEvent("play");
        } else if (data === YT.PlayerState.PAUSED) {
          audioPlayer.dispatchEvent("pause");
        } else if (data === YT.PlayerState.ENDED) {
          audioPlayer.ended = true;
          audioPlayer.dispatchEvent("ended");
        }
      }
    }
  });
}

window.onYouTubeIframeAPIReady = initializeYouTubePlayer;
if (window.YT?.Player) initializeYouTubePlayer();

function positionSeekButtons() {
  previousTrackButton.before(repeatButton);
  previousTrackButton.after(rewindButton);
  playPauseButton.after(forwardButton);
  nextTrackButton.after(shuffleButton);
}

positionSeekButtons();
window.addEventListener("resize", positionSeekButtons);

let preloadedNextTrackId = null;
let preloadedNextTrackObj = null;
let preloadedAudio = null;

function getNextTrackToPlay() {
  if (forwardTrack) return forwardTrack;
  if (preloadedNextTrackObj) return preloadedNextTrackObj;

  if (isShuffleEnabled) {
    const availableTracks = recommendationQueue.length ? recommendationQueue : trackQueue;
    if (!availableTracks.length) return null;
    let nextIndex = Math.floor(Math.random() * availableTracks.length);
    if (availableTracks === trackQueue && trackQueue.length > 1 && nextIndex === currentTrackIndex) {
      nextIndex = (nextIndex + 1) % trackQueue.length;
    }
    preloadedNextTrackObj = availableTracks[nextIndex];
    return preloadedNextTrackObj;
  }

  if (trackQueue.length > 0) {
    let nextIndex;
    if (currentTrackIndex >= 0 && currentTrackIndex < trackQueue.length - 1) {
      nextIndex = currentTrackIndex + 1;
    } else {
      nextIndex = 0;
    }
    preloadedNextTrackObj = trackQueue[nextIndex];
    return preloadedNextTrackObj;
  }

  if (recommendationQueue.length > 0) {
    preloadedNextTrackObj = recommendationQueue[0];
    return preloadedNextTrackObj;
  }

  return null;
}

function triggerNextTrackPreload() {
  const nextTrack = getNextTrackToPlay();
  if (!nextTrack || !nextTrack.videoId) return;

  if (preloadedNextTrackId === nextTrack.videoId) return;
  preloadedNextTrackId = nextTrack.videoId;

  console.log(`[Preloader] ⚡ Automatically pre-loading next track: "${nextTrack.title}" (${nextTrack.videoId})`);

  fetch(`/api/audio/preload?id=${encodeURIComponent(nextTrack.videoId)}`).catch(() => {});

  if (!preloadedAudio) {
    preloadedAudio = new Audio();
    preloadedAudio.preload = "auto";
  }
  preloadedAudio.src = `/api/audio?id=${encodeURIComponent(nextTrack.videoId)}`;
  preloadedAudio.load();
}

audioPlayer.addEventListener("play", () => {
  playPauseButton.disabled = false;
  progressBar.disabled = false;
  repeatButton.disabled = false;
  shuffleButton.disabled = false;
  rewindButton.disabled = false;
  forwardButton.disabled = false;
  playerStatus.textContent = "Playing";
  setPlaybackState(true);
  triggerNextTrackPreload();
});

audioPlayer.addEventListener("pause", () => {
  if (!audioPlayer.ended) playerStatus.textContent = "Paused";
  setPlaybackState(false);
});

audioPlayer.addEventListener("ended", () => {
  if (isRepeatEnabled && !hasRepeatedCurrentTrack && youtubePlayer) {
    hasRepeatedCurrentTrack = true;
    isRepeatEnabled = false;
    repeatButton.setAttribute("aria-pressed", "false");
    repeatButton.setAttribute("aria-label", "Repeat off");
    repeatButton.classList.remove("is-active");
    audioPlayer.ended = false;
    audioPlayer.seekTo(0);
    audioPlayer.play();
    return;
  }

  playNextTrack();
});

audioPlayer.addEventListener("loadedmetadata", updateProgress);
audioPlayer.addEventListener("loadedmetadata", () => {
  rewindButton.disabled = false;
  forwardButton.disabled = false;
});
audioPlayer.addEventListener("error", () => {
  playerStatus.textContent = "Unable to load this track";
  playPauseButton.disabled = true;
  progressBar.disabled = true;
  rewindButton.disabled = true;
  forwardButton.disabled = true;
  setPlaybackState(false);
});

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

let silentAudioKeepAlive = null;

function ensureSilentAudioKeepAlive() {
  if (!silentAudioKeepAlive) {
    silentAudioKeepAlive = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=");
    silentAudioKeepAlive.loop = true;
  }
}

function startSilentAudioKeepAlive() {
  ensureSilentAudioKeepAlive();
  if (silentAudioKeepAlive && silentAudioKeepAlive.paused) {
    silentAudioKeepAlive.play().catch(() => {
      /* ignore autoplay restriction */
    });
  }
}

function stopSilentAudioKeepAlive() {
  if (silentAudioKeepAlive && !silentAudioKeepAlive.paused) {
    silentAudioKeepAlive.pause();
  }
}

function setPlaybackState(playing) {
  isPlaying = playing;
  playPauseButton.innerHTML = `<i data-lucide="${playing ? "pause" : "play"}" class="w-5 h-5"></i>`;
  playPauseButton.setAttribute("aria-label", playing ? "Pause" : "Play");
  if (window.lucide?.createIcons) lucide.createIcons();

  if ("mediaSession" in navigator) {
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }

  if (playing) {
    startSilentAudioKeepAlive();
    startProgressAnimation();
  } else {
    stopSilentAudioKeepAlive();
    if (progressAnimationFrame) {
      cancelAnimationFrame(progressAnimationFrame);
      progressAnimationFrame = undefined;
    }
  }
}

function updateTitleMarquee() {
  currentTitle.classList.remove("is-marquee");
  currentTitle.style.removeProperty("--title-shift");

  window.requestAnimationFrame(() => {
    if (currentTitle.scrollWidth <= currentTitle.clientWidth) return;

    const overflowDistance = currentTitle.scrollWidth - currentTitle.clientWidth;
    currentTitle.style.setProperty("--title-shift", `-${overflowDistance}px`);
    currentTitle.classList.add("is-marquee");
  });
}

async function selectAndPlayTrack(videoId, title, artist, thumbnail = null, fromHistory = false) {
  preloadedNextTrackId = null;
  startSilentAudioKeepAlive();
  playerBar.classList.remove("is-hidden");
  if (!fromHistory) forwardTrack = undefined;
  const selectedIndex = trackQueue.findIndex((track) => track.videoId === videoId);
  if (selectedIndex >= 0) currentTrackIndex = selectedIndex;
  const selectedTrack = { videoId, title, artist, thumbnail };
  if (!pendingTrack || pendingTrack.videoId !== videoId) hasRepeatedCurrentTrack = false;
  const lastTrack = trackHistory.at(-1);
  if (!lastTrack || lastTrack.videoId !== videoId) trackHistory.push(selectedTrack);
  updateTrackButtons();

  currentTitle.textContent = `${title} - ${artist}`;
  updateTitleMarquee();
  playerStatus.textContent = "Loading";
  updateMediaSession(selectedTrack);
  playPauseButton.disabled = true;
  progressBar.disabled = true;
  rewindButton.disabled = true;
  forwardButton.disabled = true;
  progressBar.value = "0";
  progressBar.style.setProperty("--progress", "0%");
  playerTime.textContent = "0:00 / 0:00";

  pendingTrack = selectedTrack;
  recommendationQueue = [];
  updateTrackButtons();
  loadRecommendations(videoId);
  loadAudioTrack(pendingTrack);
}

function updateMediaSession(track) {
  if (!("mediaSession" in navigator) || !("MediaMetadata" in window)) return;

  const artworkUrl = track.thumbnail || `https://img.youtube.com/vi/${track.videoId}/hqdefault.jpg`;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist,
    album: "Play LooP",
    artwork: [
      { src: artworkUrl, sizes: "96x96", type: "image/jpeg" },
      { src: artworkUrl, sizes: "128x128", type: "image/jpeg" },
      { src: artworkUrl, sizes: "192x192", type: "image/jpeg" },
      { src: artworkUrl, sizes: "256x256", type: "image/jpeg" },
      { src: artworkUrl, sizes: "384x384", type: "image/jpeg" },
      { src: artworkUrl, sizes: "512x512", type: "image/jpeg" }
    ]
  });

  setupMediaSessionActionHandlers();
}

function setupMediaSessionActionHandlers() {
  if (!("mediaSession" in navigator)) return;

  const mediaSessionActions = {
    play: () => {
      audioPlayer.play();
    },
    pause: () => {
      audioPlayer.pause();
    },
    previoustrack: () => {
      playPreviousTrack();
    },
    nexttrack: () => {
      playNextTrack();
    },
    seekto: (details) => {
      if (details.seekTime !== undefined && Number.isFinite(details.seekTime)) {
        audioPlayer.seekTo(details.seekTime);
      }
    },
    seekbackward: (details) => {
      const skipTime = details.seekOffset || 10;
      seekBy(-skipTime);
    },
    seekforward: (details) => {
      const skipTime = details.seekOffset || 10;
      seekBy(skipTime);
    },
    stop: () => {
      audioPlayer.pause();
    }
  };

  Object.entries(mediaSessionActions).forEach(([action, handler]) => {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {
      // Some browsers expose Media Session but do not support every action.
    }
  });
}

function loadAudioTrack(track) {
  currentActiveEngine = "native";
  if (youtubePlayer && youtubePlayer.pauseVideo) {
    try { youtubePlayer.pauseVideo(); } catch {}
  }

  nativeAudioPlayer.src = `/api/audio?id=${encodeURIComponent(track.videoId)}`;
  nativeAudioPlayer.load();

  const handleCanPlay = () => {
    nativeAudioPlayer.removeEventListener("canplay", handleCanPlay);
    if (currentActiveEngine === "native") {
      nativeAudioPlayer.play().catch(() => {
        // Retry playing if initial attempt was deferred by mobile browser
      });
    }
  };

  nativeAudioPlayer.addEventListener("canplay", handleCanPlay);

  nativeAudioPlayer.play().catch(() => {
    // Keep native audio engine active while stream buffers on mobile
    if (!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      currentActiveEngine = "youtube";
      loadAudioTrackYouTube(track);
    }
  });
}

function loadAudioTrackYouTube(track) {
  try { nativeAudioPlayer.pause(); } catch {}
  youtubeReady.then(() => {
    if (typeof youtubePlayer.loadVideoById === "function") {
      youtubePlayer.loadVideoById({
        videoId: track.videoId,
        suggestedQuality: "small"
      });
    }
    if (typeof youtubePlayer.setPlaybackQuality === "function") {
      try { youtubePlayer.setPlaybackQuality("small"); } catch {}
    }
    youtubePlayer.playVideo().catch(() => {
      playerStatus.textContent = "Press play to start this track";
      setPlaybackState(false);
    });
  });
}

async function loadRecommendations(videoId) {
  const requestId = ++recommendationRequestId;

  try {
    const response = await fetch(`/api/recommendations?id=${encodeURIComponent(videoId)}`);
    const recommendations = await response.json();
    if (requestId !== recommendationRequestId || !response.ok) return;

    recommendationQueue = recommendations
      .filter((track) => track.videoId && track.videoId !== videoId)
      .map((track) => ({
        videoId: track.videoId,
        title: track.title || "Unknown track",
        artist: track.artists || "Unknown artist",
        thumbnail: `https://img.youtube.com/vi/${track.videoId}/hqdefault.jpg`
      }));
    updateTrackButtons();
    triggerNextTrackPreload();
  } catch (error) {
    if (requestId === recommendationRequestId) recommendationQueue = [];
    console.error("Recommendations unavailable:", error);
  }
}

playPauseButton.addEventListener("click", () => {
  if (isPlaying) audioPlayer.pause();
  else audioPlayer.play();
});

function seekBy(seconds) {
  if (!Number.isFinite(audioPlayer.duration)) return;
  audioPlayer.seekTo(Math.max(
    0,
    Math.min(audioPlayer.duration, audioPlayer.currentTime + seconds)
  ));
}

rewindButton.addEventListener("click", () => seekBy(-10));
forwardButton.addEventListener("click", () => seekBy(10));

repeatButton.addEventListener("click", () => {
  isRepeatEnabled = !isRepeatEnabled;
  repeatButton.setAttribute("aria-pressed", String(isRepeatEnabled));
  repeatButton.setAttribute("aria-label", isRepeatEnabled ? "Repeat on" : "Repeat off");
  repeatButton.classList.toggle("is-active", isRepeatEnabled);
});

shuffleButton.addEventListener("click", () => {
  isShuffleEnabled = !isShuffleEnabled;
  shuffleButton.setAttribute("aria-pressed", String(isShuffleEnabled));
  shuffleButton.setAttribute("aria-label", isShuffleEnabled ? "Random / Shuffle on" : "Random / Shuffle off");
  shuffleButton.classList.toggle("is-active", isShuffleEnabled);
  preloadedNextTrackObj = null;
  preloadedNextTrackId = null;
  triggerNextTrackPreload();
});

window.addEventListener("resize", updateTitleMarquee);

nextTrackButton.addEventListener("click", playNextTrack);
previousTrackButton.addEventListener("click", playPreviousTrack);

progressBar.addEventListener("input", () => {
  const progress = Number(progressBar.value);
  progressBar.style.setProperty("--progress", `${progress}%`);
  if (Number.isFinite(audioPlayer.duration)) {
    audioPlayer.seekTo((progress / 100) * audioPlayer.duration);
  }
});

function updateProgress() {
  const duration = currentActiveEngine === "native" ? nativeAudioPlayer.duration : audioPlayer.duration;
  const currentTime = currentActiveEngine === "native" ? nativeAudioPlayer.currentTime : (youtubePlayer ? youtubePlayer.getCurrentTime() : audioPlayer.currentTime);
  if (!Number.isFinite(duration) || duration <= 0) return;

  audioPlayer.duration = duration;
  audioPlayer.currentTime = currentTime;

  progressBar.disabled = false;
  const progress = (currentTime / duration) * 100;
  progressBar.value = String(progress);
  progressBar.style.setProperty("--progress", `${progress}%`);
  playerTime.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;

  if ("mediaSession" in navigator && "setPositionState" in navigator.mediaSession) {
    try {
      navigator.mediaSession.setPositionState({
        duration: duration,
        playbackRate: 1,
        position: Math.min(currentTime, duration)
      });
    } catch {
      // Ignore if setPositionState is not supported
    }
  }

  if (isPlaying) {
    requestAnimationFrame(updateProgress);
  }
}

function startProgressAnimation() {
  if (progressAnimationFrame) return;

  const animate = () => {
    progressAnimationFrame = undefined;
    updateProgress();
    if (isPlaying) progressAnimationFrame = requestAnimationFrame(animate);
  };

  progressAnimationFrame = requestAnimationFrame(animate);
}

function playNextTrack() {
  if (forwardTrack) {
    const nextTrack = forwardTrack;
    forwardTrack = undefined;
    selectAndPlayTrack(nextTrack.videoId, nextTrack.title, nextTrack.artist, nextTrack.thumbnail, true);
    return;
  }

  const nextTrack = preloadedNextTrackObj || getNextTrackToPlay();
  if (nextTrack) {
    preloadedNextTrackObj = null;
    selectAndPlayTrack(nextTrack.videoId, nextTrack.title, nextTrack.artist, nextTrack.thumbnail);
  }
}

function playPreviousTrack() {
  if (trackHistory.length < 2) return;

  forwardTrack = trackHistory.pop();
  const previousTrack = trackHistory.at(-1);
  currentTrackIndex = trackQueue.findIndex((track) => track.videoId === previousTrack.videoId);
  updateTrackButtons();
  selectAndPlayTrack(previousTrack.videoId, previousTrack.title, previousTrack.artist, previousTrack.thumbnail, true);
}

function updateTrackButtons() {
  previousTrackButton.disabled = trackHistory.length < 2;
  nextTrackButton.disabled = trackQueue.length === 0 && recommendationQueue.length === 0;
  shuffleButton.disabled = trackQueue.length === 0 && recommendationQueue.length === 0;
}
