/**
 * Portfolio Service - Ultra-Fast TonAPI Integration
 * Fetches Fragment assets (usernames + anonymous numbers) using TonAPI.io REST API
 * Speed: < 1 second (compared to 30-60 seconds with Puppeteer/browser scraping)
 */
import fetch from 'node-fetch';

// Official Fragment NFT Collection addresses - FULL bounceable address format
// Only these are the REAL official Fragment collections
const FRAGMENT_COLLECTIONS = {
    // Official Telegram Usernames collection address (bounceable format)
    // Source: https://tonviewer.com/EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi
    USERNAMES: 'EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi',
    // Official Anonymous Telegram Numbers collection (+888)
    // Source: https://tonviewer.com/EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N
    ANONYMOUS_NUMBERS: 'EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N'
};

// Known username collection names (for fallback verification)
const USERNAME_COLLECTION_NAMES = [
    'telegram usernames',
    'telegram username'
];

// Known anonymous number collection names (for fallback verification)  
const ANON_NUMBER_COLLECTION_NAMES = [
    'anonymous telegram numbers',
    'anonymous telegram number'
];

// Official Telegram Gift NFT Collections (from GetGems)
// These are the ONLY valid gift collections - any other NFT is NOT a Telegram Gift
const TELEGRAM_GIFT_COLLECTIONS = {
    // Collection Name -> Collection Address (from GetGems URLs)
    // NOTE: Keys updated to match TonAPI output (often Plural)
    'Plush Pepes': 'EQBG-g6ahkAUGWpefWbx-D_9sQ8oWbvy6puuq78U2c4NUDFS',
    'Heart Lockets': 'EQC4XEulxb05Le5gF6esMtDWT5XZ6tlzlMBQGNsqffxpdC5U',
    "Durov's Caps": 'EQD9ikZq6xPgKjzmdBG0G0S80RvUJjbwgHrPZXDKc_wsE84w',
    'Precious Peaches': 'EQA4i58iuS9DUYRtUZ97sZo5mnkbiYUBpWXQOe3dEUCcP1W8',
    'Heroic Helmets': 'EQAlROpjm1k1mW30r61qRx3lYHsZkTKXVSiaHEIhOlnYA4oy',
    'Mighty Arms': 'EQDeX0F1GDugNjtxkFRihu9ZyFFumBv2jYF5Al1thx2ADDQs',
    // Add more collections here as Telegram releases them
    'Spooky Skulls': 'EQCsGpSn0vXcwAZXXWdxITrYPzyWvnQJhz_v-Eud3xnhxoK7',
    'Jelly Bunnies': 'EQChvgbYZwKdz76g4k8FwpxMdTPBh2GdFFyMQCmCaRBsL77T',
    'Electric Skulls': 'EQATqJRzLJy5FwgmxlLGDqNzxV-08LQlpC3PPMEEy2bTnLOy',
    'Astral Shards': 'EQBvxPabeEdbqpLJnmTgVFI_1hkjnM5-KpIwJqlQxGlh8sZQ',
    'Sakura Petals': 'EQDz0k-xCCvZBQq8GiS7g0T_0HPXK3WnW_lrJZpJKq2oNNJY',
    'Mad Pumpkins': 'EQBz_g5IvH7IEcuFw-hVJpVNvxQr_Cx8JjsMqOx0m_rmj4L3',
    'Witch Hats': 'EQCGBOcbQ_0T33wWPW9x_s8YBUxpxQnBsJwXqKJSs4aIy1qe',
    'Signet Rings': 'EQAPBo7h15bD7FWsr4HfB7qCKhYAaYH1yVLr_RZr2uFy0_cV',
    'Vintage Cigars': 'EQAk6x9r9WZwi-7obECIqMlb2R0sCXzpnr85P0TKV5mqFdPv',
    'Eternal Roses': 'EQA9HfhJlNV8qnZkaPUNyqpGm38q4P6GkjKqGsFPvfS7nI1a',
    'Lucky Cats': 'EQDwTXV0g4b8MXaAmTBPHljqJJA0r5pAqdxRjwwdlq_nxUZT',
    'Homunculus Lulus': 'EQD7qKKpjz9LDLmFf-fqODjrg8m7lxqUHCJPW5D4P-v3YB1f',
    'Ion Gems': 'EQA7Bk0svO5AhkHjMRc2FbhGm7X3P2XhHxwfM8Mm1CrSjZ1J',
    'Star Potions': 'EQBj6LG8f7zSxvLt8c6V-3N8YFbb-2H0MxM5nJlEYL1FZJkU',
    'Kissed Frogs': 'EQC3QLCAl7G3SQhU7WYVxKKbLJ9KsZxAFB6hPIKAl0Ww0X6i',
    'Skull Flowers': 'EQBrCMB23qMJYR21j4g7FHMJHDLmqR9bAqE1JFAY8IpglLDw',
    'Berry Boxes': 'EQA5rNpnF6LkUsjD9T3EFR0vHRwW0Rn9lzFJD1K6Xlf2E_Jj',
    'Crystal Balls': 'EQDWJuD6XN-qUPwqMm6qN-CzMrWFbCB0nCrJA3TH1h-LO4H8',
    'Genie Lamps': 'EQDv6R_0fq5XfFFPqV3_ZMNiGTBUDNJWnXQu7l1eH5d8nBVX',
    'Love Candles': 'EQAv8HWHY-HcV0F_-vZs8dxB0r2VhDV8GwigqfRGP7SCB7rQ',
    'B-Day Candles': 'EQB0_vbJnDQUX5gDK_XVqKF6G_Aas9lLYqy0H0g5FJU1X_o0',
    'Snow Globes': 'EQC4pz_lGlN0f-GrWLB_0N3xTKJb1ZQn5gJJX3WqaNfSQqt7',
    'Hypno Lollipops': 'EQDbqJqGJbJa8lWHqFY0tpmxAqQ1EGXvNGpJq0ZuZEu3mY5g',
    'Party Sparklers': 'EQBdq8YLtT4SJLS_7GVJL_3MxCrP1L2kfQ8WrNWzVq2Tj6Td',
    'Scared Cats': 'EQCm6g6X7F9xQGNDVF3q5LDNF3_Q6L3nLlXXOGmBGDD8KfQr',
    'Trapped Hearts': 'EQB7YYJQe3T7oJLT9fRvDVi6GDkRQ_IrZx5W6vD5ELAq2q9Y',
    'Jack-O-Lanterns': 'EQAw5rwPgqH7nX-qMNHQzHl0kJ5lhHGWYoKl7_CRhPNJ1Wzx',
    'Top Hats': 'EQDc_3ij5VPrf0l2pPT8yvCZrVGPm3fTVXlKa3-MJp8Y0n4z',
    'Evil Eyes': 'EQBL5j3lZpQPnlpqS3XxZ1tF4J7DlVWsLs0XAi2O3M1DTQZ4',
    'Bunny Muffins': 'EQCX2GZpgHEH1x6SJVj48sM-CMfrkkR5D3T7xPjHvwNlCLvE',
    'Diamond Rings': 'EQDQRX2rJ8HlT9SLpDL9XH91q0cYHXDqPkY0MxZKW5Dc8x_T',
    'Desk Calendars': 'EQBn_RTnKrKJ7pP6fPXtM5sB8QWcYH7YB7HdQ5pq8LNL2k_m',
    'Spy Agarics': 'EQBz5CJPDY1HlfxH3KWpzPXrx6OYeqC0_LznyL3qCJMp_Xyc',
    'Perfume Bottles': 'EQD5KlF9TMpH9-2xYfpKPqDB8Vm7vJLmRLXhFwQGz3JqFqSP',
    'Swiss Watches': 'EQAr_RH67qDB5LJq8lqQxH2Gn8bPw3KH6L3nJLxPpNzXJ1cQ',
    'Love Potions': 'EQBd2LLxI7qj9TL3SPpBnpH8xQbJ7L3vNWxpr5_EeBR7VQqg',
    'Flying Brooms': 'EQBnK4xrQ5QGpLe3fPvN9OgBY2JJLlM3kHm6H_3oQeMjWdPQ',
    // Fallbacks (keep singulars just in case)
    'Plush Pepe': 'EQBG-g6ahkAUGWpefWbx-D_9sQ8oWbvy6puuq78U2c4NUDFS'
};

