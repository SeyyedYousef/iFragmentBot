import puppeteer from 'puppeteer';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import fetch from 'node-fetch';
import { CONFIG } from '../../../core/Config/app.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Chrome paths for different environments (Only for Windows/Local)
const WIN_CHROME_PATHS = [
    resolve(__dirname, '../../../../.cache/chrome/win64-143.0.7499.169/chrome-win64/chrome.exe'),
    join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
    join(process.env.PROGRAMFILES || '', 'Google/Chrome/Application/chrome.exe'),
    join(process.env['PROGRAMFILES(X86)'] || '', 'Google/Chrome/Application/chrome.exe'),
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

function findWindowsChrome() {
    if (process.platform !== 'win32') return null;

    for (const path of WIN_CHROME_PATHS) {
        if (existsSync(path)) return path;
    }
    return null;
}

/**
 * Find Chrome on Linux (Render.com / Docker)
 * Searches the cache directory for any installed Chrome version
 */
function findLinuxChrome() {
    if (process.platform === 'win32') return null;

    const cacheDir = process.env.PUPPETEER_CACHE_DIR || '/opt/render/project/src/.cache';
    const chromeDirs = [
        join(cacheDir, 'chrome'),
        '/opt/render/project/src/.cache/chrome',
        '.cache/chrome'
    ];

    for (const chromeDir of chromeDirs) {
        try {
            if (!existsSync(chromeDir)) continue;

            const versions = readdirSync(chromeDir);

            for (const version of versions) {
                if (version.startsWith('linux')) {
                    const chromePath = join(chromeDir, version, 'chrome-linux64', 'chrome');
                    if (existsSync(chromePath)) {
                        return chromePath;
                    }
                }
            }
        } catch (e) {
            // Skip this directory
        }
    }

    return null;
}

// Browser instance (reusable for performance)
let browserInstance = null;
let browserIdleTimer = null;
let launchPromise = null; // Prevent multiple simultaneous launches
const BROWSER_IDLE_TIMEOUT = 180000; // 180s idle timeout (was 60s, too short)

/**
 * Reset the idle timer. Called whenever the browser is used.
 */
function resetIdleTimer() {
    if (browserIdleTimer) clearTimeout(browserIdleTimer);
    browserIdleTimer = setTimeout(async () => {
        console.log('💤 (Card) Browser idle for 180s. Closing to free memory...');
        await closeBrowser();
    }, BROWSER_IDLE_TIMEOUT);
}

/**
 * Get or create browser instance
 */
export async function getBrowser() {
    // If instance is dead/disconnected, clear it
    if (browserInstance && !browserInstance.isConnected()) {
        console.log('⚠️ (Card) Browser disconnected! Restarting...');
        try { await browserInstance.close(); } catch (e) { }
        browserInstance = null;
    }

    // Return existing instance if available
    if (browserInstance) {
        resetIdleTimer();
        return browserInstance;
    }

    // Prevent multiple concurrent launches (race condition fix)
    if (launchPromise) {
        console.log('⏳ (Card) Waiting for existing Chrome launch...');
        await launchPromise;
        if (browserInstance) {
            resetIdleTimer();
            return browserInstance;
        }
    }

    // Launch new instance
    launchPromise = (async () => {
        console.log(`🌐 (Card) Launching Chrome... [${process.platform}]`);

        const launchOptions = {
            headless: 'new',
            dumpio: false, // Disable Chrome stderr spam (D-Bus errors are harmless)
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--disable-extensions',
                '--disable-component-extensions-with-background-pages',
                '--mute-audio',
                '--disable-default-apps',
                '--disable-features=Translate,BackForwardCache,AcceptCHFrame,MediaRouter,OptimizationHints',
                '--js-flags="--max-old-space-size=400"'
            ]
        };

        if (process.platform === 'win32') {
            const chromePath = findWindowsChrome();
            if (chromePath) {
                launchOptions.executablePath = chromePath;
            }
        } else {
            const chromePath = findLinuxChrome();
            if (chromePath) {
                launchOptions.executablePath = chromePath;
            } else if (process.env.PUPPETEER_EXECUTABLE_PATH) {
                launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
            }
        }

        try {
            // Add a timeout to the launch process to prevent indefinite hanging
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Browser launch timed out after 30s')), 30000)
            );

            browserInstance = await Promise.race([
                puppeteer.launch(launchOptions),
                timeoutPromise
            ]);

            browserInstance.on('disconnected', () => {
                console.log('❌ (Card) Browser disconnected event!');
                browserInstance = null;
                if (browserIdleTimer) clearTimeout(browserIdleTimer);
            });

            console.log('✅ (Card) Chrome launched successfully');
        } catch (error) {
            console.error('❌ (Card) Browser launch failed:', error.message);
            throw error;
        }
    })();

    try {
        await launchPromise;
    } finally {
        launchPromise = null;
    }

    // Keep it alive
    resetIdleTimer();
    return browserInstance;
}

