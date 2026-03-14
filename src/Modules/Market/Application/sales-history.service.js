/**
 * Sales History Service - Historical Sales Analysis Engine
 * Provides EWMA predictions, trend detection, and outlier filtering
 * for accurate gift valuation
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const HISTORY_FILE = path.join(__dirname, "../../data/sales_history.json");
const MAX_HISTORY_DAYS = 90;
const MIN_SAMPLES_FOR_EWMA = 3;

// In-memory cache for fast access
let salesCache = new Map();
let lastSaveTime = 0;
const SAVE_INTERVAL_MS = 60000; // Save every minute

/**
 * Initialize sales history from file
 */
function initializeSalesHistory() {
	try {
		if (fs.existsSync(HISTORY_FILE)) {
			const data = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
			salesCache = new Map(Object.entries(data));
			console.log(`📊 Sales history loaded: ${salesCache.size} collections`);
		} else {
			// Ensure data directory exists
			const dataDir = path.dirname(HISTORY_FILE);
			if (!fs.existsSync(dataDir)) {
				fs.mkdirSync(dataDir, { recursive: true });
			}
			fs.writeFileSync(HISTORY_FILE, "{}");
			console.log("📊 Sales history initialized (empty)");
		}
	} catch (error) {
		console.warn("⚠️ Failed to load sales history:", error.message);
		salesCache = new Map();
	}
}

/**
 * Save sales history to file (debounced)
 */
function saveSalesHistory() {
	const now = Date.now();
	if (now - lastSaveTime < SAVE_INTERVAL_MS) return;

	try {
		const data = Object.fromEntries(salesCache);
		fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2));
		lastSaveTime = now;
	} catch (error) {
		console.warn("⚠️ Failed to save sales history:", error.message);
	}
}

/**
 * Record a new sale
 * @param {string} collection - Collection slug
 * @param {number} itemNumber - Item number
 * @param {number} price - Sale price in TON
 * @param {Object} attributes - Gift attributes (model, backdrop, symbol)
 * @param {Date} timestamp - Sale timestamp
 */
export function recordSale(
	collection,
	itemNumber,
	price,
	attributes = {},
	timestamp = new Date(),
) {
	const key = collection.toLowerCase();

	if (!salesCache.has(key)) {
		salesCache.set(key, { sales: [], attributes: {} });
	}

	const collectionData = salesCache.get(key);

	// Add sale to history
	collectionData.sales.push({
		item: itemNumber,
		price,
		timestamp: timestamp.toISOString(),
		model: attributes.model || null,
		backdrop: attributes.backdrop || null,
		symbol: attributes.symbol || null,
	});

	// Track attribute sales separately for better analysis
	if (attributes.model) {
		if (!collectionData.attributes[attributes.model]) {
			collectionData.attributes[attributes.model] = [];
		}
		collectionData.attributes[attributes.model].push({
			price,
			timestamp: timestamp.toISOString(),
		});
	}

	// Clean old entries (older than MAX_HISTORY_DAYS)
	const cutoffDate = new Date(
		Date.now() - MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000,
	);
	collectionData.sales = collectionData.sales.filter(
		(s) => new Date(s.timestamp) > cutoffDate,
	);

	saveSalesHistory();
	console.log(`📝 Recorded sale: ${collection} #${itemNumber} @ ${price} TON`);
}

/**
 * Get sales history for a collection
 * @param {string} collection - Collection slug
 * @param {number} days - Number of days to look back
 * @returns {Array} Sales records
 */
export function getSalesHistory(collection, days = 30) {
	const key = collection.toLowerCase();
	const data = salesCache.get(key);

	if (!data) return [];

	const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
	return data.sales.filter((s) => new Date(s.timestamp) > cutoffDate);
}

/**
 * Get attribute-specific sales history
 * @param {string} collection - Collection slug
 * @param {string} attributeType - 'model', 'backdrop', or 'symbol'
 * @param {string} attributeValue - The attribute value
 * @param {number} days - Number of days
 */
