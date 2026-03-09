/**
 * Sales Monitor Service v10.1 - Patched & Optimized
 * Uses Puppeteer to scrape confirmed sales directly from Marketapp.ws
 */

import 'dotenv/config';
import { generateNewsCard2 } from '../../../Shared/UI/Components/card-generator.component.js';
import { scrapeMarketappSales } from '../../Market/Infrastructure/marketapp-scraper.repository.js';
import { escapeMD } from '../../../App/Helpers/report.helper.js';

// Bot instance
let botInstance = null;
let scrapeTimer = null;

// Track processed events with cleanup capability (Max 2000 items)
// MEMORY LEAK FIX: Prevent infinite growth
const processedEvents = new Set();

// Configuration
const MONITOR_CONFIG = {
    channelId: process.env.CHANNEL_ID || '@FragmentsCommunity',
    scrapeIntervalMs: 15 * 60 * 1000, // 15 minutes (Safer for Render Free Tier)
    minPriceUsername: 10000,
    minPriceNumber: 6000,
    aiPrompt: 'You are a world-class NFT Analyst. Write a brief but hype report. Input: ${name} (${price} TON). Output: Strong Headline + 2 bullet points analysis.'
};

// ... lines 28-112 unchanged ...

// ==================== SCRAPER LOOP ====================

async function runScraper(isFirstRun = false) {
    const time = new Date().toLocaleTimeString();
    console.log(`🔍 [${time}] Scraping Marketapp...`);

    // Memory Leak Preventer: Keep Set size manageable
    if (processedEvents.size > 1000) {
        const it = processedEvents.values();
        for (let i = 0; i < 500; i++) processedEvents.delete(it.next().value);
    }

    // Manual GC if available
    if (global.gc) {
        try { global.gc(); } catch (e) { }
    }

    try {
        // ⚡ OPTIMIZED: Run scrapes SEQUENTIALLY to save memory
        const usernameSales = await scrapeMarketappSales('username');

        await new Promise(r => setTimeout(r, 30000));

        const numberSales = await scrapeMarketappSales('number');
        const allSales = [...usernameSales, ...numberSales];

        console.log(`   📦 Found ${allSales.length} total items on page`);

        for (const sale of allSales) {
            // Unique ID: Name + Price
            const saleId = `SCRAPE-${sale.name}-${sale.price}`;

            if (processedEvents.has(saleId)) continue;
            processedEvents.add(saleId);

            // Threshold Check
            const threshold = sale.assetType === 'username'
                ? MONITOR_CONFIG.minPriceUsername
                : MONITOR_CONFIG.minPriceNumber;

            if (sale.price < threshold) {
                if (!isFirstRun) console.log(`   Skipping ${sale.name} (${sale.price} < ${threshold})`);
                continue;
            }

            if (isFirstRun) {
                continue;
            }

            console.log(`   🚀 NEW SALE DETECTED: ${sale.name} for ${sale.price} TON`);

            await broadcastSale({
                type: 'SALE',
                name: sale.name,
                price: sale.price,
                assetType: sale.assetType,
                buyer: 'Anonymous',
                seller: 'Anonymous',
                nftAddress: ''
            });
        }
    } catch (e) {
        console.error('❌ Scraper Loop Error:', e.message);
    }
}

// ==================== BROADCAST ====================

