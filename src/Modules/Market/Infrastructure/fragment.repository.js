import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPool } from "generic-pool";
import fetch from "node-fetch";
import puppeteer from "puppeteer";
import {
	CONFIG,
	GOLDEN_DICTIONARY,
	getSuggestions,
} from "../../../core/Config/app.config.js";
import { fragmentLimiter } from "../../../Shared/Infra/Network/rate-limiter.service.js";
import { scraplingFetchFragment } from "../../../Shared/Infra/Scraping/scrapling.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Chrome paths for different environments
// Windows: Use local Chrome for development
// Render.com: Let Puppeteer use bundled Chrome automatically
const WIN_CHROME_PATHS = [
	// New Chrome downloaded by puppeteer/bun
	resolve(
		__dirname,
		"../../../../node_modules/.cache/puppeteer/chrome/win64-131.0.6778.204/chrome-win64/chrome.exe",
	),
	// Old cache location
	resolve(
		__dirname,
		"../../../../.cache/chrome/win64-143.0.7499.169/chrome-win64/chrome.exe",
	),
	// System Chrome
	"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
	"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

function findWindowsChrome() {
	// On Render.com (Linux), don't set executablePath - let Puppeteer use its bundled Chrome
	if (process.platform !== "win32") return null;

	for (const path of WIN_CHROME_PATHS) {
		if (existsSync(path)) return path;
	}
	return null;
}

// ==================== BROWSER POOL CONFIGURATION ====================
const POOL_CONFIG = {
	min: 0, // Minimum browsers to keep ready (0 to avoid idle churn)
	max: 2, // Maximum concurrent browsers (optimized for 512MB RAM)
	maxUses: 30, // Recycle browser after 30 uses (prevent memory leaks)
	idleTimeoutMs: 30000, // Close idle browsers after 30 seconds (aggressive cleanup)
	acquireTimeoutMs: 30000, // Timeout for acquiring browser
};

// Track browser usage
const browserUsageCount = new Map();

/**
 * Create browser launch options
 */
function getBrowserLaunchOptions() {
	const options = {
		headless: "new",
		args: [
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--disable-dev-shm-usage",
			"--disable-gpu",
			"--no-zygote",
			"--disable-extensions",
			"--disable-component-extensions-with-background-pages",
			"--mute-audio",
			"--disable-default-apps",
			"--disable-features=Translate,BackForwardCache,AcceptCHFrame,MediaRouter,OptimizationHints",
		],
	};

	// Set Chrome path for Windows
	if (process.platform === "win32") {
		const chromePath = findWindowsChrome();
		if (chromePath) {
			console.log("✅ Using local Windows Chrome:", chromePath);
			options.executablePath = chromePath;
		}
	} else if (process.env.PUPPETEER_EXECUTABLE_PATH) {
		console.log("✅ Using Env Chrome:", process.env.PUPPETEER_EXECUTABLE_PATH);
		options.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
	}

	return options;
}

/**
 * Browser Pool Factory
 */
const browserPoolFactory = {
	create: async () => {
		const browser = await puppeteer.launch(getBrowserLaunchOptions());
		const browserId = Date.now().toString();
		browserUsageCount.set(browserId, 0);
		browser._poolId = browserId;
		return browser;
	},
	destroy: async (browser) => {
		const browserId = browser._poolId;
		browserUsageCount.delete(browserId);
		try {
			await browser.close();
		} catch (e) {
			console.error("Error closing browser:", e.message);
		}
	},
	validate: async (browser) => {
		// Check if browser is still connected
		return browser.isConnected();
	},
};

// Create the browser pool
const browserPool = createPool(browserPoolFactory, {
	min: POOL_CONFIG.min,
	max: POOL_CONFIG.max,
	acquireTimeoutMillis: POOL_CONFIG.acquireTimeoutMs,
	idleTimeoutMillis: POOL_CONFIG.idleTimeoutMs,
	evictionRunIntervalMillis: 30000, // Check for idle browsers every 30s
	testOnBorrow: true, // Validate browser before use
});

// Pool event logging
browserPool.on("factoryCreateError", (err) => {
	console.error("🔴 Browser pool create error:", err.message);
});

browserPool.on("factoryDestroyError", (err) => {
	console.error("🔴 Browser pool destroy error:", err.message);
});

console.log(`🏊 Browser pool initialized (max: ${POOL_CONFIG.max})`);

/**
 * Get pool statistics
 */
export function getPoolStats() {
	return {
		size: browserPool.size,
		available: browserPool.available,
		pending: browserPool.pending,
		borrowed: browserPool.borrowed,
		min: browserPool.min,
		max: browserPool.max,
	};
}

/**
 * Acquire a browser from the pool with usage tracking
 */
async function acquireBrowser() {
	const browser = await browserPool.acquire();
	const browserId = browser._poolId;
	const usage = (browserUsageCount.get(browserId) || 0) + 1;
	browserUsageCount.set(browserId, usage);

	// If browser has been used too many times, mark for recycling
	if (usage >= POOL_CONFIG.maxUses) {
		console.log(
			`♻️ Browser ${browserId} reached max uses (${usage}), will be recycled`,
		);
	}

	return browser;
}

/**
 * Release a browser back to the pool
 */
async function releaseBrowser(browser) {
	const browserId = browser._poolId;
	const usage = browserUsageCount.get(browserId) || 0;

	// If browser exceeded max uses, destroy instead of returning to pool
	if (usage >= POOL_CONFIG.maxUses) {
		await browserPool.destroy(browser);
	} else {
		await browserPool.release(browser);
	}
}

/**
 * Scrape Fragment with Puppeteer (with browser pool and rate limiting)
 */
/**
 * Determine if we collected enough structured data to skip heavier fallbacks.
 */
function hasMeaningfulFragmentData(data) {
	if (!data) return false;
	if (data.status && data.status !== "unknown") return true;
	if (
		(typeof data.priceTon === "number" && data.priceTon > 0) ||
		(typeof data.lastSalePrice === "number" && data.lastSalePrice > 0)
	) {
		return true;
	}
	if (data.ownerWallet || data.ownerWalletFull) return true;
	if (data.available) return true;
	return false;
}

/**
 * Scrape Fragment with Hybrid Approach (HTTP First -> Scrapling -> Puppeteer Fallback)
 * "Super Prompt" Optimization: Drastically reduces resource usage and timeouts on Render
 */
export async function scrapeFragment(username) {
	// Use rate limiter to control concurrent scraping
	return fragmentLimiter.schedule(async () => {
		const cleanUsername = username.replace("@", "").trim().toLowerCase();
		console.log(`🔍 Scraping @${cleanUsername}...`);

		// 1. FAST PATH: HTTP Scrape (No Puppeteer)
		// This handles 90% of cases instantly without launching a browser
		try {
			const httpData = await scrapeFragmentHttp(cleanUsername);
			if (hasMeaningfulFragmentData(httpData)) {
				console.log(`⚡ HTTP Scrape SUCCESS for @${cleanUsername}`);
				return httpData;
			}
			console.log(
				`⚠️ HTTP Scrape inconclusive for @${cleanUsername}, trying Scrapling...`,
			);
		} catch (httpError) {
			console.warn(
				`⚠️ HTTP Scrape failed: ${httpError.message}, trying Scrapling...`,
			);
		}

		// 2. MODERN PATH: Scrapling (Stealth Headless Chrome via Python)
		try {
			const scraplingData = await scrapeFragmentScrapling(cleanUsername);
			if (hasMeaningfulFragmentData(scraplingData)) {
				console.log(`🕵️ Scrapling SUCCESS for @${cleanUsername}`);
				return scraplingData;
			}
			console.log(
				`⚠️ Scrapling yielded ambiguous data for @${cleanUsername}, falling back to Puppeteer...`,
			);
		} catch (scraplingError) {
			console.warn(
				`⚠️ Scrapling fetch failed: ${scraplingError.message}, falling back to Puppeteer...`,
			);
		}

		// 3. SLOW PATH: Puppeteer (Fallback)
		// Used for complex pages or when HTTP is blocked/fails
		const fragmentUrl = `https://fragment.com/username/${cleanUsername}`;
		let browser = null;
		let page = null;

		try {
			browser = await acquireBrowser();
			page = await browser.newPage();

			// Set a realistic viewport and user agent
			await page.setViewport({ width: 1280, height: 720 });
			await page.setUserAgent(
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			);

			// Block heavy resources to speed up loading
			await page.setRequestInterception(true);
			page.on("request", (req) => {
				const type = req.resourceType();
				// Block images, fonts, media to speed up
				if (["image", "font", "media", "stylesheet"].includes(type)) {
					req.abort();
				} else {
					req.continue();
				}
			});

			// Navigate with a longer timeout (60 seconds)
			await page.goto(fragmentUrl, {
				waitUntil: "domcontentloaded",
				timeout: 60000, // Increased from 30s to 60s
			});

			// Wait for the page to fully load - shorter wait with no hard fail
			await page
				.waitForSelector(".tm-section-header-status, .table-cell, body", {
					timeout: 5000,
				})
				.catch(() => console.log("⚠️ Primary selector timeout, continuing..."));

			// Shorter delay since we're blocking resources
			await new Promise((r) => setTimeout(r, 1500));

			// Extract data
			const data = await page.evaluate(
				(username, url) => {
					const result = {
						username,
						url,
						status: "unknown",
						statusText: "❓ Unknown",
						available: false,
						priceTon: null,
						minBid: null,
						highestBid: null,
						auctionEnds: null,
						lastSalePrice: null,
						lastSaleDate: null,
						ownerWallet: null,
						ownerWalletFull: null,
						salesCount: 0,
						debugInfo: "",
					};

					// Get all text content for debugging
					const pageText = document.body?.innerText || "";
					result.debugInfo = pageText.substring(0, 500);

					// Find status badge
					const statusEl = document.querySelector(".tm-section-header-status");
					const statusText = statusEl
						? statusEl.textContent.trim().toLowerCase()
						: "";

					// Status detection
					if (statusText.includes("sold")) {
						result.status = "sold";
						result.statusText = "✅ Sold";
					} else if (statusText.includes("auction")) {
						result.status = "on_auction";
						result.statusText = "🔨 On Auction";
						result.available = true;
					} else if (statusText.includes("sale")) {
						result.status = "for_sale";
						result.statusText = "💰 For Sale";
						result.available = true;
					} else if (statusText.includes("taken")) {
						result.status = "taken";
						result.statusText = "🔒 Taken";
					} else if (statusText.includes("available")) {
						result.status = "available";
						result.statusText = "✨ Available";
						result.available = true;
					} else if (pageText.includes("Ownership History")) {
						result.status = "sold";
						result.statusText = "✅ Sold";
					} else if (pageText.includes("Unavailable")) {
						result.status = "unavailable";
						result.statusText = "❌ Unavailable";
					}

					// Find prices
					const _allPrices = [
						...pageText.matchAll(/([\d,]+(?:\.\d+)?)\s*TON/gi),
					];

					// Get specific prices from table cells
					document.querySelectorAll(".table-cell").forEach((cell) => {
						const text = cell.textContent || "";
						const priceMatch = text.match(/([\d,]+(?:\.\d+)?)\s*TON/i);
						if (priceMatch) {
							const price = parseFloat(priceMatch[1].replace(/,/g, ""));
							const row = cell.closest(".table-row");
							const rowText = row ? row.textContent.toLowerCase() : "";

							if (rowText.includes("buy") || rowText.includes("price")) {
								result.priceTon = price;
							} else if (rowText.includes("minimum")) {
								result.minBid = price;
							} else if (
								rowText.includes("highest") ||
								rowText.includes("bid")
							) {
								result.highestBid = price;
							}
						}
					});

					// Ownership History - for SOLD and FOR_SALE usernames
					// These usernames have been sold before and may have history
					if (["sold", "for_sale"].includes(result.status)) {
						const allTables = document.querySelectorAll("table.tm-table");

						// Find the ownership history table (has Date column)
						let ownershipTable = null;
						allTables.forEach((table) => {
							const headers = table.querySelectorAll("thead th");
							headers.forEach((th) => {
								if (th.textContent.toLowerCase().includes("date")) {
									ownershipTable = table.querySelector("tbody");
								}
							});
						});

						// Use the ownershipTable we already found
						if (ownershipTable) {
							const rows = Array.from(ownershipTable.querySelectorAll("tr"));

							// Loop through ALL rows to find actual sale (not transfer)
							// Sales may be at the end of the list after multiple transfers
							for (const row of rows) {
								const cells = row.querySelectorAll("td");
								if (cells.length >= 2) {
									const firstCellText = cells[0].textContent
										.trim()
										.toLowerCase();

									// Skip if it says "Transferred"
									if (firstCellText.includes("transfer")) {
										continue;
									}

									// Get Price from first cell - look for .tm-value or direct number
									const priceEl =
										cells[0].querySelector(".tm-value") || cells[0];
									const priceText = priceEl.textContent.replace(/[,\s]/g, "");
									const price = parseFloat(priceText);

									if (price && price > 0) {
										result.lastSalePrice = price;

										// Get Date from second cell
										const timeEl = cells[1].querySelector("time");
										if (timeEl) {
											// Try to get the full date text
											const dateText = timeEl.textContent.trim();
											result.lastSaleDate = dateText.split(" at ")[0].trim();
										} else {
											// Fallback: get text directly from cell
											const cellText = cells[1].textContent.trim();
											result.lastSaleDate = cellText.split(" at ")[0].trim();
										}

										break; // Found a sale, stop looking
									}
								}
							}

							result.salesCount = rows.length;
						}

						// Alternative: Try to get from the header section "Purchased on X"
						if (!result.lastSalePrice) {
							const allText = document.body.innerText || "";
							const purchasedMatch = allText.match(
								/Purchased on\s+(\d+\s+\w+\s+\d+)/i,
							);
							if (purchasedMatch) {
								result.lastSaleDate = purchasedMatch[1];
							}

							// Try to get price from header
							const headerPrice = document.querySelector(
								".tm-section-header-price, .tm-value",
							);
							if (headerPrice) {
								const priceText = headerPrice.textContent.replace(/[,\s]/g, "");
								const price = parseFloat(priceText);
								if (price && price > 0) {
									result.lastSalePrice = price;
								}
							}
						}
					}

					// Owner wallet - Reliable selectors based on deep inspection
					// TON wallet addresses are 48 chars but display text may vary

					// Method 1: Main Info Box (for Sold / Auction items)
					// Covers @cryptofyp case where wallet is in .tm-section-bid-info
					const mainWallet = document.querySelector(
						".tm-section-bid-info .tm-wallet, .tm-table-grid .tm-wallet",
					);
					if (mainWallet) {
						const href = mainWallet.getAttribute("href") || "";
						const match = href.match(/(EQ|UQ|Uf|kQ|0Q)[A-Za-z0-9_-]{44,48}/);
						if (match) {
							result.ownerWalletFull = match[0];
							result.ownerWallet = `${match[0].substring(0, 6)}...${match[0].slice(-4)}`;
						}
					}

					// Method 2: History Table (for For Sale items)
					// Covers @sayed case where owner is the last buyer in history
					if (!result.ownerWallet) {
						// Try to find the first wallet link specifically in the history section
						// (usually the top row which is the current owner/last buyer)
						const historyWallet = document.querySelector(
							".tm-section-history .tm-wallet, .tm-history-table .tm-wallet",
						);
						if (historyWallet) {
							const href = historyWallet.getAttribute("href") || "";
							const match = href.match(/(EQ|UQ|Uf|kQ|0Q)[A-Za-z0-9_-]{44,48}/);
							if (match) {
								result.ownerWalletFull = match[0];
								result.ownerWallet = `${match[0].substring(0, 6)}...${match[0].slice(-4)}`;
							}
						}
					}

					// Method 3: Table cells with wallet links (for Ownership History table)
					if (!result.ownerWallet) {
						const tableCells = document.querySelectorAll(
							'.table-cell a[href*="tonviewer"], td a[href*="tonviewer"]',
						);
						for (const cell of tableCells) {
							const href = cell.getAttribute("href") || "";
							const match = href.match(/(EQ|UQ|Uf|kQ|0Q)[A-Za-z0-9_-]{44,48}/);
							if (match) {
								result.ownerWalletFull = match[0];
								result.ownerWallet = `${match[0].substring(0, 6)}...${match[0].slice(-4)}`;
								break;
							}
						}
					}

					// Method 4: Any .tm-wallet link (Fallback)
					if (!result.ownerWallet) {
						const anyWallet = document.querySelector(".tm-wallet");
						if (anyWallet) {
							const href = anyWallet.getAttribute("href") || "";
							const match = href.match(/(EQ|UQ|Uf|kQ|0Q)[A-Za-z0-9_-]{44,48}/);
							if (match) {
								result.ownerWalletFull = match[0];
								result.ownerWallet = `${match[0].substring(0, 6)}...${match[0].slice(-4)}`;
							}
						}
					}

					// Method 5: Fallback - any tonviewer links on page (careful to avoid history)
					if (!result.ownerWallet) {
						const tonviewerLinks = document.querySelectorAll(
							'a[href*="tonviewer.com"]',
						);
						for (const link of tonviewerLinks) {
							const href = link.getAttribute("href") || "";
							const match = href.match(/(EQ|UQ|Uf|kQ|0Q)[A-Za-z0-9_-]{44,48}/);
							if (match) {
								// Verify this isn't just a bidder
								const row = link.closest("tr");
								if (row?.innerText.includes("Bid")) continue;

								result.ownerWalletFull = match[0];
								result.ownerWallet = `${match[0].substring(0, 6)}...${match[0].slice(-4)}`;
								break;
							}
						}
					}

					// ---------------------------------------------------------
					// SUPER METHOD: Meta Tag Extraction (The Savior)
					// ---------------------------------------------------------
					if (!result.ownerWallet) {
						// Try og:description: "Owned by @username" or "Owned by UQ..."
						const metaDesc =
							document.querySelector('meta[property="og:description"]')
								?.content || "";
						const ownerMatch = metaDesc.match(/Owned by\s+([a-zA-Z0-9_-]+)/i);
						if (ownerMatch) {
							const val = ownerMatch[1];
							if (val.startsWith("UQ") || val.startsWith("EQ")) {
								result.ownerWalletFull = val;
								result.ownerWallet = `${val.substring(0, 6)}...${val.slice(-4)}`;
							} else {
								// It's a username/name
								result.ownerWallet = val; // Display name as owner
							}
						}
					}

					// ---------------------------------------------------------
					// SUPER METHOD: Last Sale Parsing (Table Scan)
					// ---------------------------------------------------------
					if (!result.lastSalePrice) {
						const rows = document.querySelectorAll("tr");
						for (const row of rows) {
							const text = row.innerText.toLowerCase();
							if (text.includes("sold") || text.includes("purchased")) {
								// Found a sale row
								// Look for price in this row
								const priceNode = row.querySelector(".tm-value, .icon-ton");
								if (priceNode) {
									const priceText = priceNode.parentElement.innerText.replace(
										/[^\d.]/g,
										"",
									);
									const price = parseFloat(priceText);
									if (price > 0) {
										result.lastSalePrice = price;

										// Try to find date in this row
										const dateNode = row.querySelector("time");
										if (dateNode)
											result.lastSaleDate = dateNode.getAttribute("datetime");

										break; // Use most recent sale
									}
								}
							}
						}
					}

					// Timer for auctions
					const timerEl = document.querySelector(".tm-timer");
					if (timerEl) {
						result.auctionEnds = timerEl.textContent.trim();
					}

					return result;
				},
				cleanUsername,
				fragmentUrl,
			);

			console.log(
				`✅ Fragment: status=${data.status}, lastSale=${data.lastSalePrice}, date=${data.lastSaleDate}, wallet=${data.ownerWallet}`,
			);

			// Log debug info if status is unknown
			if (data.status === "unknown") {
				console.log("⚠️ Debug info:", data.debugInfo?.substring(0, 200));
			}

			return data;
		} catch (error) {
			const msg = error.message || String(error);
			console.error("❌ Fragment error:", msg);
			// Return specifics for debugging
			const errText = msg.length > 20 ? `${msg.substring(0, 20)}...` : msg;
			return createEmptyData(
				cleanUsername,
				fragmentUrl,
				"error",
				`⚠️ Error: ${errText}`,
			);
		} finally {
			// Always close page and release browser back to pool
			if (page) {
				try {
					await page.close();
				} catch (_e) {
					/* ignore */
				}
			}
			if (browser) {
				await releaseBrowser(browser);
			}
		}
	});
}

/**
 * Normalize Fragment HTML into our internal structure.
 */
function parseFragmentHtml(username, url, html, sourceLabel = "HTTP") {
	if (!html) {
		return createEmptyData(
			username,
			url,
			"unknown",
			`⚠️ ${sourceLabel} returned empty HTML`,
		);
	}

	const result = {
		username,
		url,
		status: "unknown",
		statusText: "❓ Unknown",
		available: false,
		priceTon: null,
		minBid: null,
		highestBid: null,
		auctionEnds: null,
		lastSalePrice: null,
		lastSaleDate: null,
		ownerWallet: null,
		ownerWalletFull: null,
		salesCount: 0,
		debugInfo: sourceLabel,
	};

	const statusMatch = html.match(
		/class="[^"]*tm-section-header-status[^"]*"[^>]*>([^<]+)<\/span>/i,
	);
	if (statusMatch) {
		const statusText = statusMatch[1].trim().toLowerCase();
		if (statusText.includes("sold")) {
			result.status = "sold";
			result.statusText = "✅ Sold";
		} else if (statusText.includes("auction")) {
			result.status = "on_auction";
			result.statusText = "🕑 On Auction";
			result.available = true;
		} else if (statusText.includes("sale")) {
			result.status = "for_sale";
			result.statusText = "🛒 For Sale";
			result.available = true;
		} else if (statusText.includes("taken")) {
			result.status = "taken";
			result.statusText = "📦 Taken";
		} else if (statusText.includes("available")) {
			result.status = "available";
			result.statusText = "✨ Available";
			result.available = true;
		}
	} else if (html.includes("Address unavailable")) {
		result.status = "unavailable";
		result.statusText = "🚫 Unavailable";
	}

	const priceMatches = [
		...html.matchAll(/icon-ton">([\d,]+(?:\.\d+)?)<\/div>/g),
	];

	if (result.status === "on_auction") {
		if (priceMatches.length >= 3) {
			result.highestBid = parseFloat(priceMatches[0][1].replace(/,/g, ""));
			result.minBid = parseFloat(priceMatches[2][1].replace(/,/g, ""));
			result.priceTon = result.highestBid || result.minBid;
		} else if (priceMatches.length >= 1) {
			result.priceTon = parseFloat(priceMatches[0][1].replace(/,/g, ""));
		}
	} else if (result.status === "for_sale") {
		if (priceMatches.length > 0) {
			result.priceTon = parseFloat(priceMatches[0][1].replace(/,/g, ""));
		}
	} else if (result.status === "sold") {
		const soldMatch = html.match(
			/Sold for\s+<span[^>]*class="icon-ton"[^>]*>([\d,]+)/i,
		);
		if (soldMatch) {
			result.lastSalePrice = parseFloat(soldMatch[1].replace(/,/g, ""));
		} else if (priceMatches.length > 0) {
			result.lastSalePrice = parseFloat(priceMatches[0][1].replace(/,/g, ""));
		}
	}

	const metaDesc = html.match(
		/<meta\s+property="og:description"\s+content="([^"]*)"/i,
	);
	if (metaDesc) {
		const desc = metaDesc[1];
		const ownedMatch = desc.match(/Owned by @?([a-zA-Z0-9_]+)/i);
		if (ownedMatch) {
			const val = ownedMatch[1];
			if (val.startsWith("UQ") || val.startsWith("EQ")) {
				result.ownerWalletFull = val;
				result.ownerWallet = `${val.substring(0, 6)}...${val.slice(-4)}`;
			} else {
				result.ownerWallet = val;
			}
		}
	}

	if (!result.ownerWalletFull) {
		const walletMatch = html.match(
			/href="https:\/\/tonviewer\.com\/(EQ[A-Za-z0-9_-]+|UQ[A-Za-z0-9_-]+)"/,
		);
		if (walletMatch) {
			result.ownerWalletFull = walletMatch[1];
			result.ownerWallet =
				result.ownerWalletFull.substring(0, 6) +
				"..." +
				result.ownerWalletFull.slice(-4);
		}
	}

	const timeMatch = html.match(/datetime="([^"]+)"/);
	if (timeMatch) {
		if (result.status === "on_auction") {
			result.auctionEnds = timeMatch[1];
		} else if (result.status === "sold") {
			result.lastSaleDate = timeMatch[1].split("T")[0];
		}
	}

	const jsonMatch = html.match(/ajInit\((.*?)\);/);
	if (jsonMatch) {
		try {
			const json = JSON.parse(jsonMatch[1]);
			if (json.state) {
				const s = json.state;
				if (s.username) result.username = s.username;
				if (s.lt) result.auctionLastLt = s.lt;
			}
		} catch (_) {
			// ignore
		}
	}

	return result;
}

