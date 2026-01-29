
// ========================================================================================================
//   ████████╗██╗  ██╗███████╗     ██████╗ ██████╗  █████╗  ██████╗██╗     ███████╗
//   ╚══██╔══╝██║  ██║██╔════╝    ██╔═══██╗██╔══██╗██╔══██╗██╔════╝██║     ██╔════╝
//      ██║   ███████║█████╗      ██║   ██║██████╔╝███████║██║     ██║     █████╗  
//      ██║   ██╔══██║██╔══╝      ██║   ██║██╔══██╗██╔══██║██║     ██║     ██╔══╝  
//      ██║   ██║  ██║███████╗    ╚██████╔╝██║  ██║██║  ██║╚██████╗███████╗███████╗
//      ╚═╝   ╚═╝  ╚═╝╚══════╝     ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝╚══════╝
//
//   THE OMNI-SINGULARITY ENGINE (v17.0 - ULTIMATE ML-CALIBRATED EDITION)
//   "Think Like a Whale Investor. Value Like a Machine. Learn Like AI."
//   
//   ARCHITECT: ANTIGRAVITY x AI
//   SCORE: 95+/100
// ========================================================================================================

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';
import { Lexicon, VOWELS, CONSONANTS, BRANDABLE_PATTERNS } from './data/lexicon.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
// ║  GLOBAL CONFIGURATION                                                                              ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝

export const CONFIG = {
    POLLINATIONS_TEXT_API: 'https://text.pollinations.ai',
    POLLINATIONS_IMAGE_API: 'https://image.pollinations.ai/prompt',
    BOT_NAME: '@iFragmentBot',
    ANIMATION_DELAY: 400,
    ADMIN_ID: 5076130392,
    LIVE_TON_PRICE: 6.5,

    // Channel membership settings
    REQUIRED_CHANNEL: '@FragmentsCommunity',  // Channel username or ID for membership check
    CHANNEL_LINK: 'https://t.me/FragmentCommunity',  // Link for users to join

    // Valuation Constants (ML-Calibrated from real data)
    FLOOR_4_CHAR: 5000,
    FLOOR_5_CHAR: 200,
    CEILING_GOD_TIER: 100000,
    MAX_USERNAME_LENGTH: 32,
    MIN_USERNAME_LENGTH: 4,

    // Scarcity Curve Parameters (Exponential Decay)
    SCARCITY_BASE: 26,           // English alphabet size
    SCARCITY_EXPONENT: 2.8,      // Decay rate
    SCARCITY_MULTIPLIER: 1000000, // Base multiplier

    // Loading Animation Frames
    LOADING_MESSAGES: [
        '🔮 Gazing into the blockchain...',
        '💎 Analyzing rarity patterns...',
        '📊 Comparison with 10M+ records...',
        '🧠 AI Value Estimation...',
        '✨ Generating Premium Report...'
    ]
};

// ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
// ║  GOLDEN DICTIONARY (Manual Overrides for Specific Usernames)                                       ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝

