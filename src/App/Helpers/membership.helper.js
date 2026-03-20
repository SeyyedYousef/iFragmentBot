import { CONFIG } from "../../core/Config/app.config.js";

/**
 * Check if user is a member of the required channel
 */
export async function isChannelMember(bot, userId) {
	try {
		const member = await bot.telegram.getChatMember(
			CONFIG.REQUIRED_CHANNEL,
			userId,
		);
		// Allowed: Creator, Admin, Member.
		// Blocked: Left, Kicked, Restricted.
		return ["member", "administrator", "creator"].includes(member.status);
	} catch (error) {
		console.error("❌ Channel verification failed:", error.message);
		// Fail open only if critical error, otherwise fail closed
		return false;
	}
}

/**
 * Message template for membership requirement
 */
export function sendJoinChannelMessage(ctx) {
	return ctx.replyWithMarkdown(
		`
🔒 *Access Limited!*

To use iFragmentBot analysis tools, you must join our official community channel first.

**Please join and then click the verification button.**
`,
		{
			reply_markup: {
				inline_keyboard: [
					[{ text: "📢 Join @FragmentsCommunity", url: CONFIG.CHANNEL_LINK }],
					[
						{
							text: "✅ I Joined — Continue",
							callback_data: "check_membership",
						},
					],
				],
			},
		},
	);
}

/**
 * Higher level helper for handlers to check membership
 */
export async function checkMembershipOrStop(ctx, bot, isAdmin) {
	const userId = ctx.from.id;

	// Admins are exempt
	if (isAdmin && isAdmin(userId)) return true;

	const isMember = await isChannelMember(bot, userId);
	if (!isMember) {
		await sendJoinChannelMessage(ctx);
		return false;
	}

	return true;
}