/**
 * HTTP Scraper for Usernames (Lightweight)
 */
async function scrapeFragmentHttp(username) {
	const url = `https://fragment.com/username/${username}`;
	const response = await fetch(url, {
		headers: {
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			Accept:
				"text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
			"Accept-Language": "en-US,en;q=0.5",
		},
		timeout: 10000,
	});

	if (response.status === 404) {
		return createEmptyData(username, url, "available", "✨ Available");
	}

	const html = await response.text();
	return parseFragmentHtml(username, url, html, "HTTP");
}

/**
 * Scrapling-powered dynamic fetch (Python bridge).
 */
async function scrapeFragmentScrapling(username) {
	const fallbackUrl = `https://fragment.com/username/${username}`;
	const payload = await scraplingFetchFragment(username, {
		timeoutMs: 60000,
		killTimeoutMs: 90000,
	});

	if (!payload || !payload.html) {
		throw new Error("Scrapling returned empty payload");
	}

	const parsed = parseFragmentHtml(
		username,
		payload.url || fallbackUrl,
		payload.html,
		"SCRAPLING",
	);
	if (payload.status) {
		parsed.debugInfo = `SCRAPLING:${payload.status}`;
	}
	return parsed;
}
export async function scrapeGiftOwner(slug, itemNumber) {
	return fragmentLimiter.schedule(async () => {
		// User requested t.me link format
		const url = `https://t.me/nft/${slug}-${itemNumber}`;
		console.log(`🔍 Scraping Gift: ${url} (HTTP Mode)`);

		try {
			// 1. Fetch the page HTML
			const response = await fetch(url, {
				headers: {
					// Masquerade as a browser to avoid some basic bot protections
					"User-Agent":
						"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
					Accept:
						"text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
					"Accept-Language": "en-US,en;q=0.5",
				},
				timeout: 10000, // 10s timeout is plenty for HTTP
			});

			if (!response.ok) {
				console.warn(`⚠️ HTTP Error ${response.status} for ${url}`);
				return null;
			}

			const html = await response.text();

			// 2. Extract Data using Regex
			const result = { username: null, wallet: null, name: null };

			// Strategy A: Look for "Owned by @username" in description/metadata
			// Regex matches: "Owned by @username" or "Owned by Name"
			// <meta property="og:description" content="..."> is usually where this lives

			// Try to find the specific "Owned by" pattern first
			const ownedMatch = html.match(
				/Owned by\s+(?:<a[^>]*>)?@?([a-zA-Z0-9_]+)(?:<\/a>)?/i,
			);
			if (ownedMatch) {
				result.username = ownedMatch[1];
			}

			// Strategy B: Check meta tags if Strategy A failed
			if (!result.username) {
				const descMatch = html.match(
					/<meta\s+property="og:description"\s+content="([^"]*)"/i,
				);
				if (descMatch) {
					const desc = descMatch[1];
					// "Ton. Unique collectible. Owned by @username"
					const userMatch = desc.match(/Owned by @([a-zA-Z0-9_]+)/i);
					if (userMatch) {
						result.username = userMatch[1];
					}
				}
			}

			// Strategy C: Check for any t.me profile link that isn't the NFT link itself
			// Valid profile: t.me/username (but not t.me/nft/...)
			if (!result.username) {
				// Find all t.me links in the HTML
				const links = [
					...html.matchAll(/href="https:\/\/t\.me\/([a-zA-Z0-9_]+)"/g),
				];
				for (const match of links) {
					const candidate = match[1];
					// Filter out reserved words or likely non-user paths if necessary
					if (
						candidate.toLowerCase() !== "nft" &&
						candidate.toLowerCase() !== "iv"
					) {
						// The owner link is usually the first profile link in the body
						result.username = candidate;
						break;
					}
				}
			}

			if (result.username) {
				console.log(`✅ HTTP Scraper found: @${result.username}`);
				return result;
			} else {
				console.log(
					`❌ HTTP Scraper could not find owner for ${slug}-${itemNumber}`,
				);
				return null;
			}
		} catch (error) {
			console.error(`❌ HTTP Scrape error: ${error.message}`);
			return null;
		}
	});
}

