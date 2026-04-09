import { scrapeNumbers, scrapeNumberDetails } from "./src/Modules/Numbers/Infrastructure/numbers.repository.js";

async function runTest() {
    console.log("🚀 Testing Numbers Module...");
    
    // Test list scraping
    const numbers = await scrapeNumbers("", "auction", "price");
    console.log(`✅ Found ${numbers.length} numbers on auction.`);
    if (numbers.length > 0) {
        console.log("First number found:", numbers[0]);
        
        // Test detail scraping for the first number
        const details = await scrapeNumberDetails(numbers[0].numeric);
        console.log("Details for the first number:", details);
    }
}

runTest().catch(console.error);
