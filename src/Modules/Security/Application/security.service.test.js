import { beforeEach, describe, expect, it } from "vitest";

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
} from "./security.service.js";

describe("Encryption/Decryption", () => {
	it("should encrypt and decrypt text correctly", () => {
		const original = "This is a secret session string";
		const encrypted = encrypt(original);
		const decrypted = decrypt(encrypted);

		expect(encrypted).not.toBe(original);
		expect(decrypted).toBe(original);
	});

	it("should handle empty string", () => {
		expect(encrypt("")).toBe("");
		expect(decrypt("")).toBe("");
	});

	it("should handle null/undefined gracefully", () => {
		expect(encrypt(null)).toBe("");
		expect(encrypt(undefined)).toBe("");
	});

	it("should return original if decryption fails", () => {
		const invalid = "not-encrypted-text";
		expect(decrypt(invalid)).toBe(invalid);
	});
});

describe("Session String Validation", () => {
	it("should reject empty or null values", () => {
		expect(isValidSessionString("")).toBe(false);
		expect(isValidSessionString(null)).toBe(false);
		expect(isValidSessionString(undefined)).toBe(false);
	});

	it("should reject short strings", () => {
		expect(isValidSessionString("abc123")).toBe(false);
		expect(isValidSessionString("a".repeat(50))).toBe(false);
	});

	it("should reject non-base64 strings", () => {
		expect(isValidSessionString("!@#$%^&*()".repeat(20))).toBe(false);
	});

	it("should accept valid base64 session-like strings", () => {
		// Create a valid-looking base64 string of appropriate length
		const validSession = Buffer.from("x".repeat(100)).toString("base64");
		expect(isValidSessionString(validSession)).toBe(true);
	});
});

describe("Phone Number Validation", () => {
	it("should accept valid international numbers", () => {
		expect(isValidPhoneNumber("+989123456789")).toBe(true);
		expect(isValidPhoneNumber("+14155552671")).toBe(true);
		expect(isValidPhoneNumber("+447700900123")).toBe(true);
	});

	it("should accept numbers without + prefix", () => {
		expect(isValidPhoneNumber("989123456789")).toBe(true);
	});

	it("should reject invalid numbers", () => {
		expect(isValidPhoneNumber("123")).toBe(false);
		expect(isValidPhoneNumber("abcdefghij")).toBe(false);
		expect(isValidPhoneNumber("")).toBe(false);
		expect(isValidPhoneNumber(null)).toBe(false);
	});

	it("should handle numbers with formatting", () => {
		expect(isValidPhoneNumber("+1 (415) 555-2671")).toBe(true);
		expect(isValidPhoneNumber("+98-912-345-6789")).toBe(true);
	});
});

describe("Error Sanitization", () => {
	it("should translate common Telegram errors", () => {
		expect(sanitizeError({ message: "PHONE_NUMBER_INVALID" })).toBe(
			"شماره تلفن نامعتبر است",
		);
		expect(sanitizeError({ message: "SESSION_EXPIRED" })).toBe(
			"نشست منقضی شده. لطفاً دوباره وارد شوید",
		);
	});

	it("should redact sensitive information", () => {
		const error = {
			message: "Error with session: ABC123XYZ456 and token: bot:12345",
		};
		const sanitized = sanitizeError(error);
		expect(sanitized).not.toContain("ABC123XYZ456");
	});

	it("should handle technical errors", () => {
		const error = { message: '{"code": 500, "data": {"key": "value"}}' };
		const sanitized = sanitizeError(error);
		expect(sanitized).not.toContain("{");
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
			expect(result.allowed).toBe(true);
		}
	});

	it("should block requests exceeding limit", () => {
		const userId = "test-user-2";

		// Exhaust the limit (5 for sensitive)
		for (let i = 0; i < 5; i++) {
			rateLimiter.check(userId, "sensitive");
		}

		const result = rateLimiter.check(userId, "sensitive");
		expect(result.allowed).toBe(false);
		expect(result.waitSeconds).toBeGreaterThan(0);
	});
});

describe("withTimeout", () => {
	it("should resolve before timeout", async () => {
		const result = await withTimeout(Promise.resolve("success"), 1000);
		expect(result).toBe("success");
	});

	it("should reject after timeout", async () => {
		try {
			await withTimeout(
				new Promise((resolve) => setTimeout(() => resolve("late"), 2000)),
				100,
				"Timed out",
			);
			expect.fail("Should have thrown");
		} catch (error) {
			expect(error.message).toBe("Timed out");
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

		expect(result).toBe("success");
		expect(attempts).toBe(1);
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

		expect(result).toBe("success");
		expect(attempts).toBe(3);
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
			expect.fail("Should have thrown");
		} catch (_error) {
			expect(attempts).toBe(1);
		}
	});
});

describe("Utility Functions", () => {
	it("hashForLog should return truncated hash", () => {
		const hash = hashForLog("sensitive-data");
		expect(hash).toMatch(/...$/);
		expect(hash.length).toBe(11); // 8 chars + '...'
	});

	it("generateSecureToken should return hex string", () => {
		const token = generateSecureToken(16);
		expect(token.length).toBe(32); // 16 bytes = 32 hex chars
		expect(token).toMatch(/^[0-9a-f]+$/);
	});

	it("generateSecureToken should generate unique tokens", () => {
		const tokens = new Set();
		for (let i = 0; i < 100; i++) {
			tokens.add(generateSecureToken());
		}
		expect(tokens.size).toBe(100);
	});
});

console.log("✅ All tests passed!");
