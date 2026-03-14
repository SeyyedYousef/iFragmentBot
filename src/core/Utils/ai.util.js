import fetch from "node-fetch";

/**
 * THE AI ORACLE CORE v4.0 — SUPREME REWRITE
 * Powered by Google Gemini (Gemma 3)
 *
 * Complete rewrite with institutional-grade valuation prompt.
 * Fixes: template interpolation, pricing calibration, reasoning quality.
 */
export const AI_ORACLE = {
	/**
	 * Consult the AI for a valuation
	 * @param {string} username - The username to appraise (e.g. "crypto")
	 * @param {number} tonPrice - Current TON price
	 * @param {Object} marketContext - Known market data
	 */
	async consult(username, _tonPrice, marketContext = {}) {
		const cleanName = username.replace("@", "").toLowerCase().trim();
		const len = cleanName.length;
		const apiKey = process.env.GEMINI_API_KEY;

		if (!apiKey) {
			console.error("❌ Missing GEMINI_API_KEY in .env");
			return null;
		}

		console.log(`🧠 AI Oracle v4.0: Analyzing @${cleanName} (${len} chars)...`);

		// ═══════════════════════════════════════════════════════════
		// BUILD CONTEXT-AWARE PROMPT
		// ═══════════════════════════════════════════════════════════

		const lastSaleInfo =
			marketContext.lastSalePrice && marketContext.lastSalePrice !== "None"
				? `${marketContext.lastSalePrice} TON`
				: "No record";

		const statusInfo = marketContext.status || "Unknown";

		const similarInfo =
			marketContext.similarExamples && marketContext.similarExamples.length > 0
				? `\nSIMILAR SOLD NAMES: ${marketContext.similarExamples.slice(0, 3).join(", ")}`
				: "";

		const floorInfo = marketContext.floorPrice
			? `\nFLOOR FOR ${len}-CHAR NAMES: ~${Math.round(marketContext.floorPrice)} TON`
			: "";

		const oraclePrompt = `You are FragmentOracle™ — the world's #1 Telegram username appraiser. You provide institutional-grade financial valuations for Fragment.com usernames.

═══ PLATFORM RULES ═══
• 4-character usernames have a HARD FLOOR of 5,000 TON (Fragment minimum bid). ALL 4-char names ≥ 5,000 TON.
• 5+ character usernames have NO floor. Junk can be worth 0-5 TON.

═══ REAL MARKET PRICE INTELLIGENCE ═══

GRAIL TIER (500K – 5M+ TON):
Global industry-defining single words. These are one-word monopolies.
Examples: @crypto (2M+), @bank (800K+), @gold (700K+), @money (600K+), @trade (500K+), @shop (400K+), @game (400K+), @news (350K+), @auto (300K+)

BLUE CHIP TIER (100K – 500K TON):
Premium English dictionary words with strong brand equity. Adjectives, nouns, and verbs that evoke power, scarcity, or desire.
Examples: @rare (350K), @elite (300K), @king (280K), @wolf (250K), @dark (200K), @fire (200K), @fast (180K), @cool (150K), @moon (150K), @rich (140K), @boss (130K), @lord (120K), @star (120K), @vibe (100K)

LIQUID TIER (10K – 100K TON):
Good dictionary words, popular names, clean brandables.
Examples: @play (80K), @dream (60K), @magic (50K), @alex (45K), @ivan (40K), @adam (35K), @smart (30K), @prime (25K), @swift (20K), @nova (15K)

SPECULATIVE TIER (5K – 10K TON):
4-char gibberish (floor rule only), average 4-letter combos with numbers/underscores.
Examples: @xjqw (5.1K), @k9m2 (5K), @zxcv (5.5K), @qwer (6K)

LOW VALUE TIER (50 – 5K TON):
Longer common words (7+ chars), basic handles without brand power.
Examples: @gaming123 (5), @supermarket (20), @running (800), @weather (1.5K)

JUNK TIER (0 – 50 TON):
Numbers, underscores, misspellings, gibberish (5+ chars).
Examples: @ali_1380 (1), @my_channel_123 (1), @xhgqwpzm (2), @crypto99 (5), @best_shop (3)

═══ VALUATION RULES ═══
1. MEANING FIRST: What does this word mean? Is it a real word? What industry/emotion does it represent?
2. BRAND POWER: Could a Fortune 500 company, crypto project, or influencer brand use this as their identity?
3. SCARCITY: Shorter = rarer. 4-char words are extremely scarce. Real dictionary words in ANY length are premium.
4. DEMAND: Who would buy this? Investors? Brands? Developers? Personal users?
5. LIQUIDITY: How fast would this sell at the stated price?
6. 4-CHAR FLOOR: If length = 4, minimum value is ALWAYS 5,000 TON regardless of quality.
7. JUNK DETECTION: Numbers + underscores + long gibberish (5+ chars) = near zero value.

CRITICAL - definition: NEVER use "Digital Asset". Use the ACTUAL dictionary meaning for real words (Oxford/Cambridge style). For gibberish use "Random String". For personal handles use "Personal Handle".
CRITICAL - similar: ONLY list REAL comparable usernames from the same category. NEVER add @username_bot or @usernamex. Only actual sold or market-comparable handles.
CREATOR ECONOMY: youtuber, tiktoker, streamer, influencer, vlogger, podcaster = LIQUID tier (20K-50K TON).

═══ TARGET USERNAME ═══
Username: "@${cleanName}"
Length: ${len} characters
Status: ${statusInfo}
Last Sale: ${lastSaleInfo}${similarInfo}${floorInfo}

═══ OUTPUT FORMAT ═══
Return ONLY valid JSON. No markdown fences, no conversation, no explanation outside JSON.

{
  "analysis": {
    "verdict": "<GRAIL | BLUE CHIP | LIQUID | SPECULATIVE | JUNK>",
    "reasoning": "<Focus on the word's MEANING, brand power, cultural significance, and market demand. Keep it insightful and specific to THIS username. Do NOT start with length analysis.>",
    "definition": "<What the word/name means. For gibberish: 'Random String'. For personal handles: 'Personal Handle'. For real words: actual definition.>"
  },
  "valuation": {
    "ton": <INTEGER>,
    "confidence": <INTEGER 1-100>,
    "trend": "<ACCUMULATION | STABLE | VOLATILE | DUMP>"
  },
  "best_for": ["<specific use case 1>", "<specific use case 2>"],
  "linguistics": {
    "type": "<Noun | Verb | Adjective | Adverb | Name | Acronym | Gibberish | Alphanumeric | Compound>",
    "meaning": "<concise meaning or 'Random String'>",
    "pronunciation": "<simple phonetic like 'rair' or 'bangk'>",
    "syllables": "<number like '1' or '2', or 'N/A' for gibberish>",
    "recall": <INTEGER 1-10>,
    "typability": <INTEGER 1-10>
  },
  "aura": {
    "archetype": "<The Sovereign | The Pioneer | The Rebel | The Guardian | The Creator | The Strategist | The Collector | Commoner | Placeholder>",
    "vibe": "<one creative mood/energy phrase>"
  },
  "scores": {
    "liquidity": <INTEGER 1-100>,
    "rarity": <INTEGER 1-10>,
    "visual": <INTEGER 1-100>
  },
  "similar": ["@<similar_username_1>", "@<similar_username_2>"]
}

═══ FEW-SHOT CALIBRATION ═══

INPUT: "@rare" | 4 chars
OUTPUT: {"analysis":{"verdict":"BLUE CHIP","reasoning":"'Rare' is a universally powerful English adjective meaning scarce, precious, and exceptional. In crypto and NFT culture, 'rare' is iconic — the foundation of 'rare pepes', NFT rarity scores, and luxury branding. This single-syllable powerhouse commands instant recognition across every market vertical.","definition":"Uncommon, scarce, exceptionally valuable"},"valuation":{"ton":350000,"confidence":88,"trend":"ACCUMULATION"},"best_for":["NFT Marketplace","Luxury Brand","Crypto Collectibles"],"linguistics":{"type":"Adjective","meaning":"Uncommon and valuable","pronunciation":"rair","syllables":"1","recall":10,"typability":10},"aura":{"archetype":"The Sovereign","vibe":"Exclusive, coveted, prestigious"},"scores":{"liquidity":88,"rarity":9,"visual":95},"similar":["@epic","@unique"]}

INPUT: "@ali_1380" | 8 chars
OUTPUT: {"analysis":{"verdict":"JUNK","reasoning":"A generic personal handle combining the common name 'ali' with an underscore and Iranian birth year '1380'. Both underscores and numbers are major devaluation signals. Zero brand appeal, zero commercial demand, zero resale potential.","definition":"Personal Handle"},"valuation":{"ton":1,"confidence":99,"trend":"DUMP"},"best_for":["Personal Use"],"linguistics":{"type":"Alphanumeric","meaning":"Personal name with year","pronunciation":"ah-lee","syllables":"N/A","recall":2,"typability":3},"aura":{"archetype":"Commoner","vibe":"Generic, forgettable"},"scores":{"liquidity":1,"rarity":1,"visual":1},"similar":["@ali1381","@alireza"]}

INPUT: "@bank" | 4 chars
OUTPUT: {"analysis":{"verdict":"GRAIL","reasoning":"The ultimate financial industry keyword. 'Bank' represents the $100T+ global banking sector. Every DeFi protocol, crypto exchange, and fintech startup covets this handle. Maximum brand equity, maximum demand, maximum prestige.","definition":"Financial institution for monetary transactions"},"valuation":{"ton":850000,"confidence":92,"trend":"ACCUMULATION"},"best_for":["DeFi Protocol","Digital Bank","Crypto Exchange"],"linguistics":{"type":"Noun","meaning":"Financial institution","pronunciation":"bangk","syllables":"1","recall":10,"typability":10},"aura":{"archetype":"The Sovereign","vibe":"Institutional, powerful, unshakeable"},"scores":{"liquidity":95,"rarity":10,"visual":98},"similar":["@finance","@money"]}

INPUT: "@xjqw" | 4 chars
OUTPUT: {"analysis":{"verdict":"SPECULATIVE","reasoning":"Random consonant cluster with zero linguistic meaning. No pronunciation, no brand potential, no emotional resonance. Its only value derives from the Fragment 4-character minimum floor rule — pure scarcity speculation.","definition":"Random String"},"valuation":{"ton":5100,"confidence":95,"trend":"STABLE"},"best_for":["Squatting","Web3 Placeholder"],"linguistics":{"type":"Gibberish","meaning":"Random String","pronunciation":"N/A","syllables":"N/A","recall":1,"typability":3},"aura":{"archetype":"Placeholder","vibe":"Empty, inert"},"scores":{"liquidity":8,"rarity":4,"visual":2},"similar":["@xjqx","@zjqw"]}

INPUT: "@dream" | 5 chars
OUTPUT: {"analysis":{"verdict":"LIQUID","reasoning":"'Dream' is a deeply evocative English noun and verb that resonates universally. Associated with aspiration, creativity, and vision — perfect for startups, music brands, and lifestyle projects. Clean 5-letter dictionary word with strong emotional pull and excellent brandability.","definition":"A series of mental images during sleep; an aspiration or goal"},"valuation":{"ton":60000,"confidence":82,"trend":"ACCUMULATION"},"best_for":["Startup Brand","Music Label","Lifestyle Platform"],"linguistics":{"type":"Noun","meaning":"Aspiration, vision, mental imagery","pronunciation":"dreem","syllables":"1","recall":10,"typability":9},"aura":{"archetype":"The Creator","vibe":"Ethereal, aspirational, limitless"},"scores":{"liquidity":78,"rarity":7,"visual":88},"similar":["@vision","@imagine"]}

INPUT: "@youtuber" | 8 chars
OUTPUT: {"analysis":{"verdict":"LIQUID","reasoning":"Creator Economy keyword. A youtuber is a content creator who publishes videos on YouTube. High demand from creators, agencies, and media brands. Strong brand appeal in the $100B+ creator economy.","definition":"A person who creates and publishes video content on YouTube"},"valuation":{"ton":35000,"confidence":85,"trend":"ACCUMULATION"},"best_for":["Content Creator","Media Brand","Influencer"],"linguistics":{"type":"Noun","meaning":"YouTube content creator","pronunciation":"yoo-tyoo-ber","syllables":"3","recall":10,"typability":8},"aura":{"archetype":"The Creator","vibe":"Modern, viral, authentic"},"scores":{"liquidity":75,"rarity":7,"visual":85},"similar":["@streamer","@tiktoker"]}

Now evaluate "@${cleanName}" (${len} chars). OUTPUT JSON ONLY:`;

		// ═══════════════════════════════════════════════════════════
		// API CALL WITH RETRY & MODEL ROTATION
		// ═══════════════════════════════════════════════════════════

		const MAX_RETRIES = 3;
		const MODELS = ["gemma-3-27b-it", "gemma-3-12b-it"];

		for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
			try {
				const model = MODELS[attempt % MODELS.length];
				console.log(`🔌 Attempt ${attempt + 1}/${MAX_RETRIES}: ${model}...`);

				const baseUrl =
					process.env.GEMINI_BASE_URL ||
					"https://generativelanguage.googleapis.com";
				const url = `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;

				const payload = {
					contents: [
						{
							parts: [{ text: oraclePrompt }],
						},
					],
					generationConfig: {
						temperature: 0.2,
						maxOutputTokens: 1024,
					},
				};

				const options = {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
					timeout: 30000,
				};

				if (process.env.HTTPS_PROXY) {
					const { HttpsProxyAgent } = await import("https-proxy-agent");
					options.agent = new HttpsProxyAgent(process.env.HTTPS_PROXY);
				}

				const response = await fetch(url, options);

				if (!response.ok) {
					const errText = await response.text();
					if (response.status === 503 || response.status === 429) {
						console.warn(
							`⚠️ API ${response.status} (Attempt ${attempt + 1}): Retrying in 2s...`,
						);
						await new Promise((r) => setTimeout(r, 2000));
						continue;
					}
					throw new Error(
						`API Error ${response.status}: ${errText.substring(0, 200)}`,
					);
				}

				const data = await response.json();

				if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
					console.warn(`⚠️ Empty AI response (Attempt ${attempt + 1})`);
					continue;
				}

				const text = data.candidates[0].content.parts[0].text.trim();

				// ═══════════════════════════════════════════════
				// ROBUST JSON EXTRACTION
				// ═══════════════════════════════════════════════

				const result = this.extractJSON(text);

				if (result && this.validateResult(result)) {
					console.log(
						`✅ AI Oracle Success (${model}): @${cleanName} → ${result.valuation?.ton?.toLocaleString()} TON`,
					);
					return result;
				}

				console.warn(
					`⚠️ Invalid AI response structure (Attempt ${attempt + 1})`,
				);
			} catch (error) {
				console.error(
					`⚠️ AI Oracle Attempt ${attempt + 1} Failed:`,
					error.message,
				);
				if (attempt < MAX_RETRIES - 1) {
					await new Promise((r) => setTimeout(r, 1500));
				}
			}
		}

		console.error(
			`❌ AI Oracle: All ${MAX_RETRIES} attempts failed for @${cleanName}`,
		);
		return null; // Fallback to heuristic engine
	},

	/**
	 * Extract JSON from AI response text (handles markdown fences, extra text, etc.)
	 */
	extractJSON(text) {
		// Strategy 1: Direct parse (ideal case)
		try {
			return JSON.parse(text);
		} catch (_e) {
			/* continue */
		}

		// Strategy 2: Extract from ```json ... ``` code block
		const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
		if (jsonBlockMatch) {
			try {
				return JSON.parse(jsonBlockMatch[1].trim());
			} catch (_e) {
				/* continue */
			}
		}

		// Strategy 3: Find first { ... } block
		const firstBrace = text.indexOf("{");
		const lastBrace = text.lastIndexOf("}");
		if (firstBrace !== -1 && lastBrace > firstBrace) {
			try {
				return JSON.parse(text.substring(firstBrace, lastBrace + 1));
			} catch (_e) {
				/* continue */
			}
		}

		// Strategy 4: Clean common issues (trailing commas, single quotes)
		try {
			const cleaned = text
				.replace(/```json\s*/g, "")
				.replace(/```\s*/g, "")
				.replace(/,\s*}/g, "}")
				.replace(/,\s*]/g, "]")
				.trim();

			const fb = cleaned.indexOf("{");
			const lb = cleaned.lastIndexOf("}");
			if (fb !== -1 && lb > fb) {
				return JSON.parse(cleaned.substring(fb, lb + 1));
			}
		} catch (_e) {
			/* give up */
		}

		console.error("❌ JSON extraction failed from AI response");
		return null;
	},

	/**
	 * Validate the structure of AI response
	 */
	validateResult(result) {
		if (!result) return false;
		if (!result.analysis?.verdict) return false;
		if (!result.valuation?.ton || typeof result.valuation.ton !== "number")
			return false;
		if (result.valuation.ton <= 0) return false;
		return true;
	},
};
