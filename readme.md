# Play LooP 🎵

**Play LooP** is a modern, lightweight, and fully-featured web application designed to stream and enjoy music seamlessly. Built with performance and user experience in mind, it acts as a powerful bridge that fetches and streams ad-free audio, paired with a beautiful interface and an intelligent local caching mechanism.

---

## 🚀 Live Demo
Experience the application live here: **[play-loop.onrender.com](https://play-loop.onrender.com)**

---

## ✨ Key Features

*   **Direct & Ad-Free Audio Streaming** 🎧
    Leverages the custom `Play.LooP Engine` and `Last.fm` under the hood to pull accurate search results, personalized music recommendations, and high-quality audio streams without interruptions.
*   **Progressive Web Application (PWA)** 📱
    Engineered as a fully functional PWA. Install it on your mobile device or desktop for a native app-like experience. Features seamless deep-linking, background playback support, and a responsive app shell.
*   **Offline Downloads** 📥
    A dedicated download page allows you to safely and quickly save your favorite tracks directly to your device for offline listening anytime, anywhere.
*   **Smart Local Caching** ⚡
    To heavily optimize performance and reduce network latency, extracted audio files are temporarily cached on the server. A built-in storage management system automatically enforces strict cleanup logic to prevent disk overflow.
*   **Hybrid Recommendation System** 🧠
    Curated listening experiences powered by Play.LooP's own recommendation engine, beautifully paired with a robust `Last.fm` fallback to ensure you never run out of great music.
*   **Responsive & Fluid UI** 🎨
    Designed with a sleek, mobile-first approach. Whether you're on a massive desktop monitor or a small smartphone screen, the interface smoothly adapts to give you the best experience.

---

## 🛠️ Technology Stack

**Frontend Architecture:**
*   **Framework:** React.js powered by Vite for lightning-fast HMR and optimized builds.
*   **Styling & Icons:** Modern Vanilla CSS combined with `Lucide React` for crisp, scalable iconography.
*   **State Management:** Custom `Play LooP Player` context for global audio state handling.

**Backend Architecture:**
*   **Server:** Node.js & Express.js handling API routing and proxying.
*   **Media Processing:** Custom `Play.LooP Engine` for parsing and delivering audio streams.
*   **Recommendations:** `Play.LooP` & `Last.fm` integration.

**Infrastructure:**
*   **Containerization:** Docker support for easy isolated deployments.
*   **Deployment:** Hosted securely on Render.

---

## 📦 Installation & Local Setup

Want to run Play LooP locally on your machine? Follow these simple steps:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/vraj07-11/Play-LooP.git
   cd Play-LooP
   ```

2. **Install Dependencies:**
   Make sure you have Node.js installed. Then, install the required packages:
   ```bash
   npm install
   ```

3. **Start the Development Servers:**
   You will need to run both the frontend (Vite) and the backend (Express) concurrently.
   
   Start the backend server:
   ```bash
   npm start
   ```
   
   Start the frontend React app (in a new terminal):
   ```bash
   npm run dev
   ```

4. **Enjoy the Music!** 🎉
   Open your browser and navigate to `http://localhost:5173`.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/vraj07-11/Play-LooP/issues) if you want to contribute.

## 📝 License

This project is licensed under the **ISC License**.
