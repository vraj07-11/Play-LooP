const dns = require("node:dns");
require("dotenv").config();

// Enforce IPv4 priority to prevent Windows IPv6 connection timeouts (UND_ERR_CONNECT_TIMEOUT)
dns.setDefaultResultOrder("ipv4first");

const { initDb } = require("./server/config/db");
const { getSoundCloudClientId } = require("./server/services/soundcloud");
const app = require("./server/app");

const port = process.env.PORT || 3000;

initDb()
	.then(() => {
		const server = app.listen(port, "0.0.0.0", () => {
			console.log(`Play LooP is running at http://0.0.0.0:${port}`);
			// Warm up fresh live SoundCloud client ID immediately on server boot
			getSoundCloudClientId(true)
				.then(cid => console.log(`[SoundCloud] Warm client ID loaded on boot: ${cid}`))
				.catch(err => console.warn(`[SoundCloud] Boot client ID warning:`, err.message));
		});

		server.on("error", (error) => {
			if (error.code === "EADDRINUSE") {
				console.error(`Port ${port} is already in use.`);
			} else {
				console.error("Server failed:", error);
			}
			process.exitCode = 1;
		});
	})
	.catch((error) => {
		console.error("Failed to initialize database:", error);
		process.exitCode = 1;
	});
