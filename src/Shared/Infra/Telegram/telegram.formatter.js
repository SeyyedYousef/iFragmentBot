/**
 * Replace [emoji_id] with <tg-emoji> tag for HTML parse mode
 * @param {string} text - The raw text with [12345] tags
 * @returns {string} - HTML formatted text
 */
export function formatPremiumHTML(text) {
	if (!text) return "";
	
	// Replace [id] with <tg-emoji emoji-id="id">✨</tg-emoji>
	// We use ✨ as a reliable fallback character for the entity
	return text.replace(/\[(\d+)\]/g, (match, id) => {
		return `<tg-emoji emoji-id="${id}">✨</tg-emoji>`;
	});
}

/**
 * Converts basic Markdown (bold, italic, code) to Telegram-friendly HTML 
 * while also parsing [id] premium emoji tags.
 */
export function formatMarkdownToHTML(text) {
	if (!text) return "";
	
	let html = text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");

	// Bold: *text* -> <b>text</b>
	html = html.replace(/\*(.*?)\*/g, "<b>$1</b>");
	
	// Italic: _text_ -> <i>$1</i>
	html = html.replace(/_(.*?)_/g, "<i>$1</i>");
	
	// Code: `text` -> <code>$1</code>
	html = html.replace(/`(.*?)`/g, "<code>$1</code>");
	
	// Premium Emoji: [id]
	return formatPremiumHTML(html);
}

/**
 * Simple text version for buttons (removes HTML tags)
 */
export function stripPremiumTags(text) {
	if (!text) return "";
	return text.replace(/\[(\d+)\]/g, "✨"); // Use star for premium placeholders in buttons
}

/**
 * Returns object for message rendering with HTML support
 */
export function formatPremiumText(text) {
	return { text: formatPremiumHTML(text), parse_mode: "HTML" };
}

/**
 * Advanced Button Formatter (Bot API 8.8+ Supreme Engine)
 * Handles native Styles and Custom Emoji Icons (Native Field) in Buttons.
 */
export function formatButtonMarkup(text, style, callback_data) {
	if (!text) return { text: "", callback_data, style: style || "primary" };

	let currentText = text;
	let iconId = null;

	// Extract [id] pattern if present
	const regex = /\[(\d+)\]/g;
	const match = regex.exec(text);
	
	if (match) {
		iconId = match[1];
		// Remove the [id] tag from the text since it's now a native icon
		currentText = text.replace(regex, "").trim();
	}

	// Map old style names (positive/destructive) to new Telegram Bot API 8.x names
	const styleMap = {
		primary: "primary",
		positive: "success",
		success: "success",
		destructive: "danger",
		danger: "danger",
		warning: "warning"
	};

	return {
		text: currentText,
		callback_data,
		style: styleMap[style] || "primary",
		icon_custom_emoji_id: iconId || undefined
	};
}
