import { estimateValue } from './src/config.js';

const tests = ['rare', 'dope', 'billionaire', 'collection', 'premium', 'exclusive', 'luxury', 'elite', 'vip', 'legend', 'iconic', 'supreme', 'ultimate', 'infinite', 'eternal'];

console.log('\n🔮 TESTING HIGH-VALUE USERNAMES:\n');
console.log('─'.repeat(90));

for (const u of tests) {
    const r = estimateValue(u);
    console.log(
        `@${u.padEnd(15)} │ ${r.ton.toLocaleString().padStart(12)} TON │ $${r.usd.toLocaleString().padStart(12)} │ ${r.rarity.stars.padEnd(12)} │ ${r.rarity.tier.padEnd(12)} │ ${r.aura.archetype}`
    );
}

console.log('\n✅ Test complete!\n');
