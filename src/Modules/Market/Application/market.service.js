import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch'; // Standard fetch
import * as seetgService from '../../Automation/Application/seetg.service.js';
import * as marketappService from './marketapp.service.js';
import { tonPriceCache } from '../../../Shared/Infra/Cache/cache.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Local Assets Directory
const ASSETS_DIR = path.resolve(__dirname, '../Infrastructure/Assets/Gifts');

// The specific 6 collections requested by user
const TARGET_COLLECTIONS = [
    { name: 'Plush Pepe', slug: 'plush-pepe', filename: 'plushpepe.jpg' },
    { name: 'Heart Locket', slug: 'heart-locket', filename: 'heartlocket.jpg' },
    { name: 'Durov\'s Cap', slug: 'durovs-cap', filename: 'durovcap.jpg' },
    { name: 'Precious Peach', slug: 'precious-peach', filename: 'preciouspeach.jpg' },
    { name: 'Heroic Helmet', slug: 'heroic-helmet', filename: 'heroichelmet.jpg' },
    { name: 'Mighty Arm', slug: 'mighty-arm', filename: 'mightyarm.jpg' }
];

/**
 * Get local image as Base64 Data URI
 */
function getGiftImageBase64(filename) {
    const localPath = path.join(ASSETS_DIR, filename);
    if (fs.existsSync(localPath)) {
        try {
            const bitmap = fs.readFileSync(localPath);
            const base64 = Buffer.from(bitmap).toString('base64');
            return `data:image/jpeg;base64,${base64}`;
        } catch (e) {
            console.error(`Failed to load image ${filename}:`, e.message);
        }
    }
    return null;
}

// Hardcoded fallback prices (updated regularly) - used when ALL other sources fail
const FALLBACK_GIFT_PRICES = {
    'plush-pepe': 9200,
    'heart-locket': 2100,
    'durovs-cap': 790,
    'precious-peach': 418,
    'heroic-helmet': 265,
    'mighty-arm': 180
};

/**
 * Extract floor price from a collection object, trying multiple possible paths.
 * Different APIs return prices in different formats.
 */
function extractFloorPrice(collection) {
    if (!collection) return 0;

    // Try multiple possible paths for floor price
    const candidates = [
        collection.extra_data?.floor,
        collection.extra_data?.floor_price,
        collection.floor_price,
        collection.floor,
        collection.price,
        collection.extra_data?.price,
    ];

    for (const val of candidates) {
        if (val != null && !isNaN(val) && Number(val) > 0) {
            const num = Number(val);
            // If value is in nanoTON (> 1 billion), convert to TON
            if (num > 1_000_000_000) {
                return num / 1_000_000_000;
            }
            return num;
        }
    }

    return 0;
}

export async function getGiftStats() {
    try {
        console.log('📊 Fetching Gift Stats (Using Marketapp API)...');

        // Use the centralized marketapp service which handles API calls and fallbacks
        let allCollections = [];
        try {
            allCollections = await marketappService.getGiftCollections();
            console.log(`📊 Got ${allCollections?.length || 0} collections from API/Fallback`);
        } catch (e) {
            console.warn('⚠️ getGiftCollections failed:', e.message);
        }

        const results = {};

        // Filter and map to our target list
        for (const target of TARGET_COLLECTIONS) {
            let price = 0;

            // 1. Try Marketapp API data
            if (allCollections && allCollections.length > 0) {
                const found = allCollections.find(c => c.slug === target.slug);
                price = extractFloorPrice(found);
                if (price > 0) {
                    console.log(`  ✅ ${target.name}: ${price} TON (from Marketapp)`);
                }
            }

            // 2. Try Seetg API for individual collection floor
            if (price <= 0) {
                try {
                    const seetgData = await seetgService.getMarketFloors(target.slug);
                    if (seetgData && seetgData.floor && parseFloat(seetgData.floor) > 0) {
                        price = parseFloat(seetgData.floor);
                        console.log(`  ✅ ${target.name}: ${price} TON (from Seetg)`);
                    }
                } catch (e) {
                    // Seetg failed, continue to fallback
                }
            }

            // 3. Use hardcoded fallback price
            if (price <= 0) {
                price = FALLBACK_GIFT_PRICES[target.slug] || 0;
                if (price > 0) {
                    console.log(`  ⚠️ ${target.name}: ${price} TON (from Fallback)`);
                }
            }

            results[target.name] = {
                name: target.name,
                price: price,
                image: getGiftImageBase64(target.filename)
            };
        }

        // Log summary
        const withPrice = Object.values(results).filter(r => r.price > 0).length;
        console.log(`📊 Gift Stats Summary: ${withPrice}/${Object.keys(results).length} gifts have prices`);

        return results;

    } catch (error) {
        console.error('❌ Gift Stats Error:', error.message);
        // Even on full failure, return fallback data instead of empty
        const fallbackResults = {};
        TARGET_COLLECTIONS.forEach(target => {
            fallbackResults[target.name] = {
                name: target.name,
                price: FALLBACK_GIFT_PRICES[target.slug] || 0,
                image: getGiftImageBase64(target.filename)
            };
        });
        console.log('⚠️ Using full fallback gift data');
        return fallbackResults;
    }
}

