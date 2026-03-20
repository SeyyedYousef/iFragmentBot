import { describe, expect, it } from "vitest";
import { CONFIG } from "../src/core/Config/app.config.js";
import { TheOracle } from "../src/Modules/Market/Application/oracle.service.js";
import { Lexicon } from "../src/Modules/Market/Domain/lexicon.domain.js";

describe("iFragmentBot Modular Sanity Checks", () => {
	it("should load configuration properly", () => {
		expect(CONFIG.BOT_NAME).toBe("@iFragmentBot");
		expect(CONFIG.ADMIN_ID).toBeDefined();
	});

	it("should have a functional Lexicon tier system", () => {
		const result = Lexicon.checkTier("apple");
		expect(result.tier).toBe(0);
		expect(result.context).toBe("Corporate God");

		const unknown = Lexicon.checkTier("random_name_123");
		expect(unknown.tier).toBe(5);
	});

	it("should calculate rarity correctly", async () => {
		const res = await TheOracle.consult("apple", 6.0);
		expect(res.ton).toBeGreaterThanOrEqual(1000000);
		expect(res.rarity.tier).toBe("God Tier");
	});

	it("should handle 4-character hard floor", async () => {
		const res = await TheOracle.consult("abcd", 6.0);
		expect(res.ton).toBeGreaterThanOrEqual(5050);
	});
});
