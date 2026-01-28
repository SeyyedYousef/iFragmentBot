/**
 * Marketapp API Service
 * For fetching gift/NFT data from marketapp.ws
 * Integrated with changes.tg API for enhanced rarity data
 */

import fetch from 'node-fetch';
import * as seetg from './seetgService.js';
import { giftValuationCache } from './cacheService.js';
import * as salesHistory from './salesHistoryService.js';

// API Configuration
const MARKETAPP_API_BASE = 'https://api.marketapp.ws';
const CHANGES_API_BASE = 'https://api.changes.tg';
const API_TOKEN = process.env.MARKETAPP_API_TOKEN || '';

/**
 * Make authenticated API request to Marketapp
 */
async function apiRequest(endpoint, options = {}) {
    const url = `${MARKETAPP_API_BASE}${endpoint}`;

    const headers = {
        'Authorization': API_TOKEN,
        'Content-Type': 'application/json',
        ...options.headers
    };

    try {
        const response = await fetch(url, {
            ...options,
            headers
        });

        if (!response.ok) {
            throw new Error(`Marketapp API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`Marketapp API request failed: ${endpoint}`, error.message);
        throw error;
    }
}

/**
 * Fetch data from changes.tg API
 */
async function changesApiRequest(endpoint) {
    const url = `${CHANGES_API_BASE}${endpoint}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`Changes.tg API error: ${response.status}`);
            return null;
        }
        return await response.json();
    } catch (error) {
        console.warn(`Changes.tg API request failed: ${endpoint}`, error.message);
        return null;
    }
}

/**
 * Parse a gift link to extract collection name and item number
 * Supports: https://t.me/nft/CollectionName-123
 */
function parseGiftLink(link) {
    // Pattern: https://t.me/nft/CollectionName-ItemNumber
    const tmePattern = /t\.me\/nft\/([A-Za-z0-9_]+)-(\d+)/i;
    const match = link.match(tmePattern);

    if (match) {
        return {
            collectionSlug: match[1],
            itemNumber: parseInt(match[2], 10),
            isValid: true
        };
    }

    return { isValid: false };
}

/**
 * Get human-readable owner name from wallet address
 * Uses TONAPI to resolve TON DNS names
 */
async function getOwnerName(walletAddress) {
    if (!walletAddress) return null;

    try {
        // Try TONAPI to get account info with DNS name
        const response = await fetch(`https://tonapi.io/v2/accounts/${walletAddress}`);
        if (response.ok) {
            const data = await response.json();
            // Check if account has a name (TON DNS)
            if (data.name) {
                return data.name; // Returns like "@username.ton" or "username.t.me"
            }
        }
    } catch (error) {
        console.warn('TONAPI owner lookup failed:', error.message);
    }

    // Fallback: return shortened wallet address
    if (walletAddress.length > 20) {
        return walletAddress.substring(0, 8) + '...' + walletAddress.slice(-6);
    }
    return walletAddress;
}

/**
 * Get all gift collections with floor prices and stats
 */
async function getGiftCollections() {
    return await apiRequest('/v1/collections/gifts/');
}

/**
 * Get collection attributes (model, backdrop, symbol) with floor prices
 */
async function getCollectionAttributes(collectionAddress) {
    return await apiRequest(`/v1/collections/${collectionAddress}/attributes/`);
}

/**
 * Get gift rank in collection based on estimated value
 * and recent sales for comparison
 */
async function getGiftRankAndRecentSales(collectionAddress, collectionSlug, estimatedValue) {
    let rank = null;
    let recentSales = [];

    try {
        // Get all gifts on sale sorted by price to estimate rank
        const giftsOnSale = await getGiftsOnSale({
            collectionAddress
        });

        console.log(`📊 Ranking: Got ${giftsOnSale.items?.length || 0} items for ranking`);

        if (giftsOnSale.items && giftsOnSale.items.length > 0) {
            // Sort by price
            const sortedByPrice = [...giftsOnSale.items].sort((a, b) =>
                nanoToTon(b.min_bid) - nanoToTon(a.min_bid)
            );

            // Find rank (how many are priced higher)
            let higherPriced = 0;
            for (const gift of sortedByPrice) {
                if (nanoToTon(gift.min_bid) > estimatedValue) {
                    higherPriced++;
                } else {
                    break;
                }
            }

            rank = {
                position: higherPriced + 1,
                total: sortedByPrice.length,
                // Calculate percentile: what percentage of gifts are priced lower
                percentile: sortedByPrice.length > 0
                    ? Math.max(1, Math.round(((sortedByPrice.length - higherPriced) / sortedByPrice.length) * 100))
                    : 50
            };

            // Get a sample of recent/similar priced gifts for comparison
            const similarPriced = sortedByPrice
                .filter(g => {
                    const price = nanoToTon(g.min_bid);
                    return price >= estimatedValue * 0.7 && price <= estimatedValue * 1.3;
                })
                .slice(0, 3)
                .map(g => ({
                    number: g.item_num,
                    price: nanoToTon(g.min_bid),
                    link: `https://t.me/nft/${collectionSlug}-${g.item_num}`
                }));

            recentSales = similarPriced;
        }
    } catch (error) {
        console.warn('Error getting rank/sales:', error.message);
    }

    return { rank, recentSales };
}

/**
 * Get NFT info by address
 */
async function getNftInfo(nftAddress) {
    return await apiRequest(`/v1/nfts/${nftAddress}/`);
}

/**
 * Get gifts on sale with optional filters
 */
async function getGiftsOnSale(filters = {}) {
    const params = new URLSearchParams();

    if (filters.collectionAddress) params.append('collection_address', filters.collectionAddress);
    if (filters.model) params.append('model', filters.model);
    if (filters.symbol) params.append('symbol', filters.symbol);
    if (filters.backdrop) params.append('backdrop', filters.backdrop);
    if (filters.itemNumFrom) params.append('item_num_from', filters.itemNumFrom);
    if (filters.itemNumTo) params.append('item_num_to', filters.itemNumTo);
    if (filters.minPrice) params.append('min_price', filters.minPrice);
    if (filters.maxPrice) params.append('max_price', filters.maxPrice);
    if (filters.cursor) params.append('cursor', filters.cursor);

    // Default limit to 100 to get better ranking data
    params.append('limit', filters.limit || 100);

    const queryString = params.toString();
    return await apiRequest(`/v1/gifts/onsale/${queryString ? '?' + queryString : ''}`);
}

/**
 * Get market prices for similar gifts (same model, backdrop, or symbol)
 * Returns average and median prices for comparison, plus sample gift links
 * NOW WITH CACHING (15 min TTL)
 */