/**
 * Get a new page from the browser
 */
export async function getPage() {
    resetIdleTimer();
    const browser = await getBrowser();
    return await browser.newPage();
}

/**
 * Generate Flex Card image from data
 * @param {Object} data - Card data
 * @returns {Promise<Buffer>} - PNG image buffer
 */
export async function generateFlexCard(data) {
    try {
        const browser = await getBrowser();
        const page = await browser.newPage();

        try {
            // Set viewport to card size
            await page.setViewport({
                width: 1080,
                height: 1080,
                deviceScaleFactor: 1
            });

            // Load and process template
            const templatePath = join(__dirname, '../Templates/flex-card.template.html');
            const marketTemplatePath = join(__dirname, '../Templates/market-card.template.html');

            if (!existsSync(templatePath)) {
                throw new Error(`Template not found at: ${templatePath}`);
            }

            let html = readFileSync(templatePath, 'utf-8');

            // Replace placeholders with actual data
            html = replacePlaceholders(html, data);

            // Set content
            await page.setContent(html, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            // Wait for fonts to load
            await page.evaluateHandle('document.fonts.ready');

            // Extra wait for rendering
            await new Promise(r => setTimeout(r, 1000));

            // Take screenshot
            const imageBuffer = await page.screenshot({
                type: 'png',
                clip: {
                    x: 0,
                    y: 0,
                    width: 1080,
                    height: 1080
                }
            });

            console.log('✅ Card generated successfully');
            return imageBuffer;
        } finally {
            await page.close();
        }
    } catch (error) {
        console.error('❌ Card generation error:', error.message);
        // Fallback to AI-generated image
        return await generateFallbackImage(data.username);
    }
}

/**
 * Fallback: Generate image using Pollinations.ai
 */
async function generateFallbackImage(username) {
    console.log('🔄 Using fallback AI image...');
    try {
        const prompt = `A premium futuristic digital billboard in a luxury airport terminal, minimalist modern design, the billboard displays "@${username}" in large glowing neon cyan letters, dark ambient lighting with blue and purple accent lights, 8k quality, photorealistic, cinematic`;

        // Use a more reliable endpoint or handle failure
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=768&model=flux&nologo=true`;

        const response = await fetch(imageUrl, { timeout: 10000 }); // Add timeout
        if (!response.ok) {
            console.warn(`⚠️ Fallback image API error: ${response.status}`);
            return null; // Return null instead of throwing to prevent flow crash
        }

        return Buffer.from(await response.arrayBuffer());
    } catch (e) {
        console.warn('⚠️ Fallback image generation failed:', e.message);
        return null;
    }
}

/**
 * Replace template placeholders with actual data
 */
function replacePlaceholders(html, data) {
    // Generate chart bars from price history
    const chartData = generateChartBars(data.priceHistory, data.lastSalePrice);

    const replacements = {
        '{{USERNAME}}': data.username || 'unknown',
        '{{TAGLINE}}': data.tagline || 'Premium digital identity',
        '{{STATUS_CLASS}}': getStatusClass(data.status),
        '{{STATUS_EMOJI}}': getStatusEmoji(data.status),
        '{{STATUS_TEXT}}': data.statusText?.replace(/[💰🔨✅❌✨🔒❓]/g, '').trim() || 'Unknown',
        '{{RARITY_STARS}}': data.rarity?.stars || '🌟🌟🌟',
        '{{RARITY_TIER}}': data.rarity?.tier || 'B-Tier',
        '{{RARITY_LABEL}}': data.rarity?.label || 'Rare',
        '{{EST_VALUE_TON}}': formatNumber(data.estValueTon) || '—',
        '{{EST_VALUE_USD}}': formatNumber(data.estValueUsd) || '—',
        '{{LAST_SALE_TON}}': data.lastSalePrice ? formatNumber(data.lastSalePrice) : '—',
        '{{LAST_SALE_DATE}}': data.lastSaleDate || 'N/A',
        '{{CURRENT_PRICE}}': formatNumber(data.currentPrice) || '—',
        '{{PRICE_TYPE}}': data.priceType || 'Estimated',
        '{{OWNER_WALLET}}': data.ownerWallet || 'Unknown',
        '{{CHART_BARS}}': chartData.barsHtml,
        '{{CHART_START_DATE}}': chartData.startDate,
        '{{CHART_END_DATE}}': chartData.endDate,
        '{{BOT_NAME}}': CONFIG.BOT_NAME || '@iFragmentBot'
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
        html = html.replace(new RegExp(placeholder, 'g'), value);
    }

    return html;
}

function getStatusClass(status) {
    switch (status) {
        case 'on_auction': return 'auction';
        case 'for_sale': return 'sale';
        case 'sold':
        case 'owned': return 'sold';
        default: return 'sold';
    }
}

function getStatusEmoji(status) {
    switch (status) {
        case 'on_auction': return '🔨';
        case 'for_sale': return '💰';
        case 'sold': return '✅';
        case 'owned': return '🔒';
        case 'available': return '✨';
        default: return '💎';
    }
}

function formatNumber(num) {
    if (!num && num !== 0) return null;
    return Math.floor(num).toLocaleString('en-US');
}

/**
 * Generate chart bars HTML from price history
 */
function generateChartBars(priceHistory, lastSalePrice) {
    const numBars = 8;
    let bars = [];

    // If we have real price history, use it
    if (priceHistory && Array.isArray(priceHistory) && priceHistory.length > 0) {
        const maxPrice = Math.max(...priceHistory.map(p => p.price));

        priceHistory.slice(-numBars).forEach((p, i, arr) => {
            const heightPercent = (p.price / maxPrice) * 100;
            const isLast = i === arr.length - 1;
            bars.push(`<div class="chart-bar${isLast ? ' highlight' : ''}" style="height: ${heightPercent}%"></div>`);
        });

        const startDate = priceHistory[0]?.date || '2024';
        const endDate = priceHistory[priceHistory.length - 1]?.date || 'Now';

        return {
            barsHtml: bars.join('\n'),
            startDate,
            endDate
        };
    }

    // Generate simulated trend based on last sale price
    const basePrice = lastSalePrice || 1000;
    const prices = [];

    for (let i = 0; i < numBars; i++) {
        const variance = 0.3 + Math.random() * 0.4; // 30-70% of max
        const isLast = i === numBars - 1;
        const heightPercent = isLast ? 100 : variance * 100;

        bars.push(`<div class="chart-bar${isLast ? ' highlight' : ''}" style="height: ${heightPercent}%"></div>`);
    }

    // Generate date labels (last 6 months)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const startMonth = months[(now.getMonth() - 6 + 12) % 12];
    const endMonth = months[now.getMonth()];

    return {
        barsHtml: bars.join('\n'),
        startDate: `${startMonth} 2024`,
        endDate: `${endMonth} 2024`
    };
}

export async function closeBrowser() {
    if (browserIdleTimer) clearTimeout(browserIdleTimer);
    if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
    }
}

/**
 * Generate News Card image
 * @param {Object} data - { image: base64, headline: string }
 * @returns {Promise<Buffer>}
 */
export async function generateNewsCard(data) {
    try {
        const browser = await getBrowser();
        const page = await browser.newPage();

        try {
            await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });

            const templatePath = join(__dirname, '../Templates/news-card.template.html');
            if (!existsSync(templatePath)) throw new Error(`Template not found: ${templatePath}`);

            let html = readFileSync(templatePath, 'utf-8');

            // Generate current date
            const now = new Date();
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const currentDate = `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

            // Replace placeholders - use regex with 'g' flag for global replacement
            html = html.replace(/{{IMAGE_DATA}}/g, data.image || '');
            html = html.replace(/{{HEADLINE}}/g, data.headline || 'Fragment News');
            html = html.replace(/{{DATE}}/g, currentDate);

            await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await new Promise(r => setTimeout(r, 1000)); // Render wait

            return await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1350 } });
        } finally {
            await page.close();
        }
    } catch (error) {
        console.error('❌ News Card Error:', error.message);
        throw error;
    }
}

