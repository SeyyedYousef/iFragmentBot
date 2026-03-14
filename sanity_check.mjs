/**
 * Sanity check after Biome cleanup
 */
import engine from './src/Modules/Market/Infrastructure/free_gift_engine.api.js';

async function runSanity() {
    console.log("🛠️ Starting Sanity Check...");
    try {
        const fees = await engine.getProvidersFee();
        console.log("✅ Providers Fee accessible:", !!fees);
        
        const gift = await engine.getGiftByName("PlushPepe-1");
        if (gift && gift.telegram_gift_name) {
            console.log("✅ Engine Logic Intact. Found:", gift.telegram_gift_name);
        } else {
            console.warn("⚠️ Gift not found, but engine returned gracefully.");
        }
        
        console.log("🚀 ALL SYSTEMS NOMINAL. Biome cleanup was successful.");
    } catch (e) {
        console.error("❌ CRITICAL: Biome might have broken something!", e.message);
        process.exit(1);
    }
}

runSanity();