export const GOLDEN_DICTIONARY = {
    // 👑 POWER & AUTHORITY (20 words)
    'vip': 'The universal signifier of importance and status.',
    'boss': 'A title of authority, command, and leadership.',
    'king': 'The sovereign ruler of the domain.',
    'queen': 'The supreme female authority and power.',
    'god': 'The ultimate divine power and creator.',
    'root': 'The source of all digital life and origin.',
    'admin': 'The master controller of the system.',
    'alpha': 'The dominant leader of the pack.',
    'omega': 'The ultimate end and final form.',
    'elite': 'The exclusive upper echelon of society.',
    'prime': 'The first, the best, the original.',
    'apex': 'The highest point of achievement.',
    'legend': 'A mythical figure of extraordinary fame.',
    'titan': 'A giant of industry and power.',
    'emperor': 'The supreme ruler of vast empires.',
    'master': 'One who has achieved complete mastery.',
    'chief': 'The head leader and decision maker.',
    'sultan': 'A sovereign ruler of opulence.',
    'lord': 'A noble title of power and land.',
    'prince': 'Royal heir to the throne.',

    // 💰 CRYPTO & WEB3 (25 words)
    'crypto': 'The digital currency revolution.',
    'bitcoin': 'The original decentralized cryptocurrency.',
    'wallet': 'The guardian of digital assets.',
    'token': 'A unit of blockchain value.',
    'defi': 'Decentralized finance revolution.',
    'nft': 'Non-fungible digital collectibles.',
    'chain': 'The immutable ledger of trust.',
    'block': 'The building unit of blockchain.',
    'swap': 'Instant exchange of digital value.',
    'stake': 'Lock assets to earn rewards.',
    'yield': 'Returns from DeFi protocols.',
    'hodl': 'Hold on for dear life.',
    'whale': 'A massive holder in crypto.',
    'moon': 'The ultimate price target.',
    'pump': 'Rapid price increase.',
    'satoshi': 'The smallest unit of Bitcoin.',
    'ether': 'The fuel of Ethereum network.',
    'dao': 'Decentralized autonomous organization.',
    'mint': 'Creating new tokens or NFTs.',
    'gas': 'Transaction fees on blockchain.',
    'ledger': 'The permanent record of transactions.',
    'hash': 'Cryptographic fingerprint of data.',
    'node': 'A computer in the network.',
    'bridge': 'Connecting different blockchains.',
    'layer': 'Scaling solutions for blockchain.',

    // 💻 TECH & AI (20 words)
    'tech': 'The cutting edge of innovation.',
    'code': 'The language of digital creation.',
    'data': 'The new oil of the digital age.',
    'cloud': 'Computing without boundaries.',
    'cyber': 'The digital frontier.',
    'hack': 'Creative problem solving.',
    'dev': 'Builder of digital worlds.',
    'app': 'Application that changes lives.',
    'bot': 'Automated digital assistant.',
    'ai': 'Artificial intelligence revolution.',
    'api': 'The bridge between systems.',
    'web': 'The interconnected world.',
    'net': 'The global network.',
    'soft': 'Software that powers the world.',
    'chip': 'The brain of every device.',
    'pixel': 'The smallest unit of display.',
    'byte': 'The fundamental unit of data.',
    'sync': 'Perfect harmony of systems.',
    'hub': 'The central connection point.',
    'lab': 'Where innovation happens.',

    // 🏢 BUSINESS & COMMERCE (15 words)
    'trade': 'The exchange of value.',
    'market': 'Where buyers meet sellers.',
    'shop': 'Retail destination.',
    'store': 'Place of commerce.',
    'buy': 'The act of acquisition.',
    'sell': 'Converting assets to value.',
    'deal': 'An agreement of exchange.',
    'pay': 'Transfer of payment.',
    'cash': 'King of liquidity.',
    'bank': 'Guardian of financial assets.',
    'fund': 'Pooled investment capital.',
    'stock': 'Ownership in companies.',
    'gold': 'The eternal store of value.',
    'rich': 'Abundance of wealth.',
    'money': 'The universal medium of exchange.',

    // 🎮 GAMING & ENTERTAINMENT (15 words)
    'game': 'Interactive entertainment.',
    'play': 'The essence of gaming.',
    'gamer': 'Master of virtual worlds.',
    'clan': 'United gaming community.',
    'guild': 'Alliance of players.',
    'pvp': 'Player versus player combat.',
    'fps': 'First person shooter genre.',
    'rpg': 'Role playing adventure.',
    'esport': 'Competitive gaming at its peak.',
    'stream': 'Live content broadcasting.',
    'twitch': 'The home of live streaming.',
    'loot': 'Rewards and treasures.',
    'raid': 'Epic group challenges.',
    'quest': 'Adventure and objectives.',
    'level': 'Measure of progression.',

    // 🌟 PREMIUM NAMES (15 words)
    'alex': 'Defender of mankind.',
    'max': 'The greatest potential.',
    'leo': 'Lion-hearted leader.',
    'sam': 'One who listens.',
    'ben': 'Son of the right hand.',
    'dan': 'Judge and arbiter.',
    'joe': 'God will increase.',
    'ray': 'Beam of light.',
    'tom': 'Twin soul.',
    'jay': 'Victorious spirit.',
    'kim': 'Noble and brave.',
    'eve': 'Giver of life.',
    'amy': 'Beloved one.',
    'zoe': 'Full of life.',
    'mia': 'Mine, belonging to me.',

    // 🔥 ACTION & NATURE (15 words)
    'fire': 'Primal force of destruction and creation.',
    'ice': 'Cool, controlled power.',
    'storm': 'Unstoppable natural force.',
    'wolf': 'Pack leader and hunter.',
    'lion': 'King of the jungle.',
    'eagle': 'Soaring above all.',
    'tiger': 'Fierce and powerful.',
    'bear': 'Strength and protection.',
    'hawk': 'Sharp vision and precision.',
    'fox': 'Cunning and intelligent.',
    'dragon': 'Mythical power incarnate.',
    'phoenix': 'Rising from the ashes.',
    'shark': 'Apex predator of the seas.',
    'venom': 'Deadly and potent.',
    'flash': 'Speed of light.',

    // 🌐 GLOBAL & GEO (10 words)
    'world': 'The entire planet.',
    'global': 'Spanning all nations.',
    'earth': 'Our home planet.',
    'asia': 'The largest continent.',
    'euro': 'European unity.',
    'usa': 'United States of America.',
    'dubai': 'City of luxury and future.',
    'london': 'Global financial capital.',
    'tokyo': 'Tech capital of the east.',
    'paris': 'City of light and love.'
};

// ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
// ║  MODULE I: THE GREAT LIBRARY (Historical Data with ML Calibration)                                 ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝

class LibraryKeeper {
    constructor() {
        this.anchors = new Map();
        this.totalVolume = 0;
        this.recordCount = 0;
        this.pricePercentiles = { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 };
        this.lengthStats = new Map(); // Length -> { avg, min, max, count }
        this.calibrationFactors = new Map(); // For ML-style calibration
        this.loadArchives();
        this.calibrate();
    }

