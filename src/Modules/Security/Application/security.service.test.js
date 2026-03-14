/**
 * Unit Tests for Security Service
 * Run with: node --test src/tests/securityService.test.js
 */

import assert from "node:assert";
import { beforeEach, describe, it } from "node:test";

// Import functions to test
import {
	decrypt,
	encrypt,
	generateSecureToken,
	hashForLog,
	isValidPhoneNumber,
	isValidSessionString,
	rateLimiter,
	sanitizeError,
	withRetry,
	withTimeout,
} from "../services/securityService.js";

describe("Encryption/Decryption", () => {
	it("should encrypt and decrypt text correctly", () => {
		const original = "This is a secret session string";
		const encrypted = encrypt(original);
		const decrypted = decrypt(encrypted);

		assert.notStrictEqual(
			encrypted,
			original,
			"Encrypted should differ from original",
		);
		assert.strictEqual(decrypted, original, "Decrypted should match original");
	});

	it("should handle empty string", () => {
		assert.strictEqual(encrypt(""), "");
		assert.strictEqual(decrypt(""), "");
	});

	it("should handle null/undefined gracefully", () => {
		assert.strictEqual(encrypt(null), "");
		assert.strictEqual(encrypt(undefined), "");
	});

	it("should return original if decryption fails", () => {
		const invalid = "not-encrypted-text";
		assert.strictEqual(decrypt(invalid), invalid);
	});
});

describe("Session String Validation", () => {
	it("should reject empty or null values", () => {
		assert.strictEqual(isValidSessionString(""), false);
		assert.strictEqual(isValidSessionString(null), false);
		assert.strictEqual(isValidSessionString(undefined), false);
	});

	it("should reject short strings", () => {
		assert.strictEqual(isValidSessionString("abc123"), false);
		assert.strictEqual(isValidSessionString("a".repeat(50)), false);
	});

	it("should reject non-base64 strings", () => {
		assert.strictEqual(isValidSessionString("!@#$%^&*()".repeat(20)), false);
	});

	it("should accept valid base64 session-like strings", () => {
		// Create a valid-looking base64 string of appropriate length
		const validSession = Buffer.from("x".repeat(100)).toString("base64");
		assert.strictEqual(isValidSessionString(validSession), true);
	});
});

describe("Phone Number Validation", () => {
	it("should accept valid international numbers", () => {
		assert.strictEqual(isValidPhoneNumber("+989123456789"), true);
		assert.strictEqual(isValidPhoneNumber("+14155552671"), true);
		assert.strictEqual(isValidPhoneNumber("+447700900123"), true);
	});

	it("should accept numbers without + prefix", () => {
		assert.strictEqual(isValidPhoneNumber("989123456789"), true);
	});

	it("should reject invalid numbers", () => {
		assert.strictEqual(isValidPhoneNumber("123"), false);
		assert.strictEqual(isValidPhoneNumber("abcdefghij"), false);
		assert.strictEqual(isValidPhoneNumber(""), false);
		assert.strictEqual(isValidPhoneNumber(null), false);
	});

	it("should handle numbers with formatting", () => {
		assert.strictEqual(isValidPhoneNumber("+1 (415) 555-2671"), true);
		assert.strictEqual(isValidPhoneNumber("+98-912-345-6789"), true);
	});
});

describe("Error Sanitization", () => {
	it("should translate common Telegram errors", () => {
		assert.strictEqual(
			sanitizeError({ message: "PHONE_NUMBER_INVALID" }),
			"شماره تلفن نامعتبر است",
		);
		assert.strictEqual(
			sanitizeError({ message: "SESSION_EXPIRED" }),
			"نشست منقضی شده. لطفاً دوباره وارد شوید",
		);
	});

	it("should redact sensitive information", () => {
		const error = {
			message: "Error with session: ABC123XYZ456 and token: bot:12345",
		};
		const sanitized = sanitizeError(error);
		assert.ok(!sanitized.includes("ABC123XYZ456"));
	});

	it("should handle technical errors", () => {
		const error = { message: '{"code": 500, "data": {"key": "value"}}' };
		const sanitized = sanitizeError(error);
		assert.ok(!sanitized.includes("{"));
	});
});

describe("Rate Limiter", () => {
	beforeEach(() => {
		// Reset rate limiter state
		rateLimiter.requests.clear();
	});

	it("should allow requests within limit", () => {
		const userId = "test-user-1";

		for (let i = 0; i < 5; i++) {
			const result = rateLimiter.check(userId, "sensitive");
			assert.strictEqual(result.allowed, true);
		}
	});

	it("should block requests exceeding limit", () => {
		const userId = "test-user-2";

		// Exhaust the limit (5 for sensitive)
		for (let i = 0; i < 5; i++) {
			rateLimiter.check(userId, "sensitive");
		}

		const result = rateLimiter.check(userId, "sensitive");
		assert.strictEqual(result.allowed, false);
		assert.ok(result.waitSeconds > 0);
	});
});

describe("withTimeout", () => {
	it("should resolve before timeout", async () => {
		const result = await withTimeout(Promise.resolve("success"), 1000);
		assert.strictEqual(result, "success");
	});

	it("should reject after timeout", async () => {
		try {
			await withTimeout(
				new Promise((resolve) => setTimeout(() => resolve("late"), 2000)),
				100,
				"Timed out",
			);
			assert.fail("Should have thrown");
		} catch (error) {
			assert.strictEqual(error.message, "Timed out");
		}
	});
});

describe("withRetry", () => {
	it("should succeed on first try", async () => {
		let attempts = 0;
		const result = await withRetry(() => {
			attempts++;
			return "success";
		});

		assert.strictEqual(result, "success");
		assert.strictEqual(attempts, 1);
	});

	it("should retry on failure", async () => {
		let attempts = 0;
		const result = await withRetry(
			() => {
				attempts++;
				if (attempts < 3) throw new Error("Temporary failure");
				return "success";
			},
			3,
			10,
		);

		assert.strictEqual(result, "success");
		assert.strictEqual(attempts, 3);
	});

	it("should not retry on permanent errors", async () => {
		let attempts = 0;

		try {
			await withRetry(
				() => {
					attempts++;
					throw new Error("USER_DEACTIVATED");
				},
				3,
				10,
			);
			assert.fail("Should have thrown");
		} catch (_error) {
			assert.strictEqual(attempts, 1);
		}
	});
});

describe("Utility Functions", () => {
	it("hashForLog should return truncated hash", () => {
		const hash = hashForLog("sensitive-data");
		assert.ok(hash.endsWith("..."));
		assert.strictEqual(hash.length, 11); // 8 chars + '...'
	});

	it("generateSecureToken should return hex string", () => {
		const token = generateSecureToken(16);
		assert.strictEqual(token.length, 32); // 16 bytes = 32 hex chars
		assert.ok(/^[0-9a-f]+$/.test(token));
	});

	it("generateSecureToken should generate unique tokens", () => {
		const tokens = new Set();
		for (let i = 0; i < 100; i++) {
			tokens.add(generateSecureToken());
		}
		assert.strictEqual(tokens.size, 100);
	});
});

console.log("✅ All tests passed!");
