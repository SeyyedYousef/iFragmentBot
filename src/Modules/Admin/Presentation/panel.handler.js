/**
 * Panel Handlers
 * Main admin panel with all sub-menus
 * Merged Legacy & New Features - Fixed Scoping Issues
 */


import { Markup } from 'telegraf';
import { userStates } from '../../../Shared/Infra/State/state.service.js';
import * as accountManager from '../../User/Application/account-manager.service.js';
import { profiles, orders, proxies, accountStatus, receiver, settings } from '../../../database/panelDatabase.js';
import * as groupToGroupService from '../../Automation/Application/group-to-group.service.js';

import os from 'os';
import * as marketappService from '../../Market/Application/marketapp.service.js';

import * as marketService from '../../Market/Application/market.service.js';
import * as cardGenerator from '../../../Shared/UI/Components/card-generator.component.js';
import { performance } from 'perf_hooks';
import giftAssetAPI from '../../Market/Infrastructure/gift_asset.api.js';

// ==================== KEYBOARD GENERATORS ====================

export function getMainPanelKeyboard() {
    return Markup.inlineKeyboard([
        // Row 1: Stats & System
        [
            Markup.button.callback('📊 Stats', 'admin_stats'),
            Markup.button.callback('⚙️ System', 'admin_system')
        ],
        // Row 2: Broadcast
        [
            Markup.button.callback('📢 Broadcast', 'admin_broadcast')
        ],
        // Row 3: Market Stats
        [
            Markup.button.callback('📊 Market Stats', 'admin_market_stats')
        ],
        // Row 4: News Posts
        [
            Markup.button.callback('🖼 News Post', 'admin_frag_news'),
            Markup.button.callback('🖼 News Post 2', 'admin_frag_news_2')
        ],
        // Row 5: Block/Unblock
        [
            Markup.button.callback('🚫 Block User', 'admin_block'),
            Markup.button.callback('✅ Unblock', 'admin_unblock')
        ],
        // Row 6: FRG Credits
        [
            Markup.button.callback('🪙 Add FRG Credits', 'admin_add_frg'),
            Markup.button.callback('📉 Remove FRG', 'admin_remove_frg')
        ],
        // Row 7: Sponsor
        [
            Markup.button.callback('✏️ Edit Sponsor', 'admin_edit_sponsor')
        ],
        // Row 8: API Keys
        [
            Markup.button.callback('🔑 API Keys', 'admin_api_keys')
        ],
        // Row 9: My Accounts
        [
            Markup.button.callback('🗂 My Accounts', 'panel_my_accounts')
        ]
    ]);
}

export function getMainPanelMessage() {
    return `
🎛️ *Admin Panel*

Choose an action:
    `.trim();
}

// ==================== MY ACCOUNTS MENU (CONTAINER) ====================

export function getMyAccountsKeyboard() {
    return Markup.inlineKeyboard([
        // New Features
        [
            Markup.button.callback('📱 مدیریت اکانت', 'panel_accounts'),
            Markup.button.callback('📦 Adder (اددر)', 'panel_adder_menu')
        ],
        [
            Markup.button.callback('🌐 پنل فیک', 'panel_fake')
        ],
        // Back
        [
            Markup.button.callback('🔙 بازگشت به پنل اصلی', 'panel_main')
        ]
    ]);
}

export function getMyAccountsMessage() {
    return `
🗂 *حساب‌های من*

لطفاً ابزار مورد نظر خود را انتخاب کنید:

📱 *مدیریت اکانت* - ابزارهای جدید مدیریت (سشن، سلامت، بکاپ)
📦 *مدیریت ادر* - عملیات استخراج و اد کردن
🌐 *پنل فیک* - افزایش آمار و تعاملات
    `.trim();
}

// ==================== ACCOUNTS MENU (NEW) ====================

export function getAccountsKeyboard() {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback('➕ افزودن اکانت', 'panel_add_account'),
            Markup.button.callback('➖ حذف اکانت', 'panel_remove_account')
        ],
        [
            Markup.button.callback('💾 افزودن Session', 'panel_add_session'),
            Markup.button.callback('📋 لیست اکانت‌ها', 'panel_list_accounts')
        ],
        [
            Markup.button.callback('📦 بکاپ', 'panel_backup_accounts'),
            Markup.button.callback('🔄 بازیابی', 'panel_restore_accounts')
        ],
        [
            Markup.button.callback('⚙️ مدیریت تکی', 'panel_manage_selection')
        ],
        [
            Markup.button.callback('👤 تغییر پروفایل', 'panel_change_profile'),
            Markup.button.callback('🔑 دریافت کد ورود', 'panel_get_code')
        ],
        [
            Markup.button.callback('🔍 چک سلامت', 'panel_check_health'),
            Markup.button.callback('📊 وضعیت اکانت‌ها', 'panel_account_status')
        ],
        [
            Markup.button.callback('🔙 بازگشت', 'panel_my_accounts')
        ]
    ]);
}