export async function broadcastSale({ name, price, assetType }) {
    console.log(`🚀 Broadcasting: ${name} sold for ${price} TON`);

    if (!botInstance) {
        console.error('⚠️ Bot not set!');
        return;
    }

    try {
        let cardBuffer = null;
        try {
            const imageBase64 = await fetchAssetImage(name, assetType);
            if (imageBase64) {
                cardBuffer = await generateNewsCard2({
                    image: imageBase64,
                    headline: 'SOLD'
                });
            }
        } catch (err) {
            console.warn('⚠️ Image failed:', err.message);
        }

        const priceFormatted = price.toLocaleString('en-US', { maximumFractionDigits: 0 });
        const emoji = assetType === 'username' ? '👤' : '📞';

        let newsPost = `${emoji} *${name}*\n\n💰 Sold for *${priceFormatted} TON*\n\n━━━━━━━━━━━━━━━\n📢 ${MONITOR_CONFIG.channelId}`;

        // Attempt AI
        let aiNews = await generateAINewsPost(name, price, assetType);
        if (aiNews) {
            // Escape Markdown special chars from AI output
            aiNews = aiNews.replace(/[_*`\[\]]/g, '\\$&');
            newsPost = `${emoji} *${escapeMD(name)}*\n\n💰 Sold for *${priceFormatted} TON*\n\n${aiNews}\n\n━━━━━━━━━━━━━━━\n📢 ${escapeMD(MONITOR_CONFIG.channelId)}`;
        } else {
            newsPost = `${emoji} *${escapeMD(name)}*\n\n💰 Sold for *${priceFormatted} TON*\n\n━━━━━━━━━━━━━━━\n📢 ${escapeMD(MONITOR_CONFIG.channelId)}`;
        }


        const cleanName = name.replace(/^[@+]/, '');
        const fragmentUrl = assetType === 'username'
            ? `https://fragment.com/username/${cleanName}`
            : `https://fragment.com/number/${cleanName}`;

        const keyboard = {
            inline_keyboard: [[
                { text: '🔗 View on Fragment', url: fragmentUrl }
            ]]
        };

        const msgOpts = { parse_mode: 'Markdown', reply_markup: keyboard };

        if (cardBuffer) {
            msgOpts.caption = newsPost;
            msgOpts.source = cardBuffer;
            await botInstance.telegram.sendPhoto(MONITOR_CONFIG.channelId, { source: cardBuffer }, msgOpts);

        } else {
            await botInstance.telegram.sendMessage(MONITOR_CONFIG.channelId, newsPost, msgOpts);
        }

        console.log('✅ Posted to channel!');

        // Logic for daily report omitted
        try {
            const { recordSale } = await import('../../Admin/Application/daily-report.service.js');
            recordSale({
                type: 'SALE',
                name,
                price,
                buyer: 'Anonymous',
                assetType,
                nftAddress: ''
            });
        } catch (e) { /* ignore */ }

    } catch (e) {
        console.error('Broadcast Error:', e.message);
    }
}

// ==================== HELPERS ====================

async function fetchAssetImage(name, type) {
    try {
        const cleanName = name.replace(/^[@+]/, '');
        const url = type === 'username'
            ? `https://nft.fragment.com/username/${cleanName}.webp`
            : `https://nft.fragment.com/number/${cleanName}.webp`;

        const resp = await fetch(url);
        if (resp.ok) {
            const buffer = await resp.arrayBuffer();
            return Buffer.from(buffer).toString('base64');
        }
    } catch { }
    return null;
}

async function generateAINewsPost(name, price, assetType) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    try {
        if (!MONITOR_CONFIG.aiPrompt) return null;

        // Dynamic prompt replacement
        const prompt = MONITOR_CONFIG.aiPrompt
            .replace(/\${name}/g, name)
            .replace(/\${price}/g, price)
            .replace(/\${assetType}/g, assetType);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const json = await response.json();
        return json.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch { return null; }
}

export function testBroadcast() {
    broadcastSale({
        name: '@test_user',
        price: 999,
        assetType: 'username'
    });
}

// ==================== EXPORTED API ====================

function setBot(bot) {
    botInstance = bot;
}

function startMonitor() {
    if (scrapeTimer) return;
    console.log('✅ Sales Monitor Started');
    runScraper(true); // Run immediately
    scrapeTimer = setInterval(() => runScraper(false), MONITOR_CONFIG.scrapeIntervalMs);
}

function stopMonitor() {
    if (scrapeTimer) {
        clearInterval(scrapeTimer);
        scrapeTimer = null;
        console.log('🛑 Sales Monitor Stopped');
    }
}

function getConfig() {
    return { ...MONITOR_CONFIG };
}

function updateConfig(key, value) {
    if (key === 'scrapeIntervalSeconds') {
        MONITOR_CONFIG.scrapeIntervalMs = value * 1000;
        stopMonitor();
        startMonitor();
        return;
    }

    if (key in MONITOR_CONFIG) {
        MONITOR_CONFIG[key] = value;
        // If interval directly changed (rare), restart
        if (key === 'scrapeIntervalMs') {
            stopMonitor();
            startMonitor();
        }
    }
}

export default {
    setBot,
    startMonitor,
    stopMonitor,
    getConfig,
    updateConfig,
    broadcastSale, // Also export this if needed directly
    testBroadcast
};
