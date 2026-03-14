/**
 * Proxy Scraper Service
 * Fetches, validates, and manages proxies from public sources
 */

import fetch from "node-fetch";
import { settings } from "../../../database/panelDatabase.js";
import * as proxyManager from "./proxy-manager.service.js";

// ==================== SOURCES ====================

const PROXY_SOURCES = [
	// SOCKS5 Sources
	{
		url: "https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt",
		type: "socks5",
	},
	{
		url: "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt",
		type: "socks5",
	},
	{
		url: "https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt",
		type: "socks5",
	},
	{
		url: "https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-socks5.txt",
		type: "socks5",
	},
	{
		url: "https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS5_RAW.txt",
		type: "socks5",
	},

	// HTTP/HTTPS Sources
	{
		url: "https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt",
		type: "http",
	},
	{
		url: "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt",
		type: "http",
	},
	{
		url: "https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-http.txt",
		type: "http",
	},
];

// Configuration
const BATCH_SIZE = 50; // Validate 50 proxies in parallel
const MAX_LATENCY = 3000; // Max acceptable latency in ms
const _TIMEOUT = 5000; // Connection timeout in ms

let isScraping = false;
let autoScrapeInterval = null;

// ==================== CORE FUNCTIONS ====================

/**
 * Fetch raw proxies from a single source
 */
async function fetchSource(source) {
	try {
		const response = await fetch(source.url);
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const text = await response.text();
		return text
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line?.includes(":"))
			.map((line) => {
				const parts = line.split(":");
				return {
					host: parts[0],
					port: parseInt(parts[1], 10),
					type: source.type,
				};
			});
	} catch (error) {
		console.error(`Error fetching ${source.url}:`, error.message);
		return [];
	}
}

/**
 * Scrape all sources and return unique proxies
 */
export async function scrapeProxies() {
	if (isScraping) return { status: "already_running" };
	isScraping = true;

	try {
		console.log("☁️ Starting proxy scraping...");

		// 1. Fetch from all sources in parallel
		const fetchPromises = PROXY_SOURCES.map((source) => fetchSource(source));
		const results = await Promise.all(fetchPromises);

		// 2. Flatten and Deduplicate
		const allProxies = results.flat();
		const uniqueProxies = [];
		const seen = new Set();

		for (const p of allProxies) {
			const key = `${p.host}:${p.port}`;
			if (!seen.has(key)) {
				seen.add(key);
				uniqueProxies.push(p);
			}
		}

		console.log(
			`☁️ Fetched ${uniqueProxies.length} unique proxies. Validating...`,
		);

		// 3. Validate in Batches
		const validProxies = [];
		let processed = 0;

		for (let i = 0; i < uniqueProxies.length; i += BATCH_SIZE) {
			const batch = uniqueProxies.slice(i, i + BATCH_SIZE);
			const batchResults = await Promise.all(
				batch.map((p) => proxyManager.testProxy(p)),
			);

			for (let j = 0; j < batch.length; j++) {
				if (batchResults[j].success && batchResults[j].latency < MAX_LATENCY) {
					validProxies.push(batch[j]);
				}
			}

			processed += batch.length;
			if (processed % 500 === 0) {
				console.log(
					`☁️ Validated ${processed}/${uniqueProxies.length} - Found ${validProxies.length} working`,
				);
			}
		}

		// 4. Save to Database
		let added = 0;
		for (const p of validProxies) {
			// Check if already exists in DB
			const exists = proxyManager
				.getAllProxies()
				.some(
					(existing) => existing.host === p.host && existing.port === p.port,
				);

			if (!exists) {
				proxyManager.addProxy(p.type, p.host, p.port);
				added++;
			}
		}

		console.log(`☁️ Scraping complete. Added ${added} new proxies.`);

		return {
			status: "success",
			fetched: uniqueProxies.length,
			working: validProxies.length,
			added: added,
		};
	} catch (error) {
		console.error("Scraping error:", error);
		return { status: "error", message: error.message };
	} finally {
		isScraping = false;
	}
}

// ==================== AUTOPILOT ====================

/**
 * Start Auto-Scraper
 */
export function startAutoScraper(intervalMinutes = 60) {
	if (autoScrapeInterval) clearInterval(autoScrapeInterval);

	settings.set("auto_scrape_enabled", true);
	settings.set("auto_scrape_interval", intervalMinutes);

	console.log(`☁️ Auto-Scraper started (Interval: ${intervalMinutes}m)`);

	// Run immediately
	scrapeProxies();

	// Schedule
	autoScrapeInterval = setInterval(
		() => {
			scrapeProxies();
		},
		intervalMinutes * 60 * 1000,
	);
}

/**
 * Stop Auto-Scraper
 */
export function stopAutoScraper() {
	if (autoScrapeInterval) clearInterval(autoScrapeInterval);
	autoScrapeInterval = null;
	settings.set("auto_scrape_enabled", false);
	console.log("☁️ Auto-Scraper stopped");
}

/**
 * Initialize (Check saved settings)
 */
export function init() {
	const enabled = settings.get("auto_scrape_enabled", false);
	if (enabled) {
		const interval = settings.get("auto_scrape_interval", 60);
		startAutoScraper(interval);
	}
}

/**
 * Get Scraper Status
 */
export function getStatus() {
	return {
		isRunning: isScraping,
		autoEnabled: !!autoScrapeInterval,
		sources: PROXY_SOURCES.length,
	};
}

export default {
	scrapeProxies,
	startAutoScraper,
	stopAutoScraper,
	getStatus,
	init,
};
