const express = require("express");
const { db } = require("../config/db");
const {
	fetchJioSaavn,
	formatSong,
	getValidImage,
	cleanStr,
	isValidSongDuration,
	playlistCoverCache,
	playlistDetailsMemoryCache
} = require("../services/jiosaavn");
const { getSoundCloudPlaylistDetails } = require("../services/soundcloud");
const {
	getSpotifyPlaylistDetails,
	getYouTubePlaylistDetails
} = require("../services/playlistScrapers");

const router = express.Router();

let playlistsCache = {
	data: null,
	lastFetched: 0,
	isFetching: false
};
const PLAYLIST_CACHE_TTL = 3 * 60 * 60 * 1000;

async function fetchPlaylistsBackground() {
	if (playlistsCache.isFetching) return;
	playlistsCache.isFetching = true;
	try {
		// JioSaavn Playlist IDs (Top charts and popular mixes)
		const categoryPool = [
			{ id: "947987697", title: "Global Pop" },
			{ id: "1134543272", title: "Hindi: India Superhits Top 50" },
			{ id: "47599074", title: "Now Trending" },
			{ id: "1202559627", title: "Viral Desi Dance Hits" },
			{ id: "63116930", title: "English 2010s" },
			{ id: "48189087", title: "English Viral Hits" },
			{ id: "1210453303", title: "Latest Hindi Songs" },
			{ id: "1167751266", title: "Hindi 1990s" },
			{ id: "4144832", title: "Punjabi Hit Songs" },
			{ id: "1214335916", title: "Lofi India Hits" },
			{ id: "1134595537", title: "International : India Superhits Top 50" },
			{ id: "110858205", title: "Trending Today" },
			{ id: "902306817", title: "Viral Nation" },
			{ id: "1199709032", title: "Best of Phonk" },
			{ id: "410785269", title: "Best of K-Pop" },
			{ id: "303128179", title: "Best of Pop - English" },
			{ id: "78211018", title: "Best of Dance - English" },
			{ id: "158049570", title: "Chill Beats" },
			{ id: "87109788", title: "Hip Hop Workout" },
			{ id: "84576159", title: "Best of Hip Hop - English" }
		];

		const selectedCategories = categoryPool;

		const results = await Promise.all(
			selectedCategories.map(async (cat) => {
				try {
					const data = await fetchJioSaavn({ __call: "playlist.getDetails", listid: cat.id });
					const plId = data?.id || data?.listid || cat.id;
					if (data && plId) {
						let thumb = getValidImage(data.image);
						const tracks = data.songs || data.list || [];
						if (thumb && thumb.includes('/editorial/')) {
							if (tracks.length > 0 && tracks[0].image) {
								thumb = getValidImage(tracks[0].image);
							}
						}
						if (thumb && !thumb.includes('/editorial/')) {
							playlistCoverCache.set(plId, thumb);
						}
						return {
							playlistId: plId,
							title: cleanStr(cat.title || data.title || data.listname, "Playlist"),
							author: "Play LooP",
							thumbnail: thumb,
							count: parseInt(data.list_count || data.count || tracks.length || "20", 10)
						};
					}
				} catch (e) {
					console.warn(`Failed to fetch playlist ${cat.id}:`, e.message);
				}
				return null;
			})
		);

		const playlists = results.filter(Boolean);

		playlistsCache.data = playlists;
		playlistsCache.lastFetched = Date.now();
	} catch (error) {
		console.error("Background playlists fetch failed:", error);
	} finally {
		playlistsCache.isFetching = false;
	}
}

// Prefetch playlists immediately on boot
fetchPlaylistsBackground();

router.get("/api/playlists", (req, res) => {
	const now = Date.now();
	if (playlistsCache.data && (now - playlistsCache.lastFetched < PLAYLIST_CACHE_TTL)) {
		return res.json(playlistsCache.data);
	}
	if (!playlistsCache.isFetching) {
		fetchPlaylistsBackground();
	}
	if (playlistsCache.data) {
		return res.json(playlistsCache.data);
	}
	return res.json([]);
});

