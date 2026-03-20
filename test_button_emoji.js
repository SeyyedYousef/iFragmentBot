
import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';
dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.command('test_emoji', async (ctx) => {
    try {
        // Try to send a button with a tg-emoji tag
        await ctx.reply('Testing Custom Emoji in Button...', Markup.inlineKeyboard([
            [Markup.button.callback('✨ <tg-emoji emoji-id="5248997768596300248">Icon</tg-emoji> Test', 'test')]
        ], { parse_mode: 'HTML' }));
        console.log('Sent button with HTML tags.');
    } catch (e) {
        console.error('Failed:', e.message);
    }
});

bot.launch();
console.log('Tester online. Use /test_emoji');
