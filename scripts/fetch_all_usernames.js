/**
 * ╔═══════════════════════════════════════════════════════════════════════════════════════╗
 * ║  ULTIMATE USERNAME HARVESTER - Fetch ALL 436,964 Minted Usernames from TON           ║
 * ║  Build the world's most accurate valuation model from REAL data                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════════════════╝
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../data");

// Fragment Collection Address (Usernames NFT Collection)
const FRAGMENT_COLLECTION = "EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N";

// TonAPI Config
const TONAPI_KEY = process.env.TONAPI_KEY || "";
const TONAPI_BASE = "https://tonapi.io/v2";

// Output files
const OUTPUT_FILE = path.join(DATA_DIR, "all_usernames.json");
const STATS_FILE = path.join(DATA_DIR, "username_stats.json");

// Rate limiting
const BATCH_SIZE = 1000; // Items per request (max 1000)
const DELAY_MS = 500; // Delay between requests to avoid rate limiting

/**
 * Fetch items from the Fragment collection
 */
async function fetchCollectionItems(offset = 0, limit = 1000) {
	const url = `${TONAPI_BASE}/nfts/collections/${FRAGMENT_COLLECTION}/items?limit=${limit}&offset=${offset}`;

	const headers = {};
	if (TONAPI_KEY) {
		headers.Authorization = `Bearer ${TONAPI_KEY}`;
	}

	const response = await fetch(url, { headers });

	if (!response.ok) {
		throw new Error(`TonAPI Error: ${response.status} ${response.statusText}`);
	}

	return await response.json();
}

/**
 * Extract username from NFT metadata
 */
function extractUsername(item) {
	try {
		// The username is in the metadata
		const metadata = item.metadata || {};
		const name = metadata.name || item.dns || "";

		// Clean up - remove .t.me suffix if present
		const username = name
			.replace(".t.me", "")
			.replace("@", "")
			.toLowerCase()
			.trim();

		return username;
	} catch (_e) {
		return null;
	}
}

/**
 * Analyze username characteristics
 */
function analyzeUsername(username) {
	const len = username.length;

	return {
		username,
		length: len,
		hasNumbers: /[0-9]/.test(username),
		hasUnderscore: /_/.test(username),
		isAllLetters: /^[a-z]+$/.test(username),
		isAllNumbers: /^[0-9]+$/.test(username),
		startsWithNumber: /^[0-9]/.test(username),
		endsWithNumber: /[0-9]$/.test(username),
		vowelCount: (username.match(/[aeiou]/gi) || []).length,
		consonantCount: (username.match(/[bcdfghjklmnpqrstvwxyz]/gi) || []).length,
		numberCount: (username.match(/[0-9]/g) || []).length,
		underscoreCount: (username.match(/_/g) || []).length,
		isKeyboardPattern: isKeyboardPattern(username),
		isGibberish: isGibberish(username),
		isPalindrome: username === username.split("").reverse().join(""),
		hasRepeatingChars: /(.)\1{2,}/.test(username),
	};
}

/**
 * Check if username is a keyboard pattern
 */
function isKeyboardPattern(str) {
	const patterns = ["qwerty", "asdf", "zxcv", "qazwsx", "wasd", "1234", "4321"];
	const lower = str.toLowerCase();
	return patterns.some((p) => lower.includes(p));
}

/**
 * Check if username is gibberish (hard to pronounce)
 */
function isGibberish(str) {
	// More than 3 consecutive consonants
	if (/[bcdfghjklmnpqrstvwxyz]{4,}/i.test(str)) return true;

	// Very low vowel ratio for longer names
	if (str.length >= 5) {
		const vowels = (str.match(/[aeiou]/gi) || []).length;
		if (vowels / str.length < 0.15) return true;
	}

	return false;
}

/**
 * Main harvesting function
 */
