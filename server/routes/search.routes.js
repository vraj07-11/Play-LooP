const express = require("express");
const {
	fetchJioSaavn,
	formatSong,
	getValidImage,
	cleanStr,
	isValidSongDuration,
	parseDurationInSeconds,
	computeRelevanceScore,
	isRedundantArtist,
	playlistCoverCache,
	resolveCleanPlaylistThumbnail
} = require("../services/jiosaavn");
const { searchSoundCloud, getSoundCloudClientId, getSoundCloudTrackDetails } = require("../services/soundcloud");

const router = express.Router();

router.get("/api/search", async (req, res) => {
	const query = String(req.query.q || "").trim();
	if (!query) return res.status(400).json({ error: 'Query parameter "q" is required' });

	const type = String(req.query.type || "").toLowerCase();
	const isMulti = type === "all" || req.query.multi === "true";
	const queryLower = query.toLowerCase().trim();

	try {
		if (isMulti) {
			const [songsRes, artistsRes, playlistsRes, albumsRes, autoRes, scRes] = await Promise.allSettled([
				fetchJioSaavn({ __call: "search.getResults", q: query, n: "25", p: "1" }),
				fetchJioSaavn({ __call: "search.getArtistResults", q: query, n: "20", p: "1" }),
				fetchJioSaavn({ __call: "search.getPlaylistResults", q: query, n: "18", p: "1" }),
				fetchJioSaavn({ __call: "search.getAlbumResults", q: query, n: "18", p: "1" }),
				fetchJioSaavn({ __call: "autocomplete.get", query: query }),
				Promise.race([
					searchSoundCloud(query, 10),
					new Promise(resolve => setTimeout(() => resolve([]), 1200))
				])
			]);

			const songsData = songsRes.status === 'fulfilled' && songsRes.value?.results ? songsRes.value.results : [];
			const artistsData = artistsRes.status === 'fulfilled' && artistsRes.value?.results ? artistsRes.value.results : [];
			const playlistsData = playlistsRes.status === 'fulfilled' && playlistsRes.value?.results ? playlistsRes.value.results : [];
			const albumsData = albumsRes.status === 'fulfilled' && albumsRes.value?.results ? albumsRes.value.results : [];
			const autoData = autoRes.status === 'fulfilled' && autoRes.value ? autoRes.value : {};
			const scSongs = scRes.status === 'fulfilled' && Array.isArray(scRes.value) ? scRes.value : [];

			let saavnSongs = songsData.map(s => formatSong(s)).filter(s => Boolean(s && isValidSongDuration(s.duration)));
			if (saavnSongs.length === 0 && autoData.songs?.data) {
				saavnSongs = autoData.songs.data.map(s => ({
					videoId: s.id,
					title: cleanStr(s.title || s.song, "Unknown Track"),
					artist: cleanStr(s.more_info?.primary_artists || s.primary_artists || s.description, "Play LooP"),
					thumbnail: getValidImage(s.image),
					duration: parseDurationInSeconds(s.more_info?.duration || 180)
				})).filter(s => isValidSongDuration(s.duration));
			}

			// Score and rank both sources by query relevance (ensuring valid duration)
			const scoredSaavn = saavnSongs.filter(s => isValidSongDuration(s.duration)).map(s => ({ ...s, score: computeRelevanceScore(s, queryLower) })).sort((a, b) => b.score - a.score);
			const scoredSC = scSongs.filter(s => isValidSongDuration(s.duration)).map(s => ({ ...s, score: computeRelevanceScore(s, queryLower) })).sort((a, b) => b.score - a.score);

			// Interleave and merge based on highest relevance score
			let songs = [];
			let i = 0, j = 0;
			while (i < scoredSaavn.length || j < scoredSC.length) {
				const saavnItem = scoredSaavn[i];
				const scItem = scoredSC[j];

				if (scItem && (!saavnItem || scItem.score >= saavnItem.score)) {
					if (isValidSongDuration(scItem.duration)) songs.push(scItem);
					j++;
				} else if (saavnItem) {
					if (isValidSongDuration(saavnItem.duration)) songs.push(saavnItem);
					i++;
				}
			}

			// Extract authentic creators from top matching songs
			const songArtists = [];
			for (const s of songsData.slice(0, 8)) {
				if (s.primary_artists && s.primary_artists_id) {
					const names = String(s.primary_artists).split(",").map(n => n.trim());
					const ids = String(s.primary_artists_id).split(",").map(id => id.trim());
					names.forEach((name, idx) => {
						if (name && ids[idx]) {
							songArtists.push({ id: ids[idx], name, image: s.image, role: "Artist" });
						}
					});
				}
				if (s.featured_artists && s.featured_artists_id) {
					const names = String(s.featured_artists).split(",").map(n => n.trim());
					const ids = String(s.featured_artists_id).split(",").map(id => id.trim());
					names.forEach((name, idx) => {
						if (name && ids[idx]) {
							songArtists.push({ id: ids[idx], name, image: s.image, role: "Artist" });
						}
					});
				}
				if (s.more_info?.artistMap?.primary_artists && Array.isArray(s.more_info.artistMap.primary_artists)) {
					for (const pa of s.more_info.artistMap.primary_artists) {
						if (pa.id && pa.name) {
							songArtists.push({ id: pa.id, name: pa.name, image: pa.image || s.image, role: "Artist" });
						}
					}
				}
			}

			// Clean and organize direct artists from search
			const directMatches = [];
			const otherRawArtists = [];

			for (const a of artistsData) {
				const aName = cleanStr(a.name || a.title, "").trim();
				if (!aName || aName.length > 40 || aName.includes(";") || aName.includes("|") || /\btribute\b/i.test(aName)) {
					continue;
				}
				const aLower = aName.toLowerCase();
				if (aLower === queryLower || aLower.startsWith(queryLower)) {
					directMatches.push(a);
				} else {
					otherRawArtists.push(a);
				}
			}

			// Priority pool: Direct close matches first, then verified song artists, then other artists
			const candidatePool = [
				...(directMatches.length > 0 ? [directMatches[0]] : []),
				...songArtists,
				...(directMatches.slice(1)),
				...otherRawArtists
			];

			const distinctArtists = [];
			const seenArtistNames = [];
			const seenArtistIds = new Set();

			for (const a of candidatePool) {
				const aId = a.artistid || a.id;
				const aName = cleanStr(a.name || a.title, "").trim();
				if (!aId || !aName) continue;
				if (seenArtistIds.has(String(aId))) continue;
				if (aName.length > 35 || aName.includes(";") || aName.includes("|") || /\btribute\b/i.test(aName)) continue;

				if (isRedundantArtist(aName, seenArtistNames)) continue;

				seenArtistIds.add(String(aId));
				seenArtistNames.push(aName);
				distinctArtists.push({
					playlistId: `ARTIST:${aId}`,
					title: aName,
					artist: "Verified Artist",
					thumbnail: getValidImage(a.image),
					type: "artist",
					description: cleanStr(a.role || a.description, "Artist"),
					isArtist: true
				});
				if (distinctArtists.length >= 18) break;
			}

			let artists = distinctArtists;

			if (artists.length === 0 && autoData.artists?.data) {
				artists = autoData.artists.data.map(a => ({
					playlistId: `ARTIST:${a.id}`,
					title: cleanStr(a.title || a.name, "Artist"),
					artist: "Verified Artist",
					thumbnail: getValidImage(a.image),
					type: "artist",
					description: cleanStr(a.description, "Artist"),
					isArtist: true
				}));
			}

			const filteredPlaylists = playlistsData.filter(p => {
				const count = parseInt(p.count || p.numsongs || p.more_info?.song_count || "0", 10);
				const pId = p.listid || p.id;
				const title = p.listname || p.title || p.name;
				if (!pId || !title) return false;
				if (p.count !== undefined || p.numsongs !== undefined || p.more_info?.song_count !== undefined) {
					return count > 0;
				}
				return true;
			});

			const playlistsDataClean = await Promise.all(
				filteredPlaylists.map(async (p, idx) => {
					const pId = p.listid || p.id;
					let cleanThumb = playlistCoverCache.get(pId) || getValidImage(p.image);
					// For top visible items, if image is an editorial graphic with JioSaavn logo watermark or fallback, resolve clean album art
					if (idx < 12 && cleanThumb && (cleanThumb.includes('/editorial/') || cleanThumb === '/default-cover.svg' || cleanThumb === '/logo.svg')) {
						try {
							cleanThumb = await Promise.race([
								resolveCleanPlaylistThumbnail(pId, cleanThumb),
								new Promise(resolve => setTimeout(() => resolve(cleanThumb), 1200))
							]);
						} catch (_) {}
					}
					const songCount = p.count || p.numsongs || p.more_info?.song_count;
					return {
						playlistId: pId,
						title: cleanStr(p.listname || p.title || p.name, "Playlist"),
						author: cleanStr(p.artist_name || (p.firstname ? `${p.firstname} ${p.lastname || ''}`.trim() : null) || p.more_info?.artist_name || p.subtitle, "Play LooP"),
						thumbnail: cleanThumb,
						type: "playlist",
						count: songCount ? `${songCount} songs` : "Playlist"
					};
				})
			);

			const albumsDataClean = albumsData
				.filter(al => {
					const alId = al.albumid || al.id;
					const title = al.title || al.name;
					return Boolean(alId && title);
				})
				.map(al => {
					const alId = al.albumid || al.id;
					return {
						playlistId: alId,
						title: cleanStr(al.title || al.name, "Album"),
						author: cleanStr(al.primary_artists || al.music || al.artist || al.subtitle, "Album"),
						thumbnail: getValidImage(al.image),
						type: "album",
						count: "Album"
					};
				});

			let playlists = [
				...playlistsDataClean,
				...albumsDataClean
			];

			if (playlists.length === 0 && (autoData.playlists?.data || autoData.albums?.data)) {
				const autoPlaylists = (autoData.playlists?.data || []).map((p) => {
					const pId = p.listid || p.id;
					const cleanThumb = playlistCoverCache.get(pId) || getValidImage(p.image);
					return {
						playlistId: pId,
						title: cleanStr(p.title || p.name, "Playlist"),
						author: cleanStr(p.description || p.subtitle, "Play LooP"),
						thumbnail: cleanThumb,
						type: "playlist",
						count: "Playlist"
					};
				});
				const autoAlbums = (autoData.albums?.data || []).map(al => {
					const alId = al.albumid || al.id;
					return {
						playlistId: alId,
						title: cleanStr(al.title || al.name, "Album"),
						author: cleanStr(al.description || al.subtitle, "Album"),
						thumbnail: getValidImage(al.image),
						type: "album",
						count: "Album"
					};
				});
				playlists = [...autoPlaylists, ...autoAlbums];
			}

			// Determine Top Result (Song with highest match score given top priority)
			let topResult = null;
			const exactArtistMatch = artists.length > 0 && artists[0].title.toLowerCase().trim() === queryLower;

			if (exactArtistMatch) {
				topResult = { ...artists[0], category: 'Artist' };
			} else if (songs.length > 0) {
				topResult = { ...songs[0], category: 'Song' };
			} else if (artists.length > 0) {
				topResult = { ...artists[0], category: 'Artist' };
			} else if (playlists.length > 0) {
				topResult = { ...playlists[0], category: 'Playlist' };
			}

			return res.json({
				songs,
				artists,
				playlists,
				topResult
			});
		}

		// Single song search fallback with relevance sorting
		const [saavnData, scSongs] = await Promise.all([
			fetchJioSaavn({ __call: "search.getResults", q: query, n: "25", p: "1" }).catch(() => null),
			searchSoundCloud(query, 10)
		]);

		let saavnSongs = [];
		if (saavnData && saavnData.results && saavnData.results.length > 0) {
			saavnSongs = saavnData.results.map(s => formatSong(s)).filter(s => Boolean(s && isValidSongDuration(s.duration)));
		} else {
			const autoData = await fetchJioSaavn({ __call: "autocomplete.get", query: query }).catch(() => null);
			if (autoData && autoData.songs?.data) {
				saavnSongs = autoData.songs.data.map(s => ({
					videoId: s.id,
					title: (s.title || "").replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
					artist: (s.more_info?.primary_artists || s.description || "Play LooP").replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
					thumbnail: getValidImage(s.image),
					duration: parseDurationInSeconds(s.more_info?.duration || 180)
				})).filter(s => isValidSongDuration(s.duration));
			}
		}

		const scoredSaavn = saavnSongs.filter(s => isValidSongDuration(s.duration)).map(s => ({ ...s, score: computeRelevanceScore(s, queryLower) })).sort((a, b) => b.score - a.score);
		const scoredSC = (scSongs || []).filter(s => isValidSongDuration(s.duration)).map(s => ({ ...s, score: computeRelevanceScore(s, queryLower) })).sort((a, b) => b.score - a.score);

		let songs = [];
		let i = 0, j = 0;
		while (i < scoredSaavn.length || j < scoredSC.length) {
			const saavnItem = scoredSaavn[i];
			const scItem = scoredSC[j];

			if (scItem && (!saavnItem || scItem.score >= saavnItem.score)) {
				if (isValidSongDuration(scItem.duration)) songs.push(scItem);
				j++;
			} else if (saavnItem) {
				if (isValidSongDuration(saavnItem.duration)) songs.push(saavnItem);
				i++;
			}
		}

		return res.json(songs);
	} catch (error) {
		console.error("Search endpoint error:", error);
		res.status(500).json({ error: "Failed to fetch search results" });
	}
});

router.get("/api/song", async (req, res) => {
	const videoId = String(req.query.id || req.query.track || req.query.v || "").trim();
	if (!videoId) return res.status(400).json({ error: "Track ID is required" });

	if (videoId.startsWith("sc:")) {
		try {
			const scId = videoId.replace(/^sc:/, "");
			const track = await getSoundCloudTrackDetails(scId);
			if (!track) return res.status(404).json({ error: "SoundCloud track not found" });
			return res.json(track);
		} catch (e) {
			return res.status(500).json({ error: "Failed to fetch SoundCloud track details" });
		}
	}

	try {
		const data = await fetchJioSaavn({ __call: "song.getDetails", pids: videoId });
		let songData = data[videoId] || (data.songs && data.songs[0]);

		if (!songData) {
			return res.status(404).json({ error: "Song not found" });
		}

		const formatted = formatSong(songData);
		return res.json(formatted);
	} catch (error) {
		console.error("Song details fetch failed:", error);
		return res.status(500).json({ error: "Failed to fetch song details" });
	}
});

module.exports = router;
