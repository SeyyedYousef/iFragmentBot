/**
 * Monitor Handler Module
 * Handles sales monitor and daily scheduler admin commands.
 * Extracted from bot.entry.js to reduce monolith size.
 */

// import salesMonitor from '../../Modules/Monitoring/Application/sales-monitor.service.js'; // REMOVED
// ==================== REGISTER HANDLERS ====================

export function registerMonitorHandlers(bot, isAdmin) {
	// ==================== DAILY REPORT (Market Pulse) ====================

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
}

export default {
	registerMonitorHandlers,
};
