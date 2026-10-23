# Play LooP 🎵

**Play LooP** is a modern, lightweight, and high-performance web music player designed for seamless, ad-free streaming. Built with a sleek dark aesthetic, responsive mobile-first gestures, and low-latency audio delivery, Play LooP bridges client-side elegance with an intelligent Express backend, real-time HLS proxying, and cloud database synchronization.

---

## 🚀 Live Demo

Experience the application live here:  
👉 **[play-loop.onrender.com](https://play-loop.onrender.com)**

---

## 🛠️ Technology Stack

![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite_8-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Express.js](https://img.shields.io/badge/Express_5-000000?style=for-the-badge&logo=express&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Turso](https://img.shields.io/badge/Turso_LibSQL-00E599?style=for-the-badge&logo=sqlite&logoColor=black)
![HLS.js](https://img.shields.io/badge/HLS.js-FF6F00?style=for-the-badge&logo=html5&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Render](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)

---

## ✨ Key Features

* **Ad-Free HLS Audio Streaming**  
  Proxies high-quality audio streams on-the-fly using HLS segmenting and predictive audio preloading (`/api/audio/preload`), eliminating disk lag and buffering.
* **Smart Up-Next Queue & Recommendation Engine**  
  Dynamic recommendation pipeline analyzing your current track, genre, and preferred languages (English, Hindi, Punjabi, etc.) to continuously generate uninterrupted playback.
* **Fullscreen Player & Synced Lyrics**  
  Rich player interface with animated album art carousel, real-time synchronized lyrics parsing (`LRC`), volume controls, track scrubbing, and seamless crossfade transitions.
* **Cloud Sync via Turso / LibSQL**  
  Synchronizes your scrobbles, listening history, and custom playlists across sessions with low-latency edge SQL databases.
* **Scrobbler Integration**  
  Automatic track scrobbling with live listening statistics and sync controls.
* **Offline Download Manager**  
  Save your favorite tracks locally for offline playback via the built-in streaming proxy download service.
* **Mobile-First Gestures & PWA**  
  Installable Progressive Web App (PWA) with background audio playback (MediaSession API), native pull-to-refresh (`usePullToRefresh`), swipeable tabs (`useSwipeTabs`), and responsive bottom navigation.
* **Social Sharing & Open Graph Deep Links**  
  Generate shareable track and playlist links (`/track/:id`, `/s/:id`) with automatic Open Graph dynamic preview cards and Web Share API integration.

---

## 📁 Project Structure

```text
Play-LooP/
├── public/                 # Static assets, branding & PWA configuration
│   ├── brand-logo.svg      # Play LooP branding logo
│   ├── default-cover.svg   # Fallback song artwork
│   ├── manifest.json       # PWA web manifest specification
│   ├── robots.txt          # Search engine crawler policies
│   └── sw.js               # Service Worker entry point
├── src/                    # Frontend React 19 application
│   ├── components/         # Reusable UI & interactive components
│   │   ├── Carousel.jsx           # Featured releases & recommendation carousel
│   │   ├── ErrorBoundary.jsx      # Error handling boundary
│   │   ├── FullPlayer.jsx         # Fullscreen player with lyrics & queue
│   │   ├── Header.jsx             # Top search bar and navigation header
│   │   ├── LanguageSelector.jsx   # Multi-language preference selector
│   │   ├── MobileBottomNav.jsx    # Mobile bottom navigation bar
│   │   ├── Player.jsx             # Persistent mini/docked audio player
│   │   ├── PullToRefresh.jsx      # Mobile pull-to-refresh animated indicator
│   │   ├── RightSidebar.jsx       # Up-Next queue & lyrics drawer
│   │   ├── ShareModal.jsx         # Social sharing dialog with Web Share API
│   │   └── Sidebar.jsx            # Desktop collapsible navigation sidebar
│   ├── constants/          # Static routes & navigation data
│   │   └── pagesData.js
│   ├── context/            # Global React state management
│   │   └── PlayerContext.jsx      # Audio playback, queue, volume & crossfade state
│   ├── hooks/              # Custom React hooks
│   │   ├── usePullToRefresh.js    # Pull-down-to-refresh touch gesture handler
│   │   └── useSwipeTabs.js        # Horizontal tab swipe gesture handler
│   ├── pages/              # Main view screens
│   │   ├── DownloadPage.jsx       # Offline tracks & download manager
│   │   ├── Home.jsx               # Feed, quick picks, trending artists & popular tracks
│   │   ├── LibraryPage.jsx        # Playlists, favorite tracks & listening history
│   │   ├── PlaceholderPage.jsx    # Fallback and empty-state view
│   │   ├── SearchPage.jsx         # Fast search with filter chips (songs, artists, albums)
│   │   └── SettingsPage.jsx       # Audio quality, crossfade, Turso sync & Last.fm settings
│   ├── services/           # API and client services
│   │   ├── api.js                 # HTTP client for backend streaming & data endpoints
│   │   ├── lyrics.js              # Timed lyrics fetcher & synchronizer
│   │   ├── recommendationEngine.js# Client recommendation & queue heuristics
│   │   └── shareService.js        # Share link generation & clipboard utilities
│   ├── styles/             # Modular CSS styling & animations
│   │   ├── animations.css         # Keyframe animations and transitions
│   │   ├── base.css               # Base typography and design variables
│   │   ├── content.css            # Content cards & responsive grid layouts
│   │   ├── header.css             # Navigation header styling
│   │   ├── index.css              # Main CSS imports & Tailwind directives
│   │   ├── player.css             # Mini & fullscreen player styles
│   │   └── sidebar.css            # Desktop navigation sidebar styling
│   ├── utils/              # Helper utilities
│   │   ├── durationUtils.js       # Track time formatters & duration parsers
│   │   └── navigationHistory.js   # Browser navigation & view stack state
│   ├── App.jsx             # Core application shell, routing & gestures
│   └── main.jsx            # Application mount & DOM entry point
├── Dockerfile              # Docker container build specification
├── server.js               # Express 5 backend (HLS proxy, Turso DB, Last.fm, OG tags)
├── sw.js                   # Service Worker script for offline cache & PWA
├── vite.config.mjs         # Vite configuration with Tailwind CSS v4 & chunk splitting
├── package.json            # Project dependencies and npm scripts
├── .env.example            # Environment variable configuration template
└── readme.md               # Project documentation
```

---

## ⚙️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm` or `yarn`

### Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/vraj07-11/Play-LooP.git
   cd Play-LooP
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Copy the `.env.example` file to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```
   ```env
   PORT=3000
   TURSO_DATABASE_URL=libsql://your-database-name.turso.io
   TURSO_AUTH_TOKEN=your_turso_auth_token_here
   ```

4. **Run the Development Application**
   - **Frontend (Vite dev server):**
     ```bash
     npm run dev
     ```
   - **Backend Server (Express API & Audio Proxy):**
     ```bash
     npm start
     ```

5. **Build for Production**
   ```bash
   npm run build
   ```

### 🐳 Running with Docker

You can build and deploy the application using the included `Dockerfile`:

```bash
docker build -t play-loop .
docker run -p 3000:3000 --env-file .env play-loop
```

---

## 🔌 API Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/search?q=:query` | Search tracks, artists, and albums |
| `GET` | `/api/audio?id=:id` | Stream audio via adaptive HLS pipeline |
| `GET` | `/api/audio/preload?id=:id`| Preload audio stream for upcoming queue item |
| `GET` | `/api/download?id=:id` | Download track directly with metadata headers |
| `GET` | `/api/song?id=:id` | Fetch detailed track metadata |
| `GET` | `/api/recommendations` | Get smart song suggestions based on current track |
| `GET` | `/api/trending-artists`| Fetch top trending music artists |
| `GET` | `/api/popular-songs` | Fetch trending & popular tracks by language |
| `GET` | `/api/playlist?id=:id` | Fetch playlist track listing |
| `POST`| `/api/scrobble` | Record scrobble to database & Last.fm |
| `GET` | `/api/sync?uuid=:uuid` | Fetch synchronized user playlists & scrobbles |
| `POST`| `/api/playlist/save` | Persist or update playlist to Turso cloud database |
| `GET` | `/api/health` | Health check endpoint |

---

## 👤 About the Developer

This project is the independent work of a solo developer. Driven by a passion for music, design, and software engineering, **Play LooP** was built to provide a fast, elegant, and ad-free music streaming experience.

---

## 📬 Contact & Links

- **GitHub:** [@vraj07-11](https://github.com/vraj07-11)
- **Email:** [gajeravraj593@gmail.com](mailto:gajeravraj593@gmail.com)
- **LinkedIn:** [Vraj Gajera](https://www.linkedin.com/in/vraj-gajera-260a96377)