export function getAttributeSales(
	collection,
	attributeType,
	attributeValue,
	days = 30,
) {
	const sales = getSalesHistory(collection, days);
	return sales.filter(
		(s) => s[attributeType]?.toLowerCase() === attributeValue?.toLowerCase(),
	);
}

/**
 * Calculate Exponential Weighted Moving Average (EWMA)
 * More recent sales have higher weight
 * @param {Array} prices - Array of prices (chronological order)
 * @param {number} span - EWMA span (higher = more smoothing)
 * @returns {number} EWMA value
 */
export function calculateEWMA(prices, span = 5) {
	if (!prices || prices.length === 0) return null;
	if (prices.length < MIN_SAMPLES_FOR_EWMA) return prices[prices.length - 1];

	const alpha = 2 / (span + 1);
	let ewma = prices[0];

	for (let i = 1; i < prices.length; i++) {
		ewma = alpha * prices[i] + (1 - alpha) * ewma;
	}

	return ewma;
}

/**
 * Calculate price prediction with confidence interval
 * @param {Array} prices - Historical prices
 * @returns {Object} { prediction, lower, upper, confidence }
 */
export function calculatePricePrediction(prices) {
	if (!prices || prices.length === 0) {
		return { prediction: null, lower: null, upper: null, confidence: 0 };
	}

	// Remove outliers first
	const cleanPrices = removeOutliers(prices);

	// Calculate EWMA for prediction
	const prediction = calculateEWMA(cleanPrices);

	// Calculate standard deviation for confidence interval
	const mean = cleanPrices.reduce((a, b) => a + b, 0) / cleanPrices.length;
	const variance =
		cleanPrices.reduce((sum, p) => sum + (p - mean) ** 2, 0) /
		cleanPrices.length;
	const stdDev = Math.sqrt(variance);

	// 90% confidence interval (1.645 * stdDev)
	const margin = 1.645 * stdDev;

	// Confidence based on sample size
	let confidence = 0;
	if (cleanPrices.length >= 20) confidence = 95;
	else if (cleanPrices.length >= 10) confidence = 85;
	else if (cleanPrices.length >= 5) confidence = 70;
	else if (cleanPrices.length >= 3) confidence = 50;
	else confidence = 30;

	return {
		prediction: Math.round(prediction * 10) / 10,
		lower: Math.round((prediction - margin) * 10) / 10,
		upper: Math.round((prediction + margin) * 10) / 10,
		confidence,
		sampleSize: cleanPrices.length,
	};
}

/**
 * Detect price trend
 * @param {Array} sales - Sales records with timestamps
 * @returns {Object} { trend, strength, percentChange }
 */
export function detectTrend(sales) {
	if (!sales || sales.length < 3) {
		return { trend: "neutral", strength: 0, percentChange: 0 };
	}

	// Sort by timestamp
	const sorted = [...sales].sort(
		(a, b) => new Date(a.timestamp) - new Date(b.timestamp),
	);

	const prices = sorted.map((s) => s.price);

	// Split into halves for comparison
	const midpoint = Math.floor(prices.length / 2);
	const recentHalf = prices.slice(midpoint);
	const olderHalf = prices.slice(0, midpoint);

	const recentAvg = recentHalf.reduce((a, b) => a + b, 0) / recentHalf.length;
	const olderAvg = olderHalf.reduce((a, b) => a + b, 0) / olderHalf.length;

	const percentChange = ((recentAvg - olderAvg) / olderAvg) * 100;

	// Determine trend and strength
	let trend = "neutral";
	let strength = 0;

	if (percentChange > 15) {
		trend = "strong_up";
		strength = Math.min(100, percentChange);
	} else if (percentChange > 5) {
		trend = "up";
		strength = Math.min(50, percentChange);
	} else if (percentChange < -15) {
		trend = "strong_down";
		strength = Math.min(100, Math.abs(percentChange));
	} else if (percentChange < -5) {
		trend = "down";
		strength = Math.min(50, Math.abs(percentChange));
	}

	return {
		trend,
		strength: Math.round(strength),
		percentChange: Math.round(percentChange * 10) / 10,
		emoji: getTrendEmoji(trend),
	};
}

