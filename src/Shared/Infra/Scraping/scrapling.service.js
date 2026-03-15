import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCRIPT_PATH = resolve(
	__dirname,
	"../../../../scripts/scrapling_fragment.py",
);
const PYTHON_BIN = process.env.SCRAPLING_PYTHON || "python";

import { getBrowser } from "../../UI/Components/card-generator.component.js";

/**
 * Executes the Scrapling bridge script to fetch Fragment HTML.
 * @param {string} item - Fragment username (without @) or number.
 * @param {{type?: string, proxy?: string, timeoutMs?: number, headful?: boolean, killTimeoutMs?: number}} [options]
 */
export function scraplingFetchFragment(item, options = {}) {
	if (!item) {
		return Promise.reject(new Error("item is required for Scrapling fetch"));
	}

	if (!existsSync(SCRIPT_PATH)) {
		return Promise.reject(
			new Error(`Scrapling bridge script missing at ${SCRIPT_PATH}`),
		);
	}

	const {
		type = "username",
		proxy,
		timeoutMs = 45000,
		headful = false,
		killTimeoutMs = 70000,
		url,
		wait,
	} = options;
	const args = [
		SCRIPT_PATH,
		item.replace("@", "").trim().toLowerCase(),
		"--type",
		type,
	];

	if (url) {
		args.push("--url", url);
	}

	if (wait) {
		args.push("--wait", wait);
	} else if (type === "number" || type === "username") {
		// Default wait for standard pages
		args.push("--wait", ".tm-section-header-status");
	} else {
		// No wait for custom pages unless specified
		args.push("--wait", "");
	}

	if (proxy) {
		args.push("--proxy", proxy);
	}

	if (timeoutMs) {
		args.push("--timeout", String(timeoutMs));
	}

	if (headful) {
		args.push("--headful");
	}

	return new Promise((resolve, reject) => {
		let stdout = "";
		let stderr = "";
		const child = spawn(PYTHON_BIN, args, {
			stdio: ["ignore", "pipe", "pipe"],
		});
		let killed = false;

		const timer = setTimeout(() => {
			killed = true;
			child.kill("SIGTERM");
		}, killTimeoutMs);

		child.stdout.on("data", (chunk) => {
			stdout += chunk.toString();
		});

		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});

		child.on("error", (err) => {
			clearTimeout(timer);
			reject(err);
		});

		child.on("close", (code) => {
			clearTimeout(timer);

			if (!stdout.trim() && stderr) {
				return reject(new Error(stderr.trim()));
			}

			let payload;
			try {
				payload = JSON.parse(stdout || "{}");
			} catch (err) {
				return reject(
					new Error(`Failed to parse Scrapling output: ${err.message}`),
				);
			}

			if (killed) {
				return reject(new Error("Scrapling fetch timed out"));
			}

			if (code !== 0 || payload.error) {
				const reason =
					payload?.error || stderr || `Scrapling exited with code ${code}`;
				const details = payload?.details || payload?.trace;
				const error = new Error(reason);
				if (details) {
					error.details = details;
				}
				return reject(error);
			}

			resolve(payload);
		});
	});
}

/**
 * Generic Scrapling fetch for any Fragment URL
 * @param {string} url - Full Fragment URL
 * @param {object} [options]
 */
export async function scrapeFragment(url, options = {}) {
	try {
		return await scraplingFetchFragment("query", {
			...options,
			url,
			type: "custom",
			wait: options.wait || ".tm-section",
		});
	} catch (e) {
		console.warn(`⚠️ Primary Scrapling failed for ${url}, trying Puppeteer...`);
		return await puppeteerScrape(url, options);
	}
}

/**
 * Robust Puppeteer-based fallback for scraping
 */
export async function puppeteerScrape(url, options = {}) {
	const { wait, timeoutMs = 30000 } = options;
	let browser = null;
	let page = null;
	try {
		browser = await getBrowser();
		page = await browser.newPage();
		
		// Set a real user agent
		await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
		
		await page.goto(url, { waitUntil: "networkidle2", timeout: timeoutMs });
		
		if (wait) {
			try {
				await page.waitForSelector(wait, { timeout: 10000 });
			} catch (_e) {
				console.warn(`⚠️ Timeout waiting for selector: ${wait}`);
			}
		}

		const html = await page.content();
		return {
			url,
			status: 200,
			success: true,
			html
		};
	} catch (e) {
		console.error(`❌ Puppeteer scrape failed: ${e.message}`);
		return { success: false, error: e.message };
	} finally {
		if (page) await page.close();
	}
}
