/**
 * Number Report Service
 * +888 Anonymous Numbers (Collectible Numbers) valuation and report generation
 */

import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { tonPriceCache } from "../../../Shared/Infra/Cache/cache.service.js";
import * as scraplingService from "../../../Shared/Infra/Scraping/scrapling.service.js";
import * as telegramClient from "../../../Shared/Infra/Telegram/telegram.client.js";
import { getBrowser } from "../../../Shared/UI/Components/card-generator.component.js";
import * as marketService from "./market.service.js";
import * as portfolioService from "./portfolio.service.js";

// Global cached numbers CSV data
let numbersDatabase = null;

const ANON_NUMBER_COLLECTION =
	"EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N";

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
						// Strip entirely all non-digit and non-dot chars
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
 * Parse number link
 */
export function parseNumberLink(input) {
	const raw = String(input).trim();
	if (!raw) return { isValid: false };

	let clean = raw.replace(/[\s\-+]/g, "");
	const linkMatch = raw.match(
		/(?:fragment\.com\/number\/|t\.me\/number\/)(\d+)/i,
	);
	if (linkMatch) {
		clean = linkMatch[1];
	}

	if (clean.startsWith("888888")) {
		clean = clean.slice(3);
	}

	let finalNumber = null;
	if (/^888(\d{4}|\d{8})$/.test(clean)) {
		finalNumber = clean;
	} else if (/^(\d{4}|\d{8})$/.test(clean)) {
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
 * Format for display
 */
export function formatDisplayNumber(number) {
	if (!number) return "—";
	const clean = String(number).replace(/\D/g, "");
	if (clean.startsWith("888") && clean.length >= 7) {
		const rest = clean.slice(3);
		if (rest.length <= 10) {
			if (rest.length === 8) {
				return `+888 ${rest.slice(0, 4)} ${rest.slice(4)}`;
			}
			if (rest.length <= 4) return `+888 ${rest}`;
			const chunks = rest.match(/.{1,3}/g) || [rest];
			return `+888 ${chunks.join(" ")}`;
		}
	}
	return number;
}

/**
 * Analyze pattern
 */
function analyzeNumberPattern(numberClean, globalFloor = 850) {
	const digits = numberClean.replace(/\D/g, "");
	const tail = digits.slice(3);

	let patternFloor = globalFloor;
	let bonus = 0;
	let score = 40;
	let label = "Standard";
	let tier = "Standard";

	const d = tail.split("").map(Number);
	const uniqueCount = new Set(d).size;
	const luckyCount = (tail.match(/[78]/g) || []).length;
	const consecutiveCount = Math.max(
		...(tail.match(/(.)\1*/g) || []).map((s) => s.length),
	);

	if (tail.length <= 4) {
		patternFloor = 60000;
		score = 95;
		const startsWith8 = tail.startsWith("8");
		const allLucky = tail.split("").every((x) => x === "7" || x === "8");

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
		if (tail.includes("777") || tail.includes("888")) {
			bonus += 100;
			patternFloor *= 1.5;
		}
		return { type: tier, bonus, label, score, uniqueCount, patternFloor };
	}

	if (tail.length === 8) {
		const numVal = parseInt(tail, 10);
		if (uniqueCount === 1) {
			tier = "Grail";
			label = "Solid 8 (XXXXXXXX)";
			bonus = 450;
			score = 99;
			patternFloor = 150000;
		} else if (/^.(.)\1{6}$/.test(tail)) {
			tier = "Elite";
			label = "7-Ending Stream";
			bonus = 250;
			score = 92;
			patternFloor = 45000;
		} else if (/^(.)\1{3}(.)\2{3}$/.test(tail)) {
			tier = "Elite";
			label = "Quad-Blocks (XXXX YYYY)";
			bonus = 180;
			patternFloor = 25000;
		} else if (
			/^(01234567|12345678|23456789|98765432|87654321|76543210)$/.test(tail)
		) {
			tier = "Elite";
			label = "Perfect Ladder";
			bonus = 220;
			patternFloor = 35000;
		} else if (tail === tail.split("").reverse().join("")) {
			tier = "Premium";
			label = "Golden Radar (8-Digit)";
			bonus = 140;
			patternFloor = 15000;
		} else if (numVal < 1000) {
			tier = "Elite";
			label = "1K Club (+888 0000 0)";
			bonus = 200;
			patternFloor = 50000;
		} else if (numVal < 10000) {
			tier = "Premium";
			label = "10K Club (+888 0000)";
			bonus = 120;
			patternFloor = 20000;
		} else if (consecutiveCount >= 5) {
			tier = "Premium";
			label = `Consecutive ${consecutiveCount} Digits`;
			bonus = consecutiveCount * 25;
			patternFloor =
				consecutiveCount === 5
					? 12000
					: consecutiveCount === 6
						? 45000
						: 100000;
		} else if (luckyCount >= 5) {
			tier = "Premium";
			label = `Super Lucky (${luckyCount}x 7/8)`;
			bonus = luckyCount * 15;
			patternFloor = Math.max(patternFloor, luckyCount * 2000);
		} else if (uniqueCount <= 2) {
			tier = "Premium";
			label = "Double-Digit Only";
			bonus = 80;
			patternFloor = 8000;
		} else if (tail.endsWith("0000")) {
			tier = "Premium";
			label = "Quad-Zero Ending";
			bonus = 100;
			patternFloor = 12000;
		}
	}

	score =
		tier === "Grail"
			? 98
			: tier === "Elite"
				? 90
				: tier === "Premium"
					? 75
					: 40;

	// Add slight variance based on digits
	if (uniqueCount <= 2) score += 5;
	if (luckyCount >= 4) score += 3;
	score = clamp(score, 10, 99);

	const rarityRank =
		score >= 95
			? "Top 0.1%"
			: score >= 90
				? "Top 1%"
				: score >= 80
					? "Top 5%"
					: score >= 60
						? "Top 15%"
						: "Top 40%";

	return {
		type: tier,
		bonus,
		label,
		score,
		uniqueCount,
		patternFloor,
		rarityRank,
	};
}

/**
 * Scrape Fragment
 */
async function scrapeFragmentNumber(numberClean) {
	const baseUrl = `https://fragment.com/number/${numberClean}`;
	try {
		const payload = await scraplingService.scraplingFetchFragment(numberClean, {
			type: "number",
			url: baseUrl,
			wait: ".tm-section-header-status",
			timeoutMs: 30000,
		});

		if (!payload || !payload.html)
			return { status: "unknown", priceTon: null, url: baseUrl };

		const html = payload.html;
		if (
			html.includes("tm-empty-placeholder") &&
			(html.includes("Address unavailable") ||
				html.includes("Number not found"))
		) {
			return { status: "not_found", priceTon: null, url: baseUrl };
		}

		let status = "available";
		if (
			html.includes('"status":"sold"') ||
			html.includes(">Sold<") ||
			html.includes("tm-status-sold") ||
			html.includes("tm-status-resale")
		)
			status = "sold";
		else if (
			html.includes(">Unavailable<") ||
			html.includes("tm-status-unavail")
		)
			status = "available";
		else if (
			html.includes(">On auction<") ||
			html.includes("tm-status-on-auction")
		)
			status = "on_auction";
		else if (html.includes(">For sale<") || html.includes("tm-status-for-sale"))
			status = "for_sale";
		else if (html.includes(">Sold<") || html.includes("status-sold"))
			status = "sold";

		const priceMatches = [
			...html.matchAll(/icon-ton">([\d,]+(?:\.\d+)?)<\/div>/g),
		];
		const prices = priceMatches
			.map((m) => safeNum(m[1], null))
			.filter((p) => p > 0);
		const priceTon = prices.length > 0 ? prices[0] : null;

		const ownerMatch =
			html.match(/tm-wallet-address">([\s\S]*?)<\/span>/) ||
			html.match(/address\/(\w+)/) ||
			html.match(/tm-address">(\w+)/);
		let owner = ownerMatch
			? ownerMatch[1].replace(/<[^>]*>/g, "").trim()
			: null;
		if (owner && !/^[A-Za-z0-9_-]+$/.test(owner)) {
			owner = owner.replace(/\s+/g, "");
			const simpleMatch = owner.match(/[A-Za-z0-9_-]{10,}/);
			if (simpleMatch) owner = simpleMatch[0];
		}

		const scrapedHistory = [];
		const gridRowMatches = html.matchAll(
			/tm-table-grid-row">([\s\S]*?)<\/div>\s*<\/div>/g,
		);
		for (const row of gridRowMatches) {
			const rowHtml = row[1];
			const pMatch = rowHtml.match(/icon-ton">([\d,]+(?:\.\d+)?)<\/div>/);
			const dMatch = rowHtml.match(/tm-datetime[^>]*>([\s\S]*?)<\/div>/);
			const aMatch = rowHtml.match(/tm-char-type">([\s\S]*?)<\/div>/);
			const action = aMatch ? aMatch[1].trim().toLowerCase() : "";
			if (
				pMatch &&
				(action.includes("sale") ||
					action.includes("auction") ||
					action.includes("transfer") ||
					action.includes("sold"))
			) {
				scrapedHistory.push({
					price: safeNum(pMatch[1], null),
					date: dMatch ? dMatch[1].trim() : "Recent",
					source: "Fragment",
				});
			}
		}

		const lastSale = scrapedHistory.length > 0 ? scrapedHistory[0].price : null;
		const lastSaleDate =
			scrapedHistory.length > 0 ? scrapedHistory[0].date : null;

		return {
			status,
			priceTon,
			owner,
			lastSale,
			lastSaleDate,
			history: scrapedHistory,
			url: baseUrl,
			highestBid: status === "on_auction" ? prices[0] : null,
		};
	} catch (e) {
		console.warn("⚠️ Fragment number scrape failed:", e.message);
		return { status: "unknown", priceTon: null, url: baseUrl };
	}
}

/**
 * Discovery on GetGems
 */
async function findNFTAddressByNumber(numberClean) {
	const formatted = formatDisplayNumber(`+${numberClean}`);
	const searchUrl = `https://getgems.io/collection/${ANON_NUMBER_COLLECTION}?q=${encodeURIComponent(formatted)}`;
	try {
		const payload = await scraplingService.scraplingFetchFragment(numberClean, {
			type: "number",
			url: searchUrl,
			wait: ".nft-card",
			timeoutMs: 30000,
		});
		if (!payload || !payload.html) return null;
		const nftMatch = payload.html.match(/\/nft\/(EQ[A-Za-z0-9_-]{46})/);
		return nftMatch ? nftMatch[1] : null;
	} catch (_e) {
		return null;
	}
}

/**
 * Market Data from GetGems - Pulled from Collection Page (Pulse)
 */
async function fetchGetGemsCollectionPulse() {
	const url = `https://getgems.io/collection/${ANON_NUMBER_COLLECTION}`;
	try {
		const payload = await scraplingService.scraplingFetchFragment("pulse", {
			type: "custom",
			url: url,
			wait: ".collection-pulse, .stats-list",
			timeoutMs: 30000,
		});
		if (!payload || !payload.html) return null;

		const html = payload.html;
		const ownersMatch = html.match(/Owners[\s\S]*?([\d,.]+K?)/i);
		const itemsMatch = html.match(/Items[\s\S]*?([\d,.]+K?)/i);
		const volume7dMatch = html.match(/7d volume[\s\S]*?([\d,.]+)\s*TON/i);
		return {
			owners: ownersMatch ? ownersMatch[1] : null,
			items: itemsMatch ? itemsMatch[1] : null,
			volume7d: volume7dMatch ? safeNum(volume7dMatch[1], null) : null,
			url,
		};
	} catch (_e) {
		return null;
	}
}

/**
 * Market Data from GetGems - Pulled from NFT Page
 */
async function fetchGetGemsMarketData(nftAddress) {
	if (!nftAddress) return null;
	const url = `https://getgems.io/collection/${ANON_NUMBER_COLLECTION}/${nftAddress}`;
	try {
		const payload = await scraplingService.scraplingFetchFragment(nftAddress, {
			type: "custom",
			url: url,
			wait: ".nft-page, .tm-section",
			timeoutMs: 30000,
		});
		if (!payload || !payload.html) return null;
		const html = payload.html;

		const isRestricted =
			html.includes("Scam") ||
			html.includes("Warning") ||
			html.includes("tm-status-restricted");
		const priceMatch =
			html.match(/Price[\s\S]*?([\d,.]+)\s*TON/i) ||
			html.match(/icon-ton">([\d,]+(?:\.\d+)?)<\/div>/);
		const lastSaleMatch = html.match(/Last sale[\s\S]*?([\d,.]+)\s*TON/i);

		// Extract owner from GetGems if possible
		const ownerMatch =
			html.match(/Owner[\s\S]*?address\/([A-Za-z0-9_-]{40,})/i) ||
			html.match(/tm-wallet-address">([A-Za-z0-9_-]{40,})/);
		const owner = ownerMatch ? ownerMatch[1] : null;

		return {
			priceTon: priceMatch ? safeNum(priceMatch[1], null) : null,
			lastSale: lastSaleMatch ? safeNum(lastSaleMatch[1], null) : null,
			isRestricted,
			owner,
			url,
		};
	} catch (_e) {
		return null;
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
		await page.goto("https://fragment.com/numbers?sort=price_asc&filter=sale", {
			waitUntil: "domcontentloaded",
			timeout: 30000,
		});
		const items = await page.evaluate(() => {
			const out = [];
			const parseTon = (s) => {
				const m = String(s).match(/([\d,.]+)\s*TON/i);
				if (!m) return null;
				return parseFloat(m[1].replace(/,/g, ""));
			};
			const rows = document.querySelectorAll("table tr");
			for (const r of rows) {
				const txt = r.innerText || "";
				const nMatch = txt.match(/\b888\d{4,10}\b/);
				const p = parseTon(txt);
				if (nMatch && p && p > 0)
					out.push({ numberClean: nMatch[0], price: p });
			}
			return out;
		});
		return items.slice(0, limit);
	} catch (_e) {
		return [];
	} finally {
		if (page) await page.close();
	}
}

function median(values) {
	const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
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
	const marketPrices = marketSample.map((x) => x.price).filter((p) => p > 0);
	const marketMedian = median(marketPrices);
	const patternFloor = pattern.patternFloor || floor;
	const scored = marketSample
		.map((it) => {
			const dist = Math.abs(it.numberClean.length - numberClean.length) * 2;
			return { ...it, dist };
		})
		.sort((a, b) => a.dist - b.dist);
	const k = scored.slice(0, 12);
	const compMedian = median(k.map((x) => x.price));
	const patternMultiplier = 1 + (pattern.bonus || 0) / 100;
	let est =
		Math.max(patternFloor, compMedian || marketMedian || floor) *
		patternMultiplier;
	est = Math.max(est, patternFloor * 1.05);

	let confidence = 35;
	if (marketMedian) confidence += 10;
	if (compMedian) confidence += 15;
	if (scraped.status === "for_sale" || scraped.status === "sold")
		confidence += 20;

	return {
		est: Math.round(est),
		marketMedian,
		compMedian,
		confidence: clamp(confidence, 25, 95),
		rangePct: 0.25,
	};
}

export async function generateNumberReport(input, tonPrice = 5.5) {
	loadNumbersDatabase();
	const parsed = parseNumberLink(input);
	if (!parsed.isValid) throw new Error("Invalid number format.");

	const { number, numberClean } = parsed;
	const formattedNumber = formatDisplayNumber(number);

	let floor = tonPriceCache.get("floor888")?.price;
	if (!floor) {
		floor = await marketService.get888Stats();
		if (floor)
			tonPriceCache.set("floor888", { price: floor, timestamp: Date.now() });
	}
	if (!floor) floor = 850;

	const scraped = await scrapeFragmentNumber(numberClean);
	if (scraped.status === "not_found") throw new Error("Number not minted.");

	// Multi-Market Data
	const nftAddress = await findNFTAddressByNumber(numberClean);
	const getgemsData = await fetchGetGemsMarketData(nftAddress);
	const collectionPulse = await fetchGetGemsCollectionPulse();

	const pattern = analyzeNumberPattern(numberClean, floor);
	const marketSample = await scrapeMarketSampleNumbers();
	const model = estimateWithModel({
		floor,
		marketSample,
		scraped,
		pattern,
		numberClean,
	});

	const estimated = model.est;
	const lowEst = Math.round(estimated * 0.75);
	const highEst = Math.round(estimated * 1.25);
	const vsFloor = (estimated / floor - 1) * 100;

	let registeredText = "⏳ Unknown";
	try {
		const check = await telegramClient.checkPhoneNumber(number);
		registeredText = check.registered ? "✅ Registered" : "❌ Not Active";
	} catch (_e) { }

	const estUsd = Math.round(estimated * tonPrice);
	const statusDisplay =
		scraped.status === "for_sale"
			? "💰 FOR SALE"
			: scraped.status === "on_auction"
				? "🔨 ON AUCTION"
				: scraped.status === "sold"
					? "✅ SOLD"
					: "🔵 NOT LISTED";

	let report = "";
	report += `📱 *${formattedNumber}*\n`;
	report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
	report += `🔵 ${statusDisplay}`;
	if (scraped.priceTon)
		report += `  •  Price: *${formatNumber(scraped.priceTon)} TON*`;
	report += `\n🔗 [Fragment](${scraped.url})\n\n`;

	report += `――――― 📊 *MARKET SNAPSHOT* ―――――\n`;
	report += `▸ Status: *${statusDisplay}*\n`;
	const lastSale = scraped.lastSale || getgemsData?.lastSale;
	if (lastSale)
		report += `▸ Last Sale: *${formatNumber(lastSale)} TON*${scraped.lastSaleDate ? ` (${scraped.lastSaleDate})` : ""} 🏆\n`;
	if (scraped.owner)
		report += `▸ Owner: \`${scraped.owner.substring(0, 8)}...${scraped.owner.slice(-6)}\`\n`;
	report += `\n`;

	if (getgemsData || nftAddress) {
		report += `―――― 🏦 *MULTI‑MARKET LIQUIDITY* ――――\n`;
		report += `▸ 💎 GetGems: ${getgemsData?.priceTon ? `*${formatNumber(getgemsData.priceTon)} TON*` : "NOT LISTED"}`;
		if (getgemsData?.lastSale && !scraped.lastSale)
			report += ` (Last: ${formatNumber(getgemsData.lastSale)} TON)`;
		report += `\n`;

		if (getgemsData?.isRestricted) {
			report += `⚠️ *RESTRICTED:* Potential risk tag (Scam/Warning) detected on GetGems.\n`;
		}

		if (nftAddress) {
			report += `▸ 📜 Smart Contract: \`${nftAddress}\`\n`;
			report += `▸ 🏪 Others: [Portals](https://portals.art/nft/${ANON_NUMBER_COLLECTION}/${nftAddress}) / [MRKT](https://mrkt.com/nft/${ANON_NUMBER_COLLECTION}/${nftAddress})\n`;
		}

		if (
			getgemsData?.owner &&
			scraped.owner &&
			getgemsData.owner !== scraped.owner
		) {
			report += `▸ 👤 GG Owner: \`${getgemsData.owner.substring(0, 8)}...${getgemsData.owner.slice(-6)}\` (Sync Lag?)\n`;
		}
		report += `\n`;
	}

	report += `――――― 💎 *VALUE ESTIMATE* ―――――\n`;
	report += `▸ 🏷️  Fair Value: *~${formatNumber(estimated)} TON*\n`;
	report += `▸ 💵  ~$${formatNumber(estUsd)}\n`;
	report += `▸ 📐 Range: ${formatNumber(lowEst)} — ${formatNumber(highEst)} TON (±25%)\n`;
	report += `▸ 📊 vs Floor (+888): *${vsFloor >= 0 ? "+" : ""}${vsFloor.toFixed(0)}%*\n\n`;

	report += `――――― 📈 *COLLECTION PULSE* ―――――\n`;
	report += `▸ 💰 Floor: *${formatNumber(floor)} TON*\n`;
	if (collectionPulse) {
		if (collectionPulse.owners)
			report += `▸ 👥 Owners: *${collectionPulse.owners}*\n`;
		if (collectionPulse.items)
			report += `▸ #️⃣ Items: *${collectionPulse.items}*\n`;
		if (collectionPulse.volume7d)
			report += `▸ 💹 7d Vol: *${formatNumber(collectionPulse.volume7d)} TON*\n`;
	}
	report += `\n`;

	// --- WHALE WATCH & OWNER INSIGHTS ---
	let otherNumbersCount = 0;
	let ownerLabel = "Standard Holder";
	if (scraped.owner) {
		try {
			const port = await portfolioService.getPortfolio(scraped.owner);
			if (port?.anonymousNumbers) {
				otherNumbersCount = port.anonymousNumbers.length;
				if (otherNumbersCount >= 10) ownerLabel = "🐋 MEG-WHALE";
				else if (otherNumbersCount >= 5) ownerLabel = "🐬 WHALE";
				else if (otherNumbersCount >= 2) ownerLabel = "🐙 COLLECTOR";
			}
		} catch (_e) { }
	}

	report += `――――― 👥 *HOLDER INSIGHTS* ―――――\n`;
	report += `▸ 📱 Registered: ${registeredText}\n`;
	if (scraped.owner) {
		report += `▸ 👤 Owner: \`${scraped.owner.substring(0, 8)}...${scraped.owner.slice(-6)}\`\n`;
		report += `▸ 🏷️ Type: *${ownerLabel}*\n`;
		if (otherNumbersCount > 1)
			report += `▸ 📦 Collection: *Holds ${otherNumbersCount} numbers*\n`;
	}
	report += `\n`;

	if (scraped.history && scraped.history.length > 0) {
		report += `――――― 📜 *HISTORY* ―――――\n`;
		scraped.history.slice(0, 3).forEach((h) => {
			report += `▸ ${h.date} @ ${formatNumber(h.price)} TON\n`;
		});
		report += `\n`;
	}

	report += `――――― 🎰 *NUMBER PATTERN* ―――――\n`;
	report += `▸ Type: *${pattern.label}*\n`;
	report += `▸ Rarity: *${pattern.rarityRank}* (${pattern.score}/100)\n`;
	report += `▸ Pattern Floor: *${formatNumber(pattern.patternFloor)} TON*\n`;
	if (pattern.bonus > 0) report += `▸ Bonus: +${pattern.bonus}%\n\n`;

	report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
	report += `⚡ _Intelligence by @iFragmentBot_  •  TON: $${tonPrice.toFixed(2)}\n`;
	report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

	return {
		report,
		number,
		formattedNumber,
		numberClean,
		priceTon: scraped.priceTon || estimated,
		estimatedValue: estimated,
		floor,
		vsFloor,
		status: scraped.status,
		pattern: pattern.type,
		patternLabel: pattern.label,
		owner: scraped.owner,
		url: scraped.url,
		confidence: model.confidence,
		rarityScore: pattern.score,
		rarityRank: pattern.rarityRank,
		ownerLabel,
		otherNumbersCount,
	};
}