/**
 * Get trend emoji
 */
function getTrendEmoji(trend) {
	const emojis = {
		strong_up: "🚀",
		up: "📈",
		neutral: "➖",
		down: "📉",
		strong_down: "💥",
	};
	return emojis[trend] || "➖";
}

/**
 * Remove outliers using IQR method
 * @param {Array} prices - Array of prices
 * @returns {Array} Filtered prices
 */
export function removeOutliers(prices) {
	if (!prices || prices.length < 4) return prices;

	const sorted = [...prices].sort((a, b) => a - b);
	const q1Index = Math.floor(sorted.length * 0.25);
	const q3Index = Math.floor(sorted.length * 0.75);

	const q1 = sorted[q1Index];
	const q3 = sorted[q3Index];
	const iqr = q3 - q1;

	// Use 1.5 * IQR rule
	const lowerBound = q1 - 1.5 * iqr;
	const upperBound = q3 + 1.5 * iqr;

	const filtered = prices.filter((p) => p >= lowerBound && p <= upperBound);

	if (filtered.length < 3) return prices; // Don't filter too much

	return filtered;
}

/**
 * Get trend factor for valuation adjustment
 * @param {string} collection - Collection slug
 * @returns {number} Multiplier (0.9 - 1.1)
 */
export function getTrendFactor(collection) {
	const sales = getSalesHistory(collection, 7); // 7-day trend
	const trendData = detectTrend(sales);

	// Convert trend to multiplier
	switch (trendData.trend) {
		case "strong_up":
			return 1.1;
		case "up":
			return 1.05;
		case "strong_down":
			return 0.9;
		case "down":
			return 0.95;
		default:
			return 1.0;
	}
}

/**
 * Get collection statistics
 * @param {string} collection - Collection slug
 * @returns {Object} Statistics
 */
export function getCollectionStats(collection) {
	const allSales = getSalesHistory(collection, 90);
	const recentSales = getSalesHistory(collection, 7);

	if (allSales.length === 0) {
		return null;
	}

	const allPrices = allSales.map((s) => s.price);
	const recentPrices = recentSales.map((s) => s.price);

	return {
		totalSales: allSales.length,
		recentSales: recentSales.length,
		avgPrice90d: Math.round(
			allPrices.reduce((a, b) => a + b, 0) / allPrices.length,
		),
		avgPrice7d:
			recentPrices.length > 0
				? Math.round(
						recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length,
					)
				: null,
		minPrice: Math.min(...allPrices),
		maxPrice: Math.max(...allPrices),
		trend: detectTrend(recentSales),
	};
}

// ═══════════════════════════════════════
// 🚀 ADVANCED VALUATION FEATURES V3.0
// ═══════════════════════════════════════

/**
 * Get sales with matching attribute combinations
 * Finds historical sales that match the target attributes for more accurate valuation
 * @param {string} collection - Collection slug
 * @param {Object} attributes - { model, backdrop, symbol }
 * @param {number} days - Days to look back
 * @returns {Object} { exactMatches, partialMatches, weightedAverage }
 */
