const express = require("express");
const { fetchJioSaavn, formatSong, cleanStr } = require("../services/jiosaavn");
const {
	getSoundCloudClientId,
	getSoundCloudStreamUrl,
	searchSoundCloud
} = require("../services/soundcloud");

const router = express.Router();

router.get("/api/audio/preload", (req, res) => {
	res.json({ ok: true });
});

router.get("/api/audio", async (req, res) => {
	const videoId = String(req.query.id || "").trim();
	const quality = String(req.query.quality || "320").trim();
	if (!videoId) return res.status(400).send("Video ID is required");

	// Handle SoundCloud tracks
	if (videoId.startsWith("sc:")) {
		const scId = videoId.replace(/^sc:/, "");
		const scStreamUrl = await getSoundCloudStreamUrl(scId);
		if (scStreamUrl) {
			return res.redirect(302, scStreamUrl);
		} else {
			return res.status(404).send("SoundCloud stream URL not found");
		}
	}

	// Handle dynamic search query tracks
	if (videoId.startsWith("QUERY:")) {
		let query = videoId.replace(/^QUERY:/, "");
		try { query = decodeURIComponent(query); } catch(e) {}
		
		try {
			const searchData = await fetchJioSaavn({ __call: "search.getResults", q: query, n: "3", p: "1" });
			if (searchData && searchData.results && searchData.results.length > 0) {
				const formatted = formatSong(searchData.results[0], quality);
				if (formatted.streamUrl) return res.redirect(302, formatted.streamUrl);
			}
		} catch (e) {}

		try {
			const scSongs = await searchSoundCloud(query, 3);
			if (scSongs.length > 0) {
				const scId = scSongs[0].videoId.replace(/^sc:/, "");
				const scStreamUrl = await getSoundCloudStreamUrl(scId);
				if (scStreamUrl) return res.redirect(302, scStreamUrl);
			}
		} catch (e) {}

		return res.status(404).send("Audio stream for query not found");
	}

	try {
		const data = await fetchJioSaavn({ __call: "song.getDetails", pids: videoId });
		let songData = data[videoId] || (data.songs && data.songs[0]);

		if (!songData) {
			return res.status(404).send("Song not found");
		}

		const formatted = formatSong(songData, quality);
		if (formatted.streamUrl) {
			return res.redirect(302, formatted.streamUrl);
		} else {
			return res.status(404).send("Stream URL not found");
		}
	} catch (error) {
		console.error("Audio stream failed:", error);
		res.status(502).send("Audio extraction failed");
	}
});

