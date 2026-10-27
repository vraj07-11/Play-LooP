const path = require("node:path");
const fs = require("node:fs");
const express = require("express");
const { fetchJioSaavn, formatSong, cleanStr } = require("../services/jiosaavn");
const { getSoundCloudClientId, getSoundCloudTrackDetails } = require("../services/soundcloud");

const router = express.Router();
const ROOT_DIR = path.resolve(__dirname, "../../");

function escapeHtml(str) {
	if (!str) return '';
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

const metaSongCache = new Map();

async function getSongDetailsForMeta(trackId) {
	if (!trackId) return null;
	if (metaSongCache.has(trackId)) {
		return metaSongCache.get(trackId);
	}

	try {
		if (trackId.startsWith("sc:")) {
			const scId = trackId.replace(/^sc:/, "");
			const track = await getSoundCloudTrackDetails(scId);
			if (track) {
				const details = {
					title: track.title,
					artist: track.artist,
					cover: track.thumbnail
				};
				metaSongCache.set(trackId, details);
				return details;
			}
			return null;
		}

		const data = await fetchJioSaavn({ __call: "song.getDetails", pids: trackId });
		let songData = data[trackId] || (data.songs && data.songs[0]);
		if (songData) {
			const formatted = formatSong(songData);
			const details = {
				title: formatted.title,
				artist: formatted.artist,
				cover: formatted.thumbnail
			};
			metaSongCache.set(trackId, details);
			return details;
		}
	} catch (e) {
		console.warn("[Meta] Could not fetch details for trackId:", trackId, e.message);
	}
	return null;
}

async function getHtmlWithMeta(req) {
	const distIndex = path.join(ROOT_DIR, "dist", "index.html");
	const htmlPath = fs.existsSync(distIndex) ? distIndex : path.join(ROOT_DIR, "index.html");
	let html = fs.readFileSync(htmlPath, "utf8");

	let trackId = req.query.track || req.query.v || req.query.id || (req.params && req.params.id);
	let title = req.query.title ? decodeURIComponent(req.query.title) : null;
	let artist = req.query.artist ? decodeURIComponent(req.query.artist) : null;
	let cover = req.query.cover ? decodeURIComponent(req.query.cover) : null;

	if (trackId && (!title || !artist || !cover)) {
		const fetched = await getSongDetailsForMeta(trackId);
		if (fetched) {
			if (!title) title = fetched.title;
			if (!artist) artist = fetched.artist;
			if (!cover) cover = fetched.cover;
		}
	}

	if (title || cover || trackId) {
		const pageTitle = title ? (artist ? `${title} - ${artist} | Play LooP` : `${title} | Play LooP`) : "Play LooP";
		const desc = title ? (artist ? `Listen to "${title}" by ${artist} on Play LooP.` : `Listen to "${title}" on Play LooP.`) : "Listen to music ad-free on Play LooP.";
		
		const host = (req.get && req.get("host")) || "play-loop.onrender.com";
		const proto = req.protocol === "http" && host.includes("localhost") ? "http" : "https";
		const sharePath = trackId ? `/track/${encodeURIComponent(trackId)}` : (req.originalUrl || req.url || "/");
		const fullUrl = `${proto}://${host}${sharePath}`;

		// Mask CDN: image URL points to our own /api/cover?id=... so no third-party CDN is revealed!
		const img = trackId
			? `${proto}://${host}/api/cover?id=${encodeURIComponent(trackId)}`
			: `${proto}://${host}/favicon.svg`;

		html = html
			.replace(/<title>.*?<\/title>/gi, `<title>${escapeHtml(pageTitle)}</title>`)
			.replace(/<meta property="og:title" content=".*?" \/>/gi, `<meta property="og:title" content="${escapeHtml(pageTitle)}" />`)
			.replace(/<meta property="og:description" content=".*?" \/>/gi, `<meta property="og:description" content="${escapeHtml(desc)}" />`)
			.replace(/<meta property="og:image" content=".*?" \/>/gi, `<meta property="og:image" content="${escapeHtml(img)}" />`)
			.replace(/<meta property="og:image:secure_url" content=".*?" \/>/gi, `<meta property="og:image:secure_url" content="${escapeHtml(img)}" />`)
			.replace(/<meta property="og:url" content=".*?" \/>/gi, `<meta property="og:url" content="${escapeHtml(fullUrl)}" />`)
			.replace(/<meta name="twitter:title" content=".*?" \/>/gi, `<meta name="twitter:title" content="${escapeHtml(pageTitle)}" />`)
			.replace(/<meta name="twitter:description" content=".*?" \/>/gi, `<meta name="twitter:description" content="${escapeHtml(desc)}" />`)
			.replace(/<meta name="twitter:image" content=".*?" \/>/gi, `<meta name="twitter:image" content="${escapeHtml(img)}" />`);
	}
	return html;
}

// Masked Cover Proxy Endpoint: hides third-party CDN from all external crawlers & share cards
router.get(["/api/cover", "/api/cover/:id"], async (req, res) => {
	const trackId = String(req.query.id || (req.params && req.params.id) || "").trim();
	if (!trackId) {
		return res.redirect(302, "/favicon.svg");
	}

	try {
		const meta = await getSongDetailsForMeta(trackId);
		let targetImg = meta?.cover;

		if (!targetImg || targetImg === "/logo.svg" || targetImg === "/default-cover.svg") {
			return res.redirect(302, "/favicon.svg");
		}

		targetImg = targetImg.replace("150x150", "500x500").replace("50x50", "500x500");

		const imgRes = await fetch(targetImg, {
			headers: { "User-Agent": "Mozilla/5.0" }
		});

		if (!imgRes.ok) {
			return res.redirect(302, "/favicon.svg");
		}

		const contentType = imgRes.headers.get("content-type") || "image/jpeg";
		res.setHeader("Content-Type", contentType);
		res.setHeader("Cache-Control", "public, max-age=86400, immutable");

		const buffer = Buffer.from(await imgRes.arrayBuffer());
		return res.send(buffer);
	} catch (e) {
		console.error("Cover proxy failed:", e);
		return res.redirect(302, "/favicon.svg");
	}
});

// Serve customized Open Graph tags for clean shared track links (/track/:id or /s/:id)
router.get(["/", "/track/:id", "/s/:id"], async (req, res, next) => {
	const trackId = req.query.track || req.query.v || req.query.id || (req.params && req.params.id);
	if (trackId || req.query.title || req.query.cover) {
		const html = await getHtmlWithMeta(req);
		res.setHeader("Content-Type", "text/html; charset=utf-8");
		res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
		return res.send(html);
	}
	next();
});

router.get("/sw.js", (req, res) => {
	const swDist = path.join(ROOT_DIR, "dist", "sw.js");
	const swPath = fs.existsSync(swDist) ? swDist : path.join(ROOT_DIR, "sw.js");
	res.setHeader("Content-Type", "application/javascript");
	res.setHeader("Cache-Control", "no-cache");
	return res.sendFile(swPath);
});

// SPA fallback for client-side routing
async function spaFallback(req, res) {
	const html = await getHtmlWithMeta(req);
	res.setHeader("Content-Type", "text/html; charset=utf-8");
	res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
	return res.send(html);
}

module.exports = {
	metaRouter: router,
	spaFallback,
	getHtmlWithMeta,
	ROOT_DIR
};
