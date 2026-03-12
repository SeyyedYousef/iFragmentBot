import 'dotenv/config';
import { Telegraf } from 'telegraf';

const token = process.env.BOT_TOKEN;
console.log('Testing token:', token);
const bot = new Telegraf(token);

async function test() {
    try {
        console.log('Attempting to fetch bot info...');
        const me = await bot.telegram.getMe();
        console.log('✅ Token is VALID!');
        console.log('Bot Info:', JSON.stringify(me, null, 2));
    } catch (error) {
        console.error('❌ Token test FAILED:', error.message);
    }
}

test();
