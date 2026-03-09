/**
 * Operations Handlers
 * Handles advanced operations, profile management, receiver, and report system
 */

import { Markup } from 'telegraf';
import * as profileManager from '../../Modules/User/Application/profile-manager.service.js';
import * as receiverService from '../../Modules/Automation/Application/receiver.service.js';
import * as reportSystem from '../../Modules/Admin/Application/report-system.service.js';
import * as g2g from '../../Modules/Automation/Application/group-to-group.service.js';
import { userStates } from '../../Shared/Infra/State/state.service.js';
import * as accountManager from '../../Modules/User/Application/account-manager.service.js';

// ==================== REGISTER HANDLERS ====================

export function registerOperationsHandlers(bot, isAdmin) {

    // Profile system menu
    bot.action('ops_profile_system', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        const stats = profileManager.getProfileStats();

        await ctx.editMessageText(`
👤 *سیستم پروفایل*

📊 *آمار:*
• کل پروفایل‌ها: \`${stats.total}\`
• استفاده نشده: \`${stats.unused}\`
• استفاده شده: \`${stats.used}\`
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '➕ افزودن پروفایل', callback_data: 'ops_add_profile' },
                        { text: '📋 لیست پروفایل‌ها', callback_data: 'ops_list_profiles' }
                    ],
                    [
                        { text: '📥 استخراج از اکانت‌ها', callback_data: 'ops_extract_profiles' },
                        { text: '📤 اعمال به اکانت‌ها', callback_data: 'ops_apply_profiles' }
                    ],
                    [{ text: '🔙 بازگشت', callback_data: 'panel_operations' }]
                ]
            }
        });
    });

    // Add profile
    bot.action('ops_add_profile', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        userStates.set(ctx.chat.id, { action: 'awaiting_profile_data' });

        await ctx.editMessageText(`
➕ *افزودن پروفایل*

پروفایل‌ها را ارسال کنید (هر خط یک پروفایل):

فرمت: \`نام|نام‌خانوادگی|بیو\`

مثال:
\`علی|احمدی|برنامه‌نویس حرفه‌ای\`
\`مریم|رضایی|\`
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ لغو', callback_data: 'ops_profile_system' }]
                ]
            }
        });
    });

    // List profiles
    bot.action('ops_list_profiles', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        const profiles = profileManager.getAllProfiles();

        if (profiles.length === 0) {
            return ctx.editMessageText('❌ هیچ پروفایلی ثبت نشده.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '➕ افزودن پروفایل', callback_data: 'ops_add_profile' }],
                        [{ text: '🔙 بازگشت', callback_data: 'ops_profile_system' }]
                    ]
                }
            });
        }

        let msg = `📋 *لیست پروفایل‌ها*\n\n`;
        profiles.slice(0, 15).forEach((p, i) => {
            const status = p.is_used ? '✅' : '⬜';
            msg += `${i + 1}. ${status} ${p.first_name} ${p.last_name || ''}\n`;
        });

        if (profiles.length > 15) {
            msg += `\n_و ${profiles.length - 15} پروفایل دیگر..._`;
        }

        await ctx.editMessageText(msg, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🗑️ حذف همه', callback_data: 'ops_delete_all_profiles' }],
                    [{ text: '🔙 بازگشت', callback_data: 'ops_profile_system' }]
                ]
            }
        });
    });

    // Extract profiles from accounts
    bot.action('ops_extract_profiles', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery('⏳ در حال استخراج پروفایل‌ها...');

        const accounts = accountManager.getAccountList();

        if (accounts.length === 0) {
            return ctx.editMessageText('❌ هیچ اکانتی وجود ندارد.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 بازگشت', callback_data: 'ops_profile_system' }]
                    ]
                }
            });
        }

        const results = await profileManager.extractProfilesFromAllAccounts();

        await ctx.editMessageText(`
✅ *استخراج پروفایل تکمیل شد*

✅ موفق: ${results.success}
❌ ناموفق: ${results.failed}
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📋 مشاهده', callback_data: 'ops_list_profiles' }],
                    [{ text: '🔙 بازگشت', callback_data: 'ops_profile_system' }]
                ]
            }
        });
    });

    // Apply profiles to accounts
    bot.action('ops_apply_profiles', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        await ctx.editMessageText(`
⚠️ *تأیید اعمال پروفایل*

آیا می‌خواهید پروفایل‌های تصادفی به همه اکانت‌ها اعمال شود؟

این عمل نام، بیو و عکس پروفایل اکانت‌ها را تغییر می‌دهد.
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ بله', callback_data: 'confirm_apply_profiles' },
                        { text: '❌ خیر', callback_data: 'ops_profile_system' }
                    ]
                ]
            }
        });
    });

    // Confirm apply profiles
    bot.action('confirm_apply_profiles', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery('⏳ در حال اعمال پروفایل‌ها...');

        const results = await profileManager.applyRandomProfilesToAllAccounts();

        let msg = `📤 *اعمال پروفایل تکمیل شد*\n\n`;
        msg += `✅ موفق: ${results.success}\n`;
        msg += `❌ ناموفق: ${results.failed}\n`;

        if (results.errors && results.errors.length > 0) {
            msg += `\n⚠️ خطاها:\n`;
            results.errors.slice(0, 3).forEach(e => {
                msg += `• ${e}\n`;
            });
        }

        await ctx.editMessageText(msg, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 بازگشت', callback_data: 'ops_profile_system' }]
                ]
            }
        });
    });

    // Delete all profiles
    bot.action('ops_delete_all_profiles', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        await ctx.editMessageText('⚠️ آیا از حذف همه پروفایل‌ها مطمئن هستید؟', {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ بله', callback_data: 'confirm_delete_profiles' },
                        { text: '❌ خیر', callback_data: 'ops_list_profiles' }
                    ]
                ]
            }
        });
    });

    // Confirm delete profiles
    bot.action('confirm_delete_profiles', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');

        profileManager.deleteAllProfiles();
        await ctx.answerCbQuery('✅ همه پروفایل‌ها حذف شدند');

        await ctx.editMessageText('✅ همه پروفایل‌ها حذف شدند.', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 بازگشت', callback_data: 'ops_profile_system' }]
                ]
            }
        });
    });

    // Receiver system menu
    bot.action('ops_receiver_system', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        const stats = receiverService.getReceiverStats();

        await ctx.editMessageText(`
📥 *سیستم ریسیور*

📊 *آمار:*
• کل: \`${stats.total}\`
• در انتظار تأیید: \`${stats.pending}\`
• تأیید شده: \`${stats.approved}\`
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📋 درخواست‌های جدید', callback_data: 'receiver_pending' }],
                    [{ text: '✅ تأیید شده‌ها', callback_data: 'receiver_approved' }],
                    [{ text: '🔙 بازگشت', callback_data: 'panel_operations' }]
                ]
            }
        });
    });

    // Pending receiver requests
    bot.action('receiver_pending', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        const pending = receiverService.getPendingAccounts();

        if (pending.length === 0) {
            return ctx.editMessageText('✅ هیچ درخواستی در انتظار تأیید نیست.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 بازگشت', callback_data: 'ops_receiver_system' }]
                    ]
                }
            });
        }

        const buttons = pending.slice(0, 8).map((acc) => ([
            { text: `📱 ${acc.phone}`, callback_data: `view_receiver:${acc.id}` }
        ]));

        buttons.push([{ text: '🔙 بازگشت', callback_data: 'ops_receiver_system' }]);

        await ctx.editMessageText(`📋 *درخواست‌های در انتظار تأیید*\n\nبرای بررسی روی هر مورد کلیک کنید:`, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: buttons }
        });
    });

    // View receiver details
    bot.action(/^view_receiver:(\d+)$/, async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');

        const id = parseInt(ctx.match[1]);
        const pending = receiverService.getPendingAccounts();
        const account = pending.find(a => a.id === id);

        if (!account) {
            return ctx.answerCbQuery('❌ یافت نشد');
        }

        await ctx.answerCbQuery();

        await ctx.editMessageText(`
📱 *جزئیات درخواست*

📞 شماره: \`${account.phone}\`
👤 ارسال توسط: \`${account.donated_by || 'نامشخص'}\`
📅 تاریخ: ${new Date(account.created_at).toLocaleDateString('fa-IR')}
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ تأیید', callback_data: `approve_receiver:${id}` },
                        { text: '❌ رد', callback_data: `reject_receiver:${id}` }
                    ],
                    [{ text: '🔙 بازگشت', callback_data: 'receiver_pending' }]
                ]
            }
        });
    });

    // Approve receiver
    bot.action(/^approve_receiver:(\d+)$/, async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');

        const id = parseInt(ctx.match[1]);
        const result = await receiverService.approveAccount(id);

        if (result.success) {
            await ctx.answerCbQuery('✅ تأیید شد');
        } else {
            await ctx.answerCbQuery('❌ خطا: ' + result.error);
        }

        // Go back to pending list
        const pending = receiverService.getPendingAccounts();

        if (pending.length === 0) {
            return ctx.editMessageText('✅ همه درخواست‌ها پردازش شدند.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 بازگشت', callback_data: 'ops_receiver_system' }]
                    ]
                }
            });
        }

        const buttons = pending.slice(0, 8).map((acc) => ([
            { text: `📱 ${acc.phone}`, callback_data: `view_receiver:${acc.id}` }
        ]));
        buttons.push([{ text: '🔙 بازگشت', callback_data: 'ops_receiver_system' }]);

        await ctx.editMessageText(`📋 *درخواست‌های در انتظار تأیید*`, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: buttons }
        });
    });

    // Reject receiver
    bot.action(/^reject_receiver:(\d+)$/, async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');

        const id = parseInt(ctx.match[1]);
        receiverService.rejectAccount(id);

        await ctx.answerCbQuery('❌ رد شد');

        // Go back to pending list
        const pending = receiverService.getPendingAccounts();

        if (pending.length === 0) {
            return ctx.editMessageText('✅ همه درخواست‌ها پردازش شدند.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 بازگشت', callback_data: 'ops_receiver_system' }]
                    ]
                }
            });
        }

        const buttons = pending.slice(0, 8).map((acc) => ([
            { text: `📱 ${acc.phone}`, callback_data: `view_receiver:${acc.id}` }
        ]));
        buttons.push([{ text: '🔙 بازگشت', callback_data: 'ops_receiver_system' }]);

        await ctx.editMessageText(`📋 *درخواست‌های در انتظار تأیید*`, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: buttons }
        });
    });

    // Report system menu
    bot.action('ops_report_system', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        const report = reportSystem.generateStatusReport();

        await ctx.editMessageText(report, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🔄 بروزرسانی', callback_data: 'ops_report_system' },
                        { text: '⏰ پاک کردن استراحت‌ها', callback_data: 'clear_all_rests' }
                    ],
                    [
                        { text: '🗑️ حذف ریپورت‌ها', callback_data: 'remove_reported' }
                    ],
                    [{ text: '🔙 بازگشت', callback_data: 'panel_operations' }]
                ]
            }
        });
    });

    // Clear all rests
    bot.action('clear_all_rests', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');

        reportSystem.clearAllRest();
        await ctx.answerCbQuery('✅ استراحت‌ها پاک شدند');

        // Refresh report
        const report = reportSystem.generateStatusReport();

        await ctx.editMessageText(report, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🔄 بروزرسانی', callback_data: 'ops_report_system' },
                        { text: '⏰ پاک کردن استراحت‌ها', callback_data: 'clear_all_rests' }
                    ],
                    [
                        { text: '🗑️ حذف ریپورت‌ها', callback_data: 'remove_reported' }
                    ],
                    [{ text: '🔙 بازگشت', callback_data: 'panel_operations' }]
                ]
            }
        });
    });

    // Remove reported accounts
    bot.action('remove_reported', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        await ctx.editMessageText(`
⚠️ *تأیید حذف*

آیا می‌خواهید همه اکانت‌های ریپورت شده از سیستم حذف شوند؟
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ بله', callback_data: 'confirm_remove_reported' },
                        { text: '❌ خیر', callback_data: 'ops_report_system' }
                    ]
                ]
            }
        });
    });

    // Confirm remove reported
    bot.action('confirm_remove_reported', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery('⏳ در حال حذف...');

        const results = await reportSystem.removeReportedAccounts();

        await ctx.editMessageText(`
✅ *حذف اکانت‌های ریپورت شده*

🗑️ حذف شده: ${results.removed}
❌ ناموفق: ${results.failed}
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 بازگشت', callback_data: 'ops_report_system' }]
                ]
            }
        });
    });

    // Gift extraction menu
    bot.action('ops_gift_extraction', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        userStates.set(ctx.chat.id, { action: 'awaiting_gift_links' });

        await ctx.editMessageText(`
🎁 *استخراج از لینک گیفت (تکی)*

لینک‌های گیفت را ارسال کنید (هر خط یک لینک):

مثال:
\`https://t.me/nft/slug-123\`

اطلاعات مالک هر گیفت استخراج خواهد شد.
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ لغو', callback_data: 'panel_operations' }]
                ]
            }
        });
    });

    // Range extraction menu
    bot.action('ops_extract_range', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        userStates.set(ctx.chat.id, { action: 'awaiting_range_data' });

        await ctx.editMessageText(`
🔢 *استخراج از کالکشن (رنج عدد)*

لطفاً نام مجموعه و رنج عددی را وارد کنید. (دقیقاً مشابه چیزی که در لینک تلگرام می‌بینید)

📝 *فرمت:* \`slug|start|end\`

✅ *مثال:*
\`SignetRing|14400|14500\`
\`PartyPepe|1|100\`

سیستم به صورت خودکار تمام گیفت‌های این رنج را بررسی می‌کند.
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ لغو', callback_data: 'panel_operations' }]
                ]
            }
        });
    });

    // Multi invite links
    bot.action('ops_multi_invite', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        userStates.set(ctx.chat.id, { action: 'awaiting_invite_links' });

        await ctx.editMessageText(`
🔗 *لینک‌های دعوت متعدد*

لینک‌های دعوت را ارسال کنید (هر خط یک لینک):

مثال:
\`https://t.me/+abc123\`
\`https://t.me/joinchat/xyz789\`

اکانت‌ها به همه گروه‌ها جوین خواهند شد.
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ لغو', callback_data: 'panel_operations' }]
                ]
            }
        });
    });



    // Comment extraction
    bot.action('ops_extract_comments', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();

        userStates.set(ctx.chat.id, { action: 'awaiting_comment_post_link' });

        await ctx.editMessageText(`
💬 *استخراج از کامنت‌ها*

لینک پست را ارسال کنید:

مثال: \`https://t.me/channel/123\`

یوزرنیم کاربرانی که کامنت گذاشته‌اند استخراج خواهد شد.
        `.trim(), {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ لغو', callback_data: 'panel_operations' }]
                ]
            }
        });
    });

    // Group to Group
    bot.action('ops_group_to_group', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();
        // Start G2G wizard
        await ctx.editMessageText('👥 *گروه به گروه*\n\nاین قابلیت بزودی فعال می‌شود.', {
            reply_markup: { inline_keyboard: [[Markup.button.callback('🔙 بازگشت', 'panel_operations')]] }
        });
    });

    // Concurrent Run
    bot.action('ops_concurrent_run', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();
        await ctx.editMessageText('🏃 *اجرای همزمان*\n\nاین قابلیت بزودی فعال می‌شود.', {
            reply_markup: { inline_keyboard: [[Markup.button.callback('🔙 بازگشت', 'panel_operations')]] }
        });
    });

    // Auto Exit
    bot.action('ops_auto_exit', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        const currentState = true; // Placeholder
        await ctx.answerCbQuery(currentState ? '🚪 خروج خودکار غیرفعال شد' : '✅ خروج خودکار فعال شد');
        // Toggle logic here
    });

    // Username Checker
    bot.action('ops_username_checker', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('دسترسی ندارید');
        await ctx.answerCbQuery();
        await ctx.editMessageText('✅ *چکر یوزرنیم*\n\nلطفاً یوزرنیم یا فایل لیست یوزرنیم‌ها را ارسال کنید.', {
            reply_markup: { inline_keyboard: [[Markup.button.callback('🔙 بازگشت', 'panel_operations')]] }
        });
    });

    // Operations handlers registered
}

