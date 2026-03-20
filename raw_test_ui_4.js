
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const TOKEN = process.env.BOT_TOKEN;
const API_URL = `https://api.telegram.org/bot${TOKEN}/sendMessage`;

async function test() {
    try {
        console.log('Sending Raw API (New Icon Field Test)...');
        const response = await axios.post(API_URL, {
            chat_id: '5076130392',
            text: '<b>MARCH 2026 ICON TEST</b>\nTesting the new <code>icon_custom_emoji_id</code> field.',
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: 'Native Icon Test',
                        callback_data: 'test',
                        style: 'success',
                        icon_custom_emoji_id: '5248997768596300248' // The new March 2026 field
                    }
                ]]
            }
        });
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error('Error Body:', e.response?.data);
    }
}

test();
