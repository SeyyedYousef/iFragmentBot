/**
 * Proxy Manager Service
 * Handles proxy management for Telegram accounts
 */

import { proxies } from "../../../database/panelDatabase.js";

// ==================== PROXY TYPES ====================

export const PROXY_TYPES = {
	SOCKS5: "socks5",
	SOCKS4: "socks4",
	HTTP: "http",
	HTTPS: "https",
	MTPROTO: "mtproto",
};

// ==================== PROXY CRUD ====================

/**
 * Add a new proxy
 * @param {string} type - Proxy type (socks5, http, etc.)
 * @param {string} host - Proxy host
 * @param {number} port - Proxy port
 * @param {string} username - Optional username
 * @param {string} password - Optional password
 * @returns {number} Proxy ID
 */
export async function addProxy(type, host, port, username = "", password = "") {
	return await proxies.add(type, host, port, username, password);
}

/**
 * Add multiple proxies from text
 * Format: type://host:port or type://user:pass@host:port
 * @param {string} text - Multiline text with proxy definitions
 * @returns {{success: number, failed: number, errors: string[]}}
 */
export async function addProxiesFromText(text) {
	const lines = text
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l);
	const result = { success: 0, failed: 0, errors: [] };

	for (const line of lines) {
		try {
			const parsed = parseProxyString(line);
			if (parsed) {
				await addProxy(
					parsed.type,
					parsed.host,
					parsed.port,
					parsed.username,
					parsed.password,
				);
				result.success++;
			} else {
				result.failed++;
				result.errors.push(`Invalid format: ${line}`);
			}
		} catch (error) {
			result.failed++;
			result.errors.push(`${line}: ${error.message}`);
		}
	}

	return result;
}

/**
 * Parse proxy string
 * Supports formats:
 * - socks5://host:port
 * - socks5://user:pass@host:port
 * - host:port (defaults to socks5)
 */
function parseProxyString(str) {
	// URL format: type://[user:pass@]host:port
	const urlPattern =
		/^(socks[45]?|https?|mtproto):\/\/(?:([^:]+):([^@]+)@)?([^:]+):(\d+)$/i;
	const urlMatch = str.match(urlPattern);

	if (urlMatch) {
		return {
			type: urlMatch[1].toLowerCase(),
			username: urlMatch[2] || "",
			password: urlMatch[3] || "",
			host: urlMatch[4],
			port: parseInt(urlMatch[5], 10),
		};
	}

	// Simple format: host:port
	const simplePattern = /^([^:]+):(\d+)$/;
	const simpleMatch = str.match(simplePattern);

	if (simpleMatch) {
		return {
			type: "socks5",
			username: "",
			password: "",
			host: simpleMatch[1],
			port: parseInt(simpleMatch[2], 10),
		};
	}

	// IP:PORT:USER:PASS format
	const detailedPattern = /^([^:]+):(\d+):([^:]+):(.+)$/;
	const detailedMatch = str.match(detailedPattern);

	if (detailedMatch) {
		return {
			type: "socks5",
			host: detailedMatch[1],
			port: parseInt(detailedMatch[2], 10),
			username: detailedMatch[3],
			password: detailedMatch[4],
		};
	}

	return null;
}

/**
 * Get all proxies
 */
export async function getAllProxies() {
	return await proxies.getAll();
}

/**
 * Get active proxies only
 */
export async function getActiveProxies() {
	return await proxies.getActive();
}

/**
 * Get proxy count
 */
export async function getProxyCount() {
	return await proxies.count();
}

/**
 * Get a random active proxy
 */
export async function getRandomProxy() {
	return await proxies.getRandom();
}

/**
 * Get proxy by ID
 */
export async function getProxyById(id) {
	return await proxies.getById(id);
}

/**
 * Toggle proxy active state
 */
export async function toggleProxy(id, isActive) {
	await proxies.toggle(id, isActive);
}