/**
 * Generate News Card 2 - Full Image Edition (No Cropping)
 * @param {Object} data - { image: base64, headline: string }
 * @returns {Promise<Buffer>}
 */
export async function generateNewsCard2(data) {
    try {
        const browser = await getBrowser();
        const page = await browser.newPage();

        try {
            await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });

            const templatePath = join(__dirname, '../Templates/news-card-v2.template.html');
            if (!existsSync(templatePath)) throw new Error(`Template not found: ${templatePath}`);

            let html = readFileSync(templatePath, 'utf-8');

            // Generate current date
            const now = new Date();
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const currentDate = `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

            // Replace placeholders
            html = html.replace(/{{IMAGE_DATA}}/g, data.image || '');
            html = html.replace(/{{HEADLINE}}/g, data.headline || 'Fragment News');
            html = html.replace(/{{DATE}}/g, currentDate);

            await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await new Promise(r => setTimeout(r, 1000));

            return await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1350 } });
        } finally {
            await page.close();
        }
    } catch (error) {
        console.error('❌ News Card 2 Error:', error.message);
        throw error;
    }
}

export async function generateMarketCard(data) {
    try {
        const browser = await getBrowser();
        const page = await browser.newPage();
        try {
            await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });

            const templatePath = join(__dirname, '../Templates/market-card.template.html');
            if (!existsSync(templatePath)) throw new Error(`Template not found: ${templatePath}`);

            let html = readFileSync(templatePath, 'utf-8');

            // Generate Grid Items HTML
            let gridHtml = '';
            const gifts = data.gifts;

            // Helper for specific glows
            const getGlowClass = (name) => {
                const n = name.toLowerCase();
                if (n.includes('pepe')) return 'glow-pepe';
                if (n.includes('locket')) return 'glow-locket';
                if (n.includes('cap')) return 'glow-cap';
                if (n.includes('peach')) return 'glow-peach';
                if (n.includes('helmet')) return 'glow-helmet';
                if (n.includes('arm')) return 'glow-arm';
                return '';
            };

            if (gifts) {
                Object.values(gifts).forEach(gift => {
                    const glowClass = getGlowClass(gift.name);

                    // Handle null prices - show '---' if unavailable
                    const priceAvailable = gift.price != null && gift.price > 0;
                    const exactUsdPrice = gift.price * (data.tonPrice || 5.5);
                    const priceUsd = priceAvailable ? `$${exactUsdPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : '---';
                    const priceTon = priceAvailable ? gift.price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '---';

                    const tonLogoSvg = `<svg class="ton-icon-sm" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M28 56C43.464 56 56 43.464 56 28C56 12.536 43.464 0 28 0C12.536 0 0 12.536 0 28C0 43.464 12.536 56 28 56Z" fill="#0098EA"/>
                        <path d="M37.5603 15.6277H18.4386C14.9228 15.6277 12.6944 19.4202 14.4632 22.4861L26.2644 42.9409C27.0345 44.2765 28.9644 44.2765 29.7345 42.9409L41.5765 22.4861C43.3045 19.4202 41.0761 15.6277 37.5765 15.6277H37.5603ZM26.2483 36.8068L23.6119 31.8097L17.2017 20.6506C16.6742 19.7557 17.3255 18.6198 18.4223 18.6198H26.2483V36.8068ZM38.7972 20.6506L32.387 31.8259L29.7506 36.8068V18.6361H37.5765C38.6734 18.6361 39.3247 19.772 38.7972 20.6669V20.6506Z" fill="white"/>
                    </svg>`;

                    gridHtml += `
                    <div class="card">
                        <div class="card-glow-bg ${glowClass}"></div>
                        <div class="card-content">
                            <div class="price-container">
                                <div class="price-usd">${priceUsd}</div>
                                <div class="price-ton">
                                    ${tonLogoSvg}
                                    ${priceTon}
                                </div>
                            </div>

                            <div class="image-stage">
                                <img src="${gift.image || 'https://via.placeholder.com/200'}" class="gift-img">
                                <div class="gift-img-reflection"></div>
                            </div>

                            <div class="card-name">${gift.name}</div>
                        </div>
                    </div>
                    `;
                });
            }

            // Replace Placeholders
            html = html.replace('{{GIFT_ITEMS}}', gridHtml);
            html = html.replace('{{DATE}}', new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }));
            html = html.replace('{{TON_PRICE}}', (data.tonPrice || 5.5).toFixed(2));
            html = html.replace('{{888_PRICE}}', data.price888 ? data.price888.toLocaleString() : 'N/A');

            await page.setContent(html, { waitUntil: 'networkidle2', timeout: 60000 });

            // Wait for fonts/images to settle
            await new Promise(r => setTimeout(r, 2000));

            const buffer = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1350 } });
            console.log(`📸 Screenshot captured, size: ${buffer.length}`);
            return buffer;

        } finally {
            await page.close();
        }
    } catch (error) {
        console.error('❌ Market Card error:', error);
        throw error;
    }
}