// +888 Stats
export async function get888Stats() {
    console.log('📱 Fetching +888 Stats...');

    // Priority 1: Seetg API (Fastest & Most Reliable if Key exists)
    try {
        const seetgCollections = await seetgService.getMarketFloors('anonymous-number');
        if (seetgCollections && seetgCollections.floor && parseFloat(seetgCollections.floor) > 0) {
            console.log(`📱 Seetg returned +888 floor: ${seetgCollections.floor}`);
            return parseFloat(seetgCollections.floor);
        }
    } catch (e) {
        // Ignore Seetg errors (likely auth)
    }

    // Priority 2: Puppeteer Scraping using SHARED browser (avoid resource conflicts)
    let page = null;
    try {
        console.log('📱 Attempting to scrape Fragment with shared browser...');

        const { getBrowser } = await import('../../../Shared/UI/Components/card-generator.component.js');
        const browser = await getBrowser();
        page = await browser.newPage();

        // Optimized Resource Blocking (Speed up load)
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

        // Go to Fragment
        await page.goto('https://fragment.com/numbers?sort=price_asc&filter=sale', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        // Wait for ANY currency symbol or value to appear
        try {
            await page.waitForSelector('.table-cell-value, .tm-value, table', { timeout: 10000 });
        } catch (e) {
            console.warn('⚠️ Timeout waiting for selectors on Fragment.');
        }

        // Scrape Price
        const price = await page.evaluate(() => {
            const parsePrice = (str) => {
                if (!str) return null;
                const match = str.match(/([\d,\.]+)\s*TON/);
                if (match) return parseFloat(match[1].replace(/,/g, ''));
                return null;
            };

            const cells = document.querySelectorAll('.table-cell-value');
            for (const cell of cells) {
                const p = parsePrice(cell.innerText);
                if (p && p > 0) return p;
            }

            const table = document.querySelector('table');
            if (table) {
                const p = parsePrice(table.innerText);
                if (p && p > 0) return p;
            }

            return null;
        });

        if (price && price > 0) {
            console.log(`📱 Scraped +888 Price: ${price} TON`);
            return price;
        }

    } catch (e) {
        console.warn(`⚠️ +888 Scraping Failed: ${e.message}`);
    } finally {
        if (page) {
            try { await page.close(); } catch (e) { }
        }
    }

    // Priority 3: Dynamic Search/Cache Fallback (Last Resort)
    const cached = tonPriceCache.get('floor888');
    if (cached && cached.price) {
        console.log(`⚠️ Using Cached +888 Price: ${cached.price} TON`);
        return cached.price;
    }

    console.log('⚠️ Using Hardcoded Safety +888 Price: 850 TON');
    return 850;
}

// TON Price
export async function getTonPrice() {
    let price = 0;
    try {
        // Try Seetg
        try {
            const rate = await seetgService.getTonRate();
            if (rate && rate.tonUsd) price = parseFloat(rate.tonUsd);
        } catch (e) { }

        // If failed or invalid, try CoinGecko
        if (!price || price < 0.5) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd', { signal: controller.signal });
            clearTimeout(timeout);
            if (res.ok) {
                const data = await res.json();
                price = data['the-open-network']?.usd || 0;
            }
        }
    } catch (e) {
        console.warn('⚠️ TON Price fetch failed:', e.message);
    }

    // Sanity Check: If price is suspiciously low (e.g. < $0.5 which is impossible), use a hardcoded realistic fallback.
    // The previous run showed $1.43 which is wrong.
    if (!price || price < 0.5) {
        console.log(`⚠️ Fetched TON price (${price}) is suspicious. Using fallback.`);
        // Updated fallback to match image ($1.38)
        return 1.38;
    }

    return price;
}
