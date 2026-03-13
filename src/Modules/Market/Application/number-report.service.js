/**
 * Number Report Service
 * +888 Anonymous Numbers (Collectible Numbers) valuation and report generation
 */

import fetch from 'node-fetch';
import * as marketService from './market.service.js';
import { tonPriceCache } from '../../../Shared/Infra/Cache/cache.service.js';
import { getBrowser } from '../../../Shared/UI/Components/card-generator.component.js';

// Format number with commas
function formatNumber(n) {
    if (!Number.isFinite(n)) return '—';
    return Math.round(n).toLocaleString('en-US');
}

// Safe number parse
function safeNum(v, fallback = 0) {
    const n = parseFloat(String(v).replace(/,/g, ''));
    return Number.isFinite(n) ? n : fallback;
}

/**
 * Parse number link to extract +888 number
 * Supports: fragment.com/number/8881234567890, +8881234567890, 8881234567890
 */
export function parseNumberLink(input) {
    const raw = String(input).trim();
    if (!raw) return { isValid: false };

    // fragment.com/number/888XXXXXXXXXX
    const fragmentMatch = raw.match(/(?:fragment\.com\/number\/|t\.me\/number\/)(\d+)/i);
    if (fragmentMatch) {
        const num = fragmentMatch[1];
        // Valid anonymous numbers observed on Fragment include very short forms like 8888827 (7 digits total)
        // up to the common longer forms (11-13 digits total excluding '+')
        if (num.startsWith('888') && num.length >= 7 && num.length <= 13) {
            return {
                number: `+${num}`,
                numberClean: num,
                isValid: true
            };
        }
    }

    // Raw: +8881234567890 or 8881234567890
    const clean = raw.replace(/[\s\-\+]/g, '');
    // Allow short 7-digit total: 888 + 4 digits
    if (/^888\d{4,10}$/.test(clean)) {
        return {
            number: `+${clean}`,
            numberClean: clean,
            isValid: true
        };
    }

    return { isValid: false };
}

/**
 * Format number for display: +888 1 234 567 890
 */
export function formatDisplayNumber(number) {
    if (!number) return '—';
    const clean = String(number).replace(/\D/g, '');
    if (clean.startsWith('888') && clean.length >= 7) {
        const rest = clean.slice(3);
        if (rest.length <= 10) {
            // For very short numbers (e.g. 4 digits after 888) keep readability
            if (rest.length <= 4) return `+888 ${rest}`;
            const chunks = rest.match(/.{1,3}/g) || [rest];
            return `+888 ${chunks.join(' ')}`;
        }
    }
    return number;
}

/**
 * Analyze number pattern for value bonus
 */
function analyzeNumberPattern(numberClean) {
    const digits = numberClean.replace(/\D/g, '');
    const tail = digits.slice(3); // After 888
    // Ultra-short numbers (888 + 4 digits) are extremely scarce in practice and command massive premiums.
    // Treat them as a dedicated tier.
    if (tail && tail.length <= 4) {
        const d = tail.split('').map(Number);
        const uniqueCount = new Set(d).size;
        const lucky = (tail.match(/[78]/g) || []).length;
        const bonus = 220 + (uniqueCount <= 2 ? 80 : 0) + (lucky >= 2 ? 30 : 0);
        return { type: 'UltraShort', bonus, label: `Ultra-Short (${tail.length} digits)`, score: 99, uniqueCount };
    }

    if (!tail || tail.length < 7) return { type: 'Standard', bonus: 0, label: 'Standard', score: 40, uniqueCount: 10 };

    const d = tail.split('').map(Number);
    const uniqueCount = new Set(d).size;

    // Repdigit: 777, 8888, 111111
    const uniq = [...new Set(d)];
    if (uniq.length === 1 && d.length >= 3) {
        const mult = d.length >= 6 ? 2.5 : d.length >= 4 ? 1.8 : 1.3;
        return { type: 'Repdigit', bonus: (mult - 1) * 100, label: `Repdigit (${d[0]}×${d.length})`, score: 95, uniqueCount };
    }

    // Sequence: 1234, 8765
    let isSeq = true;
    for (let i = 1; i < d.length; i++) {
        if (d[i] !== d[i - 1] + 1 && d[i] !== d[i - 1] - 1) {
            isSeq = false;
            break;
        }
    }
    if (isSeq && d.length >= 4) return { type: 'Sequence', bonus: 50, label: 'Sequence', score: 80, uniqueCount };

    // Lucky digits: many 7s or 8s
    const lucky7 = (tail.match(/7/g) || []).length;
    const lucky8 = (tail.match(/8/g) || []).length;
    const luckyCount = lucky7 + lucky8;
    if (luckyCount >= 3) return { type: 'Lucky', bonus: 25 + luckyCount * 5, label: `Lucky (${lucky7}×7 ${lucky8}×8)`, score: 65 + Math.min(25, luckyCount * 3), uniqueCount };

    // Round: 100, 1000, 500
    const n = parseInt(tail, 10);
    if (n === 100 || n === 1000 || n === 500 || n % 1000 === 0) return { type: 'Round', bonus: 40, label: 'Round number', score: 70, uniqueCount };

    if (uniqueCount <= 3) return { type: 'Premium', bonus: 30, label: `Low-Unique (${uniqueCount} digits)`, score: 72, uniqueCount };

    return { type: 'Standard', bonus: 0, label: 'Standard', score: 45, uniqueCount };
}

