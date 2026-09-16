const menuButtons = document.querySelectorAll('[data-action="toggle-sidebar"]');
const closeButton = document.querySelector('[data-action="close-sidebar"]');
const sidebar = document.querySelector('[data-sidebar]');
const navLinks = document.querySelectorAll('[data-nav]');
const content = document.querySelector('[data-content]');
const profileButton = document.querySelector('[data-action="profile-button"]');

function showPage(pageName, updateUrl = true) {
  const page = pages[pageName] || pages.home;
  const pageBody = pageName === "search"
    ? '<div class="track-list" data-track-list><p class="muted-text">Search for a song to begin.</p></div>'
    : `<div class="page-grid">
      ${page.cards.map((card) => `<article class="page-card"><h3>${card}</h3><p>Coming soon</p></article>`).join("")}
    </div>`;

  content.innerHTML = `
    <div class="page-header${pageName === "search" ? " search-page-header" : ""}">
      <h2>${page.title}</h2>
      <p>${page.description}</p>
    </div>
    ${pageBody}
  `;

  if (updateUrl) {
    if (pageName === "home") {
      window.history.pushState({}, "", "/");
    } else {
      window.location.hash = pageName;
    }
  }
}

function setSidebarState(isOpen) {
  sidebar.classList.toggle("is-closed", !isOpen);
  menuButtons.forEach((menuButton) => {
    menuButton.classList.toggle("is-hidden", isOpen);
    menuButton.setAttribute("aria-expanded", String(isOpen));
    menuButton.setAttribute("tabindex", isOpen ? "-1" : "0");
  });
  closeButton.classList.toggle("is-hidden", !isOpen);
  closeButton.setAttribute("tabindex", isOpen ? "0" : "-1");
}

menuButtons.forEach((menuButton) => menuButton.addEventListener("click", () => {
  setSidebarState(true);
}));

closeButton.addEventListener("click", () => {
  setSidebarState(false);
});

navLinks.forEach((navLink) => navLink.addEventListener("click", (event) => {
  event.preventDefault();
  navLink.classList.add("is-tapped");
  window.setTimeout(() => navLink.classList.remove("is-tapped"), 250);
  showPage(navLink.dataset.nav);
  setSidebarState(false);
}));

profileButton.addEventListener("click", () => showPage("profile"));

setSidebarState(false);