// Get all gift collection addresses as Set for O(1) lookup
const GIFT_COLLECTION_ADDRESSES = new Set(Object.values(TELEGRAM_GIFT_COLLECTIONS));
// Get all gift collection names for fallback verification
const GIFT_COLLECTION_NAMES = new Set(Object.keys(TELEGRAM_GIFT_COLLECTIONS));

// Full list of Official Telegram Gift names (Singular) provided by user
// We match these against the NFT name (e.g. "Plush Pepe #123" -> "Plush Pepe")
const OFFICIAL_GIFT_NAMES = new Set([
    'Plush Pepe', 'Heart Locket', "Durov's Cap", 'Precious Peach', 'Heroic Helmet', 'Mighty Arm',
    'Astral Shard', 'Nail Bracelet', 'Loot Bag', 'Perfume Bottle', 'Mini Oscar', 'Ion Gem',
    'Scared Cat', 'Artisan Brick', 'Magic Potion', 'Gem Signet', 'Westside Sign', 'Genie Lamp',
    'Bonded Ring', 'Swiss Watch', 'Sharp Tongue', 'Kissed Frog', 'Low Rider', 'Neko Helmet',
    'Electric Skull', 'Toy Bear', 'Signet Ring', 'Vintage Cigar', 'Bling Binky', 'Voodoo Doll',
    'Diamond Ring', "Khabib's Papakha", 'Eternal Rose', 'Cupid Charm', 'Ionic Dryer', 'Love Potion',
    'Mad Pumpkin', 'Record Player', 'Trapped Heart', 'Valentine Box', 'Sky Stilettos', 'Flying Broom',
    'Top Hat', 'Love Candle', 'Snoop Cigar', 'Crystal Ball', 'Skull Flower', 'Sleigh Bell',
    'Sakura Flower', 'Hanging Star', 'Jolly Chimp', 'Evil Eye', 'Joyful Bundle', 'Berry Box',
    'Bunny Muffin', 'Jelly Bunny', 'Bow Tie', 'Snow Globe', 'Spring Basket', 'Eternal Candle',
    'Light Sword', 'Lush Bouquet', 'Input Key', 'Spy Agaric', 'Snow Mittens', 'Jack-in-the-Box',
    'Swag Bag', 'Witch Hat', 'Ginger Cookie', 'Party Sparkler', 'Santa Hat', 'Moon Pendant',
    'Hex Pot', 'Easter Egg', 'Cookie Heart', 'Restless Jar', 'Star Notepad', 'Snoop Dogg',
    'Jingle Bells', 'Winter Wreath', 'Clover Pin', 'Mousse Cake', 'Spiced Wine', 'Stellar Rocket',
    'Fresh Socks', 'Faith Amulet', 'Money Pot', 'Homemade Cake', 'Pretty Posy', 'Hypno Lollipop',
    'Holiday Drink', 'Pet Snake', 'Jester Hat', 'Happy Brownie', 'Tama Gadget', 'Xmas Stocking',
    'Candy Cane', 'Big Year', 'Snake Box', 'Lunar Snake', 'Whip Cupcake', 'Lol Pop',
    'Ice Cream', 'B-Day Candle', 'Instant Ramen', 'Desk Calendar'
]);