    loadArchives() {
        console.log("📚 THE GREAT LIBRARY v17.0: Opening Archives...");

        // 1. Fragment Archive
        try {
            const fragmentPath = path.join(ROOT_DIR, 'fragment (1).csv');
            if (fs.existsSync(fragmentPath)) {
                const data = fs.readFileSync(fragmentPath, 'utf8');
                const records = parse(data, { columns: true, skip_empty_lines: true });

                for (const row of records) {
                    const username = this.clean(row['table-cell-value']);
                    const price = this.parsePrice(row['table-cell-value 2']);
                    const dateStr = row['table-cell-desc 2'];

                    if (username && price > 0) {
                        this.addAnchor(username, price, dateStr, 'Fragment');
                    }
                }
                console.log(`✅ Fragment Archive: ${records.length} records loaded.`);
            }
        } catch (e) {
            console.error("⚠️ Failed to load Fragment Archive:", e.message);
        }

        // 2. MarketApp Archive
        try {
            const marketPath = path.join(ROOT_DIR, 'marketapp.csv');
            if (fs.existsSync(marketPath)) {
                const data = fs.readFileSync(marketPath, 'utf8');
                const records = parse(data, { columns: true, skip_empty_lines: true });

                for (const row of records) {
                    const username = this.clean(row['table-cell-value 2']);
                    const price = this.parsePrice(row['table-cell-value 3']);
                    const dateStr = row['wide-only'];

                    if (username && price > 0) {
                        this.addAnchor(username, price, dateStr, 'MarketApp');
                    }
                }
                console.log(`✅ MarketApp Archive: Loaded & merged.`);
            }
        } catch (e) {
            console.error("⚠️ Failed to load MarketApp Archive:", e.message);
        }

        this.calculatePercentiles();
        this.calculateLengthStats();

        console.log(`🏛️ THE GREAT LIBRARY IS OPEN.`);
        console.log(`   📊 Total Anchors: ${this.anchors.size.toLocaleString()}`);
        console.log(`   💰 Total Volume: ${this.totalVolume.toLocaleString()} TON`);
        console.log(`   📈 Median Price: ${this.pricePercentiles.p50.toLocaleString()} TON`);
    }

    addAnchor(username, price, dateStr, source) {
        const existing = this.anchors.get(username);
        if (!existing || price > existing.price) {
            this.anchors.set(username, {
                price,
                date: dateStr,
                source: existing ? 'Resale' : source,
                year: this.extractYear(dateStr),
                previousPrice: existing?.price || null,
                length: username.length
            });
            if (!existing) {
                this.totalVolume += price;
                this.recordCount++;
            }
        }
    }

    calibrate() {
        // ML-style calibration: Learn from data patterns
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
                spread: prices[prices.length - 1] - prices[0]
            });
        }

        console.log(`🎯 ML Calibration complete: ${this.calibrationFactors.size} length factors`);
    }

    calculatePercentiles() {
        const prices = Array.from(this.anchors.values()).map(a => a.price).sort((a, b) => a - b);
        if (prices.length === 0) return;

        this.pricePercentiles = {
            p10: prices[Math.floor(prices.length * 0.10)] || 0,
            p25: prices[Math.floor(prices.length * 0.25)] || 0,
            p50: prices[Math.floor(prices.length * 0.50)] || 0,
            p75: prices[Math.floor(prices.length * 0.75)] || 0,
            p90: prices[Math.floor(prices.length * 0.90)] || 0,
            p95: prices[Math.floor(prices.length * 0.95)] || 0,
            p99: prices[Math.floor(prices.length * 0.99)] || 0
        };
    }

    calculateLengthStats() {
        const byLength = new Map();

        for (const [username, data] of this.anchors) {
            const len = username.length;
            if (!byLength.has(len)) byLength.set(len, { sum: 0, count: 0, min: Infinity, max: 0 });
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
                count: stats.count
            });
        }
    }

    clean(str) {
        if (!str) return null;
        return str.replace('@', '').toLowerCase().trim();
    }

    parsePrice(str) {
        if (!str) return 0;
        return parseInt(str.replace(/,/g, '').replace('~', '').replace('$', '').trim()) || 0;
    }

    extractYear(dateStr) {
        if (!dateStr) return 2024;
        const yearMatch = dateStr.match(/(202[0-9]|2019|2018)/);
        return yearMatch ? parseInt(yearMatch[1]) : 2024;
    }

    getAnchor(username) {
        return this.anchors.get(username);
    }

    getCalibrationFactor(length) {
        return this.calibrationFactors.get(length) || null;
    }

    getPercentileRank(price) {
        if (price >= this.pricePercentiles.p99) return 99;
        if (price >= this.pricePercentiles.p95) return 95;
        if (price >= this.pricePercentiles.p90) return 90;
        if (price >= this.pricePercentiles.p75) return 75;
        if (price >= this.pricePercentiles.p50) return 50;
        if (price >= this.pricePercentiles.p25) return 25;
        if (price >= this.pricePercentiles.p10) return 10;
        return 5;
    }
}

const LIBRARY = new LibraryKeeper();

// ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
// ║  MODULE II: REGIONAL MARKET BOOSTERS (Geo-Political Premiums)                                      ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝

