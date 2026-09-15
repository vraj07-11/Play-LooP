const menuButtons = document.querySelectorAll('[data-action="toggle-sidebar"]');
const closeButton = document.querySelector('[data-action="close-sidebar"]');
const sidebar = document.querySelector('[data-sidebar]');
const navLinks = document.querySelectorAll('[data-nav]');

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

navLinks.forEach((navLink) => navLink.addEventListener("click", () => {
  navLink.classList.add("is-tapped");
  window.setTimeout(() => navLink.classList.remove("is-tapped"), 250);
}));

setSidebarState(false);

const searchForm = document.querySelector("[data-search-form]");
const searchInput = document.querySelector(".search-input");
const searchToggle = document.querySelector('[data-action="search-toggle"]');
const clearSearch = document.querySelector('[data-action="clear-search"]');

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
  setSearchState(!searchForm.classList.contains("is-open"));
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
    console.log("Searching for:", query);
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

