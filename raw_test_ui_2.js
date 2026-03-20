
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const TOKEN = process.env.BOT_TOKEN;
const API_URL = `https://api.telegram.org/bot${TOKEN}/sendMessage`;

async function test() {
    try {
        console.log('Sending Raw API (Entities Test)...');
        const response = await axios.post(API_URL, {
            chat_id: '5076130392',
            text: '<b>2026 ENTITIES TEST</b>',
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: '✨ Icon Test',
                        callback_data: 'test',
                        style: 'success',
                        entities: [ // Trying "entities" instead of "text_entities"
                            {
                                type: 'custom_emoji',
                                offset: 0,
                                length: 1,
                                custom_emoji_id: '5248997768596300248'
                            }
                        ]
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
