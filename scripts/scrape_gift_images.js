
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS_DIR = path.resolve(__dirname, '../src/Modules/Market/Infrastructure/Assets/Gifts');
if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

const GIFTS = [
    { name: 'Red Star', address: 'EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi', filename: 'redstar.jpg' },
    { name: 'Blue Star', address: 'EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N', filename: 'bluestar.jpg' },
    { name: 'Plush Pepe', address: 'EQBG-g6ahkAUGWpefWbx-D_9sQ8oWbvy6puuq78U2c4NUDFS', filename: 'plushpepe.jpg' },
    { name: 'Heart Locket', address: 'EQC4XEulxb05Le5gF6esMtDWT5XZ6tlzlMBQGNsqffxpdC5U', filename: 'heartlocket.jpg' },
    { name: 'Durov\'s Cap', address: 'EQD9ikZq6xPgKjzmdBG0G0S80RvUJjbwgHrPZXDKc_wsE84w', filename: 'durovcap.jpg' },
    { name: 'Precious Peach', address: 'EQA4i58iuS9DUYRtUZ97sZo5mnkbiYUBpWXQOe3dEUCcP1W8', filename: 'preciouspeach.jpg' },
    { name: 'Heroic Helmet', address: 'EQAlROpjm1k1mW30r61qRx3lYHsZkTKXVSiaHEIhOlnYA4oy', filename: 'heroichelmet.jpg' },
    { name: 'Mighty Arm', address: 'EQDeX0F1GDugNjtxkFRihu9ZyFFumBv2jYF5Al1thx2ADDQs', filename: 'mightyarm.jpg' }
    // Add others if addresses found
];

async function downloadImage(url, filepath) {
    if (!url) return;
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, response => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${url}: Status ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`✅ Downloaded: ${filepath}`);
                resolve();
            });
        }).on('error', err => {
            fs.unlink(filepath, () => { });
            reject(err);
        });
    });
}

async function scrapeImages() {
    console.log('🚀 Launching browser for GetGems scraping (og:image)...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        for (const gift of GIFTS) {
            // Construct GetGems URL from address
            const url = `https://getgems.io/collection/${gift.address}`;
            console.log(`🔍 Processing ${gift.name} (${url})...`);

            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // Extract og:image
                const imgUrl = await page.evaluate(() => {
                    const meta = document.querySelector('meta[property="og:image"]');
                    return meta ? meta.content : null;
                });

                if (imgUrl) {
                    console.log(`   📸 Found image: ${imgUrl}`);
                    const filepath = path.join(ASSETS_DIR, gift.filename);
                    await downloadImage(imgUrl, filepath);
                } else {
                    console.log(`   ⚠️ Image not found for ${gift.name}`);
                }

            } catch (e) {
                console.error(`   ❌ Error processing ${gift.name}:`, e.message);
            }
        }

    } finally {
        await browser.close();
    }
    console.log('✨ Scraping complete!');
}

scrapeImages();
