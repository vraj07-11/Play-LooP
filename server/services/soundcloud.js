const { cleanStr, getValidImage, isValidSongDuration } = require("./jiosaavn");

// --- SoundCloud Helper Functions ---
let scClientIdCache = { id: "V7f0p2q7JD4voO1Esqg6bwwtNYcYAtLC", fetchedAt: Date.now() };
let isFetchingScClientId = false;

async function refreshSoundCloudClientIdInBackground() {
	if (isFetchingScClientId) return;
	isFetchingScClientId = true;
	try {
		const htmlRes = await fetch("https://soundcloud.com", {
			headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
			signal: AbortSignal.timeout(4000)
		});
		if (htmlRes.ok) {
			const html = await htmlRes.text();
			const scriptMatches = [...html.matchAll(/<script [^>]*src="([^"]+)"/g)];
			const scriptUrls = scriptMatches.map(m => m[1]).filter(url => url && url.startsWith("http"));

			for (const url of scriptUrls.slice(-6).reverse()) {
				try {
					const jsRes = await fetch(url, {
						headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
						signal: AbortSignal.timeout(3000)
					});
					if (jsRes.ok) {
						const jsText = await jsRes.text();
						const match = jsText.match(/client_id[:=]["']([a-zA-Z0-9]{32})["']/);
						if (match && match[1]) {
							scClientIdCache = { id: match[1], fetchedAt: Date.now() };
							break;
						}
					}
				} catch (_) {}
			}
		}
	} catch (_) {
	} finally {
		isFetchingScClientId = false;
		scClientIdCache.fetchedAt = Date.now();
	}
}

function getSoundCloudClientId() {
	const now = Date.now();
	// Refresh in background if older than 2 hours without blocking active request
	if (now - scClientIdCache.fetchedAt > 2 * 60 * 60 * 1000) {
		refreshSoundCloudClientIdInBackground().catch(() => {});
	}
	return scClientIdCache.id || "V7f0p2q7JD4voO1Esqg6bwwtNYcYAtLC";
}

async function searchSoundCloud(query, limit = 8) {
	try {
		const clientId = getSoundCloudClientId();
		if (!clientId) return [];

		const url = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=${limit}`;
		const res = await fetch(url, {
			headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
			signal: AbortSignal.timeout(1200)
		});
		if (!res.ok) return [];
		const data = await res.json();
		const collection = data.collection || [];

		return collection.map(track => {
			const artwork = track.artwork_url || track.user?.avatar_url || "";
			const highResArt = artwork ? artwork.replace("-large", "-t500x500") : "/default-cover.svg";

			return {
				videoId: `sc:${track.id}`,
				title: cleanStr(track.title, "SoundCloud Track"),
				artist: cleanStr(track.user?.username || track.user?.full_name, "SoundCloud Artist"),
				thumbnail: getValidImage(highResArt),
				duration: Math.round((track.duration || 0) / 1000),
				source: "soundcloud",
				provider: "SoundCloud",
				tag: "SoundCloud"
			};
		}).filter(s => isValidSongDuration(s.duration));
	} catch (err) {
		if (err.name !== "TimeoutError") {
			console.warn("[SoundCloud] Search warning:", err.message || err);
		}
		return [];
	}
}

const scStreamUrlCache = new Map();

async function getSoundCloudStreamUrl(scId) {
	const cached = scStreamUrlCache.get(scId);
	if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
		return cached.url;
	}
	try {
		const clientId = await getSoundCloudClientId();
		if (!clientId) return null;

		const trackRes = await fetch(`https://api-v2.soundcloud.com/tracks/${scId}?client_id=${clientId}`, {
			headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
			signal: AbortSignal.timeout(5000)
		});
		if (!trackRes.ok) return null;
		const trackData = await trackRes.json();

		const trans = trackData.media?.transcodings || [];
		if (trans.length === 0) return null;

		// 1. Prefer non-snipped full-length streams over previews
		const fullLength = trans.filter(t => !t.snipped);
		const candidates = fullLength.length > 0 ? fullLength : trans;

		// 2. Select progressive MP3 if available so browser can play directly without HLS processing
		const transcoding = 
			candidates.find(t => t.format?.protocol === "progressive") ||
			candidates.find(t => t.preset === "aac_160k") ||
			candidates.find(t => t.preset === "aac_256k") ||
			candidates[0];

		if (!transcoding || !transcoding.url) return null;

		const streamRes = await fetch(`${transcoding.url}?client_id=${clientId}`, {
			headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
			signal: AbortSignal.timeout(5000)
		});
		if (!streamRes.ok) return null;
		const streamData = await streamRes.json();
		const finalUrl = streamData.url || null;
		if (finalUrl) {
			scStreamUrlCache.set(scId, { url: finalUrl, timestamp: Date.now() });
			if (scStreamUrlCache.size > 200) {
				const oldest = scStreamUrlCache.keys().next().value;
				scStreamUrlCache.delete(oldest);
			}
		}
		return finalUrl;
	} catch (err) {
		console.error("[SoundCloud] Stream resolve error:", err.message || err);
		return null;
	}
}

