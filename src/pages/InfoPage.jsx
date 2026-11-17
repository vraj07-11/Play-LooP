import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ExternalLink,
  Mail,
  Smartphone,
  Moon,
  RefreshCw,
  Radio,
  Music,
  Shield,
  Sliders,
  Database,
  Layers,
  Sparkles
} from 'lucide-react';
import Footer from '../components/Footer.jsx';

export default function InfoPage({ currentView, setCurrentView }) {
  const [activeFaq, setActiveFaq] = useState(null);
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactError, setContactError] = useState(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: 'General Feedback / Suggestion', message: '' });

  const pageSlug = (currentView || '').toLowerCase().replace(/_/g, '-');

  // Dynamic document title and SEO meta tag updates
  useEffect(() => {
    const titles = {
      'how-it-works': 'How It Works - Play LooP Architecture & Audio Engine',
      'features': 'Features & Capabilities - Play LooP Web Music Player',
      'faq': 'Frequently Asked Questions - Play LooP',
      'blog': 'Engineering & Architecture Blog - Play LooP',
      'about': 'About Play LooP - Open-Source Web Music Streaming',
      'contact': 'Contact & Support - Play LooP',
      'privacy-policy': 'Privacy Policy - Play LooP',
      'terms-of-service': 'Terms of Service - Play LooP',
      'terms': 'Terms of Service - Play LooP',
      'cookie-policy': 'Cookie & Storage Policy - Play LooP',
      'dmca': 'DMCA & Copyright Policy - Play LooP',
      'disclaimer': 'Legal Disclaimer - Play LooP'
    };

    const descriptions = {
      'how-it-works': 'In-depth architectural breakdown of Play LooP: low-latency audio delivery, dual-buffer crossfades, mobile gestures, and anonymous edge sync across 480 million tracks.',
      'features': 'Complete specifications of Play LooP: AMOLED dark design, mobile gestures, universal playlist importer, 30s Loops previews, scrobbler analytics, and passwordless sync.',
      'faq': 'Comprehensive answers regarding ad-free streaming, 480M+ track catalog, gesture controls, playlist importing, and zero-login device sync.',
      'blog': 'Engineering articles on browser audio engines, dual-buffer crossfades, mobile touch gesture engineering, and distributed edge sync.',
      'about': 'The educational developer story, open-source principles, and architecture behind Play LooP by Vraj Gajera.',
      'contact': 'Direct contact channels, GitHub repository links, and communication form for Play LooP.',
      'privacy-policy': 'Local-first privacy model explaining client-side storage, zero advertising trackers, and anonymous device synchronization.',
      'terms-of-service': 'Terms of Service governing personal non-commercial streaming, educational scope, and client-side playback on Play LooP.',
      'terms': 'Terms of Service governing personal non-commercial streaming, educational scope, and client-side playback on Play LooP.',
      'cookie-policy': 'Technical breakdown of browser LocalStorage usage and zero tracking cookies.',
      'dmca': 'Copyright compliance procedure and takedown notice guidelines for rights holders.',
      'disclaimer': 'Educational disclosure and technical details regarding third-party audio indexes and streaming protocols.'
    };

    const title = titles[pageSlug] || 'Play LooP - Modern Music Player';
    const desc = descriptions[pageSlug] || 'Play LooP is a high-performance, ad-free web music player.';

    document.title = title;
    let metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', desc);
    }
  }, [pageSlug]);

  const goHome = (e) => {
    e.preventDefault();
    if (setCurrentView) setCurrentView('home');
    window.location.hash = '#/';
    const mainContent = document.querySelector('.app-content');
    if (mainContent) mainContent.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateTo = (e, slug) => {
    e.preventDefault();
    if (setCurrentView) setCurrentView(slug);
    window.location.hash = `#/${slug}`;
    const mainContent = document.querySelector('.app-content');
    if (mainContent) mainContent.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const copyEmail = () => {
    navigator.clipboard.writeText('gajeravraj593@gmail.com');
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message) return;

    setContactLoading(true);
    setContactError(null);

    let sent = false;

    // 1. Direct email dispatch to Vraj's inbox via FormSubmit AJAX (runs in background without redirect)
    try {
      const response = await fetch('https://formsubmit.co/ajax/gajeravraj593@gmail.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          name: contactForm.name,
          email: contactForm.email,
          _subject: `[Play LooP] ${contactForm.subject}: ${contactForm.name}`,
          subject: contactForm.subject,
          message: contactForm.message,
          _replyto: contactForm.email,
          _template: 'table',
          _captcha: 'false'
        })
      });

      const resData = await response.json().catch(() => ({}));
      if (response.ok || resData.success === 'true' || resData.success === true || (resData.message && resData.message.includes('sent'))) {
        sent = true;
      }
    } catch (err) {
      console.warn('FormSubmit network error:', err);
    }

    // 2. Persist to Turso database as backup
    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const dbRes = await fetch(`${apiBase}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm)
      });
      if (dbRes.ok) {
        sent = true;
      }
    } catch (err) {
      console.warn('Backend contact backup error:', err);
    }

    setContactLoading(false);

    if (sent) {
      setContactSubmitted(true);
    } else {
      setContactError('Unable to dispatch message right now. Please verify your internet connection or email directly to gajeravraj593@gmail.com.');
    }
  };

  const renderContent = () => {
    switch (pageSlug) {
      case 'how-it-works':
        return (
          <div className="space-y-12 max-w-4xl">
            <header className="space-y-4 border-b border-white/10 pb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-400 font-mono">
                Architecture & Audio Engine
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                How Play LooP Works
              </h1>
              <p className="text-base text-zinc-400 leading-relaxed">
                Play LooP was conceived as an open-source educational exploration into modern web audio architecture. By dismantling the commercial bloat typical of mainstream streaming platforms—such as tracking pixels, promotional popups, audio advertisements, and forced account paywalls—Play LooP delivers a clean, high-performance listening client accessing over 480 million tracks worldwide.
              </p>
            </header>

            <section className="space-y-12 text-zinc-300 text-sm sm:text-base leading-relaxed">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white font-mono text-sm font-bold">1</div>
                  <h2 className="text-xl font-bold text-white">Distributed Audio Resolution & Edge Proxying</h2>
                </div>
                <p className="text-zinc-400">
                  When a listener searches for a song, album, or artist, the query is dispatched through our lightweight server proxy layer. Rather than maintaining a costly, monolithic proprietary file store, Play LooP dynamically queries open, distributed audio indices and public media delivery networks.
                </p>
                <p className="text-zinc-400">
                  The proxy engine resolves high-fidelity audio streams in real time, normalizes track titles by stripping noisy video tags, artist suffixes, and redundant watermarks, and pulls high-resolution album art into an edge caching layer. This keeps response times under 150 milliseconds across global endpoints while ensuring that track metadata remains clean and consistent.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white font-mono text-sm font-bold">2</div>
                  <h2 className="text-xl font-bold text-white">Adaptive Low-Latency Streaming Pipeline</h2>
                </div>
                <p className="text-zinc-400">
                  Traditional web audio players often attempt to download large monolithic audio files before starting playback. On fluctuating 4G or 5G mobile connections, this results in noticeable spinning loaders and initial audio stalls.
                </p>
                <p className="text-zinc-400">
                  Play LooP utilizes an adaptive streaming pipeline leveraging chunked HTTP Range requests and HTTP Live Streaming (HLS) protocols. Tracks are segmented into sequential, micro-buffered audio packets. Playback starts the instant the first segment reaches the client browser—often in less than 200 milliseconds. The player continuously monitors network throughput, adjusting buffering thresholds to ensure uninterrupted playback even through subway tunnels or crowded cell towers.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white font-mono text-sm font-bold">3</div>
                  <h2 className="text-xl font-bold text-white">Dual-Buffer Engine & Gapless Crossfading</h2>
                </div>
                <p className="text-zinc-400">
                  Eliminating silence between consecutive songs is notoriously challenging in standard browser environments due to single-threaded audio element limitations. Play LooP resolves this through an internal dual-buffer architecture:
                </p>
                <div className="border border-white/10 rounded-xl p-5 bg-[#0a0a0c] space-y-3">
                  <div className="font-mono text-xs text-zinc-400 uppercase tracking-wider">Audio Pipeline Coordination</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                    <div className="p-3 rounded-lg bg-black border border-white/10 space-y-1">
                      <div className="text-white font-bold">Primary Slot (Slot A)</div>
                      <div className="text-zinc-400">Active playback, real-time audio time updates, and scrobbler tracking.</div>
                    </div>
                    <div className="p-3 rounded-lg bg-black border border-white/10 space-y-1">
                      <div className="text-white font-bold">Secondary Slot (Slot B)</div>
                      <div className="text-zinc-400">Silently preloads the upcoming track header and initial audio frames 10 seconds before track completion.</div>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed pt-1">
                    When the active track reaches the user-selected crossfade threshold (customizable between 1 and 12 seconds), the audio engine executes simultaneous linear volume curve attenuation: Slot A ramps down while Slot B ramps up, achieving completely seamless transitions.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white font-mono text-sm font-bold">4</div>
                  <h2 className="text-xl font-bold text-white">Wall-Clock Scrobbler & Listening Analytics</h2>
                </div>
                <p className="text-zinc-400">
                  Unlike basic players that simply increment play counts upon clicking a track, Play LooP features a precise wall-clock scrobbler. The scrobbler tracks active listening seconds, filtering out rapid scrubbing and quick skips.
                </p>
                <p className="text-zinc-400">
                  A track is officially scrobbled only after you have genuinely listened to at least 30 seconds or 50% of its total duration. These verified playback events compile your personalized Profile statistics—including total minutes streamed, top artists, and most-played tracks—without transmitting your private habits to third-party data aggregators.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white font-mono text-sm font-bold">5</div>
                  <h2 className="text-xl font-bold text-white">Loops: 30-Second Random Snippet Discovery</h2>
                </div>
                <p className="text-zinc-400">
                  Discovering new music is often hampered by the friction of having to listen through lengthy track intros before knowing if a song resonates with you.
                </p>
                <p className="text-zinc-400">
                  The Loops engine solves this by dynamically extracting random 30-second audio segments from indexed tracks. Listeners can swipe through a fast, continuous feed of 30-second previews. If a snippet catches your ear, a single tap adds the complete song to your queue or favorites, dramatically accelerating music discovery across unfamiliar genres and artists.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white font-mono text-sm font-bold">6</div>
                  <h2 className="text-xl font-bold text-white">Language-Driven Personalization Pipeline</h2>
                </div>
                <p className="text-zinc-400">
                  Music preferences are deeply tied to regional languages and linguistic culture. On initial setup, Play LooP invites users to select their preferred music languages.
                </p>
                <p className="text-zinc-400">
                  The recommendation engine processes these selections to filter discovery carousels, trending charts, and suggested playlists accordingly. Listeners are served fresh music matching their cultural preferences without needing invasive tracking cookies or personal profile questionnaires.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white font-mono text-sm font-bold">7</div>
                  <h2 className="text-xl font-bold text-white">Local-First Storage & Passwordless Edge Sync</h2>
                </div>
                <p className="text-zinc-400">
                  Play LooP rejects the conventional requirement that users must hand over an email, phone number, or social login just to save a playlist. Everything you do—your created playlists, liked tracks, listening history, and sound preferences—is saved directly on your device in browser LocalStorage.
                </p>
                <p className="text-zinc-400">
                  To sync data across phones, laptops, and tablets, Play LooP assigns your client an anonymous cryptographic Sync ID. Backed by a distributed Turso LibSQL edge database, entering your Sync ID on another device securely replicates your playlists, profile avatar, and history in seconds—completely anonymously.
                </p>
              </div>
            </section>
          </div>
        );

      case 'features':
        return (
          <div className="space-y-12 max-w-4xl">
            <header className="space-y-4 border-b border-white/10 pb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-400 font-mono">
                System Capabilities
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Features & Capabilities
              </h1>
              <p className="text-base text-zinc-400 leading-relaxed">
                Play LooP is built from the ground up to prioritize performance, battery longevity, tactile mobile gestures, and privacy. Here is a comprehensive overview of the capabilities built into the platform.
              </p>
            </header>

            <div className="space-y-12">
              {/* Playback & Audio */}
              <section className="space-y-6">
                <div className="flex items-center gap-2 text-white font-bold text-lg border-b border-white/10 pb-3">
                  <Music className="w-5 h-5 text-white" />
                  <span>Playback & Audio Engineering</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-5 rounded-xl border border-white/10 bg-[#08080a] space-y-2">
                    <h3 className="text-base font-bold text-white">480 Million+ Track Library</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      Instant access to an expansive catalog spanning international chart-toppers, regional languages, indie releases, classical archives, and soundtrack scores.
                    </p>
                  </div>
                  <div className="p-5 rounded-xl border border-white/10 bg-[#08080a] space-y-2">
                    <h3 className="text-base font-bold text-white">Adaptive HLS Streaming</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      Micro-chunked stream delivery eliminates loading spin-wheels, ensuring rapid track startup and continuous playback even on erratic cellular data connections.
                    </p>
                  </div>
                  <div className="p-5 rounded-xl border border-white/10 bg-[#08080a] space-y-2">
                    <h3 className="text-base font-bold text-white">Configurable Audio Crossfade</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      Smoothly blend adjacent tracks with dual-slot audio fading. Customize transition duration between 1 and 12 seconds in Settings for DJ-style continuous music.
                    </p>
                  </div>
                  <div className="p-5 rounded-xl border border-white/10 bg-[#08080a] space-y-2">
                    <h3 className="text-base font-bold text-white">Synchronized Dynamic Lyrics</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      Real-time synchronized LRC lyrics track playback line by line with auto-scroll. Tap any lyrics line to jump playback directly to that exact vocal moment.
                    </p>
                  </div>
                  <div className="p-5 rounded-xl border border-white/10 bg-[#08080a] space-y-2 md:col-span-2">
                    <h3 className="text-base font-bold text-white">Loops 30-Second Discovery Mode</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      Audition unfamiliar tracks rapidly through continuous 30-second random snippet previews. Swipe between loops to discover new favorite songs in seconds.
                    </p>
                  </div>
                </div>
              </section>

              {/* Mobile Gestures */}
              <section className="space-y-6">
                <div className="flex items-center gap-2 text-white font-bold text-lg border-b border-white/10 pb-3">
                  <Smartphone className="w-5 h-5 text-white" />
                  <span>Modern Mobile Gestures</span>
                </div>
                <div className="p-6 rounded-xl border border-white/10 bg-[#08080a] space-y-4">
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Mainstream music apps frequently rely on tiny tap targets that are frustrating to use with one hand. Play LooP features tactile mobile-first gesture controls engineered for smooth thumb navigation:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-mono">
                    <div className="p-4 rounded-lg bg-black border border-white/10 space-y-2">
                      <div className="text-white font-bold text-sm">Swipe Miniplayer Up</div>
                      <div className="text-zinc-400">Glide your finger upwards on the bottom miniplayer to expand into the full player screen.</div>
                    </div>
                    <div className="p-4 rounded-lg bg-black border border-white/10 space-y-2">
                      <div className="text-white font-bold text-sm">Double-Tap Cover Seek</div>
                      <div className="text-zinc-400">Double-tap the left side of the cover to rewind 10s; double-tap the right side to fast-forward 10s.</div>
                    </div>
                    <div className="p-4 rounded-lg bg-black border border-white/10 space-y-2">
                      <div className="text-white font-bold text-sm">Double-Tap Center Like</div>
                      <div className="text-zinc-400">Double-tap the middle of the album artwork to trigger an instant animated heart burst and save the song.</div>
                    </div>
                    <div className="p-4 rounded-lg bg-black border border-white/10 space-y-2">
                      <div className="text-white font-bold text-sm">Swipe Cover to Skip</div>
                      <div className="text-zinc-400">Swipe left on the album cover to jump to the next track; swipe right to replay or move to the previous track.</div>
                    </div>
                    <div className="p-4 rounded-lg bg-black border border-white/10 space-y-2">
                      <div className="text-white font-bold text-sm">Swipe Cover Up for Lyrics</div>
                      <div className="text-zinc-400">Swipe upward directly on the album artwork to smoothly transition into full-screen synchronized lyrics.</div>
                    </div>
                    <div className="p-4 rounded-lg bg-black border border-white/10 space-y-2">
                      <div className="text-white font-bold text-sm">Horizontal Screen Swipe</div>
                      <div className="text-zinc-400">Swipe horizontally across pages to switch seamlessly between Home, Search, Library, and Profile.</div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Design & Display */}
              <section className="space-y-6">
                <div className="flex items-center gap-2 text-white font-bold text-lg border-b border-white/10 pb-3">
                  <Moon className="w-5 h-5 text-white" />
                  <span>AMOLED Dark Theme & Battery Conservation</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-5 rounded-xl border border-white/10 bg-[#08080a] space-y-2">
                    <h3 className="text-base font-bold text-white">Pure Monochrome AMOLED (#000000)</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      Engineered with deep, true-black surfaces that turn off individual pixels on OLED/AMOLED mobile screens, significantly reducing display power consumption and battery drain during extended listening.
                    </p>
                  </div>
                  <div className="p-5 rounded-xl border border-white/10 bg-[#08080a] space-y-2">
                    <h3 className="text-base font-bold text-white">Responsive Multi-Device UI</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      Carefully adapted viewports scale cleanly across small smartphone screens, tablets, dual-screen foldables, laptops, and ultra-wide desktop monitors without awkward whitespace or broken navigation bars.
                    </p>
                  </div>
                </div>
              </section>

              {/* Library & Sync */}
              <section className="space-y-6">
                <div className="flex items-center gap-2 text-white font-bold text-lg border-b border-white/10 pb-3">
                  <RefreshCw className="w-5 h-5 text-white" />
                  <span>Library Management & Universal Sync</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-5 rounded-xl border border-white/10 bg-[#08080a] space-y-2">
                    <h3 className="text-base font-bold text-white">Universal Playlist Importer</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      Migrate your existing music collections with zero manual effort. Paste public playlist links from popular services or raw tracklists to automatically map and save them to your personal Play LooP library.
                    </p>
                  </div>
                  <div className="p-5 rounded-xl border border-white/10 bg-[#08080a] space-y-2">
                    <h3 className="text-base font-bold text-white">Passwordless Multi-Device Sync</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      Keep your playlists, liked songs, profile name, and custom avatar in sync across your phone, tablet, and desktop. Simply copy your anonymous Sync ID from Settings and import it on any other device.
                    </p>
                  </div>
                  <div className="p-5 rounded-xl border border-white/10 bg-[#08080a] space-y-2">
                    <h3 className="text-base font-bold text-white">Built-in Scrobbler & Listening Reports</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      Accurate wall-clock tracking records plays past 30 seconds or 50% completion. Review your all-time streamed minutes, most-played tracks, and favorite artists in your personal Profile dashboard.
                    </p>
                  </div>
                  <div className="p-5 rounded-xl border border-white/10 bg-[#08080a] space-y-2">
                    <h3 className="text-base font-bold text-white">Preferred Language Filtering</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      Tailor your homepage discovery feeds and algorithm mixes by selecting your primary listening languages (Hindi, English, Punjabi, Tamil, Telugu, Spanish, and more).
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        );

      case 'faq':
        const faqs = [
          {
            q: 'Why was Play LooP created and is it really free?',
            a: 'Play LooP was created as an educational, non-commercial software project by Vraj Gajera to study low-latency web audio streaming, responsive gesture engineering, and anonymous edge database synchronization. It is 100% free forever: there are no subscription fees, no locked premium tiers, no banner ads, and no audio sponsor interruptions.'
          },
          {
            q: 'How does Play LooP access over 480 million songs without ads?',
            a: 'Play LooP operates as a lightweight client and proxy interface that resolves media streams dynamically from public audio indices and distributed media nodes. Because it is an independent learning experiment with zero commercial monetization or advertising overhead, audio is streamed directly to the browser without injecting audio ads.'
          },
          {
            q: 'Do I need an account, password, or email to use Play LooP?',
            a: 'No. Play LooP requires absolutely no signup, login, password, or email address. All your preferences, custom playlists, liked tracks, and listening history are stored directly on your own device in browser LocalStorage by default.'
          },
          {
            q: 'How does multi-device sync work without an account?',
            a: 'When you launch Play LooP, the app generates an anonymous, random cryptographic Sync ID (UUID). When you want to sync your library to a phone, laptop, or tablet, open Settings, copy your Sync ID, and paste it into the Sync section on your second device. Your playlists, liked songs, listening history, and profile details will replicate securely through our Turso LibSQL edge database.'
          },
          {
            q: 'What mobile gestures are supported on phones and tablets?',
            a: 'Play LooP includes a suite of tactile touch gestures designed for easy one-handed mobile use: swipe up on the bottom miniplayer to expand the full player; double-tap the left or right side of the album cover to skip 10 seconds backward or forward; double-tap the center of the cover to like a track with an animated heart burst; swipe horizontally across the cover to change songs; swipe up on the cover to open synchronized lyrics; and swipe horizontally across views to switch tabs.'
          },
          {
            q: 'What is the Loops feature and how does it work?',
            a: 'Loops is a fast-paced discovery tool that pulls random 30-second audio snippets from songs across the catalog. Instead of listening through lengthy song intros to decide if you like a track, you can swipe through snippets in rapid succession. If you hear something you love, tap once to add the full track to your queue or favorites.'
          },
          {
            q: 'How does the Scrobbler work and what statistics does it track?',
            a: 'The built-in scrobbler tracks actual wall-clock playback time. To prevent false plays from accidental clicks or quick scrubbing, a track is only counted as scrobbled once you have listened for at least 30 seconds or 50% of its total duration. Your scrobbles compile personalized statistics visible on your Profile page, including total listening minutes, top songs, and favorite artists.'
          },
          {
            q: 'Can I import playlists from Spotify or YouTube?',
            a: 'Yes. In Your Library, open the Universal Playlist Importer and paste the link to any public playlist from Spotify, YouTube, or YouTube Music (or paste a list of track titles). Play LooP resolves and links each song title to high-quality audio streams automatically, recreating the playlist in your personal library in seconds.'
          },
          {
            q: 'Why does Play LooP use a pure black AMOLED design?',
            a: 'The application uses a true black (#000000) monochrome aesthetic specifically optimized for OLED and AMOLED displays. Because AMOLED pixels completely switch off when displaying pure black, this theme reduces battery drain during long listening sessions and provides high-contrast, comfortable viewing in dim lighting.'
          },
          {
            q: 'How do preferred languages affect recommendations?',
            a: 'When you choose your preferred languages (such as English, Hindi, Punjabi, Spanish, Tamil, etc.) during setup or in Settings, Play LooP personalizes your Home discovery carousels, top charts, and artist recommendations to prioritize music in your chosen languages.'
          },
          {
            q: 'Is Play LooP open source?',
            a: 'Yes. The complete source code is public and open source on GitHub at https://github.com/vraj07-11/Play-LooP. Developers, students, and audio enthusiasts are welcome to inspect the architecture, review the code, or submit contributions.'
          },
          {
            q: 'How do I contact the maintainer or report an issue?',
            a: 'You can submit bug reports or stream issues directly via GitHub Issues (https://github.com/vraj07-11/Play-LooP/issues), send an email to gajeravraj593@gmail.com, or connect on LinkedIn (https://www.linkedin.com/in/vraj-gajera-260a96377).'
          }
        ];

        return (
          <div className="space-y-12 max-w-4xl">
            <header className="space-y-4 border-b border-white/10 pb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-400 font-mono">
                Knowledge Base
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Frequently Asked Questions
              </h1>
              <p className="text-base text-zinc-400 leading-relaxed">
                Clear answers regarding streaming performance, mobile gestures, anonymous syncing, playlist imports, and audio engineering.
              </p>
            </header>

            <div className="divide-y divide-white/10">
              {faqs.map((faq, i) => {
                const isOpen = activeFaq === i;
                return (
                  <div key={i} className="py-5">
                    <button
                      type="button"
                      onClick={() => setActiveFaq(isOpen ? null : i)}
                      className="w-full text-left flex items-center justify-between gap-4 font-semibold text-white hover:text-zinc-300 transition cursor-pointer"
                    >
                      <span className="text-base sm:text-lg">{faq.q}</span>
                      {isOpen ? (
                        <ChevronUp className="w-5 h-5 text-zinc-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-zinc-400 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <p className="mt-4 text-sm sm:text-base text-zinc-400 leading-relaxed pr-6">
                        {faq.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'blog':
        const articles = [
          {
            title: 'Architecting a Zero-Login Web Music Client: Local-First State and Edge Sync',
            date: 'November 2026',
            readTime: '7 min read',
            category: 'Architecture',
            summary: 'Modern web applications have conditioned users to expect mandatory authentication walls before accessing basic features. This article breaks down why we designed Play LooP with a local-first philosophy: storing playlists and playback history in browser LocalStorage by default, and employing anonymous cryptographic Sync IDs replicated across distributed Turso LibSQL edge databases for multi-device sync without accounts.'
          },
          {
            title: 'Eliminating Playback Gaps: Dual-Buffer Audio Pipelines and Linear Crossfading in the Browser',
            date: 'October 2026',
            readTime: '6 min read',
            category: 'Audio Engineering',
            summary: 'Standard HTML5 audio elements inherently suffer from buffer allocation latency when switching source URLs, leading to audible gaps between tracks. Here is a technical walkthrough of how Play LooP runs two concurrent audio slots (Slot A and Slot B), pre-buffering upcoming audio packets 10 seconds ahead and applying simultaneous inverse volume curves for seamless, configurable crossfades.'
          },
          {
            title: 'Designing Fluid Mobile Gestures for Web-Based Media Players',
            date: 'September 2026',
            readTime: '5 min read',
            category: 'Mobile UX',
            summary: 'Touch interactions on mobile browsers are frequently sluggish or prone to collision with native viewport scrolling. We explore the implementation of touch-action containment, pointer velocity thresholds, double-tap seek detection, and smooth miniplayer expansion gestures that provide an app-native tactile feel inside responsive web viewports.'
          },
          {
            title: 'The Loops Discovery Engine: Dynamic 30-Second Random Sampling for Rapid Music Discovery',
            date: 'August 2026',
            readTime: '5 min read',
            category: 'Algorithms',
            summary: 'Listeners often spend more time skipping song intros than enjoying new music. This post examines how Play LooP generates dynamic 30-second random preview segments on the fly, streaming micro-bursts of audio to let users audition dozens of songs per minute before adding full tracks to their personal collections.'
          }
        ];

        return (
          <div className="space-y-12 max-w-4xl">
            <header className="space-y-4 border-b border-white/10 pb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-400 font-mono">
                Engineering & Research
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Engineering Blog
              </h1>
              <p className="text-base text-zinc-400 leading-relaxed">
                Technical articles on web audio streaming pipelines, mobile touch gesture engineering, local-first architectures, and low-latency audio protocols.
              </p>
            </header>

            <div className="space-y-10">
              {articles.map((art, idx) => (
                <article key={idx} className="border-b border-white/10 pb-10 space-y-3">
                  <div className="flex items-center gap-3 text-xs font-mono text-zinc-500">
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-300">{art.category}</span>
                    <span>{art.date}</span>
                    <span>•</span>
                    <span>{art.readTime}</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white hover:text-zinc-200 transition">
                    {art.title}
                  </h2>
                  <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
                    {art.summary}
                  </p>
                </article>
              ))}
            </div>
          </div>
        );

      case 'about':
        return (
          <div className="space-y-12 max-w-4xl">
            <header className="space-y-4 border-b border-white/10 pb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-400 font-mono">
                Developer Background & Philosophy
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                About Play LooP
              </h1>
              <p className="text-base text-zinc-400 leading-relaxed">
                An open-source, non-commercial software project built for learning, experimentation, and pure listening pleasure without advertisements, paywalls, or personal data tracking.
              </p>
            </header>

            <div className="space-y-10 text-zinc-300 text-sm sm:text-base leading-relaxed">
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-white">The Project & Origin</h2>
                <p>
                  Play LooP is developed and maintained by <strong>Vraj Gajera</strong> as an independent engineering initiative. The project was created purely for learning and educational purposes: to experiment with modern web audio APIs, low-latency stream proxying, mobile touch gestures, and local-first data architecture.
                </p>
                <p>
                  The project has never been commercially marketed, promoted, or monetized. It does not display banner ads, does not play audio promotions, and does not sell listening metrics. In an era where mainstream commercial streaming services are increasingly congested with video carousels, algorithmic paywalls, and privacy-invasive analytics, Play LooP explores what an audio player looks like when speed, minimalism, and user privacy are prioritized above all else.
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-bold text-white">Core Architectural Principles</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-white/10 bg-[#08080a] space-y-2">
                    <div className="font-bold text-white text-base">Zero Ads & Absolute Privacy</div>
                    <p className="text-xs sm:text-sm text-zinc-400">
                      No commercial advertisements, third-party trackers, or marketing analytics. Your listening habits belong solely to you.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-white/10 bg-[#08080a] space-y-2">
                    <div className="font-bold text-white text-base">Local-First Storage</div>
                    <p className="text-xs sm:text-sm text-zinc-400">
                      Playlists, favorites, and settings live directly in browser LocalStorage. No email or password creation required.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-white/10 bg-[#08080a] space-y-2">
                    <div className="font-bold text-white text-base">AMOLED Battery Conservation</div>
                    <p className="text-xs sm:text-sm text-zinc-400">
                      A pure black (#000000) theme turns off individual OLED pixels, preserving battery life during extended listening.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-white/10 bg-[#08080a] space-y-2">
                    <div className="font-bold text-white text-base">Open Source Transparency</div>
                    <p className="text-xs sm:text-sm text-zinc-400">
                      The entire codebase is open source on GitHub for community inspection, educational learning, and contribution.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-bold text-white">Key Capabilities At A Glance</h2>
                <ul className="list-disc pl-5 space-y-2 text-zinc-400">
                  <li><strong>Extensive Catalog:</strong> Access to a massive catalog of over 480 million songs worldwide.</li>
                  <li><strong>Tactile Mobile Gestures:</strong> Miniplayer swipe-to-expand, double-tap 10s seek, double-tap to like, cover swipe to change songs, and swipe up to view lyrics.</li>
                  <li><strong>Universal Playlist Importer:</strong> Easily import your playlists from Spotify, YouTube, or raw text lists.</li>
                  <li><strong>Anonymous Multi-Device Sync:</strong> Sync playlists, profile avatar, and history across devices using a private Sync ID backed by Turso LibSQL.</li>
                  <li><strong>Built-in Scrobbler:</strong> Wall-clock listening tracking past 30 seconds or 50% duration powers detailed profile statistics.</li>
                  <li><strong>Loops 30s Snippet Feed:</strong> Rapidly preview 30-second random song segments for fast music discovery.</li>
                  <li><strong>Language Personalization:</strong> Recommendations, mixes, and charts tailored to your selected listening languages.</li>
                </ul>
              </div>

              <div className="pt-6 border-t border-white/10 space-y-4">
                <h3 className="text-lg font-bold text-white">Connect & Open Source Links</h3>
                <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
                  <a
                    href="https://github.com/vraj07-11/Play-LooP"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#141416] hover:bg-[#202024] border border-white/10 text-white transition cursor-pointer"
                  >
                    <span>GitHub Repository</span>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                  </a>
                  <a
                    href="https://www.linkedin.com/in/vraj-gajera-260a96377"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#141416] hover:bg-[#202024] border border-white/10 text-white transition cursor-pointer"
                  >
                    <span>LinkedIn Profile</span>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                  </a>
                  <a
                    href="mailto:gajeravraj593@gmail.com"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#141416] hover:bg-[#202024] border border-white/10 text-white transition cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5 text-zinc-400" />
                    <span>gajeravraj593@gmail.com</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        );

      case 'contact':
        return (
          <div className="space-y-12 max-w-4xl">
            <header className="space-y-4 border-b border-white/10 pb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-400 font-mono">
                Get In Touch
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Contact & Support
              </h1>
              <p className="text-base text-zinc-400 leading-relaxed">
                Play LooP is maintained directly by Vraj Gajera. Whether you have technical feedback, encountered a playback issue, want to suggest a feature, or simply wish to say hello, feel free to reach out through any of the channels below.
              </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-6 text-sm sm:text-base text-zinc-300 leading-relaxed">
                <div>
                  <h2 className="text-lg font-bold text-white mb-2">Direct Email</h2>
                  <p className="text-zinc-400 text-sm mb-3">
                    For technical inquiries, contributions, feedback, or DMCA requests:
                  </p>
                  <div className="inline-flex items-center gap-3 font-mono text-sm bg-black border border-white/15 px-3.5 py-2.5 rounded-lg">
                    <span className="text-white">gajeravraj593@gmail.com</span>
                    <button
                      type="button"
                      onClick={copyEmail}
                      className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition cursor-pointer"
                    >
                      {copiedEmail ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedEmail ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10 space-y-2">
                  <h2 className="text-lg font-bold text-white">Professional & Social Profile</h2>
                  <p className="text-zinc-400 text-sm">
                    Connect directly on LinkedIn for professional networking and project updates:
                  </p>
                  <a
                    href="https://www.linkedin.com/in/vraj-gajera-260a96377"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-white hover:underline text-sm font-medium"
                  >
                    <span>linkedin.com/in/vraj-gajera-260a96377</span>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                  </a>
                </div>

                <div className="pt-4 border-t border-white/10 space-y-2">
                  <h2 className="text-lg font-bold text-white">GitHub Issue Tracker</h2>
                  <p className="text-zinc-400 text-sm">
                    Encountered a broken stream, responsive UI bug, or unexpected error? Submit a public ticket to our repository:
                  </p>
                  <a
                    href="https://github.com/vraj07-11/Play-LooP/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-white hover:underline text-sm font-medium"
                  >
                    <span>github.com/vraj07-11/Play-LooP/issues</span>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                  </a>
                </div>
              </div>

              {/* Functional Contact Form */}
              <div>
                {contactSubmitted ? (
                  <div className="p-6 border border-white/15 rounded-xl space-y-3 bg-black">
                    <div className="flex items-center gap-2 text-white">
                      <Check className="w-5 h-5 text-green-400 shrink-0" />
                      <h3 className="text-lg font-bold">Message Sent</h3>
                    </div>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      Thank you for reaching out, <span className="text-white font-medium">{contactForm.name}</span>. Your message has been dispatched directly to Vraj Gajera. If required, a follow-up reply will be sent to <span className="text-white font-medium">{contactForm.email}</span>.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setContactSubmitted(false);
                        setContactError(null);
                        setContactForm({ name: '', email: '', subject: 'General Feedback / Suggestion', message: '' });
                      }}
                      className="text-xs text-white underline pt-2 cursor-pointer"
                    >
                      Send another message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="space-y-4">
                    {contactError && (
                      <div className="p-3.5 rounded-lg bg-red-950/40 border border-red-500/30 text-xs text-red-200 leading-relaxed">
                        {contactError}
                      </div>
                    )}

                    <div>
                      <label className="block text-xs uppercase font-mono tracking-wider text-zinc-400 mb-1.5">
                        Your Name
                      </label>
                      <input
                        type="text"
                        required
                        disabled={contactLoading}
                        value={contactForm.name}
                        onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                        placeholder="Your Name"
                        className="w-full px-3.5 py-2.5 rounded-lg bg-black border border-white/15 text-white placeholder-zinc-600 focus:outline-none focus:border-white transition text-sm disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs uppercase font-mono tracking-wider text-zinc-400 mb-1.5">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        disabled={contactLoading}
                        value={contactForm.email}
                        onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                        placeholder="your.email@example.com"
                        className="w-full px-3.5 py-2.5 rounded-lg bg-black border border-white/15 text-white placeholder-zinc-600 focus:outline-none focus:border-white transition text-sm disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs uppercase font-mono tracking-wider text-zinc-400 mb-1.5">
                        Subject
                      </label>
                      <select
                        disabled={contactLoading}
                        value={contactForm.subject}
                        onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-lg bg-black border border-white/15 text-white focus:outline-none focus:border-white transition text-sm disabled:opacity-50"
                      >
                        <option value="General Feedback / Suggestion">General Feedback / Suggestion</option>
                        <option value="Audio Stream or Playback Issue">Audio Stream or Playback Issue</option>
                        <option value="Mobile Gestures / UI Feedback">Mobile Gestures / UI Feedback</option>
                        <option value="Feature Request (Loops, Sync, Importer)">Feature Request (Loops, Sync, Importer)</option>
                        <option value="Copyright / Content Takedown">Copyright / Content Takedown</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs uppercase font-mono tracking-wider text-zinc-400 mb-1.5">
                        Message
                      </label>
                      <textarea
                        required
                        rows={4}
                        disabled={contactLoading}
                        value={contactForm.message}
                        onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                        placeholder="Share your feedback, bug report, or questions..."
                        className="w-full px-3.5 py-2.5 rounded-lg bg-black border border-white/15 text-white placeholder-zinc-600 focus:outline-none focus:border-white transition text-sm resize-none disabled:opacity-50"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={contactLoading}
                      className="w-full py-2.5 rounded-lg bg-white text-black font-semibold text-sm hover:bg-zinc-200 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {contactLoading ? 'Sending Message...' : 'Send Message'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        );

      case 'privacy-policy':
        return (
          <div className="space-y-12 max-w-4xl text-zinc-300 text-sm sm:text-base leading-relaxed">
            <header className="space-y-4 border-b border-white/10 pb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-400 font-mono">
                Data Sovereignty
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Privacy Policy
              </h1>
              <p className="text-xs text-zinc-500 font-mono">
                Effective: November 2026 • Maintained by Vraj Gajera
              </p>
            </header>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">1. Core Educational Philosophy & Principles</h2>
              <p>
                Play LooP is an independent, non-commercial software project developed strictly for learning and research. It does not monetize user data, does not sell telemetry or listening logs to third-party data brokers, and does not run advertisement scripts or tracking beacons.
              </p>
              <p>
                We believe that listening to music is an inherently personal activity. Your playlists, listening history, search terms, and playback durations remain under your sole control.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">2. Zero Account Requirement & No PII Collection</h2>
              <p>
                Play LooP requires no registration, signup, or login. We never ask for or collect personally identifiable information (PII) such as:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
                <li>Your real name, postal address, or telephone number.</li>
                <li>Your email address or social media login credentials.</li>
                <li>Your payment details, credit card numbers, or billing history.</li>
                <li>Persistent biometric identifiers or browser fingerprint records.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">3. Local-First Client Storage</h2>
              <p>
                To provide a seamless music listening experience, Play LooP stores your operational data directly inside your browser storage (HTML5 LocalStorage and IndexedDB). This includes:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
                <li><strong>Playlists & Library:</strong> Custom playlists you create and songs you mark as liked.</li>
                <li><strong>Playback Settings:</strong> Audio volume, mute state, shuffle/repeat modes, and crossfade duration.</li>
                <li><strong>Preferred Languages:</strong> Your selected music languages used to tailor discovery feeds.</li>
                <li><strong>Scrobbler Records:</strong> Playback duration and history used to calculate your personal listening statistics.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">4. Anonymous Edge Synchronization (Turso LibSQL)</h2>
              <p>
                If you choose to synchronize your library across multiple devices, Play LooP uses an anonymous, randomly generated cryptographic Sync ID (UUID). When syncing:
              </p>
              <p className="text-zinc-400">
                Only playlist names, song identifiers, your chosen display name, avatar URL, and scrobble timestamps are stored in a distributed edge database. This record contains zero personal identifiers and cannot be traced back to your real-world identity.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">5. Data Deletion & Complete Reset</h2>
              <p>
                Because all primary data is stored locally on your device, you can completely erase all your records at any time:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
                <li>Navigate to Settings inside Play LooP and select "Reset Sync & Cache".</li>
                <li>Alternatively, clear your browser's site data and cookies for this domain.</li>
              </ul>
            </section>
          </div>
        );

      case 'terms-of-service':
      case 'terms':
        return (
          <div className="space-y-12 max-w-4xl text-zinc-300 text-sm sm:text-base leading-relaxed">
            <header className="space-y-4 border-b border-white/10 pb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-400 font-mono">
                Legal Terms
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Terms of Service
              </h1>
              <p className="text-xs text-zinc-500 font-mono">
                Effective: November 2026 • Maintained by Vraj Gajera
              </p>
            </header>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">1. Educational & Non-Commercial Scope</h2>
              <p>
                Play LooP is provided strictly as an open-source educational software experiment for personal, non-commercial use. By accessing or using the platform, you agree to comply with these Terms of Service.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">2. Permitted Personal Use</h2>
              <p>
                You are granted a personal, revocable, non-exclusive license to use the Play LooP interface for streaming publicly indexed audio media for personal enjoyment. You agree not to:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
                <li>Deploy automated scrapers, bots, or denial-of-service tools against our edge proxy nodes.</li>
                <li>Attempt to resell, commercialize, or charge access fees for the Play LooP client interface.</li>
                <li>Bypass or manipulate streaming protocols to disrupt services for other listeners.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">3. Intellectual Property & Third-Party Media</h2>
              <p>
                Play LooP does not host, upload, or own the underlying audio files, album artwork, or song metadata displayed. All song titles, artist trademarks, cover graphics, and sound recordings belong exclusively to their respective rights holders and creators.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">4. Disclaimer of Warranties</h2>
              <p>
                The service is delivered on an "as is" and "as available" basis without warranties of any kind. As an educational project, we make no guarantees regarding permanent uptime, uninterrupted stream persistence, or universal regional availability.
              </p>
            </section>
          </div>
        );

      case 'cookie-policy':
        return (
          <div className="space-y-12 max-w-4xl text-zinc-300 text-sm sm:text-base leading-relaxed">
            <header className="space-y-4 border-b border-white/10 pb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-400 font-mono">
                Storage Transparency
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Cookie & Storage Policy
              </h1>
              <p className="text-xs text-zinc-500 font-mono">
                Effective: November 2026 • Maintained by Vraj Gajera
              </p>
            </header>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">1. Zero Third-Party Tracking Cookies</h2>
              <p>
                Play LooP does not place HTTP tracking cookies, marketing beacons, or cross-site fingerprinting tokens on your device. We do not use third-party advertising networks or commercial analytics suites.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">2. Client-Side Browser Storage Inventory</h2>
              <p>
                To provide audio playback, persist your preferences, and maintain offline capabilities, Play LooP utilizes standard browser LocalStorage and IndexedDB:
              </p>
              <div className="border border-white/10 rounded-xl p-5 space-y-4 bg-[#08080a] text-xs font-mono">
                <div className="space-y-1">
                  <div className="text-white font-bold">preferred_languages</div>
                  <div className="text-zinc-400">Stores your chosen language preferences to personalize song recommendations and homepage feeds.</div>
                </div>
                <div className="space-y-1">
                  <div className="text-white font-bold">playloop_user_uuid</div>
                  <div className="text-zinc-400">A randomly generated anonymous client token used for multi-device sync via Turso LibSQL.</div>
                </div>
                <div className="space-y-1">
                  <div className="text-white font-bold">playloop_volume & playloop_crossfade</div>
                  <div className="text-zinc-400">Saves your preferred playback volume percentage and crossfade transition duration (1-12 seconds).</div>
                </div>
                <div className="space-y-1">
                  <div className="text-white font-bold">playloop_playlists & playloop_history</div>
                  <div className="text-zinc-400">Keeps your created playlist collections, favorite tracks, and recent playback history.</div>
                </div>
                <div className="space-y-1">
                  <div className="text-white font-bold">playloop_scrobbles</div>
                  <div className="text-zinc-400">Maintains verified listening sessions used to calculate your top artists and total listening minutes.</div>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">3. Managing and Purging Storage</h2>
              <p>
                You retain complete authority over your storage. You can inspect or clear these values anytime through your browser's Developer Tools (Application &gt; Storage), by clearing site data in browser preferences, or by using the reset tool in Play LooP Settings.
              </p>
            </section>
          </div>
        );

      case 'dmca':
        return (
          <div className="space-y-12 max-w-4xl text-zinc-300 text-sm sm:text-base leading-relaxed">
            <header className="space-y-4 border-b border-white/10 pb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-400 font-mono">
                Copyright Compliance
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                DMCA & Copyright Policy
              </h1>
              <p className="text-xs text-zinc-500 font-mono">
                Digital Millennium Copyright Act Notice Procedure
              </p>
            </header>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">1. Copyright Respect & Client Proxy Architecture</h2>
              <p>
                Play LooP respects the intellectual property rights of musical artists, record labels, and content publishers. Play LooP does not operate a hosting service, does not upload audio tracks, and does not store media files on its servers. It functions as a lightweight client-side proxy interface connecting users to publicly available audio endpoints.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">2. Designated Copyright Agent</h2>
              <p>
                If you are a copyright owner or authorized representative and believe that indexed audio content infringes upon your copyright, please submit a formal notification to our designated agent:
              </p>
              <div className="p-4 border border-white/15 rounded-xl bg-black text-sm space-y-1 font-mono">
                <div className="text-white font-bold">Designated Agent: Vraj Gajera</div>
                <div className="text-zinc-400">Email: gajeravraj593@gmail.com</div>
                <div className="text-zinc-400">Project: Play LooP Open-Source Player</div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">3. Required Information for Takedown Notices</h2>
              <p>
                To expedite review and restriction, please provide:
              </p>
              <ol className="list-decimal pl-5 space-y-1.5 text-zinc-400">
                <li>Identification of the copyrighted work claimed to have been infringed.</li>
                <li>The exact song title, artist name, and specific stream identifier within Play LooP.</li>
                <li>Contact information of the complaining party (name, organization, email address).</li>
                <li>A statement of good faith belief that the contested use is unauthorized by the copyright holder, its agent, or the law.</li>
                <li>A statement made under penalty of perjury that the information in the notification is accurate and that you are authorized to act on behalf of the owner.</li>
              </ol>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">4. Expeditious Processing</h2>
              <p>
                Upon receipt of a valid notice, we will review the submission promptly and restrict the referenced index endpoint from resolving through our client proxy.
              </p>
            </section>
          </div>
        );

      case 'disclaimer':
        return (
          <div className="space-y-12 max-w-4xl text-zinc-300 text-sm sm:text-base leading-relaxed">
            <header className="space-y-4 border-b border-white/10 pb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-400 font-mono">
                Legal & Technical Disclosure
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Disclaimer
              </h1>
              <p className="text-xs text-zinc-500 font-mono">
                General Informational & Educational Disclosure
              </p>
            </header>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">1. Educational & Non-Commercial Purpose</h2>
              <p>
                Play LooP is an independent software application created and maintained by Vraj Gajera strictly for educational, research, and non-commercial purposes. It was engineered to study modern browser audio performance, touch gesture interactions, and serverless edge databases.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">2. Trademarks & Brand Attribution</h2>
              <p>
                All artist names, logos, band artwork, album titles, and musical recordings displayed in Play LooP belong to their respective copyright and trademark owners. The reference or indexing of any trademarked name or artwork does not constitute affiliation, sponsorship, or endorsement.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">3. Third-Party Endpoints & Network Availability</h2>
              <p>
                Search indices and audio streams are compiled dynamically from distributed public audio networks. Play LooP does not control and cannot guarantee the permanent availability, uninterrupted uptime, or geographic reach of third-party audio streams.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">4. Open Source Verification</h2>
              <p>
                The complete source code is publicly accessible on GitHub at{' '}
                <a
                  href="https://github.com/vraj07-11/Play-LooP"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white underline hover:text-zinc-300"
                >
                  https://github.com/vraj07-11/Play-LooP
                </a>
                . Anyone is welcome to inspect the implementation, audit security, or propose improvements.
              </p>
            </section>
          </div>
        );

      default:
        return (
          <div className="py-20 space-y-4 max-w-md">
            <h1 className="text-3xl font-bold text-white">Page Not Found</h1>
            <p className="text-zinc-400 text-sm">The requested page does not exist.</p>
            <button
              onClick={goHome}
              className="px-5 py-2 rounded-lg bg-white text-black font-semibold text-sm hover:bg-zinc-200 transition cursor-pointer"
            >
              Return to Music
            </button>
          </div>
        );
    }
  };

  return (
    <div className="w-full min-h-full bg-[#000000] text-white flex flex-col justify-between select-text">
      <div className="max-w-4xl mx-auto w-full px-6 sm:px-8 pt-8 pb-16">
        
        {/* Navigation Bar */}
        <div className="flex items-center justify-between gap-4 mb-10 pb-4 border-b border-white/10">
          <button
            type="button"
            onClick={goHome}
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Music</span>
          </button>

          {/* Clean minimal navigation links */}
          <div className="hidden sm:flex items-center gap-4 text-xs font-medium text-zinc-400">
            <button
              onClick={(e) => navigateTo(e, 'how-it-works')}
              className={`hover:text-white transition cursor-pointer ${pageSlug === 'how-it-works' ? 'text-white font-bold' : ''}`}
            >
              How It Works
            </button>
            <button
              onClick={(e) => navigateTo(e, 'features')}
              className={`hover:text-white transition cursor-pointer ${pageSlug === 'features' ? 'text-white font-bold' : ''}`}
            >
              Features
            </button>
            <button
              onClick={(e) => navigateTo(e, 'faq')}
              className={`hover:text-white transition cursor-pointer ${pageSlug === 'faq' ? 'text-white font-bold' : ''}`}
            >
              FAQ
            </button>
            <button
              onClick={(e) => navigateTo(e, 'blog')}
              className={`hover:text-white transition cursor-pointer ${pageSlug === 'blog' ? 'text-white font-bold' : ''}`}
            >
              Blog
            </button>
            <button
              onClick={(e) => navigateTo(e, 'about')}
              className={`hover:text-white transition cursor-pointer ${pageSlug === 'about' ? 'text-white font-bold' : ''}`}
            >
              About
            </button>
            <button
              onClick={(e) => navigateTo(e, 'contact')}
              className={`hover:text-white transition cursor-pointer ${pageSlug === 'contact' ? 'text-white font-bold' : ''}`}
            >
              Contact
            </button>
          </div>
        </div>

        {/* Page Content */}
        <main>
          {renderContent()}
        </main>
      </div>

      {/* AMOLED Black Footer */}
      <Footer setCurrentView={setCurrentView} />
    </div>
  );
}
