
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const TOKEN = process.env.BOT_TOKEN;
const API_URL = `https://api.telegram.org/bot${TOKEN}/`;

async function test() {
    try {
        console.log('Step 1: Send Message with Custom Emoji to self...');
        const res = await axios.post(API_URL + 'sendMessage', {
            chat_id: '5076130392',
            text: '✨',
            entities: [{ type: 'custom_emoji', offset: 0, length: 1, custom_emoji_id: '5248997768596300248' }]
        });
        
        // Step 2: Extract the actual character from the result
        const actualChar = res.data.result.text;
        console.log('Extracted Character length:', actualChar.length);
        console.log('Hex:', Buffer.from(actualChar, 'utf-16le').toString('hex'));

        // Step 3: Try to use this character in a button
        console.log('Step 2: Try character in button...');
        await axios.post(API_URL + 'sendMessage', {
            chat_id: '5076130392',
            text: 'Testing extracted character in button:',
            reply_markup: {
                inline_keyboard: [[
                    { text: actualChar + ' Verified?', callback_data: 'ok' }
                ]]
            }
        });
        console.log('Done.');
    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();
