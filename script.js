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
    <div class="page-header">
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
const searchToggle = document.querySelector('[data-action="search-toggle"]');
const clearSearch = document.querySelector('[data-action="clear-search"]');
const playPauseButton = document.querySelector('[data-action="play-pause"]');
const previousTrackButton = document.querySelector('[data-action="previous-track"]');
const nextTrackButton = document.querySelector('[data-action="next-track"]');
const playerBar = document.querySelector("[data-player]");
const progressBar = document.querySelector("[data-progress]");
const currentTitle = document.querySelector("[data-current-title]");
const playerStatus = document.querySelector("[data-player-status]");
const playerTime = document.querySelector("[data-player-time]");
let youtubePlayer;
let youtubeReady = false;
let pendingTrack;
let isPlaying = false;
let progressAnimationFrame;
let activeSearchRequest = 0;
let trackQueue = [];
let currentTrackIndex = -1;
let trackHistory = [];

window.onYouTubeIframeAPIReady = () => {
  youtubePlayer = new YT.Player("youtubePlayer", {
    width: "320",
    height: "180",
    playerVars: {
      controls: 0,
      disablekb: 1,
      playsinline: 1,
      rel: 0,
      origin: window.location.origin
    },
    events: {
      onReady: () => {
        youtubeReady = true;
        if (pendingTrack) loadYouTubeTrack(pendingTrack);
      },
      onError: (event) => {
        const errorMessages = {
          2: "Invalid YouTube video ID",
          5: "This video cannot be played in the HTML5 player",
          100: "This video is unavailable or private",
          101: "The owner does not allow embedded playback",
          150: "The owner does not allow embedded playback",
          153: "YouTube could not verify the embedded player origin"
        };
        playerStatus.textContent = errorMessages[event.data] || "Video unavailable";
        playPauseButton.disabled = true;
        progressBar.disabled = true;
        setPlaybackState(false);
      },
      onStateChange: (event) => {
        if (event.data === YT.PlayerState.PLAYING) {
          playPauseButton.disabled = false;
          progressBar.disabled = false;
          playerStatus.textContent = "Playing";
          setPlaybackState(true);
        } else if (event.data === YT.PlayerState.PAUSED) {
          playerStatus.textContent = "Paused";
          setPlaybackState(false);
        } else if (event.data === YT.PlayerState.ENDED) {
          playNextTrack();
        }
      }
    }
  });
};

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
    showPage("search");
    searchTracks(query);
  }
});

searchInput.addEventListener("input", setClearSearchState);

clearSearch.addEventListener("click", () => {
  searchInput.value = "";
  setClearSearchState();
  searchInput.focus();
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setSearchState(false);
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

  if (playing) {
    startProgressAnimation();
  } else if (progressAnimationFrame) {
    cancelAnimationFrame(progressAnimationFrame);
    progressAnimationFrame = undefined;
  }
}

async function selectAndPlayTrack(videoId, title, artist) {
  playerBar.classList.remove("is-hidden");
  const selectedIndex = trackQueue.findIndex((track) => track.videoId === videoId);
  if (selectedIndex >= 0) currentTrackIndex = selectedIndex;
  const selectedTrack = { videoId, title, artist };
  const lastTrack = trackHistory.at(-1);
  if (!lastTrack || lastTrack.videoId !== videoId) trackHistory.push(selectedTrack);
  updateTrackButtons();

  currentTitle.textContent = `${title} - ${artist}`;
  playerStatus.textContent = "Loading";
  playPauseButton.disabled = true;
  progressBar.disabled = true;
  progressBar.value = "0";
  progressBar.style.setProperty("--progress", "0%");
  playerTime.textContent = "0:00 / 0:00";

  pendingTrack = { videoId, title, artist };
  if (youtubeReady) loadYouTubeTrack(pendingTrack);
  else playerStatus.textContent = "Loading YouTube player";
}

function loadYouTubeTrack(track) {
  youtubePlayer.loadVideoById(track.videoId);
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
    updateTrackButtons();

    songs.forEach((song) => {
      const title = song.name || "Unknown track";
      const artist = song.artist?.name || "Unknown artist";
      const thumbnail = song.thumbnails?.[0]?.url || "";
      const card = document.createElement("article");
      card.className = "track-card";
      card.innerHTML = `
        <img src="${thumbnail}" alt="" class="track-art" />
        <div class="track-info"><h3></h3><p></p></div>
        <button type="button" class="track-play" aria-label="Play ${title}"><i data-lucide="play" class="w-4 h-4"></i></button>
      `;
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
  if (!youtubePlayer || !youtubeReady) return;
  if (isPlaying) {
    youtubePlayer.pauseVideo();
  } else {
    youtubePlayer.playVideo();
  }
});

nextTrackButton.addEventListener("click", playNextTrack);
previousTrackButton.addEventListener("click", playPreviousTrack);

progressBar.addEventListener("input", () => {
  const progress = Number(progressBar.value);
  progressBar.style.setProperty("--progress", `${progress}%`);
  if (youtubePlayer && youtubeReady) {
    youtubePlayer.seekTo((progress / 100) * youtubePlayer.getDuration(), true);
  }
});

function updateProgress() {
  if (!youtubePlayer || !youtubeReady) return;
  const duration = youtubePlayer.getDuration();
  const currentTime = youtubePlayer.getCurrentTime();
  if (!Number.isFinite(duration) || duration <= 0) return;

  progressBar.disabled = false;
  const progress = (currentTime / duration) * 100;
  progressBar.value = String(progress);
  progressBar.style.setProperty("--progress", `${progress}%`);
  playerTime.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
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
  if (!trackQueue.length) return;

  let nextIndex = Math.floor(Math.random() * trackQueue.length);
  if (trackQueue.length > 1 && nextIndex === currentTrackIndex) {
    nextIndex = (nextIndex + 1) % trackQueue.length;
  }

  const nextTrack = trackQueue[nextIndex];
  selectAndPlayTrack(nextTrack.videoId, nextTrack.title, nextTrack.artist);
}

function playPreviousTrack() {
  if (trackHistory.length < 2) return;

  trackHistory.pop();
  const previousTrack = trackHistory.at(-1);
  currentTrackIndex = trackQueue.findIndex((track) => track.videoId === previousTrack.videoId);
  updateTrackButtons();
  currentTitle.textContent = `${previousTrack.title} - ${previousTrack.artist}`;
  pendingTrack = previousTrack;
  if (youtubeReady) loadYouTubeTrack(previousTrack);
}

function updateTrackButtons() {
  previousTrackButton.disabled = trackHistory.length < 2;
  nextTrackButton.disabled = trackQueue.length === 0;
}

