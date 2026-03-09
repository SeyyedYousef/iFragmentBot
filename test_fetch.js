
import fetch from 'node-fetch';
import fs from 'fs';

async function testFetch(username) {
    const url = `https://fragment.com/username/${username}`;
    console.log(`Fetching ${url}...`);
    try {
        const response = await fetch(url, {
            headers: {
                //'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            // redirect: 'follow'
        });
        const html = await response.text();
        fs.writeFileSync('fragment_vpppp.html', html);
        console.log('Dumped to fragment_vpppp.html');

        // Check for specific data
        const statusMatch = html.match(/tm-section-header-status[^>]*>([^<]+)/);
        console.log('Status Match:', statusMatch ? statusMatch[1].trim() : 'Not found');

        // More lenient regex for price
        const priceMatch = html.match(/([\d,]+(?:\.\d+)?)\s*TON/i);
        console.log('Price Match:', priceMatch ? priceMatch[1] : 'Not found');

        // Owner regex
        const ownerMatch = html.match(/Owned by\s+<a[^>]*>(@?[a-zA-Z0-9_]+)<\/a>/i);
        console.log('Owner Match:', ownerMatch ? ownerMatch[1] : 'Not found');

    } catch (error) {
        console.error('Error:', error);
    }
}

testFetch('vpppp'); 
