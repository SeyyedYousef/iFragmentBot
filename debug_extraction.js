
import 'dotenv/config';
import { Api } from 'telegram';
import { connectDB } from './src/services/mongoService.js';
import * as accountManager from './src/services/accountManagerService.js';

async function run() {
    console.log('🐞 Starting Debug Process...');

    await connectDB();
    await accountManager.initAccounts();

    // Force connect if not connected
    const accounts = accountManager.getAccountList();
    if (accounts.length === 0) {
        console.error('❌ No accounts found in DB');
        process.exit(1);
    }

    const client = accountManager.getClient('scanner'); // or just getClient()
    if (!client) {
        console.log('Trying to connect explicitly...');
        await accountManager.connectClient(accounts[0]);
    }

    const activeClient = accountManager.getClient();
    if (!activeClient) {
        console.error('❌ Failed to connect any client');
        process.exit(1);
    }

    const slug = 'PlushPepe';
    const item = 1;
    const giftUrl = `https://t.me/nft/${slug}-${item}`;
    console.log(`URL: ${giftUrl}`);

    try {
        const me = await activeClient.getMe();
        console.log(`Using account: ${me.firstName} (${me.phone})`);

        // Method 1: GetWebPage
        console.log('\n--- Method 1: GetWebPage ---');
        try {
            const webPage = await activeClient.invoke(
                new Api.messages.GetWebPage({
                    url: giftUrl,
                    hash: 0
                })
            );

            if (webPage.webpage) {
                console.log('Title:', webPage.webpage.title);
                console.log('Full WebPage:', JSON.stringify(webPage.webpage, null, 2));
                console.log('Description:', webPage.webpage.description);
                console.log('SiteName:', webPage.webpage.siteName);
            } else {
                console.log('❌ No webpage found');
            }
        } catch (e) { console.log('GetWebPage Error:', e.message); }

        // Method 1.5: GetWebPage for fragment.com link
        console.log('\n--- Method 1.5: Fragment Link ---');
        try {
            const fragLink = `https://fragment.com/gift/${slug.toLowerCase()}-${item}`;
            const webPageFrag = await activeClient.invoke(
                new Api.messages.GetWebPage({
                    url: fragLink,
                    hash: 0
                })
            );
            console.log('Frag Link Title:', webPageFrag.webpage?.title);
            console.log('Frag Link Desc:', webPageFrag.webpage?.description);
        } catch (e) { console.log('Frag Link Error:', e.message); }

        // Method 2: Send Message to Self
        console.log('\n--- Method 2: Send to Saved Messages ---');
        try {
            const sent = await activeClient.sendMessage('me', { message: giftUrl });

            console.log('Waiting for preview (3s)...');
            await new Promise(r => setTimeout(r, 3000));

            const messages = await activeClient.getMessages('me', { ids: [sent.id] });
            const msg = messages[0];

            if (msg.media && msg.media.webpage) {
                console.log('Preview Title:', msg.media.webpage.title);
                console.log('Preview Desc:', msg.media.webpage.description);
                // Regex test
                const match = msg.media.webpage.description?.match(/@([a-zA-Z][a-zA-Z0-9_]{3,30})/);
                console.log('Regex Match:', match ? match[1] : 'None');
            } else {
                console.log('❌ No preview generated');
            }

            await activeClient.deleteMessages('me', [sent.id], { revoke: true });
        } catch (e) { console.log('SendMessage Error:', e.message); }

        // Method 3: Inline Query @nft
        console.log('\n--- Method 3: @nft Inline Query ---');
        try {
            const results = await activeClient.invoke(
                new Api.messages.GetInlineBotResults({
                    bot: 'fragment', // Try 'fragment' or 'nft'
                    peer: 'me',
                    query: `${slug}-${item}`,
                    offset: ''
                })
            );

            console.log(`Found ${results.results.length} results`);
            if (results.results.length > 0) {
                const res = results.results[0];
                console.log('Result Title:', res.title);
                console.log('Result Desc:', res.description);
                if (res.sendMessage && res.sendMessage.message) {
                    console.log('Message Text:', res.sendMessage.message);
                }
            }
        } catch (e) {
            console.log('Inline error:', e.message);
        }

    } catch (e) {
        console.error('❌ Generic Error:', e);
    }

    process.exit(0);
}

run();
