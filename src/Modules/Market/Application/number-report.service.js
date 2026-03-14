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
 * Supports: fragment.com/number/8881234567890, +8881234567890, 8881234567890
 */
export function parseNumberLink(input) {
	const raw = String(input).trim();
	if (!raw) return { isValid: false };

	// fragment.com/number/888XXXXXXXXXX
	const fragmentMatch = raw.match(
		/(?:fragment\.com\/number\/|t\.me\/number\/)(\d+)/i,
	);
	if (fragmentMatch) {
		const num = fragmentMatch[1];
		// Valid anonymous numbers: short (888 + 4 = 7 digits) or standard (888 + 8 = 11 digits)
		if (num.startsWith("888") && (num.length === 7 || num.length === 11)) {
			return {
				number: `+${num}`,
				numberClean: num,
				isValid: true,
			};
		}
	}

	// Raw: +8881234567890 or 8881234567890
	const clean = raw.replace(/[\s\-+]/g, "");
	// Allow short 7-digit total: 888 + 4 digits OR standard 11-digit
	if (/^888(\d{4}|\d{8})$/.test(clean)) {
		return {
			number: `+${clean}`,
			numberClean: clean,
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
			// For very short numbers (e.g. 4 digits after 888) keep readability
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
	const d = tail.split("").map(Number);
	const uniqueCount = new Set(d).size;

	// Ultra-short numbers (888 + 4 digits)
	if (tail.length <= 4) {
		patternFloor = Math.max(patternFloor, 100000);
		const lucky = (tail.match(/[78]/g) || []).length;
		const bonus = 220 + (uniqueCount <= 2 ? 80 : 0) + (lucky >= 2 ? 30 : 0);
		return {
			type: "UltraShort",
			bonus,
			label: `Ultra-Short (${tail.length} digits)`,
			score: 99,
			uniqueCount,
			patternFloor,
		};
	}

	let type = "Standard";
	let label = "Standard";
	let bonus = 0;
	let score = 40;

	// 8-digit specific pattern recognition (GetGems Categories)
	if (tail.length === 8) {
		const isPalindrome = tail === tail.split("").reverse().join("");
		const numVal = parseInt(tail, 10);

		if (uniqueCount === 1) {
			type = "Repdigit";
			label = `Solid 8 (XXXXXXXX)`;
			bonus = 300;
			score = 99;
			patternFloor = Math.max(patternFloor, 200000); // Massive premium
		} else if (/^.(.)\1{6}$/.test(tail)) {
			// X YYYYYYY
			type = "Ending 7";
			label = `7 Ending Digits (X YYYYYYY)`;
			bonus = 150;
			score = 90;
			patternFloor = Math.max(patternFloor, 45000);
		} else if (/^(.)\1{3}(.)\2{3}$/.test(tail)) {
			// XXXX YYYY
			type = "Halves";
			label = `Halves (XXXX YYYY)`;
			bonus = 120;
			score = 88;
			patternFloor = Math.max(patternFloor, 25000);
		} else if (/^(.{2})\1{3}$/.test(tail)) {
			// XY XY XY XY
			type = "Alternating";
			label = `Alternating Pairs (XY XY XY XY)`;
			bonus = 100;
			score = 85;
			patternFloor = Math.max(patternFloor, 20000);
		} else if (
			/^(.)\1(.)\2(.)\3(.)\4$/.test(tail) &&
			new Set([d[0], d[2], d[4], d[6]]).size <= 2
		) {
			// e.g., XX YY XX YY
			type = "Pairs";
			label = `Double Pairs (XX YY XX YY)`;
			bonus = 90;
			score = 84;
			patternFloor = Math.max(patternFloor, 15000);
		} else if (/^(.{4})\1$/.test(tail)) {
			// ABCD ABCD
			type = "Repeated";
			label = `Repeated Half (ABCD ABCD)`;
			bonus = 85;
			score = 82;
			patternFloor = Math.max(patternFloor, 12000);
		} else if (/^(.)\1{2}(.)\2\1{3}$/.test(tail)) {
			// XXX YY XXX
			type = "Sandwich";
			label = `Sandwich (XXX YY XXX)`;
			bonus = 80;
			score = 80;
			patternFloor = Math.max(patternFloor, 10000);
		} else if (isPalindrome) {
			type = "Palindrome";
			label = `Palindrome`;
			bonus = 70;
			score = 78;
			patternFloor = Math.max(patternFloor, 8000);
		} else if (numVal < 1000) {
			// 0000 0XXX
			type = "1K Club";
			label = `1K Club (00000XXX)`;
			bonus = 200;
			score = 95;
			patternFloor = Math.max(patternFloor, 50000);
		} else if (numVal < 10000) {
			// 0000 XXXX
			type = "10K Club";
			label = `10K Club (0000XXXX)`;
			bonus = 100;
			score = 85;
			patternFloor = Math.max(patternFloor, 15000);
		} else if (numVal < 100000) {
			// 000 XXXXX
			type = "100K Club";
			label = `100K Club (000XXXXX)`;
			bonus = 40;
			score = 65;
			patternFloor = Math.max(patternFloor, 2500);
		}
	}

	// Checking max consecutive digits as a fallback for 8-digit and others (if not overridden by above strict patterns)
	if (type === "Standard") {
		const maxConsecutive = Math.max(
			...(tail.match(/(.)\1*/g) || []).map((s) => s.length),
		);
		if (maxConsecutive >= 3 && uniqueCount > 1) {
			type = "Repdigit";
			label = `Repeating ${maxConsecutive} Digits`;
			bonus = maxConsecutive * 15;
			score = 65 + maxConsecutive * 5;

			if (maxConsecutive === 3) patternFloor = Math.max(patternFloor, 3600);
			else if (maxConsecutive === 4)
				patternFloor = Math.max(patternFloor, 12000);
			else if (maxConsecutive === 5)
				patternFloor = Math.max(patternFloor, 35000);
			else if (maxConsecutive >= 6)
				patternFloor = Math.max(patternFloor, 150000);
		}
	}

	// Sequence checking (e.g. 12345678)
	if (type === "Standard") {
		let isSeq = true;
		for (let i = 1; i < d.length; i++) {
			if (d[i] !== d[i - 1] + 1 && d[i] !== d[i - 1] - 1) {
				isSeq = false;
				break;
			}
		}
		if (isSeq && d.length >= 4) {
			type = "Sequence";
			label = "Sequence";
			bonus = 50;
			score = 80;
			patternFloor = Math.max(patternFloor, 5000);
		}
	}

	if (type === "Standard") {
		const lucky7 = (tail.match(/7/g) || []).length;
		const lucky8 = (tail.match(/8/g) || []).length;
		const luckyCount = lucky7 + lucky8;
		if (luckyCount >= 4) {
			type = "Lucky";
			patternFloor = Math.max(patternFloor, luckyCount >= 5 ? 8000 : 3500);
			bonus = 25 + luckyCount * 5;
			label = `Lucky (${lucky7}×7 ${lucky8}×8)`;
			score = 65 + Math.min(25, luckyCount * 3);
		} else {
			const n = parseInt(tail, 10);
			if (n % 1000 === 0 && n > 0) {
				type = "Round";
				bonus = 40;
				label = "Round number (Ends in 000)";
				score = 70;
				patternFloor = Math.max(patternFloor, 3000);
			} else if (uniqueCount <= 3) {
				type = "Premium";
				bonus = 30;
				label = `Low-Unique (${uniqueCount} digits)`;
				score = 72;
				patternFloor = Math.max(patternFloor, 3500);
			}
		}
	}

	return { type, bonus, label, score, uniqueCount, patternFloor };
}

/**
 * HTTP scrape Fragment number page
 */
async function scrapeFragmentNumber(numberClean) {
	const url = `https://fragment.com/number/${numberClean}`;
	try {
		const payload = await scraplingService.scraplingFetchFragment(numberClean, {
			type: "number",
			timeoutMs: 30000,
		});

		if (!payload || !payload.html) {
			return {
				status: "unknown",
				priceTon: null,
				highestBid: null,
				minBid: null,
				url,
			};
		}

		if (payload.status === 404) {
			return { status: "not_found", priceTon: null, bidHistory: [] };
		}

		const html = payload.html;

		let status = "unknown";
		const statusMatch = html.match(
			/tm-section-header-status[^>]*>\s*([^<]+)\s*</i,
		);
		if (statusMatch) {
			const s = statusMatch[1].trim().toLowerCase();
			if (s.includes("sold")) status = "sold";
			else if (s.includes("auction")) status = "on_auction";
			else if (s.includes("sale")) status = "for_sale";
			else if (s.includes("available")) status = "available";
		} else {
			if (/sold/i.test(html)) status = "sold";
			else if (/auction/i.test(html)) status = "on_auction";
			else if (/for sale|sale/i.test(html)) status = "for_sale";
			else if (/available/i.test(html)) status = "available";
		}

		const priceMatches = [
			...html.matchAll(/icon-ton">([\d,]+(?:\.\d+)?)<\/div>/g),
		];
		const prices = priceMatches
			.map((m) => safeNum(m[1], null))
			.filter((p) => Number.isFinite(p) && p > 0);
		let priceTon = null;
		if (prices.length > 0) priceTon = prices[0];

		const highestBid =
			status === "on_auction" && prices.length >= 1 ? prices[0] : null;
		const minBid =
			status === "on_auction" && prices.length >= 3 ? prices[2] : null;

		return { status, priceTon, highestBid, minBid, url };
	} catch (e) {
		console.warn("⚠️ Fragment number scrape failed:", e.message);
		return {
			status: "unknown",
			priceTon: null,
			highestBid: null,
			minBid: null,
			url: `https://fragment.com/number/${numberClean}`,
		};
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
	weights.push(1.5); // Add category floor as anchor
	anchors.push(floor);
	weights.push(1.0);
	if (marketMedian) {
		anchors.push(marketMedian);
		weights.push(1.2);
	}
	if (compMedian) {
		anchors.push(compMedian);
		weights.push(1.6);
	}
	anchors.push(base * patternMultiplier);
	weights.push(1.4);

	if (numbersDatabase?.has(numberClean)) {
		const dbPrice = numbersDatabase.get(numberClean);
		anchors.push(dbPrice);
		weights.push(3.0);
	}

	if (scraped.status === "for_sale" && Number.isFinite(scraped.priceTon)) {
		const clampBase = compMedian || marketMedian || floor;
		anchors.push(clamp(scraped.priceTon, clampBase * 0.6, clampBase * 3.5));
		weights.push(2.2);
	}
	if (scraped.status === "on_auction") {
		if (Number.isFinite(scraped.highestBid)) {
			anchors.push(scraped.highestBid);
			weights.push(2.0);
		}
		if (Number.isFinite(scraped.minBid)) {
			anchors.push(scraped.minBid);
			weights.push(1.4);
		}
	}

	const expanded = [];
	for (let i = 0; i < anchors.length; i++) {
		const w = Math.round(weights[i] * 10);
		for (let j = 0; j < w; j++) expanded.push(anchors[i]);
	}
	let est = median(expanded) || base * patternMultiplier;

	// Strict enforcement: Estimate must never fall below the Category Pattern Floor
	est = Math.max(est, patternFloor * 1.05); // Add 5% premium above floor for specific instance

	let confidence = 35;
	if (marketMedian) confidence += 15;
	if (compMedian) confidence += 20;
	if (scraped.status === "for_sale" && scraped.priceTon) confidence += 20;
	if (scraped.status === "on_auction" && (scraped.highestBid || scraped.minBid))
		confidence += 15;
	confidence = clamp(confidence, 20, 90);

	const compSpread =
		compMedian && k.length >= 6
			? clamp(
					(Math.max(...k.map((x) => x.price)) -
						Math.min(...k.map((x) => x.price))) /
						compMedian,
					0.15,
					0.55,
				)
			: 0.35;
	const rangePct = clamp(
		0.22 + (1 - confidence / 100) * 0.25 + compSpread * 0.15,
		0.22,
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

	// Throw error if the number is not minted on Fragment
	if (status === "not_found") {
		throw new Error("This number is not currently minted on Fragment.");
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

	let statusDisplay = "❓ Unknown";
	if (status === "for_sale") statusDisplay = "💰 FOR SALE";
	else if (status === "on_auction") statusDisplay = "🔨 ON AUCTION";
	else if (status === "sold") statusDisplay = "✅ SOLD";
	else if (status === "available") statusDisplay = "✨ Available";
	else if (status === "not_found") statusDisplay = "❌ Not Found";

	// Check registration (optional - may fail if no MTProto)
	let registeredText = "⏳ Unknown";
	try {
		const { checkPhoneNumber } = await import(
			"../../Shared/Infra/Telegram/telegram.client.js"
		);
		const reg = await checkPhoneNumber(number);
		registeredText = reg.registered ? "✅ Yes" : "❌ No";
	} catch {
		registeredText = "⏳ N/A";
	}

	const tonUsd = tonPrice || tonPriceCache.get("price") || 5.5;
	const estUsd = Math.round(estimated * tonUsd);

	// Build report (without RESOURCES & LINKS section)
	let report = "";
	report += `📱 *${formattedNumber}*\n`;
	report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
	report += `🔵 ${statusDisplay}`;
	if (priceTon) report += `  •  Price: *${formatNumber(priceTon)} TON*`;
	report += `\n`;
	report += `🔗 [Fragment](${url})\n\n`;

	report += `――――― 💎 *VALUE ESTIMATE* ―――――\n`;
	report += `▸ 🏷️  Fair Value: *~${formatNumber(estimated)} TON*\n`;
	report += `▸ 💵  ~$${formatNumber(estUsd)}\n`;
	report += `▸ 📐 Range: ${formatNumber(lowEst)} — ${formatNumber(highEst)} TON (±${Math.round(rangePct * 100)}%)\n`;
	report += `▸ 📊 vs Floor (+888): *${vsFloor >= 0 ? "+" : ""}${vsFloor.toFixed(0)}%*\n`;
	if (Number.isFinite(gapVsMarket))
		report += `▸ 📊 Gap vs Market Median: *${gapVsMarket >= 0 ? "+" : ""}${gapVsMarket.toFixed(0)}%*\n\n`;
	else report += `\n`;

	report += `――――― 📈 *MARKET MOMENTUM* ―――――\n`;
	report += `▸ 🏛️ Collection: Anonymous Telegram Numbers (+888)\n`;
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

	if (model.marketMedian)
		report += `▸ 📊 Market Median (sample): *${formatNumber(Math.round(model.marketMedian))} TON*\n`;
	if (model.compMedian)
		report += `▸ 🧩 Comparable Median: *${formatNumber(Math.round(model.compMedian))} TON*\n`;
	report += `▸ 📊 Confidence: *${model.confidence >= 70 ? "High" : model.confidence >= 50 ? "Medium" : "Low"}* (${model.confidence}%)\n`;
	report += `▸ 📊 Total Supply: 136,566 (Sold Out Dec 2022)\n`;
	report += `▸ 🔥 Record Sale: +888 8 888 888 @ 300,000 TON\n\n`;

	report += `――――― 👥 *HOLDER INSIGHTS* ―――――\n`;
	if (scraped.owner) {
		const shortAddr = `${scraped.owner.substring(0, 8)}...${scraped.owner.slice(-6)}`;
		report += `▸ 👤 Current Owner: \`${shortAddr}\`\n`;
	}
	report += `▸ 📱 Registered: ${registeredText}\n`;
	report += `▸ 🏛️ Status: ${statusDisplay}\n\n`;

	report += `――――― 🎰 *NUMBER PATTERN* ―――――\n`;
	report += `▸ Type: *${pattern.label}*\n`;
	report += `▸ Pattern Floor: *${formatNumber(pattern.patternFloor)} TON*\n`;
	if (pattern.bonus > 0) report += `▸ Bonus: +${pattern.bonus}%\n`;
	if (Number.isFinite(pattern.score))
		report += `▸ Pattern Score: *${pattern.score}/100*\n`;
	report += `\n`;

	report += `――――― 🧠 *EXPERT NOTE* ―――――\n`;
	if (pattern.type === "Standard") {
		report += `Standard 10-digit pattern. Value aligned with floor. Consider vanity/lucky digits for premium upside.\n`;
	} else {
		report += `${pattern.label} pattern adds value. Strong demand from collectors.\n`;
	}

	report += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
	report += `⚡ _Intelligence by @iFragmentBot_  •  TON: $${tonUsd.toFixed(2)}\n`;
	report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

	return {
		report,
		number,
		formattedNumber,
		numberClean,
		priceTon: priceTon || estimated,
		estimatedValue: estimated,
		floor,
		status,
		pattern: pattern.type,
		verdict:
			pattern.type === "Standard"
				? "STANDARD"
				: pattern.type === "Repdigit"
					? "GRAIL"
					: pattern.type === "Lucky"
						? "LUCKY"
						: "PREMIUM",
		vsFloor,
		registeredText,
		momentum: {
			change24h: momentum?.floorChange24h || 0,
			volume24h: momentum?.volume24h ? Math.round(momentum.volume24h / 1e9) : 0,
		},
		owner: scraped.owner,
		url,
	};
}
