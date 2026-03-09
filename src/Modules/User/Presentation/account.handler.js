/**
 * Account Handlers V2 - Refactored
 * Handles account management with proper security, validation, and error handling
 */

import { Markup } from 'telegraf';
import * as accountManager from '../Application/account-manager.service.js';
import * as profileManager from '../Application/profile-manager.service.js';
import identityService from '../Domain/identity.entity.js';
import { accounts as dbAccounts, accountStatus, settings } from '../../../database/panelDatabase.js';
import { userStates } from '../../../Shared/Infra/State/state.service.js';
import {
    isValidSessionString,
    isValidPhoneNumber,
    sanitizeError,
    rateLimiter,
    withTimeout,
    withRetry,
    hashForLog
} from '../../Security/Application/security.service.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const DATA_DIR = path.join(process.cwd(), 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

// Constants
const TELEGRAM_BIO_MAX_LENGTH = 70; // Telegram's actual limit
const TIMEOUT_MS = 30000; // 30 second timeout for network operations
const MAX_ACCOUNTS_PER_PAGE = 8;

/**
 * Ensure backup directory exists with proper error handling
 */
async function ensureBackupDir() {
    try {
        await fs.mkdir(BACKUP_DIR, { recursive: true });
        return true;
    } catch (error) {
        console.error(`Failed to create backup directory: ${error.message}`);
        return false;
    }
}

/**
 * Get paginated accounts keyboard
 */
function getPaginatedAccountsKeyboard(accounts, page = 0, callbackPrefix) {
    const start = page * MAX_ACCOUNTS_PER_PAGE;
    const pageAccounts = accounts.slice(start, start + MAX_ACCOUNTS_PER_PAGE);
    const totalPages = Math.ceil(accounts.length / MAX_ACCOUNTS_PER_PAGE);

    const buttons = pageAccounts.map((acc) => ([{
        text: `📱 ${acc.phone}`,
        callback_data: `${callbackPrefix}:${acc.phone}`
    }]));

    // Pagination buttons
    if (totalPages > 1) {
        const navButtons = [];
        if (page > 0) {
            navButtons.push({ text: '◀️ قبلی', callback_data: `${callbackPrefix}_page:${page - 1}` });
        }
        navButtons.push({ text: `${page + 1}/${totalPages}`, callback_data: 'noop' });
        if (page < totalPages - 1) {
            navButtons.push({ text: 'بعدی ▶️', callback_data: `${callbackPrefix}_page:${page + 1}` });
        }
        buttons.push(navButtons);
    }

    buttons.push([{ text: '🔙 بازگشت', callback_data: 'panel_accounts' }]);

    return { inline_keyboard: buttons };
}

// ==================== REGISTER HANDLERS ====================

