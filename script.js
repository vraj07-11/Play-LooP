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
const audio = new Audio();
const playPauseButton = document.querySelector('[data-action="play-pause"]');
const progressBar = document.querySelector("[data-progress]");
const currentTitle = document.querySelector("[data-current-title]");
const playerStatus = document.querySelector("[data-player-status]");
const playerTime = document.querySelector("[data-player-time]");
let isPlaying = false;
let activeSearchRequest = 0;

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
}

async function selectAndPlayTrack(videoId, title, artist) {
  currentTitle.textContent = `${title} - ${artist}`;
  playerStatus.textContent = "Loading";
  playPauseButton.disabled = true;
  progressBar.disabled = true;
  progressBar.value = "0";
  progressBar.style.setProperty("--progress", "0%");
  playerTime.textContent = "0:00 / 0:00";

  try {
    audio.src = `/api/audio?id=${encodeURIComponent(videoId)}`;
    audio.load();
    await audio.play();
    playPauseButton.disabled = false;
    playerStatus.textContent = "Playing";
    setPlaybackState(true);
  } catch (error) {
    console.error(error);
    playerStatus.textContent = "Playback failed - check server logs";
    setPlaybackState(false);
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

playPauseButton.addEventListener("click", async () => {
  if (!audio.src) return;
  if (audio.paused) {
    await audio.play();
    playerStatus.textContent = "Playing";
    setPlaybackState(true);
  } else {
    audio.pause();
    playerStatus.textContent = "Paused";
    setPlaybackState(false);
  }
});

audio.addEventListener("timeupdate", () => {
  updateProgress();
});

audio.addEventListener("loadedmetadata", updateProgress);
audio.addEventListener("durationchange", updateProgress);

audio.addEventListener("error", () => {
  playPauseButton.disabled = true;
  progressBar.disabled = true;
  playerStatus.textContent = "Playback unavailable";
});

audio.addEventListener("ended", () => {
  setPlaybackState(false);
  playerStatus.textContent = "Finished";
  progressBar.value = "0";
  progressBar.style.setProperty("--progress", "0%");
});

progressBar.addEventListener("input", () => {
  const progress = Number(progressBar.value);
  progressBar.style.setProperty("--progress", `${progress}%`);
  if (audio.duration) audio.currentTime = (progress / 100) * audio.duration;
});

function updateProgress() {
  if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;

  progressBar.disabled = false;
  const progress = (audio.currentTime / audio.duration) * 100;
  progressBar.value = String(progress);
  progressBar.style.setProperty("--progress", `${progress}%`);
  playerTime.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
}