// ==================== TEXT MESSAGE HANDLERS ====================

export function handleOperationsTextMessage(ctx, state) {
    const text = ctx.message?.text;

    switch (state.action) {
        case 'awaiting_profile_data':
            return handleProfileData(ctx, text);
        case 'awaiting_gift_links':
            return handleGiftLinks(ctx, text);
        case 'awaiting_range_data':
            return handleRangeExtraction(ctx, text);
        case 'awaiting_invite_links':
            return handleInviteLinks(ctx, text);
        case 'awaiting_comment_post_link':
            return handleCommentPostLink(ctx, text);
        default:
            return false;
    }
}

async function handleProfileData(ctx, text) {
    userStates.delete(ctx.chat.id);

    const result = profileManager.addProfilesFromText(text);

    await ctx.reply(`
📊 *نتیجه افزودن پروفایل*

✅ موفق: ${result.success}
❌ ناموفق: ${result.failed}
    `.trim(), { parse_mode: 'Markdown' });

    return true;
}

async function handleRangeExtraction(ctx, text) {
    const parts = text.split('|').map(p => p.trim());
    if (parts.length < 3) {
        await ctx.reply('❌ فرمت نامعتبر است. مثال: `pepe|1|50`');
        return true;
    }

    const slug = parts[0];
    const start = parseInt(parts[1]);
    const end = parseInt(parts[2]);

    if (isNaN(start) || isNaN(end) || start > end) {
        await ctx.reply('❌ اعداد وارد شده معتبر نیستند.');
        return true;
    }

    userStates.delete(ctx.chat.id);

    const progressMsg = await ctx.reply(`⏳ شروع استخراج از مجموعه *${slug}* (از ${start} تا ${end})...\n\n_این عملیات در پس‌زمینه انجام می‌شود._`, { parse_mode: 'Markdown' });

    // Run in background to avoid blocking bot
    g2g.extractOwnersFromCollection(slug, start, end, async (current, total, success) => {
        if (current % 10 === 0 || current === total) {
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                progressMsg.message_id,
                null,
                `⏳ در حال استخراج از *${slug}*...\n\n✅ پیشرفت: \`${current}/${total}\`\n👤 یافت شده: \`${success}\``,
                { parse_mode: 'Markdown' }
            ).catch(() => { });
        }
    }).then(results => {
        ctx.reply(`✅ *استخراج رنج تکمیل شد*\n\n🎁 کالکشن: \`${slug}\`\n📊 کل بررسی شده: \`${results.total}\`\n✅ یافت شده: \`${results.success}\``, { parse_mode: 'Markdown' });
    }).catch(err => {
        ctx.reply(`❌ خطا در استخراج رنج: ${err.message}`);
    });

    return true;
}

