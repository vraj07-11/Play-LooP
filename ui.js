const menuButtons = document.querySelectorAll('[data-action="toggle-sidebar"]');
const closeButton = document.querySelector('[data-action="close-sidebar"]');
const sidebar = document.querySelector('[data-sidebar]');
const navLinks = document.querySelectorAll('[data-nav]');
const content = document.querySelector('[data-content]');
const profileButton = document.querySelector('[data-action="profile-button"]');

function showPage(pageName, updateUrl = true) {
  const page = pages[pageName] || pages.home;
  let pageBody;

  if (pageName === "search") {
    pageBody = '<div class="track-list" data-track-list><p class="muted-text">Search for a song to begin.</p></div>';
  } else if (pageName === "Download") {
    pageBody = `
      <div class="flex flex-col items-start gap-4 p-6 bg-zinc-900/60 rounded-2xl border border-zinc-800/80 max-w-xl">
        <div class="flex items-center gap-3">
          <img src="public/logo.svg" alt="Play LooP Logo" class="w-10 h-10 shrink-0" />
          <h3 class="text-lg font-normal text-white tracking-normal">Install Play LooP App</h3>
        </div>
        <p class="text-zinc-400 text-sm font-normal tracking-normal leading-relaxed">
          Install Play LooP on your desktop or mobile home screen for fast access, full-screen playback, and seamless offline listening.
        </p>
        <div id="pwaInstallStatus" class="w-full pt-1">
          <button type="button" data-action="install-pwa" class="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-normal tracking-normal rounded-full transition cursor-pointer shadow-sm">
            Install Desktop / Mobile App
          </button>
        </div>
      </div>
    `;
  } else {
    pageBody = `<div class="page-grid">
      ${page.cards.map((card) => `<article class="page-card"><h3>${card}</h3><p>Coming soon</p></article>`).join("")}
    </div>`;
  }

  content.innerHTML = `
    <div class="page-header${pageName === "search" ? " search-page-header" : ""}">
      <h2>${page.title}</h2>
      <p>${page.description}</p>
    </div>
    ${pageBody}
  `;

  if (pageName === "Download" && typeof setupPwaInstallButton === "function") {
    setupPwaInstallButton();
  }

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

function getPageFromLocation() {
  return window.location.hash.slice(1) || "home";
}

window.addEventListener("hashchange", () => showPage(getPageFromLocation(), false));
window.addEventListener("popstate", () => showPage(getPageFromLocation(), false));

showPage(getPageFromLocation(), false);