/**
 * HTTP scrape Fragment number page
 */
async function scrapeFragmentNumber(numberClean) {
    const url = `https://fragment.com/number/${numberClean}`;
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            timeout: 15000
        });

        if (response.status === 404) {
            return { status: 'not_found', priceTon: null, bidHistory: [] };
        }

        const html = await response.text();

        let status = 'unknown';
        const statusMatch = html.match(/tm-section-header-status[^>]*>\s*([^<]+)\s*</i);
        if (statusMatch) {
            const s = statusMatch[1].trim().toLowerCase();
            if (s.includes('sold')) status = 'sold';
            else if (s.includes('auction')) status = 'on_auction';
            else if (s.includes('sale')) status = 'for_sale';
            else if (s.includes('available')) status = 'available';
        } else {
            if (/sold/i.test(html)) status = 'sold';
            else if (/auction/i.test(html)) status = 'on_auction';
            else if (/for sale|sale/i.test(html)) status = 'for_sale';
            else if (/available/i.test(html)) status = 'available';
        }

        const priceMatches = [...html.matchAll(/icon-ton">([\d,]+(?:\.\d+)?)<\/div>/g)];
        const prices = priceMatches.map(m => safeNum(m[1], null)).filter(p => Number.isFinite(p) && p > 0);
        let priceTon = null;
        if (prices.length > 0) priceTon = prices[0];

        const highestBid = (status === 'on_auction' && prices.length >= 1) ? prices[0] : null;
        const minBid = (status === 'on_auction' && prices.length >= 3) ? prices[2] : null;

        return { status, priceTon, highestBid, minBid, url };
    } catch (e) {
        console.warn('⚠️ Fragment number scrape failed:', e.message);
        return { status: 'unknown', priceTon: null, highestBid: null, minBid: null, url: `https://fragment.com/number/${numberClean}` };
    }
}

async function scrapeMarketSampleNumbers({ limit = 60 } = {}) {
    const browser = await getBrowser();
    let page = null;
    try {
        page = await browser.newPage();
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
            else req.continue();
        });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

        await page.goto('https://fragment.com/numbers?sort=price_asc&filter=sale', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        await page.waitForSelector('table, .table', { timeout: 10000 }).catch(() => { });

        const items = await page.evaluate(() => {
            const out = [];
            const parseTon = (s) => {
                if (!s) return null;
                const m = String(s).match(/([\d,\.]+)\s*TON/i);
                if (!m) return null;
                const n = parseFloat(m[1].replace(/,/g, ''));
                return Number.isFinite(n) ? n : null;
            };
            const rows = document.querySelectorAll('table tr');
            for (const r of rows) {
                const txt = r.innerText || '';
                // Support both short and long anonymous numbers (e.g. 8888827 and 88802020288)
                const nMatch = txt.match(/\b888\d{4,10}\b/);
                const p = parseTon(txt);
                if (nMatch && p && p > 0) out.push({ numberClean: nMatch[0], price: p });
                if (out.length >= 120) break;
            }
            return out;
        });

        const unique = [];
        const seen = new Set();
        for (const it of items) {
            if (!seen.has(it.numberClean)) {
                seen.add(it.numberClean);
                unique.push(it);
            }
            if (unique.length >= limit) break;
        }
        return unique;
    } catch (e) {
        console.warn('⚠️ Market sample scrape failed:', e.message);
        return [];
    } finally {
        if (page) {
            try { await page.close(); } catch { }
        }
    }
}