async function streamSoundCloudAudio(scId, req, res) {
	try {
		const clientId = await getSoundCloudClientId();
		if (!clientId) return res.status(502).send("SoundCloud client ID not available");

		const trackRes = await fetch(`https://api-v2.soundcloud.com/tracks/${scId}?client_id=${clientId}`, {
			headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
			signal: AbortSignal.timeout(5000)
		});
		if (!trackRes.ok) return res.status(404).send("SoundCloud track not found");
		const trackData = await trackRes.json();
		const trans = trackData.media?.transcodings || [];
		if (trans.length === 0) return res.status(404).send("No audio transcodings available");

		// If a full-length progressive MP3 exists, redirect directly
		const prog = trans.find(t => t.format?.protocol === "progressive" && !t.snipped) ||
		             trans.find(t => t.format?.protocol === "progressive");
		const hasFullHls = trans.some(t => t.format?.protocol === "hls" && !t.snipped);

		if (prog && (!prog.snipped || !hasFullHls)) {
			const streamRes = await fetch(`${prog.url}?client_id=${clientId}`, {
				headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
				signal: AbortSignal.timeout(5000)
			});
			if (streamRes.ok) {
				const streamData = await streamRes.json();
				if (streamData.url) {
					return res.redirect(302, streamData.url);
				}
			}
		}

		// Otherwise stream HLS segments directly to client
		const hlsTrans = trans.find(t => !t.snipped && t.preset === "aac_160k" && t.format?.protocol === "hls") ||
		                 trans.find(t => !t.snipped && t.format?.protocol === "hls") ||
		                 trans.find(t => t.format?.protocol === "hls") ||
		                 trans[0];

		if (!hlsTrans || !hlsTrans.url) return res.status(404).send("Stream URL not found");

		const streamRes = await fetch(`${hlsTrans.url}?client_id=${clientId}`, {
			headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
			signal: AbortSignal.timeout(5000)
		});
		if (!streamRes.ok) return res.status(404).send("Could not resolve SoundCloud stream");
		const streamData = await streamRes.json();
		const m3u8Url = streamData.url;
		if (!m3u8Url) return res.status(404).send("SoundCloud playlist not found");

		const m3u8Res = await fetch(m3u8Url, { signal: AbortSignal.timeout(5000) });
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

		const isMp4 = Boolean(initUrl) || (hlsTrans.format?.mime_type || "").includes("mp4");
		const mimeType = isMp4 ? "audio/mp4" : "audio/mpeg";

		const trackSec = Math.round((trackData.duration || 0) / 1000);
		if (trackSec > 0) {
			res.setHeader("X-Track-Duration", String(trackSec));
			res.setHeader("Access-Control-Expose-Headers", "X-Track-Duration");
		}

		res.setHeader("Content-Type", mimeType);
		res.setHeader("Accept-Ranges", "none");

		// Stream init segment first so browser decoders can immediately initialize
		if (initUrl) {
			try {
				const initRes = await fetch(initUrl, { signal: AbortSignal.timeout(5000) });
				if (initRes.ok) {
					const initBuf = Buffer.from(await initRes.arrayBuffer());
					res.write(initBuf);
				}
			} catch (initErr) {
				console.error("[SoundCloud] Error fetching init segment:", initErr.message);
			}
		}

		// Stream chunks with a concurrent prefetch sliding window so buffer fills rapidly ahead of playback
		const CONCURRENCY = 4;
		const prefetchMap = new Map();
		const fetchChunk = (idx) => {
			if (idx >= segmentUrls.length || prefetchMap.has(idx)) return;
			const p = fetch(segmentUrls[idx], { signal: AbortSignal.timeout(6000) })
				.then(r => r.ok ? r.arrayBuffer() : null)
				.then(buf => buf ? Buffer.from(buf) : null)
				.catch(segErr => {
					console.error("[SoundCloud] Chunk fetch error:", segErr.message);
					return null;
				});
			prefetchMap.set(idx, p);
		};

		for (let k = 0; k < Math.min(CONCURRENCY, segmentUrls.length); k++) {
			fetchChunk(k);
		}

		for (let i = 0; i < segmentUrls.length; i++) {
			if (res.writableEnded || res.closed) break;
			fetchChunk(i + CONCURRENCY);

			const segPromise = prefetchMap.get(i);
			prefetchMap.delete(i);
			const segBuf = segPromise ? await segPromise : null;
			if (segBuf && !res.writableEnded && !res.closed) {
				res.write(segBuf);
			}
		}

		if (!res.writableEnded) res.end();
	} catch (err) {
		console.error("[SoundCloud] Streaming error:", err.message || err);
		if (!res.headersSent) res.status(500).send("SoundCloud streaming error");
	}
}