const searchForm = document.querySelector("[data-search-form]");
const searchInput = document.querySelector(".search-input");
const searchSuggestions = document.querySelector("[data-search-suggestions]");
const searchToggle = document.querySelector('[data-action="search-toggle"]');
const clearSearch = document.querySelector('[data-action="clear-search"]');
const playPauseButton = document.querySelector('[data-action="play-pause"]');
const previousTrackButton = document.querySelector('[data-action="previous-track"]');
const nextTrackButton = document.querySelector('[data-action="next-track"]');
const repeatButton = document.querySelector('[data-action="repeat-track"]');
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
let activeSearchRequest = 0;
let activeSuggestionRequest = 0;
let suggestionTimer;
let recommendationRequestId = 0;
let trackQueue = [];
let recommendationQueue = [];
let isRepeatEnabled = false;
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
    if (!youtubePlayer) return Promise.reject(new Error("YouTube player is not ready"));
    youtubePlayer.playVideo();
    return Promise.resolve();
  },
  pause() {
    youtubePlayer?.pauseVideo();
  },
  seekTo(time) {
    youtubePlayer?.seekTo(time, true);
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
      rel: 0
    },
    events: {
      onReady: () => youtubeReadyResolve(),
      onError: () => audioPlayer.dispatchEvent("error"),
      onStateChange: ({ data }) => {
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
}

positionSeekButtons();
window.addEventListener("resize", positionSeekButtons);

audioPlayer.addEventListener("play", () => {
  playPauseButton.disabled = false;
  progressBar.disabled = false;
  repeatButton.disabled = false;
  rewindButton.disabled = false;
  forwardButton.disabled = false;
  playerStatus.textContent = "Playing";
  setPlaybackState(true);
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
    youtubePlayer.seekTo(0, true);
    youtubePlayer.playVideo();
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

function setClearSearchState() {
  clearSearch.classList.toggle("is-hidden", !searchInput.value);
}

function setSearchState(isOpen) {
  searchForm.classList.toggle("is-open", isOpen);
  document.body.classList.toggle("mobile-search-open", isOpen);

  searchToggle.setAttribute("aria-label", isOpen ? "Close search" : "Open search");

  if (isOpen) {
    searchInput.focus();
  } else {
    searchInput.value = "";
    hideSearchSuggestions();
    clearSearch.classList.add("is-hidden");
    searchInput.blur();
  }

  setClearSearchState();
}

searchToggle.addEventListener("click", () => {
  if (!searchForm.classList.contains("is-open") && window.innerWidth <= 640) {
    setSearchState(true);
    return;
  }

  searchForm.requestSubmit();
});

document.addEventListener("pointerdown", (event) => {
  if (searchForm.classList.contains("is-open") && !searchForm.contains(event.target)) {
    setSearchState(false);
  }
});
searchForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const query = searchInput.value.trim();

  if (query) {
    hideSearchSuggestions();
    showPage("search", false);
    window.history.pushState({}, "", "#search");
    searchTracks(query);
  }
});

searchInput.addEventListener("input", () => {
  setClearSearchState();
  clearTimeout(suggestionTimer);
  const query = searchInput.value.trim();

  if (query.length < 2) {
    hideSearchSuggestions();
    return;
  }

  suggestionTimer = window.setTimeout(() => loadSearchSuggestions(query), 250);
});

clearSearch.addEventListener("click", () => {
  searchInput.value = "";
  setClearSearchState();
  hideSearchSuggestions();
  searchInput.focus();
});

function hideSearchSuggestions() {
  activeSuggestionRequest += 1;
  searchSuggestions.replaceChildren();
  searchSuggestions.classList.add("is-hidden");
}

async function loadSearchSuggestions(query) {
  const requestId = ++activeSuggestionRequest;

  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const songs = await response.json();
    if (requestId !== activeSuggestionRequest || !response.ok || searchInput.value.trim() !== query) return;

    const suggestions = songs
      .map((song) => ({
        title: song.name || "Unknown track",
        artist: song.artist?.name || "Unknown artist"
      }))
      .filter((song, index, allSongs) => allSongs.findIndex((item) => item.title === song.title && item.artist === song.artist) === index)
      .slice(0, 6);

    searchSuggestions.replaceChildren();
    suggestions.forEach(({ title, artist }) => {
      const suggestion = document.createElement("button");
      suggestion.type = "button";
      suggestion.className = "search-suggestion";
      suggestion.setAttribute("role", "option");
      suggestion.innerHTML = '<i data-lucide="search" class="w-4 h-4"></i><span><strong></strong><small></small></span>';
      suggestion.querySelector("strong").textContent = title;
      suggestion.querySelector("small").textContent = artist;
      suggestion.addEventListener("click", () => {
        searchInput.value = title;
        setClearSearchState();
        searchForm.requestSubmit();
      });
      searchSuggestions.appendChild(suggestion);
    });
    searchSuggestions.classList.toggle("is-hidden", suggestions.length === 0);
    lucide.createIcons();
  } catch (error) {
    if (requestId === activeSuggestionRequest) hideSearchSuggestions();
    console.error("Search suggestions unavailable:", error);
  }
}

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hideSearchSuggestions();
    setSearchState(false);
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    searchForm.requestSubmit();
  }
});

function getPageFromLocation() {
  return window.location.hash.slice(1) || "home";
}

window.addEventListener("hashchange", () => showPage(getPageFromLocation(), false));
window.addEventListener("popstate", () => showPage(getPageFromLocation(), false));

showPage(getPageFromLocation(), false);

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function setPlaybackState(playing) {
  isPlaying = playing;
  playPauseButton.innerHTML = `<i data-lucide="${playing ? "pause" : "play"}" class="w-5 h-5"></i>`;
  playPauseButton.setAttribute("aria-label", playing ? "Pause" : "Play");
  lucide.createIcons();

  if ("mediaSession" in navigator) {
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }

  if (playing) {
    startProgressAnimation();
  } else if (progressAnimationFrame) {
    cancelAnimationFrame(progressAnimationFrame);
    progressAnimationFrame = undefined;
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

async function selectAndPlayTrack(videoId, title, artist, fromHistory = false) {
  playerBar.classList.remove("is-hidden");
  if (!fromHistory) forwardTrack = undefined;
  const selectedIndex = trackQueue.findIndex((track) => track.videoId === videoId);
  if (selectedIndex >= 0) currentTrackIndex = selectedIndex;
  const selectedTrack = { videoId, title, artist };
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

  pendingTrack = { videoId, title, artist };
  recommendationQueue = [];
  updateTrackButtons();
  loadRecommendations(videoId);
  loadAudioTrack(pendingTrack);
}

function updateMediaSession(track) {
  if (!("mediaSession" in navigator) || !("MediaMetadata" in window)) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist,
    album: "Play LooP"
  });
}

