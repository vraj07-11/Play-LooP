const path = require("node:path");
const fs = require("node:fs");
const express = require("express");
const cors = require("cors");
const compression = require("compression");

const { metaRouter, spaFallback, ROOT_DIR } = require("./routes/meta.routes");
const searchRouter = require("./routes/search.routes");
const audioRouter = require("./routes/audio.routes");
const exploreRouter = require("./routes/explore.routes");
const { playlistRouter } = require("./routes/playlist.routes");
const userRouter = require("./routes/user.routes");
const lyricsRouter = require("./routes/lyrics.routes");

const app = express();

app.use(cors());
app.use(compression());
app.use(express.json({ limit: "2mb" }));

// 1. Meta / OpenGraph share cards and cover proxy (must be before static files so /track/:id works)
app.use(metaRouter);

// 2. Static files (dist build or dev directory)
const distPath = path.join(ROOT_DIR, "dist");
if (fs.existsSync(distPath)) {
	app.use(express.static(distPath, {
		etag: true,
		maxAge: "1d",
		setHeaders: (res, filePath) => {
			if (filePath.endsWith("index.html")) {
				res.setHeader("Cache-Control", "no-cache");
			} else if (filePath.includes("/assets/")) {
				res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
			}
		}
	}));
} else {
	app.use(express.static(ROOT_DIR));
}

// 3. Health Check
app.get("/api/health", (req, res) => {
	res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// 4. API Routers
app.use(searchRouter);
app.use(audioRouter);
app.use(exploreRouter);
app.use(playlistRouter);
app.use(userRouter);
app.use(lyricsRouter);

// 5. SPA Fallback for client-side routing
app.use(spaFallback);

module.exports = app;