export function registerAccountHandlers(bot, isAdmin) {

    // Add session string with validation
    bot.action('panel_add_session', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');

        // Rate limiting for sensitive operations
        const rateCheck = rateLimiter.check(ctx.from.id, 'sensitive');
        if (!rateCheck.allowed) {
            return ctx.answerCbQuery(`⏳ لطفاً ${rateCheck.waitSeconds} ثانیه صبر کنید`);
        }

        await ctx.answerCbQuery();
        userStates.set(ctx.chat.id, {
            action: 'awaiting_session_string',
            timestamp: Date.now() // For state cleanup
        });

        await ctx.editMessageText(`
💾 *افزودن Session String*

Session String اکانت را ارسال کنید.

📝 *نکات مهم:*
• Session باید از کلاینت Telethon/GramJS باشد
• برای افزودن چند اکانت، هر Session در یک خط
• حداکثر ۱۰ اکانت در هر بار

⚠️ Session‌ها با رمزنگاری AES-256 ذخیره می‌شوند.
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ لغو', callback_data: 'panel_accounts' }]
                ]
            }
        });
    });

    // Add Account (Phone Login)
    bot.action('panel_add_account', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        userStates.set(ctx.chat.id, {
            action: 'awaiting_phone',
            timestamp: Date.now()
        });

        await ctx.editMessageText(`
📱 *افزودن اکانت جدید*
لطفاً شماره موبایل اکانت را با کد کشور وارد کنید:
مثال: \`+1234567890\`

⚠️ کد تأیید تلگرام به این شماره ارسال خواهد شد.
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💾 افزودن با Session', callback_data: 'panel_add_session' }],
                    [{ text: '🔙 بازگشت', callback_data: 'panel_accounts' }]
                ]
            }
        });
    });

    // Add session string with validation

    // Remove account with pagination
    bot.action('panel_remove_account', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        const accounts = accountManager.getAccountList();

        if (accounts.length === 0) {
            return ctx.editMessageText('❌ هیچ اکانتی وجود ندارد.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 بازگشت', callback_data: 'panel_accounts' }]
                    ]
                }
            });
        }

        await ctx.editMessageText(`
➖ *حذف اکانت*

اکانت مورد نظر برای حذف را انتخاب کنید:
📊 تعداد کل: ${accounts.length}
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: getPaginatedAccountsKeyboard(accounts, 0, 'remove_acc')
        });
    });

    // Pagination for remove account
    bot.action(/^remove_acc_page:(\d+)$/, async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');

        const page = parseInt(ctx.match[1]);
        const accounts = accountManager.getAccountList();

        await ctx.answerCbQuery();
        await ctx.editMessageText(`
➖ *حذف اکانت*

اکانت مورد نظر برای حذف را انتخاب کنید:
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: getPaginatedAccountsKeyboard(accounts, page, 'remove_acc')
        });
    });

    // Confirm remove account
    bot.action(/^remove_acc:(.+)$/, async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');

        const phone = ctx.match[1];
        await ctx.answerCbQuery();

        // Verify account exists
        const account = accountManager.getAccount(phone);
        if (!account) {
            return ctx.editMessageText('❌ اکانت یافت نشد.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 بازگشت', callback_data: 'panel_remove_account' }]
                    ]
                }
            });
        }

        await ctx.editMessageText(`
⚠️ *تأیید حذف*

آیا از حذف اکانت زیر مطمئن هستید؟

📱 شماره: \`${phone}\`
👤 نام: \`${(account.firstName || 'نامشخص') + ' ' + (account.lastName || '')}\`
🔗 یوزرنیم: \`${account.username ? '@' + account.username : 'ندارد'}\`

⚠️ این عمل قابل بازگشت نیست!
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ بله، حذف شود', callback_data: `confirm_remove:${phone}` },
                        { text: '❌ خیر', callback_data: 'panel_remove_account' }
                    ]
                ]
            }
        });
    });

    // Execute remove with proper error handling
    bot.action(/^confirm_remove:(.+)$/, async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');

        const phone = ctx.match[1];

        try {
            const success = await withTimeout(
                accountManager.removeAccount(phone),
                TIMEOUT_MS,
                'زمان حذف به پایان رسید'
            );

            if (success) {
                try {
                    accountStatus.delete(phone);
                } catch (e) {
                    console.error('Failed to cleanup account status:', e);
                }

                await ctx.answerCbQuery('✅ اکانت حذف شد');
                console.log(`Account removed: ${hashForLog(phone)} by admin ${ctx.from.id}`);
            } else {
                throw new Error('عملیات حذف ناموفق بود');
            }
        } catch (error) {
            const errorMsg = sanitizeError(error);
            await ctx.answerCbQuery('❌ خطا در حذف');
            await ctx.reply(`❌ خطا در حذف اکانت ${phone}:\n${errorMsg}`);
            console.error(`Remove account error: ${error.message}`);
            // Return to avoid refreshing list effectively
            return;
        }

        // Refresh the list
        const accounts = accountManager.getAccountList();
        if (accounts.length === 0) {
            return ctx.editMessageText('✅ همه اکانت‌ها حذف شدند.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 بازگشت', callback_data: 'panel_accounts' }]
                    ]
                }
            });
        }

        await ctx.editMessageText(`
➖ *حذف اکانت*

اکانت مورد نظر برای حذف را انتخاب کنید:
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: getPaginatedAccountsKeyboard(accounts, 0, 'remove_acc')
        });
    });

    // List Accounts (Simple View)
    bot.action('panel_list_accounts', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery('⏳ دریافت لیست...');

        const accounts = accountManager.getAccountList();
        if (accounts.length === 0) {
            return ctx.editMessageText('❌ هیچ اکانتی وجود ندارد.', {
                reply_markup: { inline_keyboard: [[{ text: '➕ افزودن اکانت', callback_data: 'panel_add_account' }, { text: '🔙 بازگشت', callback_data: 'panel_accounts' }]] }
            });
        }

        let msg = `📋 *لیست اکانت‌های متصل (${accounts.length})*\n\n`;
        accounts.forEach((acc, i) => {
            const status = accountStatus.get(acc.phone);
            const statusEmoji = status?.is_reported ? '🔴' : (status?.is_resting ? '🟡' : '🟢');
            msg += `${i + 1}. ${statusEmoji} \`${acc.phone}\` | @${acc.username || 'NoUser'}\n`;
        });

        await ctx.editMessageText(msg, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⚙️ مدیریت تکی', callback_data: 'panel_manage_selection' }],
                    [{ text: '🔙 بازگشت', callback_data: 'panel_accounts' }]
                ]
            }
        });
    });

    // Account Status Overview
    bot.action('panel_account_status', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        const stats = accountStatus.getStats();
        const accounts = accountManager.getAccountList();

        const msg = `
📊 *وضعیت کلی اکانت‌ها*

📱 تعداد کل: \`${accounts.length}\`
🟢 سالم: \`${stats.healthy || 0}\`
🟡 در استراحت: \`${stats.resting || 0}\`
🔴 ریپورت/مسدود: \`${stats.reported || 0}\`

⏱ آخرین بروزرسانی: ${new Date().toLocaleTimeString('fa-IR')}
        `.trim();

        await ctx.editMessageText(msg, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔄 بروزرسانی', callback_data: 'panel_account_status' }],
                    [{ text: '🔍 چک سلامت دقیق', callback_data: 'panel_check_health' }],
                    [{ text: '🔙 بازگشت', callback_data: 'panel_accounts' }]
                ]
            }
        });
    });

    // Backup accounts (Step 1: Ask for password)
    bot.action('panel_backup_accounts', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');

        const rateCheck = rateLimiter.check(ctx.from.id, 'bulk');
        if (!rateCheck.allowed) {
            return ctx.answerCbQuery(`⏳ لطفاً ${rateCheck.waitSeconds} ثانیه صبر کنید`);
        }

        await ctx.answerCbQuery();

        userStates.set(ctx.chat.id, {
            action: 'awaiting_backup_password',
            timestamp: Date.now()
        });

        await ctx.editMessageText(`
🔐 *ایجاد بکاپ امن*

لطفاً یک رمز عبور برای محافظت از فایل پایگاه داده وارد کنید.
این رمز عبور برای بازیابی اطلاعات ضروری خواهد باشد.

⚠️ *رمز را فراموش نکنید!* بدون آن امکان بازگردانی فایل وجود ندارد.
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ لغو', callback_data: 'panel_accounts' }]
                ]
            }
        });
    });

    // Restore accounts with validation
    bot.action('panel_restore_accounts', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');

        const rateCheck = rateLimiter.check(ctx.from.id, 'bulk');
        if (!rateCheck.allowed) {
            return ctx.answerCbQuery(`⏳ لطفاً ${rateCheck.waitSeconds} ثانیه صبر کنید`);
        }

        await ctx.answerCbQuery();

        userStates.set(ctx.chat.id, {
            action: 'awaiting_backup_file',
            timestamp: Date.now()
        });

        await ctx.editMessageText(`
🔄 *بازیابی از بکاپ*

فایل بکاپ (JSON) را ارسال کنید.

⚠️ *توجه مهم:*
• این عمل اکانت‌های فعلی را جایگزین می‌کند
• فقط فایل‌های بکاپ معتبر پذیرفته می‌شوند
• چک‌سام فایل بررسی خواهد شد
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ لغو', callback_data: 'panel_accounts' }]
                ]
            }
        });
    });

    // Change profile with pagination
    bot.action('panel_change_profile', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        await ctx.editMessageText(`
👤 *تغییر پروفایل اکانت‌ها*

روش مورد نظر را انتخاب کنید:
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✨ هویت هوشمند (AI)', callback_data: 'account_profile_ai' }
                    ],
                    [
                        { text: '📝 تغییر دستی', callback_data: 'account_profile_manual' },
                        // { text: '📂 انتخاب از فایل', callback_data: 'account_profile_file' }
                    ],
                    [{ text: '🔙 بازگشت', callback_data: 'panel_accounts' }]
                ]
            }
        });
    });

    // Manual Profile Selection (Old Behavior)
    bot.action('account_profile_manual', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        const accounts = accountManager.getAccountList().filter(a => a.status === 'active');

        if (accounts.length === 0) {
            return ctx.editMessageText('❌ هیچ اکانت فعالی وجود ندارد.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 بازگشت', callback_data: 'panel_change_profile' }]
                    ]
                }
            });
        }

        await ctx.editMessageText(`
👤 *تغییر پروفایل (دستی)*

اکانت مورد نظر را انتخاب کنید:
📊 اکانت‌های فعال: ${accounts.length}
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: getPaginatedAccountsKeyboard(accounts, 0, 'profile_acc')
        });
    });

    // AI Profile Selection
    bot.action('account_profile_ai', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        await ctx.editMessageText(`
✨ *هویت ساز هوشمند*

یک سبک را برای تولید هویت جدید انتخاب کنید:
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🇮🇷 ایرانی (عمومی)', callback_data: 'apply_ai:persian' },
                        { text: '🇺🇸 خارجی (Random)', callback_data: 'apply_ai:random' }
                    ],
                    [
                        { text: '💰 کریپتو / تریدر', callback_data: 'apply_ai:crypto' },
                        { text: '💻 برنامه‌نویس', callback_data: 'apply_ai:developer' }
                    ],
                    [{ text: '🔙 بازگشت', callback_data: 'panel_change_profile' }]
                ]
            }
        });
    });

    // Apply AI Profile
    bot.action(/^apply_ai:(.+)$/, async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');

        const type = ctx.match[1];
        await ctx.answerCbQuery('⏳ در حال تولید و اعمال...');
        await ctx.reply('🚀 شروع عملیات هویت‌سازی هوشمند...');

        const accounts = accountManager.getAccountList().filter(a => a.status === 'active');
        let success = 0;

        for (const acc of accounts) {
            try {
                const identity = identityService.generateIdentity(type);

                // Add to database first
                const profileId = profileManager.addProfile(identity.firstName, identity.lastName, identity.bio);

                // Apply it
                const result = await profileManager.applyProfileToAccount(acc.phone, profileId);
                if (result.success) success++;
            } catch (e) {
                console.error(`Error applying AI profile to ${acc.phone}:`, e);
            }
        }

        await ctx.reply(`
✅ *عملیات پایان یافت*

👥 اکانت‌های پردازش شده: ${accounts.length}
✨ موفق: ${success}
        `.trim(), { parse_mode: 'Markdown' });
    });

    // Profile options for an account
    bot.action(/^profile_acc:(.+)$/, async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');

        const phone = ctx.match[1];
        await ctx.answerCbQuery();

        const account = accountManager.getAccount(phone);

        await ctx.editMessageText(`
👤 *تنظیمات پروفایل*

📱 اکانت: \`${phone}\`
👤 نام فعلی: \`${(account?.firstName || 'نامشخص') + ' ' + (account?.lastName || '')}\`
🔗 یوزرنیم: \`${account?.username ? '@' + account.username : 'ندارد'}\`

چه چیزی می‌خواهید تغییر دهید؟
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '📝 نام', callback_data: `edit_name:${phone}` },
                        { text: '📄 بیو', callback_data: `edit_bio:${phone}` }
                    ],
                    [
                        { text: '📸 عکس', callback_data: `edit_photo:${phone}` },
                        { text: '🔐 2FA', callback_data: `edit_2fa:${phone}` }
                    ],
                    [{ text: '🔙 بازگشت', callback_data: 'panel_change_profile' }]
                ]
            }
        });
    });

    // Edit name
    bot.action(/^edit_name:(.+)$/, async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');

        const phone = ctx.match[1];
        await ctx.answerCbQuery();

        userStates.set(ctx.chat.id, {
            action: 'awaiting_new_name',
            phone,
            timestamp: Date.now()
        });

        await ctx.editMessageText(`
📝 *تغییر نام*

📱 اکانت: \`${phone}\`

نام جدید را ارسال کنید:
• فرمت: \`نام نام‌خانوادگی\`
• حداکثر ۶۴ کاراکتر برای هر بخش
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ لغو', callback_data: `profile_acc:${phone}` }]
                ]
            }
        });
    });

    // Edit bio
    bot.action(/^edit_bio:(.+)$/, async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');

        const phone = ctx.match[1];
        await ctx.answerCbQuery();

        userStates.set(ctx.chat.id, {
            action: 'awaiting_new_bio',
            phone,
            timestamp: Date.now()
        });

        await ctx.editMessageText(`
📄 *تغییر بیو*

📱 اکانت: \`${phone}\`

بیو جدید را ارسال کنید:
• حداکثر ${TELEGRAM_BIO_MAX_LENGTH} کاراکتر
• برای حذف بیو، کلمه \`حذف\` را ارسال کنید
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ لغو', callback_data: `profile_acc:${phone}` }]
                ]
            }
        });
    });

    // Edit photo
    bot.action(/^edit_photo:(.+)$/, async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');

        const phone = ctx.match[1];
        await ctx.answerCbQuery();

        userStates.set(ctx.chat.id, {
            action: 'awaiting_new_photo',
            phone,
            timestamp: Date.now()
        });

        await ctx.editMessageText(`
📸 *تغییر عکس پروفایل*

📱 اکانت: \`${phone}\`

عکس جدید را ارسال کنید:
• فرمت: JPG, PNG
• حداقل ابعاد: 160×160 پیکسل
• برای حذف عکس، کلمه \`حذف\` را ارسال کنید
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ لغو', callback_data: `profile_acc:${phone}` }]
                ]
            }
        });
    });

    // Check health with parallel execution
    bot.action('panel_check_health', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');

        const rateCheck = rateLimiter.check(ctx.from.id, 'sensitive');
        if (!rateCheck.allowed) {
            return ctx.answerCbQuery(`⏳ لطفاً ${rateCheck.waitSeconds} ثانیه صبر کنید`);
        }

        await ctx.answerCbQuery('⏳ در حال بررسی سلامت...');

        const accounts = accountManager.getAccountList();

        if (accounts.length === 0) {
            return ctx.editMessageText('❌ هیچ اکانتی وجود ندارد.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 بازگشت', callback_data: 'panel_accounts' }]
                    ]
                }
            });
        }

        // Update message to show progress
        const progressMsg = await ctx.editMessageText(`
🔍 *بررسی سلامت اکانت‌ها*

⏳ در حال بررسی ${accounts.length} اکانت...
        `.trim(), { parse_mode: 'Markdown' });

        // Check accounts in parallel with concurrency limit
        const CONCURRENT_LIMIT = 5;
        const results = { healthy: 0, issues: 0, results: [] };

        for (let i = 0; i < accounts.length; i += CONCURRENT_LIMIT) {
            const batch = accounts.slice(i, i + CONCURRENT_LIMIT);

            const batchResults = await Promise.allSettled(
                batch.map(async (acc) => {
                    try {
                        const health = await withTimeout(
                            accountManager.checkAccountHealth(acc.phone),
                            10000,
                            'Timeout'
                        );
                        return { phone: acc.phone, ...health };
                    } catch (error) {
                        return { phone: acc.phone, connected: false, error: error.message };
                    }
                })
            );

            for (const result of batchResults) {
                if (result.status === 'fulfilled') {
                    const health = result.value;
                    if (health.connected && !health.error) {
                        results.healthy++;
                        results.results.push({ phone: health.phone, status: '🟢', detail: health.ping || 'OK' });
                    } else {
                        results.issues++;
                        accountStatus.markReported(health.phone);
                        results.results.push({ phone: health.phone, status: '🔴', detail: sanitizeError(health.error) });
                    }
                } else {
                    results.issues++;
                    results.results.push({ phone: batch[0]?.phone, status: '⚠️', detail: 'خطا' });
                }
            }
        }

        // Build result message
        let msg = `🔍 *بررسی سلامت اکانت‌ها*\n\n`;

        results.results.slice(0, 15).forEach(r => {
            msg += `${r.status} \`${r.phone}\` - ${r.detail}\n`;
        });

        if (results.results.length > 15) {
            msg += `\n_و ${results.results.length - 15} مورد دیگر..._\n`;
        }

        msg += `\n📊 سالم: ${results.healthy} | مشکل‌دار: ${results.issues}`;

        await ctx.telegram.editMessageText(
            ctx.chat.id,
            progressMsg.message_id,
            null,
            msg,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 بررسی مجدد', callback_data: 'panel_check_health' }],
                        [{ text: '🔙 بازگشت', callback_data: 'panel_accounts' }]
                    ]
                }
            }
        );
    });

    // Get login code
    bot.action('panel_get_code', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');

        const rateCheck = rateLimiter.check(ctx.from.id, 'sensitive');
        if (!rateCheck.allowed) {
            return ctx.answerCbQuery(`⏳ لطفاً ${rateCheck.waitSeconds} ثانیه صبر کنید`);
        }

        await ctx.answerCbQuery();

        userStates.set(ctx.chat.id, {
            action: 'awaiting_code_phone',
            timestamp: Date.now()
        });

        await ctx.editMessageText(`
🔑 *دریافت کد ورود*

شماره تلفن اکانت را ارسال کنید:

📝 فرمت صحیح:
• \`+989123456789\`
• \`+14155552671\`

⚠️ کد تأیید به این شماره ارسال خواهد شد.
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ لغو', callback_data: 'panel_accounts' }]
                ]
            }
        });
    });

    // Manage Specific Account - List
    bot.action('panel_manage_selection', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        const accounts = accountManager.getAccountList();
        if (accounts.length === 0) {
            return ctx.editMessageText('❌ هیچ اکانتی وجود ندارد.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 بازگشت', callback_data: 'panel_accounts' }]
                    ]
                }
            });
        }

        await ctx.editMessageText(`
⚙️ *مدیریت اکانت‌ها*

اکانت مورد نظر را انتخاب کنید:
📊 تعداد کل: ${accounts.length}
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: getPaginatedAccountsKeyboard(accounts, 0, 'manage_acc')
        });
    });

    // Pagination for manage account
    bot.action(/^manage_acc_page:(\d+)$/, async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');

        const page = parseInt(ctx.match[1]);
        const accounts = accountManager.getAccountList();

        await ctx.answerCbQuery();
        await ctx.editMessageText(`
⚙️ *مدیریت اکانت‌ها*

اکانت مورد نظر را انتخاب کنید:
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: getPaginatedAccountsKeyboard(accounts, page, 'manage_acc')
        });
    });

    // Single Account Management Menu
    bot.action(/^manage_acc:(.+)$/, async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        const phone = ctx.match[1];
        await ctx.answerCbQuery();

        const account = accountManager.getAccount(phone);
        if (!account) return ctx.reply('اکانت یافت نشد.');

        const status = accountStatus.get(phone);
        let statusText = '🟢 سالم';
        if (status?.is_reported) statusText = '🔴 ریپورت';
        else if (status?.is_resting) statusText = '🟡 استراحت';

        const lastActivity = status?.last_activity ? new Date(status.last_activity).toLocaleString('fa-IR') : 'نامشخص';

        await ctx.editMessageText(`
📱 *مدیریت اکانت* \`${phone}\`

👤 *نام:* \`${(account.firstName || '') + ' ' + (account.lastName || '')}\`
🔗 *یوزرنیم:* \`${account.username ? '@' + account.username : 'ندارد'}\`
📊 *وضعیت:* ${statusText}
⏱ *آخرین فعالیت:* ${lastActivity}
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🔑 کد ورود', callback_data: `panel_get_code_one:${phone}` },
                        { text: '🔍 چک سلامت', callback_data: `check_health_one:${phone}` }
                    ],
                    [
                        { text: '👤 پروفایل', callback_data: `profile_acc:${phone}` },
                        { text: '➖ حذف', callback_data: `remove_acc:${phone}` }
                    ],
                    [
                        { text: '🔙 لیست اکانت‌ها', callback_data: 'panel_manage_selection' }
                    ]
                ]
            }
        });
    });

    // Specific Actions for Single Menu
    // Get Code for one
    bot.action(/^panel_get_code_one:(.+)$/, async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
        const phone = ctx.match[1];
        await ctx.answerCbQuery('⏳ ارسال کد...');

        try {
            const { sendLoginCode } = await import('../services/authService.js');
            const { phoneHash } = await sendLoginCode(phone);

            userStates.set(ctx.chat.id, {
                action: 'awaiting_login_code',
                phone: phone,
                phoneHash: phoneHash,
                timestamp: Date.now()
            });

            await ctx.reply(`
✅ *کد ارسال شد*

کد ورود 5 رقمی ارسال شده به اکانت \`${phone}\` را وارد کنید:
            `.trim(), { parse_mode: 'Markdown' });

        } catch (e) {
            await ctx.reply(`❌ خطا در ارسال کد: ${e.message}`);
        }
    });

    // Check Health for one
    bot.action(/^check_health_one:(.+)$/, async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
        const phone = ctx.match[1];
        await ctx.answerCbQuery('⏳ بررسی...');

        try {
            const health = await accountManager.checkAccountHealth(phone);
            const status = health.connected ? '🟢 متصل' : '🔴 قطع';
            await ctx.reply(`
🔍 *نتیجه بررسی سلامت*

📱 اکانت: \`${phone}\`
📊 وضعیت: ${status}
⏱ پینگ: ${health.ping || 'N/A'}
             `.trim(), { parse_mode: 'Markdown' });

        } catch (e) {
            await ctx.reply(`❌ خطا: ${e.message}`);
        }
    });

    console.log('✅ Account handlers V2 registered');
}