function createEmptyData(
	username,
	url,
	status = "unknown",
	statusText = "❓ Unknown",
) {
	return {
		username,
		url,
		status,
		statusText,
		available: false,
		priceTon: null,
		minBid: null,
		highestBid: null,
		auctionEnds: null,
		lastSalePrice: null,
		lastSaleDate: null,
		ownerWallet: null,
		ownerWalletFull: null,
		salesCount: 0,
	};
}

// ==================== ADVANCED INSIGHT GENERATION ====================

/**
 * Extended category database for deep username analysis
 */
const INSIGHT_CATEGORIES = {
	// Web3 & Crypto
	crypto: {
		keywords: [
			"coin",
			"token",
			"wallet",
			"dao",
			"nft",
			"meta",
			"defi",
			"btc",
			"eth",
			"ton",
			"crypto",
			"chain",
			"block",
			"swap",
			"stake",
			"yield",
			"hodl",
			"satoshi",
			"web3",
		],
		insights: [
			"🚀 Web3 Power Name. This handle screams blockchain authority — perfect for crypto founders, DAOs, or DeFi protocols.",
			"💎 Crypto-Native Asset. High demand among blockchain projects. Ideal for exchanges, wallets, or token communities.",
			"⛓️ Blockchain Identity. A name that resonates with the decentralized world. Premium pick for any crypto venture.",
			"🌐 Web3 Ready. Built for the on-chain economy. This username carries serious weight in crypto circles.",
		],
	},
	// AI & Technology
	tech: {
		keywords: [
			"app",
			"bot",
			"tech",
			"code",
			"data",
			"cloud",
			"ai",
			"net",
			"web",
			"dev",
			"soft",
			"cyber",
			"digital",
			"smart",
			"api",
			"hack",
			"program",
			"neural",
			"gpt",
			"llm",
		],
		insights: [
			"🤖 Tech Authority Handle. Perfect for AI startups, SaaS platforms, or developer-focused brands.",
			"💻 Digital-First Identity. This name speaks to innovation. Ideal for tech founders and coding communities.",
			"🧠 AI-Era Asset. In the age of artificial intelligence, this handle has serious growth potential.",
			"⚡ Innovation Catalyst. A username that positions you at the forefront of technology.",
		],
	},
	// Business & Commerce
	business: {
		keywords: [
			"shop",
			"store",
			"pay",
			"market",
			"trade",
			"group",
			"channel",
			"news",
			"deal",
			"sale",
			"buy",
			"sell",
			"biz",
			"corp",
			"inc",
			"brand",
			"agency",
		],
		insights: [
			"💼 Commercial Powerhouse. This name carries business authority. Perfect for marketplaces and B2B channels.",
			"🏢 Enterprise-Grade Handle. A professional identity that commands trust and credibility.",
			"📈 Growth-Ready Username. Built for scaling. Ideal for startups, agencies, and commercial ventures.",
			"💰 Revenue-Generating Name. This handle has clear commercial intent and monetization potential.",
		],
	},
	// Power & Authority
	premium: {
		keywords: [
			"king",
			"queen",
			"god",
			"boss",
			"pro",
			"vip",
			"one",
			"top",
			"best",
			"elite",
			"prime",
			"alpha",
			"legend",
			"master",
			"chief",
			"royal",
			"supreme",
			"ultimate",
		],
		insights: [
			"👑 Authority Statement. This username projects dominance. Perfect for influencers and thought leaders.",
			"🏆 Premier League Handle. A name that positions you at the absolute top of your domain.",
			"⚔️ Power Username. Commands respect instantly. Ideal for leaders, coaches, and industry experts.",
			"🔥 Elite Status Symbol. This handle separates you from the crowd. A true status indicator.",
		],
	},
	// Personal Names
	names: {
		keywords: [
			"ali",
			"sara",
			"john",
			"mary",
			"alex",
			"david",
			"rose",
			"max",
			"adam",
			"emma",
			"james",
			"mike",
			"leo",
			"sam",
			"tom",
			"ben",
			"joe",
			"dan",
			"eva",
			"mia",
			"kim",
			"amy",
			"zoe",
			"jay",
			"ray",
			"roy",
			"ian",
			"kai",
			"eli",
		],
		insights: [
			"👤 Personal Identity Gold. Clean, simple, unforgettable. The most valuable type of username for individuals.",
			"✨ Name-Based Premium. Human names are the hardest to acquire. This is a collector's item.",
			"🎯 Identity Asset. Perfect for personal branding, influencers, or anyone building a public presence.",
			"💫 Human Touch Username. Names resonate with people. This handle builds instant connection.",
		],
	},
	// Gaming & Esports
	gaming: {
		keywords: [
			"game",
			"play",
			"gamer",
			"clash",
			"pubg",
			"fortnite",
			"minecraft",
			"roblox",
			"esport",
			"twitch",
			"stream",
			"level",
			"quest",
			"guild",
			"clan",
			"raid",
			"loot",
			"pvp",
			"rpg",
			"fps",
		],
		insights: [
			"🎮 Esports-Ready Handle. This username was born for gaming. Perfect for streamers, teams, and gaming brands.",
			"🕹️ Gaming Authority. A name that resonates with millions of gamers. High-value in the streaming economy.",
			"🏟️ Arena-Grade Username. Built for competition. Ideal for esports orgs and gaming influencers.",
			"⚔️ Player's Paradise. This handle speaks the language of gamers worldwide.",
		],
	},
	// Nature & Animals
	nature: {
		keywords: [
			"wolf",
			"lion",
			"tiger",
			"bear",
			"eagle",
			"hawk",
			"fox",
			"dragon",
			"phoenix",
			"shark",
			"fire",
			"ice",
			"storm",
			"thunder",
			"sky",
			"sun",
			"moon",
			"star",
			"ocean",
			"forest",
		],
		insights: [
			"🐺 Nature's Power. Animal and elemental names carry primal energy. Universal appeal across cultures.",
			"🦅 Wild Spirit Handle. This username embodies strength and freedom. Perfect for bold brands.",
			"🌟 Cosmic Identity. Celestial names are timeless. This handle has eternal value.",
			"🔥 Elemental Force. Names inspired by nature command attention. A truly memorable asset.",
		],
	},
	// Media & Entertainment
	media: {
		keywords: [
			"news",
			"media",
			"press",
			"daily",
			"times",
			"post",
			"report",
			"video",
			"tube",
			"film",
			"movie",
			"show",
			"tv",
			"radio",
			"podcast",
			"stream",
		],
		insights: [
			"📰 Media Authority. This handle is built for content. Perfect for news channels and publishers.",
			"🎬 Entertainment Asset. A username that works across film, music, and digital media.",
			"📺 Broadcast-Ready. Ideal for media companies, influencers, and content creators.",
			"🎙️ Content Creator's Dream. This name positions you for virality and audience growth.",
		],
	},
	// Music & Art
	music: {
		keywords: [
			"music",
			"beat",
			"song",
			"dj",
			"audio",
			"sound",
			"melody",
			"rhythm",
			"band",
			"rock",
			"pop",
			"rap",
			"hip",
			"jazz",
			"remix",
			"studio",
			"record",
			"art",
			"paint",
			"draw",
		],
		insights: [
			"🎵 Creative Soul Handle. This username resonates with artists. Perfect for musicians and visual creators.",
			"🎨 Artistic Identity. A name that speaks to creativity. Ideal for galleries, labels, and artists.",
			"🎤 Stage-Ready Username. Built for the spotlight. This handle commands creative authority.",
			"🎹 Melodic Asset. Music-related names have timeless appeal. A premium creative identity.",
		],
	},
	// Food & Lifestyle
	food: {
		keywords: [
			"food",
			"eat",
			"cook",
			"chef",
			"pizza",
			"burger",
			"sushi",
			"coffee",
			"cafe",
			"resto",
			"kitchen",
			"recipe",
			"taste",
			"yummy",
			"delicious",
		],
		insights: [
			"🍕 Foodie Paradise. This handle speaks to millions of food lovers. Perfect for restaurants and food brands.",
			"👨‍🍳 Culinary Authority. A username that commands respect in the food industry.",
			"☕ Lifestyle Asset. Food-related names have universal appeal. Great for content creators.",
			"🍽️ Taste-Maker Handle. Built for the food and beverage industry. High commercial value.",
		],
	},
	// Travel & Adventure
	travel: {
		keywords: [
			"travel",
			"tour",
			"hotel",
			"fly",
			"trip",
			"vacation",
			"explore",
			"adventure",
			"voyage",
			"journey",
			"nomad",
			"world",
			"globe",
			"passport",
		],
		insights: [
			"✈️ Wanderlust Handle. This username is built for adventure. Perfect for travel brands and influencers.",
			"🌍 Global Asset. A name that transcends borders. Ideal for tourism and travel content.",
			"🗺️ Explorer's Identity. This handle speaks to the travel community. High engagement potential.",
			"🏝️ Adventure-Ready. Built for those who inspire others to discover the world.",
		],
	},
	// Finance & Investment
	finance: {
		keywords: [
			"bank",
			"fund",
			"invest",
			"capital",
			"money",
			"cash",
			"rich",
			"wealth",
			"stock",
			"forex",
			"trading",
			"profit",
			"hedge",
			"equity",
			"asset",
		],
		insights: [
			"💵 **Financial Authority.** This username commands trust in money matters. Perfect for fintech and advisors.",
			"📊 **Investment-Grade Handle.** A name that speaks to serious capital. High-value for financial brands.",
			"🏦 **Wealth Management Asset.** This handle positions you as a financial authority.",
			"💹 **Market Mover.** Built for traders, investors, and financial content creators.",
		],
	},
};

