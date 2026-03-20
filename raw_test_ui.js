
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const TOKEN = process.env.BOT_TOKEN;
const API_URL = `https://api.telegram.org/bot${TOKEN}/sendMessage`;

async function test() {
    try {
        console.log('Sending Raw API Request...');
        const response = await axios.post(API_URL, {
            chat_id: '5076130392', // Replace with your test ID
            text: '<b>2026 RAW API TEST</b>\nTesting Custom Emoji in Button via Raw JSON.',
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: '✨ Raw Emoji Test',
                        callback_data: 'test',
                        style: 'success',
                        text_entities: [
                            {
                                type: 'custom_emoji',
                                offset: 0,
                                length: 1, // ✨ is one character (actually 2 in UTF-16)
                                custom_emoji_id: '5248997768596300248'
                            }
                        ]
                    }
                ]]
            }
        });
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error('Error Body:', e.response?.data);
        console.error('Error Message:', e.message);
    }
}

test();