export async function generateWalletCard(data) {
    try {
        const browser = await getBrowser();
        const page = await browser.newPage();
        try {
            await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });

            const templatePath = join(__dirname, '../Templates/wallet-card.template.html');
            if (!existsSync(templatePath)) {
                console.warn('⚠️ Wallet card template not found, skipping card generation');
                return null;
            }

            let html = readFileSync(templatePath, 'utf-8');

            // Rank emoji mapping
            const rankEmojiMap = {
                'Shrimp': '🦐', 'Fish': '🐟', 'Crab': '🦀',
                'Dolphin': '🐬', 'Shark': '🦈', 'Whale': '🐋', 'MEGA WHALE': '🐋'
            };
            const rankEmoji = rankEmojiMap[data.rank] || '🐟';

            // Calculate USD estimate
            const tonPrice = data.tonPrice || 1.5;
            const netWorthUsd = Math.round((data.netWorth || 0) * tonPrice).toLocaleString();

            const replacements = {
                '{{ADDRESS}}': data.address ? `${data.address.substring(0, 8)}...${data.address.slice(-6)}` : 'Unknown',
                '{{RANK}}': data.rank || 'Shrimp',
                '{{RANK_EMOJI}}': rankEmoji,
                '{{NET_WORTH}}': data.netWorth ? Math.round(data.netWorth).toLocaleString() : '0',
                '{{NET_WORTH_USD}}': netWorthUsd,
                '{{USERNAMES}}': String(data.usernameCount || '0'),
                '{{NUMBERS}}': String(data.numberCount || '0'),
                '{{GIFTS}}': String(data.giftCount || '0'),
                '{{BALANCE}}': data.balance ? Number(data.balance).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0',
                '{{LAST_ACTIVITY}}': data.lastActivity || 'N/A',
                '{{STATUS}}': data.status || 'ACTIVE'
            };

            for (const [key, val] of Object.entries(replacements)) {
                html = html.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(val));
            }

            await page.setContent(html, { waitUntil: 'networkidle2', timeout: 60000 });
            await new Promise(r => setTimeout(r, 1500));

            return await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1080 } });
        } finally {
            await page.close();
        }
    } catch (error) {
        console.error('❌ Wallet Card error:', error.message);
        return null; // Return null instead of throwing — allows text-only fallback
    }
}

export default {
    getBrowser,
    getPage,
    generateFlexCard,
    generateNewsCard,
    generateNewsCard2,
    generateMarketCard,
    generateWalletCard,
    closeBrowser
};