router.get("/api/playlist", async (req, res) => {
	const playlistId = String(req.query.id || "").trim();
	if (!playlistId) return res.status(400).json({ error: "Playlist ID is required" });

	const pageStr = String(req.query.page || "1");
	if (pageStr === "1" && !playlistId.startsWith("ARTIST:") && !playlistId.startsWith("QUERY:") && playlistDetailsMemoryCache.has(playlistId)) {
		const cached = playlistDetailsMemoryCache.get(playlistId);
		if (Date.now() - cached.timestamp < 10 * 60 * 1000) {
			return res.json(cached.data);
		}
	}

	try {
		// 0. Check if this is a user-created or synced playlist stored in database
		try {
			const dbCheck = await db.execute({
				sql: `SELECT id, user_uuid, name, tracks_json, updated_at FROM playlists WHERE id = ?`,
				args: [playlistId]
			});
			if (dbCheck.rows && dbCheck.rows.length > 0) {
				const row = dbCheck.rows[0];
				const tracks = parsePlaylistTracks(row.tracks_json);
				return res.json({
					playlistId: row.id,
					title: row.name,
					author: "Play LooP User",
					thumbnail: tracks[0]?.thumbnail || "/default-cover.svg",
					description: `Playlist containing ${tracks.length} tracks.`,
					count: tracks.length,
					tracks: tracks,
					isUserCreated: true,
					updated_at: row.updated_at
				});
			}
		} catch (dbErr) {
			// Continue to external sources
		}

		if (playlistId.startsWith("ARTIST:")) {
			const artistId = playlistId.replace("ARTIST:", "");
			const pageStr = String(req.query.page || "1");
			const limitStr = String(req.query.limit || "30");

			const data = await fetchJioSaavn({ __call: "artist.getArtistPageDetails", artistId: artistId, p: pageStr, n_song: limitStr, n_album: "0" });
			if (!data || (!data.artistId && !data.name)) {
				throw new Error("Artist not found");
			}

			let tracks = [];
			if (Array.isArray(data.topSongs)) {
				tracks = data.topSongs.map(formatSong).filter(t => Boolean(t && isValidSongDuration(t.duration)));
			} else if (data.topSongs && Array.isArray(data.topSongs.songs)) {
				tracks = data.topSongs.songs.map(formatSong).filter(t => Boolean(t && isValidSongDuration(t.duration)));
			} else if (pageStr !== "1") {
				// If it fails on page > 1, we just return empty tracks.
			}

			let parsedBio = [];
			try {
				if (data.bio) {
					const b = typeof data.bio === 'string' ? JSON.parse(data.bio) : data.bio;
					if (Array.isArray(b)) parsedBio = b;
				}
			} catch(e) {}

			return res.json({
				playlistId,
				title: data.name,
				description: data.subtitle || "Artist",
				thumbnail: getValidImage(data.image),
				isArtist: true,
				followerCount: data.follower_count,
				isVerified: data.isVerified,
				bio: parsedBio,
				tracks: tracks
			});
		}

		if (playlistId.startsWith("QUERY:")) {
			const rawQuery = playlistId.replace("QUERY:", "");
			let query = rawQuery;
			try {
				query = decodeURIComponent(rawQuery).replace(/%20/g, " ");
			} catch (e) {
				query = rawQuery.replace(/%20/g, " ");
			}
			
			const cleanTitle = (str) => {
				return String(str || "")
					.toLowerCase()
					.replace(/[\(\[\{].*?[\)\]\}]/g, "")
					.replace(/[^a-z0-9]/g, "")
					.trim();
			};

			const calculateSimilarity = (str1, str2) => {
				if (!str1 || !str2) return 0;
				if (str1 === str2) return 1;
				
				const getBigrams = (str) => {
					const bigrams = [];
					for (let i = 0; i < str.length - 1; i++) {
						bigrams.push(str.slice(i, i + 2));
					}
					return bigrams;
				};

				const bg1 = getBigrams(str1);
				const bg2 = getBigrams(str2);
				
				if (bg1.length === 0 || bg2.length === 0) return 0;

				let intersection = 0;
				const bg2Copy = [...bg2];
				for (const bg of bg1) {
					const index = bg2Copy.indexOf(bg);
					if (index !== -1) {
						intersection++;
						bg2Copy.splice(index, 1);
					}
				}

				return (2.0 * intersection) / (bg1.length + bg2.length);
			};

			const pageStr = String(req.query.page || "1");
			const limitStr = String(req.query.limit || "30");
			const targetLimit = parseInt(limitStr, 10);
			let rawTracks = [];
			
			try {
				const data = await fetchJioSaavn({ __call: "search.getResults", q: query, n: limitStr, p: pageStr });
				if (data && Array.isArray(data.results)) {
					rawTracks = data.results.map(formatSong).filter(t => Boolean(t && isValidSongDuration(t.duration)));
				}
			} catch (e) {
				console.warn(`QUERY: search page ${pageStr} failed:`, e.message);
			}

			// Deduplicate by normalized song title and fuzzy similarity
			const seenTitles = [];
			const uniqueTracks = [];

			const isDuplicate = (normTitle) => {
				for (const seen of seenTitles) {
					if (calculateSimilarity(normTitle, seen) >= 0.4) {
						return true;
					}
				}
				return false;
			};

			for (const track of rawTracks) {
				if (!isValidSongDuration(track.duration)) continue;
				const normTitle = cleanTitle(track.title);
				if (normTitle && !isDuplicate(normTitle)) {
					seenTitles.push(normTitle);
					uniqueTracks.push(track);
				}
			}

			// If it's page 1 and unique tracks count is low, supplement with top tracks from artists
			if (pageStr === "1" && uniqueTracks.length > 0 && uniqueTracks.length < 10) {
				try {
					const seedTrack = uniqueTracks[0];
					const artists = (seedTrack.artist || "").split("-")[0].split(",");
					for (const rawArtist of artists) {
						const cleanArt = rawArtist.split("ft.")[0].split("feat.")[0].trim();
						if (!cleanArt) continue;
						
						for (let p = 1; p <= 2; p++) {
							const extraData = await fetchJioSaavn({ __call: "search.getResults", q: cleanArt, n: "30", p: String(p) });
							if (extraData && Array.isArray(extraData.results)) {
								for (const track of extraData.results.map(formatSong)) {
									if (!isValidSongDuration(track.duration)) continue;
									const normTitle = cleanTitle(track.title);
									if (normTitle && !isDuplicate(normTitle)) {
										seenTitles.push(normTitle);
										uniqueTracks.push(track);
									}
									if (uniqueTracks.length >= targetLimit) break;
								}
							}
							if (uniqueTracks.length >= targetLimit) break;
						}
						if (uniqueTracks.length >= targetLimit) break;
					}
				} catch (err) {
					console.warn("Dynamic mix artist supplement error:", err.message);
				}
			}

			// If we found at least 3 unique tracks, return them! Otherwise, fall back to raw tracks so the playlist isn't completely empty.
			const finalTracks = (uniqueTracks.length > 2 ? uniqueTracks.slice(0, targetLimit) : rawTracks.slice(0, targetLimit)).filter(t => isValidSongDuration(t.duration));

			return res.json({
				playlistId,
				title: `${query} Mix`,
				description: `Curated collection for ${query}`,
				thumbnail: finalTracks[0]?.thumbnail || "/default-cover.svg",
				tracks: finalTracks
			});
		}

		let data = await fetchJioSaavn({ __call: "playlist.getDetails", listid: playlistId });
		let rawTracks = data?.songs || data?.list || [];
		let resolvedTitle = data?.title || data?.listname || data?.name;
		let resolvedId = data?.id || data?.listid || playlistId;

		// If playlist not found, has no title, or has 0 songs, check if it is an album!
		if (!data || !resolvedTitle || rawTracks.length === 0) {
			try {
				const albumData = await fetchJioSaavn({ __call: "content.getAlbumDetails", albumid: playlistId });
				if (albumData && (albumData.albumid || albumData.id || albumData.title) && (albumData.songs?.length > 0 || albumData.list?.length > 0)) {
					data = albumData;
					rawTracks = albumData.songs || albumData.list || [];
					resolvedTitle = albumData.title || albumData.name;
					resolvedId = albumData.albumid || albumData.id || playlistId;
				}
			} catch (albumErr) {
				console.warn("Album fallback failed:", albumErr.message);
			}
		}

		let tracks = rawTracks.map(s => formatSong(s)).filter(t => Boolean(t && isValidSongDuration(t.duration)));

		// If still 0 tracks, fallback to searching songs by the playlist title so it is NEVER completely empty!
		if (tracks.length === 0 && resolvedTitle) {
			try {
				const fallbackSearch = await fetchJioSaavn({
					__call: "search.getResults",
					q: cleanStr(resolvedTitle),
					p: 1,
					n: 25
				});
				if (fallbackSearch?.results?.length > 0) {
					tracks = fallbackSearch.results.map(s => formatSong(s)).filter(t => Boolean(t && isValidSongDuration(t.duration)));
				}
			} catch (searchErr) {
				console.warn("Fallback song search failed for playlist:", searchErr.message);
			}
		}

		if (!data || (!resolvedId && !resolvedTitle)) {
			throw new Error("Playlist not found");
		}

		const rawThumb = getValidImage(data.image);
		const cleanThumb = (rawThumb && rawThumb.includes('/editorial/'))
			? (tracks[0]?.thumbnail || rawThumb)
			: (rawThumb || tracks[0]?.thumbnail || "/default-cover.svg");

		if (cleanThumb && !cleanThumb.includes('/editorial/')) {
			playlistCoverCache.set(playlistId, cleanThumb);
		}

		const responsePayload = {
			playlistId: resolvedId,
			title: cleanStr(resolvedTitle, "Featured Playlist"),
			description: cleanStr(data.subtitle || data.description || (data.firstname ? `By ${data.firstname} ${data.lastname || ''}`.trim() : null), "Curated collection"),
			thumbnail: cleanThumb,
			tracks
		};

		if (pageStr === "1") {
			playlistDetailsMemoryCache.set(playlistId, { timestamp: Date.now(), data: responsePayload });
			if (playlistDetailsMemoryCache.size > 250) {
				const oldestKey = playlistDetailsMemoryCache.keys().next().value;
				playlistDetailsMemoryCache.delete(oldestKey);
			}
		}

		return res.json(responsePayload);
	} catch (error) {
		console.error("Playlist details failed:", error.stack || error);
		res.status(502).json({ error: "Failed to fetch playlist details", details: error.message });
	}
});

