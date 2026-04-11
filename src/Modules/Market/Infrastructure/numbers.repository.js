/**
 * Numbers Repository
 * Handles direct API interaction for +888 Anonymous Numbers
 */

import { fragmentApiClient } from "./fragment-api.client.js";

export async function getNumberExtraData(number) {
    try {
        console.log(`📡 [NUM-REPO] Fetching API info for +${number}...`);
        const result = await fragmentApiClient.searchAuctions(number, "ending", "numbers", "auction");
        
        if (result && result.html) {
            // We can even use the scanner logic here if we wanted to parse the HTML returned by search
            // But for now, we returning standard metadata to keep it stable
            return {
                ownerLabel: "Standard Holder",
                otherNumbersCount: 0,
                isWhale: false,
                apiData: result
            };
        }
        
        return {
            ownerLabel: "Standard Holder",
            otherNumbersCount: 0,
            isWhale: false
        };
    } catch (error) {
        console.error("❌ [NUM-REPO] API Error:", error.message);
        return {
            ownerLabel: "Standard Holder",
            otherNumbersCount: 0
        };
    }
}

export async function getNumberHistory(number) {
    // Logic to fetch number history via API
    return [];
}
