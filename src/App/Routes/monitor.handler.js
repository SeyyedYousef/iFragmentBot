/**
 * Monitor Handler Module
 * Handles sales monitor and daily scheduler admin commands.
 * Extracted from bot.entry.js to reduce monolith size.
 */

import salesMonitor from '../../Modules/Monitoring/Application/sales-monitor.service.js';
import * as dailyScheduler from '../../Modules/Automation/Application/daily-scheduler.service.js';

// ==================== REGISTER HANDLERS ====================

export function registerMonitorHandlers(bot, isAdmin) {

    // ==================== SALES MONITOR COMMANDS ====================

    bot.command('setthreshold', async (ctx) => {
        const userId = ctx.from.id;
        console.log(`[CMD] /setthreshold called by ${userId}`);

        if (!isAdmin(userId)) {
            console.log(`[CMD] Access DENIED for ${userId}`);
            return;
        }

        const args = ctx.message.text.split(' ');
        if (args.length < 3) {
            return ctx.reply('⚠️ Usage: `/setthreshold username 1000` or `/setthreshold number 500`', { parse_mode: 'Markdown' });
        }

        const type = args[1].toLowerCase();
        const value = parseFloat(args[2]);

        if (isNaN(value)) return ctx.reply('❌ Invalid price.');

        if (type === 'username') {
            salesMonitor.updateConfig('minPriceUsername', value);
            console.log(`[CMD] Updated Username Threshold to ${value}`);
            ctx.reply(`✅ Username threshold set to *${value} TON*`, { parse_mode: 'Markdown' });
        } else if (type === 'number') {
            salesMonitor.updateConfig('minPriceNumber', value);
            console.log(`[CMD] Updated Number Threshold to ${value}`);
            ctx.reply(`✅ Number threshold set to *${value} TON*`, { parse_mode: 'Markdown' });
        } else {
            ctx.reply('❌ Type must be `username` or `number`');
        }
    });

    bot.command('stopmonitor', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return;
        salesMonitor.stopMonitor();
        ctx.reply('🔕 Sales Monitor stopped.');
    });

    bot.command('startmonitor', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return;
        salesMonitor.startMonitor();
        ctx.reply('🔔 Sales Monitor started.');
    });

    bot.command('dailyreport', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return;

        try {
            const statusMsg = await ctx.reply('📊 Generating Market Pulse...');
            const { generateMarketPulse } = await import('../../Modules/Admin/Application/daily-report.service.js');
            const result = await generateMarketPulse();

            let reportText = result;
            let imageBuffer = null;

            if (typeof result === 'object' && result.report) {
                reportText = result.report;
                imageBuffer = result.imageBuffer;
            }

            await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);

            if (imageBuffer) {
                await ctx.replyWithPhoto({ source: imageBuffer }, {
                    caption: reportText,
                    parse_mode: 'Markdown'
                });
            } else {
                await ctx.replyWithMarkdown(reportText);
            }
        } catch (e) {
            ctx.reply(`❌ Error: ${e.message}`);
        }
    });

    // ==================== DAILY SCHEDULER COMMANDS ====================

    bot.command('schedulerstatus', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return;

        const status = dailyScheduler.getStatus();
        ctx.replyWithMarkdown(`
⏰ *Daily Scheduler Status*

📡 Running: ${status.running ? '✅ Active' : '❌ Stopped'}
🕐 Afghanistan Time: \`${status.currentAfghanTime}\`
🎯 Target Time: \`${status.targetTime}\`
📅 Last Post: \`${status.lastPostDate || 'Never'}\`
📢 Channel: \`${status.channel}\`
⏭️ Next Post: ${status.nextPostDate}
        `);
    });

    bot.command('forcepulse', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return;

        const statusMsg = await ctx.reply('📊 Force posting Market Pulse to channel...');
        try {
            await dailyScheduler.forcePostNow();
            await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, '✅ Market Pulse posted to channel!');
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, `❌ Error: ${e.message}`);
        }
    });

    bot.command('stopscheduler', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return;
        dailyScheduler.stopScheduler();
        ctx.reply('🛑 Daily Scheduler stopped.');
    });

    bot.command('startscheduler', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return;
        dailyScheduler.startScheduler();
        ctx.reply('⏰ Daily Scheduler started.');
    });
}

export default {
    registerMonitorHandlers
};