export function getAttributeComboSales(collection, attributes = {}, days = 60) {
	const sales = getSalesHistory(collection, days);
	if (sales.length === 0) return null;

	const { model, backdrop, symbol } = attributes;

	// Find exact matches (all attributes match)
	const exactMatches = sales.filter((s) => {
		const matchModel = !model || s.model?.toLowerCase() === model.toLowerCase();
		const matchBackdrop =
			!backdrop || s.backdrop?.toLowerCase() === backdrop.toLowerCase();
		const matchSymbol =
			!symbol || s.symbol?.toLowerCase() === symbol.toLowerCase();
		return matchModel && matchBackdrop && matchSymbol;
	});

	// Find partial matches (at least 2 attributes match)
	const partialMatches = sales.filter((s) => {
		let matches = 0;
		if (model && s.model?.toLowerCase() === model.toLowerCase()) matches++;
		if (backdrop && s.backdrop?.toLowerCase() === backdrop.toLowerCase())
			matches++;
		if (symbol && s.symbol?.toLowerCase() === symbol.toLowerCase()) matches++;
		return matches >= 2;
	});

	// Calculate weighted average (exact matches have 3x weight)
	let weightedSum = 0;
	let weightedCount = 0;

	exactMatches.forEach((s) => {
		weightedSum += s.price * 3;
		weightedCount += 3;
	});

	partialMatches.forEach((s) => {
		if (!exactMatches.includes(s)) {
			weightedSum += s.price * 1;
			weightedCount += 1;
		}
	});

	const weightedAverage =
		weightedCount > 0 ? weightedSum / weightedCount : null;

	return {
		exactMatches: exactMatches.length,
		partialMatches: partialMatches.length,
		exactPrices: exactMatches.map((s) => s.price),
		partialPrices: partialMatches.map((s) => s.price),
		weightedAverage: weightedAverage ? Math.round(weightedAverage) : null,
		confidence:
			exactMatches.length >= 3
				? "high"
				: exactMatches.length >= 1
					? "moderate"
					: "low",
	};
}

/**
 * Calculate 7-day price forecast using linear regression
 * @param {string} collection - Collection slug
 * @returns {Object} { forecast, trend, confidence, changePercent }
 */
export function calculate7DayForecast(collection) {
	const sales = getSalesHistory(collection, 30);
	if (sales.length < 5) {
		return {
			forecast: null,
			trend: "unknown",
			confidence: 0,
			changePercent: 0,
		};
	}

	// Sort by timestamp
	const sorted = [...sales].sort(
		(a, b) => new Date(a.timestamp) - new Date(b.timestamp),
	);

	// Linear regression
	const n = sorted.length;
	const prices = sorted.map((s) => s.price);
	const xValues = sorted.map((_, i) => i);

	const sumX = xValues.reduce((a, b) => a + b, 0);
	const sumY = prices.reduce((a, b) => a + b, 0);
	const sumXY = xValues.reduce((sum, x, i) => sum + x * prices[i], 0);
	const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);

	const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
	const intercept = (sumY - slope * sumX) / n;

	// Predict 7 days ahead
	const currentPrice = prices[prices.length - 1];
	const forecastX = n + 7; // 7 days ahead
	const forecast = Math.round(slope * forecastX + intercept);

	const changePercent = Math.round(
		((forecast - currentPrice) / currentPrice) * 100,
	);

	let trend = "stable";
	if (changePercent > 10) trend = "rising";
	else if (changePercent > 5) trend = "slightly_rising";
	else if (changePercent < -10) trend = "falling";
	else if (changePercent < -5) trend = "slightly_falling";

	// Confidence based on R-squared
	const meanY = sumY / n;
	const ssRes = prices.reduce((sum, y, i) => {
		const predicted = slope * xValues[i] + intercept;
		return sum + (y - predicted) ** 2;
	}, 0);
	const ssTot = prices.reduce((sum, y) => sum + (y - meanY) ** 2, 0);
	const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

	const confidence = Math.round(Math.max(0, rSquared * 100));

	return {
		forecast: Math.max(0, forecast), // Don't predict negative
		currentPrice,
		trend,
		confidence,
		changePercent,
		emoji: changePercent > 5 ? "📈" : changePercent < -5 ? "📉" : "➡️",
	};
}

/**
 * Calculate demand/supply score for a collection
 * @param {string} collection - Collection slug
 * @param {number} currentOnSale - Current number of items on sale
 * @param {number} totalItems - Total items in collection
 * @returns {Object} { score, label, description }
 */