async function harvestAllUsernames() {
	console.log(
		"╔═══════════════════════════════════════════════════════════════════════════════╗",
	);
	console.log(
		"║  ULTIMATE USERNAME HARVESTER - Starting Data Collection                      ║",
	);
	console.log(
		"╚═══════════════════════════════════════════════════════════════════════════════╝",
	);
	console.log("");

	// Ensure data directory exists
	if (!fs.existsSync(DATA_DIR)) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
	}

	const allUsernames = [];
	let offset = 0;
	let totalFetched = 0;
	let hasMore = true;

	console.log(`🎯 Target: ~436,964 usernames from Fragment collection`);
	console.log(`📦 Batch size: ${BATCH_SIZE}`);
	console.log(`⏱️ Delay: ${DELAY_MS}ms between requests`);
	console.log("");
	console.log("Starting harvest...\n");

	const startTime = Date.now();

	while (hasMore) {
		try {
			console.log(`📥 Fetching batch: offset=${offset}...`);

			const data = await fetchCollectionItems(offset, BATCH_SIZE);
			const items = data.nft_items || [];

			if (items.length === 0) {
				hasMore = false;
				console.log("✅ No more items to fetch");
				break;
			}

			// Process each item
			for (const item of items) {
				const username = extractUsername(item);
				if (username && username.length >= 4) {
					const analysis = analyzeUsername(username);
					allUsernames.push(analysis);
				}
			}

			totalFetched += items.length;
			offset += BATCH_SIZE;

			// Progress update
			const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
			const rate = (totalFetched / elapsed).toFixed(0);
			console.log(
				`   ✓ Total: ${totalFetched.toLocaleString()} | Usernames: ${allUsernames.length.toLocaleString()} | Rate: ${rate}/s`,
			);

			// Save progress every 10,000 items
			if (totalFetched % 10000 === 0) {
				console.log(`   💾 Saving progress...`);
				fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allUsernames, null, 2));
			}

			// Rate limiting
			await new Promise((r) => setTimeout(r, DELAY_MS));

			// Stop if we've fetched enough (safety limit)
			if (totalFetched >= 500000) {
				console.log("⚠️ Safety limit reached (500k)");
				hasMore = false;
			}
		} catch (error) {
			console.error(`❌ Error at offset ${offset}:`, error.message);

			// If rate limited, wait longer
			if (error.message.includes("429")) {
				console.log("⏳ Rate limited, waiting 30 seconds...");
				await new Promise((r) => setTimeout(r, 30000));
			} else {
				// Save what we have and exit
				break;
			}
		}
	}

	const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

	console.log("\n");
	console.log(
		"═══════════════════════════════════════════════════════════════════════════════",
	);
	console.log(`✅ HARVEST COMPLETE!`);
	console.log(`   📊 Total NFTs fetched: ${totalFetched.toLocaleString()}`);
	console.log(`   📝 Valid usernames: ${allUsernames.length.toLocaleString()}`);
	console.log(`   ⏱️ Time elapsed: ${totalTime} minutes`);
	console.log(
		"═══════════════════════════════════════════════════════════════════════════════",
	);

	// Save all usernames
	console.log(`\n💾 Saving to ${OUTPUT_FILE}...`);
	fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allUsernames, null, 2));

	// Generate statistics
	const stats = generateStatistics(allUsernames);
	console.log(`📈 Saving statistics to ${STATS_FILE}...`);
	fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));

	// Print summary
	printStatsSummary(stats);

	return { usernames: allUsernames, stats };
}

/**
 * Generate comprehensive statistics
 */