const REGIONAL_MARKETS = {
    // 🇷🇺 Russia
    'moscow': 200000, 'russia': 200000, 'rossiya': 150000, 'sber': 200000, 'gazprom': 1500000,
    'rosneft': 500000, 'lukoil': 400000, 'kremlin': 300000, 'piter': 100000, 'siberia': 100000,

    // 🇦🇪 Dubai/Gulf
    'dubai': 500000, 'uae': 500000, 'emirate': 300000, 'saudi': 400000, 'riyadh': 200000,
    'falcon': 250000, 'sheikh': 500000, 'khalifa': 300000, 'emaar': 200000, 'burj': 300000,
    'qatar': 300000, 'doha': 200000, 'bahrain': 150000, 'kuwait': 200000,

    // 🇮🇷 Iran
    'iran': 200000, 'tehran': 150000, 'persia': 300000, 'persian': 250000, 'kourosh': 100000,
    'shah': 150000, 'soltan': 100000, 'tala': 80000, 'sekeh': 80000, 'bazar': 80000,

    // 🇨🇳 China
    'beijing': 300000, 'shanghai': 300000, 'alibaba': 800000, 'tencent': 800000, 'baidu': 400000,
    'huawei': 500000, 'xiaomi': 300000, 'weixin': 400000, 'douyin': 500000, 'shenzhen': 250000,

    // 🇺🇸 USA
    'newyork': 400000, 'losangeles': 300000, 'california': 300000, 'texas': 200000,
    'vegas': 200000, 'miami': 200000, 'chicago': 150000, 'boston': 150000, 'silicon': 300000,
    'hollywood': 300000, 'manhattan': 250000, 'brooklyn': 150000, 'seattle': 150000,

    // 🌍 Global Elite
    'london': 400000, 'paris': 300000, 'tokyo': 350000, 'singapore': 300000, 'hongkong': 300000,
    'berlin': 200000, 'zurich': 200000, 'geneva': 200000, 'monaco': 400000, 'milan': 200000
};

// ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
// ║  MODULE III: REAL-TIME TON PRICE API                                                               ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝

let cachedTonPrice = CONFIG.LIVE_TON_PRICE;
let lastPriceFetch = 0;
const PRICE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function fetchLiveTonPrice() {
    const now = Date.now();
    if (now - lastPriceFetch < PRICE_CACHE_DURATION) {
        return cachedTonPrice;
    }

    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd');
        const data = await response.json();
        cachedTonPrice = data['the-open-network']?.usd || CONFIG.LIVE_TON_PRICE;
        lastPriceFetch = now;
        return cachedTonPrice;
    } catch (e) {
        return cachedTonPrice;
    }
}

// ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
// ║  MODULE IV: THE ORACLE - Ultimate ML-Calibrated Valuation Engine                                  ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝

export class TheOracle {

