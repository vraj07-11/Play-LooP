const searchForm = document.querySelector('[data-search-form]');
const searchInput = document.querySelector('.search-input');
const searchSuggestions = document.querySelector('[data-search-suggestions]');
const clearSearch = document.querySelector('[data-action="clear-search"]');
const searchToggle = document.querySelector('[data-action="search-toggle"]');

let activeSearchRequest = 0;
let activeSuggestionRequest = 0;
let suggestionTimer;
let isSearchSubmitted = false;

function setClearSearchState() {
  if (!clearSearch || !searchInput) return;
  clearSearch.classList.toggle("is-hidden", !searchInput.value);
}

function setSearchState(isOpen) {
  if (!searchForm || !searchInput || !searchToggle || !clearSearch) return;
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

if (searchToggle) {
  searchToggle.addEventListener("click", () => {
    if (!searchForm) return;

    if (!searchForm.classList.contains("is-open") && window.innerWidth <= 640) {
      setSearchState(true);
      return;
    }

    if (window.innerWidth <= 640 && !searchInput.value.trim()) {
      setSearchState(false);
      return;
    }

    searchForm.requestSubmit();
  });
}

document.addEventListener("pointerdown", (event) => {
  if (searchForm && !searchForm.contains(event.target)) {
    hideSearchSuggestions();
    if (searchForm.classList.contains("is-open")) {
      setSearchState(false);
    }
  }
});

if (searchForm) {
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const query = searchInput ? searchInput.value.trim() : "";

    if (query) {
      isSearchSubmitted = true;
      clearTimeout(suggestionTimer);
      hideSearchSuggestions();
      if (searchInput) searchInput.blur();
      showPage("search", false);
      window.history.pushState({}, "", "#search");
      searchTracks(query);
    }
  });
}

const suggestionsCache = new Map();
let activeSuggestionController = null;

if (searchInput) {
  searchInput.addEventListener("input", () => {
    isSearchSubmitted = false;
    setClearSearchState();
    clearTimeout(suggestionTimer);
    const query = searchInput.value.trim();

    if (!query) {
      hideSearchSuggestions();
      return;
    }

    if (suggestionsCache.has(query.toLowerCase())) {
      renderSuggestions(query, suggestionsCache.get(query.toLowerCase()));
      return;
    }

    suggestionTimer = window.setTimeout(() => loadSearchSuggestions(query), 60);
  });
}

if (clearSearch) {
  clearSearch.addEventListener("click", () => {
    isSearchSubmitted = false;
    if (searchInput) searchInput.value = "";
    setClearSearchState();
    hideSearchSuggestions();
    if (searchInput) searchInput.focus();
  });
}

function hideSearchSuggestions() {
  clearTimeout(suggestionTimer);
  activeSuggestionRequest += 1;
  if (activeSuggestionController) {
    activeSuggestionController.abort();
    activeSuggestionController = null;
  }
  if (searchSuggestions) {
    searchSuggestions.replaceChildren();
    searchSuggestions.classList.add("is-hidden");
  }
}

function renderSuggestions(query, songs) {
  if (isSearchSubmitted || !searchSuggestions || (searchInput && searchInput.value.trim().toLowerCase() !== query.toLowerCase())) return;

  const suggestions = songs
    .map((song) => ({
      title: song.name || "Unknown track",
      artist: song.artist?.name || "Unknown artist"
    }))
    .filter((song, index, allSongs) => allSongs.findIndex((item) => item.title === song.title && item.artist === song.artist) === index)
    .slice(0, 6);

  searchSuggestions.replaceChildren();

  if (suggestions.length === 0) {
    searchSuggestions.classList.add("is-hidden");
    return;
  }

  const fragment = document.createDocumentFragment();
  const searchIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 shrink-0 text-zinc-400"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>`;

  suggestions.forEach(({ title, artist }) => {
    const suggestion = document.createElement("button");
    suggestion.type = "button";
    suggestion.className = "search-suggestion";
    suggestion.setAttribute("role", "option");
    suggestion.innerHTML = `${searchIconSvg}<span><strong></strong><small></small></span>`;
    suggestion.querySelector("strong").textContent = title;
    suggestion.querySelector("small").textContent = artist;
    suggestion.addEventListener("click", () => {
      if (searchInput) searchInput.value = title;
      setClearSearchState();
      if (searchForm) searchForm.requestSubmit();
    });
    fragment.appendChild(suggestion);
  });

  searchSuggestions.appendChild(fragment);
  searchSuggestions.classList.remove("is-hidden");
}

async function loadSearchSuggestions(query) {
  const queryLower = query.toLowerCase();

  if (suggestionsCache.has(queryLower)) {
    renderSuggestions(query, suggestionsCache.get(queryLower));
    return;
  }

  if (activeSuggestionController) {
    activeSuggestionController.abort();
  }
  activeSuggestionController = new AbortController();

  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
      signal: activeSuggestionController.signal
    });
    if (!response.ok) return;
    const songs = await response.json();
    suggestionsCache.set(queryLower, songs);
    renderSuggestions(query, songs);
  } catch (error) {
    if (error.name === "AbortError") return;
    console.error("Search suggestions unavailable:", error);
  }
}

if (searchInput) {
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideSearchSuggestions();
      setSearchState(false);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      clearTimeout(suggestionTimer);
      hideSearchSuggestions();
      if (searchForm) searchForm.requestSubmit();
    }
  });
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
      artist: song.artist?.name || "Unknown artist",
      thumbnail: song.thumbnails?.find((item) => item?.url)?.url || `https://img.youtube.com/vi/${song.videoId}/hqdefault.jpg`
    }));
    currentTrackIndex = -1;
    trackHistory = [];
    forwardTrack = undefined;
    updateTrackButtons();

    songs.forEach((song) => {
      const title = song.name || "Unknown track";
      const artist = song.artist?.name || "Unknown artist";
      const thumbnail = song.thumbnails?.find((item) => item?.url)?.url || `https://img.youtube.com/vi/${song.videoId}/hqdefault.jpg`;
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
      card.querySelector("button").addEventListener("click", () => selectAndPlayTrack(song.videoId, title, artist, thumbnail));
      trackList.appendChild(card);
    });
    if (window.lucide?.createIcons) lucide.createIcons();
  } catch (error) {
    console.error(error);
    trackList.innerHTML = '<p class="muted-text">The music server is unavailable. Start it with <code>npm start</code>.</p>';
  }
}
