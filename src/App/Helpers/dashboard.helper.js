/**
 * Dashboard & Initial State Orchestrator
 * Refactored v18.0 — Performance & Clean Management
 */

import { CONFIG } from "../../core/Config/app.config.js";
import * as marketService from "../../Modules/Market/Application/market.service.js";
import { getTonMarketStats } from "../../Modules/Market/Infrastructure/fragment.repository.js";
import { getRemainingLimits, getUser } from "../../Modules/User/Application/user.service.js";
import { tonPriceCache } from "../../Shared/Infra/Cache/cache.service.js";
import * as starsRepo from "../../Modules/Stars/Infrastructure/stars.repository.js";
import { formatPremiumHTML } from "../../Shared/Infra/Telegram/telegram.formatter.js";

// Import UI Helpers
import * as UI from "../Presentation/dashboard.ui.js";
import { getDashboardConfig, getTemplates } from "../../Shared/Infra/Database/settings.repository.js";
import { ensurePersonalWorkspace } from "../../Shared/Infra/Telegram/telegram.topics.js";
import { renderTemplate } from "../../Shared/Infra/Telegram/telegram.cms.js";

/**
 * Orchestrate dashboard rendering: Data fetching -> Formatting -> Delivery
 */
/**
 * Orchestrate dashboard rendering: Data fetching -> Formatting -> Delivery
 */
export async function sendDashboard(ctx, isEdit = false) {
    const userId = ctx.from.id;
    const name = ctx.from.first_name || "Trader";

    // 1. Parallel Core Data (Quick)
    const [config, templates, { credits }] = await Promise.all([
        getDashboardConfig(),
        getTemplates(),
        getRemainingLimits(userId)
    ]);

    // 2. Get pulse (might be stale)
    const marketData = getMarketPulse();
    const isStale = !marketData.tonPrice || (Date.now() - (tonPriceCache.get("marketStats")?.timestamp || 0) > 3600000);

    // 3. Build Initial Message
    const getMsg = (m) => renderTemplate(templates.start || UI.getDashboardMessage(name, m, credits), {
        FIRSTNAME: ctx.from.first_name,
        LASTNAME: ctx.from.last_name || "",
        USERNAME: ctx.from.username ? `@${ctx.from.username}` : "User",
        USERID: String(ctx.from.id),
        BOT_NAME: CONFIG.BOT_NAME,
        ...m,
        stars_ton: m.starsTon || "...",
        price_888: m.price888 ? `${m.price888.toLocaleString()} TON` : "Syncing...",
        ton_price: m.tonPrice ? m.tonPrice.toFixed(2) : "...",
        CREDITS: String(credits)
    });

    const message = getMsg(marketData);
    const keyboard = await UI.getDashboardKeyboard();
    const options = {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: keyboard.reply_markup,
    };

    let sentMsg = null;
    try {
        if (isEdit) {
            sentMsg = await ctx.editMessageText(message, options).catch(async (e) => {
                if (!e.message.includes("not modified")) return await ctx.reply(message, options);
            });
        } else {
            sentMsg = await ctx.reply(message, options);
        }

        // 🚀 LIVE-EDIT LOGIC (If data is old)
        if (isStale && sentMsg) {
            console.log("⚡ [Live-Edit] Stale data detected. Launching background refresh...");
            
            // Execute parallel scraping
            const [freshTon, fresh888] = await Promise.all([
                getTonMarketStats().catch(() => null),
                marketService.get888Stats().catch(() => null)
            ]);

            if (freshTon || fresh888) {
                console.log("💎 [Live-Edit] Data arrives! Updating dashboard...");
                
                // Update Cache
                if (freshTon) {
                    tonPriceCache.set("marketStats", { ...freshTon, timestamp: Date.now() });
                    tonPriceCache.set("price", freshTon.price);
                }
                if (fresh888) {
                    tonPriceCache.set("floor888", { price: fresh888, timestamp: Date.now() });
                }

                // Re-render and EDIT exactly the same message
                const freshMarket = getMarketPulse();
                const updatedMsg = getMsg(freshMarket);
                
                await ctx.telegram.editMessageText(ctx.chat.id, sentMsg.message_id, null, updatedMsg, options).catch(() => {});
            }
        }
    } catch (e) {
        console.error("Dashboard orchestration failed", e.message);
    }
}

// -------------------- DATA ORCHESTRATION --------------------

function getMarketPulse() {
    const ton = tonPriceCache.get("marketStats") || { price: CONFIG.LIVE_TON_PRICE || 7.2, change24h: 0, timestamp: 0 };
    const floor888 = tonPriceCache.get("floor888");

    return {
        tonPrice: ton.price,
        tonChange: ton.change24h,
        price888: floor888?.price,
        starsTon: tonPriceCache.get("starsPrice")?.price,
    };
}

async function updateUserDataInBackground(ctx) {
    const userId = ctx.from.id;
    const user = await getUser(userId);
    user.username = ctx.from.username;
    user.firstName = ctx.from.first_name;
}