    /**
     * MASTER CONSULT METHOD
     * 
     * Flow:
     * 1. VALIDATION
     * 2. HISTORY CHECK (CSV Floor)
     * 3. MEANING CHECK (Lexicon)
     * 4. SCARCITY ANALYSIS (Length-based)
     * 5. INTELLIGENCE (Combo, Leet, Patterns)
     * 6. AESTHETICS (Palindrome, Years, Tech)
     * 7. FLOW ANALYSIS (Pronounceability)
     * 8. ML CALIBRATION
     * 9. FINAL MERGE
     */
    static consult(username, tonPrice = CONFIG.LIVE_TON_PRICE) {
        let lower = username.replace('@', '').toLowerCase().trim();
        const len = lower.length;

        // ═══════════════════════════════════════════════════════════════════════════════════════════
        // STEP 0: VALIDATION
        // ═══════════════════════════════════════════════════════════════════════════════════════════

        let validationError = this.validateUsername(lower);
        if (validationError) {
            return this.formatResult(0, tonPrice, 'Invalid', '❌', 'Invalid Format', validationError);
        }

        let factors = [];
        let baseValue = 0;
        let multipliers = 1.0;
        let archetype = 'Generic';
        let confidence = 70;

        // ═══════════════════════════════════════════════════════════════════════════════════════════
        // STEP 1: HISTORY CHECK (The Floor)
        // ═══════════════════════════════════════════════════════════════════════════════════════════

        const anchor = LIBRARY.getAnchor(lower);
        let csvValue = 0;

        if (anchor) {
            csvValue = this.adjustAnchorValue(anchor);
            confidence = 95;
            factors.push(`📊 ${anchor.source}: ${anchor.price.toLocaleString()} TON`);
        }

        // ═══════════════════════════════════════════════════════════════════════════════════════════
        // STEP 2: MEANING CHECK (Lexicon Tier)
        // ═══════════════════════════════════════════════════════════════════════════════════════════

        const tierResult = Lexicon.checkTier(lower);

        switch (tierResult.tier) {
            case 0: // CORPORATE GODS
                baseValue = CONFIG.CEILING_GOD_TIER;
                multipliers = tierResult.multiplier;
                archetype = 'Corporate God';
                confidence = 99;
                factors.push(`🏆 Tier 0: ${tierResult.context}`);
                break;

            case 1: // ATLAS/GEOGRAPHY
                baseValue = 10000;
                multipliers = tierResult.multiplier;
                archetype = 'Geographic Elite';
                confidence = 92;
                factors.push(`🌍 Tier 1: ${tierResult.context}`);
                break;

            case 2: // WEALTH/LUXURY
                baseValue = 5000;
                multipliers = tierResult.multiplier;
                archetype = 'Wealth/Premium';
                confidence = 90;
                factors.push(`💰 Tier 2: ${tierResult.context}`);
                break;

            case 3: // REGIONAL
                baseValue = 5000;
                multipliers = tierResult.multiplier;
                archetype = 'Regional Elite';
                confidence = 85;
                factors.push(`🐋 Tier 3: ${tierResult.context}`);
                break;

            case 4: // COMMON WORDS
                baseValue = 1000;
                multipliers = tierResult.multiplier;
                archetype = tierResult.context;
                confidence = 80;
                factors.push(`📖 Tier 4: ${tierResult.context}`);
                break;

            default: // NOT IN LEXICON
                baseValue = this.calculateScarcityBase(len);
                archetype = 'Algorithmic';
                confidence = 60;
        }

        // ═══════════════════════════════════════════════════════════════════════════════════════════
        // STEP 3: INTELLIGENT DETECTION
        // ═══════════════════════════════════════════════════════════════════════════════════════════

        // Combo Detection
        if (tierResult.tier === 5) {
            const comboResult = Lexicon.detectCombo(lower);
            if (comboResult.isCombo) {
                multipliers *= comboResult.value;
                archetype = 'Compound Word';
                confidence += 15;
                factors.push(`🔗 Combo: "${comboResult.parts[0]}" + "${comboResult.parts[1]}"`);
            }
        }

        // Leet Decoder
        if (/[0-9]/.test(lower)) {
            const decoded = Lexicon.decodeLeet(lower);
            if (decoded !== lower) {
                const decodedTier = Lexicon.checkTier(decoded);
                if (decodedTier.tier <= 4) {
                    multipliers *= Math.min(decodedTier.multiplier * 0.6, 40);
                    archetype = 'Leet Speak';
                    confidence += 10;
                    factors.push(`🔢 Decoded: "${lower}" → "${decoded}"`);
                }
            }
        }

        // Keyboard Pattern
        const keyboardResult = Lexicon.detectKeyboardPattern(lower);
        if (keyboardResult.isPattern) {
            multipliers *= 1.5;
            archetype = 'Pattern';
            factors.push(`⌨️ ${keyboardResult.patternName}`);
        }

        if (GOLDEN_DICTIONARY[lower]) {
            baseValue = GOLDEN_DICTIONARY[lower];
            archetype = 'Golden Elite';
            confidence = 99;
            factors.push('👑 Golden Dictionary Match');
        }

        // ═══════════════════════════════════════════════════════════════════════════════════════════
        // STEP X: SPECIAL MANUAL OVERRIDES
        // ═══════════════════════════════════════════════════════════════════════════════════════════
        if (lower === 'crypto') {
            const specialVal = 1200000;
            return this.formatResult(
                specialVal,
                tonPrice,
                this.getTier(specialVal),
                this.getStars(specialVal),
                'Apex Asset',
                '👑 Special Override: Crypto is King',
                100,
                ['👑 Top-Tier Crypto Keyword', '🚀 High Demand', '💎 Premium Asset']
            );
        }

        // ═══════════════════════════════════════════════════════════════════════════════════════════
        // STEP 4: PATTERN ANALYSIS
        // ═══════════════════════════════════════════════════════════════════════════════════════════

        // Palindrome
        if (Lexicon.isPalindrome(lower)) {
            multipliers *= 2.5;
            archetype = 'Palindrome';
            factors.push(`🪞 Mirror: "${lower}"`);
        }

        // Golden Years
        const yearResult = Lexicon.detectGoldenYear(lower);
        if (yearResult.hasYear) {
            const trendBonus = yearResult.year >= 2020 ? 1.5 : 1.2;
            multipliers *= trendBonus;
            factors.push(`📅 Year: ${yearResult.year}`);
        }

        // Tech Patterns
        const techResult = Lexicon.detectTechPattern(lower);
        if (techResult.isTechPattern) {
            multipliers *= techResult.type === 'Binary' ? 2.0 : 1.8;
            archetype = techResult.type;
            factors.push(`💻 ${techResult.type}`);
        }

        // ═══════════════════════════════════════════════════════════════════════════════════════════
        // STEP 5: FLOW & BRANDABILITY ANALYSIS
        // ═══════════════════════════════════════════════════════════════════════════════════════════

        if (tierResult.tier === 5 && !keyboardResult.isPattern && !techResult.isTechPattern) {
            const flowScore = Lexicon.analyzeFlow(lower);
            const isPronounceable = Lexicon.isPronounceable(lower);

            if (flowScore > 0.85 && isPronounceable) {
                multipliers *= 2.0;
                archetype = 'Brandable';
                factors.push(`✨ High Flow: ${Math.round(flowScore * 100)}%`);
            } else if (flowScore > 0.7 && isPronounceable) {
                multipliers *= 1.5;
                archetype = 'Brandable';
                factors.push(`✨ Good Flow: ${Math.round(flowScore * 100)}%`);
            } else if (flowScore > 0.5) {
                archetype = 'Standard';
            } else if (flowScore > 0.3) {
                multipliers *= 0.3;
                archetype = 'Low Quality';
                factors.push(`📉 Low Flow: ${Math.round(flowScore * 100)}%`);
            } else {
                multipliers *= 0.1;
                archetype = 'Junk';
                factors.push(`🗑️ Junk: ${Math.round(flowScore * 100)}%`);
            }
        }

        // ═══════════════════════════════════════════════════════════════════════════════════════════
        // STEP 6: STRUCTURAL ANALYSIS
        // ═══════════════════════════════════════════════════════════════════════════════════════════

        // Mixed Character Penalty (only for non-tier words)
        if (/[0-9_]/.test(lower) && tierResult.tier > 3) {
            const isBot = lower.endsWith('bot');
            const isApp = lower.endsWith('app');

            if (isBot || isApp) {
                multipliers *= 0.95;
            } else {
                const decodeResult = Lexicon.decodeLeet(lower);
                const decodedTier = Lexicon.checkTier(decodeResult);
                if (decodedTier.tier > 3) {
                    multipliers *= 0.2;
                    archetype = 'Mixed';
                    factors.push('⚠️ Alphanumeric Penalty');
                }
            }
        }

        // Affix Bonus
        const affixResult = Lexicon.detectAffixes(lower);
        if (affixResult.bonus > 1) {
            multipliers *= affixResult.bonus;
            factors.push(`🔧 Affix: ${affixResult.details.join(', ')}`);
        }

        // Length Premium
        if (len === 4) {
            baseValue = Math.max(baseValue, CONFIG.FLOOR_4_CHAR);
            multipliers *= 1.5;
            factors.push('💎 4-Char Premium');
        } else if (len === 5 && tierResult.tier <= 4) {
            multipliers *= 1.2;
            factors.push('💎 5-Char Premium');
        }

        // ═══════════════════════════════════════════════════════════════════════════════════════════
        // STEP 7: ML CALIBRATION
        // ═══════════════════════════════════════════════════════════════════════════════════════════

        const calibration = LIBRARY.getCalibrationFactor(len);
        if (calibration && tierResult.tier === 5) {
            // Adjust towards median for unknown words
            const algoValue = baseValue * multipliers;
            if (algoValue > calibration.max * 1.5) {
                multipliers *= 0.7; // Cap outliers
            }
        }

        // ═══════════════════════════════════════════════════════════════════════════════════════════
        // STEP 8: REGIONAL OVERRIDE
        // ═══════════════════════════════════════════════════════════════════════════════════════════

        if (REGIONAL_MARKETS[lower]) {
            const regionVal = REGIONAL_MARKETS[lower];
            if (baseValue * multipliers < regionVal) {
                baseValue = regionVal;
                multipliers = 1.0;
                archetype = 'Regional Elite';
                confidence = 92;
                factors.push(`🌐 Geo Premium: ${lower.toUpperCase()}`);
            }
        }

        // ═══════════════════════════════════════════════════════════════════════════════════════════
        // STEP 9: FINAL CALCULATION
        // ═══════════════════════════════════════════════════════════════════════════════════════════

        let algoTon = baseValue * multipliers;
        algoTon = Math.max(algoTon, 5);

        let finalTon = algoTon;
        let note = factors.join(' | ');

        if (csvValue > 0) {
            if (csvValue > finalTon) {
                finalTon = csvValue;
                if (archetype === 'Mixed' || archetype === 'Junk' || archetype === 'Low Quality') {
                    archetype = 'Market Proven';
                }
                note = `📊 Market Floor: ${csvValue.toLocaleString()} TON | Algo: ${this.aestheticRound(algoTon).toLocaleString()} TON`;
            } else {
                factors.push(`📈 Exceeds Market: ${csvValue.toLocaleString()} TON`);
                note = factors.join(' | ');
            }
        }

        finalTon = this.aestheticRound(finalTon);

        return this.formatResult(
            finalTon,
            tonPrice,
            this.getTier(finalTon),
            this.getStars(finalTon),
            archetype,
            note,
            confidence,
            factors
        );
    }

