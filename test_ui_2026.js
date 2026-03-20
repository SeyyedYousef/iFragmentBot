
import { Telegraf, Markup } from 'telegraf';
import { admin_user_id } from './src/database/panelDatabase.js'; // Assuming it's in panelDB
import dotenv from 'dotenv';
dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

async function test() {
    try {
        console.log('Sending Test... (Check bot chat)');
        
        await bot.telegram.sendMessage('5076130392', 
            '<b>2026 Bot API UI Test</b>\nCheck if button below is GREEN and has a star.', 
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        {
                            text: '🟢 Style Test',
                            callback_data: 'test',
                            style: 'positive' // Try Bot API 8.x style
                        }
                    ]]
                }
            }
        );
        console.log('Test message sent.');
    } catch (e) {
        console.error('Test Failed:', e.message);
    }
}

test();
