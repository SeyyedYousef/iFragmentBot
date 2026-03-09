
import fetch from 'node-fetch';
import fs from 'fs';

async function testFetchAndDump() {
    const url = 'https://fragment.com/username/vp';
    console.log(`Fetching ${url}...`);
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const html = await response.text();
        fs.writeFileSync('fragment_dump.html', html);
        console.log('Dumped HTML to fragment_dump.html');

        // Search for JSON patterns
        // Often data is in <script>window.pageData = {...}</script> or similar.
        const matches = html.match(/<script[^>]*>.*?<\/script>/gs);
        if (matches) {
            console.log(`Found ${matches.length} script tags.`);
            /* matches.forEach((m, i) => {
                 if (m.length < 500) console.log(`Script ${i}:`, m.substring(0, 100));
             });*/
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

testFetchAndDump();
