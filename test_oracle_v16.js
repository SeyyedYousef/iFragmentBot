/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 * THE OMNI-SINGULARITY ENGINE v16.0 - TEST SUITE
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { TheOracle, estimateValue, getLibraryStats, CONFIG } from './src/config.js';

console.log('\n');
console.log('╔═══════════════════════════════════════════════════════════════════════════════════════╗');
console.log('║  🔮 THE OMNI-SINGULARITY ENGINE v16.0 - FINAL GOD MODE TEST                           ║');
console.log('║  "Think Like a Whale Investor. Value Like a Machine."                                  ║');
console.log('╚═══════════════════════════════════════════════════════════════════════════════════════╝');
console.log('\n');

// Library Stats
const stats = getLibraryStats();
console.log('📚 LIBRARY STATISTICS:');
console.log(`   Total Anchors: ${stats.totalAnchors.toLocaleString()}`);
console.log(`   Total Volume: ${stats.totalVolume.toLocaleString()} TON`);
console.log(`   Median Price: ${stats.percentiles.p50.toLocaleString()} TON`);
console.log(`   P90 Price: ${stats.percentiles.p90.toLocaleString()} TON`);
console.log('\n');

// Test Cases by Category
const testCases = {
    '🏆 TIER 0 - CORPORATE GODS': [
        'apple', 'google', 'tesla', 'openai', 'binance', 'telegram', 'nike'
    ],

    '🌍 TIER 1 - ATLAS (Geography)': [
        'dubai', 'london', 'tokyo', 'moscow', 'paris', 'iran', 'usa'
    ],

    '💰 TIER 2 - WEALTH SECTOR': [
        'btc', 'eth', 'sol', 'money', 'crypto', 'whale', 'gold'
    ],

    '🐋 TIER 3 - GLOBAL WHALE BAIT': [
        'habibi', 'sheikh', 'tala', 'shah', 'piter', 'gazprom', 'dragon'
    ],

    '📖 TIER 4 - EXPANDED UNIVERSE': [
        'lion', 'tiger', 'boss', 'king', 'queen', 'love', 'fire'
    ],

    '🔗 COMBO DETECTION': [
        'tehranshop', 'cryptoking', 'dubaiwealth', 'moscowbank', 'goldrush'
    ],

    '🔢 LEET SPEAK': [
        'g00gle', 'app1e', 'l33t', 't3sla', 'b1tc01n'
    ],

    '⌨️ KEYBOARD PATTERNS': [
        'qwerty', 'asdfgh', 'zxcvbn'
    ],

    '🪞 PALINDROMES': [
        'radar', 'level', 'civic', 'kayak', 'madam'
    ],

    '📅 GOLDEN YEARS': [
        'class2020', 'born1990', 'team2024', 'vision2030'
    ],

    '💻 TECH PATTERNS': [
        '101010', '111111', 'ff00ff', 'aaaaaa'
    ],

    '⚠️ MIXED/CLUTTERED': [
        'john_doe123', 'user_test', 'random_12345'
    ],

    '🤖 SERVICE BOTS': [
        'cryptobot', 'newsbot', 'priceapp', 'tradebot'
    ],

    '📊 MARKET PROVEN (CSV)': [
        'news', 'bank', 'king', 'rich', 'gold', 'visa', 'meta'
    ],

    '🗑️ LOW QUALITY': [
        'xkqjvz', 'zxqwpf', 'qjxvkm'
    ],

    '💎 4-CHAR PREMIUM': [
        'fire', 'gold', 'king', 'love', 'star', 'moon', 'wolf'
    ]
};

// Run tests
console.log('═══════════════════════════════════════════════════════════════════════════════════════════');
console.log('  VALUATION RESULTS');
console.log('═══════════════════════════════════════════════════════════════════════════════════════════\n');

for (const [category, usernames] of Object.entries(testCases)) {
    console.log(`\n${category}`);
    console.log('─'.repeat(80));

    for (const username of usernames) {
        const result = estimateValue(username);
        const tonFormatted = result.ton.toLocaleString().padStart(12);
        const usdFormatted = ('$' + result.usd.toLocaleString()).padStart(14);

        console.log(
            `  @${username.padEnd(20)} │ ${result.rarity.stars.padEnd(12)} │ ` +
            `${tonFormatted} TON │ ${usdFormatted} │ ${result.rarity.tier.padEnd(12)} │ ${result.aura.archetype}`
        );
    }
}

console.log('\n');
console.log('═══════════════════════════════════════════════════════════════════════════════════════════');
console.log('  DETAILED BREAKDOWN - TOP EXAMPLES');
console.log('═══════════════════════════════════════════════════════════════════════════════════════════\n');

// Detailed breakdown for select examples
const detailedExamples = ['google', 'dubai', 'cryptoking', 'g00gle', 'radar', '101010', 'bank'];

for (const username of detailedExamples) {
    const result = estimateValue(username);
    console.log(`\n📍 @${username.toUpperCase()}`);
    console.log(`   Value: ${result.ton.toLocaleString()} TON (~$${result.usd.toLocaleString()})`);
    console.log(`   Tier: ${result.rarity.tier} ${result.rarity.stars}`);
    console.log(`   Archetype: ${result.aura.archetype}`);
    console.log(`   Confidence: ${result.confidence}%`);
    console.log(`   Factors: ${result.factors.join(' | ')}`);
}

console.log('\n\n');
console.log('╔═══════════════════════════════════════════════════════════════════════════════════════╗');
console.log('║  ✅ OMNI-SINGULARITY ENGINE v16.0 - TEST COMPLETE                                     ║');
console.log('╚═══════════════════════════════════════════════════════════════════════════════════════╝');
console.log('\n');
