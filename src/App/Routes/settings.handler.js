/**
 * Settings Handlers
 * Handles settings and proxy management operations
 */

import { Markup } from 'telegraf';
import * as proxyManager from '../../Shared/Infra/Network/proxy-manager.service.js';
import { settings, accountStatus, proxies } from '../../database/panelDatabase.js';
import { userStates } from '../../Shared/Infra/State/state.service.js';
import os from 'os';

// ==================== REGISTER HANDLERS ====================

export function registerSettingsHandlers(bot, isAdmin) {

    // Proxy status
    bot.action('settings_proxy_status', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        const stats = proxyManager.getProxyStats();
        const allProxies = proxyManager.getAllProxies();

        let msg = `📡 *وضعیت پروکسی‌ها*\n\n`;
        msg += `📊 *آمار:*\n`;
        msg += `• کل: \`${stats.total}\`\n`;
        msg += `• فعال: \`${stats.active}\`\n`;
        msg += `• غیرفعال: \`${stats.inactive}\`\n\n`;

        if (allProxies.length > 0) {
            msg += `📋 *لیست پروکسی‌ها:*\n`;
            allProxies.slice(0, 10).forEach((p, i) => {
                const status = p.is_active ? '🟢' : '🔴';
                msg += `${i + 1}. ${status} ${p.type}://${p.host}:${p.port}\n`;
            });
            if (allProxies.length > 10) {
                msg += `_و ${allProxies.length - 10} مورد دیگر..._\n`;
            }
        } else {
            msg += `_هیچ پروکسی‌ای ثبت نشده_\n`;
        }

        await ctx.editMessageText(msg, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '➕ افزودن', callback_data: 'settings_add_proxy' },
                        { text: '🗑️ حذف همه', callback_data: 'settings_delete_all_proxies' }
                    ],
                    [{ text: '🔍 تست همه', callback_data: 'settings_test_proxies' }],
                    [{ text: '🛡️ وضعیت سلامت اکانت‌ها', callback_data: 'settings_health_guard' }],
                    [{ text: '🔙 بازگشت', callback_data: 'panel_settings' }]
                ]
            }
        });
    });

    // Health Guard Report
    bot.action('settings_health_guard', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery('⏳ محاسبه امتیاز سلامت...');

        const accounts = accountManager.getAccountList(); // List of simple objects
        let msg = `🛡️ *گزارش سلامت هوشمند*\n\n`;
        msg += `💡 امتیاز بر اساس سن اکانت و تکمیل بودن پروفایل محاسبه می‌شود.\n\n`;

        let secureCount = 0;
        let riskCount = 0;

        // processing in batches or just loop (assuming < 100 accounts usually)
        // We need to import healthGuardService dynamically or use the exposed method
        // Using exposed method from accountManager which wraps it (async import)

        // Since getHealthReport is per phone, we loop. 
        // Note: Ideally we should use a bulk method but loop is fine for <50

        const reports = [];
        for (const acc of accounts) {
            try {
                const report = await (await accountManager.getHealthReport(acc.phone));
                if (report) reports.push(report);
            } catch (e) { }
        }

        // Sort by score
        reports.sort((a, b) => b.score - a.score);

        reports.slice(0, 15).forEach(r => {
            msg += `${r.status} \`${r.phone}\`\n`;
            msg += `   ⭐️ امتیاز: ${r.score} | 🎯 لیمیت: ${r.limit}\n`;
            if (r.score > 70) secureCount++; else riskCount++;
        });

        if (reports.length > 15) msg += `\n_... و ${reports.length - 15} مورد دیگر_`;

        msg += `\n📊 امن: ${secureCount} | پرخطر: ${riskCount}`;

        await ctx.editMessageText(msg, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 بازگشت', callback_data: 'settings_proxy_status' }]
                ]
            }
        });
    });

    // Add proxy
    bot.action('settings_add_proxy', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        userStates.set(ctx.chat.id, { action: 'awaiting_proxy' });

        await ctx.editMessageText(`
➕ *افزودن پروکسی*

پروکسی‌ها را ارسال کنید (هر خط یک پروکسی):

فرمت‌های قابل قبول:
\`socks5://host:port\`
\`socks5://user:pass@host:port\`
\`host:port\` (پیش‌فرض: socks5)
\`host:port:user:pass\`
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ لغو', callback_data: 'settings_proxy_status' }]
                ]
            }
        });
    });

    // Update proxy
    bot.action('settings_update_proxy', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        const allProxies = proxyManager.getAllProxies();

        if (allProxies.length === 0) {
            return ctx.editMessageText('❌ هیچ پروکسی‌ای ثبت نشده.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '➕ افزودن پروکسی', callback_data: 'settings_add_proxy' }],
                        [{ text: '🔙 بازگشت', callback_data: 'panel_settings' }]
                    ]
                }
            });
        }

        const buttons = allProxies.slice(0, 8).map((p) => {
            const status = p.is_active ? '🟢' : '🔴';
            return [{
                text: `${status} ${p.host}:${p.port}`,
                callback_data: `toggle_proxy:${p.id}`
            }];
        });

        buttons.push([{ text: '🔙 بازگشت', callback_data: 'panel_settings' }]);

        await ctx.editMessageText(`
🔧 *تغییر وضعیت پروکسی*

برای فعال/غیرفعال کردن روی پروکسی کلیک کنید:
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: buttons }
        });
    });

    // Toggle proxy
    bot.action(/^toggle_proxy:(\d+)$/, async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');

        const proxyId = parseInt(ctx.match[1]);
        const proxy = proxyManager.getProxyById(proxyId);

        if (!proxy) {
            return ctx.answerCbQuery('❌ پروکسی یافت نشد');
        }

        const newState = !proxy.is_active;
        proxyManager.toggleProxy(proxyId, newState);

        await ctx.answerCbQuery(newState ? '✅ فعال شد' : '🔴 غیرفعال شد');

        // Refresh the list
        const allProxies = proxyManager.getAllProxies();
        const buttons = allProxies.slice(0, 8).map((p) => {
            const status = p.is_active ? '🟢' : '🔴';
            return [{
                text: `${status} ${p.host}:${p.port}`,
                callback_data: `toggle_proxy:${p.id}`
            }];
        });
        buttons.push([{ text: '🔙 بازگشت', callback_data: 'panel_settings' }]);

        await ctx.editMessageText(`
🔧 *تغییر وضعیت پروکسی*

برای فعال/غیرفعال کردن روی پروکسی کلیک کنید:
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: buttons }
        });
    });

    // Delete all proxies
    bot.action('settings_delete_all_proxies', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        await ctx.editMessageText(`
⚠️ *تأیید حذف*

آیا از حذف همه پروکسی‌ها مطمئن هستید؟
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ بله، حذف شود', callback_data: 'confirm_delete_proxies' },
                        { text: '❌ خیر', callback_data: 'settings_proxy_status' }
                    ]
                ]
            }
        });
    });

    // Register Proxy Cloud Menu
    bot.action('settings_proxy_cloud', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        let status = { isRunning: false, autoEnabled: false };
        try {
            status = await (await proxyManager.getScraperStatus());
        } catch (e) { }

        const autoIcon = status.autoEnabled ? '✅' : '🔴';
        const runningIcon = status.isRunning ? '⏳ در حال اجرا...' : 'آماده';

        await ctx.editMessageText(`
☁️ *پروکسی کلود (Proxy Cloud)*

دریافت خودکار پروکسی‌های سالم از سراسر اینترنت.

📊 *وضعیت سرویس:*
• وضعیت: \`${runningIcon}\`
• دانلود خودکار: \`${autoIcon}\`
• منابع فعال: \`${status.sources || 8}\`

با استفاده از این قابلیت، ربات به طور خودکار پروکسی‌های جدید را پیدا، تست و ذخیره می‌کند.
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🚀 دریافت سریع (همین حالا)', callback_data: 'proxy_cloud_scrape' }
                    ],
                    [
                        { text: '👻 حالت روح (Ghost Mode)', callback_data: 'settings_ghost_mode' }
                    ],
                    [
                        { text: status.autoEnabled ? '🔴 توقف دانلود خودکار' : '🟢 شروع دانلود خودکار', callback_data: 'proxy_cloud_toggle_auto' }
                    ],
                    [{ text: '🔙 بازگشت', callback_data: 'panel_settings' }]
                ]
            }
        });
    });

    // Trigger Manual Scrape
    bot.action('proxy_cloud_scrape', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');

        // Check if running
        const status = await (await proxyManager.getScraperStatus());
        if (status.isRunning) {
            return ctx.answerCbQuery('⚠️ عملیات در حال اجراست...');
        }

        await ctx.answerCbQuery('⏳ شروع عملیات دریافت...');

        // Start scraping in background
        proxyManager.scrapeProxies().then(async (result) => {
            const report = `
☁️ *گزارش دریافت پروکسی*

✅ وضعیت: ${result.status === 'success' ? 'موفق' : 'خطا'}
📥 دریافت شده: \`${result.fetched || 0}\`
🟢 سالم: \`${result.working || 0}\`
💾 ذخیره شده: \`${result.added || 0}\`
            `.trim();

            try {
                await ctx.reply(report, { parse_mode: 'Markdown' });
            } catch (e) { }
        });

        await ctx.editMessageText(`
🚀 *عملیات آغاز شد*

ربات در حال جستجو در اینترنت و تست پروکسی‌هاست...
این عملیات ممکن است چند دقیقه طول بکشد.
نتیجه نهایی ارسال خواهد شد.
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 بازگشت', callback_data: 'settings_proxy_cloud' }]
                ]
            }
        });
    });

    // Toggle Auto Scrape
    bot.action('proxy_cloud_toggle_auto', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');

        const status = await (await proxyManager.getScraperStatus());

        if (status.autoEnabled) {
            await (await proxyManager.stopAutoScraper());
            await ctx.answerCbQuery('🔴 دانلود خودکار غیرفعال شد');
        } else {
            // Default 60 mins
            await (await proxyManager.startAutoScraper(60));
            await ctx.answerCbQuery('🟢 دانلود خودکار فعال شد (هر ۱ ساعت)');
        }

        // Refresh menu
        const newStatus = await (await proxyManager.getScraperStatus());
        const autoIcon = newStatus.autoEnabled ? '✅' : '🔴';

        await ctx.editMessageText(`
☁️ *پروکسی کلود (Proxy Cloud)*

دریافت خودکار پروکسی‌های سالم از سراسر اینترنت.

📊 *وضعیت سرویس:*
• وضعیت: \`${newStatus.isRunning ? '⏳ در حال اجرا...' : 'آماده'}\`
• دانلود خودکار: \`${autoIcon}\`
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🚀 دریافت سریع (همین حالا)', callback_data: 'proxy_cloud_scrape' }
                    ],
                    [
                        { text: newStatus.autoEnabled ? '🔴 توقف دانلود خودکار' : '🟢 شروع دانلود خودکار', callback_data: 'proxy_cloud_toggle_auto' }
                    ],
                    [{ text: '🔙 بازگشت', callback_data: 'panel_settings' }]
                ]
            }
        });
    });



    // Ghost Mode Menu
    bot.action('settings_ghost_mode', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        let status = { isEnabled: false, interval: 15 };
        try {
            status = await (await proxyManager.getGhostStatus());
        } catch (e) { }

        const stateIcon = status.isEnabled ? '✅ فعال' : '🔴 غیرفعال';

        await ctx.editMessageText(`
👻 *حالت روح (Ghost Mode)*

در این حالت، اکانت‌ها به صورت خودکار فعالیت‌های انسانی انجام می‌دهند تا از بن شدن جلوگیری شود.

فعالیت‌ها:
• 👁️ بازدید از کانال‌ها
• 📜 اسکرول کردن پیام‌ها
• ⌨️ تایپ کردن (بدون ارسال)

وضعیت فعلی: \`${stateIcon}\`
فاصله زمانی: \`${status.interval} دقیقه\`
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: status.isEnabled ? '🔴 غیرفعال کردن' : '🟢 فعال کردن', callback_data: 'ghost_mode_toggle' }
                    ],
                    [
                        { text: '⏱️ تنظیم زمان (15 دقیقه)', callback_data: 'ghost_mode_set:15' },
                        { text: '⏱️ تنظیم زمان (60 دقیقه)', callback_data: 'ghost_mode_set:60' }
                    ],
                    [{ text: '🔙 بازگشت', callback_data: 'settings_proxy_cloud' }]
                ]
            }
        });
    });

    // Toggle Ghost Mode
    bot.action('ghost_mode_toggle', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');

        const status = await (await proxyManager.getGhostStatus());

        if (status.isEnabled) {
            await (await proxyManager.stopGhostMode());
            await ctx.answerCbQuery('🔴 حالت روح غیرفعال شد');
        } else {
            await (await proxyManager.startGhostMode(status.interval));
            await ctx.answerCbQuery('🟢 حالت روح فعال شد');
        }

        // Refresh menu (trigger settings_ghost_mode logic again)
        // For simplicity, we just send the message again or edit text similarly
        // But better to just call the function logic or edit text directly:

        const newStatus = await (await proxyManager.getGhostStatus());
        const stateIcon = newStatus.isEnabled ? '✅ فعال' : '🔴 غیرفعال';

        await ctx.editMessageText(`
👻 *حالت روح (Ghost Mode)*

در این حالت، اکانت‌ها به صورت خودکار فعالیت‌های انسانی انجام می‌دهند تا از بن شدن جلوگیری شود.

فعالیت‌ها:
• 👁️ بازدید از کانال‌ها
• 📜 اسکرول کردن پیام‌ها
• ⌨️ تایپ کردن (بدون ارسال)

وضعیت فعلی: \`${stateIcon}\`
فاصله زمانی: \`${newStatus.interval} دقیقه\`
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: newStatus.isEnabled ? '🔴 غیرفعال کردن' : '🟢 فعال کردن', callback_data: 'ghost_mode_toggle' }
                    ],
                    [
                        { text: '⏱️ تنظیم زمان (15 دقیقه)', callback_data: 'ghost_mode_set:15' },
                        { text: '⏱️ تنظیم زمان (60 دقیقه)', callback_data: 'ghost_mode_set:60' }
                    ],
                    [{ text: '🔙 بازگشت', callback_data: 'settings_proxy_cloud' }]
                ]
            }
        });
    });

    // Set Ghost Interval
    bot.action(/^ghost_mode_set:(\d+)$/, async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');

        const interval = parseInt(ctx.match[1]);
        await (await proxyManager.startGhostMode(interval));

        await ctx.answerCbQuery(`✅ زمان فعالیت: هر ${interval} دقیقه`);

        // Refresh menu
        const status = await (await proxyManager.getGhostStatus());
        const stateIcon = status.isEnabled ? '✅ فعال' : '🔴 غیرفعال';

        await ctx.editMessageText(`
👻 *حالت روح (Ghost Mode)*

در این حالت، اکانت‌ها به صورت خودکار فعالیت‌های انسانی انجام می‌دهند تا از بن شدن جلوگیری شود.

فعالیت‌ها:
• 👁️ بازدید از کانال‌ها
• 📜 اسکرول کردن پیام‌ها
• ⌨️ تایپ کردن (بدون ارسال)

وضعیت فعلی: \`${stateIcon}\`
فاصله زمانی: \`${status.interval} دقیقه\`
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: status.isEnabled ? '🔴 غیرفعال کردن' : '🟢 فعال کردن', callback_data: 'ghost_mode_toggle' }
                    ],
                    [
                        { text: '⏱️ تنظیم زمان (15 دقیقه)', callback_data: 'ghost_mode_set:15' },
                        { text: '⏱️ تنظیم زمان (60 دقیقه)', callback_data: 'ghost_mode_set:60' }
                    ],
                    [{ text: '🔙 بازگشت', callback_data: 'settings_proxy_cloud' }]
                ]
            }
        });
    });

    // Confirm delete all proxies
    bot.action('confirm_delete_proxies', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');

        proxyManager.deleteAllProxies();
        await ctx.answerCbQuery('✅ همه پروکسی‌ها حذف شدند');

        await ctx.editMessageText('✅ همه پروکسی‌ها حذف شدند.', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '➕ افزودن پروکسی', callback_data: 'settings_add_proxy' }],
                    [{ text: '🔙 بازگشت', callback_data: 'panel_settings' }]
                ]
            }
        });
    });

    // Test all proxies
    bot.action('settings_test_proxies', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery('⏳ در حال تست پروکسی‌ها...');

        const allProxies = proxyManager.getAllProxies();

        if (allProxies.length === 0) {
            return ctx.editMessageText('❌ هیچ پروکسی‌ای ثبت نشده.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 بازگشت', callback_data: 'settings_proxy_status' }]
                    ]
                }
            });
        }

        let msg = `🔍 *تست پروکسی‌ها*\n\n⏳ در حال تست...\n`;
        const testMsg = await ctx.editMessageText(msg, { parse_mode: 'Markdown' });

        const results = await proxyManager.testAllProxies();

        msg = `🔍 *نتایج تست پروکسی‌ها*\n\n`;

        let working = 0, failed = 0;

        for (const result of results) {
            if (result.success) {
                msg += `🟢 ${result.host}:${result.port} - ${result.latency}ms\n`;
                working++;
            } else {
                msg += `🔴 ${result.host}:${result.port} - ${result.error}\n`;
                failed++;
            }
        }

        msg += `\n📊 سالم: ${working} | خراب: ${failed}`;

        await ctx.editMessageText(msg, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔄 تست مجدد', callback_data: 'settings_test_proxies' }],
                    [{ text: '🔙 بازگشت', callback_data: 'settings_proxy_status' }]
                ]
            }
        });
    });

    // Rest time settings
    bot.action('settings_rest_time', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        const currentRestTime = settings.get('rest_time', 30);

        await ctx.editMessageText(`
⏳ *تنظیم زمان استراحت*

زمان فعلی: \`${currentRestTime} دقیقه\`

مدت زمان استراحت پس از فعالیت زیاد را انتخاب کنید:
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '15 دقیقه', callback_data: 'set_rest:15' },
                        { text: '30 دقیقه', callback_data: 'set_rest:30' },
                        { text: '60 دقیقه', callback_data: 'set_rest:60' }
                    ],
                    [
                        { text: '2 ساعت', callback_data: 'set_rest:120' },
                        { text: '4 ساعت', callback_data: 'set_rest:240' },
                        { text: '8 ساعت', callback_data: 'set_rest:480' }
                    ],
                    [{ text: '🔙 بازگشت', callback_data: 'panel_settings' }]
                ]
            }
        });
    });

    // Set rest time
    bot.action(/^set_rest:(\d+)$/, async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');

        const minutes = parseInt(ctx.match[1]);
        settings.set('rest_time', minutes);

        await ctx.answerCbQuery(`✅ زمان استراحت: ${minutes} دقیقه`);

        await ctx.editMessageText(`
✅ *زمان استراحت ذخیره شد*

مدت زمان جدید: \`${minutes} دقیقه\`
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 بازگشت', callback_data: 'panel_settings' }]
                ]
            }
        });
    });

    // Account mode
    bot.action('settings_account_mode', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        const mode = settings.get('account_mode', 'sequential');

        await ctx.editMessageText(`
⚙️ *حالت اکانت*

حالت فعلی: \`${mode === 'sequential' ? 'ترتیبی' : 'همزمان'}\`

• *ترتیبی:* اکانت‌ها به نوبت استفاده می‌شوند
• *همزمان:* چند اکانت همزمان کار می‌کنند
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: mode === 'sequential' ? '✅ ترتیبی' : 'ترتیبی', callback_data: 'set_mode:sequential' },
                        { text: mode === 'concurrent' ? '✅ همزمان' : 'همزمان', callback_data: 'set_mode:concurrent' }
                    ],
                    [{ text: '🔙 بازگشت', callback_data: 'panel_settings' }]
                ]
            }
        });
    });

    // Set account mode
    bot.action(/^set_mode:(sequential|concurrent)$/, async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');

        const mode = ctx.match[1];
        settings.set('account_mode', mode);

        await ctx.answerCbQuery(`✅ حالت: ${mode === 'sequential' ? 'ترتیبی' : 'همزمان'}`);

        // Refresh menu
        await ctx.editMessageText(`
✅ *حالت اکانت ذخیره شد*

حالت جدید: \`${mode === 'sequential' ? 'ترتیبی' : 'همزمان'}\`
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 بازگشت', callback_data: 'panel_settings' }]
                ]
            }
        });
    });

    // API Hash settings
    bot.action('settings_api_hash', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        const apiId = settings.get('api_id', 'تنظیم نشده');
        const apiHash = settings.get('api_hash', 'تنظیم نشده');

        await ctx.editMessageText(`
🔧 *تنظیم API ID/Hash*

مقادیر فعلی:
• API ID: \`${apiId}\`
• API Hash: \`${typeof apiHash === 'string' && apiHash.length > 6 ? apiHash.slice(0, 6) + '...' : apiHash}\`

برای تغییر، مقادیر جدید را ارسال کنید.
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📝 تنظیم مقادیر', callback_data: 'edit_api_settings' }],
                    [{ text: '🔙 بازگشت', callback_data: 'panel_settings' }]
                ]
            }
        });
    });

    // Edit API settings
    bot.action('edit_api_settings', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        userStates.set(ctx.chat.id, { action: 'awaiting_api_id' });

        await ctx.editMessageText(`
📝 *تنظیم API ID*

API ID را ارسال کنید (فقط عدد):
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ لغو', callback_data: 'settings_api_hash' }]
                ]
            }
        });
    });

    // Restart bot
    bot.action('settings_restart', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        await ctx.editMessageText(`
⚠️ *تأیید ریستارت*

آیا از ریستارت ربات مطمئن هستید؟
این عمل تمام عملیات در حال اجرا را متوقف می‌کند.
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ بله، ریستارت شود', callback_data: 'confirm_restart' },
                        { text: '❌ خیر', callback_data: 'panel_settings' }
                    ]
                ]
            }
        });
    });

    // Confirm restart
    bot.action('confirm_restart', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');

        await ctx.editMessageText('🔄 در حال ریستارت...');

        // Exit with code 0 - PM2/systemd will restart the process
        setTimeout(() => process.exit(0), 1000);
    });

    // Separate extraction
    bot.action('settings_separate_extraction', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        const separate = settings.get('separate_extraction', false);

        await ctx.editMessageText(`
🔀 *جداسازی استخراج گروه*

وضعیت فعلی: \`${separate ? 'فعال' : 'غیرفعال'}\`

با فعال کردن این گزینه، اعضای استخراج شده از هر گروه در فایل جداگانه ذخیره می‌شوند.
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: separate ? '✅ فعال' : 'فعال', callback_data: 'toggle_separate:1' },
                        { text: !separate ? '✅ غیرفعال' : 'غیرفعال', callback_data: 'toggle_separate:0' }
                    ],
                    [{ text: '🔙 بازگشت', callback_data: 'panel_settings' }]
                ]
            }
        });
    });

    // Toggle separate extraction
    bot.action(/^toggle_separate:([01])$/, async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');

        const enabled = ctx.match[1] === '1';
        settings.set('separate_extraction', enabled);

        await ctx.answerCbQuery(`✅ جداسازی: ${enabled ? 'فعال' : 'غیرفعال'}`);

        await ctx.editMessageText(`
✅ *تنظیمات ذخیره شد*

جداسازی استخراج: \`${enabled ? 'فعال' : 'غیرفعال'}\`
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 بازگشت', callback_data: 'panel_settings' }]
                ]
            }
        });
    });

    // Settings handlers registered
}

// ==================== TEXT MESSAGE HANDLERS ====================

export function handleSettingsTextMessage(ctx, state) {
    const text = ctx.message?.text;

    switch (state.action) {
        case 'awaiting_proxy':
            return handleProxyInput(ctx, text);
        case 'awaiting_api_id':
            return handleApiIdInput(ctx, text);
        case 'awaiting_api_hash':
            return handleApiHashInput(ctx, text, state);
        default:
            return false;
    }
}

async function handleProxyInput(ctx, text) {
    userStates.delete(ctx.chat.id);

    const result = proxyManager.addProxiesFromText(text);

    let msg = `📡 *نتیجه افزودن پروکسی*\n\n`;
    msg += `✅ موفق: ${result.success}\n`;
    msg += `❌ ناموفق: ${result.failed}\n`;

    if (result.errors.length > 0) {
        msg += `\n⚠️ خطاها:\n`;
        result.errors.slice(0, 5).forEach(e => {
            msg += `• ${e}\n`;
        });
    }

    await ctx.reply(msg, { parse_mode: 'Markdown' });
    return true;
}

async function handleApiIdInput(ctx, text) {
    const apiId = parseInt(text.trim());

    if (isNaN(apiId)) {
        await ctx.reply('❌ API ID باید عدد باشد.');
        return true;
    }

    settings.set('api_id', apiId);

    userStates.set(ctx.chat.id, { action: 'awaiting_api_hash', apiId });

    await ctx.reply(`
✅ API ID ذخیره شد: \`${apiId}\`

حالا API Hash را ارسال کنید:
    `.trim(), { parse_mode: 'Markdown' });

    return true;
}

async function handleApiHashInput(ctx, text, state) {
    const apiHash = text.trim();

    if (apiHash.length < 10) {
        await ctx.reply('❌ API Hash نامعتبر است.');
        return true;
    }

    settings.set('api_hash', apiHash);
    userStates.delete(ctx.chat.id);

    await ctx.reply(`
✅ *تنظیمات API ذخیره شد*

• API ID: \`${state.apiId}\`
• API Hash: \`${apiHash.slice(0, 6)}...\`
    `.trim(), { parse_mode: 'Markdown' });

    return true;
}

export default {
    registerSettingsHandlers,
    handleSettingsTextMessage
};
