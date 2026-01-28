
import { estimateValue } from './src/config.js';

const cases = [
    // 4-Char Mix (Trash vs Premium)
    '@abcd', '@xyzw', '@cool', '@love',
    // Random / Trash
    '@jklmno', '@asdfghjkl', '@qwer', '@12345678',
    // Brands/Tech
    '@gram', '@wallet', '@ton', '@crypto',
    // Names
    '@alice', '@david',
    // Patterns
    '@aaaaaa', '@121212',
    // Concepts
    '@freedom', '@future',
    // Long
    '@superduperlongname',
    // Numbers
    '@999'
];

console.log("| Username | Value (TON) | Label | Factors |");
console.log("| :--- | :--- | :--- | :--- |");

for (const u of cases) {
    const res = estimateValue(u);
    let val = res.ton.toLocaleString();
    console.log(`| ${u} | ${val} | ${res.rarity.label} | ${res.factors[0] || ''} |`);
}
