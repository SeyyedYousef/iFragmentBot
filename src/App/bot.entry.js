import "dotenv/config";
import http from "node:http";
import { Telegraf } from "telegraf";
import { CONFIG } from "../core/Config/app.config.js";
import { registerFakePanelHandlers } from "../Modules/Admin/Presentation/fake-panel.handler.js";
import { registerPanelHandlers } from "../Modules/Admin/Presentation/panel.handler.js";
// -- MIDDLEWARES --
import { spamProtection } from "../Modules/Security/Application/spam-protection.service.js";
import {
	addFrgCredits,
	isBlocked,
} from "../Modules/User/Application/user.service.js";
import { registerAccountHandlers } from "../Modules/User/Presentation/account.handler.js";
import { ErrorHandler } from "../Shared/Application/error-handler.service.js";
// -- HELPERS & BOOTSTRAP --
import {
	bootstrapServices,
	isAdmin,
	setupProcessHandlers,
	setupShutdownHandlers,
} from "./Helpers/bot-init.helper.js";
import { sendDashboard } from "./Helpers/dashboard.helper.js";
import {
	isChannelMember,
	sendJoinChannelMessage,
} from "./Helpers/membership.helper.js";
// -- LOADERS --
import { initJobHandlers } from "./Loaders/job-queue.loader.js";
import {
	loadPersistentCache,
	startBackgroundUpdates,
} from "./Loaders/market-data.loader.js";
// -- ROUTE HANDLERS --
import { registerAdminHandlers } from "./Routes/admin.handler.js";
import { handleDocumentMessage } from "./Routes/document.handler.js";
// -- GLOBAL EVENT ROUTERS --
import { handleInlineQuery } from "./Routes/inline.handler.js";
import { registerMenuHandlers } from "./Routes/menu.handler.js";
import { registerMonitorHandlers } from "./Routes/monitor.handler.js";
import { registerOperationsHandlers } from "./Routes/operations.handler.js";
import { handlePhotoMessage } from "./Routes/photo.handler.js";
import { registerSettingsHandlers } from "./Routes/settings.handler.js";
import { routeTextMessage } from "./Routes/text.handler.js";

// ==================== KEEPALIVE SERVER (CRITICAL FOR RENDER) ====================
const PORT = process.env.PORT || 3000;
http
	.createServer((_req, res) => {
		res.writeHead(200, { "Content-Type": "text/plain" });
		res.end("iFragmentBot Heartbeat: Active");
	})
	.listen(PORT, () => console.log(`🌍 Health Check server on port ${PORT}`));

// ==================== BOT INITIALIZATION ====================
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
	console.error("❌ FATAL: BOT_TOKEN is missing from environment!");
	process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN, {
	handlerTimeout: 150_000, // 2.5 min for heavy AI tasks
});

// Configure process-level safety
setupProcessHandlers();

// ==================== GLOBAL MIDDLEWARES ====================

// 1. Anti-Bot Filter (Sync/Fast)
bot.use(async (ctx, next) => {
	console.log(`📥 [Update] ${ctx.updateType} | ID: ${ctx.update.update_id} | User: ${ctx.from?.id || 'System'}`);
	if (ctx.from?.is_bot) return;
	return next();
});

// 2. BOOTSTRAP COMMANDS (High Priority, Skip DB if possible)
bot.command("ping", (ctx) => ctx.reply("Pong! ⚡"));
bot.start(async (ctx) => {
	console.log(`🚀 [Handler] START triggered for ${ctx.from.id}`);
	return sendDashboard(ctx, false);
});

// 3. User Hydration & Filters
bot.use(async (ctx, next) => {
	try {
		if (ctx.from && await isBlocked(ctx.from.id)) return;
	} catch (_e) {
		// If DB hangs, allow the message to continue in limited mode
	}
	return next();
});

// 4. Spam Protection (Local Memory)
bot.use(spamProtection.middleware());

bot.action("check_membership", async (ctx) => {
	const isMember = await isChannelMember(bot, ctx.from.id);
	if (isMember) {
		await ctx.answerCbQuery("✅ Access Granted!");
		return sendDashboard(ctx, true);
	}
	await ctx.answerCbQuery("❌ Please join @FragmentsCommunity first", {
		show_alert: true,
	});
	try {
		await ctx.deleteMessage();
	} catch (_e) {}
	return sendJoinChannelMessage(ctx);
});

// ==================== TELEGRAM CLIENT LAZY LOADER ====================
async function getTelegramClient() {
	try {
		const module = await import("../Shared/Infra/Telegram/telegram.client.js");
		return module;
	} catch (error) {
		console.warn("⚠️ Telegram Client module loading failed:", error.message);
		return null;
	}
}

// 2. HELP
bot.help((ctx) =>
	ctx.replyWithMarkdown(`
🌟 *${CONFIG.BOT_NAME} Intelligence*

- Send any @username for analysis.
- Paste a Gift Link for valuation.
- Use /panel for admin tools.
`),
);


// 4. GLOBAL MESSAGE ROUTING
bot.on("inline_query", (ctx) => handleInlineQuery(ctx));
bot.on("photo", (ctx) => handlePhotoMessage(ctx, bot));
bot.on("document", (ctx) => handleDocumentMessage(ctx, bot));
bot.on("text", (ctx, next) =>
	routeTextMessage(ctx, next, bot, getTelegramClient),
);

// ==================== BOOTSTRAP & LAUNCH ====================
async function launchBot() {
	try {
		await bootstrapServices(); // DB + User System
		await loadPersistentCache(); // Market Cache
		await initJobHandlers(bot); // Reports Queue
		startBackgroundUpdates(bot); // TON/888 Fetcher

		// 3. REGISTER MODULE HANDLERS
		registerAdminHandlers(bot, isAdmin);
		registerMonitorHandlers(bot);
		registerOperationsHandlers(bot);
		registerSettingsHandlers(bot);
		registerMenuHandlers(bot, isAdmin);
		registerFakePanelHandlers(bot, isAdmin);
		registerPanelHandlers(bot, isAdmin);
		registerAccountHandlers(bot);

		console.log("⏳ Clearing Webhook & Launching Polling...");
		await bot.telegram.deleteWebhook({ drop_pending_updates: true });
		
		// Explicit poll mode
		bot.launch({
			allowedUpdates: ['message', 'callback_query', 'inline_query', 'my_chat_member'],
			polling: {
				timeout: 30,
			}
		});
		
		console.log("🚀 iFragmentBot is Online & Polling!");

		bot.telegram.getMe().then(me => {
			console.log(`🤖 Bot identity: @${me.username} [ID: ${me.id}]`);
		});

		setupShutdownHandlers(bot);
	} catch (error) {
		console.error("💥 BOT BOOT LAUNCH FAILED:", error);
		process.exit(1);
	}
}

launchBot();

// Telegraf Global Catch
bot.catch((err, ctx) => ErrorHandler.handleBotError(err, ctx));