/**
 * Delete proxy
 */
export async function deleteProxy(id) {
	await proxies.delete(id);
}

/**
 * Delete all proxies
 */
export async function deleteAllProxies() {
	await proxies.deleteAll();
}

// ==================== PROXY TESTING ====================

/**
 * Test if a proxy is working
 * @param {object} proxy - Proxy object
 * @returns {Promise<{success: boolean, latency?: number, error?: string}>}
 */
export async function testProxy(proxy) {
	const startTime = Date.now();

	try {
		let agent;
		const proxyUrl = proxy.username
			? `${proxy.type}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`
			: `${proxy.type}://${proxy.host}:${proxy.port}`;

		if (proxy.type.startsWith("socks")) {
			const { SocksProxyAgent } = await import("socks-proxy-agent");
			agent = new SocksProxyAgent(proxyUrl);
		} else if (proxy.type.startsWith("http")) {
			const { HttpsProxyAgent } = await import("https-proxy-agent");
			agent = new HttpsProxyAgent(proxyUrl);
		} else {
			throw new Error(`Unsupported proxy type: ${proxy.type}`);
		}

		// Try to connect to Telegram API
		const response = await fetch("https://api.telegram.org/", {
			method: "HEAD",
			agent,
			timeout: 10000,
		});

		const latency = Date.now() - startTime;

		return {
			success: response.ok,
			latency,
		};

	} catch (error) {
		return {
			success: false,
			error: error.message,
		};
	}
}

/**
 * Test all proxies and return results
 */
export async function testAllProxies() {
	const allProxies = await getAllProxies();
	const results = [];

	for (const proxy of allProxies) {
		const result = await testProxy(proxy);
		results.push({
			id: proxy.id,
			host: proxy.host,
			port: proxy.port,
			...result,
		});
	}

	return results;
}

// ==================== PROXY FORMATTING ====================

/**
 * Format proxy for GramJS/Telethon
 */
export function formatProxyForClient(proxy) {
	if (!proxy) return null;

	return {
		ip: proxy.host,
		port: proxy.port,
		socksType: proxy.type === "socks4" ? 4 : 5,
		username: proxy.username || undefined,
		password: proxy.password || undefined,
	};
}

/**
 * Format proxy for display
 */
export function formatProxyForDisplay(proxy) {
	if (!proxy) return "بدون پروکسی";

	let str = `${proxy.type}://${proxy.host}:${proxy.port}`;
	if (proxy.username) {
		str = `${proxy.type}://${proxy.username}:***@${proxy.host}:${proxy.port}`;
	}
	return str;
}

// ==================== STATISTICS ====================

/**
 * Get proxy statistics
 */
export async function getProxyStats() {
	const all = await getAllProxies();
	const active = await getActiveProxies();

	return {
		total: all.length,
		active: active.length,
		inactive: all.length - active.length,
		byType: all.reduce((acc, p) => {
			acc[p.type] = (acc[p.type] || 0) + 1;
			return acc;
		}, {}),
	};
}

export default {
	PROXY_TYPES,
	addProxy,
	addProxiesFromText,
	getAllProxies,
	getActiveProxies,
	getProxyCount,
	getRandomProxy,
	getProxyById,
	toggleProxy,
	deleteProxy,
	deleteAllProxies,
	testProxy,
	testAllProxies,
	formatProxyForClient,
	formatProxyForDisplay,
	getProxyStats,
	startAutoScraper: (interval) =>
		import("./proxy-scraper.service.js").then((m) =>
			m.startAutoScraper(interval),
		),
	stopAutoScraper: () =>
		import("./proxy-scraper.service.js").then((m) => m.stopAutoScraper()),
	getScraperStatus: () =>
		import("./proxy-scraper.service.js").then((m) => m.getStatus()),
	scrapeProxies: () =>
		import("./proxy-scraper.service.js").then((m) => m.scrapeProxies()),
};