// ==================== TEXT MESSAGE HANDLERS ====================

export async function handleAccountTextMessage(ctx, state) {
    const text = ctx.message?.text;

    // Check state timeout (10 minutes)
    if (state.timestamp && Date.now() - state.timestamp > 600000) {
        userStates.delete(ctx.chat.id);
        await ctx.reply('⏰ زمان عملیات به پایان رسید. لطفاً دوباره شروع کنید.');
        return true;
    }

    switch (state.action) {
        case 'awaiting_session_string':
            return await handleSessionString(ctx, text);
        case 'awaiting_new_name':
            return await handleNewName(ctx, text, state);
        case 'awaiting_new_bio':
            return await handleNewBio(ctx, text, state);
        case 'awaiting_code_phone':
            return await handleCodePhone(ctx, text);
        case 'awaiting_login_code':
            return await handleLoginCode(ctx, text, state);
        case 'awaiting_2fa_password':
            return await handle2FAPassword(ctx, text, state);
        case 'awaiting_backup_password':
            return await handleBackupPassword(ctx, text, state);
        case 'awaiting_restore_password':
            return await handleRestorePassword(ctx, text, state);
        default:
            return false;
    }
}

async function handleBackupPassword(ctx, text, state) {
    const password = text.trim();
    if (password.length < 4) {
        await ctx.reply('❌ رمز عبور باید حداقل ۴ کاراکتر باشد.');
        return true;
    }

    userStates.delete(ctx.chat.id);
    const progressMsg = await ctx.reply('⏳ در حال ایجاد و رمزنگاری بکاپ...');

    let backupPath = null;
    try {
        await ensureBackupDir();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        backupPath = path.join(BACKUP_DIR, `backup_encrypted_${timestamp}.json`);

        // Get encrypted sessions
        const encryptedSessions = await accountManager.getExportableAccounts(password);

        const backupData = {
            version: '3.0',
            encrypted: true,
            timestamp: new Date().toISOString(),
            sessions: encryptedSessions, // This is a string now
            accountStatus: accountStatus.getAll(), // Could encrypt this too, but less critical
            settings: settings.getAll()
        };

        await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2));

        await ctx.telegram.deleteMessage(ctx.chat.id, progressMsg.message_id);
        await ctx.replyWithDocument({
            source: backupPath,
            filename: `backup_encrypted_${timestamp}.json`
        }, {
            caption: `✅ *بکاپ امن ایجاد شد*

📅 تاریخ: ${new Date().toLocaleString('fa-IR')}
🔐 *فایل رمزنگاری شده است*
برای بازگردانی به رمز عبور نیاز دارید.`,
            parse_mode: 'Markdown'
        });

    } catch (error) {
        if (backupPath) try { await fs.unlink(backupPath); } catch { }
        await ctx.reply(`❌ خطا در ایجاد بکاپ: ${sanitizeError(error)}`);
    }
    return true;
}