async function getMarketPricesForSimilarGifts(collectionAddress, collectionSlug, attributes = {}) {
    // Check cache first
    const cacheKey = `market_${collectionAddress}_${attributes.model || ''}_${attributes.backdrop || ''}_${attributes.symbol || ''}`;
    const cached = giftValuationCache.get(cacheKey);
    if (cached) {
        console.log('💾 Using cached market prices for', collectionSlug);
        return cached;
    }

    const data = {
        sameModel: { prices: [], samples: [] },
        sameBackdrop: { prices: [], samples: [] },
        sameSymbol: { prices: [], samples: [] }
    };

    try {
        // Get gifts with same model
        if (attributes.model) {
            const modelGifts = await getGiftsOnSale({
                collectionAddress,
                model: attributes.model
            });
            if (modelGifts.items && modelGifts.items.length > 0) {
                data.sameModel.prices = modelGifts.items.map(g => nanoToTon(g.min_bid)).filter(p => p > 0);
                // Store first 3 samples for links
                data.sameModel.samples = modelGifts.items.slice(0, 3).map(g => ({
                    number: g.item_num,
                    price: nanoToTon(g.min_bid),
                    link: `https://t.me/nft/${collectionSlug}-${g.item_num}`
                }));
            }
        }

        // Get gifts with same backdrop
        if (attributes.backdrop) {
            const backdropGifts = await getGiftsOnSale({
                collectionAddress,
                backdrop: attributes.backdrop
            });
            if (backdropGifts.items && backdropGifts.items.length > 0) {
                data.sameBackdrop.prices = backdropGifts.items.map(g => nanoToTon(g.min_bid)).filter(p => p > 0);
                data.sameBackdrop.samples = backdropGifts.items.slice(0, 3).map(g => ({
                    number: g.item_num,
                    price: nanoToTon(g.min_bid),
                    link: `https://t.me/nft/${collectionSlug}-${g.item_num}`
                }));
            }
        }

        // Get gifts with same symbol
        if (attributes.symbol) {
            const symbolGifts = await getGiftsOnSale({
                collectionAddress,
                symbol: attributes.symbol
            });
            if (symbolGifts.items && symbolGifts.items.length > 0) {
                data.sameSymbol.prices = symbolGifts.items.map(g => nanoToTon(g.min_bid)).filter(p => p > 0);
                data.sameSymbol.samples = symbolGifts.items.slice(0, 3).map(g => ({
                    number: g.item_num,
                    price: nanoToTon(g.min_bid),
                    link: `https://t.me/nft/${collectionSlug}-${g.item_num}`
                }));
            }
        }

    } catch (error) {
        console.warn('Error fetching similar gift prices:', error.message);
    }

    // Calculate statistics
    const calcStats = (arr) => {
        if (arr.length === 0) return null;
        const sorted = [...arr].sort((a, b) => a - b);
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
        const median = arr.length % 2 === 0
            ? (sorted[arr.length / 2 - 1] + sorted[arr.length / 2]) / 2
            : sorted[Math.floor(arr.length / 2)];
        return { min, max, avg, median, count: arr.length };
    };

    const result = {
        model: { ...calcStats(data.sameModel.prices), samples: data.sameModel.samples },
        backdrop: { ...calcStats(data.sameBackdrop.prices), samples: data.sameBackdrop.samples },
        symbol: { ...calcStats(data.sameSymbol.prices), samples: data.sameSymbol.samples }
    };

    // Save to cache
    giftValuationCache.set(cacheKey, result);
    console.log('📦 Cached market prices for', collectionSlug);

    return result;
}

/**
 * Find collection by slug/name
 */
async function findCollectionBySlug(slug) {
    try {
        const collections = await getGiftCollections();

        // Normalize slug for comparison
        const normalizedSlug = slug.toLowerCase().replace(/[_\s]/g, '');

        for (const collection of collections) {
            const normalizedName = collection.name.toLowerCase().replace(/[_\s]/g, '');
            if (normalizedName === normalizedSlug || normalizedName.includes(normalizedSlug)) {
                return collection;
            }
        }
    } catch (error) {
        console.warn(`⚠️ findCollectionBySlug failed (API error): ${error.message}`);
    }

    return null;
}

/**
 * Get attribute details (floor price, count, percentage) for a specific value
 */
function findAttributeValue(attributes, traitType, value) {
    for (const attr of attributes) {
        if (attr.trait_type.toLowerCase() === traitType.toLowerCase()) {
            for (const val of attr.values) {
                if (val.value.toLowerCase() === value.toLowerCase()) {
                    return val;
                }
            }
        }
    }
    return null;
}

/**
 * Convert nanotons to TON
 */
function nanoToTon(nanotons) {
    if (!nanotons) return 0;
    const num = typeof nanotons === 'string' ? parseFloat(nanotons) : nanotons;
    // If the number is very large (>1000000), it's probably in nanotons
    if (num > 1000000) {
        return num / 1e9;
    }
    return num;
}

/**
 * Get rarity tier based on percentage
 */
function getRarityTier(percentage) {
    if (percentage <= 1) return { tier: 'Legendary', emoji: '🏆' };
    if (percentage <= 5) return { tier: 'Ultra Rare', emoji: '💎' };
    if (percentage <= 10) return { tier: 'Very Rare', emoji: '🌟' };
    if (percentage <= 25) return { tier: 'Rare', emoji: '✨' };
    if (percentage <= 50) return { tier: 'Uncommon', emoji: '🔷' };
    return { tier: 'Common', emoji: '⚪' };
}

/**
 * Get rarity from changes.tg API (1-3 scale or 0.2-0.5 scale)
 */
function getChangesRarityTier(rarityValue) {
    // For models/backdrops (1-3 scale): 1 = rarest, 3 = common
    // For symbols (0.2-0.5 scale): lower = rarer
    if (rarityValue <= 0.5) {
        // Symbol scale
        if (rarityValue <= 0.2) return { tier: 'Legendary', emoji: '🏆', score: 95 };
        if (rarityValue <= 0.3) return { tier: 'Ultra Rare', emoji: '💎', score: 85 };
        if (rarityValue <= 0.4) return { tier: 'Very Rare', emoji: '🌟', score: 75 };
        return { tier: 'Rare', emoji: '✨', score: 65 };
    } else {
        // Model/Backdrop scale (1-3)
        if (rarityValue === 1) return { tier: 'Legend', emoji: '🏆', score: 90 };
        if (rarityValue === 1.5) return { tier: 'Ultra Rare', emoji: '💎', score: 75 };
        if (rarityValue === 2) return { tier: 'Rare', emoji: '✨', score: 50 };
        return { tier: 'Common', emoji: '⚪', score: 25 };
    }
}

/**
 * PREMIUM VALUE ESTIMATION ALGORITHM
 * 
 * Factors considered:
 * 1. Floor prices (collection, model, backdrop, symbol)
 * 2. Gift number (low numbers & round numbers worth more)
 * 3. Color matching (same/similar model & backdrop colors)
 * 4. Premium backdrops (Black, Onyx, Gold, etc.)
 * 5. Rarity scores from changes.tg
 * 6. Supply ratio (fewer on sale = higher value)
 */

// Premium backdrop colors that significantly increase value
const PREMIUM_BACKDROPS = {
    'black': 2.5,
    'onyx black': 2.5,
    'onyx': 2.0,
    'pure gold': 2.2,
    'satin gold': 2.0,
    'platinum': 1.8,
    'emerald': 1.6,
    'sapphire': 1.5,
    'midnight blue': 1.4,
    'cyberpunk': 1.5,
    'malachite': 1.4
};

// ==========================================
// 🧠 ALPHABET-CLASS VALUATION ALGORITHM
// ==========================================

function getNumberBonus(itemNumber) {
    if (!itemNumber) return 1.0;

    // #1 is a grail
    if (itemNumber === 1) return 5.0; // +400%

    // Single digits #2-#9 (Reduced from 3.0)
    if (itemNumber <= 9) return 2.5; // +150%

    // Double digits #10-#99 (Reduced from 1.5)
    if (itemNumber <= 99) return 1.25; // +25%

    // Round numbers (100, 200... 1000)
    if (itemNumber % 100 === 0) return 1.15; // +15%
    if (itemNumber % 10 === 0) return 1.05; // +5% (Minimal boost)

    // Triple digits #100-#999
    if (itemNumber <= 999) return 1.1; // +10%

    // Palindromes (e.g. 121, 555)
    const s = itemNumber.toString();
    if (s === s.split('').reverse().join('') && s.length >= 3) return 1.3; // +30%

    // Repdigits (e.g. 777, 8888)
    if (/^(\d)\1+$/.test(s) && s.length >= 3) return 1.5; // +50%

    return 1.0;
}

