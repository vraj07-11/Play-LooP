let deferredPrompt;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const installBtn = document.querySelector('[data-action="install-pwa"]');
  if (installBtn) {
    installBtn.classList.remove("hidden");
  }
});

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  const installContainer = document.querySelector("#pwaInstallStatus");
  if (installContainer) {
    installContainer.innerHTML = '<p class="text-emerald-400 font-semibold mt-4">✓ Play LooP is installed on your device!</p>';
  }
});

function setupPwaInstallButton() {
  const installBtn = document.querySelector('[data-action="install-pwa"]');
  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          deferredPrompt = null;
        }
      } else {
        alert("Play LooP is already installed or your browser supports PWA installation via the address bar menu!");
      }
    });
  }
}

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('[PWA] Service Worker registered with scope:', reg.scope))
      .catch((err) => console.error('[PWA] Service Worker registration failed:', err));
  });
}
