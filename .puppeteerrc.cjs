/**
 * Puppeteer Configuration
 * This ensures Chrome is installed in the project directory
 * so it persists between Render's build and deploy phases.
 */
const { join } = require("node:path");

module.exports = {
	// Cache Chrome in the project's node_modules so it persists to runtime
	cacheDirectory: join(__dirname, "node_modules", ".cache", "puppeteer"),
};
