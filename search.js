let activeSearchRequest = 0;
let activeSuggestionRequest = 0;
let suggestionTimer;
let isSearchSubmitted = false;

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
  if (!searchForm.contains(event.target)) {
    hideSearchSuggestions();
    if (searchForm.classList.contains("is-open")) {
      setSearchState(false);
    }
  }
});

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const query = searchInput.value.trim();

  if (query) {
    isSearchSubmitted = true;
    clearTimeout(suggestionTimer);
    hideSearchSuggestions();
    searchInput.blur();
    showPage("search", false);
    window.history.pushState({}, "", "#search");
    searchTracks(query);
  }
});

searchInput.addEventListener("input", () => {
  isSearchSubmitted = false;
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
  isSearchSubmitted = false;
  searchInput.value = "";
  setClearSearchState();
  hideSearchSuggestions();
  searchInput.focus();
});

function hideSearchSuggestions() {
  clearTimeout(suggestionTimer);
  activeSuggestionRequest += 1;
  searchSuggestions.replaceChildren();
  searchSuggestions.classList.add("is-hidden");
}

async function loadSearchSuggestions(query) {
  const requestId = ++activeSuggestionRequest;

  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const songs = await response.json();
    if (isSearchSubmitted || requestId !== activeSuggestionRequest || !response.ok || searchInput.value.trim() !== query) return;

    const suggestions = songs
      .map((song) => ({
        title: song.name || "Unknown track",
        artist: song.artist?.name || "Unknown artist"
      }))
      .filter((song, index, allSongs) => allSongs.findIndex((item) => item.title === song.title && item.artist === song.artist) === index)
      .slice(0, 6);

    if (isSearchSubmitted || requestId !== activeSuggestionRequest) return;

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
    searchSuggestions.classList.toggle("is-hidden", suggestions.length === 0 || isSearchSubmitted);
    if (window.lucide?.createIcons) lucide.createIcons();
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
    clearTimeout(suggestionTimer);
    hideSearchSuggestions();
    searchForm.requestSubmit();
  }
});

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