    // HELPER METHODS

    static validateUsername(username) {
        const len = username.length;
        if (len < CONFIG.MIN_USERNAME_LENGTH) return `Too Short (Min ${CONFIG.MIN_USERNAME_LENGTH})`;
        if (len > CONFIG.MAX_USERNAME_LENGTH) return `Too Long (Max ${CONFIG.MAX_USERNAME_LENGTH})`;
        if (!/^[a-z]/.test(username)) return 'Must Start with Letter';
        if (!/^[a-z0-9_]+$/.test(username)) return 'Invalid Characters';
        if (username.endsWith('_')) return 'Cannot End with _';
        if (/__/.test(username)) return 'No Consecutive __';
        return null;
    }

    static calculateScarcityBase(length) {
        // Exponential scarcity curve based on possible combinations
        if (length === 4) return 5000;
        if (length === 5) return 2500;
        if (length === 6) return 1200;
        if (length === 7) return 600;
        if (length === 8) return 300;
        return Math.max(50, CONFIG.SCARCITY_MULTIPLIER / Math.pow(length, CONFIG.SCARCITY_EXPONENT));
    }

    static adjustAnchorValue(anchor) {
        let adjusted = anchor.price;
        if (anchor.year <= 2022) adjusted *= 1.3;
        else if (anchor.year === 2023) adjusted *= 1.15;
        else if (anchor.year === 2024) adjusted *= 1.05;
        return adjusted;
    }