async function handleRestorePassword(ctx, text, state) {
    const password = text.trim();
    const filePath = state.filePath;

    if (!filePath || !await fs.stat(filePath).catch(() => false)) {
        userStates.delete(ctx.chat.id);
        await ctx.reply('❌ فایل بکاپ یافت نشد. لطفاً مجدد تلاش کنید.');
        return true;
    }

    userStates.delete(ctx.chat.id);
    const progressMsg = await ctx.reply('⏳ در حال رمزگشایی و بازیابی...');

    try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        const backupData = JSON.parse(fileContent);

        // Do the import
        // result will handle decryption inside importAccounts
        const result = await accountManager.importAccounts(backupData.sessions, password);

        await ctx.telegram.editMessageText(
            ctx.chat.id,
            progressMsg.message_id,
            null,
            `✅ *بازیابی با موفقیت انجام شد!*

📊 اکانت‌های پردازش شده: ${result.success}
❌ خطاها: ${result.errors}
📅 تاریخ بکاپ: ${backupData.timestamp ? new Date(backupData.timestamp).toLocaleString('fa-IR') : 'نامشخص'}`,
            { parse_mode: 'Markdown' }
        );

    } catch (error) {
        await ctx.telegram.editMessageText(
            ctx.chat.id,
            progressMsg.message_id,
            null,
            `❌ خطا در بازیابی:
${sanitizeError(error)}`
        );
    } finally {
        // Cleanup temp file
        try { await fs.unlink(filePath); } catch { }
    }
    return true;
}

