import { fragmentApiClient } from "../Infrastructure/fragment-api.client.js";

// Lightweight Regex-based parser to avoid dependency issues with cheerio
class GlobalMarketScanner {
	constructor() {
		this.hotAuctions = []; // sort=price_desc
		this.endingSoon = []; // sort=ending
		this.recentlyListed = []; // sort=listed
		
		this.lastUpdate = 0;
		this.isUpdating = false;
	}

	async updateIndexes() {
		if (this.isUpdating) return;
		this.isUpdating = true;
		console.log("⏱️ [MARKET-SCANNER] Updating global market indexes via API (Regex-Mode)...");
		
		try {
			const [hotRes, endingRes, recentRes] = await Promise.all([
				fragmentApiClient.searchAuctions("", "price_desc", "usernames", "auction"),
				fragmentApiClient.searchAuctions("", "ending", "usernames", "auction"),
				fragmentApiClient.searchAuctions("", "listed", "usernames", "auction")
			]);

			if (hotRes?.html) this.hotAuctions = this.parseResultsTable(hotRes.html);
			if (endingRes?.html) this.endingSoon = this.parseResultsTable(endingRes.html);
			if (recentRes?.html) this.recentlyListed = this.parseResultsTable(recentRes.html);

			this.lastUpdate = Date.now();
			console.log(`✅ [MARKET-SCANNER] Updated: ${this.hotAuctions.length} Hot, ${this.endingSoon.length} Ending, ${this.recentlyListed.length} Recent`);
		} catch (error) {
			console.error("❌ [MARKET-SCANNER] Error updating indexes:", error.message);
		} finally {
			this.isUpdating = false;
		}
	}

	parseResultsTable(html) {
		const items = [];
		// Extract rows using regex
		const rowRegex = /<tr class="tm-row-selectable">([\s\S]*?)<\/tr>/g;
		let match;
		
		while ((match = rowRegex.exec(html)) !== null) {
			const rowHtml = match[1];
			
			// Extract username
			const userMatch = rowHtml.match(/<span class="table-cell-value tm-value">@?(.*?)<\/span>/);
			if (!userMatch) continue;
			const username = userMatch[1].trim();

			// Extract price
			const priceMatch = rowHtml.match(/<div class="table-cell-value tm-value icon-ton">(.*?)<\/div>/);
			const priceTon = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, "")) : 0;

			// Extract status
			const isResale = rowHtml.includes("tm-status-resale");

			// Extract time
			const timeMatch = rowHtml.match(/<time datetime="(.*?)"/);
			const auctionEnds = timeMatch ? timeMatch[1] : null;

			items.push({
				username,
				priceTon,
				status: isResale ? "for_sale" : "on_auction",
				auctionEnds
			});
		}

		return items;
	}

	getMarketOverview() {
		// Calculate average of top 10 hot items
		const top10 = this.hotAuctions.slice(0, 10);
		const avgTop10 = top10.length ? top10.reduce((acc, curr) => acc + curr.priceTon, 0) / top10.length : 0;
		
		return {
			hot: this.hotAuctions.slice(0, 5),
			endingSoon: this.endingSoon.slice(0, 5),
			recentlyListed: this.recentlyListed.slice(0, 5),
			metrics: {
				avgTop10Price: Math.round(avgTop10),
				totalTracked: this.hotAuctions.length + this.endingSoon.length + this.recentlyListed.length,
				lastUpdate: this.lastUpdate
			}
		};
	}
}

export const marketScanner = new GlobalMarketScanner();
