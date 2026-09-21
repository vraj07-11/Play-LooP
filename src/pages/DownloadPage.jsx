import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, Smartphone, Monitor, WifiOff } from 'lucide-react';

export default function DownloadPage() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installStatusMsg, setInstallStatusMsg] = useState('');

  useEffect(() => {
    const promptObj = window.deferredPwaPrompt || deferredPrompt;
    if (promptObj) {
      setDeferredPrompt(promptObj);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      window.deferredPwaPrompt = e;
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      window.deferredPwaPrompt = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
      setInstallStatusMsg('Play LooP is installed on your device!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerInstall = async (promptObj) => {
    try {
      promptObj.prompt();
      const { outcome } = await promptObj.userChoice;
      if (outcome === 'accepted') {
        window.deferredPwaPrompt = null;
        setDeferredPrompt(null);
        setIsInstalled(true);
      }
    } catch (err) {
      console.warn('Install prompt error:', err);
    }
  };

  const handleInstallClick = async () => {
    const promptObj = window.deferredPwaPrompt || deferredPrompt;
    if (promptObj) {
      await triggerInstall(promptObj);
    } else if (isInstalled) {
      setInstallStatusMsg('Play LooP is already installed on your device!');
    } else {
      const manifestData = {
        name: "Play LooP",
        short_name: "Play LooP",
        start_url: "/",
        display: "standalone",
        background_color: "#000000",
        theme_color: "#000000"
      };
      const blob = new Blob([JSON.stringify(manifestData, null, 2)], { type: "application/json" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'playloop.webmanifest';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setInstallStatusMsg('Initiated Play LooP PWA app download!');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="page-header">
        <h2>Download App</h2>
        <p>Take Play LooP with you wherever you go.</p>
      </div>

      <div className="flex flex-col items-start gap-4 p-6 bg-zinc-900/80 rounded-2xl border border-zinc-800 max-w-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="Play LooP Logo" className="w-12 h-12 shrink-0" />
          <div>
            <h3 className="text-xl font-semibold text-white">Install Play LooP App</h3>
            <p className="text-xs text-zinc-400">Web App & Progressive Web App (PWA)</p>
          </div>
        </div>

        <p className="text-zinc-300 text-sm leading-relaxed">
          Install Play LooP on your desktop or mobile home screen for fast access, full-screen playback, and seamless offline listening experience.
        </p>

        {isInstalled ? (
          <div className="flex items-center gap-2 text-emerald-400 font-medium text-sm pt-2">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span>Play LooP is installed on your device!</span>
          </div>
        ) : (
          <div className="w-full pt-2">
            <button
              type="button"
              onClick={handleInstallClick}
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-full transition-all duration-200 shadow-md hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Download className="w-5 h-5" />
              <span>Install Desktop / Mobile App</span>
            </button>
            {installStatusMsg && (
              <p className="text-emerald-400 text-xs font-medium mt-3">{installStatusMsg}</p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
        <div className="page-card flex flex-col justify-between">
          <div className="space-y-2">
            <div className="p-2 w-fit rounded-lg bg-zinc-800 text-emerald-400 mb-3">
              <Smartphone className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-medium text-white">Mobile App</h3>
            <p className="text-sm text-zinc-400">Install directly from your mobile browser for a native-like app experience on iOS and Android.</p>
          </div>
        </div>

        <div className="page-card flex flex-col justify-between">
          <div className="space-y-2">
            <div className="p-2 w-fit rounded-lg bg-zinc-800 text-emerald-400 mb-3">
              <Monitor className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-medium text-white">Desktop App</h3>
            <p className="text-sm text-zinc-400">Add Play LooP to your Windows, Mac, or Linux desktop for instant launch from taskbar or dock.</p>
          </div>
        </div>

        <div className="page-card flex flex-col justify-between">
          <div className="space-y-2">
            <div className="p-2 w-fit rounded-lg bg-zinc-800 text-emerald-400 mb-3">
              <WifiOff className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-medium text-white">Offline Listening</h3>
            <p className="text-sm text-zinc-400">Fast caching enables smooth listening and quick load times even on poor network connections.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
