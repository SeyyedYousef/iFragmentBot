
import { estimateValue } from './src/config.js';

console.log("🧪 VERIFICATION SUITE: ALGORITHM V13.1");
console.log("| Username | Value | Label | Factors |");
console.log("| --- | --- | --- | --- |");

const cases = [
    '@news',   // CSV High Value (Should be ~994k)
    '@rare',   // Premium 4-char (Should be high algo)
    '@abcd',   // Trash 4-char (Should be > 10)
    '@xyzq',   // Trash 4-char
    '@google', // God Tier Brand (Should be high)
    '@openai', // Tech Brand
    '@trashname123', // Long trash (Should be low)
    '@verylongpremiumname', // Long premium (Should be moderate/low due to length)
    '@game',   // CSV + Premium
    '@love',   // CSV + Premium
];

for (const u of cases) {
    const res = estimateValue(u);
    console.log(`| ${u.padEnd(15)} | ${res.ton.toLocaleString().padEnd(10)} | ${res.rarity.label.padEnd(15)} | ${res.factors.join(', ')} |`);
}