function median(values) {
    const v = values.filter(x => Number.isFinite(x)).slice().sort((a, b) => a - b);
    if (!v.length) return null;
    const mid = Math.floor(v.length / 2);
    return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function estimateWithModel({ floor, marketSample, scraped, pattern, numberClean }) {
    const marketPrices = marketSample.map(x => x.price).filter(p => Number.isFinite(p) && p > 0);
    const marketMedian = median(marketPrices);

    const targetTail = numberClean.slice(3);
    const targetLucky = (targetTail.match(/[78]/g) || []).length;
    const targetUniq = pattern.uniqueCount ?? new Set(targetTail.split('')).size;

    const scored = marketSample.map(it => {
        const tail = it.numberClean.slice(3);
        const lucky = (tail.match(/[78]/g) || []).length;
        const uniq = new Set(tail.split('')).size;
        const dist = Math.abs(lucky - targetLucky) * 2 + Math.abs(uniq - targetUniq) * 1.5;
        return { ...it, dist };
    }).sort((a, b) => a.dist - b.dist);

    const k = scored.slice(0, 12);
    const compMedian = median(k.map(x => x.price));

    const patternMultiplier = 1 + ((pattern.bonus || 0) / 100);
    const base = Math.max(floor, compMedian || marketMedian || floor);

    const anchors = [];
    const weights = [];

    anchors.push(floor); weights.push(1.0);
    if (marketMedian) { anchors.push(marketMedian); weights.push(1.2); }
    if (compMedian) { anchors.push(compMedian); weights.push(1.6); }
    anchors.push(base * patternMultiplier); weights.push(1.4);

    if (scraped.status === 'for_sale' && Number.isFinite(scraped.priceTon)) {
        const clampBase = compMedian || marketMedian || floor;
        anchors.push(clamp(scraped.priceTon, clampBase * 0.6, clampBase * 3.5));
        weights.push(2.2);
    }
    if (scraped.status === 'on_auction') {
        if (Number.isFinite(scraped.highestBid)) { anchors.push(scraped.highestBid); weights.push(2.0); }
        if (Number.isFinite(scraped.minBid)) { anchors.push(scraped.minBid); weights.push(1.4); }
    }

    const expanded = [];
    for (let i = 0; i < anchors.length; i++) {
        const w = Math.round(weights[i] * 10);
        for (let j = 0; j < w; j++) expanded.push(anchors[i]);
    }
    const est = median(expanded) || base * patternMultiplier;

    let confidence = 35;
    if (marketMedian) confidence += 15;
    if (compMedian) confidence += 20;
    if (scraped.status === 'for_sale' && scraped.priceTon) confidence += 20;
    if (scraped.status === 'on_auction' && (scraped.highestBid || scraped.minBid)) confidence += 15;
    confidence = clamp(confidence, 20, 90);

    const compSpread = compMedian && k.length >= 6
        ? clamp((Math.max(...k.map(x => x.price)) - Math.min(...k.map(x => x.price))) / compMedian, 0.15, 0.55)
        : 0.35;
    const rangePct = clamp(0.22 + (1 - confidence / 100) * 0.25 + compSpread * 0.15, 0.22, 0.45);

    return { est: Math.round(est), marketMedian, compMedian, confidence, rangePct };
}

/**
 * Generate full number report
 */
export async function generateNumberReport(input, tonPrice = 5.5) {
    const parsed = parseNumberLink(input);
    if (!parsed.isValid) {
        throw new Error('Invalid number format. Use: https://fragment.com/number/8881234567890 or +8881234567890');
    }

    const { number, numberClean } = parsed;
    const formattedNumber = formatDisplayNumber(number);

    // Fetch floor from cache or market service
    let floor = tonPriceCache.get('floor888')?.price;
    if (!floor || floor <= 0) {
        floor = await marketService.get888Stats();
        if (floor) tonPriceCache.set('floor888', { price: floor, timestamp: Date.now() });
    }
    if (!floor || floor <= 0) floor = 850;

    // Scrape Fragment for this number
    const scraped = await scrapeFragmentNumber(numberClean);
    let status = scraped.status;
    let priceTon = scraped.priceTon;

    // Pattern analysis
    const pattern = analyzeNumberPattern(numberClean);

    // Market sample for robust estimation
    const marketSample = await scrapeMarketSampleNumbers({ limit: 60 });
    const model = estimateWithModel({ floor, marketSample, scraped, pattern, numberClean });

    const estimated = model.est;
    const rangePct = model.rangePct;
    const lowEst = Math.round(estimated * (1 - rangePct));
    const highEst = Math.round(estimated * (1 + rangePct));

    const vsFloor = floor > 0 ? ((estimated / floor) - 1) * 100 : 0;
    const gapVsMarket = (model.marketMedian && model.marketMedian > 0) ? ((estimated / model.marketMedian) - 1) * 100 : null;

    const url = `https://fragment.com/number/${numberClean}`;

    let statusDisplay = '❓ Unknown';
    if (status === 'for_sale') statusDisplay = '💰 FOR SALE';
    else if (status === 'on_auction') statusDisplay = '🔨 ON AUCTION';
    else if (status === 'sold') statusDisplay = '✅ SOLD';
    else if (status === 'available') statusDisplay = '✨ Available';
    else if (status === 'not_found') statusDisplay = '❌ Not Found';

    // Check registration (optional - may fail if no MTProto)
    let registeredText = '⏳ Unknown';
    try {
        const { checkPhoneNumber } = await import('../../Shared/Infra/Telegram/telegram.client.js');
        const reg = await checkPhoneNumber(number);
        registeredText = reg.registered ? '✅ Yes' : '❌ No';
    } catch {
        registeredText = '⏳ N/A';
    }

    const tonUsd = tonPrice || tonPriceCache.get('price') || 5.5;
    const estUsd = Math.round(estimated * tonUsd);

    // Build report (without RESOURCES & LINKS section)
    let report = '';
    report += `📱 *${formattedNumber}*\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    report += `🔵 ${statusDisplay}`;
    if (priceTon) report += `  •  Price: *${formatNumber(priceTon)} TON*`;
    report += `\n`;
    report += `🔗 [Fragment](${url})\n\n`;

    report += `――――― 💎 *VALUE ESTIMATE* ―――――\n`;
    report += `▸ 🏷️  Fair Value: *~${formatNumber(estimated)} TON*\n`;
    report += `▸ 💵  ~$${formatNumber(estUsd)}\n`;
    report += `▸ 📐 Range: ${formatNumber(lowEst)} — ${formatNumber(highEst)} TON (±${Math.round(rangePct * 100)}%)\n`;
    report += `▸ 📊 vs Floor (+888): *${vsFloor >= 0 ? '+' : ''}${vsFloor.toFixed(0)}%*\n`;
    if (Number.isFinite(gapVsMarket)) report += `▸ 📊 Gap vs Market Median: *${gapVsMarket >= 0 ? '+' : ''}${gapVsMarket.toFixed(0)}%*\n`;
    report += `▸ 📱 Registered: ${registeredText}\n\n`;

    report += `――――― 📈 *MARKET CONTEXT* ―――――\n`;
    report += `▸ 🏛️ Collection: Anonymous Telegram Numbers (+888)\n`;
    report += `▸ 💰 Floor: *${formatNumber(floor)} TON*\n`;
    if (model.marketMedian) report += `▸ 📊 Market Median (sample): *${formatNumber(Math.round(model.marketMedian))} TON*\n`;
    if (model.compMedian) report += `▸ 🧩 Comparable Median: *${formatNumber(Math.round(model.compMedian))} TON*\n`;
    report += `▸ 📊 Confidence: *${model.confidence >= 70 ? 'High' : model.confidence >= 50 ? 'Medium' : 'Low'}* (${model.confidence}%)\n`;
    report += `▸ 📊 Total Supply: 136,566 (Sold Out Dec 2022)\n`;
    report += `▸ 🔥 Record Sale: +888 8 888 888 @ 300,000 TON\n\n`;

    report += `――――― 🎰 *NUMBER PATTERN* ―――――\n`;
    report += `▸ Type: *${pattern.label}*\n`;
    if (pattern.bonus > 0) report += `▸ Bonus: +${pattern.bonus}%\n`;
    if (Number.isFinite(pattern.score)) report += `▸ Pattern Score: *${pattern.score}/100*\n`;
    report += `\n`;

    report += `――――― 🧠 *EXPERT NOTE* ―――――\n`;
    if (pattern.type === 'Standard') {
        report += `Standard 10-digit pattern. Value aligned with floor. Consider vanity/lucky digits for premium upside.\n`;
    } else {
        report += `${pattern.label} pattern adds value. Strong demand from collectors.\n`;
    }

    report += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `⚡ _Intelligence by @iFragmentBot_  •  TON: $${tonUsd.toFixed(2)}\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    return {
        report,
        number,
        formattedNumber,
        numberClean,
        priceTon: priceTon || estimated,
        estimatedValue: estimated,
        floor,
        status,
        pattern: pattern.type,
        verdict: pattern.type === 'Standard' ? 'STANDARD' : pattern.type === 'Repdigit' ? 'GRAIL' : pattern.type === 'Lucky' ? 'LUCKY' : 'PREMIUM',
        vsFloor,
        registeredText,
        url
    };
}