export function getDemandSupplyScore(
	collection,
	currentOnSale = 0,
	totalItems = 1000,
) {
	const sales7d = getSalesHistory(collection, 7);
	const sales30d = getSalesHistory(collection, 30);

	// Velocity: sales per day in last 7 days
	const velocity7d = sales7d.length / 7;
	const velocity30d = sales30d.length / 30;

	// Acceleration: is velocity increasing?
	const acceleration = velocity7d / (velocity30d || 0.1);

	// Supply pressure: what % is for sale?
	const supplyRatio = currentOnSale / (totalItems || 1000);

	// Calculate score (0-100)
	let score = 50; // Base score

	// High velocity = high demand
	if (velocity7d > 5) score += 20;
	else if (velocity7d > 2) score += 10;
	else if (velocity7d < 0.5) score -= 10;

	// Acceleration bonus
	if (acceleration > 1.5)
		score += 15; // Demand increasing
	else if (acceleration < 0.5) score -= 10; // Demand falling

	// Supply scarcity bonus
	if (supplyRatio < 0.05)
		score += 15; // Very scarce
	else if (supplyRatio < 0.1) score += 10;
	else if (supplyRatio > 0.3) score -= 15; // Oversupply

	score = Math.max(0, Math.min(100, score));

	let label, description, emoji;
	if (score >= 80) {
		label = "Very High Demand";
		description = "Strong buyer interest, limited supply";
		emoji = "🔥";
	} else if (score >= 60) {
		label = "High Demand";
		description = "Active market with good velocity";
		emoji = "📈";
	} else if (score >= 40) {
		label = "Moderate";
		description = "Balanced supply and demand";
		emoji = "⚖️";
	} else if (score >= 20) {
		label = "Low Demand";
		description = "Slow market activity";
		emoji = "📉";
	} else {
		label = "Very Low";
		description = "Oversupply or minimal interest";
		emoji = "❄️";
	}

	return {
		score,
		label,
		description,
		emoji,
		velocity7d: Math.round(velocity7d * 10) / 10,
		acceleration: Math.round(acceleration * 100) / 100,
		supplyRatio: Math.round(supplyRatio * 100),
	};
}

/**
 * Get comprehensive valuation data combining all advanced features
 * @param {string} collection - Collection slug
 * @param {Object} attributes - { model, backdrop, symbol }
 * @param {number} currentOnSale - Items currently on sale
 * @param {number} totalItems - Total items in collection
 * @returns {Object} Comprehensive valuation data
 */
export function getAdvancedValuationData(
	collection,
	attributes = {},
	currentOnSale = 0,
	totalItems = 1000,
) {
	const comboSales = getAttributeComboSales(collection, attributes);
	const forecast = calculate7DayForecast(collection);
	const demandSupply = getDemandSupplyScore(
		collection,
		currentOnSale,
		totalItems,
	);
	const stats = getCollectionStats(collection);

	// Calculate overall confidence
	let overallConfidence = 50;

	if (comboSales?.exactMatches >= 3) overallConfidence += 25;
	else if (comboSales?.exactMatches >= 1) overallConfidence += 10;

	if (forecast?.confidence >= 70) overallConfidence += 15;
	else if (forecast?.confidence >= 40) overallConfidence += 5;

	if (demandSupply?.score >= 60) overallConfidence += 10;

	overallConfidence = Math.min(100, overallConfidence);

	return {
		comboSales,
		forecast,
		demandSupply,
		stats,
		overallConfidence,
		confidenceLevel:
			overallConfidence >= 80
				? "ultra_high"
				: overallConfidence >= 60
					? "very_high"
					: overallConfidence >= 40
						? "high"
						: overallConfidence >= 20
							? "moderate"
							: "low",
	};
}

// Initialize on module load
initializeSalesHistory();

console.log(
	"📈 Sales History Service initialized (EWMA + Trend Analysis + Advanced Valuation)",
);
