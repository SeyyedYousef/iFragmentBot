/**
 * Monitor Handler Module
 * Handles sales monitor and daily scheduler admin commands.
 * Extracted from bot.entry.js to reduce monolith size.
 */

// import salesMonitor from '../../Modules/Monitoring/Application/sales-monitor.service.js'; // REMOVED
import * as dailyScheduler from "../../Modules/Automation/Application/daily-scheduler.service.js";

// ==================== REGISTER HANDLERS ====================

export function registerMonitorHandlers(bot, isAdmin) {
	// ==================== DAILY REPORT (Market Pulse) ====================
	// Keep this for manual admin usage or scheduler

	bot.command("dailyreport", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return;

		try {
			const statusMsg = await ctx.reply("📊 Generating Market Pulse...");
			const { generateMarketPulse } = await import(
				"../../Modules/Admin/Application/daily-report.service.js"
			);
			const result = await generateMarketPulse();

			let reportText = result;
			let imageBuffer = null;

			if (typeof result === "object" && result.report) {
				reportText = result.report;
				imageBuffer = result.imageBuffer;
			}

			await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);

			if (imageBuffer && imageBuffer.length > 0) {
				await ctx.replyWithPhoto(
					{ source: imageBuffer, filename: "market_pulse.png" },
					{
						caption: reportText,
						parse_mode: "Markdown",
					},
				);
			} else {
				await ctx.replyWithMarkdown(reportText);
			}
		} catch (e) {
			ctx.reply(`❌ Error: ${e.message}`);
		}
	});

	// ==================== DAILY SCHEDULER COMMANDS ====================

	bot.command("schedulerstatus", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return;

		const status = dailyScheduler.getStatus();
		ctx.replyWithMarkdown(`
⏰ *Daily Scheduler Status*

📡 Running: ${status.running ? "✅ Active" : "❌ Stopped"}
🕐 Afghanistan Time: \`${status.currentAfghanTime}\`
🎯 Target Time: \`${status.targetTime}\`
📅 Last Post: \`${status.lastPostDate || "Never"}\`
📢 Channel: \`${status.channel}\`
⏭️ Next Post: ${status.nextPostDate}
        `);
	});

	bot.command("forcepulse", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return;

		const statusMsg = await ctx.reply(
			"📊 Force posting Market Pulse to channel...",
		);
		try {
			await dailyScheduler.forcePostNow();
			await ctx.telegram.editMessageText(
				ctx.chat.id,
				statusMsg.message_id,
				null,
				"✅ Market Pulse posted to channel!",
			);
		} catch (e) {
			await ctx.telegram.editMessageText(
				ctx.chat.id,
				statusMsg.message_id,
				null,
				`❌ Error: ${e.message}`,
			);
		}
	});

	bot.command("stopscheduler", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return;
		dailyScheduler.stopScheduler();
		ctx.reply("🛑 Daily Scheduler stopped.");
	});

	bot.command("startscheduler", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return;
		dailyScheduler.startScheduler();
		ctx.reply("⏰ Daily Scheduler started.");
	});
}

export default {
	registerMonitorHandlers,
};
