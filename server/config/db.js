const { createClient } = require("@libsql/client");

const db = createClient({
	url: process.env.TURSO_DATABASE_URL,
	authToken: process.env.TURSO_AUTH_TOKEN,
});

async function initDb() {
	await db.execute(`
		CREATE TABLE IF NOT EXISTS scrobbles (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_uuid TEXT NOT NULL,
			track_id TEXT,
			title TEXT NOT NULL,
			artist TEXT NOT NULL,
			album TEXT,
			genre TEXT,
			played_at INTEGER NOT NULL
		)
	`);
	await db.execute(`
		CREATE TABLE IF NOT EXISTS playlists (
			id TEXT PRIMARY KEY,
			user_uuid TEXT NOT NULL,
			name TEXT NOT NULL,
			tracks_json TEXT NOT NULL,
			updated_at INTEGER NOT NULL
		)
	`);
	await db.execute(`
		CREATE TABLE IF NOT EXISTS user_profiles (
			user_uuid TEXT PRIMARY KEY,
			display_name TEXT DEFAULT 'Loopner',
			avatar_url TEXT DEFAULT '',
			updated_at INTEGER
		)
	`);
	await db.execute(`
		CREATE TABLE IF NOT EXISTS user_history (
			id TEXT PRIMARY KEY,
			user_uuid TEXT NOT NULL,
			track_id TEXT NOT NULL,
			title TEXT NOT NULL,
			artist TEXT NOT NULL,
			album TEXT,
			cover TEXT,
			duration INTEGER,
			playlist_id TEXT,
			playlist_name TEXT,
			playlist_cover TEXT,
			playlist_count INTEGER,
			playlist_is_imported INTEGER DEFAULT 0,
			played_at INTEGER NOT NULL
		)
	`);
	await db.execute(`
		CREATE TABLE IF NOT EXISTS liked_songs (
			user_uuid TEXT NOT NULL,
			track_id TEXT NOT NULL,
			title TEXT NOT NULL,
			artist TEXT NOT NULL,
			thumbnail TEXT,
			duration INTEGER,
			liked_at INTEGER NOT NULL,
			PRIMARY KEY (user_uuid, track_id)
		)
	`);
	await db.execute("CREATE INDEX IF NOT EXISTS idx_scrobbles_user ON scrobbles(user_uuid)");
	await db.execute("CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists(user_uuid)");
	await db.execute("CREATE INDEX IF NOT EXISTS idx_user_profiles ON user_profiles(user_uuid)");
	await db.execute("CREATE INDEX IF NOT EXISTS idx_user_history_user ON user_history(user_uuid, played_at DESC)");
	await db.execute("CREATE INDEX IF NOT EXISTS idx_liked_songs_user ON liked_songs(user_uuid, liked_at DESC)");
	try {
		await db.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_user_history_unique ON user_history(user_uuid, track_id)");
	} catch (_) {}

	try {
		await db.execute("ALTER TABLE scrobbles ADD COLUMN cover TEXT");
	} catch (_) {}
	try {
		await db.execute("ALTER TABLE scrobbles ADD COLUMN duration INTEGER");
	} catch (_) {}
	try {
		await db.execute("ALTER TABLE scrobbles ADD COLUMN duration_listened INTEGER DEFAULT 0");
	} catch (_) {}
	// session_id dedup column — added in a later migration; safe to run repeatedly.
	try {
		await db.execute("ALTER TABLE scrobbles ADD COLUMN session_id TEXT");
	} catch (_) {}
	try {
		await db.execute("ALTER TABLE scrobbles ADD COLUMN playlist_id TEXT");
	} catch (_) {}
	try {
		await db.execute("ALTER TABLE scrobbles ADD COLUMN origin_context TEXT");
	} catch (_) {}
	try {
		await db.execute("ALTER TABLE playlists ADD COLUMN last_played_at INTEGER");
	} catch (_) {}
	try {
		await db.execute("ALTER TABLE playlists ADD COLUMN play_count INTEGER DEFAULT 0");
	} catch (_) {}
	try {
		await db.execute(
			"CREATE UNIQUE INDEX IF NOT EXISTS idx_scrobbles_session " +
			"ON scrobbles(user_uuid, session_id) WHERE session_id IS NOT NULL"
		);
	} catch (_) {}
}

module.exports = {
	db,
	initDb
};
