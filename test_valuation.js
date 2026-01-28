import { calculateRarity, estimateValue } from './src/config.js';
import { scrapeFragment, getTonPrice, closeBrowser } from './src/services/fragmentService.js';

// List of usernames to test
const usernames = ['rare', 'news', 'crypto', 'game', 'cat'];

async function runTests() {
    console.log('🚀 Starting Valuation Test...');
    console.log('================================');

    try {
        const tonPrice = await getTonPrice();
        console.log(`💎 Current TON Price: $${tonPrice.toFixed(2)}`);
        console.log('================================\n');

        for (const username of usernames) {
            console.log(`🔍 Analyzing @${username}...`);

            // 1. Scrape real data
            const fragmentData = await scrapeFragment(username);

            // 2. Calculate Rarity
            const rarity = calculateRarity(username);

            // 3. Estimate Value
            const valuation = estimateValue(username, fragmentData.lastSalePrice, tonPrice, fragmentData.status);

            console.log(`  📊 Status:     ${fragmentData.statusText}`);
            console.log(`  ⭐ Rarity:     ${rarity.tier} ${rarity.stars}`);
            console.log(`  🏷️  Category:   ${rarity.label || 'Standard'}`);
            if (fragmentData.lastSalePrice) {
                console.log(`  📜 Last Sale:  ${fragmentData.lastSalePrice.toLocaleString()} TON`);
            }
            console.log(`  💰 EST. VALUE: ${valuation.ton.toLocaleString()} TON (~$${valuation.usd.toLocaleString()})`);
            console.log('--------------------------------------------------\n');
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await closeBrowser();
        process.exit(0);
    }
}

runTests();
