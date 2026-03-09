import { Markup } from 'telegraf';
import { tonPriceCache } from '../../Shared/Infra/Cache/cache.service.js';
import { getTonPrice, scrapeFragment, generateShortInsight } from '../../Modules/Market/Infrastructure/fragment.repository.js';
import { estimateValue, calculateRarity } from '../../core/Config/app.config.js';
import { generateComparisonReport } from '../Helpers/report.helper.js';
import { generateComparisonCard } from '../../Shared/UI/Components/comparison-card.component.js';
import { useFeature, formatCreditsMessage, formatNoCreditsMessage, isPremium } from '../../Modules/User/Application/user.service.js';

/**
 * Handle username comparison - fetch data and generate report
 */
export async function handleComparison(ctx, username1, username2) {
    const statusMessage = await ctx.reply('🔄 Analyzing usernames...\n\n⏳ Fetching market data & AI insights...');

    try {
        console.log(`Starting comparison for ${username1} vs ${username2}`);

        // Fetch data for both usernames in parallel
        let tonPrice = tonPriceCache.get('price');
        if (!tonPrice) {
            try {
                tonPrice = await getTonPrice();
            } catch (e) {
                console.error('Error fetching TON price:', e);
                tonPrice = 6.0; // Fallback
            }
        }

        console.log('Fetching data points...');
        const [data1, data2, insight1, insight2] = await Promise.all([
            scrapeFragment(username1).catch(e => ({ statusText: 'Error', status: 'unknown' })),
            scrapeFragment(username2).catch(e => ({ statusText: 'Error', status: 'unknown' })),
            generateShortInsight(username1).catch(e => 'No insight'),
            generateShortInsight(username2).catch(e => 'No insight')
        ]);

        console.log('Calculating stats...');
        const [estValue1, estValue2] = await Promise.all([
            estimateValue(username1, data1.lastSalePrice, tonPrice, data1.status),
            estimateValue(username2, data2.lastSalePrice, tonPrice, data2.status)
        ]);
        const rarity1 = await calculateRarity(username1, estValue1);
        const rarity2 = await calculateRarity(username2, estValue2);

        // Delete loading message
        try { await ctx.telegram.deleteMessage(ctx.chat.id, statusMessage.message_id); } catch (e) { }

        // Generate comparison report with AI insights
        console.log('Generating text report...');
        let report = '';
        try {
            report = generateComparisonReport(
                { username: username1, data: data1, rarity: rarity1, estValue: estValue1, insight: insight1 },
                { username: username2, data: data2, rarity: rarity2, estValue: estValue2, insight: insight2 },
                tonPrice
            );
        } catch (repErr) {
            console.error('Report generation error:', repErr);
            report = `Comparison: ${username1} vs ${username2}\n\nError generating detailed report.`;
        }

        // Generate comparison card image
        const comparisonCardData = {
            username1,
            username2,
            status1: data1.statusText || 'Unknown',
            status2: data2.statusText || 'Unknown',
            value1: estValue1.ton || 0,
            value2: estValue2.ton || 0,
            valueUsd1: estValue1.usd || 0,
            valueUsd2: estValue2.usd || 0,
            rarity1: rarity1,
            rarity2: rarity2,
            insight1: insight1,
            insight2: insight2
        };

        let imageBuffer;
        try {
            console.log('Generating card image...');
            imageBuffer = await generateComparisonCard(comparisonCardData);
        } catch (cardError) {
            if (cardError) console.error('Story Card gen error (bg):', cardError.message);
            imageBuffer = null;
        }

        // Send response
        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔄 New Comparison', callback_data: 'menu_compare' }],
                    [
                        { text: '📸 Share Story', callback_data: `story_username:${username1}` },
                        { text: `📊 @${username2}`, callback_data: `view_username:${username2}` }
                    ],
                    [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                ]
            }
        };

        if (imageBuffer && imageBuffer.length > 1000) {
            await ctx.replyWithPhoto(
                { source: Buffer.from(imageBuffer) },
                {
                    caption: report,
                    parse_mode: 'Markdown',
                    ...keyboard
                }
            );
        } else {
            await ctx.replyWithMarkdown(report, keyboard);
        }

        // Deduct credit and show remaining
        const creditResult = useFeature(ctx.from.id, 'compare');
        const creditsMsg = formatCreditsMessage(creditResult.remaining, creditResult.isPremium);
        if (!creditResult.isPremium) {
            await ctx.replyWithMarkdown(creditsMsg, Markup.inlineKeyboard([
                [Markup.button.callback('💎 Buy Premium', 'buy_premium')]
            ]));
        } else {
            await ctx.replyWithMarkdown(creditsMsg);
        }

    } catch (error) {
        console.error('Comparison error (Fatal):', error);
        try { await ctx.telegram.deleteMessage(ctx.chat.id, statusMessage.message_id); } catch (e) { }
        await ctx.reply(`❌ Error comparing usernames: ${error.message}`);
    }
}