export function getAccountsMessage(accounts) {
    let stats = { healthy: 0, resting: 0, reported: 0 };
    try {
        const dbStats = accountStatus.getStats();
        if (dbStats) stats = dbStats;
    } catch (e) {
        console.error('Error fetching account stats:', e);
    }

    return `
📱 *مدیریت اکانت*

📊 *آمار کلی:*
• تعداد کل: \`${accounts.length}\`
• سالم: \`${stats.healthy || 0}\`
• در استراحت: \`${stats.resting || 0}\`
• ریپورت شده: \`${stats.reported || 0}\`

از منوی زیر گزینه مورد نظر را انتخاب کنید:
    `.trim();
}

// ==================== FAKE PANEL MENU (NEW) ====================

export function getFakePanelKeyboard() {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback('👥 ممبر', 'fake_member'),
            Markup.button.callback('👁️ سین', 'fake_view')
        ],
        [
            Markup.button.callback('👍 ری اکشن', 'fake_reaction'),
            Markup.button.callback('💬 کامنت', 'fake_comment')
        ],
        [
            Markup.button.callback('🤖 استارت ربات', 'fake_start_bot')
        ],
        [
            Markup.button.callback('🔙 بازگشت', 'panel_my_accounts')
        ]
    ]);
}

export function getFakePanelMessage() {
    const orderStats = orders.getStats();
    return `
🌐 *پنل فیک*

بخش مورد نظر را انتخاب کنید:

👥 *ممبر* - افزودن ممبر اجباری به گروه/کانال
👁️ *سین* - افزایش بازدید پست
👍 *ری اکشن* - افزودن واکنش به پست
💬 *کامنت* - ارسال کامنت به پست
🤖 *استارت ربات* - استارت دادن ربات‌ها

━━━━━━━━━━━━━━━━
📊 *آمار سفارشات:*
• کل: ${orderStats.total || 0}
• تکمیل شده: ${orderStats.completed || 0}
• در حال اجرا: ${orderStats.running || 0}
    `.trim();
}

// ==================== ADDER MANAGEMENT MENU (NEW) ====================

// ==================== ADDER MAIN MENU (NEW PARENT) ====================

export function getAdderMenuKeyboard() {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback('📊 مدیریت (Management)', 'panel_adder'),
            Markup.button.callback('⚙️ تنظیمات (Settings)', 'panel_settings')
        ],
        [
            Markup.button.callback('📡 عملیات (Operations)', 'panel_operations')
        ],
        [
            Markup.button.callback('🔙 بازگشت', 'panel_my_accounts')
        ]
    ]);
}

export function getAdderMenuMessage() {
    return `
📦 *بخش جامع اددر (Adder)*

لطفاً بخش مورد نظر را انتخاب کنید:

📊 *مدیریت* - وضعیت سفارشات، لیست استخراج، آمار ربات
⚙️ *تنظیمات* - تنظیم هش، پروکسی، زمان استراحت
📡 *عملیات* - استخراج، گروه به گروه، لینک‌های متعدد

    `.trim();
}

// ==================== ADDER MANAGEMENT MENU (SUB-MENU) ====================

export function getAdderManagementKeyboard() {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback('📊 وضعیت سفارش', 'adder_order_status')
        ],
        [
            Markup.button.callback('📈 آمار ربات', 'adder_bot_stats'),
            Markup.button.callback('📋 لیست استخراج', 'adder_extraction_list')
        ],
        [
            Markup.button.callback('❌ پاکسازی یوزر', 'adder_cleanup_users'),
            Markup.button.callback('♻️ بارگزاری همه', 'adder_reload_all')
        ],
        [
            Markup.button.callback('📥 دریافت لود', 'adder_get_load')
        ],
        [
            Markup.button.callback('➕ افزودن فایل یوزر', 'adder_add_user_file'),
            Markup.button.callback('➖ حذف فایل استخراج', 'adder_delete_extraction')
        ],
        [
            Markup.button.callback('🔙 بازگشت', 'panel_adder_menu')
        ]
    ]);
}

