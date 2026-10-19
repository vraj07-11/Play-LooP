// --- External Playlist Scrapers (Spotify & YouTube) ---

async function getSpotifyPlaylistDetails(spotifyUrl) {
	try {
		const match = spotifyUrl.match(/(playlist|album)\/([a-zA-Z0-9]+)/);
		if (!match) return null;
		const type = match[1];
		const id = match[2];

		let accessToken = null;
		try {
			const tokRes = await fetch("https://open.spotify.com/get_access_token", {
				headers: {
					"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
					"App-Platform": "WebPlayer"
				}
			});
			if (tokRes.ok) {
				const tokData = await tokRes.json();
				accessToken = tokData.accessToken;
			}
		} catch (e) {
			console.error("Spotify token fetch failed:", e.message);
		}

		if (accessToken) {
			const apiRes = await fetch(
				type === "album" 
					? `https://api.spotify.com/v1/albums/${id}`
					: `https://api.spotify.com/v1/playlists/${id}?fields=name,images,tracks.items(track(name,artists(name)))`,
				{
					headers: {
						"Authorization": `Bearer ${accessToken}`,
						"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
					}
				}
			);

			if (apiRes.ok) {
				const apiData = await apiRes.json();
				const title = apiData.name || "Spotify Playlist";
				const thumbnail = apiData.images?.[0]?.url || "/default-cover.svg";
				const rawItems = type === "album" ? (apiData.tracks?.items || []) : (apiData.tracks?.items || []).map(i => i.track).filter(Boolean);

				const songsToSearch = [];
				for (const t of rawItems) {
					const trackName = t.name;
					const artistNames = (t.artists || []).map(a => a.name).join(" ");
					if (trackName) {
						songsToSearch.push(`${trackName} ${artistNames}`.trim());
					}
				}

				if (songsToSearch.length > 0) {
					return { title, thumbnail, songsToSearch };
				}
			}
		}

		const embedRes = await fetch(`https://open.spotify.com/embed/${type}/${id}`, {
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
			}
		});
		if (embedRes.ok) {
			const html = await embedRes.text();
			let title = "Spotify Playlist";
			let thumbnail = "/default-cover.svg";
			const songsToSearch = [];

			const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
			if (titleMatch) title = titleMatch[1].replace("- Spotify", "").replace("Spotify –", "").trim();

			const nextMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
			if (nextMatch) {
				try {
					const json = JSON.parse(nextMatch[1]);
					const entity = json?.props?.pageProps?.entity || json?.props?.pageProps?.state?.data?.entity;
					if (entity) {
						if (entity.name) title = entity.name;
						if (entity.coverArt?.sources?.[0]?.url) thumbnail = entity.coverArt.sources[0].url;

						const trackList = entity.trackList || entity.tracks?.items || [];
						for (const item of trackList) {
							const t = item.track || item;
							const name = t.title || t.name;
							const artist = (t.subtitle || t.artists?.[0]?.name || "").replace(/\u00a0/g, " ");
							if (name) songsToSearch.push(`${name} ${artist}`.trim());
						}
					}
				} catch (err) {}
			}

			if (songsToSearch.length > 0) {
				return { title, thumbnail, songsToSearch };
			}
		}
	} catch (e) {
		console.error("getSpotifyPlaylistDetails error:", e);
	}
	return null;
}

async function getYouTubePlaylistDetails(ytUrl) {
	try {
		const listMatch = ytUrl.match(/list=([a-zA-Z0-9_-]+)/);
		const listId = listMatch ? listMatch[1] : null;
		if (!listId) return null;

		const res = await fetch(`https://www.youtube.com/playlist?list=${listId}`, {
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
				"Accept-Language": "en-US,en;q=0.9"
			}
		});

		if (!res.ok) return null;
		const html = await res.text();

		const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i) || html.match(/<title>([^<]+)<\/title>/i);
		let title = titleMatch ? titleMatch[1].replace("- YouTube Music", "").replace("- YouTube", "").trim() : "YouTube Playlist";
		if (title.includes("http") || title.length > 80) title = "YouTube Playlist";

		const thumbMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
		const thumbnail = thumbMatch ? thumbMatch[1] : "/default-cover.svg";

		const songsToSearch = [];

		const jsonMatch = html.match(/var ytInitialData = ({.*?});<\/script>/s) || html.match(/window\["ytInitialData"\] = ({.*?});/s);
		if (jsonMatch) {
			try {
				const ytData = JSON.parse(jsonMatch[1]);
				
				function extractItems(obj) {
					if (!obj || typeof obj !== 'object') return;

					// 1. New YouTube lockupViewModel format (2025/2026)
					if (obj.lockupViewModel) {
						const l = obj.lockupViewModel;
						const trackTitle = l.metadata?.lockupMetadataViewModel?.title?.content;
						const artistName = l.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text?.content || "";
						if (trackTitle && !trackTitle.includes("[Deleted video]") && !trackTitle.includes("[Private video]")) {
							songsToSearch.push(`${trackTitle} ${artistName}`.trim());
						}
					}

					// 2. Classic playlistVideoRenderer format
					if (obj.playlistVideoRenderer) {
						const v = obj.playlistVideoRenderer;
						const t = v.title?.runs?.[0]?.text || v.title?.simpleText;
						const artist = v.shortBylineText?.runs?.[0]?.text || v.longBylineText?.runs?.[0]?.text || "";
						if (t && !t.includes("[Deleted video]") && !t.includes("[Private video]") && !t.includes("Play all")) {
							songsToSearch.push(`${t} ${artist}`.trim());
						}
					}

					// 3. YouTube Music responsive list item format
					if (obj.musicResponsiveListItemRenderer) {
						const item = obj.musicResponsiveListItemRenderer;
						const flexColumns = item.flexColumns || [];
						const t = flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
						const artist = flexColumns[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || "";
						if (t && !t.includes("Play all")) {
							songsToSearch.push(`${t} ${artist}`.trim());
						}
					}

					for (const k of Object.keys(obj)) {
						if (typeof obj[k] === 'object') {
							extractItems(obj[k]);
						}
					}
				}

				extractItems(ytData);
			} catch (err) {
				console.error("ytInitialData error:", err);
			}
		}

		const cleaned = songsToSearch.filter(s => 
			s.length > 2 && 
			!s.includes("Keyboard shortcuts") && 
			!s.includes("Playback") &&
			!s.includes("General") &&
			!s.includes("Subtitles")
		);

		if (cleaned.length > 0) {
			return { title, thumbnail, songsToSearch: cleaned };
		}
	} catch (e) {
		console.error("getYouTubePlaylistDetails error:", e);
	}
	return null;
}

module.exports = {
	getSpotifyPlaylistDetails,
	getYouTubePlaylistDetails
};
