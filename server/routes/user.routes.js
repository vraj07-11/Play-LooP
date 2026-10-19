const express = require("express");
const { db } = require("../config/db");
const { parsePlaylistTracks } = require("./playlist.routes");

const router = express.Router();

router.post("/api/scrobble", async (req, res) => {
	try {
		const user_uuid = req.body?.user_uuid;
		const track = req.body?.track || {};
		const title = track.title;
		const artist = track.artist;

		if (!user_uuid || !title || !artist) {
			return res.status(400).json({ error: "user_uuid, track.title, and track.artist are required" });
		}

		const played_at = track.played_at != null ? Number(track.played_at) : Date.now();
		const cover = track.cover || track.thumbnail || track.image || null;
		const duration = track.duration != null && !isNaN(track.duration) ? Math.round(Number(track.duration)) : null;
		const duration_listened = Math.max(0, Math.round(Number(track.duration_listened || track.time_listened || 0)));
		// session_id: optional unique token from the client. When present, the
		// UNIQUE INDEX on (user_uuid, session_id) makes the INSERT a no-op if
		// the same scrobble was already committed (e.g. duplicate network retry).
		const session_id = track.session_id || null;
		const playlist_id = track.playlistId || track.playlist_id || null;
		const origin_context = track.originContext || track.origin_context || null;

		try {
			await db.execute({
				sql: `INSERT OR IGNORE INTO scrobbles (user_uuid, track_id, title, artist, album, genre, played_at, cover, duration, duration_listened, session_id, playlist_id, origin_context)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				args: [
					user_uuid,
					track.track_id ?? null,
					title,
					artist,
					track.album ?? null,
					track.genre ?? null,
					played_at,
					cover,
					duration,
					duration_listened,
					session_id,
					playlist_id,
					origin_context
				]
			});
		} catch (insertErr) {
			try {
				await db.execute({
					sql: `INSERT OR IGNORE INTO scrobbles (user_uuid, track_id, title, artist, album, genre, played_at, cover, duration, duration_listened, session_id)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					args: [
						user_uuid,
						track.track_id ?? null,
						title,
						artist,
						track.album ?? null,
						track.genre ?? null,
						played_at,
						cover,
						duration,
						duration_listened,
						session_id
					]
				});
			} catch (_) {
				try {
					await db.execute({
						sql: `INSERT OR IGNORE INTO scrobbles (user_uuid, track_id, title, artist, album, genre, played_at, cover, duration)
							VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
						args: [
							user_uuid,
							track.track_id ?? null,
							title,
							artist,
							track.album ?? null,
							track.genre ?? null,
							played_at,
							cover,
							duration
						]
					});
				} catch (_) {
					await db.execute({
						sql: `INSERT OR IGNORE INTO scrobbles (user_uuid, track_id, title, artist, album, genre, played_at)
							VALUES (?, ?, ?, ?, ?, ?, ?)`,
						args: [
							user_uuid,
							track.track_id ?? null,
							title,
							artist,
							track.album ?? null,
							track.genre ?? null,
							played_at
						]
					});
				}
			}
		}

		return res.status(201).json({ success: true, message: "Scrobble recorded" });
	} catch (error) {
		console.error("Scrobble failed:", error);
		return res.status(500).json({ error: "Failed to record scrobble" });
	}
});

// Multi-Device Profile Identity Endpoints
router.get("/api/user/profile", async (req, res) => {
	try {
		const user_uuid = String(req.query.user_uuid || "").trim();
		if (!user_uuid) {
			return res.status(400).json({ error: "user_uuid is required" });
		}

		const result = await db.execute({
			sql: `SELECT user_uuid, display_name, avatar_url, updated_at FROM user_profiles WHERE user_uuid = ?`,
			args: [user_uuid]
		});

		if (result.rows && result.rows.length > 0) {
			const row = result.rows[0];
			return res.json({
				user_uuid: row.user_uuid,
				display_name: row.display_name || "Loopner",
				avatar_url: row.avatar_url || "",
				updated_at: Number(row.updated_at || Date.now())
			});
		}

		return res.json({
			user_uuid,
			display_name: "Loopner",
			avatar_url: "",
			updated_at: Date.now()
		});
	} catch (error) {
		console.error("Fetch profile failed:", error);
		return res.status(500).json({ error: "Failed to fetch user profile" });
	}
});

router.post("/api/user/profile", async (req, res) => {
	try {
		const user_uuid = String(req.body?.user_uuid || "").trim();
		if (!user_uuid) {
			return res.status(400).json({ error: "user_uuid is required" });
		}

		const display_name = String(req.body?.display_name || "Loopner").trim().slice(0, 50) || "Loopner";
		const avatar_url = String(req.body?.avatar_url || "").trim().slice(0, 500);
		const updated_at = Date.now();

		await db.execute({
			sql: `INSERT INTO user_profiles (user_uuid, display_name, avatar_url, updated_at)
				VALUES (?, ?, ?, ?)
				ON CONFLICT(user_uuid) DO UPDATE SET
					display_name = excluded.display_name,
					avatar_url = excluded.avatar_url,
					updated_at = excluded.updated_at`,
			args: [user_uuid, display_name, avatar_url, updated_at]
		});

		return res.json({
			success: true,
			profile: {
				user_uuid,
				display_name,
				avatar_url,
				updated_at
			}
		});
	} catch (error) {
		console.error("Save profile failed:", error);
		return res.status(500).json({ error: "Failed to save user profile" });
	}
});

function mapHistoryRow(row) {
	return {
		id: row.id,
		user_uuid: row.user_uuid,
		track_id: row.track_id,
		videoId: row.track_id,
		title: row.title,
		artist: row.artist,
		album: row.album || null,
		cover: row.cover || null,
		thumbnail: row.cover || null,
		duration: row.duration != null ? Number(row.duration) : null,
		played_at: Number(row.played_at),
		playlist_id: row.playlist_id || null,
		playlist_name: row.playlist_name || null,
		playlist_cover: row.playlist_cover || null,
		playlist_count: row.playlist_count != null ? Number(row.playlist_count) : null,
		playlist_is_imported: Boolean(row.playlist_is_imported)
	};
}

router.post("/api/history", async (req, res) => {
	try {
		const user_uuid = req.body?.user_uuid;
		const item = req.body?.item;
		if (!user_uuid || !item || (!item.track_id && !item.videoId) || !item.title) {
			return res.status(400).json({ error: "user_uuid, item.track_id, and item.title are required" });
		}
		const track_id = String(item.track_id || item.videoId);
		const title = String(item.title);
		const artist = String(item.artist || "Unknown Artist");
		const album = item.album || null;
		const cover = item.cover || item.thumbnail || null;
		const duration = item.duration != null && !isNaN(item.duration) ? Math.round(Number(item.duration)) : null;
		const played_at = Number(item.played_at || Date.now());
		const playlist_id = item.playlist_id ? String(item.playlist_id) : null;
		const playlist_name = item.playlist_name || item.playlist_title || null;
		const playlist_cover = item.playlist_cover || item.playlist_thumbnail || null;
		const playlist_count = item.playlist_count != null ? Number(item.playlist_count) : null;
		const playlist_is_imported = item.playlist_is_imported ? 1 : 0;
		const id = item.id || `hist_${user_uuid}_${track_id}`;

		await db.execute({
			sql: `INSERT INTO user_history (
				id, user_uuid, track_id, title, artist, album, cover, duration,
				playlist_id, playlist_name, playlist_cover, playlist_count, playlist_is_imported, played_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(user_uuid, track_id) DO UPDATE SET
				id = excluded.id,
				title = excluded.title,
				artist = excluded.artist,
				album = excluded.album,
				cover = excluded.cover,
				duration = excluded.duration,
				playlist_id = excluded.playlist_id,
				playlist_name = excluded.playlist_name,
				playlist_cover = excluded.playlist_cover,
				playlist_count = excluded.playlist_count,
				playlist_is_imported = excluded.playlist_is_imported,
				played_at = excluded.played_at`,
			args: [
				id, user_uuid, track_id, title, artist, album, cover, duration,
				playlist_id, playlist_name, playlist_cover, playlist_count, playlist_is_imported, played_at
			]
		});

		try {
			await db.execute({
				sql: `DELETE FROM user_history 
					WHERE user_uuid = ? 
					AND id NOT IN (
						SELECT id FROM user_history WHERE user_uuid = ? ORDER BY played_at DESC LIMIT 20
					)`,
				args: [user_uuid, user_uuid]
			});
		} catch (_) {}

		return res.status(200).json({ success: true });
	} catch (error) {
		console.error("Save history failed:", error);
		return res.status(500).json({ error: "Failed to save history" });
	}
});

router.post("/api/history/batch", async (req, res) => {
	try {
		const user_uuid = req.body?.user_uuid;
		const history = req.body?.history;
		if (!user_uuid || !Array.isArray(history)) {
			return res.status(400).json({ error: "user_uuid and history array are required" });
		}

		for (const item of history.slice(0, 20)) {
			if (!item || (!item.track_id && !item.videoId) || !item.title) continue;
			const track_id = String(item.track_id || item.videoId);
			const title = String(item.title);
			const artist = String(item.artist || "Unknown Artist");
			const album = item.album || null;
			const cover = item.cover || item.thumbnail || null;
			const duration = item.duration != null && !isNaN(item.duration) ? Math.round(Number(item.duration)) : null;
			const played_at = Number(item.played_at || Date.now());
			const playlist_id = item.playlist_id ? String(item.playlist_id) : null;
			const playlist_name = item.playlist_name || item.playlist_title || null;
			const playlist_cover = item.playlist_cover || item.playlist_thumbnail || null;
			const playlist_count = item.playlist_count != null ? Number(item.playlist_count) : null;
			const playlist_is_imported = item.playlist_is_imported ? 1 : 0;
			const id = item.id || `hist_${user_uuid}_${track_id}`;

			await db.execute({
				sql: `INSERT INTO user_history (
					id, user_uuid, track_id, title, artist, album, cover, duration,
					playlist_id, playlist_name, playlist_cover, playlist_count, playlist_is_imported, played_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(user_uuid, track_id) DO UPDATE SET
					title = excluded.title,
					artist = excluded.artist,
					album = excluded.album,
					cover = excluded.cover,
					duration = excluded.duration,
					playlist_id = excluded.playlist_id,
					playlist_name = excluded.playlist_name,
					playlist_cover = excluded.playlist_cover,
					playlist_count = excluded.playlist_count,
					playlist_is_imported = excluded.playlist_is_imported,
					played_at = MAX(user_history.played_at, excluded.played_at)`,
				args: [
					id, user_uuid, track_id, title, artist, album, cover, duration,
					playlist_id, playlist_name, playlist_cover, playlist_count, playlist_is_imported, played_at
				]
			});
		}

		try {
			await db.execute({
				sql: `DELETE FROM user_history 
					WHERE user_uuid = ? 
					AND id NOT IN (
						SELECT id FROM user_history WHERE user_uuid = ? ORDER BY played_at DESC LIMIT 20
					)`,
				args: [user_uuid, user_uuid]
			});
		} catch (_) {}

		const result = await db.execute({
			sql: `SELECT id, user_uuid, track_id, title, artist, album, cover, duration,
				playlist_id, playlist_name, playlist_cover, playlist_count, playlist_is_imported, played_at
				FROM user_history
				WHERE user_uuid = ?
				ORDER BY played_at DESC
				LIMIT 20`,
			args: [user_uuid]
		});

		return res.status(200).json({ success: true, history: result.rows.map(mapHistoryRow) });
	} catch (error) {
		console.error("Batch save history failed:", error);
		return res.status(500).json({ error: "Failed to batch save history" });
	}
});

router.get("/api/history", async (req, res) => {
	try {
		const user_uuid = String(req.query.user_uuid || "").trim();
		if (!user_uuid) {
			return res.status(400).json({ error: "user_uuid is required" });
		}
		const result = await db.execute({
			sql: `SELECT id, user_uuid, track_id, title, artist, album, cover, duration,
				playlist_id, playlist_name, playlist_cover, playlist_count, playlist_is_imported, played_at
				FROM user_history
				WHERE user_uuid = ?
				ORDER BY played_at DESC
				LIMIT 20`,
			args: [user_uuid]
		});
		return res.json({ history: result.rows.map(mapHistoryRow) });
	} catch (error) {
		console.error("Get history failed:", error);
		return res.status(500).json({ error: "Failed to fetch history" });
	}
});

router.get("/api/sync", async (req, res) => {
	try {
		const user_uuid = String(req.query.user_uuid || "").trim();
		if (!user_uuid) {
			return res.status(400).json({ error: "user_uuid is required" });
		}

		const since = req.query.since != null && String(req.query.since).trim() !== ""
			? Number(req.query.since)
			: 0;

		const [scrobblesResult, playlistsResult, historyResult] = await Promise.all([
			db.execute({
				sql: `SELECT id, user_uuid, track_id, title, artist, album, genre, played_at, cover, duration
					FROM scrobbles
					WHERE user_uuid = ? AND played_at > ?
					ORDER BY played_at ASC`,
				args: [user_uuid, since]
			}).catch(() => db.execute({
				sql: `SELECT id, user_uuid, track_id, title, artist, album, genre, played_at
					FROM scrobbles
					WHERE user_uuid = ? AND played_at > ?
					ORDER BY played_at ASC`,
				args: [user_uuid, since]
			})),
			db.execute({
				sql: `SELECT id, user_uuid, name, tracks_json, updated_at
					FROM playlists
					WHERE user_uuid = ? AND updated_at > ?`,
				args: [user_uuid, since]
			}),
			db.execute({
				sql: `SELECT id, user_uuid, track_id, title, artist, album, cover, duration,
					playlist_id, playlist_name, playlist_cover, playlist_count, playlist_is_imported, played_at
					FROM user_history
					WHERE user_uuid = ?
					ORDER BY played_at DESC
					LIMIT 20`,
				args: [user_uuid]
			}).catch(() => ({ rows: [] }))
		]);

		const scrobbles = scrobblesResult.rows.map((row) => ({
			id: row.id,
			user_uuid: row.user_uuid,
			track_id: row.track_id,
			title: row.title,
			artist: row.artist,
			album: row.album,
			genre: row.genre,
			cover: row.cover || null,
			duration: row.duration != null ? Number(row.duration) : null,
			played_at: row.played_at
		}));

		const playlists = playlistsResult.rows.map((row) => ({
			id: row.id,
			user_uuid: row.user_uuid,
			name: row.name,
			tracks: parsePlaylistTracks(row.tracks_json),
			tracks_json: row.tracks_json,
			updated_at: row.updated_at
		}));

		const history = historyResult.rows.map(mapHistoryRow);

		return res.json({ scrobbles, playlists, history });
	} catch (error) {
		console.error("Sync failed:", error);
		return res.status(500).json({ error: "Failed to sync data" });
	}
});

router.get("/api/user/stats", async (req, res) => {
	try {
		const user_uuid = String(req.query.user_uuid || "").trim();
		if (!user_uuid) {
			return res.status(400).json({ error: "user_uuid is required" });
		}

		const tf = String(req.query.timeframe || "all").toLowerCase();
		let cutoff = 0;
		if (tf === "week" || tf === "7d" || tf === "7days" || tf === "last 7 days") {
			cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
		} else if (tf === "month" || tf === "30d" || tf === "30days" || tf === "last 30 days") {
			cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
		}

		const formatRelativeTime = (timestamp) => {
			if (!timestamp) return "Recently";
			const diffSec = Math.max(0, Math.floor((Date.now() - Number(timestamp)) / 1000));
			if (diffSec < 60) return "Just now";
			const diffMin = Math.floor(diffSec / 60);
			if (diffMin < 60) return `${diffMin}m ago`;
			const diffHours = Math.floor(diffMin / 60);
			if (diffHours < 24) return `${diffHours}h ago`;
			const diffDays = Math.floor(diffHours / 24);
			if (diffDays === 1) return "Yesterday";
			if (diffDays < 7) return `${diffDays}d ago`;
			const diffWeeks = Math.floor(diffDays / 7);
			if (diffWeeks < 4) return `${diffWeeks}w ago`;
			return new Date(Number(timestamp)).toLocaleDateString(undefined, { month: "short", day: "numeric" });
		};

		const formatDurationText = (seconds) => {
			const secs = Math.max(0, Math.round(seconds || 0));
			if (secs < 60) return `${secs}s`;
			const m = Math.floor(secs / 60);
			if (m < 60) return `${m}m`;
			const h = Math.floor(m / 60);
			const remM = m % 60;
			return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
		};

		const [totalResult, artistsResult, tracksResult, historyResult, playlistsResult] = await Promise.all([
			db.execute({
				sql: `SELECT 
						COUNT(*) AS totalPlays,
						COUNT(DISTINCT title || ' - ' || artist) AS uniqueSongs,
						SUM(COALESCE(duration_listened, CASE WHEN duration IS NOT NULL AND duration > 0 THEN duration ELSE 0 END)) AS totalSeconds
					FROM scrobbles
					WHERE user_uuid = ? AND played_at >= ?`,
				args: [user_uuid, cutoff]
			}).catch(async () => {
				const fallback = await db.execute({
					sql: `SELECT COUNT(*) AS totalPlays, SUM(CASE WHEN duration IS NOT NULL AND duration > 0 THEN duration ELSE 0 END) AS totalSeconds FROM scrobbles WHERE user_uuid = ? AND played_at >= ?`,
					args: [user_uuid, cutoff]
				});
				const plays = Number(fallback.rows[0]?.totalPlays || 0);
				const secs = Number(fallback.rows[0]?.totalSeconds || (plays * 180));
				return {
					rows: [{
						totalPlays: plays,
						uniqueSongs: plays,
						totalSeconds: secs
					}]
				};
			}),
			db.execute({
				sql: `SELECT artist, COUNT(*) AS playCount
					FROM scrobbles
					WHERE user_uuid = ? AND played_at >= ?
					GROUP BY artist
					ORDER BY playCount DESC
					LIMIT 5`,
				args: [user_uuid, cutoff]
			}),
			db.execute({
				sql: `SELECT title, artist, track_id, MAX(cover) AS cover, COUNT(*) AS playCount
					FROM scrobbles
					WHERE user_uuid = ? AND played_at >= ?
					GROUP BY track_id, title, artist
					ORDER BY playCount DESC
					LIMIT 5`,
				args: [user_uuid, cutoff]
			}).catch(() => {
				return db.execute({
					sql: `SELECT title, artist, track_id, COUNT(*) AS playCount
						FROM scrobbles
						WHERE user_uuid = ? AND played_at >= ?
						GROUP BY track_id, title, artist
						ORDER BY playCount DESC
						LIMIT 5`,
					args: [user_uuid, cutoff]
				});
			}),
			db.execute({
				sql: `SELECT id, user_uuid, track_id, title, artist, album, cover, duration,
					playlist_id, playlist_name, playlist_cover, playlist_count, playlist_is_imported, played_at
					FROM user_history
					WHERE user_uuid = ?
					ORDER BY played_at DESC
					LIMIT 20`,
				args: [user_uuid]
			}).catch(() => ({ rows: [] })),
			db.execute({
				sql: `SELECT id, name, tracks_json, updated_at, COALESCE(last_played_at, updated_at) AS last_played_at, COALESCE(play_count, 0) AS play_count
					FROM playlists
					WHERE user_uuid = ?
					ORDER BY COALESCE(last_played_at, updated_at) DESC
					LIMIT 20`,
				args: [user_uuid]
			}).catch(() => {
				return db.execute({
					sql: `SELECT id, name, tracks_json, updated_at
						FROM playlists
						WHERE user_uuid = ?
						ORDER BY updated_at DESC
						LIMIT 20`,
					args: [user_uuid]
				});
			})
		]);

		const historyItems = historyResult.rows.map(mapHistoryRow);
		const historyCount = historyItems.length;
		const totalPlaysFromScrobbles = Number(totalResult.rows[0]?.totalPlays || 0);
		const totalPlays = Math.max(totalPlaysFromScrobbles, historyCount);
		const uniqueSongs = Math.max(Number(totalResult.rows[0]?.uniqueSongs || 0), historyCount);
		const totalSeconds = totalPlays > 0 ? Number(totalResult.rows[0]?.totalSeconds || (totalPlays * 210)) : 0;
		const totalMinutes = Math.round(totalSeconds / 60);
		const listeningTimeFormatted = formatDurationText(totalSeconds);

		const topArtists = artistsResult.rows.map((row) => ({
			artist: row.artist,
			playCount: Number(row.playCount)
		}));

		const topTracks = tracksResult.rows.map((row) => ({
			title: row.title,
			artist: row.artist,
			track_id: row.track_id,
			cover: row.cover || null,
			playCount: Number(row.playCount)
		}));

		const playlistHistory = playlistsResult.rows.map((row) => {
			let tracks = [];
			try {
				tracks = JSON.parse(row.tracks_json || "[]");
			} catch (_) {
				tracks = [];
			}
			const firstCover = tracks[0]?.cover || tracks[0]?.thumbnail || "/default-cover.svg";
			const played_at = Number(row.last_played_at || row.updated_at);
			return {
				id: `playlist_${row.id}`,
				type: "playlist",
				playlist_id: row.id,
				title: row.name,
				artist: "Imported Playlist",
				count: tracks.length,
				cover: firstCover,
				tracks: tracks,
				played_at,
				last_played_at: formatRelativeTime(played_at),
				play_count: Number(row.play_count || 1)
			};
		});

		return res.json({
			totalPlays,
			totalSongs: uniqueSongs || totalPlays,
			uniqueSongs,
			totalListeningSeconds: totalSeconds,
			totalListeningMinutes: totalMinutes,
			totalListeningTime: listeningTimeFormatted,
			listeningTimeFormatted,
			topArtists,
			topTracks,
			history: historyItems,
			playlists: playlistHistory
		});
	} catch (error) {
		console.error("User stats failed:", error);
		return res.status(500).json({ error: "Failed to fetch user stats" });
	}
});

module.exports = router;
