# Play LooP

Play LooP is a lightweight, full-stack web application designed to stream and enjoy music seamlessly. It acts as a bridge, fetching and streaming ads-free audio directly from YouTube with a clean interface and an optimized local caching mechanism.

## Live Demo
Check out the live application here: [play-loop.onrender.com](https://play-loop.onrender.com)

---

## Features

- **Direct Audio Streaming:** Leverages `yt-dlp` , `iframe` (if yt-dlp fails) and `ytmusic-api` under the hood to pull accurate search results, music recommendations, and high-quality audio streams.
- **Smart Local Caching:** To optimize performance and reduce latency, extracted audio files are temporarily cached in a local directory.
- **Storage Management:** Built-in cleanup logic enforces a strict storage limit on cached tracks, preventing disk overflow on the server.
- **Responsive Interface:** Designed to provide a smooth user experience across various screen sizes.
- **Progressive Web Application:** For better mobile experience.

---

## Tech Stack
- **Frontend:** HTML5, CSS, Vanilla Js, React Js
- **Backend:** Node.js, Express.js
- **Media Processing:** `saavncdn`
- **Player:** `Play LooP Player`
- **Recommendation System:** `Hybrid - Play-Loop + Last.fm + Saavn`
- **Containerization:** Docker
- **Deployment:** Render

---