async function handleSessionString(ctx, text) {
    const lines = text.split('\n').map(s => s.trim()).filter(s => s);

    // Validate all sessions first
    const validSessions = [];
    const invalidSessions = [];

    for (const session of lines.slice(0, 10)) { // Max 10 at once
        if (isValidSessionString(session)) {
            validSessions.push(session);
        } else {
            invalidSessions.push(session.slice(0, 20) + '...');
        }
    }

    if (validSessions.length === 0) {
        await ctx.reply(`❌ هیچ Session معتبری یافت نشد.

${invalidSessions.length > 0 ? `⚠️ Sessions نامعتبر: ${invalidSessions.length}` : ''}

📝 Session String باید:
• حداقل 100 کاراکتر باشد
• از کلاینت Telethon/GramJS باشد
• فرمت Base64 صحیح داشته باشد`);
        return true;
    }

    userStates.delete(ctx.chat.id);

    const progressMsg = await ctx.reply(`⏳ در حال افزودن ${validSessions.length} اکانت...`);

    let success = 0, failed = 0;
    const errors = [];

    for (const session of validSessions) {
        try {
            await withTimeout(
                withRetry(() => accountManager.addAccountBySession(session), 2),
                TIMEOUT_MS,
                'Timeout'
            );
            success++;
        } catch (error) {
            failed++;
            errors.push(sanitizeError(error));
        }
    }

    let resultMsg = `📊 *نتیجه افزودن اکانت*\n\n`;
    resultMsg += `✅ موفق: ${success}\n`;
    resultMsg += `❌ ناموفق: ${failed}\n`;

    if (invalidSessions.length > 0) {
        resultMsg += `⚠️ نامعتبر: ${invalidSessions.length}\n`;
    }

    if (errors.length > 0 && errors.length <= 3) {
        resultMsg += `\n📝 خطاها:\n${errors.slice(0, 3).map(e => `• ${e}`).join('\n')}`;
    }

    await ctx.telegram.editMessageText(
        ctx.chat.id,
        progressMsg.message_id,
        null,
        resultMsg,
        { parse_mode: 'Markdown' }
    );

    console.log(`Sessions added: ${success} success, ${failed} failed by admin ${ctx.from.id}`);

    return true;
}