// TonAPI base URL
const TONAPI_BASE_URL = 'https://tonapi.io/v2';
// Toncenter API as fallback
const TONCENTER_BASE_URL = 'https://toncenter.com/api/v3';

/**
 * Check if TONAPI_KEY is a real key (not placeholder)
 */
function getValidTonApiKey() {
    const key = process.env.TONAPI_KEY;
    if (!key || key === 'YOUR_TONAPI_KEY_HERE' || key.startsWith('YOUR_')) return null;
    return key;
}

/**
 * Fetch all NFTs for a wallet address from TonAPI with pagination
 * Handles wallets with 1000+ NFTs by fetching in batches
 * @param {string} walletAddress - TON wallet address (UQ... or EQ... format)
 * @param {number} maxNFTs - Maximum NFTs to fetch (safety limit)
 * @returns {Promise<Array>} Array of NFT items
 */
/**
 * Utility: Fetch with Retry for Rate Limits
 */
async function fetchWithRetry(url, options = {}, retries = 3, backoff = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);

            if (response.status === 429) {
                const waitTime = backoff * (i + 1);
                console.warn(`⚠️ TonAPI Rate Limit (429). Waiting ${waitTime}ms...`);
                await new Promise(r => setTimeout(r, waitTime));
                continue;
            }

            return response;
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(r => setTimeout(r, backoff));
        }
    }
    throw new Error('Max retries reached');
}

