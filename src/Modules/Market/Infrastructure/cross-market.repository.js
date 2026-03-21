import { scrapeFragment } from "../../../Shared/Infra/Scraping/scrapling.service.js";

/**
 * Advanced Cross-Market Intelligence Engine (March 2026)
 * Aggregates floor price, volume, and last sale from secondary TON marketplaces.
 */
export async function getCrossMarketData(collectionSlug) {
    const result = {
        portals: { floor: "N/A", volume: "N/A", lastSale: "N/A" },
        tonnel: { floor: "N/A", volume: "N/A", lastSale: "N/A" }
    };
    
    try {
        console.log(`🌐 [CrossMarket API] Fetching Portals & Tonnel for: ${collectionSlug}`);
        const [portalsHTML, tonnelHTML] = await Promise.allSettled([
            fetchPortals(collectionSlug),
            fetchTonnel(collectionSlug)
        ]);
        
        if (portalsHTML.status === "fulfilled" && portalsHTML.value) {
            result.portals = parsePortals(portalsHTML.value);
        }
        
        if (tonnelHTML.status === "fulfilled" && tonnelHTML.value) {
            result.tonnel = parseTonnel(tonnelHTML.value);
        }
        
    } catch (error) {
        console.error("❌ Cross-Market Aggregation Failed: ", error.message);
    }
    
    return result;
}

/**
 * Fetch Portals.tg Market Data via Scrapling bypass engine
 */
async function fetchPortals(slug) {
    // Attempting Portals Web3 interface or direct API fallback
    const url = `https://portals.tg/market/collection/${slug}`;
    try {
        const payload = await scrapeFragment(url, { wait: 5000, type: "custom" });
        return payload?.html || "";
    } catch (e) {
        console.warn(`⚠️ Portals Fetch Failed for ${slug}: ${e.message}`);
        return "";
    }
}

/**
 * Fetch Tonnel Market Data via Scrapling bypass engine
 */
async function fetchTonnel(slug) {
    // Tonnel relies heavily on client-side JS and DDOS protection
    const url = `https://market.tonnel.network/collection/${slug}`;
    try {
        const payload = await scrapeFragment(url, { wait: 5000, type: "custom" });
        return payload?.html || "";
    } catch (e) {
        console.warn(`⚠️ Tonnel Fetch Failed for ${slug}: ${e.message}`);
        return "";
    }
}

/**
 * Parsing Logic using Heuristic Regex for dynamically generated DOMs
 */
function parsePortals(html) {
    const data = { floor: "N/A", volume: "N/A", lastSale: "N/A" };
    
    try {
        // Strip out HTML tags to make parsing easier
        const text = html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ');
        
        // Match generic floor price pattern: Floor Price 15.5
        const floorMatch = text.match(/Floor(?:Price)?\s*([0-9.,]+)/i);
        if (floorMatch) data.floor = floorMatch[1].replace(',', '');
        
        // Match generic volume pattern: Volume 1.5K
        const volMatch = text.match(/Volume\s*([0-9.,]+[KMB]?)/i);
        if (volMatch) data.volume = volMatch[1];
        
        // Match last sale
        const lastSaleMatch = text.match(/Last\s*Sale\s*([0-9.,]+)/i);
        if (lastSaleMatch) data.lastSale = lastSaleMatch[1].replace(',', '');
        
    } catch (e) { }
    
    return data;
}

function parseTonnel(html) {
    const data = { floor: "N/A", volume: "N/A", lastSale: "N/A" };
    
    try {
        // Strip out HTML tags to make parsing easier
        const text = html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ');
        
        const floorMatch = text.match(/Floor\s*([0-9.,]+)/i);
        if (floorMatch) data.floor = floorMatch[1].replace(',', '');
        
        const volMatch = text.match(/Volume\s*([0-9.,]+[KMB]?)/i);
        if (volMatch) data.volume = volMatch[1];
        
        const lastSaleMatch = text.match(/Price\s*([0-9.,]+)\s*(?:TON|ago)/i);
        if (lastSaleMatch) data.lastSale = lastSaleMatch[1].replace(',', '');
        
    } catch (e) { }
    
    return data;
}