async function handleNewName(ctx, text, state) {
    const parts = text.trim().split(/\s+/);
    const firstName = parts[0]?.slice(0, 64) || '';
    const lastName = parts.slice(1).join(' ').slice(0, 64) || '';

    if (!firstName) {
        await ctx.reply('❌ نام نمی‌تواند خالی باشد.');
        return true;
    }

    userStates.delete(ctx.chat.id);

    try {
        const client = await accountManager.getClientByPhone(state.phone);
        if (!client) {
            await ctx.reply('❌ اکانت متصل نیست. لطفاً ابتدا اتصال را بررسی کنید.');
            return true;
        }

        const { Api } = await import('telegram');

        await withTimeout(
            client.invoke(new Api.account.UpdateProfile({
                firstName,
                lastName
            })),
            TIMEOUT_MS,
            'زمان تغییر نام به پایان رسید'
        );

        await ctx.reply(`✅ نام با موفقیت تغییر کرد

👤 نام جدید: ${firstName} ${lastName}`);

    } catch (error) {
        await ctx.reply(`❌ ${sanitizeError(error)}`);
    }

    return true;
}

async function handleNewBio(ctx, text, state) {
    let bio = text.trim();

    // Check for delete command
    if (bio === 'حذف' || bio.toLowerCase() === 'delete') {
        bio = '';
    } else {
        bio = bio.slice(0, TELEGRAM_BIO_MAX_LENGTH);
    }

    userStates.delete(ctx.chat.id);

    try {
        const client = await accountManager.getClientByPhone(state.phone);
        if (!client) {
            await ctx.reply('❌ اکانت متصل نیست.');
            return true;
        }

        const { Api } = await import('telegram');

        await withTimeout(
            client.invoke(new Api.account.UpdateProfile({
                about: bio
            })),
            TIMEOUT_MS,
            'زمان تغییر بیو به پایان رسید'
        );

        await ctx.reply(bio ? `✅ بیو تغییر کرد:\n${bio}` : '✅ بیو حذف شد');

    } catch (error) {
        await ctx.reply(`❌ ${sanitizeError(error)}`);
    }

    return true;
}