async function getSoundCloudPlaylistDetails(scUrl) {
	try {
		const clientId = await getSoundCloudClientId();
		if (!clientId) return null;

		const resolveUrl = `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(scUrl)}&client_id=${clientId}`;
		const res = await fetch(resolveUrl, {
			headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
		});

		if (!res.ok) return null;
		const data = await res.json();
		if (data.kind !== 'playlist' && data.kind !== 'system-playlist') return null;

		const title = data.title || "SoundCloud Playlist";
		const author = data.user?.username || data.user?.full_name || "SoundCloud";
		const rawArt = data.artwork_url || data.user?.avatar_url || "";
		const thumbnail = rawArt ? rawArt.replace("-large", "-t500x500") : "/default-cover.svg";

		const tracks = [];
		const songsToSearch = [];

		if (Array.isArray(data.tracks)) {
			for (const t of data.tracks) {
				const trackTitle = t.title;
				const trackArtist = t.user?.username || t.user?.full_name || "SoundCloud Artist";
				if (trackTitle) {
					songsToSearch.push(`${trackTitle} ${trackArtist}`.trim());
					if (t.id) {
						const durSec = Math.round((t.duration || 0) / 1000);
						if (isValidSongDuration(durSec)) {
							const art = t.artwork_url || t.user?.avatar_url || rawArt || "";
							const img = art ? art.replace("-large", "-t500x500") : thumbnail;
							tracks.push({
								videoId: `sc:${t.id}`,
								title: cleanStr(trackTitle, "SoundCloud Track"),
								artist: cleanStr(trackArtist, "SoundCloud Artist"),
								thumbnail: getValidImage(img),
								duration: durSec,
								source: "soundcloud",
								provider: "SoundCloud",
								tag: "SoundCloud"
							});
						}
					}
				}
			}
		}

		if (tracks.length > 0) {
			return { source: 'soundcloud', title, author, thumbnail, tracks };
		} else if (songsToSearch.length > 0) {
			return { source: 'soundcloud', title, author, thumbnail, songsToSearch };
		}
	} catch (e) {
		console.error("getSoundCloudPlaylistDetails error:", e);
	}
	return null;
}

module.exports = {
	getSoundCloudClientId,
	searchSoundCloud,
	getSoundCloudStreamUrl,
	streamSoundCloudAudio,
	getSoundCloudPlaylistDetails
};
