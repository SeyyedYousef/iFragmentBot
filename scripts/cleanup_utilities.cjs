// Script to remove orphaned utility function bodies from bot.entry.js
// Removes lines 4425-4667 (0-indexed: 4424-4666)
const fs = require("node:fs");
const filePath = "src/App/bot.entry.js";

try {
	const content = fs.readFileSync(filePath, "utf8");
	const lines = content.split("\n");
	console.log("Original line count:", lines.length);

	// Keep lines 1-4424 and 4668+
	// In 0-indexed: keep 0-4423 and 4667+
	const newLines = [...lines.slice(0, 4424), ...lines.slice(4667)];

	fs.writeFileSync(filePath, newLines.join("\n"));
	console.log("New line count:", newLines.length);
	console.log("Removed", lines.length - newLines.length, "lines");
	console.log("DONE");
} catch (e) {
	console.error("Error:", e.message);
}
