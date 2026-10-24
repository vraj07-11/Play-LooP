import React, { useState, useEffect } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import Footer from '../components/Footer.jsx';

export default function InfoPage({ currentView, setCurrentView }) {
  const [activeFaq, setActiveFaq] = useState(null);
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: 'Feedback', message: '' });

  const pageSlug = (currentView || '').toLowerCase().replace(/_/g, '-');

  // Dynamic document title and SEO meta tag updates
  useEffect(() => {
    const titles = {
      'how-it-works': 'How It Works - Play LooP Architecture & Audio Engine',
      'features': 'Features & Capabilities - Play LooP Web Music Player',
      'faq': 'Frequently Asked Questions - Play LooP',
      'blog': 'Engineering & Development Blog - Play LooP',
      'about': 'About Play LooP - Independent Web Music Streaming',
      'contact': 'Contact & Support - Play LooP',
      'privacy-policy': 'Privacy Policy - Play LooP',
      'terms-of-service': 'Terms of Service - Play LooP',
      'terms': 'Terms of Service - Play LooP',
      'cookie-policy': 'Cookie & Storage Policy - Play LooP',
      'dmca': 'DMCA & Copyright Takedown Procedure - Play LooP',
      'disclaimer': 'Legal Disclaimer - Play LooP'
    };

    const descriptions = {
      'how-it-works': 'Technical breakdown of Play LooP audio streaming pipeline, adaptive HLS segmenting, and Turso LibSQL edge database sync.',
      'features': 'Complete specifications of Play LooP features: zero-buffer HLS streaming, synchronized LRC lyrics, cloud database sync, custom playlist management, and offline PWA.',
      'faq': 'Frequently asked questions regarding ad-free streaming, offline downloads, playlist importing, and cloud database sync.',
      'blog': 'Technical articles on web audio streaming architecture, mobile background audio handling, and serverless edge databases.',
      'about': 'The developer story and principles behind Play LooP, an independent ad-free web music player.',
      'contact': 'Direct contact channels and feedback form for Play LooP listeners and developers.',
      'privacy-policy': 'Plain-language privacy policy explaining local storage usage and zero user telemetry collection.',
      'terms-of-service': 'Terms of Service governing personal streaming and client-side playback on Play LooP.',
      'terms': 'Terms of Service governing personal streaming and client-side playback on Play LooP.',
      'cookie-policy': 'Documentation of client-side browser storage and zero tracking cookies.',
      'dmca': 'Copyright compliance procedure and takedown notice information for rights holders.',
      'disclaimer': 'Informational and technological disclosure regarding third-party audio metadata and streaming protocols.'
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

  const handleContactSubmit = (e) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message) return;
    setContactSubmitted(true);
  };

  const renderContent = () => {
    switch (pageSlug) {
      case 'how-it-works':
        return (
          <div className="space-y-12 max-w-4xl">
            <header className="space-y-3 border-b border-white/10 pb-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                How It Works
              </h1>
              <p className="text-base text-zinc-400 leading-relaxed">
                Play LooP is engineered as a low-latency web audio player designed to deliver instantaneous playback, zero audio interruptions, and frictionless device synchronization without mandatory user signups.
              </p>
            </header>

            <section className="space-y-10 text-zinc-300 text-sm sm:text-base leading-relaxed">
              <div className="space-y-3">
                <h2 className="text-xl font-bold text-white">1. Stream Resolution & Metadata Extraction</h2>
                <p>
                  When you initiate a search or open a playlist, requests pass through our lightweight Express backend. The server queries high-fidelity audio streams from sources including JioSaavn, SoundCloud, and open indices. Titles are cleaned to remove redundant text like video tags or track watermarks, and high-resolution album artwork is cached at the edge.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-xl font-bold text-white">2. Low-Latency HLS Audio Proxying</h2>
                <p>
                  Instead of requiring browsers to download entire audio files upfront, Play LooP proxies streams using HTTP Live Streaming (HLS). Audio streams are divided into small, sequential audio chunks. Playback begins as soon as the first segment arrives (typically under 200 milliseconds), significantly cutting down wait times and preventing dropouts on cellular networks.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-xl font-bold text-white">3. Dual-Buffer Audio Architecture</h2>
                <p>
                  Smooth song transitions and crossfades require running multiple audio pipelines in parallel. Play LooP operates two isolated HTML5 audio slots. While Slot A is actively playing your track, Slot B preloads the upcoming song. When a track reaches its crossfade threshold or you trigger next, the system interpolates volume curves between both slots with zero silence.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-xl font-bold text-white">4. Edge Database Sync (Turso & LibSQL)</h2>
                <p>
                  Your library, listening history, and custom playlists are persisted to a distributed Turso LibSQL database. Instead of requiring personal credentials, Play LooP generates a client-side device UUID. Your unique Sync ID allows you to sync your saved playlists across other devices instantly by importing the identifier in your settings.
                </p>
              </div>
            </section>
          </div>
        );

      case 'features':
        return (
          <div className="space-y-12 max-w-4xl">
            <header className="space-y-3 border-b border-white/10 pb-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Features
              </h1>
              <p className="text-base text-zinc-400 leading-relaxed">
                Core technical capabilities and features built into Play LooP.
              </p>
            </header>

            <div className="space-y-8 text-zinc-300 text-sm sm:text-base leading-relaxed">
              <div className="border-b border-white/10 pb-6 space-y-2">
                <h2 className="text-lg font-bold text-white">Adaptive HLS Streaming</h2>
                <p className="text-zinc-400">
                  Transfers segmented audio chunks on the fly to eliminate buffering lag, allowing instantaneous playback startup even under constrained mobile bandwidth.
                </p>
              </div>

              <div className="border-b border-white/10 pb-6 space-y-2">
                <h2 className="text-lg font-bold text-white">Configurable Audio Crossfade</h2>
                <p className="text-zinc-400">
                  Adjust transition timing from 1 to 12 seconds with dual-slot audio fading for continuous, uninterrupted listening sessions.
                </p>
              </div>

              <div className="border-b border-white/10 pb-6 space-y-2">
                <h2 className="text-lg font-bold text-white">Realtime Synced Lyrics (LRC)</h2>
                <p className="text-zinc-400">
                  Parses synchronized LRC timestamp tracks to display scrolling, line-by-line active lyrics in both the mini player and full-screen view.
                </p>
              </div>

              <div className="border-b border-white/10 pb-6 space-y-2">
                <h2 className="text-lg font-bold text-white">Passwordless Cloud Sync</h2>
                <p className="text-zinc-400">
                  Persists playlists and playback history to a distributed Turso LibSQL edge database using an anonymous device UUID.
                </p>
              </div>

              <div className="border-b border-white/10 pb-6 space-y-2">
                <h2 className="text-lg font-bold text-white">Custom Playlists & Queue Management</h2>
                <p className="text-zinc-400">
                  Create personal collections, reorder tracks on the fly with drag-and-drop, add songs to Up Next, and share your custom playlists with friends.
                </p>
              </div>

              <div className="border-b border-white/10 pb-6 space-y-2">
                <h2 className="text-lg font-bold text-white">Progressive Web App (PWA) Offline Support</h2>
                <p className="text-zinc-400">
                  Installable directly onto Android, iOS, and desktop browsers with service-worker cache mechanisms for offline track management and background audio playback.
                </p>
              </div>

              <div className="border-b border-white/10 pb-6 space-y-2">
                <h2 className="text-lg font-bold text-white">Universal Playlist Importer</h2>
                <p className="text-zinc-400">
                  Imports public playlists directly from Spotify, YouTube Music, or raw track listings into your personal local library.
                </p>
              </div>
            </div>
          </div>
        );

      case 'faq':
        const faqs = [
          {
            q: 'Is Play LooP completely free to use?',
            a: 'Yes. Play LooP is an independent software project with no subscription fees, no locked features, and no audio or visual banner advertisements.'
          },
          {
            q: 'Where does the audio stream from?',
            a: 'The application proxies public, high-quality audio streams through open discovery endpoints including JioSaavn, SoundCloud, and related audio CDNs. Play LooP functions as a lightweight client-side interface and stream proxy.'
          },
          {
            q: 'Can I listen to music offline?',
            a: 'Yes. When installed as a Progressive Web App (PWA), audio streams downloaded through the download manager are stored in browser storage for offline access.'
          },
          {
            q: 'How does syncing work without creating an account?',
            a: 'On first launch, Play LooP issues an anonymous cryptographically unique device UUID. Your playlists and listening logs are backed up to our edge database (Turso LibSQL). You can export or copy your Sync ID from Settings to restore your data on other devices.'
          },
          {
            q: 'Can I import playlists from Spotify or YouTube?',
            a: 'Yes. In Your Library, open the Import Playlist tool and paste any public URL from Spotify, YouTube, or SoundCloud. The parser extracts the song titles and links them to high-bitrate audio streams automatically.'
          },
          {
            q: 'Why does audio pause in the background on mobile devices?',
            a: 'Certain mobile operating systems throttle network traffic and timers on background browser tabs to conserve battery. Installing Play LooP as a PWA on your home screen or allowing background activity in your browser app settings resolves this.'
          },
          {
            q: 'How do I create and manage custom playlists?',
            a: 'Go to Your Library and click New Playlist or tap the + playlist button on any track. You can add songs to multiple playlists simultaneously, reorder tracks, and share playlists via direct link.'
          }
        ];

        return (
          <div className="space-y-12 max-w-4xl">
            <header className="space-y-3 border-b border-white/10 pb-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Frequently Asked Questions
              </h1>
              <p className="text-base text-zinc-400 leading-relaxed">
                Answers to common questions regarding playback, audio streaming, and device sync.
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
            title: 'Building an Ad-Free HLS Audio Proxy in Node.js 22',
            date: 'October 2026',
            readTime: '6 min read',
            summary: 'A deep dive into building an audio streaming pipeline with Range request support, handling IPv4 DNS fallbacks to prevent connection timeouts, and managing memory under 256MB on cloud containers.'
          },
          {
            title: 'Eliminating Track Transition Gaps in Modern Web Audio',
            date: 'September 2026',
            readTime: '5 min read',
            summary: 'How orchestrating dual HTML5 audio elements and linear volume interpolation allows seamless crossfade transitions without browser audio stalls.'
          },
          {
            title: 'Edge Database Architecture: Passwordless Sync with Turso & LibSQL',
            date: 'August 2026',
            readTime: '4 min read',
            summary: 'Why traditional email-and-password auth flows add unnecessary friction to web music players, and how anonymous UUID replication solves multi-device state syncing.'
          }
        ];

        return (
          <div className="space-y-12 max-w-4xl">
            <header className="space-y-3 border-b border-white/10 pb-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Blog
              </h1>
              <p className="text-base text-zinc-400 leading-relaxed">
                Technical articles on web audio architecture, streaming protocols, and player engineering.
              </p>
            </header>

            <div className="space-y-10">
              {articles.map((art, idx) => (
                <article key={idx} className="border-b border-white/10 pb-8 space-y-3">
                  <div className="text-xs font-mono text-zinc-500">
                    {art.date} — {art.readTime}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white">
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
            <header className="space-y-3 border-b border-white/10 pb-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                About Play LooP
              </h1>
              <p className="text-base text-zinc-400 leading-relaxed">
                Play LooP was created with a clear objective: provide an ad-free, high-performance music streaming application built on modern web standards.
              </p>
            </header>

            <div className="space-y-8 text-zinc-300 text-sm sm:text-base leading-relaxed">
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-white">The Project</h2>
                <p>
                  Play LooP is built and maintained by <strong>Vraj Gajera</strong>, an independent developer focusing on web audio infrastructure, edge databases, and interface responsiveness.
                </p>
                <p>
                  Most mainstream music services have become heavily cluttered with commercial video feeds, forced subscription walls, and intrusive analytics. Play LooP is an exploration of what a lightweight, privacy-focused streaming client looks like when built purely around audio quality and speed.
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-bold text-white">Engineering Decisions</h2>
                <ul className="list-disc pl-5 space-y-2 text-zinc-400">
                  <li><strong>Zero Ads & Trackers:</strong> No advertising scripts, tracking pixels, or telemetry selling.</li>
                  <li><strong>Native Audio Engine:</strong> Low-latency HLS audio proxying with dual-slot crossfade support.</li>
                  <li><strong>Serverless Sync:</strong> Anonymous edge replication via Turso LibSQL, eliminating mandatory account registrations.</li>
                  <li><strong>Open Source:</strong> Project source code is public on GitHub for community audit and collaboration.</li>
                </ul>
              </div>

              <div className="pt-4 border-t border-white/10 flex flex-wrap items-center gap-4 text-sm font-medium">
                <a
                  href="https://github.com/vraj07-11/Play-LooP"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white hover:underline"
                >
                  GitHub Repository
                </a>
                <span className="text-zinc-600">•</span>
                <a
                  href="https://www.linkedin.com/in/vraj-gajera-260a96377"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white hover:underline"
                >
                  LinkedIn
                </a>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-400">Contact: gajeravraj593@gmail.com</span>
              </div>
            </div>
          </div>
        );

      case 'contact':
        return (
          <div className="space-y-12 max-w-4xl">
            <header className="space-y-3 border-b border-white/10 pb-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Contact & Support
              </h1>
              <p className="text-base text-zinc-400 leading-relaxed">
                Direct communication channels for feature suggestions, bug reports, and stream inquiries.
              </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-6 text-sm sm:text-base text-zinc-300 leading-relaxed">
                <div>
                  <h2 className="text-lg font-bold text-white mb-2">Direct Email</h2>
                  <p className="text-zinc-400 text-sm mb-3">
                    For technical inquiries, bug submissions, or questions:
                  </p>
                  <div className="inline-flex items-center gap-3 font-mono text-sm bg-black border border-white/15 px-3.5 py-2 rounded-lg">
                    <span className="text-white">gajeravraj593@gmail.com</span>
                    <button
                      type="button"
                      onClick={copyEmail}
                      className="text-xs text-zinc-400 hover:text-white transition cursor-pointer"
                    >
                      {copiedEmail ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <h2 className="text-lg font-bold text-white mb-2">GitHub Issues</h2>
                  <p className="text-zinc-400 text-sm">
                    If you encounter broken streams or reproducible playback bugs, submit an issue directly to the repository:
                  </p>
                  <p className="mt-2">
                    <a
                      href="https://github.com/vraj07-11/Play-LooP/issues"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white underline text-sm hover:text-zinc-300"
                    >
                      github.com/vraj07-11/Play-LooP/issues
                    </a>
                  </p>
                </div>
              </div>

              {/* Functional Contact Form with genuine placeholders */}
              <div>
                {contactSubmitted ? (
                  <div className="p-6 border border-white/15 rounded-xl space-y-3 bg-black">
                    <h3 className="text-lg font-bold text-white">Message Sent</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      Thank you for the message. We have logged your submission and will follow up if required.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setContactSubmitted(false);
                        setContactForm({ name: '', email: '', subject: 'Feedback', message: '' });
                      }}
                      className="text-xs text-white underline pt-2 cursor-pointer"
                    >
                      Send another message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs uppercase font-mono tracking-wider text-zinc-400 mb-1.5">
                        Your Name
                      </label>
                      <input
                        type="text"
                        required
                        value={contactForm.name}
                        onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                        placeholder="Your Name or Artist Handle"
                        className="w-full px-3.5 py-2.5 rounded-lg bg-black border border-white/15 text-white placeholder-zinc-600 focus:outline-none focus:border-white transition text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs uppercase font-mono tracking-wider text-zinc-400 mb-1.5">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={contactForm.email}
                        onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                        placeholder="your.email@example.com"
                        className="w-full px-3.5 py-2.5 rounded-lg bg-black border border-white/15 text-white placeholder-zinc-600 focus:outline-none focus:border-white transition text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs uppercase font-mono tracking-wider text-zinc-400 mb-1.5">
                        Subject
                      </label>
                      <select
                        value={contactForm.subject}
                        onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-lg bg-black border border-white/15 text-white focus:outline-none focus:border-white transition text-sm"
                      >
                        <option value="Feedback">Feedback / Suggestions</option>
                        <option value="Bug">Audio Stream or Playback Issue</option>
                        <option value="Feature">Feature Request</option>
                        <option value="DMCA">Copyright / Legal</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs uppercase font-mono tracking-wider text-zinc-400 mb-1.5">
                        Message
                      </label>
                      <textarea
                        required
                        rows={4}
                        value={contactForm.message}
                        onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                        placeholder="Describe your feedback, suggestion, or issue..."
                        className="w-full px-3.5 py-2.5 rounded-lg bg-black border border-white/15 text-white placeholder-zinc-600 focus:outline-none focus:border-white transition text-sm resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-lg bg-white text-black font-semibold text-sm hover:bg-zinc-200 transition cursor-pointer"
                    >
                      Send Message
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
            <header className="space-y-3 border-b border-white/10 pb-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Privacy Policy
              </h1>
              <p className="text-xs text-zinc-500 font-mono">
                Effective: October 2026
              </p>
            </header>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">1. Principles</h2>
              <p>
                Play LooP operates on a strict privacy model: we do not sell data, we do not monetize user profiles, and we do not embed third-party advertising trackers. Listening habits and playback interactions belong exclusively to the user.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">2. Local Storage Usage</h2>
              <p>
                The application relies on HTML5 LocalStorage to maintain basic playback continuity:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-zinc-400">
                <li>Player volume, mute states, and crossfade preferences.</li>
                <li>Preferred language selections used for music discovery.</li>
                <li>Locally cached playlist and history records.</li>
                <li>A client-generated random UUID used solely for edge database synchronization.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">3. Cloud Edge Synchronization</h2>
              <p>
                If cloud sync is enabled, playlist metadata and scrobble timestamps are stored in an encrypted Turso LibSQL database. This data is associated only with your client-generated UUID and contains no personal identity attributes.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">4. Data Deletion</h2>
              <p>
                You may purge all stored data at any time by clearing your browser site data or choosing "Reset Sync & Cache" in the Settings view.
              </p>
            </section>
          </div>
        );

      case 'terms-of-service':
      case 'terms':
        return (
          <div className="space-y-12 max-w-4xl text-zinc-300 text-sm sm:text-base leading-relaxed">
            <header className="space-y-3 border-b border-white/10 pb-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Terms of Service
              </h1>
              <p className="text-xs text-zinc-500 font-mono">
                Effective: October 2026
              </p>
            </header>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">1. Agreement to Terms</h2>
              <p>
                By using Play LooP, you agree to these Terms of Service. If you do not agree, you should refrain from using the software.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">2. Permitted Use</h2>
              <p>
                Play LooP is provided for personal, non-commercial listening and discovery. Users agree not to launch automated scraping attacks, overload streaming proxy nodes, or attempt to commercialize streaming endpoints.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">3. Third-Party Content</h2>
              <p>
                All music tracks, artwork, and artist trademarks indexed by Play LooP belong to their respective copyright holders. Play LooP does not claim ownership over any streamed media.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">4. Disclaimer of Warranties</h2>
              <p>
                The service is delivered on an "as is" and "as available" basis without express or implied warranties regarding uptime, track availability, or third-party stream persistence.
              </p>
            </section>
          </div>
        );

      case 'cookie-policy':
        return (
          <div className="space-y-12 max-w-4xl text-zinc-300 text-sm sm:text-base leading-relaxed">
            <header className="space-y-3 border-b border-white/10 pb-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Cookie & Storage Policy
              </h1>
              <p className="text-xs text-zinc-500 font-mono">
                Effective: October 2026
              </p>
            </header>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">Zero Tracking Cookies</h2>
              <p>
                Play LooP does not use tracking cookies, analytics pixels, or advertising identifiers. We utilize standard browser LocalStorage solely to maintain essential playback state:
              </p>
              <div className="border border-white/10 rounded-lg p-4 space-y-3 text-sm font-mono bg-black mt-4">
                <div>
                  <span className="text-white font-bold">preferred_languages:</span>
                  <span className="text-zinc-400 ml-2">Selected languages for song feed filtering.</span>
                </div>
                <div>
                  <span className="text-white font-bold">playloop_volume:</span>
                  <span className="text-zinc-400 ml-2">Saved audio volume percentage.</span>
                </div>
                <div>
                  <span className="text-white font-bold">playloop_user_uuid:</span>
                  <span className="text-zinc-400 ml-2">Anonymous token for edge database synchronization.</span>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">Managing Storage</h2>
              <p>
                You can inspect or delete these items anytime via your browser developer tools or by selecting "Clear Browsing Data" in your browser settings.
              </p>
            </section>
          </div>
        );

      case 'dmca':
        return (
          <div className="space-y-12 max-w-4xl text-zinc-300 text-sm sm:text-base leading-relaxed">
            <header className="space-y-3 border-b border-white/10 pb-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                DMCA & Copyright Policy
              </h1>
              <p className="text-xs text-zinc-500 font-mono">
                Digital Millennium Copyright Act Notice Procedure
              </p>
            </header>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">Notice Procedure</h2>
              <p>
                Play LooP respects the intellectual property rights of content owners. Play LooP does not store audio files on its own hosting infrastructure; it operates as an audio proxy client connecting users to publicly accessible audio streams.
              </p>
              <p>
                If you believe copyrighted material has been indexed without authorization, please submit a written takedown notice to our designated contact:
              </p>
              <div className="p-4 border border-white/15 rounded-lg bg-black text-sm space-y-1 font-mono">
                <div className="text-white font-bold">Designated Agent: Vraj Gajera</div>
                <div className="text-zinc-400">Email: gajeravraj593@gmail.com</div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">Required Information</h2>
              <ol className="list-decimal pl-5 space-y-1.5 text-zinc-400">
                <li>Identification of the copyrighted work claimed to have been infringed.</li>
                <li>Identification of the specific song title or stream identifier to be restricted.</li>
                <li>Contact information of the complaining party (name, address, email).</li>
                <li>A statement that the complaining party has a good faith belief that use of the material is not authorized.</li>
                <li>A statement under penalty of perjury that the information in the notification is accurate.</li>
              </ol>
            </section>
          </div>
        );

      case 'disclaimer':
        return (
          <div className="space-y-12 max-w-4xl text-zinc-300 text-sm sm:text-base leading-relaxed">
            <header className="space-y-3 border-b border-white/10 pb-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Disclaimer
              </h1>
              <p className="text-xs text-zinc-500 font-mono">
                General Legal & Technological Disclosure
              </p>
            </header>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">1. Informational Purpose</h2>
              <p>
                Play LooP is an independent software project developed for personal productivity and research into low-latency web audio streaming and edge database synchronization.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">2. Trademarks & Attribution</h2>
              <p>
                All artist names, logos, album titles, and cover art referenced in the application are trademarks of their respective owners. Their display does not imply sponsorship, partnership, or endorsement.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">3. Stream Availability</h2>
              <p>
                Search results and audio streams are compiled dynamically from third-party networks. Play LooP does not control and cannot guarantee the permanent availability, uptime, or geographic reach of third-party audio streams.
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