function getColorMatchBonus(modelName, backdropName) {
    if (!modelName || !backdropName) return 1.0;

    const m = modelName.toLowerCase();
    const b = backdropName.toLowerCase();

    // Perfect matches
    if (m.includes(b) || b.includes(m)) return 1.3; // +30%

    // Color families
    const colors = {
        'blue': ['sky', 'ocean', 'blue', 'sapphire', 'azure'],
        'red': ['red', 'ruby', 'crimson', 'mars', 'cherry'],
        'green': ['green', 'emerald', 'lime', 'forest', 'jade'],
        'gold': ['gold', 'yellow', 'solar', 'amber'],
        'purple': ['purple', 'violet', 'amethyst', 'lavender'],
        'black': ['black', 'obsidian', 'onyx', 'dark', 'midnight']
    };

    for (const group of Object.values(colors)) {
        const modelHas = group.some(c => m.includes(c));
        const backHas = group.some(c => b.includes(c));
        if (modelHas && backHas) return 1.15; // +15%
    }

    return 1.0;
}

function getBackdropPremium(backdropName) {
    if (!backdropName) return 1.0;
    const lower = backdropName.toLowerCase();

    for (const [name, multiplier] of Object.entries(PREMIUM_BACKDROPS)) {
        if (lower.includes(name) || name.includes(lower)) {
            return multiplier;
        }
    }

    return 1.0;
}

function smartRound(value) {
    if (value < 10) return Math.round(value * 10) / 10;
    if (value < 50) return Math.round(value); // 47
    if (value < 100) return Math.round(value / 5) * 5; // 85
    if (value < 1000) return Math.round(value / 10) * 10; // 850
    if (value < 10000) return Math.round(value / 50) * 50; // 1250
    return Math.round(value / 100) * 100; // 12500
}

function generateAppraiserNote(estimation, attributes, extras) {
    const { itemNumber, modelName, backdropName, symbolName, valueVsFloor, marketData } = extras;
    const premiumFactor = estimation.totalMultiplier;

    // VERDICT
    let verdict = "Standard Asset";

    if (premiumFactor >= 10.0) verdict = "HOLY GRAIL 🏆";
    else if (premiumFactor >= 5.0) verdict = "MUSEUM GRADE 🏛️";
    else if (premiumFactor >= 3.0) verdict = "LEGENDARY 🦄";
    else if (premiumFactor >= 2.0) verdict = "BLUE CHIP 💎";
    else if (premiumFactor >= 1.5) verdict = "PREMIUM ✨";
    else if (premiumFactor >= 1.2) verdict = "RARE FIND 🔍";

    let note = `📊 *Verdict: ${verdict}*\n`;

    // ANALYSIS (Dynamic & Specific)
    let analysisParts = [];

    // 1. Identify key driver
    if (itemNumber === 1) {
        analysisParts.push(`The #1 serial confers absolute grail status to this asset`);
    } else if (itemNumber <= 9) {
        analysisParts.push(`Single-digit serial #${itemNumber} drives the elite valuation`);
    } else if (itemNumber <= 100) {
        analysisParts.push(`Low serial #${itemNumber} ensures significant collector interest`);
    } else if (marketData && valueVsFloor > 20) {
        analysisParts.push(`Strong market demand confirms the ${Math.round(valueVsFloor)}% premium`);
    } else if (modelName) {
        analysisParts.push(`This ${modelName} asset holds a stable market position`);
    } else {
        analysisParts.push(`This asset represents a standard entry into the collection`);
    }

    // 2. Mention specific attributes
    let traits = [];
    if (backdropName) traits.push(backdropName);

    if (traits.length > 0) {
        analysisParts.push(`featuring the ${traits.join(' / ')} background`);
    }

    // 3. Conclusion
    if (premiumFactor > 2.0) {
        analysisParts.push(`making it a definitive collector's item.`);
    } else if (premiumFactor > 1.3) {
        analysisParts.push(`offering distinct advantages over floor models.`);
    } else {
        analysisParts.push(`offering solid value retention.`);
    }

    let analysis = analysisParts.join(', ') + (analysisParts.length > 0 && !analysisParts[analysisParts.length - 1].endsWith('.') ? '.' : '');
    // Clean up grammar
    analysis = analysis.charAt(0).toUpperCase() + analysis.slice(1);

    note += `_${analysis}_`;

    return {
        text: note,
        verdict: verdict,
        analysis: analysis
    };
}

