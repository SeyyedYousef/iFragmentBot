
import { estimateValue } from './src/config.js';

console.log("\n🧪 GOD MODE TEST: STRESS TESTING THE ALGORITHM\n");

const trashCases = [
    '@xkqzjwvp',       // Random Gibberish (8 chars)
    '@qwrx',           // Random 4-char (Ugly)
    '@qwx',            // Random 3-char (Ugly)
    '@strength',       // English Word (1 vowel) - Fails vowel ratio?
    '@queue',          // English Word (4 vowels) - Fails vowel ratio?
    '@54321',          // Descending Sequence - Fails generic sequence check?
    '@13579',          // Odd Step Sequence
    '@scum',           // Dictionary word? (Maybe not in list)
];

console.log("| Username       | Valuation | Label             | Factors");
console.log("| :------------- | :-------- | :---------------- | :------------------------------");

for (const username of trashCases) {
    const result = estimateValue(username);
    const val = result.ton.toLocaleString().padEnd(9);
    const label = result.rarity.label.padEnd(17);
    console.log(`| ${username.padEnd(14)} | ${val} | ${label} | ${result.factors[0]}`);
}