/**
 * Length-based insight templates
 */
const _LENGTH_INSIGHTS = {
	3: [
		"💎 Ultra-Rare 3-Letter. The holy grail of usernames. Extremely limited supply, maximum collector value.",
		"🏆 Legendary 3-Char. These almost never come to market. A true digital artifact.",
		"⚡ Triple Threat. 3-letter usernames are the most sought-after assets on Fragment.",
	],
	4: [
		"💎 Rare 4-Letter Asset. The sweet spot of value and memorability. Highly liquid on any market.",
		"✨ Premium 4-Char. Short enough to be rare, long enough for words. Maximum branding potential.",
		"🎯 Four-Letter Gold. The most balanced premium tier. Easy to sell, hard to find.",
	],
	5: [
		"✨ Short & Sweet. 5-letter usernames offer the perfect balance of availability and value.",
		"⚡ Branding Sweet Spot. Long enough for real words, short enough to be memorable.",
		"🎯 5-Char Premium. This length captures many dictionary words. Strong market appeal.",
	],
	6: [
		"⚡ Concise & Punchy. 6-letter names are easy to type and remember. Solid investment tier.",
		"🎯 Balanced Asset. Not too short, not too long. The practical premium zone.",
		"💫 Six-Letter Sweet. Many powerful words live in this range. Good growth potential.",
	],
};