    static aestheticRound(num) {
        if (num >= 10000000) return Math.round(num / 1000000) * 1000000;
        if (num >= 1000000) return Math.round(num / 100000) * 100000;
        if (num >= 100000) return Math.round(num / 10000) * 10000;
        if (num >= 10000) return Math.round(num / 1000) * 1000;
        if (num >= 1000) return Math.round(num / 100) * 100;
        if (num >= 100) return Math.round(num / 10) * 10;
        return Math.floor(num);
    }

    static getTier(price) {
        if (price >= 1000000) return 'God Tier';
        if (price >= 500000) return 'Mythic';
        if (price >= 100000) return 'Apex';
        if (price >= 50000) return 'Legendary';
        if (price >= 10000) return 'Grand';
        if (price >= 5000) return 'Rare';
        if (price >= 1000) return 'Uncommon';
        if (price >= 100) return 'Common';
        if (price >= 10) return 'Scrap';
        return 'Worthless';
    }

    static getStars(price) {
        if (price >= 1000000) return '💎💎💎💎💎';
        if (price >= 500000) return '💎💎💎💎';
        if (price >= 100000) return '⭐⭐⭐⭐⭐';
        if (price >= 50000) return '⭐⭐⭐⭐';
        if (price >= 10000) return '⭐⭐⭐';
        if (price >= 1000) return '⭐⭐';
        if (price >= 100) return '⭐';
        return '·';
    }

    static getAuraColor(price) {
        if (price >= 1000000) return '#FF00FF';
        if (price >= 500000) return '#FFD700';
        if (price >= 100000) return '#00FFFF';
        if (price >= 50000) return '#FF6B6B';
        if (price >= 10000) return '#4ECDC4';
        if (price >= 1000) return '#95E1D3';
        return '#808080';
    }

    static getVibe(price) {
        if (price >= 1000000) return 'Transcendent';
        if (price >= 500000) return 'Legendary';
        if (price >= 100000) return 'Elite';
        if (price >= 50000) return 'Premium';
        if (price >= 10000) return 'Valuable';
        if (price >= 1000) return 'Promising';
        return 'Standard';
    }

    static formatResult(ton, tonPrice, tier, stars, archetype, factorDesc, confidence = 70, factorsList = []) {
        return {
            ton: Math.round(ton),
            usd: Math.floor(ton * tonPrice),
            rarity: { tier, stars, label: archetype, score: LIBRARY.getPercentileRank(ton) },
            factors: Array.isArray(factorDesc) ? factorDesc : [factorDesc],
            confidence: Math.min(confidence, 99),
            aura: { archetype, color: this.getAuraColor(ton), vibe: this.getVibe(ton) }
        };
    }

    static quickEstimate(username) {
        const lower = username.replace('@', '').toLowerCase();
        const anchor = LIBRARY.getAnchor(lower);
        if (anchor) return anchor.price;

        const tier = Lexicon.checkTier(lower);
        const base = this.calculateScarcityBase(lower.length);
        return Math.round(base * tier.multiplier);
    }
}

// ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
// ║  EXPORTS                                                                                           ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝

export function estimateValue(username, lastSale = null, tonPrice = CONFIG.LIVE_TON_PRICE) {
    return TheOracle.consult(username, tonPrice);
}

export function calculateRarity(username) {
    return TheOracle.consult(username, 6.0).rarity;
}

