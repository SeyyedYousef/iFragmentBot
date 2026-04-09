/**
 * Stars Repository — HTTP-only, Render-safe
 * Fetches Telegram Stars pricing and data from Fragment
 */
import fetch from "node-fetch";

const FRAGMENT_HEADERS = {
	"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
	Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
	"Accept-Language": "en-US,en;q=0.5",
};

/**
 * Scrape Stars pricing packages from fragment.com/stars
 * Returns array of { stars, priceTon, priceUsd, perStar }
 */
export async function scrapeStarsPricing() {
	try {
		const res = await fetch("https://fragment.com/stars", {
			headers: FRAGMENT_HEADERS,
			timeout: 12000,
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const html = await res.text();
		return parseStarsHtml(html);
	} catch (e) {
		console.error("❌ [Stars] Scrape error:", e.message);
		return getFallbackStarsPricing();
	}
}

/**
 * Parse Stars page HTML
 */
function parseStarsHtml(html) {
	const packages = [];

	// Match star package rows: amount + TON price
	const rows = [...html.matchAll(
		/class="table-cell[^"]*"[^>]*>[\s\S]*?(\d[\d,]*)\s*Stars[\s\S]*?icon-ton">([\d,.]+)/gi
	)];

	for (const m of rows) {
		const stars = parseInt(m[1].replace(/,/g, ""), 10);
		const priceTon = parseFloat(m[2].replace(/,/g, ""));
		if (stars > 0 && priceTon > 0) {
			packages.push({
				stars,
				priceTon,
				perStarTon: +(priceTon / stars).toFixed(6),
			});
		}
	}

	// If regex didn't match, try alternative pattern
	if (packages.length === 0) {
		const altRows = [...html.matchAll(
			/([\d,]+)\s*(?:Stars|⭐)[\s\S]*?(?:icon-ton"|TON)[^>]*>([\d,.]+)/gi
		)];
		for (const m of altRows) {
			const stars = parseInt(m[1].replace(/,/g, ""), 10);
			const priceTon = parseFloat(m[2].replace(/,/g, ""));
			if (stars > 0 && priceTon > 0) {
				packages.push({ stars, priceTon, perStarTon: +(priceTon / stars).toFixed(6) });
			}
		}
	}

	return packages.length > 0 ? packages : getFallbackStarsPricing();
}

/**
 * Hardcoded fallback when scraping fails
 */
function getFallbackStarsPricing() {
	return [
		{ stars: 50, priceTon: 1.5, perStarTon: 0.03 },
		{ stars: 100, priceTon: 2.8, perStarTon: 0.028 },
		{ stars: 250, priceTon: 6.5, perStarTon: 0.026 },
		{ stars: 500, priceTon: 12, perStarTon: 0.024 },
		{ stars: 1000, priceTon: 22, perStarTon: 0.022 },
		{ stars: 2500, priceTon: 50, perStarTon: 0.02 },
	];
}
