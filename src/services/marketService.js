import puppeteer from 'puppeteer';
import { getBrowser } from './cardGenerator.js';
import fs from 'fs';
import path, { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load cached images
let cachedImages = {};
try {
    const dataPath = join(__dirname, '../data/giftImages.json');
    if (fs.existsSync(dataPath)) {
        cachedImages = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    }
} catch (e) {
    console.error('⚠️ Failed to load cached images:', e.message);
}

const COLLECTIONS = [
    { name: 'Plush Pepe', url: 'https://getgems.io/collection/EQBG-g6ahkAUGWpefWbx-D_9sQ8oWbvy6puuq78U2c4NUDFS' },
    { name: 'Heart Locket', url: 'https://getgems.io/collection/EQC4XEulxb05Le5gF6esMtDWT5XZ6tlzlMBQGNsqffxpdC5U' },
    { name: 'Durov\'s Cap', url: 'https://getgems.io/collection/EQD9ikZq6xPgKjzmdBG0G0S80RvUJjbwgHrPZXDKc_wsE84w' },
    { name: 'Precious Peach', url: 'https://getgems.io/collection/EQA4i58iuS9DUYRtUZ97sZo5mnkbiYUBpWXQOe3dEUCcP1W8' },
    { name: 'Heroic Helmet', url: 'https://getgems.io/collection/EQAlROpjm1k1mW30r61qRx3lYHsZkTKXVSiaHEIhOlnYA4oy' },
    { name: 'Mighty Arm', url: 'https://getgems.io/collection/EQDeX0F1GDugNjtxkFRihu9ZyFFumBv2jYF5Al1thx2ADDQs' }
];

const NUMBERS_URL = 'https://getgems.io/collection/EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N';

async function scrapeCollection(browser, url, name) {
    let page = null;
    try {
        page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 768 });

        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'font', 'media'].includes(req.resourceType())) req.abort();
            else req.continue();
        });

        console.log(`🔍 [${name}] Navigating...`);
        // Gentler timeout
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });

        // Wait for potential stats container
        try {
            await page.waitForSelector('div[class*="Stats"]', { timeout: 7000 });
        } catch (e) { }

        const price = await page.evaluate(() => {
            const parsePrice = (str) => {
                if (!str) return 0;
                let valStr = str.trim();
                let multiplier = 1;

                // Check for K or M suffix (case insensitive)
                if (/k$/i.test(valStr)) {
                    multiplier = 1000;
                    valStr = valStr.replace(/k$/i, '');
                } else if (/m$/i.test(valStr)) {
                    multiplier = 1000000;
                    valStr = valStr.replace(/m$/i, '');
                }

                // Remove non-numeric except dot and comma
                const match = valStr.match(/([\d\.,]+)/);
                if (!match) return 0;

                const num = parseFloat(match[1].replace(/,/g, ''));
                return num * multiplier;
            };

            let priceVal = 0;

            // Strategy 1: Look for "Floor" text in standard elements using XPath
            // This handles cases where text is split across elements
            const xpathResult = document.evaluate(
                "//*[contains(text(), 'Floor') or contains(text(), 'floor')]",
                document,
                null,
                XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                null
            );

            for (let i = 0; i < xpathResult.snapshotLength; i++) {
                const node = xpathResult.snapshotItem(i);
                const parent = node.parentElement;
                if (parent) {
                    const text = parent.innerText || parent.textContent;
                    // Regex for "Floor <newline> 100 TON" or "Floor 100"
                    // \s includes newlines
                    const match = text.match(/Floor\s*[:\-]?\s*([\d\.,]+[KkMm]?)\s*(\w*)/i);
                    if (match) {
                        priceVal = parsePrice(match[1]);
                        if (priceVal > 0) return priceVal;
                    }

                    // Look at next sibling if the number is in a separate sibling element
                    const next = node.nextElementSibling || node.nextSibling;
                    if (next && next.textContent) {
                        const nextText = next.textContent.trim();
                        const nextMatch = nextText.match(/([\d\.,]+[KkMm]?)/);
                        if (nextMatch) {
                            priceVal = parsePrice(nextMatch[1]);
                            if (priceVal > 0) return priceVal;
                        }
                    }
                }
            }

            // Strategy 2: Specific Getgems class partial match (often "StatsItem")
            const statItems = document.querySelectorAll('div[class*="StatsItem"]');
            statItems.forEach(item => {
                const text = item.innerText;
                if (/Floor/i.test(text)) {
                    const match = text.match(/([\d\.,]+[KkMm]?)/);
                    if (match) priceVal = parsePrice(match[1]);
                }
            });
            if (priceVal > 0) return priceVal;

            // Strategy 3: Brute force regex on body text (last resort)
            const bodyText = document.body.innerText;
            const fallbackMatch = bodyText.match(/Floor\s*[^\d]{0,30}\s*([\d\.,]+[KkMm]?)\s*[^\d]*TON/i);
            if (fallbackMatch) priceVal = parsePrice(fallbackMatch[1]);

            return priceVal;
        });

        console.log(`✅ [${name}] Price: ${price}`);
        return { price };

    } catch (error) {
        console.error(`❌ [${name}] Error:`, error.message);
        return { price: 0 };
    } finally {
        if (page) await page.close();
    }
}