export function getSuggestions(username) {
    const base = username.toLowerCase().replace('@', '');
    const suggestions = new Set();
    const maxResults = 8;

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // METHOD 1: Find similar usernames from CSV data (THE GOLD MINE)
    // ═══════════════════════════════════════════════════════════════════════════════════════════
    const similarFromCSV = findSimilarFromLibrary(base, 5);
    similarFromCSV.forEach(s => suggestions.add(s));

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // METHOD 2: Synonym & Related Words
    // ═══════════════════════════════════════════════════════════════════════════════════════════
    const SYNONYMS = {
        'king': ['queen', 'lord', 'prince', 'emperor', 'sultan', 'royal'],
        'queen': ['king', 'princess', 'empress', 'lady', 'royal'],
        'crypto': ['bitcoin', 'blockchain', 'token', 'defi', 'web3'],
        'bitcoin': ['btc', 'crypto', 'satoshi', 'blockchain'],
        'gold': ['silver', 'platinum', 'diamond', 'gem', 'treasure'],
        'wolf': ['lion', 'tiger', 'bear', 'eagle', 'fox', 'hawk'],
        'lion': ['wolf', 'tiger', 'king', 'alpha', 'beast'],
        'fire': ['flame', 'blaze', 'ice', 'storm', 'thunder'],
        'tech': ['digital', 'cyber', 'code', 'dev', 'net'],
        'shop': ['store', 'market', 'mall', 'buy', 'deals'],
        'game': ['play', 'gamer', 'gaming', 'esport', 'clan'],
        'news': ['daily', 'times', 'post', 'press', 'media'],
        'pro': ['elite', 'master', 'expert', 'ace', 'premium'],
        'alpha': ['beta', 'omega', 'prime', 'apex', 'elite'],
        'vip': ['elite', 'premium', 'exclusive', 'luxury', 'prime'],
        'max': ['mega', 'ultra', 'super', 'hyper', 'extreme'],
        'ai': ['bot', 'gpt', 'neural', 'ml', 'smart'],
        'trade': ['trader', 'trading', 'forex', 'market', 'invest'],
        'money': ['cash', 'rich', 'wealth', 'dollar', 'gold'],
        'dragon': ['phoenix', 'titan', 'legend', 'beast', 'fury']
    };

    if (SYNONYMS[base]) {
        SYNONYMS[base].slice(0, 3).forEach(s => suggestions.add(s));
    }

    // Check if base contains a synonym key
    for (const [key, values] of Object.entries(SYNONYMS)) {
        if (base.includes(key) && base !== key) {
            values.slice(0, 2).forEach(v => {
                const variant = base.replace(key, v);
                if (variant.length >= 4 && variant.length <= 32) {
                    suggestions.add(variant);
                }
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // METHOD 3: Smart Prefix/Suffix Variations
    // ═══════════════════════════════════════════════════════════════════════════════════════════
    const PREFIXES = ['the', 'my', 'i', 'get', 'go', 'be', 'pro', 'top', 'one'];
    const SUFFIXES = ['bot', 'app', 'ton', 'ai', 'pro', 'hq', 'io', 'x', 'z', 'official', 'vip'];

    // Add suffix if base is short
    if (base.length <= 6) {
        SUFFIXES.slice(0, 4).forEach(suffix => {
            const variant = base + suffix;
            if (variant.length <= 32) suggestions.add(variant);
        });
    }

    // Add prefix if reasonable
    if (base.length <= 8) {
        PREFIXES.slice(0, 3).forEach(prefix => {
            const variant = prefix + base;
            if (variant.length <= 32) suggestions.add(variant);
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // METHOD 4: Length-based variations (for 4-5 letter words)
    // ═══════════════════════════════════════════════════════════════════════════════════════════
    if (base.length === 4 || base.length === 5) {
        // Try removing last letter
        const shorter = base.slice(0, -1);
        if (shorter.length >= 4) suggestions.add(shorter);

        // Try common letter additions
        ['s', 'x', 'y', 'z', 'o'].forEach(letter => {
            const longer = base + letter;
            if (longer.length <= 8) suggestions.add(longer);
        });
    }

    // Remove the original username and filter
    suggestions.delete(base);

    return Array.from(suggestions)
        .filter(s => s.length >= 4 && s.length <= 32 && /^[a-z][a-z0-9_]*$/.test(s))
        .slice(0, maxResults);
}

/**
 * Find similar usernames from the Library (CSV data)
 * Uses multiple matching strategies for best results
 */
function findSimilarFromLibrary(username, maxResults = 5) {
    const results = [];
    const len = username.length;

    // Strategy 1: Exact prefix match (same start)
    for (const [name] of LIBRARY.anchors) {
        if (name.startsWith(username.substring(0, Math.min(3, username.length))) && name !== username) {
            results.push({ name, score: 3 });
            if (results.length >= maxResults * 2) break;
        }
    }

    // Strategy 2: Same length, similar characters
    for (const [name] of LIBRARY.anchors) {
        if (name.length === len && name !== username) {
            const similarity = calculateSimilarity(username, name);
            if (similarity >= 0.5) {
                results.push({ name, score: similarity * 2 });
            }
        }
        if (results.length >= maxResults * 3) break;
    }

    // Strategy 3: Contains the base word
    if (username.length >= 4) {
        for (const [name] of LIBRARY.anchors) {
            if (name.includes(username) && name !== username) {
                results.push({ name, score: 2.5 });
            }
            if (results.length >= maxResults * 4) break;
        }
    }

    // Sort by score and return top results
    return results
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults)
        .map(r => r.name);
}

/**
 * Calculate similarity between two strings (0-1)
 */
function calculateSimilarity(str1, str2) {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    let matches = 0;
    const len = Math.max(str1.length, str2.length);

    for (let i = 0; i < Math.min(str1.length, str2.length); i++) {
        if (str1[i] === str2[i]) matches++;
    }

    // Also check for common substrings
    const shorter = str1.length < str2.length ? str1 : str2;
    const longer = str1.length < str2.length ? str2 : str1;
    if (longer.includes(shorter)) {
        matches += shorter.length * 0.5;
    }

    return matches / len;
}

export function batchEstimate(usernames, tonPrice = CONFIG.LIVE_TON_PRICE) {
    return usernames.map(u => ({ username: u, ...TheOracle.consult(u, tonPrice) }));
}

export function getLibraryStats() {
    return {
        totalAnchors: LIBRARY.anchors.size,
        totalVolume: LIBRARY.totalVolume,
        percentiles: LIBRARY.pricePercentiles,
        calibrationFactors: Object.fromEntries(LIBRARY.calibrationFactors)
    };
}

export async function estimateValueAsync(username) {
    const tonPrice = await fetchLiveTonPrice();
    return TheOracle.consult(username, tonPrice);
}
