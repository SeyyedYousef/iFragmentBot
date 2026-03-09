
import { generateMarketCard } from './src/services/cardGenerator.js';
import fs from 'fs';

async function test() {
    console.log('🚀 Starting Market Card Test...');

    const mockData = {
        tonPrice: 1.38,
        price888: 1808,
        gifts: {
            'Plush Pepe': {
                name: 'Plush Pepe',
                price: 9213.33,
                image: 'https://cache.marketapp.ws/collection/PlushPepe.jpg'
            },
            'Heart Locket': {
                name: 'Heart Locket',
                price: 2103.04,
                image: 'https://cache.marketapp.ws/collection/HeartLocket.jpg'
            },
            'Durov\'s Cap': {
                name: 'Durov\'s Cap',
                price: 791.14,
                image: 'https://cache.marketapp.ws/collection/DurovCap.jpg'
            },
            'Precious Peach': {
                name: 'Precious Peach',
                price: 418.61,
                image: 'https://cache.marketapp.ws/collection/PreciousPeach.jpg'
            },
            'Heroic Helmet': {
                name: 'Heroic Helmet',
                price: 265.38,
                image: 'https://cache.marketapp.ws/collection/HeroicHelmet.jpg'
            },
            'Mighty Arm': {
                name: 'Mighty Arm',
                price: 180.26,
                image: 'https://cache.marketapp.ws/collection/MightyArm.jpg'
            }
        }
    };

    try {
        const buffer = await generateMarketCard(mockData);
        fs.writeFileSync('market_card_debug.png', buffer);
        console.log('✅ Test Complete! Image saved as market_card_debug.png');
    } catch (error) {
        console.error('❌ Test Failed:', error);
    }
}

test();