async function handleGiftLinks(ctx, text) {
    const links = text.split('\n').map(l => l.trim()).filter(l => l);

    if (links.length === 0) {
        await ctx.reply('❌ لینکی وارد نشده.');
        return true;
    }

    userStates.delete(ctx.chat.id);

    const progressMsg = await ctx.reply(`⏳ در حال استخراج از ${links.length} لینک...`);

    const results = { success: 0, failed: 0, users: [] };

    for (const link of links) {
        try {
            const result = await g2g.extractOwnerFromGiftLink(link);
            if (result && result.userId) {
                results.success++;
                results.users.push(result.userId);
            } else {
                results.failed++;
            }
        } catch (error) {
            results.failed++;
        }
    }

    let msg = `🎁 *استخراج از گیفت تکمیل شد*\n\n`;
    msg += `✅ موفق: ${results.success}\n`;
    msg += `❌ ناموفق: ${results.failed}\n`;

    if (results.users.length > 0) {
        msg += `\n📋 *آیدی‌های استخراج شده:*\n`;
        msg += `\`${results.users.slice(0, 10).join('\n')}\``;
        if (results.users.length > 10) {
            msg += `\n_و ${results.users.length - 10} مورد دیگر..._`;
        }
    }

    await ctx.telegram.editMessageText(
        ctx.chat.id,
        progressMsg.message_id,
        null,
        msg,
        { parse_mode: 'Markdown' }
    );

    return true;
}