/**
 * Fetch all NFTs for a wallet address from TonAPI with pagination
 * Handles wallets with 1000+ NFTs by fetching in batches
 * @param {string} walletAddress - TON wallet address (UQ... or EQ... format)
 * @param {number} maxNFTs - Maximum NFTs to fetch (safety limit)
 * @returns {Promise<Array>} Array of NFT items
 */
async function fetchNFTsFromTonAPI(walletAddress, maxNFTs = 10000) {
    console.log(`⚡ TonAPI: Fetching NFTs for ${walletAddress.substring(0, 10)}...`);
    const startTime = Date.now();

    const allNFTs = [];
    let offset = 0;
    const limit = 1000; // TonAPI max per request

    // Check for API Key
    const headers = {
        'Accept': 'application/json',
        'User-Agent': 'iFragmentBot/1.0'
    };
    const apiKey = getValidTonApiKey();
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    try {
        while (offset < maxNFTs) {
            const url = `${TONAPI_BASE_URL}/accounts/${walletAddress}/nfts?limit=${limit}&offset=${offset}&indirect_ownership=false`;

            const response = await fetchWithRetry(url, { headers });

            if (!response.ok) {
                throw new Error(`TonAPI error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const nftItems = data.nft_items || [];

            allNFTs.push(...nftItems);

            console.log(`⚡ TonAPI: Fetched ${nftItems.length} NFTs (offset: ${offset}, total: ${allNFTs.length})`);

            // If we got fewer than limit, we've reached the end
            if (nftItems.length < limit) {
                break;
            }

            offset += limit;

            // Small delay between requests to avoid rate limiting
            if (offset < maxNFTs) {
                await new Promise(r => setTimeout(r, 500)); // Increased delay to 500ms
            }
        }

        const elapsed = Date.now() - startTime;
        console.log(`⚡ TonAPI: Total ${allNFTs.length} NFTs fetched in ${elapsed}ms`);

        return allNFTs;
    } catch (error) {
        console.error('❌ TonAPI fetch error:', error.message);
        throw error;
    }
}

/**
 * Check if an NFT is a Telegram Username from the OFFICIAL Fragment collection
 * @param {Object} nft - NFT item from TonAPI
 * @returns {boolean}
 */
function isTelegramUsername(nft) {
    // Method 1: Check by dns field (most reliable - only official Fragment NFTs have this)
    if (nft.dns && nft.dns.endsWith('.t.me')) {
        return true;
    }

    // Method 2: STRICT check by collection address - must match EXACT official collection
    if (nft.collection?.address) {
        const collectionAddress = nft.collection.address;
        // Check if address matches the official Fragment username collection
        if (collectionAddress === FRAGMENT_COLLECTIONS.USERNAMES) {
            return true;
        }
        // Also check raw format (0: prefix version)
        if (collectionAddress.includes('80d78a35f955a14b679faa887ff4cd5bfc0f43b4a4eea2a7e6927f3701b273c2')) {
            return true;
        }
    }

    // Method 3: Check by EXACT collection name (only "Telegram Usernames")
    const collectionName = nft.collection?.name?.toLowerCase() || '';
    if (USERNAME_COLLECTION_NAMES.some(name => collectionName === name)) {
        return true;
    }

    // NO FALLBACK to metadata-only check - this would catch FAKE NFTs
    // Fake NFTs can have @username in metadata but are NOT from official collection
    return false;
}

/**
 * Check if an NFT is an Anonymous Telegram Number (+888) from OFFICIAL collection
 * @param {Object} nft - NFT item from TonAPI
 * @returns {boolean}
 */
function isAnonymousNumber(nft) {
    // Method 1: STRICT check by collection address
    if (nft.collection?.address) {
        const collectionAddress = nft.collection.address;
        // Check if address matches the official Fragment anonymous numbers collection
        if (collectionAddress === FRAGMENT_COLLECTIONS.ANONYMOUS_NUMBERS) {
            return true;
        }
        // Also check raw format (0: prefix version)
        if (collectionAddress.includes('0a4b987e2724a41de7c25668dcafb0c4ec2ac47d0c02f202027f4715a8860752')) {
            return true;
        }
    }

    // Method 2: Check by EXACT collection name
    const collectionName = nft.collection?.name?.toLowerCase() || '';
    if (ANON_NUMBER_COLLECTION_NAMES.some(name => collectionName === name)) {
        return true;
    }

    // NO FALLBACK to metadata-only check (+888 pattern) - this would catch FAKE NFTs
    return false;
}

/**
 * Extract username from NFT data
 * @param {Object} nft - NFT item from TonAPI
 * @returns {string|null} Username without @ prefix
 */
function extractUsername(nft) {
    // Method 1: Try dns field first (most reliable - format: username.t.me)
    if (nft.dns && nft.dns.endsWith('.t.me')) {
        return nft.dns.replace('.t.me', '');
    }

    // Method 2: Try metadata name
    const name = nft.metadata?.name || '';

    // Remove @ prefix if present
    if (name.startsWith('@')) {
        return name.substring(1);
    }

    // If no @, check if it's a valid username format
    if (/^[a-zA-Z0-9_]{4,32}$/.test(name)) {
        return name;
    }

    return null;
}

/**
 * Extract anonymous number from NFT data
 * @param {Object} nft - NFT item from TonAPI
 * @returns {string|null} Phone number in +888XXXXXXXXXX format
 */
function extractAnonymousNumber(nft) {
    const name = nft.metadata?.name || '';

    // Match +888 followed by digits (with possible spaces)
    const match = name.match(/\+888[\s\d]+\d/);
    if (match) {
        // Normalize: remove all spaces
        return match[0].replace(/\s+/g, '');
    }

    return null;
}

/**
 * Get the owner wallet address of a Telegram username using TonAPI DNS resolution
 * This is much more reliable than scraping Fragment website
 * @param {string} username - Telegram username (with or without @)
 * @returns {Promise<string|null>} Owner wallet address or null if not found
 */
export async function getOwnerWalletByUsername(username) {
    const cleanUsername = username.replace('@', '').trim().toLowerCase();
    const dnsName = `${cleanUsername}.t.me`;

    console.log(`🔍 TonAPI DNS: Looking up owner of @${cleanUsername}...`);

    try {
        // Use TonAPI DNS resolution to find the NFT owner
        const url = `${TONAPI_BASE_URL}/dns/${encodeURIComponent(dnsName)}/resolve`;

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'iFragmentBot/1.0'
            }
        });

        if (!response.ok) {
            // Try alternative: search for the NFT directly by getting the NFT address first
            console.log(`⚠️ DNS resolve failed (${response.status}), trying NFT lookup...`);
            return await getOwnerByNFTSearch(cleanUsername);
        }

        const data = await response.json();

        // The DNS resolution returns wallet info
        // Check for owner in the response
        if (data.wallet?.address) {
            console.log(`✅ Found owner via DNS: ${data.wallet.address.substring(0, 10)}...`);
            return data.wallet.address;
        }

        // Alternative: check sites array for wallet
        if (data.sites && data.sites.length > 0) {
            for (const site of data.sites) {
                if (site.address) {
                    console.log(`✅ Found owner via sites: ${site.address.substring(0, 10)}...`);
                    return site.address;
                }
            }
        }

        // If DNS doesn't return owner, try NFT-based lookup
        console.log(`⚠️ DNS didn't return owner, trying NFT lookup...`);
        return await getOwnerByNFTSearch(cleanUsername);

    } catch (error) {
        console.error(`❌ DNS lookup error for @${cleanUsername}:`, error.message);
        // Try NFT-based lookup as fallback
        return await getOwnerByNFTSearch(cleanUsername);
    }
}

/**
 * Search for username NFT and get its owner via TonAPI NFT search
 * @param {string} username - Clean username without @
 * @returns {Promise<string|null>} Owner wallet address or null
 */
async function getOwnerByNFTSearch(username) {
    try {
        // Try getting NFT info by DNS name directly - this is the most reliable method
        const dnsUrl = `${TONAPI_BASE_URL}/dns/${encodeURIComponent(username + '.t.me')}`;

        const response = await fetch(dnsUrl, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'iFragmentBot/1.0'
            }
        });

        if (response.ok) {
            const data = await response.json();

            // PRIORITY 1: Check for owner in the 'item' object (handles masterchain addresses like @news)
            // This is the most reliable source as it comes directly from the NFT data
            if (data.item?.owner?.address) {
                const ownerAddress = data.item.owner.address;
                console.log(`✅ Found owner via DNS item: ${ownerAddress.substring(0, 15)}...`);
                return ownerAddress;
            }

            // PRIORITY 2: Check for owner directly in response (older API format)
            if (data.owner?.address) {
                console.log(`✅ Found owner in DNS data: ${data.owner.address.substring(0, 15)}...`);
                return data.owner.address;
            }

            // PRIORITY 3: If we have NFT address but no owner yet, fetch NFT details
            const nftAddress = data.item?.address || data.address;
            if (nftAddress) {
                // Now get the NFT details to find owner
                const nftUrl = `${TONAPI_BASE_URL}/nfts/${nftAddress}`;
                const nftResponse = await fetch(nftUrl, {
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'iFragmentBot/1.0'
                    }
                });

                if (nftResponse.ok) {
                    const nftData = await nftResponse.json();
                    if (nftData.owner?.address) {
                        console.log(`✅ Found owner via NFT lookup: ${nftData.owner.address.substring(0, 15)}...`);
                        return nftData.owner.address;
                    }
                }
            }
        }

        console.log(`❌ Could not find owner for @${username} via NFT search`);
        return null;

    } catch (error) {
        console.error(`❌ NFT search error for @${username}:`, error.message);
        return null;
    }
}

