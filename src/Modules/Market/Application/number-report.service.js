/**
 * Number Report Service
 * +888 Anonymous Numbers (Collectible Numbers) valuation and report generation
 */

import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { tonPriceCache } from "../../../Shared/Infra/Cache/cache.service.js";
import * as scraplingService from "../../../Shared/Infra/Scraping/scrapling.service.js";
import { getBrowser } from "../../../Shared/UI/Components/card-generator.component.js";
import * as seetgService from "../../Automation/Application/seetg.service.js";
import * as marketService from "./market.service.js";
import * as telegramClient from "../../../Shared/Infra/Telegram/telegram.client.js";

// Global cached numbers CSV data
let numbersDatabase = null;

export function loadNumbersDatabase() {
	if (numbersDatabase) return;
	numbersDatabase = new Map();
	try {
		const rootDir = process.cwd();
		const csvPath = path.join(rootDir, "data", "888_numbers.csv");
		if (fs.existsSync(csvPath)) {
			const data = fs.readFileSync(csvPath, "utf8");
			const records = parse(data, { columns: true, skip_empty_lines: true });
			for (const row of records) {
				const numRaw =
					row.number ||
					row.LibraryTypography ||
					row["table-cell-value"] ||
					row["table-cell-value 2"];
				const priceRaw =
					row.price ||
					row.LibraryCryptoPrice__amount ||
					row["table-cell-value 2"] ||
					row["table-cell-value 3"];

				if (numRaw && priceRaw) {
					const cleanNum = numRaw.replace(/[^0-9]/g, "");
					if (cleanNum.startsWith("888")) {
						// Strip entirely all non-digit and non-dot chars (handles spaces/invisible chars in numbers like 500 000)
						const price = parseFloat(String(priceRaw).replace(/[^\d.]/g, ""));
						if (Number.isFinite(price) && price > 0) {
							numbersDatabase.set(cleanNum, price);
						}
					}
				}
			}
			console.log(
				`📚 Loaded ${numbersDatabase.size} numbers from CSV database`,
			);
		} else {
			console.log(`⚠️ Numbers database not found at ${csvPath}`);
		}
	} catch (e) {
		console.warn(`Failed to load numbers CSV: ${e.message}`);
	}
}

// Format number with commas
function formatNumber(n) {
	if (!Number.isFinite(n)) return "—";
	return Math.round(n).toLocaleString("en-US");
}

// Safe number parse
function safeNum(v, fallback = 0) {
	const n = parseFloat(String(v).replace(/,/g, ""));
	return Number.isFinite(n) ? n : fallback;
}

/**
 * Parse number link to extract +888 number
 * Supports: fragment.com/number/8881234567890, +8881234567890, 8881234567890, 80808080
 */
export function parseNumberLink(input) {
	const raw = String(input).trim();
	if (!raw) return { isValid: false };

	// 1. Extract raw digits and handle Fragment/T.me links
	let clean = raw.replace(/[\s\-+]/g, "");
	const linkMatch = raw.match(
		/(?:fragment\.com\/number\/|t\.me\/number\/)(\d+)/i,
	);
	if (linkMatch) {
		clean = linkMatch[1];
	}

	// 2. Intelligent Prefix Handling
	// If it starts with 888888, the user probably entered the prefix twice (e.g. 888 + 8881234567)
	if (clean.startsWith("888888")) {
		clean = clean.slice(3);
	}

	// 3. Validation and Normalization
	// Standard anonymous numbers are either:
	// - 11 digits total (888 + 8 digits)
	// - 7 digits total (888 + 4 digits) - Rare/Short
	// - 8 digits (just the number part, we'll add 888)
	// - 4 digits (just the short number part, we'll add 888)

	let finalNumber = null;

	if (/^888(\d{4}|\d{8})$/.test(clean)) {
		// Already has prefix and correct length
		finalNumber = clean;
	} else if (/^(\d{4}|\d{8})$/.test(clean)) {
		// Missing prefix, add it
		finalNumber = `888${clean}`;
	}

	if (finalNumber) {
		return {
			number: `+${finalNumber}`,
			numberClean: finalNumber,
			isValid: true,
		};
	}

	return { isValid: false };
}

