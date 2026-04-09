/**
 * Premium & Gifts Repository — HTTP-only, Render-safe
 * Fetches Premium subscription pricing + Gift collections from Fragment
 */
import fetch from "node-fetch";

const FRAGMENT_HEADERS = {
	"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
	Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
	"Accept-Language": "en-US,en;q=0.5",
};

/**
 * Scrape Premium pricing from fragment.com/premium
 */
export async function scrapePremiumPricing() {
	try {
		const res = await fetch("https://fragment.com/premium", {
			headers: FRAGMENT_HEADERS,
			timeout: 12000,
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const html = await res.text();
		return parsePremiumHtml(html);
	} catch (e) {
		console.error("❌ [Premium] Scrape error:", e.message);
		return getFallbackPremiumPricing();
	}
}

/**
 * Scrape Gift collections from fragment.com/gifts
 * Returns list of { name, slug, floorPrice, totalSupply, url }
 */
export async function scrapeGiftCollections() {
	try {
		const res = await fetch("https://fragment.com/gifts", {
			headers: FRAGMENT_HEADERS,
			timeout: 12000,
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const html = await res.text();
		return parseGiftsHtml(html);
	} catch (e) {
		console.error("❌ [Gifts] Scrape error:", e.message);
		return [];
	}
}

/**
 * Scrape a specific Gift collection detail page
 */
export async function scrapeGiftCollection(slug) {
	try {
		const res = await fetch(`https://fragment.com/gifts/${slug}`, {
			headers: FRAGMENT_HEADERS,
			timeout: 12000,
		});
		if (!res.ok) return null;
		const html = await res.text();
		return parseGiftDetailHtml(slug, html);
	} catch (e) {
		console.error(`❌ [Gift:${slug}] Scrape error:`, e.message);
		return null;
	}
}

function parsePremiumHtml(html) {
	const plans = [];

	// Try to extract premium plan rows
	const rows = [...html.matchAll(
		/(\d+)\s*(?:month|months)[\s\S]*?icon-ton">([\d,.]+)/gi
	)];

	for (const m of rows) {
		const months = parseInt(m[1], 10);
		const priceTon = parseFloat(m[2].replace(/,/g, ""));
		if (months > 0 && priceTon > 0) {
			plans.push({
				months,
				priceTon,
				perMonthTon: +(priceTon / months).toFixed(2),
			});
		}
	}

	return plans.length > 0 ? plans : getFallbackPremiumPricing();
}

function parseGiftsHtml(html) {
	const gifts = [];

	// Match gift collection cards
	const cards = [...html.matchAll(
		/href="\/gifts\/([^"]+)"[\s\S]*?<div[^>]*class="[^"]*gift-title[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]*?icon-ton">([\d,.]+)/gi
	)];

	for (const m of cards) {
		const slug = m[1];
		const name = m[2].replace(/<[^>]+>/g, "").trim();
		const floorPrice = parseFloat(m[3].replace(/,/g, ""));
		if (slug && floorPrice > 0) {
			gifts.push({
				name: name || slug,
				slug,
				floorPrice,
				url: `https://fragment.com/gifts/${slug}`,
			});
		}
	}

	// Alternative: simpler pattern for non-matching HTML structure
	if (gifts.length === 0) {
		const altCards = [...html.matchAll(
			/\/gifts\/([a-z0-9-]+)"[\s\S]*?([\d,.]+)\s*TON/gi
		)];
		const seen = new Set();
		for (const m of altCards) {
			if (seen.has(m[1])) continue;
			seen.add(m[1]);
			gifts.push({
				name: m[1].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
				slug: m[1],
				floorPrice: parseFloat(m[2].replace(/,/g, "")),
				url: `https://fragment.com/gifts/${m[1]}`,
			});
		}
	}

	return gifts;
}

function parseGiftDetailHtml(slug, html) {
	const result = {
		slug,
		name: slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
		floorPrice: null,
		totalSupply: null,
		owners: null,
		listings: null,
	};

	const floorMatch = html.match(/icon-ton">([\d,.]+)/i);
	if (floorMatch) result.floorPrice = parseFloat(floorMatch[1].replace(/,/g, ""));

	const supplyMatch = html.match(/Total Supply[\s\S]*?([\d,]+)/i);
	if (supplyMatch) result.totalSupply = parseInt(supplyMatch[1].replace(/,/g, ""), 10);

	const ownersMatch = html.match(/Owners[\s\S]*?([\d,]+)/i);
	if (ownersMatch) result.owners = parseInt(ownersMatch[1].replace(/,/g, ""), 10);

	return result;
}

function getFallbackPremiumPricing() {
	return [
		{ months: 3, priceTon: 15, perMonthTon: 5 },
		{ months: 6, priceTon: 25, perMonthTon: 4.17 },
		{ months: 12, priceTon: 40, perMonthTon: 3.33 },
	];
}