export async function getPortfolio(walletAddress) {
    console.log(`📂 Fetching portfolio for wallet: ${walletAddress?.substring(0, 10)}...`);
    const overallStart = Date.now();

    try {
        // Build headers
        const headers = {
            'Accept': 'application/json',
            'User-Agent': 'iFragmentBot/1.0'
        };
        const apiKey = getValidTonApiKey();
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        // 1. Fetch Account Info — try TonAPI first, fallback to Toncenter
        let accountData = {};
        try {
            const accountUrl = `${TONAPI_BASE_URL}/accounts/${walletAddress}`;
            const accountResp = await fetchWithRetry(accountUrl, { headers });
            if (accountResp.ok) {
                accountData = await accountResp.json();
            } else {
                console.warn(`⚠️ TonAPI account fetch failed (${accountResp.status}), trying Toncenter...`);
                const tcResp = await fetchWithRetry(`${TONCENTER_BASE_URL}/account?address=${encodeURIComponent(walletAddress)}`);
                if (tcResp.ok) {
                    const tcData = await tcResp.json();
                    accountData = {
                        balance: parseInt(tcData.balance || '0'),
                        status: tcData.status || 'active',
                        is_wallet: true,
                        last_activity: tcData.last_transaction_lt ? Math.floor(Date.now() / 1000) : 0
                    };
                }
            }
        } catch (accErr) {
            console.warn('⚠️ Account fetch failed on both providers:', accErr.message);
        }

        // 2. Fetch all NFTs in one API call (< 1 second)
        const nfts = await fetchNFTsFromTonAPI(walletAddress);

        const portfolio = {
            wallet: walletAddress,
            balance: (accountData.balance || 0) / 1e9,
            status: accountData.status || 'active',
            isWallet: accountData.is_wallet || false,
            interfaces: accountData.interfaces || [],
            lastActivity: accountData.last_activity || 0,
            usernames: [],
            anonymousNumbers: [],
            gifts: [],
            totalUsernames: 0,
            totalNumbers: 0,
            totalGifts: 0
        };

        // Process each NFT
        for (const nft of nfts) {
            // Check for Telegram Usernames
            if (isTelegramUsername(nft)) {
                const username = extractUsername(nft);
                if (username && !portfolio.usernames.find(u => u.name === username)) {
                    portfolio.usernames.push({
                        name: username,
                        url: `https://fragment.com/username/${username}`,
                        nftAddress: nft.address || ''
                    });
                }
                continue; // Already categorized
            }

            // Check for Anonymous Numbers
            if (isAnonymousNumber(nft)) {
                const number = extractAnonymousNumber(nft);
                if (number && !portfolio.anonymousNumbers.find(n => n.number === number)) {
                    portfolio.anonymousNumbers.push({
                        number: number,
                        url: `https://fragment.com/number/${number.replace('+', '')}`,
                        nftAddress: nft.address || ''
                    });
                }
                continue; // Already categorized
            }

            // Check if this NFT is an Official Telegram Gift
            const collectionAddress = nft.collection?.address || '';
            const collectionName = nft.collection?.name || 'Unknown Collection';
            const nftName = nft.metadata?.name || '';

            // Debug log (commented out to reduce noise)
            // console.log(`🔎 Checking Gift: Name="${nftName}", Coll="${collectionName}"`);

            let isVerified = false;
            let isGift = false;

            // Method 1: Check by Address (Fastest & Safest)
            if (GIFT_COLLECTION_ADDRESSES.has(collectionAddress)) {
                isGift = true;
                isVerified = true;
            }

            // Method 2: Check by Collection Name (Keys of our map)
            if (!isGift && GIFT_COLLECTION_NAMES.has(collectionName)) {
                isGift = true;
                isVerified = true;
            }

            // Method 3: Check by Item Name (Robust Fallback for singular vs plural issues)
            const cleanName = nftName.replace(/ #\d+$/, '').trim();
            if (!isGift && nftName) {
                if (OFFICIAL_GIFT_NAMES.has(cleanName)) {
                    isGift = true;
                    // Note: If matched ONLY by name, it remains isVerified = false (Potential Scam Risk)
                }
            }

            if (!isGift) {
                continue;
            }

            // It's a valid Telegram Gift!
            // Use the clean name for grouping if possible, otherwise use collection name
            const displayName = OFFICIAL_GIFT_NAMES.has(cleanName) ? cleanName : (collectionName || 'Unknown Gift');

            // Check if this gift already exists (group by display name)
            const existingGift = portfolio.gifts.find(g => g.name === displayName);
            if (existingGift) {
                existingGift.count = (existingGift.count || 1) + 1;
                // If ANY item in the group is unverified, mark the whole group as having unverified items? 
                // Or stick to strict: if we touch it, we keep existing verification status or downgrade it?
                // Let's degrade: if incoming is Unverified, the group becomes mixed/unverified.
                if (!isVerified) existingGift.isVerified = false;
            } else {
                portfolio.gifts.push({
                    name: displayName,
                    collection: collectionName,
                    count: 1,
                    isVerified: isVerified, // Store status
                    image: nft.previews?.[0]?.url || nft.metadata?.image || null,
                    nftAddress: nft.address || ''
                });
            }
        }

        portfolio.totalUsernames = portfolio.usernames.length;
        portfolio.totalNumbers = portfolio.anonymousNumbers.length;
        portfolio.totalGifts = portfolio.gifts.reduce((sum, g) => sum + (g.count || 1), 0);

        // Calculate Estimated Value (Simple Logic)
        // This is a rough estimate: 10 TON per username, 50 TON per number, 5 TON per gift
        // In a real app, you would scrape floor prices for each item or use a better heuristic
        const EST_MIN_USERNAME_VALUE = 10;
        const EST_MIN_NUMBER_VALUE = 50;
        const EST_MIN_GIFT_VALUE = 5;

        const totalValue = (portfolio.totalUsernames * EST_MIN_USERNAME_VALUE) +
            (portfolio.totalNumbers * EST_MIN_NUMBER_VALUE) +
            (portfolio.totalGifts * EST_MIN_GIFT_VALUE);

        portfolio.estimatedValue = totalValue;

        const elapsed = Date.now() - overallStart;
        console.log(`✅ Portfolio: ${portfolio.totalUsernames} usernames, ${portfolio.totalNumbers} numbers, ${portfolio.totalGifts} gifts (Value: ~${totalValue} TON) in ${elapsed}ms`);

        // Update User Portfolio Value for Leaderboard (if wallet is linked to a user)
        // Since getPortfolio is called with just walletAddress, we can't easily link to userId here *unless* we pass userId or look it up.
        // For now, let's update it in the HANDLER (bot.js) where we have the userId.

        return portfolio;

    } catch (error) {
        console.error('❌ Portfolio fetch error:', error.message);
        return {
            wallet: walletAddress,
            usernames: [],
            anonymousNumbers: [],
            gifts: [],
            totalUsernames: 0,
            totalNumbers: 0,
            totalGifts: 0,
            error: error.message
        };
    }
}

/**
 * Format portfolio for Telegram message
 * @param {Object} portfolio - Portfolio data
 * @param {number} tonPrice - Current TON price in USD
 * @returns {string} Formatted message
 */
export function formatPortfolioMessage(portfolio, tonPrice = 1.55) {
    if (!portfolio || portfolio.error) {
        return '❌ Could not fetch portfolio data.';
    }

    const total = portfolio.totalUsernames + portfolio.totalNumbers;

    if (total === 0) {
        return `💼 *Portfolio Overview*\n\n` +
            `🔗 *Wallet:* \`${portfolio.wallet?.substring(0, 8)}...${portfolio.wallet?.slice(-6)}\`\n\n` +
            `⚠️ No Fragment assets found.\n\n` +
            `_This wallet has no Telegram usernames or anonymous numbers from Fragment._`;
    }

    let msg = `💼 *Portfolio Overview*\n\n`;
    msg += `🔗 *Wallet:* \`${portfolio.wallet?.substring(0, 8)}...${portfolio.wallet?.slice(-6)}\`\n\n`;

    // Summary
    msg += `━━━ 📊 *Summary* ━━━\n\n`;
    msg += `💎 *Usernames:* ${portfolio.totalUsernames}\n`;
    msg += `📱 *Anonymous Numbers:* ${portfolio.totalNumbers}\n`;
    msg += `📦 *Total Assets:* ${total}\n\n`;

    // Usernames List - compact format with numbering
    if (portfolio.usernames.length > 0) {
        msg += `━━━ 💎 *Usernames* ━━━\n\n`;

        const usernameItems = portfolio.usernames.slice(0, 100).map((u, i) => {
            // Escape underscores to prevent Markdown parsing issues
            const escapedName = u.name.replace(/_/g, '\\_');
            return `${i + 1}.@${escapedName}`;
        });

        // Group usernames in chunks of 5 per line
        const usernameLines = [];
        for (let i = 0; i < usernameItems.length; i += 5) {
            usernameLines.push(usernameItems.slice(i, i + 5).join(' • '));
        }
        msg += usernameLines.join('\n');

        if (portfolio.usernames.length > 100) {
            msg += `\n\n_...and ${portfolio.usernames.length - 100} more usernames_`;
        }
        msg += `\n\n`;
    }

    // Anonymous Numbers List - compact format with numbering
    if (portfolio.anonymousNumbers.length > 0) {
        msg += `━━━ 📱 *Anonymous Numbers* ━━━\n\n`;

        const numberItems = portfolio.anonymousNumbers.slice(0, 100).map((n, i) =>
            `${i + 1}.${n.number}`
        );

        // Group numbers in chunks of 3 per line
        const numberLines = [];
        for (let i = 0; i < numberItems.length; i += 3) {
            numberLines.push(numberItems.slice(i, i + 3).join(' • '));
        }
        msg += numberLines.join('\n');

        if (portfolio.anonymousNumbers.length > 100) {
            msg += `\n\n_...and ${portfolio.anonymousNumbers.length - 100} more numbers_`;
        }
    }



    return msg;
}