router.get("/api/download", async (req, res) => {
	let videoId = String(req.query.id || "").trim();
	if (!videoId) return res.status(400).send("Video ID is required");

	// 1. Resolve QUERY: tracks
	if (videoId.startsWith("QUERY:")) {
		let query = videoId.replace(/^QUERY:/, "");
		try { query = decodeURIComponent(query); } catch (e) {}

		try {
			const searchData = await fetchJioSaavn({ __call: "search.getResults", q: query, n: "3", p: "1" });
			if (searchData && searchData.results && searchData.results.length > 0) {
				videoId = searchData.results[0].id;
			} else {
				const scSongs = await searchSoundCloud(query, 3);
				if (scSongs.length > 0) {
					videoId = scSongs[0].videoId;
				}
			}
		} catch (e) {}
	}

	// 2. Handle SoundCloud tracks (starts with sc:)
	if (videoId.startsWith("sc:")) {
		try {
			const scId = videoId.replace(/^sc:/, "");
			const clientId = await getSoundCloudClientId();
			if (!clientId) return res.status(502).send("SoundCloud client ID not available");

			const trackRes = await fetch(`https://api-v2.soundcloud.com/tracks/${scId}?client_id=${clientId}`, {
				headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
			});
			if (!trackRes.ok) return res.status(404).send("SoundCloud track not found");
			const trackData = await trackRes.json();

			const title = cleanStr(trackData.title, "SoundCloud Track");
			const artist = cleanStr(trackData.user?.username || trackData.user?.full_name, "SoundCloud Artist");
			const cleanName = `${title.replace(/[^a-z0-9 ]/gi, '')} - ${artist.replace(/[^a-z0-9 ]/gi, '')}`.trim() || "SoundCloud Track";

			const trans = trackData.media?.transcodings || [];
			if (trans.length === 0) return res.status(404).send("No audio transcodings available");

			// Prefer progressive MP3 stream if available
			const prog = trans.find(t => t.format?.protocol === 'progressive');
			if (prog && prog.url) {
				const streamRes = await fetch(`${prog.url}?client_id=${clientId}`, {
					headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
				});
				if (streamRes.ok) {
					const streamData = await streamRes.json();
					if (streamData.url) {
						const https = require("node:https");
						const http = require("node:http");
						const client = streamData.url.startsWith("https") ? https : http;
						res.setHeader("Content-Disposition", `attachment; filename="${cleanName}.mp3"`);
						res.setHeader("Content-Type", "audio/mpeg");
						return client.get(streamData.url, (proxyRes) => {
							proxyRes.pipe(res);
						}).on("error", (e) => {
							console.error("SoundCloud progressive download proxy error:", e);
							if (!res.headersSent) res.status(502).send("Download failed");
						});
					}
				}
			}

			// Assemble HLS fMP4 / AAC segments
			const hlsTrans = trans.find(t => t.preset === 'aac_160k' && t.format?.protocol === 'hls') ||
			                 trans.find(t => t.format?.protocol === 'hls') ||
			                 trans[0];

			if (!hlsTrans || !hlsTrans.url) return res.status(404).send("Stream URL not found");

			const streamRes = await fetch(`${hlsTrans.url}?client_id=${clientId}`, {
				headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
			});
			if (!streamRes.ok) return res.status(404).send("Could not resolve SoundCloud stream");
			const streamData = await streamRes.json();
			const m3u8Url = streamData.url;
			if (!m3u8Url) return res.status(404).send("SoundCloud playlist not found");

			const m3u8Res = await fetch(m3u8Url);
			if (!m3u8Res.ok) return res.status(404).send("Could not fetch playlist segments");
			const m3u8Text = await m3u8Res.text();
			const lines = m3u8Text.split("\n");

			let initUrl = null;
			const segmentUrls = [];

			for (const line of lines) {
				const trimmed = line.trim();
				if (trimmed.startsWith("#EXT-X-MAP:URI=")) {
					const match = trimmed.match(/URI="([^"]+)"/);
					if (match) initUrl = match[1];
				} else if (trimmed && !trimmed.startsWith("#")) {
					segmentUrls.push(trimmed);
				}
			}

			if (segmentUrls.length === 0) {
				return res.status(404).send("No audio segments found in playlist");
			}

			const isMp4 = Boolean(initUrl) || (hlsTrans.format?.mime_type || '').includes('mp4');
			const ext = isMp4 ? 'm4a' : 'mp3';
			const mimeType = isMp4 ? 'audio/mp4' : 'audio/mpeg';

			res.setHeader("Content-Disposition", `attachment; filename="${cleanName}.${ext}"`);
			res.setHeader("Content-Type", mimeType);

			if (initUrl) {
				try {
					const initRes = await fetch(initUrl);
					if (initRes.ok) {
						const initBuf = Buffer.from(await initRes.arrayBuffer());
						res.write(initBuf);
					}
				} catch (initErr) {
					console.error("Error fetching SoundCloud init segment:", initErr);
				}
			}

			const BATCH_SIZE = 4;
			for (let i = 0; i < segmentUrls.length; i += BATCH_SIZE) {
				const batch = segmentUrls.slice(i, i + BATCH_SIZE);
				const buffers = await Promise.all(
					batch.map(async (url) => {
						try {
							const r = await fetch(url);
							if (r.ok) return Buffer.from(await r.arrayBuffer());
						} catch (e) {
							console.error("Error fetching SoundCloud chunk:", e);
						}
						return null;
					})
				);
				for (const buf of buffers) {
					if (buf && buf.length > 0) {
						res.write(buf);
					}
				}
			}

			return res.end();
		} catch (scErr) {
			console.error("[SoundCloud] Download failed:", scErr);
			if (!res.headersSent) res.status(502).send("SoundCloud download failed");
			return;
		}
	}

	// 3. Handle JioSaavn tracks
	try {
		const data = await fetchJioSaavn({ __call: "song.getDetails", pids: videoId });
		let songData = data[videoId] || (data.songs && data.songs[0]);

		if (!songData) {
			return res.status(404).send("Song not found");
		}

		const formatted = formatSong(songData);
		if (formatted.streamUrl) {
			const https = require("node:https");
			const http = require("node:http");
			const client = formatted.streamUrl.startsWith("https") ? https : http;
			
			const filename = `${formatted.title.replace(/[^a-z0-9 ]/gi, '')} - ${formatted.artist.replace(/[^a-z0-9 ]/gi, '')}.m4a`;
			
			client.get(formatted.streamUrl, (proxyRes) => {
				res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
				res.setHeader("Content-Type", proxyRes.headers["content-type"] || "audio/mp4");
				proxyRes.pipe(res);
			}).on("error", (e) => {
				console.error("Download proxy error:", e);
				res.status(502).send("Download failed");
			});
		} else {
			return res.status(404).send("Stream URL not found");
		}
	} catch (error) {
		console.error("Download endpoint failed:", error);
		res.status(502).send("Download failed");
	}
});

module.exports = router;
