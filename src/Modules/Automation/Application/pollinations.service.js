import fetch from "node-fetch";
import {
	CONFIG,
	IMAGE_PROMPT_TEMPLATE,
	SYSTEM_PROMPT,
} from "../../../core/Config/app.config.js";

/**
 * Generate analysis text using Pollinations.ai text API
 * @param {string} username - The username to analyze
 * @returns {Promise<string>} - The generated analysis text
 */
export async function generateAnalysis(username) {
	const cleanUsername = username.replace("@", "").trim();
	const apiKey = CONFIG.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

	if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE") {
		console.warn("⚠️ No Gemini API Key - Falling back to Pollinations for analysis.");
		const userPrompt = `Analyze this Telegram Fragment username: @${cleanUsername}. Generate a complete analysis.`;
		const fallbackUrl = `${CONFIG.POLLINATIONS_TEXT_API}/${encodeURIComponent(userPrompt)}?system=${encodeURIComponent(SYSTEM_PROMPT)}&model=openai`;
		const resp = await fetch(fallbackUrl);
		return await resp.text();
	}

	const prompt = `Analyze this Telegram Fragment username: @${cleanUsername}
Context: ${SYSTEM_PROMPT}

Your task: Generate a comprehensive, premium analysis.
Focus on: Linguistic rarity, brand potential, and investment value.
Tone: Expert, strategist, sophisticated.
Format: HTML-friendly Markdown.`;

	try {
		const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				contents: [{ parts: [{ text: prompt }] }],
				generationConfig: { temperature: 0.8, maxOutputTokens: 1000 },
			}),
		});

		if (response.ok) {
			const data = await response.json();
			return data.candidates?.[0]?.content?.parts?.[0]?.text || "Analysis generated.";
		}
		throw new Error(`Gemini Error: ${response.status}`);
	} catch (error) {
		console.error("Gemini Analysis failed:", error.message);
		throw error;
	}
}

/**
 * Generate image URL using Pollinations.ai image API
 * @param {string} username - The username to display in image
 * @returns {string} - The image URL
 */
export function generateImageUrl(username) {
	const cleanUsername = username.replace("@", "").trim();
	const prompt = IMAGE_PROMPT_TEMPLATE(cleanUsername);

	// Pollinations.ai image endpoint - returns direct image URL
	const imageUrl = `${CONFIG.POLLINATIONS_IMAGE_API}/${encodeURIComponent(prompt)}?width=1024&height=768&model=flux&nologo=true`;

	return imageUrl;
}

/**
 * Pre-fetch image to ensure it's ready
 * @param {string} imageUrl - The image URL to prefetch
 * @returns {Promise<Buffer>} - The image buffer
 */
export async function fetchImage(imageUrl) {
	try {
		const response = await fetch(imageUrl);

		if (!response.ok) {
			throw new Error(`Image fetch error: ${response.status}`);
		}

		const arrayBuffer = await response.arrayBuffer();
		return Buffer.from(arrayBuffer);
	} catch (error) {
		console.error("Error fetching image:", error);
		throw error;
	}
}
