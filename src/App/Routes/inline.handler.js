import { parseGiftLink } from "../../Modules/Market/Application/marketapp.service.js";

/**
 * Handle Telegram Inline Queries
 */
export async function handleInlineQuery(ctx) {
	const query = ctx.inlineQuery.query.trim();

	if (!query) {
		return ctx.answerInlineQuery(
			[
				{
					type: "article",
					id: "help_username",
					title: "👤 Search Username",
					description: "Type @username to analyze value",
					thumb_url: "https://fragment.com/img/fragment_logo.png",
					input_message_content: {
						message_text:
							"To analyze a username, type: `@iFragmentBot @username`",
						parse_mode: "Markdown",
					},
				},
				{
					type: "article",
					id: "help_gift",
					title: "🎁 Search Gift",
					description: "Paste a gift link to analyze",
					thumb_url: "https://nft.fragment.com/img/gifts/gift_standard.png",
					input_message_content: {
						message_text:
							"To analyze a gift, type: `@iFragmentBot https://t.me/nft/...`",
						parse_mode: "Markdown",
					},
				},
			],
			{ cache_time: 300, is_personal: true },
		);
	}

	const results = [];

	// 1. Handle Gift Link
	const giftParsed = parseGiftLink(query);
	if (giftParsed.isValid) {
		results.push({
			type: "article",
			id: `gift_${Date.now()}`,
			title: `🎁 Analyze Gift: ${giftParsed.modelName || "Gift"}`,
			description: `Model: ${giftParsed.modelName} #${giftParsed.pattern || "?"} - Click to generate full report`,
			thumb_url: "https://nft.fragment.com/img/gifts/gift_premium.png",
			input_message_content: {
				message_text: `!Gifts ${query}`,
				parse_mode: "Markdown",
			},
		});
		return ctx.answerInlineQuery(results, { cache_time: 0 });
	}

	// 2. Handle Wallet Address
	if (query.length > 40 || query.startsWith("UQ") || query.startsWith("EQ")) {
		results.push({
			type: "article",
			id: `wallet_${Date.now()}`,
			title: `💼 Track Wallet`,
			description: `${query.substring(0, 10)}...${query.substring(query.length - 5)}`,
			thumb_url: "https://ton.org/download/ton_symbol.png",
			input_message_content: {
				message_text: `!Wallet ${query}`,
				parse_mode: "Markdown",
			},
		});
		return ctx.answerInlineQuery(results, { cache_time: 300 });
	}

	// 3. Handle Username
	const potentialUsername = query.replace("@", "").toLowerCase();
	if (/^[a-zA-Z0-9_]{4,32}$/.test(potentialUsername)) {
		results.push({
			type: "article",
			id: `user_${potentialUsername}`,
			title: `🔍 Analyze @${potentialUsername}`,
			description: "Click to generate valuation report",
			thumb_url: "https://fragment.com/img/fragment_logo.png",
			input_message_content: {
				message_text: `!Username @${potentialUsername}`,
				parse_mode: "Markdown",
			},
		});

		results.push({
			type: "article",
			id: `wallet_${potentialUsername}`,
			title: `💼 Portfolio: @${potentialUsername}`,
			description: "Find owner wallet & assets",
			thumb_url: "https://ton.org/download/ton_symbol.png",
			input_message_content: {
				message_text: `!Wallet @${potentialUsername}`,
				parse_mode: "Markdown",
			},
		});
	}

	return ctx.answerInlineQuery(results, { cache_time: 300 });
}
