import fetch from "node-fetch";
import { fragmentLimiter } from "../../../Shared/Infra/Network/rate-limiter.service.js";

const FRAGMENT_HEADERS = {
	"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
	Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
	"Accept-Language": "en-US,en;q=0.5",
};

/**
 * Scrape Anonymous Numbers from Fragment
 * @param {string} query - Optional search query
 * @param {string} filter - 'auction', 'sold', or 'sale'
 * @param {string} sort - 'price', 'price_desc', 'price_asc', 'listed', 'ending'
 */
export async function scrapeNumbers(query = "", filter = "auction", sort = "price") {
	return fragmentLimiter.schedule(async () => {
		const url = `https://fragment.com/numbers?sort=${sort}&filter=${filter}&query=${query}`;
		console.log(`🔍 [NUMBERS] Scraping: ${url}`);

		try {
			const response = await fetch(url, {
				headers: FRAGMENT_HEADERS,
				timeout: 15000,
			});

			if (!response.ok) {
				throw new Error(`HTTP Error ${response.status}`);
			}

			const html = await response.text();
			return parseNumbersListHtml(html);
		} catch (error) {
			console.error("❌ Numbers Scrape Error:", error.message);
			return [];
		}
	});
}

/**
 * Scrape a specific number's details
 * @param {string} number - The +888 number (e.g. 88801234567)
 */
export async function scrapeNumberDetails(number) {
    const cleanNumber = number.replace(/\D/g, "");
    const url = `https://fragment.com/number/${cleanNumber}`;
    
    return fragmentLimiter.schedule(async () => {
        try {
            const response = await fetch(url, {
                headers: FRAGMENT_HEADERS,
                timeout: 15000,
            });
            
            if (response.status === 404) return null;
            
            const html = await response.text();
            return parseNumberDetailHtml(cleanNumber, html);
        } catch (error) {
            console.error(`❌ Number Detail Scrape Error (+${cleanNumber}):`, error.message);
            return null;
        }
    });
}

/**
 * Internal parser for numbers list
 */
function parseNumbersListHtml(html) {
	const numbers = [];
	// Regex matches to find number cards in HTML
	const cardRegex = /<tr class="tm-row-selectable">([\s\S]*?)<\/tr>/g;
	let match;

	while ((match = cardRegex.exec(html)) !== null) {
		const content = match[1];
		
		const numberMatch = content.match(/<div class="tm-value">(\+888 [\d ]+)<\/div>/);
		const priceMatch = content.match(/icon-ton">([\d,.]+)<\/div>/);
		const linkMatch = content.match(/href="\/number\/(\d+)"/);
		const statusMatch = content.match(/tm-status-(?:auction|timer)">([\s\S]*?)<\/div>/);

		if (numberMatch && priceMatch) {
			numbers.push({
				number: numberMatch[1].trim(),
				numeric: linkMatch ? linkMatch[1] : "",
				priceTon: parseFloat(priceMatch[1].replace(/,/g, "")),
				status: statusMatch ? statusMatch[1].replace(/<[^>]+>/g, "").trim() : "unknown",
				url: linkMatch ? `https://fragment.com/number/${linkMatch[1]}` : null,
			});
		}
	}

	return numbers;
}

/**
 * Internal parser for a specific number's detail page
 */
function parseNumberDetailHtml(number, html) {
    const result = {
        number: `+${number}`,
        status: "unknown",
        priceTon: null,
        ownerWallet: null,
        history: []
    };

    // Extract status
    const statusMatch = html.match(/class="tm-section-header-status[^>]*>([^<]+)</i);
    if (statusMatch) result.status = statusMatch[1].trim().toLowerCase();

    // Extract price
    const priceMatch = html.match(/icon-ton">([\d,.]+)<\/div>/i);
    if (priceMatch) result.priceTon = parseFloat(priceMatch[1].replace(/,/g, ""));

    // Extract wallet
    const walletMatch = html.match(/href="https:\/\/tonviewer\.com\/(EQ[A-Za-z0-9_-]+|UQ[A-Za-z0-9_-]+)"/);
    if (walletMatch) result.ownerWallet = walletMatch[1];

    return result;
}
