const menuButtons = document.querySelectorAll('[data-action="toggle-sidebar"]');
const closeButton = document.querySelector('[data-action="close-sidebar"]');
const sidebar = document.querySelector('[data-sidebar]');
const navLinks = document.querySelectorAll('[data-nav]');
const content = document.querySelector('[data-content]');
const profileButton = document.querySelector('[data-action="profile-button"]');

function showPage(pageName, updateUrl = true) {
  const page = pages[pageName] || pages.home;
  content.innerHTML = `
    <div class="page-header">
      <h2>${page.title}</h2>
      <p>${page.description}</p>
    </div>
    <div class="page-grid">
      ${page.cards.map((card) => `<article class="page-card"><h3>${card}</h3><p>Coming soon</p></article>`).join("")}
    </div>
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
    showPage("search");
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

function getPageFromLocation() {
  return window.location.hash.slice(1) || "home";
}

window.addEventListener("hashchange", () => showPage(getPageFromLocation(), false));
window.addEventListener("popstate", () => showPage(getPageFromLocation(), false));

showPage(getPageFromLocation(), false);