function estimateGiftValue(collectionFloor, attributeFloors, attributeRarities, totalItems, onSale, extras = {}) {
    const {
        itemNumber = 0,
        modelName = '',
        backdropName = '',
        symbolName = '',
        marketPrices = null,
        collectionSlug = '' // New: for historical data
    } = extras;

    // ═══════════════════════════════════════
    // 🧠 ENHANCED VALUE ESTIMATION V2.0
    // ═══════════════════════════════════════

    // 1. INPUT VALIDATION
    if (!collectionFloor && !attributeFloors.model && !attributeFloors.backdrop) {
        return {
            estimated: 0,
            confidence: 'very_low',
            confidenceScore: 10,
            multiplier: 1,
            bonuses: [],
            marketData: null,
            badges: [],
            appraiserNote: "⚠️ Insufficient data for valuation.",
            dataQuality: { score: 0, level: 'poor', sources: [] }
        };
    }

    // 2. CALCULATE DATA QUALITY SCORE
    const dataQuality = calculateDataQuality({
        collectionFloor,
        attributeFloors,
        marketPrices,
        hasRarityData: attributeRarities.model > 0 || attributeRarities.backdrop > 0
    });

    // 3. BASE VALUE CALCULATION (Improved Weighting)
    const modelFloor = attributeFloors.model || 0;
    const backdropFloor = attributeFloors.backdrop || 0;
    const symbolFloor = attributeFloors.symbol || 0;

    const floors = [collectionFloor, modelFloor, backdropFloor, symbolFloor].filter(f => f > 0).sort((a, b) => b - a);

    if (floors.length === 0) {
        return {
            estimated: 0,
            confidence: 'very_low',
            confidenceScore: 10,
            multiplier: 1,
            bonuses: [],
            marketData: null,
            badges: [],
            appraiserNote: "⚠️ No floor price data available.",
            dataQuality
        };
    }

    // Primary driver is the highest floor trait
    let baseValue = floors[0];

    // Secondary trait contributes 10%
    if (floors.length > 1) {
        baseValue += floors[1] * 0.1;
    }

    let bonuses = [];
    let additivePremium = 0;
    let marketData = null;
    let historicalPrediction = null;
    let advancedData = null;

    // 4. ADVANCED HISTORICAL ANALYSIS V3.0
    if (collectionSlug) {
        try {
            // Get advanced valuation data
            advancedData = salesHistory.getAdvancedValuationData(
                collectionSlug,
                { model: modelName, backdrop: backdropName, symbol: symbolName },
                onSale,
                totalItems
            );

            // 4a. Historical Combo Sales (exact/partial attribute matches)
            if (advancedData?.comboSales?.weightedAverage) {
                const comboAvg = advancedData.comboSales.weightedAverage;
                // If combo sales prices are higher, boost the estimate
                if (comboAvg > baseValue) {
                    const weight = advancedData.comboSales.exactMatches >= 3 ? 0.5 : 0.3;
                    const oldBase = baseValue;
                    baseValue = (comboAvg * weight) + (baseValue * (1 - weight));
                    const boost = Math.round(((baseValue / oldBase) - 1) * 100);
                    bonuses.push(`📜 Similar sales (+${boost}%)`);
                }
            }

            // 4b. EWMA Prediction (existing)
            const historicalSales = salesHistory.getSalesHistory(collectionSlug, 30);
            if (historicalSales.length >= 3) {
                const prices = historicalSales.map(s => s.price);
                const prediction = salesHistory.calculatePricePrediction(prices);

                if (prediction.prediction && prediction.confidence >= 50) {
                    historicalPrediction = prediction;

                    // Blend EWMA prediction with floor-based estimate (40% EWMA, 60% floors)
                    if (prediction.prediction > baseValue * 0.8 && prediction.prediction < baseValue * 3) {
                        const blendedValue = (prediction.prediction * 0.4) + (baseValue * 0.6);
                        if (blendedValue > baseValue) {
                            const boost = Math.round(((blendedValue / baseValue) - 1) * 100);
                            bonuses.push(`📈 EWMA trend (+${boost}%)`);
                            baseValue = blendedValue;
                        }
                    }
                }
            }

            // 4c. 7-Day Price Forecast
            if (advancedData?.forecast?.trend === 'rising' || advancedData?.forecast?.trend === 'slightly_rising') {
                const forecastBoost = advancedData.forecast.changePercent > 10 ? 0.08 : 0.04;
                additivePremium += forecastBoost;
                bonuses.push(`🔮 7d forecast (+${Math.round(forecastBoost * 100)}%)`);
            }

            // 4d. Demand/Supply Score Premium
            if (advancedData?.demandSupply?.score >= 70) {
                const demandBoost = advancedData.demandSupply.score >= 80 ? 0.1 : 0.05;
                additivePremium += demandBoost;
                bonuses.push(`${advancedData.demandSupply.emoji} High demand (+${Math.round(demandBoost * 100)}%)`);
            }

        } catch (e) {
            console.warn('⚠️ Advanced analysis failed:', e.message);
        }
    }

    // 5. REAL MARKET DATA INTEGRATION (Enhanced V2.2 - Optimistic Mode)
    // Only increases estimate when market prices are HIGHER (never decreases)
    if (marketPrices) {
        const medians = [];
        if (marketPrices.model?.median) medians.push(marketPrices.model.median);
        if (marketPrices.backdrop?.median) medians.push(marketPrices.backdrop.median);
        if (marketPrices.symbol?.median) medians.push(marketPrices.symbol.median);

        if (medians.length > 0) {
            const marketMedian = medians.reduce((a, b) => a + b, 0) / medians.length;
            const totalSamples = (marketPrices.model?.count || 0) +
                (marketPrices.backdrop?.count || 0) +
                (marketPrices.symbol?.count || 0);

            // Only apply market data if it would INCREASE the estimate
            if (marketMedian > baseValue) {
                // Dynamic weighting based on sample count (more samples = more trust)
                let marketWeight = 0.3;  // Base: 30% market weight
                if (totalSamples >= 5) marketWeight = 0.4;   // 40% if 5+ samples
                if (totalSamples >= 10) marketWeight = 0.5;  // 50% if 10+ samples
                if (totalSamples >= 20) marketWeight = 0.6;  // 60% if 20+ samples

                const oldBase = baseValue;
                baseValue = (marketMedian * marketWeight) + (baseValue * (1 - marketWeight));

                const diff = Math.round((baseValue / oldBase - 1) * 100);
                bonuses.push(`📊 Market pricing (+${diff}%)`);
            }

            marketData = {
                modelMedian: marketPrices.model?.median,
                modelCount: marketPrices.model?.count || 0,
                backdropMedian: marketPrices.backdrop?.median,
                backdropCount: marketPrices.backdrop?.count || 0,
                symbolMedian: marketPrices.symbol?.median,
                symbolCount: marketPrices.symbol?.count || 0,
                totalSamples,
                marketWeight: marketMedian > baseValue ? 50 : 0
            };
        }
    }

    // 6. TREND FACTOR (NEW! - adjusts based on market momentum)
    if (collectionSlug) {
        const trendFactor = salesHistory.getTrendFactor(collectionSlug);
        if (trendFactor !== 1.0) {
            const trendPercent = Math.round((trendFactor - 1) * 100);
            if (trendFactor > 1) {
                bonuses.push(`🚀 Rising trend (+${trendPercent}%)`);
            } else {
                bonuses.push(`📉 Declining trend (${trendPercent}%)`);
            }
            baseValue *= trendFactor;
        }
    }

    // 7. ADDITIVE PREMIUMS
    const numMult = getNumberBonus(itemNumber);
    if (numMult > 1) {
        const premium = numMult - 1;
        additivePremium += premium;
        let label = `🔢 Special number`;
        if (itemNumber <= 9) label = `🔢 Single digit`;
        else if (itemNumber <= 99) label = `🔢 Double digit`;
        bonuses.push(`${label} (+${Math.round(premium * 100)}%)`);
    }

    const colMult = getColorMatchBonus(modelName, backdropName);
    if (colMult > 1) {
        const premium = colMult - 1;
        additivePremium += premium;
        bonuses.push(`🎨 Visual synergy (+${Math.round(premium * 100)}%)`);
    }

    // 8. DYNAMIC BACKDROP PREMIUM (Based on market activity)
    const basePremiumMult = getBackdropPremium(backdropName);
    let dynamicBackdropMult = basePremiumMult;

    // Adjust based on how many are on sale (scarcity)
    if (basePremiumMult > 1 && marketPrices?.backdrop?.count) {
        if (marketPrices.backdrop.count < 5) {
            dynamicBackdropMult *= 1.15; // 15% extra for very scarce
        } else if (marketPrices.backdrop.count > 50) {
            dynamicBackdropMult *= 0.95; // 5% less for oversupply
        }
    }

    if (dynamicBackdropMult > 1) {
        const premium = dynamicBackdropMult - 1;
        additivePremium += premium;
        bonuses.push(`✨ Premium backdrop (+${Math.round(premium * 100)}%)`);
    }

    // 9. RARITY SCORING
    const rarityScores = [
        attributeRarities.model || 50,
        attributeRarities.backdrop || 50,
        attributeRarities.symbol || 50
    ];
    const avgRarityScore = rarityScores.reduce((a, b) => a + b, 0) / rarityScores.length;

    if (avgRarityScore > 70) {
        let rarityPremium = 0;

        if (avgRarityScore >= 99) rarityPremium = 1.0; // +100% (Top 1%)
        else if (avgRarityScore >= 95) rarityPremium = 0.5; // +50% (Top 5%)
        else if (avgRarityScore >= 90) rarityPremium = 0.2; // +20% (Top 10%)
        else if (avgRarityScore >= 80) rarityPremium = 0.1; // +10%

        additivePremium += rarityPremium;
        if (rarityPremium >= 0.2) {
            bonuses.push(`💎 High rarity (+${Math.round(rarityPremium * 100)}%)`);
        }
    }

    // 10. SUPPLY FACTOR
    if (totalItems > 0 && onSale > 0) {
        const saleRatio = onSale / totalItems;
        if (saleRatio < 0.05) {
            additivePremium += 0.2;
            bonuses.push(`📉 Low supply (+20%)`);
        } else if (saleRatio > 0.3) {
            additivePremium -= 0.1;
            bonuses.push(`📈 High supply (-10%)`);
        }
    }

    // 11. CALCULATE FINAL VALUE
    let finalMultiplier = 1 + additivePremium;
    let estimated = baseValue * finalMultiplier;
    estimated = smartRound(estimated);

    // 12. GENERATE BADGES
    const badges = [];
    if (itemNumber <= 100) badges.push('💎 GEM');
    if (finalMultiplier > 2.0) badges.push('🔥 HOT');
    if (avgRarityScore > 90) badges.push('🦄 ULTRA RARE');
    if (marketData) badges.push('🛡️ VERIFIED');
    if (historicalPrediction) badges.push('📊 EWMA');

    // 13. 5-LEVEL CONFIDENCE SYSTEM (NEW!)
    const { confidence, confidenceScore } = calculate5LevelConfidence({
        floors,
        marketPrices,
        historicalPrediction,
        dataQuality,
        avgRarityScore
    });

    // 14. APPRAISER NOTE
    const valueVsFloor = floors[0] > 0 ? ((estimated - floors[0]) / floors[0] * 100) : 0;
    const appraiserData = generateAppraiserNote(
        { totalMultiplier: finalMultiplier, avgRarityScore, estimated },
        {},
        { itemNumber, modelName, backdropName, symbolName, valueVsFloor, marketData }
    );
    const appraiserNote = appraiserData.text;

    return {
        estimated: estimated,
        baseValue: Math.round(baseValue),
        totalMultiplier: Math.round(finalMultiplier * 100) / 100,
        avgRarityScore: Math.round(avgRarityScore),
        supplyMultiplier: 1.0,
        confidence,
        confidenceScore,
        bonuses,
        marketData,
        badges,
        appraiserNote,
        verdict: appraiserData.verdict,
        appraiserData,
        dataQuality,
        historicalPrediction,
        advancedData, // NEW: Includes combo sales, forecast, demand/supply
        // Confidence interval for advanced users
        valueRange: historicalPrediction ? {
            low: Math.round(estimated * 0.85),
            high: Math.round(estimated * 1.15)
        } : null
    };
}