if ("mediaSession" in navigator) {
  const mediaSessionActions = {
    play: () => audioPlayer.play(),
    pause: () => audioPlayer.pause(),
    nexttrack: playNextTrack,
    previoustrack: playPreviousTrack
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
  youtubeReady.then(() => {
    youtubePlayer.loadVideoById(track.videoId);
    audioPlayer.play().catch(() => {
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
        artist: track.artists || "Unknown artist"
      }));
    updateTrackButtons();
  } catch (error) {
    if (requestId === recommendationRequestId) recommendationQueue = [];
    console.error("Recommendations unavailable:", error);
  }
}

async function searchTracks(query) {
  const requestId = ++activeSearchRequest;
  const trackList = document.querySelector("[data-track-list]");
  if (!trackList) return;
  trackList.innerHTML = '<p class="muted-text">Searching music catalog...</p>';

  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const songs = await response.json();
    if (requestId !== activeSearchRequest) return;
    if (!response.ok) throw new Error(songs.error || "Search failed");

    trackList.replaceChildren();
    if (!songs.length) {
      trackList.innerHTML = '<p class="muted-text">No tracks found.</p>';
      return;
    }

    trackQueue = songs.map((song) => ({
      videoId: song.videoId,
      title: song.name || "Unknown track",
      artist: song.artist?.name || "Unknown artist"
    }));
    currentTrackIndex = -1;
    trackHistory = [];
    forwardTrack = undefined;
    updateTrackButtons();

    songs.forEach((song) => {
      const title = song.name || "Unknown track";
      const artist = song.artist?.name || "Unknown artist";
      const thumbnail = song.thumbnails?.find((item) => item?.url)?.url || "/public/logo.svg";
      const card = document.createElement("article");
      card.className = "track-card";
      card.innerHTML = `
        <img src="${thumbnail}" alt="" class="track-art" />
        <div class="track-info"><h3></h3><p></p></div>
        <button type="button" class="track-play" aria-label="Play ${title}"><i data-lucide="play" class="w-4 h-4"></i></button>
      `;
      const trackArt = card.querySelector(".track-art");
      const handleThumbnailError = () => {
        trackArt.removeEventListener("error", handleThumbnailError);
        trackArt.src = "/public/logo.svg";
      };
      trackArt.addEventListener("error", handleThumbnailError);
      card.querySelector("h3").textContent = title;
      card.querySelector("p").textContent = artist;
      card.querySelector("button").addEventListener("click", () => selectAndPlayTrack(song.videoId, title, artist));
      trackList.appendChild(card);
    });
    lucide.createIcons();
  } catch (error) {
    console.error(error);
    trackList.innerHTML = '<p class="muted-text">The music server is unavailable. Start it with <code>npm start</code>.</p>';
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
  const duration = audioPlayer.duration;
  const currentTime = audioPlayer.currentTime;
  if (!Number.isFinite(duration) || duration <= 0) return;

  progressBar.disabled = false;
  const progress = (currentTime / duration) * 100;
  progressBar.value = String(progress);
  progressBar.style.setProperty("--progress", `${progress}%`);
  playerTime.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
  if (youtubePlayer && isPlaying) {
    audioPlayer.currentTime = youtubePlayer.getCurrentTime();
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
  const availableTracks = recommendationQueue.length ? recommendationQueue : trackQueue;
  if (!availableTracks.length) return;

  if (forwardTrack) {
    const nextTrack = forwardTrack;
    forwardTrack = undefined;
    selectAndPlayTrack(nextTrack.videoId, nextTrack.title, nextTrack.artist, true);
    return;
  }

  let nextIndex = Math.floor(Math.random() * availableTracks.length);
  if (availableTracks === trackQueue && trackQueue.length > 1 && nextIndex === currentTrackIndex) {
    nextIndex = (nextIndex + 1) % trackQueue.length;
  }

  const nextTrack = availableTracks[nextIndex];
  selectAndPlayTrack(nextTrack.videoId, nextTrack.title, nextTrack.artist);
}

function playPreviousTrack() {
  if (trackHistory.length < 2) return;

  forwardTrack = trackHistory.pop();
  const previousTrack = trackHistory.at(-1);
  currentTrackIndex = trackQueue.findIndex((track) => track.videoId === previousTrack.videoId);
  updateTrackButtons();
  selectAndPlayTrack(previousTrack.videoId, previousTrack.title, previousTrack.artist, true);
}

function updateTrackButtons() {
  previousTrackButton.disabled = trackHistory.length < 2;
  nextTrackButton.disabled = trackQueue.length === 0 && recommendationQueue.length === 0;
}