export async function getGiftStats() {
    let browser = null;

    try {
        browser = await getBrowser();
        const results = {};

        // Run in parallel chunks of 3
        const chunkSize = 3;
        for (let i = 0; i < COLLECTIONS.length; i += chunkSize) {
            const chunk = COLLECTIONS.slice(i, i + chunkSize);
            const promises = chunk.map(col => scrapeCollection(browser, col.url, col.name).then(data => ({
                name: col.name,
                price: data.price
            })));

            const chunkResults = await Promise.all(promises);
            chunkResults.forEach(res => {
                // Use null if price is 0 (scraping failed)
                const finalPrice = res.price > 0 ? res.price : null;
                if (res.price === 0) {
                    console.log(`⚠️ [${res.name}] Price unavailable`);
                }

                results[res.name] = {
                    name: res.name,
                    price: finalPrice,
                    image: cachedImages[res.name] || 'https://via.placeholder.com/150'
                };
            });
        }

        return results;

    } catch (error) {
        console.error('❌ Gift Scrape Fatal Error:', error);
        // Return data with null prices instead of fake data
        console.log('⚠️ Scraping failed - prices will show as unavailable');
        const results = {};
        COLLECTIONS.forEach(col => {
            results[col.name] = {
                name: col.name,
                price: null, // No fake prices!
                image: cachedImages[col.name] || 'https://via.placeholder.com/150'
            };
        });
        return results;
    }
}

// New URL provided by user
const FRAGMENT_NUMBERS_URL = 'https://fragment.com/numbers?sort=price_asc&filter=sale';

export async function get888Stats() {
    const MAX_RETRIES = 3;
    let browser = null;

    try {
        browser = await getBrowser();
    } catch (e) {
        console.error('❌ Failed to get browser for 888 stats:', e.message);
        return null;
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        let page = null;
        try {
            if (attempt > 1) {
                console.log(`⏳ [+888] Retry attempt ${attempt}/${MAX_RETRIES}...`);
                await new Promise(r => setTimeout(r, 2000 * attempt)); // Progressive delay
            }

            page = await browser.newPage();
            await page.setViewport({ width: 1366, height: 768 });

            // Optimizations
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                if (['image', 'font', 'media', 'stylesheet'].includes(req.resourceType())) req.abort();
                else req.continue();
            });

            console.log(`🔍 [+888] Navigating to Fragment (Attempt ${attempt})...`);
            await page.goto(FRAGMENT_NUMBERS_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

            // Wait for table rows - Fragment uses .table-row usually, or just wait for text
            try {
                await page.waitForSelector('.tm-value', { timeout: 10000 });
            } catch (e) {
                console.log(`⚠️ [+888] Selector wait timeout (Attempt ${attempt})`);
            }

            const price = await page.evaluate(() => {
                // Helper to parse "1,800" -> 1800
                const parseVal = (str) => {
                    if (!str) return 0;
                    return parseFloat(str.replace(/,/g, '').trim());
                };

                // Fragment Listing Structure:
                // We want the FIRST valid price in the list (since we sorted by price_asc)

                const valueElements = document.querySelectorAll('.tm-value, .table-cell-value');
                for (const el of valueElements) {
                    const text = el.innerText;
                    // Look for plain numbers like "1,800" or "500"
                    // avoid "3 days" or "+888..."
                    if (/^[\d,]+$/.test(text)) {
                        const val = parseVal(text);
                        if (val > 0) return val;
                    }
                }
                return 0;
            });

            if (price > 0) {
                console.log(`✅ [+888] Floor Price found: ${price} TON`);
                await page.close();
                return price;
            }

            console.log(`⚠️ [+888] Price unavailable (Parsing failed)`);
            await page.close();

        } catch (error) {
            console.error(`❌ [+888] Error (Attempt ${attempt}):`, error.message);
            if (page) {
                try { await page.close(); } catch (e) { }
            }
        }
    }

    console.log('❌ [+888] All retries failed. Returning null.');
    return null;
}