async function handleInviteLinks(ctx, text) {
    const links = text.split('\n').map(l => l.trim()).filter(l => l.includes('t.me'));

    if (links.length === 0) {
        await ctx.reply('❌ لینکی معتبر وارد نشده.');
        return true;
    }

    userStates.delete(ctx.chat.id);

    const progressMsg = await ctx.reply(`⏳ در حال جوین به ${links.length} لینک...`);

    const accounts = accountManager.getAccountList().filter(a => a.status === 'active');
    const results = { success: 0, failed: 0 };

    for (const link of links) {
        for (const account of accounts.slice(0, 5)) {
            try {
                const client = await accountManager.getClientByPhone(account.phone);
                if (client) {
                    await client.invoke(new (await import('telegram')).Api.messages.ImportChatInvite({
                        hash: link.split('+').pop() || link.split('joinchat/').pop()
                    }));
                    results.success++;
                }
            } catch (error) {
                results.failed++;
            }
        }
    }

    await ctx.telegram.editMessageText(
        ctx.chat.id,
        progressMsg.message_id,
        null,
        `✅ جوین تکمیل شد\n\n✅ موفق: ${results.success}\n❌ ناموفق: ${results.failed}`,
        { parse_mode: 'Markdown' }
    );

    return true;
}

async function handleCommentPostLink(ctx, text) {
    const match = text.match(/t\.me\/([^\/]+)\/(\d+)/);

    if (!match) {
        await ctx.reply('❌ لینک نامعتبر است.');
        return true;
    }

    const channel = match[1];
    const messageId = parseInt(match[2]);

    userStates.delete(ctx.chat.id);

    const progressMsg = await ctx.reply('⏳ در حال استخراج کامنت‌گذاران...');

    try {
        const result = await g2g.extractMembersFromChat(`@${channel}`, { limit: 100, fromComments: true, messageId });

        let msg = `💬 *استخراج کامنت‌گذاران تکمیل شد*\n\n`;
        msg += `📊 تعداد: ${result?.users?.length || 0}\n`;

        if (result?.users?.length > 0) {
            msg += `\n📋 یوزرنیم‌ها:\n`;
            msg += `\`${result.users.slice(0, 10).map(u => u.username || u.id).join('\n')}\``;
        }

        await ctx.telegram.editMessageText(
            ctx.chat.id,
            progressMsg.message_id,
            null,
            msg,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        await ctx.telegram.editMessageText(
            ctx.chat.id,
            progressMsg.message_id,
            null,
            `❌ خطا: ${error.message}`
        );
    }

    return true;
}

export default {
    registerOperationsHandlers,
    handleOperationsTextMessage
};