function generateStatistics(usernames) {
	const stats = {
		total: usernames.length,
		generatedAt: new Date().toISOString(),

		// Length distribution
		byLength: {},

		// Character composition
		composition: {
			allLetters: 0,
			hasNumbers: 0,
			hasUnderscore: 0,
			allNumbers: 0,
			startsWithNumber: 0,
			endsWithNumber: 0,
		},

		// Quality indicators
		quality: {
			clean: 0, // All letters, pronounceable
			mixed: 0, // Has numbers but readable
			underscore: 0, // Has underscore
			gibberish: 0, // Random characters
			keyboard: 0, // Keyboard patterns
		},

		// Patterns
		patterns: {
			palindromes: [],
			repeating: 0,
		},

		// Length statistics
		lengthStats: {
			min: Infinity,
			max: 0,
			avg: 0,
			median: 0,
		},
	};

	const lengths = [];

	for (const u of usernames) {
		// Length distribution
		if (!stats.byLength[u.length]) {
			stats.byLength[u.length] = { count: 0, examples: [] };
		}
		stats.byLength[u.length].count++;
		if (stats.byLength[u.length].examples.length < 10) {
			stats.byLength[u.length].examples.push(u.username);
		}

		lengths.push(u.length);

		// Composition
		if (u.isAllLetters) stats.composition.allLetters++;
		if (u.hasNumbers) stats.composition.hasNumbers++;
		if (u.hasUnderscore) stats.composition.hasUnderscore++;
		if (u.isAllNumbers) stats.composition.allNumbers++;
		if (u.startsWithNumber) stats.composition.startsWithNumber++;
		if (u.endsWithNumber) stats.composition.endsWithNumber++;

		// Quality classification
		if (u.isAllLetters && !u.isGibberish) {
			stats.quality.clean++;
		} else if (u.isKeyboardPattern) {
			stats.quality.keyboard++;
		} else if (u.isGibberish) {
			stats.quality.gibberish++;
		} else if (u.hasUnderscore) {
			stats.quality.underscore++;
		} else {
			stats.quality.mixed++;
		}

		// Patterns
		if (u.isPalindrome && u.length >= 4) {
			stats.patterns.palindromes.push(u.username);
		}
		if (u.hasRepeatingChars) {
			stats.patterns.repeating++;
		}
	}

	// Calculate length stats
	lengths.sort((a, b) => a - b);
	stats.lengthStats.min = lengths[0];
	stats.lengthStats.max = lengths[lengths.length - 1];
	stats.lengthStats.avg = (
		lengths.reduce((a, b) => a + b, 0) / lengths.length
	).toFixed(2);
	stats.lengthStats.median = lengths[Math.floor(lengths.length / 2)];

	// Calculate percentages
	stats.percentages = {
		clean: `${((stats.quality.clean / stats.total) * 100).toFixed(2)}%`,
		mixed: `${((stats.quality.mixed / stats.total) * 100).toFixed(2)}%`,
		underscore: `${((stats.quality.underscore / stats.total) * 100).toFixed(2)}%`,
		gibberish: `${((stats.quality.gibberish / stats.total) * 100).toFixed(2)}%`,
		keyboard: `${((stats.quality.keyboard / stats.total) * 100).toFixed(2)}%`,
	};

	return stats;
}

/**
 * Print statistics summary
 */
function printStatsSummary(stats) {
	console.log("\n");
	console.log(
		"╔═══════════════════════════════════════════════════════════════════════════════╗",
	);
	console.log(
		"║                         USERNAME STATISTICS SUMMARY                           ║",
	);
	console.log(
		"╚═══════════════════════════════════════════════════════════════════════════════╝",
	);
	console.log("");
	console.log(`📊 Total Usernames Analyzed: ${stats.total.toLocaleString()}`);
	console.log("");

	console.log("📏 LENGTH DISTRIBUTION:");
	for (const len of Object.keys(stats.byLength).sort((a, b) => a - b)) {
		const d = stats.byLength[len];
		const bar = "█".repeat(Math.min(50, Math.floor(d.count / 1000)));
		console.log(
			`   ${len.padStart(2)} chars: ${d.count.toLocaleString().padStart(8)} ${bar}`,
		);
	}
	console.log("");

	console.log("🎨 COMPOSITION:");
	console.log(
		`   All Letters (Clean):    ${stats.composition.allLetters.toLocaleString()}`,
	);
	console.log(
		`   Has Numbers:            ${stats.composition.hasNumbers.toLocaleString()}`,
	);
	console.log(
		`   Has Underscore:         ${stats.composition.hasUnderscore.toLocaleString()}`,
	);
	console.log(
		`   Ends with Number:       ${stats.composition.endsWithNumber.toLocaleString()}`,
	);
	console.log("");

	console.log("⭐ QUALITY BREAKDOWN:");
	console.log(
		`   ✅ Clean (valuable):    ${stats.quality.clean.toLocaleString()} (${stats.percentages.clean})`,
	);
	console.log(
		`   🔷 Mixed (decent):      ${stats.quality.mixed.toLocaleString()} (${stats.percentages.mixed})`,
	);
	console.log(
		`   ⚠️ Underscore (poor):   ${stats.quality.underscore.toLocaleString()} (${stats.percentages.underscore})`,
	);
	console.log(
		`   🗑️ Gibberish (junk):    ${stats.quality.gibberish.toLocaleString()} (${stats.percentages.gibberish})`,
	);
	console.log(
		`   ⌨️ Keyboard (trash):    ${stats.quality.keyboard.toLocaleString()} (${stats.percentages.keyboard})`,
	);
	console.log("");

	if (stats.patterns.palindromes.length > 0) {
		console.log("🪞 PALINDROMES FOUND:");
		console.log(`   ${stats.patterns.palindromes.slice(0, 20).join(", ")}`);
	}

	console.log("\n✅ Statistics saved to data/username_stats.json");
}

// Run the harvester
harvestAllUsernames().catch(console.error);