/**
 * Format number for display: +888 1 234 567 890
 */
export function formatDisplayNumber(number) {
	if (!number) return "—";
	const clean = String(number).replace(/\D/g, "");
	if (clean.startsWith("888") && clean.length >= 7) {
		const rest = clean.slice(3);
		if (rest.length <= 10) {
			// For standard 8-digit numbers, group by 4 (e.g. +888 8080 8080)
			if (rest.length === 8) {
				return `+888 ${rest.slice(0, 4)} ${rest.slice(4)}`;
			}
			// For others (like 4893) or odd lengths
			if (rest.length <= 4) return `+888 ${rest}`;
			const chunks = rest.match(/.{1,3}/g) || [rest];
			return `+888 ${chunks.join(" ")}`;
		}
	}
	return number;
}

/**
 * Analyze number pattern for value bonus and category floor
 */
function analyzeNumberPattern(numberClean, globalFloor = 850) {
	const digits = numberClean.replace(/\D/g, "");
	const tail = digits.slice(3); // After 888

	let patternFloor = globalFloor;
	let bonus = 0;
	let score = 40;
	let type = "Standard";
	let label = "Standard";
	let tier = "Standard";

	const d = tail.split("").map(Number);
	const uniqueCount = new Set(d).size;
	const luckyCount = (tail.match(/[78]/g) || []).length;
	const consecutiveCount = Math.max(...(tail.match(/(.)\1*/g) || []).map(s => s.length));

	// 1. ULTRA-SHORT (4 Digits) - The Highest Tier
	if (tail.length <= 4) {
		patternFloor = 60000; // Base for any 4-digit
		score = 95;
		
		const startsWith8 = tail.startsWith("8");
		const allLucky = tail.split("").every(x => x === "7" || x === "8");
		
		if (uniqueCount === 1) {
			tier = "Grail";
			label = "Solid Ultra-Short";
			bonus = 500;
			patternFloor = 250000;
		} else if (allLucky) {
			tier = "Grail";
			label = "Ultra-Short Luck (7s & 8s)";
			bonus = 400;
			patternFloor = 180000;
		} else if (startsWith8) {
			tier = "Elite";
			label = "Short Prefix-8";
			bonus = 300;
			patternFloor = 120000;
		} else {
			tier = "Elite";
			label = "Standard Ultra-Short";
			bonus = 150;
			patternFloor = 80000;
		}
		
		// Additional bonus for 777 or 888 sequences within short numbers
		if (tail.includes("777") || tail.includes("888")) {
			bonus += 100;
			patternFloor *= 1.5;
		}

		return { type: tier, bonus, label, score, uniqueCount, patternFloor };
	}

	// 2. STANDARD 11-DIGIT PATTERNS
	if (tail.length === 8) {
		const numVal = parseInt(tail, 10);
		
		// SOLID / REPDIGIT
		if (uniqueCount === 1) {
			tier = "Grail";
			label = `Solid 8 (XXXXXXXX)`;
			bonus = 450;
			score = 99;
			patternFloor = 150000;
		}
		// 7-ENDING
		else if (/^.(.)\1{6}$/.test(tail)) {
			tier = "Elite";
			label = "7-Ending Stream";
			bonus = 250;
			score = 92;
			patternFloor = 45000;
		}
		// REPEATING BLOCKS
		else if (/^(.)\1{3}(.)\2{3}$/.test(tail)) {
			tier = "Elite";
			label = "Quad-Blocks (XXXX YYYY)";
			bonus = 180;
			patternFloor = 25000;
		}
		// LADDERS
		else if (/^(01234567|12345678|23456789|98765432|87654321|76543210)$/.test(tail)) {
			tier = "Elite";
			label = "Perfect Ladder";
			bonus = 220;
			patternFloor = 35000;
		}
		// MIRROR / RADAR
		else if (tail === tail.split("").reverse().join("")) {
			tier = "Premium";
			label = "Golden Radar (8-Digit)";
			bonus = 140;
			patternFloor = 15000;
		}
		// CLUBS (1K, 10K)
		else if (numVal < 1000) {
			tier = "Elite";
			label = "1K Club (+888 0000 0)";
			bonus = 200;
			patternFloor = 50000;
		} else if (numVal < 10000) {
			tier = "Premium";
			label = "10K Club (+888 0000)";
			bonus = 120;
			patternFloor = 20000;
		}
		// CONSECUTIVES fallback
		else if (consecutiveCount >= 5) {
			tier = "Premium";
			label = `Consecutive ${consecutiveCount} Digits`;
			bonus = consecutiveCount * 25;
			patternFloor = consecutiveCount === 5 ? 12000 : consecutiveCount === 6 ? 45000 : 100000;
		}
		// LUCKY COMBO
		else if (luckyCount >= 5) {
			tier = "Premium";
			label = `Super Lucky (${luckyCount}x 7/8)`;
			bonus = luckyCount * 15;
			patternFloor = Math.max(patternFloor, luckyCount * 2000);
		}
		// LOW UNIQUE
		else if (uniqueCount <= 2) {
			tier = "Premium";
			label = "Double-Digit Only";
			bonus = 80;
			patternFloor = 8000;
		}
		// ROUND NUMBERS
		else if (tail.endsWith("0000")) {
			tier = "Premium";
			label = "Quad-Zero Ending";
			bonus = 100;
			patternFloor = 12000;
		}
	}

	// Score normalization based on tier
	score = tier === "Grail" ? 98 : tier === "Elite" ? 90 : tier === "Premium" ? 75 : 40;
	if (bonus > 0 && tier === "Standard") tier = "Premium";

	return { type: tier, bonus, label, score, uniqueCount, patternFloor };
}

