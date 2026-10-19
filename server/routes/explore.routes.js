const express = require("express");
const {
	fetchJioSaavn,
	formatSong,
	getValidImage,
	isValidSongDuration,
	shuffleArray
} = require("../services/jiosaavn");

const router = express.Router();

// In-Memory Recommendation Cache (24-Hour TTL)
const recoCache = new Map();
const RECO_CACHE_TTL = 24 * 60 * 60 * 1000;

router.get("/api/recommendations", async (req, res) => {
	const videoId = String(req.query.id || "").trim();
	const artist = String(req.query.artist || "").trim();
	const title = String(req.query.title || "").trim();
	const isRefresh = req.query.refresh === "true";

	const excludeIdsRaw = String(req.query.excludeIds || "").trim();
	const excludeSet = new Set(excludeIdsRaw ? excludeIdsRaw.split(",").map(id => id.trim()).filter(Boolean) : []);

	const excludeTitlesRaw = String(req.query.excludeTitles || "").trim();
	const excludeTitlesSet = new Set(excludeTitlesRaw ? excludeTitlesRaw.split("|").map(t => t.toLowerCase().replace(/[^a-z0-9]/g, "")).filter(Boolean) : []);

	const userLanguagesRaw = String(req.query.languages || "").trim();
	const userLanguages = userLanguagesRaw ? userLanguagesRaw.split(",").map(l => l.trim().toLowerCase()) : ["english", "hindi"];

	if (!videoId && !artist && !title) {
		return res.status(400).json({ error: "Video ID or song metadata required" });
	}

	const cacheKey = (videoId || `${artist}_${title}`).toLowerCase();
	const cachedEntry = recoCache.get(cacheKey);
	if (!isRefresh && cachedEntry && (Date.now() - cachedEntry.timestamp < RECO_CACHE_TTL)) {
		const filteredCache = cachedEntry.data.filter(t => 
			t && t.videoId && 
			!excludeSet.has(t.videoId) && 
			!excludeTitlesSet.has((t.title || "").toLowerCase().replace(/[^a-z0-9]/g, ""))
		);
		if (filteredCache.length >= 8) {
			return res.json(filteredCache);
		}
	}

	try {
		let recommendations = [];
		let lang = 'english'; // default fallback

		if (videoId) {
			try {
				const songData = await fetchJioSaavn({ __call: "song.getDetails", pids: videoId });
				const details = songData[videoId] || (songData.songs && songData.songs[0]);
				if (details && details.language) {
					lang = details.language.toLowerCase().trim();
				}
			} catch (e) {
				console.warn("Could not fetch language for videoId", videoId);
			}
		}

		// Restrict recommendations strictly to user's preferred languages
		if (!userLanguages.includes(lang) && userLanguages.length > 0) {
			lang = userLanguages.includes('english') ? 'english' : userLanguages[0];
		}

		const languagePlaylists = {
			'english': ["63116930", "48189087", "88471029", "110858205", "77492018", "8042456", "947987697"],
			'hindi': ["1134543272", "1210453303", "1167751266", "107584484", "1214335916", "1202559627"],
			'punjabi': ["4144832", "1543265", "1023456", "38029986", "107584484"],
			'tamil': ["1142512", "4234567", "5729104", "1193021", "1543265"],
			'telugu': ["1543285", "3791000", "28374902", "3829012", "1134543272"]
		};

		let candidatePids = languagePlaylists[lang];
		if (!candidatePids || candidatePids.length === 0) {
			try {
				const searchPlaylists = await fetchJioSaavn({ __call: "search.getPlaylistResults", q: `top ${lang} hits`, n: "5", p: "1" });
				if (searchPlaylists && searchPlaylists.results && searchPlaylists.results.length > 0) {
					candidatePids = searchPlaylists.results.map(p => p.id);
				}
			} catch (e) {
				console.warn(`Could not fetch dynamic playlists for language ${lang}`);
			}
		}
		
		if (!candidatePids || candidatePids.length === 0) {
			// fallback to global popular mix
			candidatePids = ["947987697", "1134543272", "47599074", "1202559627", "63116930"];
		}

		// Shuffle candidate playlists and pick at least 3
		candidatePids.sort(() => 0.5 - Math.random());
		const selectedPids = candidatePids.slice(0, 3);

		const fetchPromises = selectedPids.map(async (pid) => {
			try {
				const chartData = await fetchJioSaavn({ __call: "playlist.getDetails", listid: pid, n: "50" });
				const chartList = chartData?.songs || chartData?.list;
				if (chartData && Array.isArray(chartList)) {
					return chartList.map(formatSong);
				}
			} catch(e) {}
			return [];
		});

		const nestedSongs = await Promise.all(fetchPromises);
		for (const songs of nestedSongs) {
			recommendations.push(...songs);
		}

		// Randomize the collected songs
		recommendations.sort(() => 0.5 - Math.random());

		// Deduplicate and filter against excludeSet & excludeTitlesSet
		const uniqueRecos = [];
		const seenIds = new Set();
		const currentTitleClean = (title || "").toLowerCase().replace(/[^a-z0-9]/g, "");

		for (const track of recommendations) {
			if (!track || !track.videoId || !isValidSongDuration(track.duration)) continue;
			
			const trackTitleClean = (track.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
			
			if (track.videoId === videoId || (currentTitleClean && trackTitleClean === currentTitleClean)) {
				continue;
			}

			if (excludeSet.has(track.videoId) || (trackTitleClean && excludeTitlesSet.has(trackTitleClean))) {
				continue;
			}

			if (!seenIds.has(track.videoId)) {
				seenIds.add(track.videoId);
				uniqueRecos.push(track);
			}
		}

		// If we run out of new songs, allow reusing previous ones (excluding current song)
		let finalRecos = uniqueRecos;
		if (finalRecos.length === 0 && recommendations.length > 0) {
			const fallbackSet = new Set();
			for (const track of recommendations) {
				if (track && track.videoId && !fallbackSet.has(track.videoId) && track.videoId !== videoId) {
					fallbackSet.add(track.videoId);
					finalRecos.push(track);
				}
			}
		}

		recommendations = finalRecos;

		if (isRefresh) {
			recommendations.sort(() => 0.5 - Math.random());
		} else if (recommendations.length > 0) {
			recoCache.set(cacheKey, { data: recommendations, timestamp: Date.now() });
		}

		res.json(recommendations);
	} catch (error) {
		console.error("Recommendations failed:", error);
		res.json([]);
	}
});

let trendingArtistsCache = { data: {}, lastFetched: {} };
const TRENDING_ARTISTS_TTL = 6 * 60 * 60 * 1000;
const artistDetailCache = new Map();

router.get("/api/trending-artists", async (req, res) => {
	const now = Date.now();
	const languagesQuery = req.query.languages || "english,hindi";
	const limit = Math.min(60, Math.max(5, parseInt(req.query.limit, 10) || 10));
	const cacheKey = languagesQuery.toLowerCase().trim() + '-' + limit;

	if (trendingArtistsCache.data[cacheKey] && (now - trendingArtistsCache.lastFetched[cacheKey] < TRENDING_ARTISTS_TTL)) {
		return res.json(trendingArtistsCache.data[cacheKey]);
	}

	try {
		const languages = languagesQuery.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
		const artistCounts = {};
		const artistMeta = {};
		
		const LANGUAGE_SEEDS = {
			punjabi: ['468245', '458889', '568603', '456070', '486770', '685088'],
			hindi: ['459320', '464932', '456323', '456269', '456338', '455120', '455142', '455127', '455582'],
			english: ['615155', '565990', '512453', '1274170', '1918741', '568565', '578407', '485063', '465365'],
			tamil: ['459633', '456269', '568561', '455132', '455798'],
			telugu: ['568561', '456269', '455132', '455798', '455127'],
			gujarati: ['456323', '468245', '459320'],
			marathi: ['456269', '455120', '455109', '456338'],
			spanish: ['2029479', '455131', '455133']
		};

		const artistIdsByLang = {};

		for (const lang of languages) {
			try {
				const langCounts = {};

				// 1. Search for top playlists for this specific language
				const searchPlaylists = await fetchJioSaavn({ __call: "search.getPlaylistResults", q: `top ${lang} hits`, n: "5", p: "1" });
				let pids = [];
				if (searchPlaylists && Array.isArray(searchPlaylists.results) && searchPlaylists.results.length > 0) {
					pids = searchPlaylists.results.slice(0, 3).map(p => p.id).filter(Boolean);
				}

				for (const pid of pids) {
					try {
						const playlistData = await fetchJioSaavn({ __call: "playlist.getDetails", listid: pid });
						const plList = playlistData?.songs || playlistData?.list;
						if (playlistData && Array.isArray(plList)) {
							plList.forEach(song => {
								const artists = song.more_info?.artistMap?.primary_artists || [];
								artists.forEach(a => {
									if (a.id && a.name && !a.name.toLowerCase().includes("various")) {
										langCounts[a.id] = (langCounts[a.id] || 0) + 1;
										if (!artistMeta[a.id]) artistMeta[a.id] = { id: a.id, name: a.name, image: a.image };
									}
								});
							});
						}
					} catch (plErr) {}
				}

				// 2. Also search top songs for this language to discover more native artists
				try {
					const songsSearch = await fetchJioSaavn({ __call: "search.getResults", q: `${lang} superhits`, n: "30", p: "1" });
					if (songsSearch && Array.isArray(songsSearch.results)) {
						songsSearch.results.forEach(song => {
							const artists = song.more_info?.artistMap?.primary_artists || [];
							artists.forEach(a => {
								if (a.id && a.name && !a.name.toLowerCase().includes("various")) {
									langCounts[a.id] = (langCounts[a.id] || 0) + 1;
									if (!artistMeta[a.id]) artistMeta[a.id] = { id: a.id, name: a.name, image: a.image };
								}
							});
						});
					}
				} catch (songErr) {}

				// 3. Fallback to seeds strictly for this language if needed
				if (LANGUAGE_SEEDS[lang]) {
					for (const sId of LANGUAGE_SEEDS[lang]) {
						if (!langCounts[sId]) {
							langCounts[sId] = 1;
						}
					}
				}
				
				// Rank top IDs for this specific language
				const numToTake = Math.max(10, Math.ceil(limit / languages.length) + 5);
				const topIds = Object.keys(langCounts).sort((a, b) => langCounts[b] - langCounts[a]).slice(0, numToTake);
				artistIdsByLang[lang] = topIds;

			} catch(e) {
				console.warn(`Failed to process language ${lang}:`, e.message);
				artistIdsByLang[lang] = LANGUAGE_SEEDS[lang] || [];
			}
		}

		// Fair round-robin interleaving across all selected languages
		const interleavedIds = [];
		const maxLen = Math.max(...languages.map(l => (artistIdsByLang[l] || []).length), 0);
		for (let i = 0; i < maxLen; i++) {
			for (const lang of languages) {
				const id = artistIdsByLang[lang]?.[i];
				if (id && !interleavedIds.includes(id)) {
					interleavedIds.push(id);
				}
			}
		}

		const finalIds = interleavedIds.slice(0, limit);

		// Fetch details, utilizing memory cache for rapid response
		const finalArtists = await Promise.all(finalIds.map(async (id) => {
			if (artistDetailCache.has(id)) {
				return artistDetailCache.get(id);
			}

			try {
				const detail = await fetchJioSaavn({ __call: "artist.getArtistPageDetails", artistId: id, p: "1", n_song: "1", n_album: "0" });
				const followers = parseInt(detail.follower_count || "0", 10);
				let formattedFollowers = "";
				if (followers > 0) {
					formattedFollowers = followers > 1000000 
						? (followers / 1000000).toFixed(1) + "M Listeners"
						: (followers / 1000).toFixed(1) + "K Listeners";
				} else {
					formattedFollowers = "Trending Artist";
				}

				const formatted = {
					playlistId: `ARTIST:${id}`,
					title: detail.name || artistMeta[id]?.name || `Artist ${id}`,
					thumbnail: getValidImage(detail.image || artistMeta[id]?.image),
					followers: formattedFollowers,
					followerCountRaw: followers,
					author: "Artist",
					isArtist: true
				};

				artistDetailCache.set(id, formatted);
				return formatted;
			} catch (e) {
				const fallbackObj = {
					playlistId: `ARTIST:${id}`,
					title: artistMeta[id]?.name || "Artist",
					thumbnail: getValidImage(artistMeta[id]?.image),
					followers: "Trending Artist",
					followerCountRaw: 0,
					author: "Artist",
					isArtist: true
				};
				return fallbackObj;
			}
		}));

		trendingArtistsCache.data[cacheKey] = finalArtists;
		trendingArtistsCache.lastFetched[cacheKey] = now;
		res.json(finalArtists);
	} catch (error) {
		console.error("Trending artists failed:", error);
		res.status(500).json([]);
	}
});

let popularSongsCache = { data: {}, lastFetched: {} };
const POPULAR_SONGS_TTL = 3 * 60 * 60 * 1000;

router.get("/api/popular-songs", async (req, res) => {
	const languagesQuery = req.query.languages || "english,hindi";
	const cacheKey = languagesQuery.toLowerCase().trim();

	let songsByLangRaw = popularSongsCache.data[cacheKey];

	if (!songsByLangRaw || (Date.now() - popularSongsCache.lastFetched[cacheKey] > POPULAR_SONGS_TTL)) {
		try {
			const languages = cacheKey.split(",").map(s => s.trim()).filter(Boolean);
			songsByLangRaw = [];

			for (const lang of languages) {
				try {
					let songs = [];
					if (lang === 'english') {
						const englishPids = ['947987697', '63116930', '48189087'];
						const selectedPids = shuffleArray(englishPids);
						for (const id of selectedPids) {
							try {
								const playlistData = await fetchJioSaavn({ __call: "playlist.getDetails", listid: id });
								const plSongs = playlistData?.songs || playlistData?.list;
								if (playlistData && plSongs) {
									songs.push(...plSongs.map(formatSong));
								}
							} catch (e) {}
						}
					} else {
						let pid = null;
						if (lang === 'hindi') pid = '1134543272'; // India Superhits Top 50
						else if (lang === 'punjabi') pid = '4144832'; // Punjabi Hit Songs
						
						if (pid) {
							const playlistData = await fetchJioSaavn({ __call: "playlist.getDetails", listid: pid });
							const plSongs = playlistData?.songs || playlistData?.list;
							if (playlistData && plSongs) {
								songs = plSongs.map(formatSong);
							}
						}
					}
					
					if (songs.length === 0) {
						// Fallback to searching top hits playlist for this language
						const searchPlaylists = await fetchJioSaavn({ __call: "search.getPlaylistResults", q: `top ${lang} hits`, n: "1", p: "1" });
						if (searchPlaylists && searchPlaylists.results && searchPlaylists.results.length > 0) {
							const targetPlId = searchPlaylists.results[0].listid || searchPlaylists.results[0].id;
							const plData = await fetchJioSaavn({ __call: "playlist.getDetails", listid: targetPlId });
							const plSongs = plData?.songs || plData?.list;
							if (plData && plSongs) {
								songs = plSongs.map(formatSong);
							}
						}
					}

					if (songs.length === 0) {
						// Search top songs for language
						const searchSongs = await fetchJioSaavn({ __call: "search.getResults", q: `${lang} superhits`, n: "30", p: "1" });
						if (searchSongs && Array.isArray(searchSongs.results)) {
							songs = searchSongs.results.map(formatSong);
						}
					}

					if (songs.length > 0) {
						songsByLangRaw.push(songs);
					}
				} catch (err) {
					console.warn(`[Popular Songs] Failed for lang ${lang}:`, err.message);
				}
			}

			if (songsByLangRaw.length > 0) {
				popularSongsCache.data[cacheKey] = songsByLangRaw;
				popularSongsCache.lastFetched[cacheKey] = Date.now();
			}
		} catch (e) {
			console.error("Popular songs endpoint error:", e);
		}
	}

	if (songsByLangRaw && songsByLangRaw.length > 0) {
		// Shuffle each language's top songs pool so every open gets fresh random popular songs
		const shuffledByLang = songsByLangRaw.map(pool => shuffleArray(pool));
		const maxLen = Math.max(0, ...shuffledByLang.map(l => l.length));
		const combinedSongs = [];
		const seenIds = new Set();

		for (let i = 0; i < maxLen; i++) {
			for (let l = 0; l < shuffledByLang.length; l++) {
				if (shuffledByLang[l][i]) {
					const song = shuffledByLang[l][i];
					if (song.videoId && isValidSongDuration(song.duration) && !seenIds.has(song.videoId)) {
						seenIds.add(song.videoId);
						combinedSongs.push(song);
					}
				}
			}
		}

		return res.json(combinedSongs);
	}

	// General superhits fallback
	const fallbackSearch = await fetchJioSaavn({ __call: "search.getResults", q: "superhits", n: "30", p: "1" });
	const fallbackSongs = shuffleArray((fallbackSearch?.results || []).map(formatSong).filter(s => Boolean(s && isValidSongDuration(s.duration))));
	res.json(fallbackSongs);
});

module.exports = router;