/**
 * Calculate 5-Level Confidence Score
 * @returns {{ confidence: string, confidenceScore: number }}
 */
function calculate5LevelConfidence({ floors, marketPrices, historicalPrediction, dataQuality, avgRarityScore }) {
    let score = 0;

    // Floor price data (max 25 points)
    score += Math.min(25, floors.length * 8);

    // Market data (max 25 points)
    if (marketPrices) {
        const totalCount = (marketPrices.model?.count || 0) + (marketPrices.backdrop?.count || 0);
        score += Math.min(25, totalCount * 2);
    }

    // Historical prediction (max 25 points)
    if (historicalPrediction && historicalPrediction.confidence) {
        score += Math.round(historicalPrediction.confidence * 0.25);
    }

    // Data quality (max 25 points)
    score += Math.round(dataQuality.score * 0.25);

    // Determine confidence level
    let confidence;
    if (score >= 85) confidence = 'ultra_high';
    else if (score >= 70) confidence = 'very_high';
    else if (score >= 50) confidence = 'high';
    else if (score >= 30) confidence = 'moderate';
    else confidence = 'low';

    return { confidence, confidenceScore: Math.min(100, score) };
}

/**
 * Calculate Data Quality Score
 * @returns {{ score: number, level: string, sources: string[] }}
 */
function calculateDataQuality(sources) {
    let score = 0;
    const sourceList = [];

    // Floor price (20 points)
    if (sources.collectionFloor && sources.collectionFloor > 0) {
        score += 20;
        sourceList.push('collection_floor');
    }

    // Attribute floors (20 points)
    if (sources.attributeFloors) {
        const attrCount = Object.values(sources.attributeFloors).filter(v => v > 0).length;
        score += Math.min(20, attrCount * 7);
        if (attrCount > 0) sourceList.push('attribute_floors');
    }

    // Market prices (30 points)
    if (sources.marketPrices) {
        const totalCount =
            (sources.marketPrices.model?.count || 0) +
            (sources.marketPrices.backdrop?.count || 0) +
            (sources.marketPrices.symbol?.count || 0);
        score += Math.min(30, totalCount * 3);
        if (totalCount > 0) sourceList.push('market_prices');
    }

    // Rarity data (15 points)
    if (sources.hasRarityData) {
        score += 15;
        sourceList.push('rarity_data');
    }

    // Historical data (15 points) - checked elsewhere
    // Will be added by caller if available

    let level;
    if (score >= 80) level = 'excellent';
    else if (score >= 60) level = 'good';
    else if (score >= 40) level = 'fair';
    else level = 'poor';

    return { score, level, sources: sourceList };
}



/**
 * Format large numbers with commas
 */
