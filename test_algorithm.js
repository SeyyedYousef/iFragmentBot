
import { estimateValue } from './src/config.js';

console.log("\n🧪 OMNI-SINGULARITY: GOD MODE BENCHMARK (v13.0)\n");

const testCases = [
    // 1. THE REQUESTED ONE
    '@rare',        // Historical Anchor

    // 2. THE GODS (Anchors)
    '@news',        // The absolute peak
    '@auto',
    '@bank',
    '@chat',

    // 3. THE KINGS (Anchors/High Value)
    '@king',
    '@game',
    '@devil',       // From MarketApp CSV

    // 4. GOD MODE CHALLENGE (The New Logic Tests)
    '@rhythm',      // No vowels (Old: Trash -> New: High)
    '@google',      // Not in old dict (Old: Low -> New: High)
    '@apple',       // Premium Noun
    '@sky',         // Short Premium
    '@fly',         // Short verb
    '@velvet',      // Dictionary missing? check flow

    // 5. TRASH CHECK
    '@xkzjq',       // Pure Garbage
    '@aaaaa',       // Solid Pattern

    // 6. SUFFIX/PREFIX
    '@tradebot',    // Service Bot
    '@superapp',    // Application
];

console.log("| Username       | Valuation (TON) | Label             | Stars | Reason");
console.log("| :------------- | :-------------- | :---------------- | :---- | :------------------------------");

for (const username of testCases) {
    const result = estimateValue(username);
    const val = result.ton.toLocaleString().padEnd(13);
    const label = result.rarity.label.padEnd(20);
    const user = username.padEnd(14);
    const stars = result.rarity.stars.padEnd(5);
    // Truncate factor desc
    let factor = result.factors[0] || '';
    if (factor.length > 30) factor = factor.substring(0, 27) + '...';

    console.log(`| ${user} | ${val}   | ${label} | ${stars} | ${factor}`);
}

console.log("\n✅ BENCHMARK COMPLETE.");