/**
 * HTTP scrape Fragment number page
 */
async function scrapeFragmentNumber(numberClean) {
	const isAnonymous = numberClean.startsWith("888");
	const baseUrl = `https://fragment.com/number/${numberClean}`;
	const searchUrl = `https://fragment.com/numbers?query=${numberClean}&filter=sold`;
	
	const urlToFetch = isAnonymous ? searchUrl : baseUrl;
	let status = "available";
	
	try {
		const payload = await scraplingService.scraplingFetchFragment(numberClean, {
			type: "number",
			url: urlToFetch,
			wait: isAnonymous ? ".tm-table-grid" : ".tm-section-header-status",
			timeoutMs: 30000,
		});

		if (!payload || !payload.html) {
			return { status: "unknown", priceTon: null, url: baseUrl };
		}

		const html = payload.html;

		// 1. Check for specific "Not Found" indicators
		if (
			(html.includes("Address unavailable") || html.includes("Number not found") || html.includes("Auctions not found")) &&
			html.includes("tm-empty-placeholder")
		) {
			// If we checked the sold filter for anonymous and still got empty, it's truly not minted
			status = "not_found";
			return { status, priceTon: null, url: baseUrl };
		}

		// 2. Detect status from collectible page (tm-status-label) or search result table (tm-status)
		if (html.includes("tm-status-sold") || html.includes("tm-status-label tm-status-sold") || html.includes(">Sold<")) {
			status = "sold";
		} else if (html.includes("tm-status-unavail") || html.includes("tm-status-label tm-status-unavail")) {
			status = "available"; // Minted but not listed
		} else if (html.includes("tm-status-on-auction") || html.includes("tm-status-label tm-status-on-auction") || html.includes(">On auction<")) {
			status = "on_auction";
		} else if (html.includes("tm-status-for-sale") || html.includes("tm-status-label tm-status-for-sale") || html.includes(">For sale<")) {
			status = "for_sale";
		}

		// 3. Extract Price (TON)
		const priceMatches = [
			...html.matchAll(/icon-ton">([\d,]+(?:\.\d+)?)<\/div>/g),
		];
		const prices = priceMatches
			.map((m) => safeNum(m[1], null))
			.filter((p) => Number.isFinite(p) && p > 0);
		
		let priceTon = null;
		if (prices.length > 0) priceTon = prices[0];

		// 4. Extract Owner Address
		const ownerMatch = html.match(/tm-wallet-address">(\w+)<\/span>/) || 
		                  html.match(/address\/(\w+)/);
		const owner = ownerMatch ? ownerMatch[1] : null;

		// 5. Deep Extraction of History and Last Sale
		const scrapedHistory = [];
		
		// For Search Results (Anonymous Numbers often end up here)
		const tableRowMatches = html.matchAll(/<tr[^>]*class="tm-table-row"[^>]*>([\s\S]*?)<\/tr>/g);
		for (const row of tableRowMatches) {
			const rowHtml = row[1];
			const priceMatch = rowHtml.match(/icon-ton">([\d,]+(?:\.\d+)?)<\/div>/);
			const dateMatch = rowHtml.match(/<time[^>]*datetime="([^"]+)"[^>]*>([\s\S]*?)<\/time>/) || 
			                 rowHtml.match(/<div[^>]*class="tm-date"[^>]*>([\s\S]*?)<\/div>/);
			
			if (priceMatch) {
				scrapedHistory.push({
					price: safeNum(priceMatch[1], null),
					date: dateMatch ? (dateMatch[2] || dateMatch[1]).trim().replace(/&nbsp;/g, " ") : "Recent",
					fullDate: dateMatch ? dateMatch[1] : null
				});
			}
		}

		// For Single Item Page (Transaction History section)
		const gridRowMatches = html.matchAll(/tm-table-grid-row">([\s\S]*?)<\/div>\s*<\/div>/g);
		for (const row of gridRowMatches) {
			const rowHtml = row[1];
			const priceMatch = rowHtml.match(/icon-ton">([\d,]+(?:\.\d+)?)<\/div>/);
			const dateMatch = rowHtml.match(/tm-datetime[^>]*>([\s\S]*?)<\/div>/);
			if (priceMatch && !scrapedHistory.some(h => h.price === safeNum(priceMatch[1], null))) {
				scrapedHistory.push({
					price: safeNum(priceMatch[1], null),
					date: dateMatch ? dateMatch[1].trim() : "Recent"
				});
			}
		}

		let lastSale = null;
		let lastSaleDate = null;
		if (scrapedHistory.length > 0) {
			lastSale = scrapedHistory[0].price;
			lastSaleDate = scrapedHistory[0].date;
		} else if (status === "sold" && prices.length > 0) {
			lastSale = prices[0];
			// Try to find a header date
			const headerDate = html.match(/tm-section-header-date">([\s\S]*?)<\/div>/);
			lastSaleDate = headerDate ? headerDate[1].trim() : null;
		}

		const highestBid = status === "on_auction" && prices.length >= 1 ? prices[0] : null;
		const minBid = status === "on_auction" && prices.length >= 3 ? prices[2] : null;

		return { 
			status, 
			priceTon: priceTon, 
			highestBid, 
			minBid, 
			url: baseUrl, 
			owner, 
			lastSale, 
			lastSaleDate,
			history: scrapedHistory 
		};
	} catch (e) {
		console.warn("⚠️ Fragment number scrape failed:", e.message);
		return { status: "unknown", priceTon: null, url: baseUrl };
	}
}

async function scrapeMarketSampleNumbers({ limit = 60 } = {}) {
	const browser = await getBrowser();
	let page = null;
	try {
		page = await browser.newPage();
		await page.setRequestInterception(true);
		page.on("request", (req) => {
			if (["image", "stylesheet", "font", "media"].includes(req.resourceType()))
				req.abort();
			else req.continue();
		});
		await page.setUserAgent(
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
		);

		await page.goto("https://fragment.com/numbers?sort=price_asc&filter=sale", {
			waitUntil: "domcontentloaded",
			timeout: 30000,
		});

		await page
			.waitForSelector("table, .table", { timeout: 10000 })
			.catch(() => {});

		const items = await page.evaluate(() => {
			const out = [];
			const parseTon = (s) => {
				if (!s) return null;
				const m = String(s).match(/([\d,.]+)\s*TON/i);
				if (!m) return null;
				const n = parseFloat(m[1].replace(/,/g, ""));
				return Number.isFinite(n) ? n : null;
			};
			const rows = document.querySelectorAll("table tr");
			for (const r of rows) {
				const txt = r.innerText || "";
				// Support both short and long anonymous numbers (e.g. 8888827 and 88802020288)
				const nMatch = txt.match(/\b888\d{4,10}\b/);
				const p = parseTon(txt);
				if (nMatch && p && p > 0)
					out.push({ numberClean: nMatch[0], price: p });
				if (out.length >= 120) break;
			}
			return out;
		});

		const unique = [];
		const seen = new Set();
		for (const it of items) {
			if (!seen.has(it.numberClean)) {
				seen.add(it.numberClean);
				unique.push(it);
			}
			if (unique.length >= limit) break;
		}
		return unique;
	} catch (e) {
		console.warn("⚠️ Market sample scrape failed:", e.message);
		return [];
	} finally {
		if (page) {
			try {
				await page.close();
			} catch {}
		}
	}
}

function median(values) {
	const v = values
		.filter((x) => Number.isFinite(x))
		.slice()
		.sort((a, b) => a - b);
	if (!v.length) return null;
	const mid = Math.floor(v.length / 2);
	return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

function clamp(n, min, max) {
	return Math.max(min, Math.min(max, n));
}

function estimateWithModel({
	floor,
	marketSample,
	scraped,
	pattern,
	numberClean,
}) {
	const marketPrices = marketSample
		.map((x) => x.price)
		.filter((p) => Number.isFinite(p) && p > 0);
	const marketMedian = median(marketPrices);

	const targetTail = numberClean.slice(3);
	const targetLucky = (targetTail.match(/[78]/g) || []).length;
	const targetUniq = pattern.uniqueCount ?? new Set(targetTail.split("")).size;
	const patternFloor = pattern.patternFloor || floor;

	// find similar-pattern prices in our database for better anchoring
	const dbSimilarPrices = [];
	if (numbersDatabase) {
		for (const [num, price] of numbersDatabase.entries()) {
			const tail = num.slice(3);
			if (tail.length !== targetTail.length) continue;
			
			const lucky = (tail.match(/[78]/g) || []).length;
			const uniq = new Set(tail.split("")).size;
			
			if (lucky === targetLucky && uniq === targetUniq) {
				dbSimilarPrices.push(price);
			}
		}
	}
	const dbPatternMedian = median(dbSimilarPrices);

	const scored = marketSample
		.map((it) => {
			const tail = it.numberClean.slice(3);
			const lucky = (tail.match(/[78]/g) || []).length;
			const uniq = new Set(tail.split("")).size;
			const dist =
				Math.abs(lucky - targetLucky) * 2 + Math.abs(uniq - targetUniq) * 1.5;
			return { ...it, dist };
		})
		.sort((a, b) => a.dist - b.dist);

	const k = scored.slice(0, 12);
	const compMedian = median(k.map((x) => x.price));

	const patternMultiplier = 1 + (pattern.bonus || 0) / 100;
	const base = Math.max(patternFloor, compMedian || marketMedian || floor);

	const anchors = [];
	const weights = [];

	anchors.push(patternFloor);
	weights.push(1.8); // High weight for category floor

	anchors.push(floor);
	weights.push(1.0);

	if (marketMedian) {
		anchors.push(marketMedian);
		weights.push(1.2);
	}
	if (compMedian) {
		anchors.push(compMedian);
		weights.push(2.0); // Boosted comparison weight
	}

	if (dbPatternMedian) {
		anchors.push(dbPatternMedian);
		weights.push(2.5); // Very high weight for historical similarity
	}

	anchors.push(base * patternMultiplier);
	weights.push(1.4);

	if (numbersDatabase?.has(numberClean)) {
		const dbPrice = numbersDatabase.get(numberClean);
		anchors.push(dbPrice);
		weights.push(5.0); // Absolute anchor if exact match
	}

	if (scraped.status === "for_sale" && Number.isFinite(scraped.priceTon)) {
		const clampBase = dbPatternMedian || compMedian || marketMedian || floor;
		anchors.push(clamp(scraped.priceTon, clampBase * 0.7, clampBase * 2.5));
		weights.push(2.2);
	}
	
	if (scraped.status === "on_auction") {
		if (Number.isFinite(scraped.highestBid)) {
			anchors.push(scraped.highestBid);
			weights.push(2.0);
		}
	}

	const expanded = [];
	for (let i = 0; i < anchors.length; i++) {
		const w = Math.round(weights[i] * 10);
		for (let j = 0; j < w; j++) expanded.push(anchors[i]);
	}
	let est = median(expanded) || base * patternMultiplier;

	// Strict enforcement: Estimate must never fall below the Category Pattern Floor
	est = Math.max(est, patternFloor * 1.05); 

	let confidence = 35;
	if (marketMedian) confidence += 10;
	if (dbPatternMedian) confidence += 20;
	if (compMedian) confidence += 15;
	if (scraped.status === "for_sale" || scraped.status === "sold") confidence += 20;
	
	confidence = clamp(confidence, 25, 95);

	const compSpread =
		compMedian && k.length >= 6
			? clamp(
					(Math.max(...k.map((x) => x.price)) -
						Math.min(...k.map((x) => x.price))) /
						compMedian,
					0.1,
					0.5,
				)
			: 0.3;
	const rangePct = clamp(
		0.2 + (1 - confidence / 100) * 0.3 + compSpread * 0.1,
		0.15,
		0.45,
	);

	return {
		est: Math.round(est),
		marketMedian,
		compMedian,
		confidence,
		rangePct,
	};
}

/**
 * Generate full number report
 */
export async function generateNumberReport(input, tonPrice = 5.5) {
	loadNumbersDatabase();

	const parsed = parseNumberLink(input);
	if (!parsed.isValid) {
		throw new Error(
			"Invalid number format. Use: +88880808080 (11 digits) or +8881234 (7 digits)",
		);
	}

	const { number, numberClean } = parsed;
	const formattedNumber = formatDisplayNumber(number);

	// Fetch floor from cache or market service
	let floor = tonPriceCache.get("floor888")?.price;
	if (!floor || floor <= 0) {
		floor = await marketService.get888Stats();
		if (floor)
			tonPriceCache.set("floor888", { price: floor, timestamp: Date.now() });
	}
	if (!floor || floor <= 0) floor = 850;

	// Scrape Fragment for this number
	const scraped = await scrapeFragmentNumber(numberClean);
	const status = scraped.status;
	const priceTon = scraped.priceTon;

	// Check if the number is minted on Fragment
	if (status === "not_found") {
		throw new Error(
			"This number is not yet minted on Fragment. Only numbers minted during the initial 2022 sale can be analyzed.",
		);
	}

	// Pattern analysis (passes the collection floor)
	const pattern = analyzeNumberPattern(numberClean, floor);

	// Fetch Market Momentum from See.tg
	let momentum = null;
	try {
		momentum = await seetgService.getCollectionInfo("anonymous-number");
	} catch (e) {
		console.warn("See.tg momentum fetch failed:", e.message);
	}

	// Market sample for robust estimation
	const marketSample = await scrapeMarketSampleNumbers({ limit: 60 });
	const model = estimateWithModel({
		floor,
		marketSample,
		scraped,
		pattern,
		numberClean,
	});

	const estimated = model.est;
	const rangePct = model.rangePct;
	const lowEst = Math.round(estimated * (1 - rangePct));
	const highEst = Math.round(estimated * (1 + rangePct));

	const vsFloor = floor > 0 ? (estimated / floor - 1) * 100 : 0;
	const gapVsMarket =
		model.marketMedian && model.marketMedian > 0
			? (estimated / model.marketMedian - 1) * 100
			: null;

	const url = `https://fragment.com/number/${numberClean}`;

	let statusDisplay = "NOT LISTED";
	if (status === "for_sale") statusDisplay = "💰 FOR SALE";
	else if (status === "on_auction") statusDisplay = "🔨 ON AUCTION";
	else if (status === "sold") statusDisplay = "NOT LISTED";
	else if (status === "available") statusDisplay = "✨ AVAILABLE";
	else if (status === "not_found") statusDisplay = "❌ NOT FOUND";

	// Check registration via Telegram MTProto
	let registeredText = "⏳ Unknown";
	try {
		const check = await telegramClient.checkPhoneNumber(number);
		registeredText = check.registered ? "✅ Registered" : "❌ Not Active";
	} catch (e) {
		console.warn("⚠️ Telegram registration check failed:", e.message);
		registeredText = "⏳ Service Busy";
	}



	// Fetch History from See.tg
	let history = [];
	try {
		const histData = await seetgService.getGiftHistory("anonymous-number", numberClean);
		if (histData && histData.transfers) {
			history = histData.transfers;
		}
	} catch (e) {
		console.warn("See.tg history fetch failed:", e.message);
	}

	const tonUsd = tonPrice || tonPriceCache.get("price") || 5.5;
	const estUsd = Math.round(estimated * tonUsd);

	// Build report
	let report = "";
	report += `📱 *${formattedNumber}*\n`;
	report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
	report += `🔵 ${statusDisplay}`;
	if (priceTon && (status === "for_sale" || status === "on_auction")) report += `  •  Price: *${formatNumber(priceTon)} TON*`;
	report += `\n`;
	report += `🔗 [Fragment](${url})\n\n`;

	// Merge and deduplicate History (See.tg + Scraped Fragment)
	let combinedHistory = [];
	
	// Add See.tg history
	if (history && history.length > 0) {
		history.forEach(t => {
			combinedHistory.push({
				price: t.price,
				date: t.date ? new Date(t.date).toLocaleDateString() : "Unknown",
				source: "See.tg"
			});
		});
	}

	// Add Scraped history if not already present
	if (scraped.history && scraped.history.length > 0) {
		scraped.history.forEach(s => {
			const exists = combinedHistory.some(c => Math.abs((c.price || 0) - (s.price || 0)) < 0.1);
			if (!exists) {
				combinedHistory.push({
					price: s.price,
					date: s.date,
					source: "Fragment"
				});
			}
		});
	}

	// Extract last sale for Market Snapshot
	let lastSalePrice = scraped.lastSale;
	let lastSaleDate = scraped.lastSaleDate;
	
	if (!lastSalePrice && combinedHistory.length > 0) {
		const lastValid = combinedHistory[0];
		lastSalePrice = lastValid.price;
		lastSaleDate = lastValid.date;
	}

	report += `――――― 📊 *MARKET SNAPSHOT* ―――――\n`;
	report += `▸ Status: ${statusDisplay}\n`;
	if (lastSalePrice) {
		const dateStr = lastSaleDate ? ` (${lastSaleDate})` : "";
		report += `▸ Last Sale: *${formatNumber(lastSalePrice)} TON*${dateStr} 🏆\n`;
	}
	if (scraped.owner) {
		const shortAddr = `${scraped.owner.substring(0, 8)}...${scraped.owner.slice(-6)}`;
		report += `▸ Owner: \`${shortAddr}\`\n`;
	}
	report += `\n`;

	report += `――――― 💎 *VALUE ESTIMATE* ―――――\n`;
	report += `▸ 🏷️  Fair Value: *~${formatNumber(estimated)} TON*\n`;
	report += `▸ 💵  ~$${formatNumber(estUsd)}\n`;
	report += `▸ 📐 Range: ${formatNumber(lowEst)} — ${formatNumber(highEst)} TON (±${Math.round(rangePct * 100)}%)\n`;
	report += `▸ 📊 vs Floor (+888): *${vsFloor >= 0 ? "+" : ""}${vsFloor.toFixed(0)}%*\n`;
	if (Number.isFinite(gapVsMarket))
		report += `▸ 📊 Gap vs Market Median: *${gapVsMarket >= 0 ? "+" : ""}${gapVsMarket.toFixed(0)}%*\n\n`;
	else report += `\n`;

	report += `――――― 📈 *MARKET MOMENTUM* ―――――\n`;
	report += `▸ 💰 Floor: *${formatNumber(floor)} TON*\n`;

	if (momentum) {
		const c24 = momentum.floorChange24h;
		const c7d = momentum.floorChange7d;
		if (c24 != null)
			report += `▸ 🕒 24h Change: *${c24 > 0 ? "📈 +" : "📉 "}${c24.toFixed(2)}%*\n`;
		if (c7d != null)
			report += `▸ 📅 7d Change: *${c7d > 0 ? "📈 +" : "📉 "}${c7d.toFixed(2)}%*\n`;
		if (momentum.volume24h)
			report += `▸ 💹 24h Volume: *${formatNumber(Math.round(momentum.volume24h / 1e9))} TON*\n`;
	}

	report += `▸ 📊 Confidence: *${model.confidence >= 70 ? "High" : model.confidence >= 50 ? "Medium" : "Low"}* (${model.confidence}%)\n\n`;

	if (scraped.owner) {
		report += `――――― 👥 *HOLDER INSIGHTS* ―――――\n`;
		report += `▸ 📱 Registered: ${registeredText}\n`;
		report += `▸ 👤 Owner: \`${scraped.owner.substring(0, 8)}...${scraped.owner.slice(-6)}\`\n`;
		report += `\n`;
	} else {
		report += `――――― 👥 *HOLDER INSIGHTS* ―――――\n`;
		report += `▸ 📱 Registered: ${registeredText}\n\n`;
	}

	if (history && history.length > 0) {
		report += `――――― 📜 *HISTORY* ―――――\n`;
		const maxH = Math.min(history.length, 3);
		for (let i = 0; i < maxH; i++) {
			const tr = history[i];
			const date = tr.date ? new Date(tr.date).toLocaleDateString() : "Unknown";
			const price = tr.price ? ` @ ${formatNumber(tr.price)} TON` : "";
			report += `▸ ${date}${price}\n`;
		}
		report += `\n`;
	}

	report += `――――― 🎰 *NUMBER PATTERN* ―――――\n`;
	report += `▸ Type: *${pattern.label}*\n`;
	report += `▸ Pattern Floor: *${formatNumber(pattern.patternFloor)} TON*\n`;
	if (pattern.bonus > 0) report += `▸ Bonus: +${pattern.bonus}%\n`;
	if (Number.isFinite(pattern.score))
		report += `▸ Pattern Score: *${pattern.score}/100*\n`;
	report += `\n`;

	report += `――――― 🧠 *EXPERT NOTE* ―――――\n`;
	if (pattern.type === "Grail") {
		report += `💎 **GRAIL ALERT:** Highest possible collector tier. This pattern is exceptionally rare and price performance is top-tier.\n`;
	} else if (pattern.type === "Elite") {
		report += `🏆 **ELITE PATTERN:** Significant vanity premium. This number holds value independent of the collection floor.\n`;
	} else if (pattern.type === "Premium") {
		report += `⭐ **PREMIUM:** Solid vanity pattern. Better liquidity and higher floor support compared to standard numbers.\n`;
	} else {
		report += `Standard Anonymous Number. Value primarily driven by collection floor. Limited vanity premium.\n`;
	}

	report += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
	report += `⚡ _Intelligence by @iFragmentBot_  •  TON: $${tonUsd.toFixed(2)}\n`;
	report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

	return {
		report,
		number,
		formattedNumber,
		numberClean,
		priceTon: priceTon || estRes.est,
		estimatedValue: estRes.est,
		floor,
		status,
		pattern: pattern.type,
		verdict: pattern.type.toUpperCase(),
		vsFloor,
		momentum: {
			change24h: momentum?.floorChange24h || 0,
			volume24h: momentum?.volume24h ? Math.round(momentum.volume24h / 1e9) : 0,
		},
		owner: scraped.owner,
		url,
	};
}