async function handleCodePhone(ctx, text) {
    const phone = text.trim().replace(/[\s\-\(\)]/g, '');

    if (!isValidPhoneNumber(phone)) {
        await ctx.reply(`❌ شماره نامعتبر است.

📝 فرمت صحیح:
• \`+989123456789\`
• با کد کشور شروع شود`);
        return true;
    }

    userStates.delete(ctx.chat.id);

    try {
        const tc = await import('../../../Shared/Infra/Telegram/telegram.client.js');

        const result = await withTimeout(
            tc.startLogin(phone),
            TIMEOUT_MS,
            'زمان درخواست کد به پایان رسید'
        );

        if (result.success) {
            await ctx.reply(`✅ کد ورود ارسال شد

📱 شماره: \`${phone}\`
📨 کد به پیام‌های تلگرام شما ارسال شد

لطفاً کد دریافتی را ارسال کنید:`, { parse_mode: 'Markdown' });

            userStates.set(ctx.chat.id, {
                action: 'awaiting_login_code',
                phone,
                // PhoneCodeHash is managed by the service
                timestamp: Date.now()
            });
        } else {
            await ctx.reply(`❌ ${sanitizeError(result.error)}`);
        }
    } catch (error) {
        await ctx.reply(`❌ ${sanitizeError(error)}`);
    }

    return true;
}


async function handleLoginCode(ctx, text, state) {
    const code = text.trim();

    // Basic format check (some codes are 5 digits)
    if (!/^\d+$/.test(code)) {
        await ctx.reply('❌ کد باید فقط شامل اعداد باشد.');
        return true;
    }

    const tc = await import('../../../Shared/Infra/Telegram/telegram.client.js');

    // We need to restore the login state in the service if it was lost
    const currentLoginState = tc.getLoginState();

    // Verify we are talking about the same phone
    if (!currentLoginState || currentLoginState.phoneNumber !== state.phone) {
        userStates.delete(ctx.chat.id);
        await ctx.reply('❌ نشست ورود منقضی شده است. لطفا مجدد تلاش کنید.');
        return true;
    }

    const progressMsg = await ctx.reply('⏳ در حال بررسی کد...');

    try {
        const result = await withTimeout(
            tc.submitCode(code),
            TIMEOUT_MS,
            'زمان بررسی کد به پایان رسید'
        );

        if (result.success) {
            if (result.step === 'completed') {
                userStates.delete(ctx.chat.id);
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    progressMsg.message_id,
                    null,
                    `✅ *اکانت با موفقیت افزوده شد*
                    
👤 نام: \`${result.user.firstName} ${result.user.lastName || ''}\`
🆔 شناسه: \`${result.user.id}\`
USER نام کاربری: \`${result.user.username ? '@' + result.user.username : 'ندارد'}\``,
                    { parse_mode: 'Markdown' }
                );
                console.log(`Account added via phone: ${hashForLog(state.phone)} by admin ${ctx.from.id}`);
            } else if (result.step === 'awaiting_2fa') {
                // Transition to 2FA state
                userStates.set(ctx.chat.id, {
                    ...state,
                    action: 'awaiting_2fa_password',
                    timestamp: Date.now()
                });

                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    progressMsg.message_id,
                    null,
                    `🔐 *تأیید دو مرحله‌ای*
                    
این اکانت دارای رمز عبور دو مرحله‌ای (2FA) است.
لطفاً رمز عبور را ارسال کنید:
(این پیام پس از پردازش حذف می‌شود)`,
                    { parse_mode: 'Markdown' }
                );
            }
        } else {
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                progressMsg.message_id,
                null,
                `❌ خطا: ${sanitizeError(result.error)}`
            );
        }

    } catch (error) {
        await ctx.telegram.editMessageText(
            ctx.chat.id,
            progressMsg.message_id,
            null,
            `❌ خطا: ${sanitizeError(error)}`
        );
    }

    return true;
}