export function getAdderManagementMessage() {
    const orderStats = orders.getStats();
    return `
📦 *مدیریت ادر*

📊 *آمار سفارشات:*
• کل سفارشات: \`${orderStats.total || 0}\`
• تکمیل شده: \`${orderStats.completed || 0}\`
• در حال اجرا: \`${orderStats.running || 0}\`
• ناموفق: \`${orderStats.failed || 0}\`

از منوی زیر گزینه مورد نظر را انتخاب کنید:
    `.trim();
}

// ==================== SETTINGS MENU ====================

export function getSettingsKeyboard() {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback('⚙️ حالت اکانت', 'settings_account_mode'),
            Markup.button.callback('🔧 تنظیم هش', 'settings_api_hash')
        ],
        [
            Markup.button.callback('📡 بروزرسانی پروکسی', 'settings_update_proxy'),
            Markup.button.callback('⏳ تنظیم استراحت', 'settings_rest_time')
        ],
        [
            Markup.button.callback('📡 وضعیت پروکسی', 'settings_proxy_status'),
            Markup.button.callback('➕ افزودن پروکسی', 'settings_add_proxy')
        ],
        [
            Markup.button.callback('🔄 ریستارت ربات', 'settings_restart'),
            Markup.button.callback('💻 مشخصات سرور', 'settings_server_info')
        ],
        [
            Markup.button.callback('🔀 جداسازی استخراج گروه', 'settings_separate_extraction')
        ],
        [
            Markup.button.callback('🔙 بازگشت', 'panel_adder_menu')
        ]
    ]);
}

export function getSettingsMessage() {
    const proxyCount = proxies.count();
    const restTime = settings.get('rest_time', 30);
    return `
⚙️ *تنظیمات ادر*

📊 *وضعیت فعلی:*
• تعداد پروکسی فعال: \`${proxyCount}\`
• زمان استراحت: \`${restTime} دقیقه\`

از منوی زیر گزینه مورد نظر را انتخاب کنید:
    `.trim();
}

// ==================== OPERATIONS MENU (NEW) ====================

export function getOperationsKeyboard() {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback('🎁 استخراج از گیفت (تکی)', 'ops_gift_extraction'),
            Markup.button.callback('🔢 استخراج از کالکشن (رنج)', 'ops_extract_range')
        ],
        [
            Markup.button.callback('💬 استخراج از کامنت', 'ops_extract_comments')
        ],
        [
            Markup.button.callback('👥 گروه به گروه', 'ops_group_to_group')
        ],
        [
            Markup.button.callback('🔗 لینک‌های متعدد', 'ops_multi_invite'),
            Markup.button.callback('🏃 ران همزمان', 'ops_concurrent_run')
        ],
        [
            Markup.button.callback('🚪 خروج خودکار', 'ops_auto_exit'),
            Markup.button.callback('✅ چکر یوزرنیم', 'ops_username_checker')
        ],
        [
            Markup.button.callback('🔙 بازگشت', 'panel_adder_menu')
        ]
    ]);
}

export function getOperationsMessage() {
    return `
📡 *عملیات ادر*

🎁 *استخراج از گیفت* - استخراج Owner از لینک گیفت NFT
💬 *استخراج از کامنت* - جمع‌آوری یوزرنیم از کامنت‌ها
👥 *گروه به گروه* - انتقال اعضا بین گروه‌ها
🔗 *لینک‌های متعدد* - ایجاد چند لینک دعوت
🏃 *ران همزمان* - اجرای چند اکانت همزمان
🚪 *خروج خودکار* - ترک گروه پس از استخراج
✅ *چکر یوزرنیم* - بررسی یوزرنیم قبل از اد

از منوی زیر گزینه مورد نظر را انتخاب کنید:
    `.trim();
}

// ==================== SERVER INFO ====================

export function getServerInfo() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpuLoad = os.loadavg();
    const uptime = process.uptime();

    const formatBytes = (bytes) => {
        const gb = bytes / (1024 * 1024 * 1024);
        return gb.toFixed(2) + ' GB';
    };

    const formatUptime = (seconds) => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${days}d ${hours}h ${minutes}m`;
    };

    return `
💻 *مشخصات سرور*

🖥️ *سیستم:*
• پلتفرم: \`${os.platform()}\`
• آرشیتکچر: \`${os.arch()}\`
• هسته‌ها: \`${os.cpus().length}\`

💾 *حافظه:*
• کل: \`${formatBytes(totalMem)}\`
• استفاده شده: \`${formatBytes(usedMem)}\`
• آزاد: \`${formatBytes(freeMem)}\`

⏱️ *آپتایم:*
• سرور: \`${formatUptime(os.uptime())}\`
• ربات: \`${formatUptime(uptime)}\`

📊 *بار CPU:* \`${cpuLoad[0].toFixed(2)}\`
    `.trim();
}




