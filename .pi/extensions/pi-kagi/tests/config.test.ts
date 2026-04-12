/**
 * Tests for src/config.ts — config resolution and missing-key behavior
 */

import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import {
	resolveConfig,
	validateConfig,
	KagiConfigError,
	KAGI_API_BASE_URL,
	TIMEOUTS,
	RETRY,
} from "../src/config.ts";

describe("config", () => {
	const originalKey = process.env.KAGI_API_KEY;
	const originalBaseUrl = process.env.KAGI_API_BASE_URL;

	beforeEach(() => {
		// Clean env between tests
		delete process.env.KAGI_API_KEY;
		delete process.env.KAGI_API_BASE_URL;
	});

	afterEach(() => {
		// Restore original env
		if (originalKey !== undefined) process.env.KAGI_API_KEY = originalKey;
		else delete process.env.KAGI_API_KEY;
		if (originalBaseUrl !== undefined) process.env.KAGI_API_BASE_URL = originalBaseUrl;
		else delete process.env.KAGI_API_BASE_URL;
	});

	describe("resolveConfig", () => {
		it("resolves configuration from KAGI_API_KEY environment variable", () => {
			process.env.KAGI_API_KEY = "test-api-key-123";
			const config = resolveConfig();
			expect(config.apiKey).toBe("test-api-key-123");
			expect(config.baseUrl).toBe(KAGI_API_BASE_URL);
		});

		it("trims whitespace from API key", () => {
			process.env.KAGI_API_KEY = "  test-api-key  ";
			const config = resolveConfig();
			expect(config.apiKey).toBe("test-api-key");
		});

		it("uses default base URL when KAGI_API_BASE_URL is not set", () => {
			process.env.KAGI_API_KEY = "test-key";
			const config = resolveConfig();
			expect(config.baseUrl).toBe("https://kagi.com/api/v0");
		});

		it("uses custom base URL from KAGI_API_BASE_URL environment variable", () => {
			process.env.KAGI_API_KEY = "test-key";
			process.env.KAGI_API_BASE_URL = "https://custom.kagi.example.com/api/v0";
			const config = resolveConfig();
			expect(config.baseUrl).toBe("https://custom.kagi.example.com/api/v0");
		});

		it("trims whitespace from base URL", () => {
			process.env.KAGI_API_KEY = "test-key";
			process.env.KAGI_API_BASE_URL = "  https://kagi.example.com/api/v0  ";
			const config = resolveConfig();
			expect(config.baseUrl).toBe("https://kagi.example.com/api/v0");
		});

		it("throws KagiConfigError when KAGI_API_KEY is not set", () => {
			expect(() => resolveConfig()).toThrow(KagiConfigError);
		});

		it("throws KagiConfigError with helpful message when key is missing", () => {
			try {
				resolveConfig();
				expect.unreachable("Should have thrown");
			} catch (err) {
				expect(err).toBeInstanceOf(KagiConfigError);
				expect((err as KagiConfigError).name).toBe("KagiConfigError");
				expect((err as KagiConfigError).message).toContain("KAGI_API_KEY");
				expect((err as KagiConfigError).message).toContain("https://kagi.com/settings?p=api");
			}
		});

		it("throws KagiConfigError when KAGI_API_KEY is empty string", () => {
			process.env.KAGI_API_KEY = "";
			expect(() => resolveConfig()).toThrow(KagiConfigError);
		});

		it("throws KagiConfigError when KAGI_API_KEY is whitespace only", () => {
			process.env.KAGI_API_KEY = "   ";
			expect(() => resolveConfig()).toThrow(KagiConfigError);
		});
	});

	describe("validateConfig", () => {
		it("returns valid result with config when key is present", () => {
			process.env.KAGI_API_KEY = "valid-key";
			const result = validateConfig();
			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.config.apiKey).toBe("valid-key");
				expect(result.config.baseUrl).toBe(KAGI_API_BASE_URL);
			}
		});

		it("returns invalid result with error when key is missing", () => {
			const result = validateConfig();
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toBeInstanceOf(KagiConfigError);
			}
		});
	});

	describe("constants", () => {
		it("has expected timeout defaults", () => {
			expect(TIMEOUTS.search).toBe(30_000);
			expect(TIMEOUTS.fastgpt).toBe(60_000);
			expect(TIMEOUTS.summarize).toBe(60_000);
			expect(TIMEOUTS.default).toBe(30_000);
		});

		it("has expected retry defaults", () => {
			expect(RETRY.maxRetries).toBe(3);
			expect(RETRY.initialBackoffMs).toBe(1_000);
			expect(RETRY.backoffMultiplier).toBe(2);
			expect(RETRY.maxBackoffMs).toBe(30_000);
		});
	});
});