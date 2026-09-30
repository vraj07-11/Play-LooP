# Play LooP 🎵

**Play LooP** is a modern, lightweight, and fully-featured web application designed to stream and enjoy music seamlessly. Built with performance and user experience in mind, it acts as a powerful bridge that fetches and streams ad-free audio, paired with a beautiful interface and an intelligent local caching mechanism.

---

## 🚀 Live Demo

Experience the application live here:  
👉 **[play-loop.onrender.com](https://play-loop.onrender.com)**

---

## ✨ Key Features

* **Direct & Ad-Free Audio Streaming**  
  Leverages a lightning-fast custom Express backend that interfaces with high-performance audio APIs (`ytmusic-api`) to pull high-quality audio streams without interruptions.
* **Progressive Web Application (PWA)**  
  Engineered as a fully functional PWA. Install it on your mobile device or desktop for a native app-like experience with background playback support and service workers (`sw.js`).
* **Secure Offline Downloads**  
  Download your favorite tracks directly to your device for offline listening via secure backend streaming proxy.
* **Instant Streaming Proxy**  
  Audio streams are proxied and piped directly to the client on-the-fly, eliminating heavy disk-caching delays.
* **Intelligent "Up Next" Queue**  
  Dynamic recommendation system that analyzes your currently playing song and language preferences (English, Hindi, Punjabi, etc.) for continuous, non-repetitive playback.
* **Premium & Fluid UI**  
  Designed with a sleek dark aesthetic, glassmorphism, responsive UI components, and fluid micro-animations built with React 19 and Lucide icons.

---

## 🛠️ Technology Stack

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![Render](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)

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
   Create a `.env` file in the root directory:
   ```env
   LASTFM_API_KEY=your_lastfm_api_key
   LASTFM_SHARED_SECRET=your_lastfm_secret
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

---

## 📁 Project Structure

```text
├── public/          # Static assets & icons
├── src/             # React application source code
│   ├── components/  # Reusable UI components (Player, Sidebar, Audio cards)
│   ├── pages/       # Application views (Home, Search, Playlists, etc.)
│   └── styles/      # Modular CSS stylesheets
├── server.js        # Express backend for streaming proxy & API endpoints
├── sw.js            # Service worker for PWA caching & offline support
├── vite.config.mjs  # Vite build configuration
└── package.json     # Project metadata and dependencies
```

---

## 👤 About the Developer

This project is the independent work of a solo developer. Driven by a passion for music, design, and software engineering, **Play LooP** was built entirely from scratch to provide a premium, fast, and ad-free music streaming experience.

---

## 📬 Contact & Links

- **GitHub:** [@vraj07-11](https://github.com/vraj07-11)
- **Email:** [gajeravraj593@gmail.com](mailto:gajeravraj593@gmail.com)
- **LinkedIn:** [Vraj Gajera](https://www.linkedin.com/in/vraj-gajera-260a96377)

