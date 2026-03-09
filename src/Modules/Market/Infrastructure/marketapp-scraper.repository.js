/**
 * Marketapp Scraper Service - Optimized & Robust
 * Uses Puppeteer to scrape confirmed sales directly from Marketapp.ws
 */

import puppeteer from 'puppeteer';

// Configuration
const SCRAPE_CONFIG = {
    // Adding sort_by=date to get newest first - REMOVED min_price to catch floor sales
    usernamesUrl: 'https://marketapp.ws/collection/EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi/?tab=history&sort_by=date_desc',
    numbersUrl: 'https://marketapp.ws/collection/EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N/?tab=history&sort_by=date_desc',
};

/**
 * Scrape sales from Marketapp
 */
export async function scrapeMarketappSales(type = 'username') {
    const url = type === 'username' ? SCRAPE_CONFIG.usernamesUrl : SCRAPE_CONFIG.numbersUrl;
    console.log(`🔍 [Scraper] Opening ${url}...`);

    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--disable-extensions',
                '--no-zygote'
            ]
        });

        const page = await browser.newPage();

        // Optimizations: Block images, fonts, css to save bandwidth/memory
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1366, height: 768 });

        // Go - Optimized retry logic
        try {
            // Reduced timeout since we blocked heavy assets
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        } catch (e) {
            console.log('   ⚠️ Page load timeout/error, trying to continue anyway...');
        }

        // Wait for table or content - More specific selector if possible, or body
        try {
            await page.waitForFunction(() => document.querySelectorAll('tr').length > 5, { timeout: 20000 });
        } catch (e) {
            console.log('   ⚠️ Table rows not detected immediately.');
        }

        // Must scroll to trigger loading if needed
        await autoScroll(page);

        // Extract data
        const sales = await page.evaluate(() => {
            const results = [];
            const rows = document.querySelectorAll('tr');

            // Robust Regex for parsing: "Sold @user 100 ~$500"
            // Matches: Sold [Space] Name [Space] PriceTON [Space] ~$PriceUSD
            const saleRegex = /Sold\s+([@+]\S+)\s+([\d,.]+)\s+~\$/i;

            rows.forEach(row => {
                const text = row.innerText;
                if (text.includes('Sold') || text.includes('auction')) {

                    // Attempt Regex Match first (More Reliable)
                    const match = text.match(saleRegex);

                    if (match) {
                        const name = match[1];
                        const priceStr = match[2];
                        const price = parseFloat(priceStr.replace(/,/g, ''));

                        if (!isNaN(price)) {
                            results.push({ name, price, raw: text });
                            return; // Next row
                        }
                    }

                    // Fallback to simple split logic if Regex fails but "Sold" is present
                    const parts = text.replace(/\s+/g, ' ').trim().split(' ');
                    const name = parts.find(p => p.startsWith('@') || p.startsWith('+'));
                    const nameIdx = parts.indexOf(name);

                    if (name && nameIdx !== -1 && nameIdx + 1 < parts.length) {
                        const priceStr = parts[nameIdx + 1];
                        const price = parseFloat(priceStr.replace(/,/g, ''));

                        if (!isNaN(price)) {
                            results.push({ name, price, raw: text });
                        }
                    }
                }
            });
            return results;
        });

        console.log(`   ✅ Scraper found ${sales.length} items.`);
        return sales.map(s => ({ ...s, assetType: type }));

    } catch (e) {
        console.error(`   ❌ Scraper Error: ${e.message}`);
        return [];
    } finally {
        if (browser) {
            try {
                await browser.close();
            } catch (e) {
                console.error('Error closing browser:', e.message);
            }
        }
    }
}

async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            var totalHeight = 0;
            var distance = 100;
            var timer = setInterval(() => {
                var scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight - window.innerHeight || totalHeight > 2000) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}