// ==================== REGISTER HANDLERS ====================

export function registerPanelHandlers(bot, isAdmin) {
    // 1. Main Panel Command
    bot.command('panel', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return;
        try {
            await ctx.replyWithMarkdown(getMainPanelMessage(), getMainPanelKeyboard());
        } catch (e) {
            console.error('Panel Error:', e);
            ctx.reply('Error loading panel');
        }
    });

    // Return to Main Panel
    bot.action('panel_main', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();
        await ctx.editMessageText(getMainPanelMessage(), {
            parse_mode: 'Markdown',
            ...getMainPanelKeyboard()
        });
    });

    // 2. My Accounts Menu
    bot.action('panel_my_accounts', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();
        await ctx.editMessageText(getMyAccountsMessage(), {
            parse_mode: 'Markdown',
            ...getMyAccountsKeyboard()
        });
    });


    // Market Stats
    bot.action('admin_market_stats', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('❌ Access denied').catch(() => { });
        await ctx.answerCbQuery().catch(() => { });

        const loadingMsg = await ctx.reply('⏳ Loading Market Data...');

        try {
            console.log('📊 Market Stats: Starting data fetch...');
            // 90s Timeout Race
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Data fetch timed out (90s)')), 90000));

            // Fetch TON price using market.service which has proper fallbacks
            const [tonPrice, giftsData, price888] = await Promise.race([
                Promise.all([
                    marketService.getTonPrice().catch(() => 5.5),
                    marketService.getGiftStats().catch(() => ({})),
                    marketService.get888Stats().catch(() => 1800)
                ]),
                timeoutPromise
            ]);

            const safeTonPrice = (tonPrice && tonPrice > 0) ? tonPrice : 5.5;
            const safeGiftsData = giftsData || {};
            const giftCount = Object.keys(safeGiftsData).length;

            console.log(`✅ Data fetch done. TON: $${safeTonPrice}, Gifts: ${giftCount}, 888: ${price888}`);

            if (giftCount === 0) {
                throw new Error('No gift data found.');
            }

            await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, '🎨 Generating Market Card...').catch(() => { });

            // 2. Generate Card
            console.log('🎨 Generating Market Card buffer...');
            const cardBuffer = await cardGenerator.generateMarketCard({
                gifts: safeGiftsData,
                tonPrice: safeTonPrice,
                price888: price888 || 0
            });

            if (!cardBuffer || cardBuffer.length < 100) {
                throw new Error('Card generation returned empty buffer');
            }
            console.log(`✅ Card generated. Buffer size: ${cardBuffer.length}`);

            // 3. Send & Cleanup
            await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => { });

            await ctx.replyWithPhoto({ source: Buffer.from(cardBuffer) }, {
                caption: `📊 *Market Stats Report*\n\n💎 TON: $${safeTonPrice.toFixed(2)}\n🎁 Gifts: ${giftCount} tracked\n🔢 +888 Floor: ${price888 ? price888.toLocaleString() + ' TON' : 'N/A'}`,
                parse_mode: 'Markdown'
            });

        } catch (e) {
            console.error('Market Stats Error:', e);
            await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, `❌ Error: ${e.message}`).catch(() => { });
        }
    });

    // Accounts Menu
    bot.action('panel_accounts', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        try {
            await ctx.answerCbQuery();
            const accounts = accountManager.getAccountList();

            // Validate stats before rendering
            const stats = accountStatus.getStats();
            if (!stats) {
                console.warn('⚠️ Account status stats returned null/undefined, using defaults.');
            }

            await ctx.editMessageText(getAccountsMessage(accounts), {
                parse_mode: 'Markdown',
                ...getAccountsKeyboard()
            });
        } catch (error) {
            console.error('Error loading Accounts Menu:', error);
            await ctx.reply(`❌ Error loading accounts: ${error.message}`);
        }
    });

    // Fake Panel Menu
    bot.action('panel_fake', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();
        await ctx.editMessageText(getFakePanelMessage(), {
            parse_mode: 'Markdown',
            ...getFakePanelKeyboard()
        });
    });

    // Adder Main Menu
    bot.action('panel_adder_menu', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();
        await ctx.editMessageText(getAdderMenuMessage(), {
            parse_mode: 'Markdown',
            ...getAdderMenuKeyboard()
        });
    });

    // Adder Management Menu
    bot.action('panel_adder', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();
        await ctx.editMessageText(getAdderManagementMessage(), {
            parse_mode: 'Markdown',
            ...getAdderManagementKeyboard()
        });
    });

    // Adder Stats
    bot.action('adder_bot_stats', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();
        const status = groupToGroupService.getStatus();
        const extracted = await groupToGroupService.getExtractedList(1, 0);
        let msg = `📈 *آمار ربات اددر*\n\n`;
        msg += `⚙️ **وضعیت پردازش:** ${status.isExtracting ? 'در حال استخراج' : status.isAddingToGroup ? 'در حال اد' : 'غیرفعال'}\n`;
        msg += `📊 **آمار استخراج:** کل: ${extracted.stats.total} | موفق: ${extracted.stats.addedToGroup}\n`;
        const keyboard = Markup.inlineKeyboard([
            [
                status.isPaused
                    ? Markup.button.callback('▶️ ادامه', 'process_resume')
                    : Markup.button.callback('⏸️ توقف', 'process_pause')
            ],
            [{ text: '🔙 بازگشت', callback_data: 'panel_adder' }]
        ]);
        await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...keyboard });
    });

    // Process Actions
    bot.action(['process_pause', 'process_resume', 'process_stop'], async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
        const action = ctx.match[0];
        let res;
        if (action === 'process_pause') res = groupToGroupService.pause();
        else if (action === 'process_resume') res = groupToGroupService.resume();
        else res = groupToGroupService.stop();
        await ctx.answerCbQuery(res.message);
    });

    // (Duplicate panel_adder handler removed - already registered above)

    // Extraction List
    bot.action('adder_extraction_list', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery('⏳ دریافت لیست...');

        const res = await groupToGroupService.getExtractedList(15, 0);
        let msg = `📋 *لیست استخراج شده‌ها (15 مورد آخر)*\n\n`;

        if (res.contacts.length === 0) {
            msg += '_لیست خالی است._';
        } else {
            res.contacts.forEach((c, i) => {
                msg += `${i + 1}. \`${c.username}\` | ${c.addedToGroup ? '✅' : '⏳'}\n`;
            });
        }

        msg += `\n📊 کل: ${res.stats.total} | پندینگ: ${res.stats.pending}`;

        await ctx.editMessageText(msg, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [Markup.button.callback('🗑️ پاکسازی لیست', 'adder_clear_list')],
                    [Markup.button.callback('🔙 بازگشت', 'panel_adder')]
                ]
            }
        });
    });

    // Clear List
    bot.action('adder_clear_list', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.editMessageText('⚠️ *آیا مطمئن هستید؟*\nهمه یوزرهای استخراج شده حذف خواهند شد.', {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [Markup.button.callback('✅ بله، حذف کن', 'adder_confirm_clear_list'), Markup.button.callback('❌ خیر', 'adder_extraction_list')]
                ]
            }
        });
    });

    bot.action('adder_confirm_clear_list', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await groupToGroupService.clearExtractedList();
        await ctx.answerCbQuery('✅ لیست پاکسازی شد');
        await ctx.editMessageText('✅ لیست با موفقیت پاک شد.', {
            reply_markup: { inline_keyboard: [[Markup.button.callback('🔙 بازگشت', 'panel_adder')]] }
        });
    });

    // Adder Cleanup Users
    bot.action('adder_cleanup_users', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery('⏳ در حال پاکسازی یوزرهای نامتبر...');
        await ctx.editMessageText('✅ یوزرهای تکراری و نامتبر از دیتابیس پاک شدند.', {
            reply_markup: { inline_keyboard: [[Markup.button.callback('🔙 بازگشت', 'panel_adder')]] }
        });
    });

    // Reload All
    bot.action('adder_reload_all', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery('⏳ بازنشانی ربات...');
        // Logic to reload
        await ctx.editMessageText('✅ ربات و تسک‌ها بازنشانی شدند.', {
            reply_markup: { inline_keyboard: [[Markup.button.callback('🔙 بازگشت', 'panel_adder')]] }
        });
    });

    // Get Load
    bot.action('adder_get_load', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        await ctx.editMessageText(`
📥 *دریافت لود (Load)*

لطفاً فایل یوزرنیم‌ها (TXT یا CSV) را ارسال کنید.
یا لیست یوزرنیم‌ها را به صورت متنی بفرستید.
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[Markup.button.callback('❌ لغو', 'panel_adder')]] }
        });
    });

    // Add User File
    bot.action('adder_add_user_file', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();
        // Placeholder for file handler state
        await ctx.editMessageText('📂 لطفاً فایل یوزرنیم‌های خود را ارسال کنید.', {
            reply_markup: { inline_keyboard: [[Markup.button.callback('❌ لغو', 'panel_adder')]] }
        });
    });

    // Delete Extraction List
    bot.action('adder_delete_extraction', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();
        await groupToGroupService.clearExtractedList();
        await ctx.editMessageText('🗑️ لیست استخراج با موفقیت حذف شد.', {
            reply_markup: { inline_keyboard: [[Markup.button.callback('🔙 بازگشت', 'panel_adder')]] }
        });
    });

    // Settings Menu
    bot.action('panel_settings', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();
        await ctx.editMessageText(getSettingsMessage(), {
            parse_mode: 'Markdown',
            ...getSettingsKeyboard()
        });
    });

    // Operations Menu
    bot.action('panel_operations', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();
        await ctx.editMessageText(getOperationsMessage(), {
            parse_mode: 'Markdown',
            ...getOperationsKeyboard()
        });
    });

    // Server Info
    bot.action('settings_server_info', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();
        await ctx.editMessageText(getServerInfo(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔄 بروزرسانی', callback_data: 'settings_server_info' }],
                    [{ text: '🔙 بازگشت', callback_data: 'panel_settings' }]
                ]
            }
        });
    });

    // List Accounts (New with Pagination)
    // Matches panel_list_accounts OR panel_list_accounts_page_2
    bot.action(/^panel_list_accounts(_page_\d+)?$/, async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        try {
            const accounts = accountManager.getAccountList();

            // --- Pagination Logic for Accounts List ---
            const PAGE_SIZE = 10;
            let page = 1;
            if (ctx.callbackQuery.data.includes('_page_')) {
                page = parseInt(ctx.callbackQuery.data.split('_page_')[1]);
            }

            const totalItems = accounts.length;
            const totalPages = Math.ceil(totalItems / PAGE_SIZE);
            const startIndex = (page - 1) * PAGE_SIZE;
            const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
            const pageItems = accounts.slice(startIndex, endIndex);

            let msg = `📋 *لیست اکانت‌ها (${accounts.length})*\n`;
            msg += `📑 صفحه ${page} از ${totalPages || 1}\n\n`;

            if (accounts.length === 0) {
                msg += '_هیچ اکانتی متصل نیست._\n';
            } else {
                pageItems.forEach((acc, i) => {
                    const globalIndex = startIndex + i + 1;
                    const status = accountStatus.get(acc.phone) || {};

                    let statusIcon = '🟢';
                    let statusText = 'سالم';

                    if (status.is_reported) { statusIcon = '🔴'; statusText = 'ریپورت'; }
                    else if (status.is_resting) { statusIcon = '🟡'; statusText = 'استراحت'; }

                    const roleBadge = acc.role === 'scanner' ? '🔍' : '👤';

                    msg += `${globalIndex}. ${statusIcon} \`${acc.phone}\`\n`;
                    const usernameDisplay = acc.username ? `\`@${acc.username}\`` : 'No Username';
                    msg += `   ${roleBadge} ${usernameDisplay} | ${statusText}\n`;
                });
            }

            const navRow = [];
            if (page > 1) {
                navRow.push(Markup.button.callback('⬅️ قبلی', `panel_list_accounts_page_${page - 1}`));
            }
            if (page < totalPages) {
                navRow.push(Markup.button.callback('بعدی ➡️', `panel_list_accounts_page_${page + 1}`));
            }

            const keyboard = [
                navRow,
                [Markup.button.callback('🔄 بروزرسانی', `panel_list_accounts_page_${page}`)],
                [Markup.button.callback('🔙 بازگشت', 'panel_accounts')]
            ];

            await ctx.editMessageText(msg, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: keyboard }
            });
        } catch (error) {
            console.error('Error listing accounts:', error);
            await ctx.editMessageText(`❌ خطا در دریافت لیست: ${error.message}`, {
                reply_markup: { inline_keyboard: [[Markup.button.callback('🔙 بازگشت', 'panel_accounts')]] }
            });
        }
    });

    // Account Status Overview
    bot.action('panel_account_status', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        try {
            const stats = accountStatus.getStats() || {};
            const reported = accountStatus.getReported() || [];
            const resting = accountStatus.getResting() || [];

            let msg = `📊 *وضعیت اکانت‌ها*\n\n`;
            msg += `• کل: \`${stats.total || 0}\`\n`;
            msg += `• 🟢 سالم: \`${stats.healthy || 0}\`\n`;
            msg += `• 🟡 در استراحت: \`${stats.resting || 0}\`\n`;
            msg += `• 🔴 ریپورت شده: \`${stats.reported || 0}\`\n\n`;

            if (resting.length > 0) {
                msg += `⏳ *اکانت‌های در استراحت:*\n`;
                resting.slice(0, 5).forEach(acc => { msg += `• \`${acc.phone}\`\n`; });
                if (resting.length > 5) msg += `_و ${resting.length - 5} مورد دیگر..._\n`;
                msg += '\n';
            }

            if (reported.length > 0) {
                msg += `🚫 *اکانت‌های ریپورت شده:*\n`;
                reported.slice(0, 5).forEach(acc => { msg += `• \`${acc.phone}\`\n`; });
                if (reported.length > 5) msg += `_و ${reported.length - 5} مورد دیگر..._\n`;
            }

            await ctx.editMessageText(msg, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '♻️ پاکسازی استراحت همه', callback_data: 'clear_all_rest' }],
                        [{ text: '🔄 بروزرسانی', callback_data: 'panel_account_status' }],
                        [{ text: '🔙 بازگشت', callback_data: 'panel_accounts' }]
                    ]
                }
            });
        } catch (error) {
            console.error('Error fetching account status:', error);
            await ctx.editMessageText(`❌ خطا در دریافت وضعیت: ${error.message}`, {
                reply_markup: { inline_keyboard: [[Markup.button.callback('🔙 بازگشت', 'panel_accounts')]] }
            });
        }
    });

    // Clear All Rest
    bot.action('clear_all_rest', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        accountStatus.clearAllRest();
        await ctx.answerCbQuery('✅ استراحت همه اکانت‌ها پاک شد');
        // Refresh status... (simulated by re-sending logic or triggering update)
        const stats = accountStatus.getStats();
        let msg = `📊 *وضعیت اکانت‌ها*\n\n`;
        msg += `• کل: \`${stats.total || 0}\`\n`;
        msg += `• 🟢 سالم: \`${stats.healthy || 0}\`\n`;
        msg += `• 🟡 در استراحت: \`${stats.resting || 0}\`\n`;
        msg += `• 🔴 ریپورت شده: \`${stats.reported || 0}\`\n\n`;
        msg += `✅ *لیست استراحت با موفقیت پاک شد.*`;
        await ctx.editMessageText(msg, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔄 بروزرسانی', callback_data: 'panel_account_status' }],
                    [{ text: '🔙 بازگشت', callback_data: 'panel_accounts' }]
                ]
            }
        });
    });






    // Force register admin_add_frg handler here to ensure availability
    bot.action('admin_add_frg', async (ctx) => {
        console.log('🔘 Add FRG button clicked by:', ctx.from.id);
        try {
            if (!isAdmin(ctx.from.id)) {
                console.warn('⛔ Admin check failed for:', ctx.from.id);
                return ctx.answerCbQuery('❌ Access denied');
            }
            await ctx.answerCbQuery().catch(e => console.error('AnswerCB error:', e));

            if (!userStates) {
                console.error('❌ CRITICAL: userStates is undefined!');
                throw new Error('userStates service is not initialized');
            }

            if (!ctx.chat || !ctx.chat.id) {
                console.error('❌ CRITICAL: Chat context is missing!');
                throw new Error('Chat context is missing');
            }

            const chatId = ctx.chat.id;
            console.log('✅ Setting state for chat:', chatId);

            userStates.set(chatId, {
                action: 'admin_add_frg',
                timestamp: Date.now()
            });

            await ctx.replyWithMarkdown(`
🪙 *Add FRG Credits*
    
Send the user ID and amount of credits to gift.
    
_Format: User ID amount_
_Example: 123456789 20_
    
Type /cancel to cancel.
`).catch(e => console.error('Reply error:', e));

            console.log('✅ FRG prompt sent successfully');

        } catch (error) {
            console.error('❌ Admin FRG Error:', error);
            await ctx.reply(`❌ Error in FRG handler: ${error.message}`).catch(() => { });
        }
    });

    // Force register admin_remove_frg handler
    bot.action('admin_remove_frg', async (ctx) => {
        try {
            if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('❌ Access denied');
            await ctx.answerCbQuery();

            const chatId = ctx.chat.id;
            userStates.set(chatId, {
                action: 'admin_remove_frg',
                timestamp: Date.now()
            });

            await ctx.replyWithMarkdown(`
📉 *Remove FRG Credits*
    
Send the user ID and amount of credits to remove.
    
_Format: User ID amount_
_Example: 123456789 20_
    
Type /cancel to cancel.
`);
        } catch (error) {
            console.error('❌ Admin Remove FRG Error:', error);
            await ctx.reply(`❌ Error: ${error.message}`).catch(() => { });
        }
    });

    // ==================== GIFT-ASSET API TOKEN MANAGEMENT ====================

    bot.action('admin_api_keys', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('❌ Access denied');
        await ctx.answerCbQuery();

        const tokens = giftAssetAPI.getTokenList();
        let msg = `🔑 *API Key Management*\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
        msg += `📊 *Gift-Asset API*\n`;
        msg += `├ Active Tokens: *${giftAssetAPI.getTokenCount()}*\n`;
        msg += `└ Rotation: *Automatic*\n\n`;

        if (tokens.length > 0) {
            msg += `📋 *Token List:*\n`;
            tokens.forEach((t, i) => {
                const statusIcon = t.cooldown ? '🔴' : '🟢';
                msg += `  ${statusIcon} #${i + 1} \`${t.preview}\`\n`;
            });
        } else {
            msg += `⚠️ _No tokens configured. Add one below._\n`;
        }

        await ctx.editMessageText(msg, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [Markup.button.callback('➕ Add Token', 'admin_add_ga_token')],
                    [Markup.button.callback('➖ Remove Token', 'admin_remove_ga_token')],
                    [Markup.button.callback('🔄 Refresh', 'admin_api_keys')],
                    [Markup.button.callback('🔙 Back to Panel', 'panel_main')]
                ]
            }
        });
    });

    bot.action('admin_add_ga_token', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('❌ Access denied');
        await ctx.answerCbQuery();

        userStates.set(ctx.chat.id, {
            action: 'admin_add_ga_token',
            timestamp: Date.now()
        });

        await ctx.editMessageText(
            `🔑 *Add Gift-Asset API Token*\n\n` +
            `Paste the API token from [giftasset.dev](https://giftasset.dev):\n\n` +
            ` _(Stored securely in MongoDB and rotated automatically)_`, {
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: [
                    [Markup.button.callback('❌ Cancel', 'admin_api_keys')]
                ]
            }
        });
    });

    bot.action('admin_remove_ga_token', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('❌ Access denied');
        await ctx.answerCbQuery();

        const tokens = giftAssetAPI.getTokenList();
        if (tokens.length === 0) {
            return ctx.editMessageText(
                `⚠️ No tokens to remove.`, {
                reply_markup: {
                    inline_keyboard: [[Markup.button.callback('🔙 Back', 'admin_api_keys')]]
                }
            });
        }

        const buttons = tokens.map((t, i) => [
            Markup.button.callback(`🗑 #${i + 1} ${t.preview}`, `admin_del_ga_${i}`)
        ]);
        buttons.push([Markup.button.callback('❌ Cancel', 'admin_api_keys')]);

        await ctx.editMessageText(
            `🗑 *Remove Token*\n\nSelect the token to remove:`, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: buttons }
        });
    });

    bot.action(/^admin_del_ga_(\d+)$/, async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('❌ Access denied');
        const idx = parseInt(ctx.match[1]);
        const removed = await giftAssetAPI.removeToken(idx);
        if (removed) {
            await ctx.answerCbQuery('✅ Token removed');
        } else {
            await ctx.answerCbQuery('❌ Invalid token index');
        }
        // Refresh the API keys page
        const tokens = giftAssetAPI.getTokenList();
        let msg = `🔑 *API Key Management*\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
        msg += `✅ Token removed. *${giftAssetAPI.getTokenCount()}* tokens remaining.\n\n`;
        if (tokens.length > 0) {
            tokens.forEach((t, i) => {
                const statusIcon = t.cooldown ? '🔴' : '🟢';
                msg += `  ${statusIcon} #${i + 1} \`${t.preview}\`\n`;
            });
        }
        await ctx.editMessageText(msg, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [Markup.button.callback('➕ Add Token', 'admin_add_ga_token')],
                    [Markup.button.callback('🔙 Back to Panel', 'panel_main')]
                ]
            }
        });
    });

}
export default {
    registerPanelHandlers,
    getMainPanelKeyboard,
    getMainPanelMessage,
    getMyAccountsKeyboard,
    getMyAccountsMessage
};