function formatNumber(num) {
    if (!num) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Shorten wallet address
 */
function shortenAddress(address) {
    if (!address || address.length < 10) return address || 'Unknown';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Get status emoji and text
 */
function getStatusDisplay(status) {
    const statusMap = {
        'for_sale': { emoji: '🟢', text: 'For Sale' },
        'on_auction': { emoji: '🔴', text: 'On Auction' },
        'for_rent': { emoji: '🟡', text: 'For Rent' },
        'rented': { emoji: '🟠', text: 'Rented' },
        'expired': { emoji: '⚫', text: 'Expired' },
        'not_for_sale': { emoji: '🔵', text: 'Not For Sale' }
    };
    return statusMap[status] || { emoji: '❓', text: 'Unknown' };
}

/**
 * Get enhanced rarity data from changes.tg API
 */
async function getEnhancedRarityData(collectionSlug, model, backdrop, symbol) {
    const changesData = await changesApiRequest(`/gift/${collectionSlug}`);
    if (!changesData) return null;

    const result = {
        model: null,
        backdrop: null,
        symbol: null
    };

    // Find model rarity
    if (model && changesData.models) {
        const found = changesData.models.find(m =>
            m.name.toLowerCase() === model.toLowerCase()
        );
        if (found) {
            result.model = {
                name: found.name,
                rarity: found.rarity,
                tier: getChangesRarityTier(found.rarity)
            };
        }
    }

    // Find backdrop rarity
    if (backdrop && changesData.backdrops) {
        const found = changesData.backdrops.find(b =>
            b.name.toLowerCase() === backdrop.toLowerCase()
        );
        if (found) {
            result.backdrop = {
                name: found.name,
                rarity: found.rarity,
                tier: getChangesRarityTier(found.rarity)
            };
        }
    }

    // Find symbol rarity
    if (symbol && changesData.symbols) {
        const found = changesData.symbols.find(s =>
            s.name.toLowerCase() === symbol.toLowerCase()
        );
        if (found) {
            result.symbol = {
                name: found.name,
                rarity: found.rarity,
                tier: getChangesRarityTier(found.rarity)
            };
        }
    }

    return result;
}

/**
 * Generate full gift report
 */
async function generateGiftReport(giftLink, tonPrice = 5.5) {
    const parsed = parseGiftLink(giftLink);

    if (!parsed.isValid) {
        throw new Error('Invalid gift link format. Please use a link like: https://t.me/nft/PlushPepe-1');
    }

    // Find collection
    let collection = await findCollectionBySlug(parsed.collectionSlug);

    // Fallback: If collection not found in Marketapp, try to fetch info from Telegram
    let telegramInfo = null;

    if (!collection) {
        console.log(`⚠️ Collection "${parsed.collectionSlug}" not found in API. Trying Telegram fallback...`);
        try {
            const { getGiftInfo } = await import('./telegramClientService.js');
            const tgResult = await getGiftInfo(parsed.collectionSlug, parsed.itemNumber);

            if (tgResult && tgResult.success && tgResult.data) {
                telegramInfo = tgResult.data;
                console.log('✅ Fetched info from Telegram:', telegramInfo.title);

                // Retry finding collection with the title from Telegram
                // Sometimes slug is "durovscap" but name is "Durov's Cap"
                collection = await findCollectionBySlug(telegramInfo.title);

                // If still not found, create a "virtual" collection object so we can proceed
                if (!collection) {
                    console.log('⚠️ Collection still not found in API. Using virtual collection.');
                    collection = {
                        name: telegramInfo.title,
                        slug: parsed.collectionSlug,
                        address: 'unknown', // We won't have the address
                        virtual: true // Marker to skip floor price checks
                    };
                }
            }
        } catch (err) {
            console.warn('⚠️ Telegram fallback failed:', err.message);
        }
    }

    if (!collection) {
        throw new Error(`Collection "${parsed.collectionSlug}" not found. Please check the link.`);
    }

    // Get collection attributes (only if not virtual)
    let attributes = [];
    let attributeFloors = {};
    let attributePercentages = {};
    let attributeDetails = {};
    let collectionFloor = 0;

    if (!collection.virtual) {
        try {
            const attributesResponse = await getCollectionAttributes(collection.address);
            if (attributesResponse) {
                attributes = attributesResponse.attributes || [];
                collectionFloor = nanoToTon(attributesResponse.floor_price) || 0;
            }
        } catch (e) {
            console.warn('⚠️ Failed to fetch attributes:', e.message);
        }
    }


    // Get gifts on sale to find our specific gift
    // ONLY if not virtual (known collection)
    let giftsOnSale = { items: [] };
    if (!collection.virtual) {
        try {
            giftsOnSale = await getGiftsOnSale({
                collectionAddress: collection.address,
                itemNumFrom: parsed.itemNumber,
                itemNumTo: parsed.itemNumber
            });
        } catch (e) {
            console.warn(`⚠️ Failed to check gifts on sale: ${e.message}`);
        }
    }

    // Try to find specific gift info
    let giftData = null;
    let giftStatus = 'not_for_sale';
    let giftPrice = null;
    let giftAttributes = {};
    let giftOwner = null;

    if (giftsOnSale.items && giftsOnSale.items.length > 0) {
        giftData = giftsOnSale.items[0];
        giftStatus = 'for_sale';
        giftPrice = nanoToTon(giftData.min_bid);
        giftOwner = giftData.real_owner;

        // Extract attributes from gift data
        if (giftData.attributes) {
            for (const attr of giftData.attributes) {
                giftAttributes[attr.trait_type.toLowerCase()] = attr.value;
            }
        }
    }

    // Fallback: If attributes are missing (e.g. not for sale), try to fetch from Telegram
    if (Object.keys(giftAttributes).length === 0) {
        try {
            const { getGiftInfo } = await import('./telegramClientService.js');
            const tgResult = await getGiftInfo(parsed.collectionSlug, parsed.itemNumber);

            if (tgResult && tgResult.success && tgResult.data && tgResult.data.attributes) {
                console.log('✅ Fetched attributes from Telegram:', tgResult.data.attributes);
                // Convert lowercase keys to proper format if needed, though consistency is key
                // Our logic below expects lowercase keys for the loop
                if (tgResult.data.attributes.model) giftAttributes['model'] = tgResult.data.attributes.model;
                if (tgResult.data.attributes.backdrop) giftAttributes['backdrop'] = tgResult.data.attributes.backdrop;
                if (tgResult.data.attributes.symbol) giftAttributes['symbol'] = tgResult.data.attributes.symbol;
            }
        } catch (err) {
            console.warn('⚠️ Failed to fetch from Telegram:', err.message);
        }
    }

    // NOTE: If gift is not on sale, we cannot get its specific attributes from Marketapp API
    // The attributes are only available for gifts currently listed for sale
    // We'll show a message in the report indicating this limitation

    // Get floor prices for each attribute
    attributePercentages = {};
    attributeDetails = {};

    for (const traitType of ['Model', 'Backdrop', 'Symbol']) {
        const value = giftAttributes[traitType.toLowerCase()];
        if (value) {
            const attrData = findAttributeValue(attributes, traitType, value);
            if (attrData) {
                // Convert floor from nanotons to TON
                const floor = nanoToTon(attrData.floor);
                attributeFloors[traitType.toLowerCase()] = floor;
                attributePercentages[traitType.toLowerCase()] = attrData.perc || 100;
                attributeDetails[traitType.toLowerCase()] = {
                    value,
                    floor,
                    percentage: attrData.perc || 0,
                    count: attrData.count || 0,
                    rarity: getRarityTier(attrData.perc || 100)
                };
            }
        }
    }

    // Get enhanced rarity data from changes.tg
    const changesRarity = await getEnhancedRarityData(
        parsed.collectionSlug,
        giftAttributes.model,
        giftAttributes.backdrop,
        giftAttributes.symbol
    );

    // Merge changes.tg rarity into attribute details
    const attributeRarities = { model: 50, backdrop: 50, symbol: 50 };
    if (changesRarity) {
        if (changesRarity.model) {
            attributeRarities.model = changesRarity.model.tier.score;
            if (attributeDetails.model) {
                attributeDetails.model.changesRarity = changesRarity.model;
            }
        }
        if (changesRarity.backdrop) {
            attributeRarities.backdrop = changesRarity.backdrop.tier.score;
            if (attributeDetails.backdrop) {
                attributeDetails.backdrop.changesRarity = changesRarity.backdrop;
            }
        }
        if (changesRarity.symbol) {
            attributeRarities.symbol = changesRarity.symbol.tier.score;
            if (attributeDetails.symbol) {
                attributeDetails.symbol.changesRarity = changesRarity.symbol;
            }
        }
    }

    // Collection stats - convert from nanotons
    const stats = collection.extra_data || {};
    if (stats.floor) {
        collectionFloor = nanoToTon(stats.floor);
    }
    const totalItems = stats.items || 0;
    const owners = stats.owners || 0;
    const onSale = stats.on_sale_all || stats.on_sale_onchain || 0;
    const volume7d = nanoToTon(stats.volume7d);
    const volume30d = nanoToTon(stats.volume30d);

    // ═══ FETCH SEE.TG ENHANCED DATA ═══
    let seetgData = {
        ownerUsername: null,
        ownerName: null,
        floorChange24h: null,
        floorChange7d: null,
        transferCount: 0,
        lastTransfer: null,
        rank: null
    };

    try {
        console.log('📊 Fetching See.tg data...');

        // Get gift info from See.tg (includes owner)
        const seetgGift = await seetg.getGiftInfo(parsed.collectionSlug, parsed.itemNumber);
        if (seetgGift) {
            console.log('✅ See.tg gift data:', JSON.stringify(seetgGift, null, 2));
            seetgData.ownerUsername = seetgGift.ownerUsername;
            seetgData.ownerName = seetgGift.ownerName;
            seetgData.rank = seetgGift.rank;
            seetgData.image = seetgGift.image; // Capture image
        }

        // If no owner username from gift, try to get it from wallet address
        if (!seetgData.ownerUsername && giftOwner) {
            console.log('📍 Trying to get owner info from wallet:', giftOwner);
            const ownerInfo = await seetg.getOwnerInfo(giftOwner);
            if (ownerInfo) {
                console.log('✅ See.tg owner data:', ownerInfo.username || 'no username');
                seetgData.ownerUsername = ownerInfo.username;
                seetgData.ownerName = ownerInfo.name;
            }
        }

        // Get floor changes
        const floorChanges = await seetg.getFloorChanges(parsed.collectionSlug);
        if (floorChanges) {
            seetgData.floorChange24h = floorChanges.change24h;
            seetgData.floorChange7d = floorChanges.change7d;
        }

        // Get gift history (transfers)
        const history = await seetg.getGiftHistory(parsed.collectionSlug, parsed.itemNumber);
        if (history) {
            seetgData.transferCount = history.totalTransfers;
            seetgData.lastTransfer = history.lastTransfer;
        }

    } catch (seetgError) {
        console.warn('⚠️ See.tg API error:', seetgError.message);
    }

    // Get market prices for similar gifts
    const marketPrices = await getMarketPricesForSimilarGifts(collection.address, parsed.collectionSlug, {
        model: giftAttributes.model,
        backdrop: giftAttributes.backdrop,
        symbol: giftAttributes.symbol
    });

    // Estimate value with enhanced algorithm V2.0
    const estimation = estimateGiftValue(
        collectionFloor,
        attributeFloors,
        attributeRarities,
        totalItems,
        onSale,
        {
            itemNumber: parsed.itemNumber,
            modelName: giftAttributes.model || '',
            backdropName: giftAttributes.backdrop || '',
            symbolName: giftAttributes.symbol || '',
            marketPrices: marketPrices,
            collectionSlug: parsed.collectionSlug // NEW: for EWMA and trend analysis
        }
    );

    // Get rank and similar priced gifts for comparison
    const rankData = await getGiftRankAndRecentSales(
        collection.address,
        parsed.collectionSlug,
        estimation.estimated
    );

    // Build the premium text report
    const statusDisplay = getStatusDisplay(giftStatus);
    const giftName = `${collection.name} #${parsed.itemNumber}`;

    // Calculate value difference from floor
    const valueVsFloor = collectionFloor > 0 ? ((estimation.estimated - collectionFloor) / collectionFloor * 100) : 0;
    const valueEmoji = valueVsFloor > 50 ? '🚀' : valueVsFloor > 20 ? '📈' : valueVsFloor > 0 ? '✨' : '📊';

    // Determine gift rating
    let giftRating = '⭐⭐⭐';
    if (estimation.bonuses && estimation.bonuses.length >= 3) giftRating = '⭐⭐⭐⭐⭐';
    else if (estimation.bonuses && estimation.bonuses.length >= 2) giftRating = '⭐⭐⭐⭐';
    else if (valueVsFloor > 50 || estimation.avgRarityScore > 70) giftRating = '⭐⭐⭐⭐';

    // ═══════════════════════════════════════
    // 🔥 PREMIUM GIFT REPORT FORMAT
    // ═══════════════════════════════════════

    let report = ``;

    // ═══ HEADER ═══
    report += `🎁 *${giftName}*\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Status Badge
    const statusBadge = giftStatus === 'for_sale' ? '🟢 FOR SALE' : '🔵 NOT LISTED';
    report += `${statusBadge}`;
    if (giftPrice) {
        report += ` • *${formatNumber(Math.round(giftPrice))} TON* (~$${formatNumber(Math.round(giftPrice * tonPrice))})`;
    }
    report += `\n\n`;

    // ═══ 💎 ESTIMATED VALUE ═══
    report += `――――― 💎 *ESTIMATED VALUE* ―――――\n`;
    report += `▸ 🏷️  *${formatNumber(Math.round(estimation.estimated))} TON*\n`;
    report += `▸ 💵  _~$${formatNumber(Math.round(estimation.estimated * tonPrice))}_\n`;

    // Value vs Floor comparison
    if (valueVsFloor !== 0) {
        const sign = valueVsFloor > 0 ? '+' : '';
        const valueBar = valueVsFloor > 100 ? '🔥🔥🔥' : valueVsFloor > 50 ? '🔥🔥' : valueVsFloor > 20 ? '🔥' : valueVsFloor > 0 ? '📈' : '📉';
        report += `▸ ${valueBar} *${sign}${valueVsFloor.toFixed(0)}%* vs Floor\n`;
    }

    // Confidence level - Enhanced 5-Level System
    const confidenceConfig = {
        'ultra_high': { emoji: '🎯', text: 'Ultra High' },
        'very_high': { emoji: '✅', text: 'Very High' },
        'high': { emoji: '📊', text: 'High' },
        'moderate': { emoji: '⚡', text: 'Moderate' },
        'low': { emoji: '⚠️', text: 'Low' },
        'very_low': { emoji: '❓', text: 'Very Low' }
    };
    const confLevel = confidenceConfig[estimation.confidence] || confidenceConfig['moderate'];
    report += `▸ ${confLevel.emoji} Confidence: _${confLevel.text}_ (${estimation.confidenceScore || 50}%)\n\n`;

    // ═══ 📊 COLLECTION STATS ═══
    report += `――――― 📊 *COLLECTION STATS* ―――――\n`;
    report += `▸ 🏛️ *${collection.name}*\n`;
    report += `▸ 💰 Floor: *${formatNumber(Math.round(collectionFloor))} TON*\n`;
    report += `▸ #️⃣ Item: *#${formatNumber(parsed.itemNumber)}* of ${formatNumber(totalItems)}\n`;
    report += `▸ 🏪 On Sale: *${formatNumber(onSale)}* (${totalItems > 0 ? (onSale / totalItems * 100).toFixed(1) : 0}%)\n`;
    report += `▸ 👥 Owners: *${formatNumber(owners)}*\n`;
    if (volume7d > 0) {
        report += `▸ 📈 7d Vol: *${formatNumber(Math.round(volume7d))} TON*\n`;
    }
    report += `\n`;

    // Owner info - prefer See.tg username over wallet
    if (seetgData.ownerUsername) {
        report += `👤 *Owner:* @${seetgData.ownerUsername}`;
        if (seetgData.ownerName) {
            report += ` (${seetgData.ownerName})`;
        }
        report += `\n`;
    } else if (giftOwner) {
        const ownerName = await getOwnerName(giftOwner);
        report += `👤 *Owner:* ${ownerName}\n`;
    }

    // Transfer history
    if (seetgData.transferCount > 0) {
        report += `🔄 *Transfers:* ${seetgData.transferCount} times\n`;
    }

    // Floor changes (from See.tg)
    const has24h = typeof seetgData.floorChange24h === 'number';
    const has7d = typeof seetgData.floorChange7d === 'number';

    if (has24h || has7d) {
        let floorTrend = '';
        if (has24h) {
            const emoji24h = seetgData.floorChange24h >= 0 ? '📈' : '📉';
            const sign24h = seetgData.floorChange24h >= 0 ? '+' : '';
            floorTrend += `${emoji24h} 24h: *${sign24h}${seetgData.floorChange24h.toFixed(1)}%* `;
        }
        if (has7d) {
            const emoji7d = seetgData.floorChange7d >= 0 ? '📈' : '📉';
            const sign7d = seetgData.floorChange7d >= 0 ? '+' : '';
            floorTrend += `${emoji7d} 7d: *${sign7d}${seetgData.floorChange7d.toFixed(1)}%*`;
        }
        report += `📊 *Floor Trend:* ${floorTrend}\n`;
    }

    report += `\n`;

    // ═══ 🎨 ATTRIBUTES & RARITY ═══
    report += `――――― 🎨 *ATTRIBUTES & RARITY* ―――――\n\n`;

    let hasAttributes = false;

    // Helper to display attribute
    const displayAttribute = (type, details, rawValue) => {
        if (details) {
            hasAttributes = true;
            const tier = details.changesRarity ? details.changesRarity.tier : details.rarity;
            const rarityBar = details.percentage <= 5 ? '█████' : details.percentage <= 15 ? '████░' : details.percentage <= 30 ? '███░░' : details.percentage <= 50 ? '██░░░' : '█░░░░';

            let emoji = '🔹';
            if (type === 'Model') emoji = '🤖';
            if (type === 'Backdrop') emoji = '🖼️';
            if (type === 'Symbol') emoji = '✨';

            report += `${emoji} *${type}:* ${tier.emoji} _${details.value}_\n`;
            report += `    ▸ Rarity: \`${rarityBar}\` *${details.percentage.toFixed(1)}%*\n`;
            report += `    ▸ Count: ${formatNumber(details.count)} | Floor: *${formatNumber(Math.round(details.floor))} TON*\n\n`;
        } else if (rawValue) {
            hasAttributes = true;
            let emoji = '🔹';
            if (type === 'Model') emoji = '🤖';
            if (type === 'Backdrop') emoji = '🖼️';
            if (type === 'Symbol') emoji = '✨';

            report += `${emoji} *${type}:* ⚪ _${rawValue}_\n`;
            report += `    ▸ Rarity: _Data not available yet_\n\n`;
        }
    };

    displayAttribute('Model', attributeDetails.model, giftAttributes.model);
    displayAttribute('Backdrop', attributeDetails.backdrop, giftAttributes.backdrop);
    displayAttribute('Symbol', attributeDetails.symbol, giftAttributes.symbol);

    if (!hasAttributes) {
        report += `⏳ _Fetching attribute data..._\n\n`;
    }

    // ═══ 🏪 MARKET COMPARISON ═══
    if (estimation.marketData && (estimation.marketData.modelCount > 0 || estimation.marketData.backdropCount > 0 || estimation.marketData.symbolCount > 0)) {
        report += `――――― 🏪 *MARKET COMPARISON* ―――――\n`;
        report += `_Similar items for sale:_\n`;

        if (estimation.marketData.modelMedian && estimation.marketData.modelCount > 0) {
            const diff = ((estimation.estimated / estimation.marketData.modelMedian) - 1) * 100;
            const diffEmoji = diff > 0 ? '📈' : diff < -10 ? '🔥' : '➖';
            let modelLink = '';
            if (marketPrices.model?.samples?.length > 0) {
                modelLink = ` [→](${marketPrices.model.samples[0].link})`;
            }
            report += `▸ 🤖 Model: *${formatNumber(Math.round(estimation.marketData.modelMedian))} TON* (${estimation.marketData.modelCount}) ${diffEmoji}${modelLink}\n`;
        }
        if (estimation.marketData.backdropMedian && estimation.marketData.backdropCount > 0) {
            const diff = ((estimation.estimated / estimation.marketData.backdropMedian) - 1) * 100;
            const diffEmoji = diff > 0 ? '📈' : diff < -10 ? '🔥' : '➖';
            let backdropLink = '';
            if (marketPrices.backdrop?.samples?.length > 0) {
                backdropLink = ` [→](${marketPrices.backdrop.samples[0].link})`;
            }
            report += `▸ 🖼️ Backdrop: *${formatNumber(Math.round(estimation.marketData.backdropMedian))} TON* (${estimation.marketData.backdropCount}) ${diffEmoji}${backdropLink}\n`;
        }
        if (estimation.marketData.symbolMedian && estimation.marketData.symbolCount > 0) {
            const diff = ((estimation.estimated / estimation.marketData.symbolMedian) - 1) * 100;
            const diffEmoji = diff > 0 ? '📈' : diff < -10 ? '🔥' : '➖';
            let symbolLink = '';
            if (marketPrices.symbol?.samples?.length > 0) {
                symbolLink = ` [→](${marketPrices.symbol.samples[0].link})`;
            }
            report += `▸ ✨ Symbol: *${formatNumber(Math.round(estimation.marketData.symbolMedian))} TON* (${estimation.marketData.symbolCount}) ${diffEmoji}${symbolLink}\n`;
        }
        report += `\n`;
    }

    // ═══ 🏅 RANKING ═══
    if (seetgData.rank !== null && seetgData.rank !== undefined) {
        // Use See.tg real ranking
        report += `――――― 🏅 *RANKING* ―――――\n`;
        report += `▸ 🎖️ Rank: *#${seetgData.rank}* (via See.tg)\n\n`;
    } else if (rankData.rank) {
        // Fallback to estimated ranking
        report += `――――― 🏅 *RANKING* ―――――\n`;

        const topPercent = Math.max(1, 100 - rankData.rank.percentile);
        const rankLabel = topPercent <= 5 ? '🥇 Elite' : topPercent <= 15 ? '🥈 Top-Tier' : topPercent <= 30 ? '🥉 Premium' : topPercent <= 50 ? '📊 Mid-Range' : '📉 Entry';

        report += `▸ ${rankLabel}\n`;
        report += `▸ Position: *#${rankData.rank.position}* among ${formatNumber(rankData.rank.total)} listings\n`;
        report += `▸ Top *${topPercent}%* by value\n\n`;
    }

    // ═══ 💎 VALUE DRIVERS ═══
    if (estimation.bonuses && estimation.bonuses.length > 0) {
        report += `――――― 💎 *VALUE DRIVERS* ―――――\n`;
        estimation.bonuses.forEach((bonus) => {
            report += `▸ ${bonus}\n`;
        });
        report += `\n`;
    }

    // ═══ 🧠 EXPERT ANALYSIS ═══
    report += `――――― 🧠 *EXPERT ANALYSIS* ―――――\n`;
    report += `${estimation.appraiserNote}\n\n`;

    // ═══ 🏆 BADGES ═══
    if (estimation.badges && estimation.badges.length > 0) {
        report += `🏆 *Badges:* ${estimation.badges.join(' • ')}\n\n`;
    }

    // ═══ INVESTMENT SIGNAL ═══
    let signal = '';
    if (valueVsFloor < -10) {
        signal = '🔥 *UNDERVALUED* - Buy opportunity';
    } else if (valueVsFloor > 50 && estimation.totalMultiplier > 2) {
        signal = '💎 *HIGH VALUE* - Premium item';
    } else if (estimation.badges && estimation.badges.length >= 2) {
        signal = '⭐ *STRONG* - Multiple value drivers';
    } else {
        signal = '📊 *FAIR VALUE* - Standard pricing';
    }
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `${signal}\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // ═══ FOOTER ═══
    report += `_Powered by iFragment Bot_ 🤖\n`;
    report += `💹 TON: *$${tonPrice.toFixed(2)}*`;

    // Determine Image URL
    let imageUrl = null;
    if (seetgData.image) imageUrl = seetgData.image;
    else if (giftData?.image) imageUrl = giftData.image;
    // Fallback if no specific image found
    // Note: We might need a better fallback or just leave it null to be handled by the card generator

    return {
        report,
        giftName,
        collection: collection.name,
        slug: parsed.collectionSlug, // Export slug for callback
        itemNumber: parsed.itemNumber,
        estimatedValue: estimation.estimated,
        floorPrice: collectionFloor,
        status: giftStatus,
        badges: estimation.badges,
        verdict: estimation.verdict,
        imageUrl: imageUrl,
        color: attributeDetails.backdrop ? attributeDetails.backdrop.value : null // Start of color logic
    };
}

export {
    parseGiftLink,
    getGiftCollections,
    getCollectionAttributes,
    getNftInfo,
    getGiftsOnSale,
    findCollectionBySlug,
    estimateGiftValue,
    generateGiftReport,
    getEnhancedRarityData,
    nanoToTon,
    formatNumber,
    shortenAddress
};
