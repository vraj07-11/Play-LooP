const path = require("node:path");
const fs = require("node:fs");
const express = require("express");
const cors = require("cors");
const YTMusic = require("ytmusic-api");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const app = express();
const port = process.env.PORT || 3000;
const ytmusic = new YTMusic();
const execFileAsync = promisify(execFile);
const audioCacheDirectory = path.join(__dirname, "audio-cache");
const activeDownloads = new Map();

app.use(cors());
app.use(express.static(__dirname));

app.get("/api/search", async (req, res) => {
	const query = String(req.query.q || "").trim();

	if (!query) {
		return res.status(400).json({ error: 'Query parameter "q" is required' });
	}

	try {
		const songs = await ytmusic.searchSongs(query);
		res.json(songs);
	} catch (error) {
		console.error("Search failed:", error);
		res.status(500).json({ error: "Failed to fetch search results" });
	}
});

app.get("/api/stream", async (req, res) => {
	const videoId = String(req.query.id || "").trim();

	if (!videoId) {
		return res.status(400).json({ error: "Video ID is required" });
	}

	try {
		const streamUrl = await resolveStreamUrl(videoId);
		res.json({ streamUrl });
	} catch (error) {
		console.error("Stream lookup failed:", error);
		res.status(502).json({ error: "Failed to extract audio stream" });
	}
});

app.get("/api/audio", async (req, res) => {
	const videoId = String(req.query.id || "").trim();

	if (!videoId) return res.status(400).send("Video ID is required");

	try {
		const audioPath = await getCachedAudio(videoId);
		res.sendFile(audioPath, {
			acceptRanges: true,
			cacheControl: false,
			maxAge: 0
		});
	} catch (error) {
		console.error("Audio proxy failed:", error);
		if (!res.headersSent) res.status(502).send("Failed to load audio");
	}
});

async function getCachedAudio(videoId) {
	const safeVideoId = videoId.replace(/[^a-zA-Z0-9_-]/g, "");
	const audioPath = path.join(audioCacheDirectory, `${safeVideoId}.mp4`);

	try {
		const file = await fs.promises.stat(audioPath);
		if (file.size > 0) return audioPath;
	} catch {
	}

	if (!activeDownloads.has(videoId)) {
		const download = (async () => {
			await fs.promises.mkdir(audioCacheDirectory, { recursive: true });
			await execFileAsync(process.env.YTDLP_PATH || "yt-dlp.exe", [
				"--quiet",
				"--no-warnings",
				"--no-progress",
				"--no-playlist",
				"--no-part",
				"-f",
				"bestaudio/best",
				"-o",
				audioPath,
				`https://www.youtube.com/watch?v=${videoId}`
			], { timeout: 120000 });
		})();
		activeDownloads.set(videoId, download);
	}

	try {
		await activeDownloads.get(videoId);
	} finally {
		activeDownloads.delete(videoId);
	}

	return audioPath;
}

async function resolveStreamUrl(videoId) {
		const { stdout } = await execFileAsync(process.env.YTDLP_PATH || "yt-dlp.exe", [
			"--no-warnings",
			"--no-playlist",
			"--skip-download",
			"--get-url",
			"-f",
			"bestaudio/best",
			`https://www.youtube.com/watch?v=${videoId}`
		], { timeout: 30000 });
		const streamUrl = stdout.trim().split(/\r?\n/).pop();

		if (!streamUrl) throw new Error("No playable audio format was returned");
		return streamUrl;
}

async function startServer() {
	try {
		await ytmusic.initialize();
		const server = app.listen(port, () => {
			console.log(`Play LooP is running at http://localhost:${port}`);
		});
		server.on("error", (error) => {
			if (error.code === "EADDRINUSE") {
				console.error(`Port ${port} is already in use. Use the existing server or stop it before restarting.`);
			} else {
				console.error("Server failed:", error);
			}
			process.exitCode = 1;
		});
	} catch (error) {
		console.error("Failed to initialize YouTube Music API:", error);
		process.exitCode = 1;
	}
}

startServer();