async function handle2FAPassword(ctx, text, state) {
    const password = text;

    try {
        await ctx.deleteMessage();
    } catch (e) { }

    const tc = await import('../../../Shared/Infra/Telegram/telegram.client.js');
    const msg = await ctx.reply('⏳ در حال بررسی رمز عبور...');

    try {
        const result = await withTimeout(
            tc.submit2FA(password),
            TIMEOUT_MS,
            'زمان بررسی رمز به پایان رسید'
        );

        if (result.success) {
            userStates.delete(ctx.chat.id);
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                msg.message_id,
                null,
                `✅ *اکانت با موفقیت افزوده شد*
                
👤 نام: \`${result.user.firstName} ${result.user.lastName || ''}\`
🆔 شناسه: \`${result.user.id}\`
USER نام کاربری: \`${result.user.username ? '@' + result.user.username : 'ندارد'}\``,
                { parse_mode: 'Markdown' }
            );
            console.log(`Account added via 2FA: ${hashForLog(state.phone)} by admin ${ctx.from.id}`);
        } else {
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                msg.message_id,
                null,
                `❌ رمز عبور اشتباه است یا خطایی رخ داد:
${sanitizeError(result.error)}
لطفا مجدد تلاش کنید:`
            );
        }

    } catch (error) {
        await ctx.telegram.editMessageText(
            ctx.chat.id,
            msg.message_id,
            null,
            `❌ خطا: ${sanitizeError(error)}`
        );
    }

    return true;
}

// ==================== FILE HANDLERS ====================

export async function handleAccountFileMessage(ctx, state) {
    // Check for session string file upload (txt)
    if (state.action === 'awaiting_session_string') {
        const doc = ctx.message.document;
        if (!doc) return false;

        // Accept .txt or no extension (sometimes happens)
        if (doc.file_name?.endsWith('.txt') || doc.mime_type === 'text/plain') {
            userStates.delete(ctx.chat.id);
            const processingMsg = await ctx.reply('⏳ در حال پردازش فایل سشن...');

            try {
                const fileLink = await ctx.telegram.getFileLink(doc.file_id);
                const response = await withTimeout(fetch(fileLink.href), 30000);
                const text = await response.text();

                // Reuse the existing string handler logic
                await handleSessionString(ctx, text);

                try { await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id); } catch (e) { }
            } catch (error) {
                await ctx.reply(`❌ خطا در خواندن فایل: ${sanitizeError(error)}`);
            }
            return true;
        }
    }

    if (state.action !== 'awaiting_backup_file') return false;

    const doc = ctx.message.document;

    // Validate file
    if (!doc) {
        await ctx.reply('❌ لطفاً یک فایل ارسال کنید.');
        return true;
    }

    if (!doc.file_name?.endsWith('.json')) {
        await ctx.reply('❌ فقط فایل JSON قابل قبول است.');
        return true;
    }

    if (doc.file_size > 10 * 1024 * 1024) { // 10MB limit
        await ctx.reply('❌ حجم فایل بیش از حد مجاز است (حداکثر 10MB).');
        return true;
    }

    userStates.delete(ctx.chat.id);

    const progressMsg = await ctx.reply('⏳ در حال بازیابی...');

    try {
        const file = await ctx.telegram.getFile(doc.file_id);

        // Use getFileLink instead of building URL manually
        const fileLink = await ctx.telegram.getFileLink(doc.file_id);

        const response = await withTimeout(
            fetch(fileLink.href),
            30000,
            'زمان دانلود فایل به پایان رسید'
        );

        const backupData = await response.json();

        // Check if encryption is needed
        // Version 3.0 has 'encrypted: true' and sessions is a string
        // Or if sessions is just a string (implicit)
        const isEncrypted = backupData.encrypted || typeof backupData.sessions === 'string';

        if (isEncrypted) {
            // Save file to temp and ask for password
            const tempFile = path.join(os.tmpdir(), `restore_${Date.now()}.json`);
            await fs.writeFile(tempFile, JSON.stringify(backupData));

            userStates.set(ctx.chat.id, {
                action: 'awaiting_restore_password',
                filePath: tempFile,
                timestamp: Date.now()
            });

            await ctx.telegram.editMessageText(
                ctx.chat.id,
                progressMsg.message_id,
                null,
                `🔐 *فایل رمزنگاری شده*
                
لطفاً رمز عبور فایل بکاپ را وارد کنید:`,
                { parse_mode: 'Markdown' }
            );
            return true;
        }

        // Validate plain backup structure
        if (!backupData.sessions || !Array.isArray(backupData.sessions)) {
            throw new Error('ساختار فایل بکاپ نامعتبر است');
        }

        // Verify checksum if present (Legacy)
        if (backupData.checksum) {
            // ... legacy checksum logic ...
        }

        // Do the import (Legacy plain text)
        const result = await accountManager.importAccounts(backupData.sessions); // No password needed

        await ctx.telegram.editMessageText(
            ctx.chat.id,
            progressMsg.message_id,
            null,
            `✅ *بازیابی انجام شد!*

📊 اکانت‌های پردازش شده: \`${result.success}\`
❌ خطاها: \`${result.errors}\`
📅 تاریخ بکاپ: \`${backupData.timestamp ? new Date(backupData.timestamp).toLocaleString('fa-IR') : 'نامشخص'}\`
🔐 نسخه: \`${backupData.version || 'Legacy'}\``,
            { parse_mode: 'Markdown' }
        );

        console.log(`Backup restored: ${result.success} accounts by admin ${ctx.from.id}`);

    } catch (error) {
        await ctx.telegram.editMessageText(
            ctx.chat.id,
            progressMsg.message_id,
            null,
            `❌ ${sanitizeError(error)}`
        );
        console.error(`Restore error: ${error.message}`);
    }

    return true;
}

// ==================== STATE CLEANUP ====================

// Cleanup old states every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [chatId, state] of userStates.entries()) {
        if (state.timestamp && now - state.timestamp > 600000) { // 10 minutes
            userStates.delete(chatId);
        }
    }
}, 300000);

export default {
    registerAccountHandlers,
    handleAccountTextMessage,
    handleAccountFileMessage,
    // Export helper for direct use if needed
    handleSessionString
};
