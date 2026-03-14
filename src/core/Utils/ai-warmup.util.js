/**
 * AI Warmup Service
 * Coordinates fake conversations between bot accounts to build history
 */

import fetch from "node-fetch";
import { Api } from "telegram";
import * as accountManager from "./accountManagerService.js";

const THEMES = [
	"Crypto Market Chat",
	"NFT Gift Trading",
	"TON Blockchain Future",
	"New Fragment Usernames",
	"General Friendly Chat",
	"Tech Discussion",
];

/**
 * Generate a dialogue script using AI (Token Efficient: 1 Call = Multi Messages)
 * @param {string} theme
 * @returns {Promise<Array<{role: number, text: string}>>}
 */
async function generateDialogue(theme) {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) return null;

	const prompt = `
    Generate a realistic chat conversation between two Telegram users (Person A and Person B).
    Theme: ${theme || "Random Crypto Chat"}
    Context: They are talking about Telegram NFTs, Fragment, or TON.
    
    Rules:
    - Language: English (Premium vibes)
    - Length: 6-10 messages total.
    - Style: Informal, like real users. Use some emojis.
    - Output: JSON array of objects with 'sender' (A or B) and 'text'.
    
    Example:
    [
      {"sender": "A", "text": "Hey, did you see the new Signet Rings on Fragment?"},
      {"sender": "B", "text": "Yeah! Floor price is rising fast. 🚀"},
      {"sender": "A", "text": "I might grab one today."}
    ]
    `;

	try {
		const model = "gemini-1.5-flash"; // Usage of Flash for cost efficiency
		const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				contents: [{ parts: [{ text: prompt }] }],
				generationConfig: { responseMimeType: "application/json" },
			}),
		});

		const data = await response.json();
		const text = data.candidates[0].content.parts[0].text;
		return JSON.parse(text);
	} catch (e) {
		console.error("Warmup Script Error:", e);
		return null;
	}
}

/**
 * Executes a warmup session between two accounts
 */
export async function startWarmupSession(phoneA, phoneB) {
	const clientA = await accountManager.getClientByPhone(phoneA);
	const clientB = await accountManager.getClientByPhone(phoneB);

	if (!clientA || !clientB)
		return { success: false, error: "Clients not found" };

	const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
	const script = await generateDialogue(theme);

	if (!script) return { success: false, error: "Failed to generate script" };

	console.log(`🔥 Starting Warmup: ${phoneA} <-> ${phoneB} (Theme: ${theme})`);

	// Get User B's entity for User A
	const userB = await clientA.getEntity(phoneB).catch(() => null);
	if (!userB) return { success: false, error: "Could not resolve entities" };

	const userA = await clientB.getEntity(phoneA).catch(() => null);

	for (const line of script) {
		const client = line.sender === "A" ? clientA : clientB;
		const target = line.sender === "A" ? userB : userA;

		try {
			await client.sendMessage(target, { message: line.text });

			// Random delay between messages (3-8 seconds)
			const delay = Math.floor(Math.random() * 5000) + 3000;
			await new Promise((r) => setTimeout(r, delay));

			// Mark as read on the other side
			const receiver = line.sender === "A" ? clientB : clientA;
			await receiver.invoke(
				new Api.messages.ReadHistory({
					peer: line.sender === "A" ? userA : userB,
					maxId: 0,
				}),
			);
		} catch (err) {
			console.warn("Warmup Message Error:", err.message);
		}
	}

	return { success: true, theme, messages: script.length };
}

/**
 * Selects pairs and starts global warmup
 */
export async function runGlobalWarmup() {
	const accounts = accountManager.getAccountList().filter((a) => a.connected);
	if (accounts.length < 2)
		return { success: false, error: "Need at least 2 accounts" };

	// Group accounts into pairs
	const pairs = [];
	const shuffled = [...accounts].sort(() => 0.5 - Math.random());

	for (let i = 0; i < shuffled.length - 1; i += 2) {
		pairs.push([shuffled[i].phone, shuffled[i + 1].phone]);
	}

	const results = [];
	for (const [pA, pB] of pairs) {
		const res = await startWarmupSession(pA, pB);
		results.push(res);
	}

	return { success: true, sessions: results.length };
}