/**
 * Pattern-based insight templates
 */
const _PATTERN_INSIGHTS = {
	numeric: [
		"🔢 Numeric Collectible. Number-based usernames have dedicated collectors. Unique market niche.",
		"📊 Data Pattern. Numeric handles appeal to quant minds and tech enthusiasts.",
		"🎰 Lucky Numbers. Certain number patterns carry cultural significance and premium value.",
	],
	repeating: [
		"🔄 Visual Pattern. Repeating characters create instant recognition. Memorable and unique.",
		"✨ Pattern Premium. Symmetry and repetition have inherent aesthetic value.",
		"🎯 Signature Style. These patterns stand out in any username list.",
	],
	bot: [
		"🤖 Bot Essential. Every Telegram bot needs a handle. This is infrastructure-grade.",
		"⚙️ Automation Ready. Bot usernames are in constant demand from developers.",
		"🔧 Developer Asset. Critical for anyone building Telegram services.",
	],
	allCaps: [
		"🔥 Statement Handle. All-caps names demand attention. Bold and unforgettable.",
		"⚡ Power Typography. Visual dominance in any context. High-impact identity.",
	],
};

/**
 * Fallback insights for general usernames
 */
const _GENERAL_INSIGHTS = [
	"📈 Solid Foundation. A clean, usable username with room for brand building.",
	"🎯 Versatile Asset. This handle works across multiple industries and use cases.",
	"💫 Growth Potential. With the right branding, this username can appreciate significantly.",
	"🌱 Building Block. A practical identity for those ready to build their presence.",
	"⚡ Starter Premium. Not the rarest, but a legitimate asset with clear utility.",
];

