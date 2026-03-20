import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../../../..");

class LibraryKeeper {
	constructor() {
		this.anchors = new Map();
		this.totalVolume = 0;
		this.recordCount = 0;
		this.pricePercentiles = {
			p10: 0,
			p25: 0,
			p50: 0,
			p75: 0,
			p90: 0,
			p95: 0,
			p99: 0,
		};
		this.lengthStats = new Map();
		this.calibrationFactors = new Map();
		this.loadArchives();
		this.calibrate();
	}

	loadArchives() {
		let totalLoaded = 0;
		const csvFiles = [
			{ path: "data/fragment (1).csv", source: "Fragment", cols: [0, 1, 2] },
			{ path: "data/marketapp.csv", source: "MarketApp", cols: [1, 2, 3] },
			{ path: "data/fragment (2).csv", source: "Fragment2", cols: [0, 1, 2] },
			{ path: "data/fragment (3).csv", source: "Fragment3", cols: [0, 1, 2] },
			{ path: "data/4 Letters.csv", source: "4Letters", cols: [1, 2, 3] },
			{
				path: "data/4 Letters ( 2 ).csv",
				source: "4Letters2",
				cols: [1, 2, 3],
			},
			{
				path: "data/marketapp ( 1 ).csv",
				source: "MarketApp2",
				cols: [1, 2, 3],
			},
		];

		for (const file of csvFiles) {
			try {
				const fullPath = path.join(ROOT_DIR, file.path);
				if (!fs.existsSync(fullPath)) continue;

				const data = fs.readFileSync(fullPath, "utf8");
				const records = parse(data, { columns: true, skip_empty_lines: true });

				for (const row of records) {
					const keys = Object.keys(row);
					const username = this.clean(row[keys[file.cols[0]]]);
					const price = this.parsePrice(row[keys[file.cols[1]]]);
					const dateStr = row[keys[file.cols[2]]];

					if (username && price > 0) {
						this.addAnchor(username, price, dateStr, file.source);
					}
				}
				totalLoaded += records.length;
			} catch (e) {
				console.warn(`⚠️ Failed to load ${file.path}:`, e.message);
			}
		}

		this.calculatePercentiles();
		this.calculateLengthStats();
		console.log(
			`📚 Library: ${this.anchors.size} anchors from ${totalLoaded} records.`,
		);
	}

	addAnchor(username, price, dateStr, source) {
		const existing = this.anchors.get(username);
		if (!existing || price > existing.price) {
			this.anchors.set(username, {
				price,
				date: dateStr,
				source: existing ? "Resale" : source,
				year: this.extractYear(dateStr),
				previousPrice: existing?.price || null,
				length: username.length,
			});
			if (!existing) {
				this.totalVolume += price;
				this.recordCount++;
			}
		}
	}

	calibrate() {
		const byLength = new Map();
		for (const [username, data] of this.anchors) {
			const len = username.length;
			if (!byLength.has(len)) byLength.set(len, []);
			byLength.get(len).push(data.price);
		}
		for (const [len, prices] of byLength) {
			prices.sort((a, b) => a - b);
			const median = prices[Math.floor(prices.length / 2)];
			const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
			this.calibrationFactors.set(len, {
				median,
				avg,
				min: prices[0],
				max: prices[prices.length - 1],
				count: prices.length,
				spread: prices[prices.length - 1] - prices[0],
			});
		}
	}

	calculatePercentiles() {
		const prices = Array.from(this.anchors.values())
			.map((a) => a.price)
			.sort((a, b) => a - b);
		if (prices.length === 0) return;
		this.pricePercentiles = {
			p10: prices[Math.floor(prices.length * 0.1)] || 0,
			p25: prices[Math.floor(prices.length * 0.25)] || 0,
			p50: prices[Math.floor(prices.length * 0.5)] || 0,
			p75: prices[Math.floor(prices.length * 0.75)] || 0,
			p90: prices[Math.floor(prices.length * 0.9)] || 0,
			p95: prices[Math.floor(prices.length * 0.95)] || 0,
			p99: prices[Math.floor(prices.length * 0.99)] || 0,
		};
	}

	calculateLengthStats() {
		const byLength = new Map();
		for (const [username, data] of this.anchors) {
			const len = username.length;
			if (!byLength.has(len))
				byLength.set(len, { sum: 0, count: 0, min: Infinity, max: 0 });
			const stats = byLength.get(len);
			stats.sum += data.price;
			stats.count++;
			stats.min = Math.min(stats.min, data.price);
			stats.max = Math.max(stats.max, data.price);
		}
		for (const [len, stats] of byLength) {
			this.lengthStats.set(len, {
				avg: Math.round(stats.sum / stats.count),
				min: stats.min,
				max: stats.max,
				count: stats.count,
			});
		}
	}

	clean(str) {
		return str ? str.replace("@", "").toLowerCase().trim() : null;
	}
	parsePrice(str) {
		if (!str) return 0;
		return (
			parseInt(
				str
					.toString()
					.replace(/,/g, "")
					.replace("~", "")
					.replace("$", "")
					.trim(),
				10,
			) || 0
		);
	}
	extractYear(dateStr) {
		if (!dateStr) return 2024;
		const yearMatch = dateStr.match(/(202[0-9]|2019|2018)/);
		return yearMatch ? parseInt(yearMatch[1], 10) : 2024;
	}

	getAnchor(username) {
		return this.anchors.get(username);
	}
	getCalibrationFactor(length) {
		return this.calibrationFactors.get(length);
	}
	getPercentileRank(price) {
		const p = this.pricePercentiles;
		if (price >= p.p99) return 99;
		if (price >= p.p95) return 95;
		if (price >= p.p90) return 90;
		if (price >= p.p75) return 75;
		if (price >= p.p50) return 50;
		if (price >= p.p25) return 25;
		return 10;
	}

	findSimilarSales(username) {
		const lower = this.clean(username);
		if (!lower) return null;
		const len = lower.length;
		const isAlpha = /^[a-z]+$/.test(lower);
		const matches = [];

		for (const [key, data] of this.anchors) {
			if (key === lower) continue;
			let score = 0;
			if (key.length === len) score += 50;
			else if (Math.abs(key.length - len) === 1) score += 20;
			else continue;

			const keyAlpha = /^[a-z]+$/.test(key);
			if (isAlpha === keyAlpha) score += 30;
			if (score >= 60) matches.push({ name: key, price: data.price, score });
		}
		matches.sort((a, b) => b.score - a.score || b.price - a.price);
		const top = matches.slice(0, 20);
		if (top.length === 0) return null;
		const prices = top.map((m) => m.price).sort((a, b) => a - b);
		return {
			median: prices[Math.floor(prices.length / 2)],
			avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
			min: prices[0],
			max: prices[prices.length - 1],
			count: top.length,
			examples: top
				.slice(0, 5)
				.map((m) => `"${m.name}" (${m.price.toLocaleString()} TON)`),
		};
	}
}

export const LIBRARY = new LibraryKeeper();
