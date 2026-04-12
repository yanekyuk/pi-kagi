/**
 * Tests for src/errors.ts — error classes and normalization
 */

import { describe, expect, it } from "bun:test";
import {
	KagiApiError,
	KagiNetworkError,
	KagiTimeoutError,
	isRetryableStatus,
	statusToUserMessage,
} from "../src/errors.ts";

describe("errors", () => {
	describe("isRetryableStatus", () => {
		it("marks 429 as retryable", () => {
			expect(isRetryableStatus(429)).toBe(true);
		});

		it("marks 500 as retryable", () => {
			expect(isRetryableStatus(500)).toBe(true);
		});

		it("marks 502 as retryable", () => {
			expect(isRetryableStatus(502)).toBe(true);
		});

		it("marks 503 as retryable", () => {
			expect(isRetryableStatus(503)).toBe(true);
		});

		it("marks 400 as not retryable", () => {
			expect(isRetryableStatus(400)).toBe(false);
		});

		it("marks 401 as not retryable", () => {
			expect(isRetryableStatus(401)).toBe(false);
		});

		it("marks 402 as not retryable", () => {
			expect(isRetryableStatus(402)).toBe(false);
		});

		it("marks 403 as not retryable", () => {
			expect(isRetryableStatus(403)).toBe(false);
		});

		it("marks 200 as not retryable", () => {
			expect(isRetryableStatus(200)).toBe(false);
		});
	});

	describe("statusToUserMessage", () => {
		it("returns actionable message for 400", () => {
			const msg = statusToUserMessage(400);
			expect(msg).toContain("400");
			expect(msg).toContain("Bad Request");
		});

		it("returns actionable message for 401", () => {
			const msg = statusToUserMessage(401);
			expect(msg).toContain("401");
			expect(msg).toContain("KAGI_API_KEY");
		});

		it("returns actionable message for 402", () => {
			const msg = statusToUserMessage(402);
			expect(msg).toContain("402");
			expect(msg).toContain("credits");
		});

		it("returns actionable message for 403", () => {
			const msg = statusToUserMessage(403);
			expect(msg).toContain("403");
			expect(msg).toContain("access");
		});

		it("returns actionable message for 404", () => {
			const msg = statusToUserMessage(404);
			expect(msg).toContain("404");
			expect(msg).toContain("Not Found");
		});

		it("returns actionable message for 429", () => {
			const msg = statusToUserMessage(429);
			expect(msg).toContain("429");
			expect(msg).toContain("Rate Limited");
		});

		it("returns actionable message for 500+", () => {
			const msg = statusToUserMessage(500);
			expect(msg).toContain("Server Error");
		});

		it("includes custom body in message when provided", () => {
			const msg = statusToUserMessage(400, "Missing query parameter");
			expect(msg).toContain("Missing query parameter");
		});

		it("returns generic message for unknown status codes", () => {
			const msg = statusToUserMessage(418);
			expect(msg).toContain("418");
		});
	});

	describe("KagiApiError", () => {
		it("creates error with status and message", () => {
			const err = new KagiApiError(401, "Unauthorized");
			expect(err.name).toBe("KagiApiError");
			expect(err.status).toBe(401);
			expect(err.message).toBe("Unauthorized");
			expect(err.retryable).toBe(false);
		});

		it("marks 429 as retryable", () => {
			const err = new KagiApiError(429);
			expect(err.retryable).toBe(true);
		});

		it("marks 500 as retryable", () => {
			const err = new KagiApiError(500);
			expect(err.retryable).toBe(true);
		});

		it("generates message from status when none provided", () => {
			const err = new KagiApiError(402);
			expect(err.message).toContain("402");
		});

		it("stores raw body", () => {
			const err = new KagiApiError(400, "Bad Request", "Missing param");
			expect(err.body).toBe("Missing param");
		});

		it("converts to KagiErrorResponse", () => {
			const err = new KagiApiError(401, "Unauthorized");
			const resp = err.toResponse();
			expect(resp.status).toBe(401);
			expect(resp.message).toBe("Unauthorized");
			expect(resp.retryable).toBe(false);
		});
	});

	describe("KagiNetworkError", () => {
		it("creates error with message", () => {
			const err = new KagiNetworkError("Connection refused");
			expect(err.name).toBe("KagiNetworkError");
			expect(err.message).toContain("Connection refused");
			expect(err.retryable).toBe(true);
		});

		it("stores cause error", () => {
			const cause = new Error("ECONNREFUSED");
			const err = new KagiNetworkError("Connection refused", cause);
			expect(err.cause).toBe(cause);
		});

		it("converts to KagiErrorResponse", () => {
			const err = new KagiNetworkError("Timeout");
			const resp = err.toResponse();
			expect(resp.status).toBe(0);
			expect(resp.retryable).toBe(true);
		});
	});

	describe("KagiTimeoutError", () => {
		it("creates error with message and timeout", () => {
			const err = new KagiTimeoutError("Request timed out", 30000);
			expect(err.name).toBe("KagiTimeoutError");
			expect(err.message).toContain("timed out");
			expect(err.timeoutMs).toBe(30000);
			expect(err.retryable).toBe(true);
		});

		it("converts to KagiErrorResponse", () => {
			const err = new KagiTimeoutError("Timeout", 30000);
			const resp = err.toResponse();
			expect(resp.status).toBe(0);
			expect(resp.retryable).toBe(true);
		});
	});
});