/**
 * Hash function for deterministic selection (same username = same insight)
 */
function hashUsername(username) {
	let hash = 0;
	for (let i = 0; i < username.length; i++) {
		const char = username.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}
	return Math.abs(hash);
}

/**
 * Select an item from array deterministically based on username hash
 */
function _selectDeterministic(arr, username) {
	const hash = hashUsername(username);
	return arr[hash % arr.length];
}

/**
 * Generate a "Dynamic Truth" insight using AI
 * GUARANTEED to be unique and unparalleled every single time.
 */
export async function generateShortInsight(username) {
	const cleanUsername = username.replace("@", "").toLowerCase();

	// 1. GOLDEN DICTIONARY CHECK (Fastest & Most Accurate)
	// If the word is in our massive curated database, use that definition.
	if (GOLDEN_DICTIONARY?.[cleanUsername]) {
		console.log(`✨ Using Golden Definition for @${cleanUsername}`);
		return `💎 ${GOLDEN_DICTIONARY[cleanUsername]}`;
	}

	// 2. UNIQUE AI GENERATION (The Primary Engine)
	try {
		// Dynamic prompt for "Ultimate Linguistic Precision"
		const prompt = `Analyze the username "@${cleanUsername}" with UNPARALLELED LINGUISTIC DEPTH.
ROLE: You are the world's greatest etymologist and brand strategist.
RULES:
1. IF COMPOUND (e.g. "SmartBot"): Explain the synergy of combining '${cleanUsername.slice(0, Math.floor(cleanUsername.length / 2))}' and the suffix/prefix.
2. IF SINGLE WORD: Define its absolute core meaning and its premium implication.
3. TONE: Intelligent, Authoritative, Premium, Sharp. (NOT poetic, NOT flowery).
4. NO generic fluff like "This handle is...". Go straight to the definition.
5. Language: STRICTLY ENGLISH ONLY.
6. CONTENT: Explain EXACTLY what the word means and why it commands value.
7. Length: A single, flawless sentence (12-25 words).
8. Variation Seed: ${Date.now()}`;

		const url = `${CONFIG.POLLINATIONS_TEXT_API}/${encodeURIComponent(prompt)}?model=openai`;

		// Timeout 5s - we want speed, but quality takes a moment
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 5000);

		const response = await fetch(url, {
			headers: { Accept: "text/plain" },
			signal: controller.signal,
		});
		clearTimeout(timeoutId);

		if (response.ok) {
			let text = await response.text();
			text = text.replace(/^["']|["']$/g, "").trim(); // Remove quotes

			// Validation: Ensure it's not an error message
			if (text.length > 5 && !text.includes("Error")) {
				return `✨ ${text}`;
			}
		}
	} catch (_error) {
		// Silent fail to fallback
	}

	// 2. FALLBACK: The Oracle's Static Wisdom (If AI fails)
	// We keep the static lists ONLY for offline/error states

	// Check categories
	for (const [_category, data] of Object.entries(INSIGHT_CATEGORIES)) {
		if (data.keywords.some((w) => cleanUsername.includes(w))) {
			// Add random flavor to static text to feign uniqueness
			const flavors = ["✨", "💎", "🔥", "⚡", "🌟"];
			const flavor = flavors[Math.floor(Math.random() * flavors.length)];
			const base =
				data.insights[Math.floor(Math.random() * data.insights.length)];
			return `${flavor} ${base}`;
		}
	}

	// General Fallback
	const fallbackFlavors = [
		"💎 A digital artifact of unknown power.",
		"✨ Woven from the fabric of the digital ether.",
		"🌟 A unique identifier in the vast network.",
		"🔥 Forged in the fires of the blockchain.",
		"⚡ Pulsing with potential and digital value.",
	];
	return fallbackFlavors[Math.floor(Math.random() * fallbackFlavors.length)];
}

function _getDefaultTagline(username, category = "general") {
	const len = username.length;
	const _lower = username.toLowerCase();

	// Category-specific taglines
	const categoryTaglines = {
		gaming:
			"A premium gaming/esports username perfect for streamers, teams, and gaming brands.",
		crypto:
			"A valuable cryptocurrency/blockchain username ideal for crypto projects and communities.",
		ecommerce:
			"A strong e-commerce username perfect for online stores and marketplace brands.",
		media:
			"A professional media/news username ideal for publishers and content creators.",
		music:
			"A creative music industry username perfect for artists, DJs, and record labels.",
		travel:
			"An adventurous travel username ideal for tourism brands and travel influencers.",
	};

	if (categoryTaglines[category]) {
		return categoryTaglines[category];
	}

	// Length-based generic taglines (no TON mention)
	if (len <= 4)
		return `A rare ${len}-letter premium Telegram username with high collector value.`;
	if (len <= 6)
		return `A short, memorable username perfect for brands and premium identities.`;
	return "A unique and valuable Telegram username for personal or business branding.";
}

/**
 * Generate username suggestions using The Codex Singularity (Oracle Prophecy)
 * Now powered by the 1000+ line neural engine in config.js
 */
export async function generateUsernameSuggestions(username) {
	const cleanUsername = username.replace("@", "").trim();
	return getSuggestions(cleanUsername);
}

/**
 * Get TON price with multiple fallback APIs
/**
 * Get TON price and market stats (24h change)
 */
// مکانیزم کش ساده برای قیمت TON (اعتبار: 60 ثانیه)
let cachedTonStats = {
	price: 0,
	change24h: 0,
	lastUpdated: 0,
};

export async function getTonMarketStats() {
	const NOW = Date.now();

	// اگر کش معتبر است (زیر 60 ثانیه)، همان را برگردان
	if (cachedTonStats.price > 0 && NOW - cachedTonStats.lastUpdated < 60000) {
		return { price: cachedTonStats.price, change24h: cachedTonStats.change24h };
	}

	// 1. CoinGecko (پایدارترین و رایگان‌ترین API عمومی)
	try {
		const response = await fetch(
			"https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd&include_24hr_change=true",
			{ timeout: 5000 },
		);
		if (response.ok) {
			const data = await response.json();
			if (data["the-open-network"]) {
				const price = data["the-open-network"].usd;
				const change = data["the-open-network"].usd_24h_change;

				if (price > 0) {
					cachedTonStats = { price, change24h: change, lastUpdated: NOW };
					return { price, change24h: change };
				}
			}
		}
	} catch (_e) {
		// خطای سایلنت برای فال‌بک
	}

	// 2. Binance (Public API - بسیار سریع)
	try {
		const response = await fetch(
			"https://api.binance.com/api/v3/ticker/24hr?symbol=TONUSDT",
			{ timeout: 5000 },
		);
		if (response.ok) {
			const data = await response.json();
			const price = parseFloat(data.lastPrice);
			const change = parseFloat(data.priceChangePercent);

			if (price > 0) {
				cachedTonStats = { price, change24h: change, lastUpdated: NOW };
				return { price, change24h: change };
			}
		}
	} catch (_e) {}

	// 3. OKX (Backup)
	try {
		const response = await fetch(
			"https://www.okx.com/api/v5/market/ticker?instId=TON-USDT",
			{ timeout: 5000 },
		);
		if (response.ok) {
			const data = await response.json();
			if (data.data?.[0]) {
				const ticker = data.data[0];
				const price = parseFloat(ticker.last);
				const open = parseFloat(ticker.open24h);
				const change = ((price - open) / open) * 100;

				if (price > 0) {
					cachedTonStats = { price, change24h: change, lastUpdated: NOW };
					return { price, change24h: change };
				}
			}
		}
	} catch (_e) {}

	// اگر دیتای قدیمی در کش داریم، حتی اگر منقضی شده باشد آن را برگردان (بهتر از قیمت ثابت است)
	if (cachedTonStats.price > 0) {
		return { price: cachedTonStats.price, change24h: cachedTonStats.change24h };
	}

	console.log("⚠️ All TON price APIs failed, using hardcoded fallback");
	return { price: 5.5, change24h: 0 };
}

/**
 * Legacy support for just getting price
 */
export async function getTonPrice() {
	const stats = await getTonMarketStats();
	return stats.price;
}

/**
 * Close all browsers and drain the pool
 */
export async function closeBrowser() {
	console.log("🛑 Draining browser pool...");
	try {
		await browserPool.drain();
		await browserPool.clear();
		console.log("✅ Browser pool drained");
	} catch (e) {
		console.error("Error draining pool:", e.message);
	}
}