router.get("/api/import-playlist", async (req, res) => {
	let link = String(req.query.url || "").trim();
	if (!link) return res.status(400).json({ error: 'URL parameter "url" is required' });

	try {
		if (!link.startsWith("http://") && !link.startsWith("https://")) {
			link = "https://" + link;
		}

		// 1. JioSaavn / Saavn Playlist
		if (link.includes("saavn.com") || link.includes("jiosaavn.com")) {
			let listid = null;
			let token = null;

			const listidMatch = link.match(/listid=([^&]+)/);
			if (listidMatch) listid = listidMatch[1];

			const tokenMatch = link.match(/featured\/[^/]+\/([^/?#]+)/) || link.match(/s\/playlist\/[^/]+\/([^/?#]+)/);
			if (tokenMatch) token = tokenMatch[1];

			let data = null;
			if (listid) {
				data = await fetchJioSaavn({ __call: "playlist.getDetails", listid, n: "200" });
			} else if (token) {
				data = await fetchJioSaavn({ __call: "webapi.get", type: "playlist", token, n: "200", p: "1" });
			} else {
				const response = await fetch(link, {
					headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
				});
				const html = await response.text();
				const matchId = html.match(/"listid":"([^"]+)"/) || html.match(/"type":"playlist","id":"([^"]+)"/) || html.match(/"playlist_id":"([^"]+)"/);
				if (matchId) {
					data = await fetchJioSaavn({ __call: "playlist.getDetails", listid: matchId[1], n: "200" });
				}
			}

			if (data && (data.list || data.songs)) {
				const list = data.list || data.songs;
				const tracks = list.map(s => formatSong(s)).filter(t => Boolean(t && isValidSongDuration(t.duration)));
				const rawThumb = getValidImage(data.image);
				const cleanThumb = (rawThumb && rawThumb.includes('/editorial/'))
					? (tracks[0]?.thumbnail || rawThumb)
					: (rawThumb || tracks[0]?.thumbnail || "/default-cover.svg");
				return res.json({
					source: 'jiosaavn',
					title: data.title || data.name || "JioSaavn Playlist",
					author: data.subtitle || data.header_desc || "JioSaavn",
					thumbnail: cleanThumb,
					tracks
				});
			}
		}

		// 2. Spotify Playlist Link
		if (link.includes("spotify.com")) {
			const details = await getSpotifyPlaylistDetails(link);
			if (details && details.songsToSearch.length > 0) {
				return res.json({
					source: 'spotify',
					title: details.title,
					thumbnail: details.thumbnail,
					songsToSearch: details.songsToSearch
				});
			}
		}

		// 3. YouTube / YT Music Playlist Link
		if (link.includes("youtube.com") || link.includes("youtu.be")) {
			const details = await getYouTubePlaylistDetails(link);
			if (details && details.songsToSearch.length > 0) {
				return res.json({
					source: 'youtube',
					title: details.title,
					thumbnail: details.thumbnail,
					songsToSearch: details.songsToSearch
				});
			}
		}

		// 4. SoundCloud Playlist Link
		if (link.includes("soundcloud.com")) {
			const details = await getSoundCloudPlaylistDetails(link);
			if (details) {
				return res.json(details);
			}
		}

		return res.status(400).json({ error: "Could not extract tracks from this playlist link. Ensure the playlist is Public." });
	} catch (error) {
		console.error("Import playlist endpoint failed:", error);
		res.status(500).json({ error: "Failed to process playlist URL" });
	}
});

function parsePlaylistTracks(tracksJson) {
	if (tracksJson == null) return [];
	if (typeof tracksJson !== "string") return tracksJson;
	try {
		return JSON.parse(tracksJson);
	} catch (_) {
		return tracksJson;
	}
}

router.post("/api/playlist/save", async (req, res) => {
	try {
		const user_uuid = req.body?.user_uuid;
		const playlist = req.body?.playlist || {};
		const id = String(playlist.id || playlist.playlistId || req.body?.id || req.body?.playlist_id || "");
		const name = playlist.name || playlist.title || req.body?.name || req.body?.title;

		if (!user_uuid || !id || !name) {
			return res.status(400).json({ error: "user_uuid, playlist.id, and playlist.name are required" });
		}

		const tracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
		const tracks_json = JSON.stringify(tracks);
		const updated_at = Number(playlist.updated_at) || Date.now();

		try {
			await db.execute({
				sql: `INSERT INTO playlists (id, user_uuid, name, tracks_json, updated_at)
					VALUES (?, ?, ?, ?, ?)
					ON CONFLICT(id) DO UPDATE SET
						name = excluded.name,
						tracks_json = excluded.tracks_json,
						updated_at = excluded.updated_at`,
				args: [id, user_uuid, name, tracks_json, updated_at]
			});
		} catch (saveErr) {
			await db.execute({
				sql: `INSERT OR REPLACE INTO playlists (id, user_uuid, name, tracks_json, updated_at)
					VALUES (?, ?, ?, ?, ?)`,
				args: [id, user_uuid, name, tracks_json, updated_at]
			});
		}

		return res.status(200).json({ success: true, message: "Playlist saved" });
	} catch (error) {
		console.error("Playlist save failed:", error);
		return res.status(500).json({ error: "Failed to save playlist" });
	}
});

router.post("/api/playlist/unsave", async (req, res) => {
	try {
		const user_uuid = req.body?.user_uuid;
		const id = String(req.body?.id || req.body?.playlist_id || "");

		if (!user_uuid || !id) {
			return res.status(400).json({ error: "user_uuid and id are required" });
		}

		await db.execute({
			sql: `DELETE FROM playlists WHERE id = ? AND user_uuid = ?`,
			args: [id, user_uuid]
		});

		return res.status(200).json({ success: true, message: "Playlist removed" });
	} catch (error) {
		console.error("Playlist unsave failed:", error);
		return res.status(500).json({ error: "Failed to unsave playlist" });
	}
});

router.post("/api/playlist/activity", async (req, res) => {
	try {
		const user_uuid = req.body?.user_uuid;
		const playlist = req.body?.playlist || {};
		const id = String(req.body?.id || req.body?.playlist_id || playlist.id || playlist.playlist_id || "");

		if (!user_uuid || !id) {
			return res.status(400).json({ error: "user_uuid and id are required" });
		}

		const now = Date.now();

		// ONLY update last_played_at and play_count if the user has this playlist in their saved playlists
		try {
			await db.execute({
				sql: `UPDATE playlists
					SET last_played_at = ?,
						play_count = COALESCE(play_count, 0) + 1,
						updated_at = ?
					WHERE id = ? AND user_uuid = ?`,
				args: [now, now, id, user_uuid]
			});
		} catch (columnErr) {
			await db.execute({
				sql: `UPDATE playlists
					SET updated_at = ?
					WHERE id = ? AND user_uuid = ?`,
				args: [now, id, user_uuid]
			});
		}

		return res.json({ success: true });
	} catch (error) {
		console.error("Playlist activity update failed:", error);
		return res.status(500).json({ error: "Failed to update playlist activity" });
	}
});

module.exports = {
	playlistRouter: router,
	parsePlaylistTracks
};
