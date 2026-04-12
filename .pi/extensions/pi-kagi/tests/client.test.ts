/**
 * Tests for src/kagi-client.ts — request construction, response normalization,
 * and retry logic
 */

import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { KagiClient } from "../src/kagi-client.ts";
import { type RetryConfig, RETRY } from "../src/config.ts";
import { KagiApiError, KagiNetworkError, KagiTimeoutError } from "../src/errors.ts";

// ─── Mock fetch for unit tests ────────────────────────────────────

let fetchMock: {
	status: number;
	body: unknown;
	headers?: Record<string, string>;
	delay?: number;
} | null = null;

const originalFetch = globalThis.fetch;

function mockFetch(status: number, body: unknown, headers?: Record<string, string>) {
	fetchMock = { status, body, headers };
}

function mockFetchWithError() {
	fetchMock = null; // Will trigger a TypeError from fetch
}

const MOCK_API_KEY = "test-key-for-unit-tests";
const MOCK_BASE_URL = "https://kagi.com/api/v0";

describe("KagiClient", () => {
	beforeEach(() => {
		process.env.KAGI_API_KEY = MOCK_API_KEY;
		delete process.env.KAGI_API_BASE_URL;
		fetchMock = null;
	});

	afterEach(() => {
		delete process.env.KAGI_API_KEY;
		delete process.env.KAGI_API_BASE_URL;
	});

	// ─── Helper: install mock fetch ────────────────────────────

	function installMockFetch() {
		globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

			// Simulate delay if configured
			if (fetchMock?.delay) {
				await new Promise((resolve) => setTimeout(resolve, fetchMock.delay));
			}

			// Simulate network error
			if (!fetchMock) {
				throw new TypeError("fetch failed: Network error");
			}

			// Simulate abort (timeout)
			if (init?.signal?.aborted) {
				throw new DOMException("The operation was aborted.", "AbortError");
			}

			const response = new Response(JSON.stringify(fetchMock.body), {
				status: fetchMock.status,
				headers: fetchMock.headers ?? { "Content-Type": "application/json" },
			});
			return response;
		};
	}

	function restoreFetch() {
		globalThis.fetch = originalFetch;
	}

	// ─── Search endpoint tests ────────────────────────────────

	describe("search()", () => {
		it("makes GET request to /search with query parameter", async () => {
			const capturedUrls: string[] = [];
			globalThis.fetch = async (input: RequestInfo | URL) => {
				const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
				capturedUrls.push(url);
				return new Response(
					JSON.stringify({
						meta: { id: "test-id", node: "us-east4", ms: 100 },
						data: [],
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			};

			const client = new KagiClient({ apiKey: MOCK_API_KEY, baseUrl: MOCK_BASE_URL });
			await client.search("test query");

			expect(capturedUrls.length).toBe(1);
			expect(capturedUrls[0]).toContain("/search");
			expect(capturedUrls[0]).toContain("q=test+query");

			restoreFetch();
		});

		it("includes Authorization: Bot header", async () => {
			const capturedInit: RequestInit[] = [];
			globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
				if (init) capturedInit.push(init);
				return new Response(
					JSON.stringify({
						meta: { id: "test-id", node: "us-east4", ms: 100 },
						data: [],
					}),
					{ status: 200 },
				);
			};

			const client = new KagiClient({ apiKey: "my-secret-key", baseUrl: MOCK_BASE_URL });
			await client.search("test");

			expect(capturedInit.length).toBe(1);
			const headers = capturedInit[0].headers as Record<string, string>;
			expect(headers["Authorization"]).toBe("Bot my-secret-key");

			restoreFetch();
		});

		it("normalizes null snippet to empty string", async () => {
			globalThis.fetch = async () => {
				return new Response(
					JSON.stringify({
						meta: { id: "test-id", node: "us-east4", ms: 100 },
						data: [
							{ t: 0, url: "https://example.com", title: "Test", snippet: null },
						],
					}),
					{ status: 200 },
				);
			};

			const client = new KagiClient({ apiKey: MOCK_API_KEY, baseUrl: MOCK_BASE_URL });
			const result = await client.search("test");

			expect(result.items.length).toBe(1);
			expect(result.items[0].type).toBe("result");
			if (result.items[0].type === "result") {
				expect(result.items[0].data.snippet).toBe("");
			}

			restoreFetch();
		});

		it("maps t=0 to result type", async () => {
			globalThis.fetch = async () => {
				return new Response(
					JSON.stringify({
						meta: { id: "test-id", node: "us-east4", ms: 100 },
						data: [
							{ t: 0, url: "https://example.com", title: "Test Result", snippet: "A snippet" },
						],
					}),
					{ status: 200 },
				);
			};

			const client = new KagiClient({ apiKey: MOCK_API_KEY, baseUrl: MOCK_BASE_URL });
			const result = await client.search("test");

			expect(result.items[0].type).toBe("result");
			if (result.items[0].type === "result") {
				expect(result.items[0].data.url).toBe("https://example.com");
				expect(result.items[0].data.title).toBe("Test Result");
				expect(result.items[0].data.snippet).toBe("A snippet");
			}

			restoreFetch();
		});

		it("maps t=1 to related type", async () => {
			globalThis.fetch = async () => {
				return new Response(
					JSON.stringify({
						meta: { id: "test-id", node: "us-east4", ms: 100 },
						data: [
							{ t: 1, list: ["related query 1", "related query 2"] },
						],
					}),
					{ status: 200 },
				);
			};

			const client = new KagiClient({ apiKey: MOCK_API_KEY, baseUrl: MOCK_BASE_URL });
			const result = await client.search("test");

			expect(result.items[0].type).toBe("related");
			if (result.items[0].type === "related") {
				expect(result.items[0].data.queries).toEqual(["related query 1", "related query 2"]);
			}

			restoreFetch();
		});

		it("extracts api_balance from search meta", async () => {
			globalThis.fetch = async () => {
				return new Response(
					JSON.stringify({
						meta: { id: "test-id", node: "us-east4", ms: 100, api_balance: 42.5 },
						data: [],
					}),
					{ status: 200 },
				);
			};

			const client = new KagiClient({ apiKey: MOCK_API_KEY, baseUrl: MOCK_BASE_URL });
			const result = await client.search("test");

			expect(result.meta.apiBalance).toBe(42.5);

			restoreFetch();
		});

		it("includes limit parameter when provided", async () => {
			const capturedUrls: string[] = [];
			globalThis.fetch = async (input: RequestInfo | URL) => {
				const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
				capturedUrls.push(url);
				return new Response(
					JSON.stringify({
						meta: { id: "test-id", node: "us-east4", ms: 100 },
						data: [],
					}),
					{ status: 200 },
				);
			};

			const client = new KagiClient({ apiKey: MOCK_API_KEY, baseUrl: MOCK_BASE_URL });
			await client.search("test", 5);

			expect(capturedUrls[0]).toContain("limit=5");

			restoreFetch();
		});

		it("preserves thumbnail URL in results", async () => {
			globalThis.fetch = async () => {
				return new Response(
					JSON.stringify({
						meta: { id: "test-id", node: "us-east4", ms: 100 },
						data: [
							{
								t: 0,
								url: "https://example.com",
								title: "Test",
								snippet: "Hello",
								thumbnail: { url: "/proxy/img/123", height: 100, width: 200 },
							},
						],
					}),
					{ status: 200 },
				);
			};

			const client = new KagiClient({ apiKey: MOCK_API_KEY, baseUrl: MOCK_BASE_URL });
			const result = await client.search("test");

			expect(result.items[0].type).toBe("result");
			if (result.items[0].type === "result") {
				expect(result.items[0].data.thumbnailUrl).toBe("/proxy/img/123");
			}

			restoreFetch();
		});
	});

	// ─── Enrich endpoints ────────────────────────────────────

	describe("enrichWeb()", () => {
		it("makes GET request to /enrich/web with query", async () => {
			const capturedUrls: string[] = [];
			globalThis.fetch = async (input: RequestInfo | URL) => {
				const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
				capturedUrls.push(url);
				return new Response(
					JSON.stringify({
						meta: { id: "test-id", node: "us-east4", ms: 50 },
						data: [{ t: 0, url: "https://blog.example.com", title: "Blog Post", snippet: "Interesting", rank: 1 }],
					}),
					{ status: 200 },
				);
			};

			const client = new KagiClient({ apiKey: MOCK_API_KEY, baseUrl: MOCK_BASE_URL });
			const result = await client.enrichWeb("test blog");

			expect(capturedUrls[0]).toContain("/enrich/web");
			expect(capturedUrls[0]).toContain("q=test+blog");
			expect(result.items[0].type).toBe("result");
			if (result.items[0].type === "result") {
				expect(result.items[0].data.rank).toBe(1);
			}

			restoreFetch();
		});
	});

	describe("enrichNews()", () => {
		it("makes GET request to /enrich/news with query", async () => {
			const capturedUrls: string[] = [];
			globalThis.fetch = async (input: RequestInfo | URL) => {
				const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
				capturedUrls.push(url);
				return new Response(
					JSON.stringify({
						meta: { id: "test-id", node: "us-east4", ms: 75 },
						data: [{ t: 0, url: "https://news.example.com", title: "News", snippet: null, rank: 3 }],
					}),
					{ status: 200 },
				);
			};

			const client = new KagiClient({ apiKey: MOCK_API_KEY, baseUrl: MOCK_BASE_URL });
			const result = await client.enrichNews("latest news");

			expect(capturedUrls[0]).toContain("/enrich/news");
			// null snippet should become ""
			if (result.items[0].type === "result") {
				expect(result.items[0].data.snippet).toBe("");
			}

			restoreFetch();
		});
	});

	// ─── FastGPT endpoint ─────────────────────────────────────

	describe("fastgpt()", () => {
		it("makes POST request to /fastgpt with query", async () => {
			const capturedBodies: string[] = [];
			globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
				if (init?.body) capturedBodies.push(init.body as string);
				return new Response(
					JSON.stringify({
						meta: { id: "test-id", node: "us-east4", ms: 2000 },
						data: {
							output: "Python is a programming language.",
							tokens: 150,
							references: [
								{ title: "Python Docs", snippet: "Official docs", url: "https://docs.python.org" },
							],
						},
					}),
					{ status: 200 },
				);
			};

			const client = new KagiClient({ apiKey: MOCK_API_KEY, baseUrl: MOCK_BASE_URL });
			const result = await client.fastgpt("What is Python?");

			expect(capturedBodies.length).toBe(1);
			const body = JSON.parse(capturedBodies[0]);
			expect(body.query).toBe("What is Python?");
			expect(body.web_search).toBe(true); // forced true per API docs

			expect(result.output).toBe("Python is a programming language.");
			expect(result.tokens).toBe(150);
			expect(result.references.length).toBe(1);
			expect(result.references[0].title).toBe("Python Docs");

			restoreFetch();
		});

		it("sends cache parameter when explicitly set", async () => {
			const capturedBodies: string[] = [];
			globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
				if (init?.body) capturedBodies.push(init.body as string);
				return new Response(
					JSON.stringify({
						meta: { id: "test-id", node: "us-east4", ms: 500 },
						data: { output: "answer", tokens: 10, references: [] },
					}),
					{ status: 200 },
				);
			};

			const client = new KagiClient({ apiKey: MOCK_API_KEY, baseUrl: MOCK_BASE_URL });
			await client.fastgpt("test", { cache: false });

			const body = JSON.parse(capturedBodies[0]);
			expect(body.cache).toBe(false);

			restoreFetch();
		});
	});

	// ─── Summarize endpoint ────────────────────────────────────

	describe("summarize()", () => {
		it("makes POST request to /summarize with URL", async () => {
			const capturedBodies: string[] = [];
			globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
				if (init?.body) capturedBodies.push(init.body as string);
				return new Response(
					JSON.stringify({
						meta: { id: "test-id", node: "us-east4", ms: 3000 },
						data: { output: "This is a summary.", tokens: 500 },
					}),
					{ status: 200 },
				);
			};

			const client = new KagiClient({ apiKey: MOCK_API_KEY, baseUrl: MOCK_BASE_URL });
			const result = await client.summarize({ url: "https://example.com/article" });

			const body = JSON.parse(capturedBodies[0]);
			expect(body.url).toBe("https://example.com/article");

			expect(result.output).toBe("This is a summary.");
			expect(result.tokens).toBe(500);

			restoreFetch();
		});

		it("sends engine and summary_type when provided", async () => {
			const capturedBodies: string[] = [];
			globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
				if (init?.body) capturedBodies.push(init.body as string);
				return new Response(
					JSON.stringify({
						meta: { id: "test-id", node: "us-east4", ms: 1000 },
						data: { output: "Takeaway summary", tokens: 200 },
					}),
					{ status: 200 },
				);
			};

			const client = new KagiClient({ apiKey: MOCK_API_KEY, baseUrl: MOCK_BASE_URL });
			await client.summarize({
				url: "https://example.com",
				engine: "agnes",
				summary_type: "takeaway",
			});

			const body = JSON.parse(capturedBodies[0]);
			expect(body.engine).toBe("agnes");
			expect(body.summary_type).toBe("takeaway");

			restoreFetch();
		});
	});

	// ─── Error handling ────────────────────────────────────────

	// Fast retry config for tests (no real delays)
	const fastRetry: RetryConfig = { maxRetries: 2, initialBackoffMs: 1, backoffMultiplier: 1, maxBackoffMs: 10 };

	describe("error handling", () => {
		it("throws KagiApiError on 401 response", async () => {
			globalThis.fetch = async () => {
				return new Response("Unauthorized", { status: 401 });
			};

			const client = new KagiClient({ apiKey: MOCK_API_KEY, baseUrl: MOCK_BASE_URL });
			try {
				await client.search("test");
				expect.unreachable("Should have thrown");
			} catch (err) {
				expect(err).toBeInstanceOf(KagiApiError);
				expect((err as KagiApiError).status).toBe(401);
				expect((err as KagiApiError).retryable).toBe(false);
			}

			restoreFetch();
		});

		it("throws KagiApiError on 402 response", async () => {
			globalThis.fetch = async () => {
				return new Response("Insufficient credit", { status: 402 });
			};

			const client = new KagiClient({ apiKey: MOCK_API_KEY, baseUrl: MOCK_BASE_URL });
			try {
				await client.search("test");
				expect.unreachable("Should have thrown");
			} catch (err) {
				expect(err).toBeInstanceOf(KagiApiError);
				expect((err as KagiApiError).status).toBe(402);
			}

			restoreFetch();
		});

		it("retries on 429 response and eventually succeeds", async () => {
			let callCount = 0;
			globalThis.fetch = async () => {
				callCount++;
				if (callCount < 3) {
					return new Response("Rate limited", { status: 429 });
				}
				return new Response(
					JSON.stringify({
						meta: { id: "test-id", node: "us-east4", ms: 100 },
						data: [],
					}),
					{ status: 200 },
				);
			};

			const client = new KagiClient({ apiKey: MOCK_API_KEY, baseUrl: MOCK_BASE_URL, retry: fastRetry });
			const result = await client.search("test");

			// Should succeed after retries (call 1 = 429, call 2 = 429, call 3 = 200)
			expect(callCount).toBe(3);
			expect(result.items).toEqual([]);

			restoreFetch();
		});

		it("throws KagiApiError after max retries on 429", async () => {
			let callCount = 0;
			globalThis.fetch = async () => {
				callCount++;
				return new Response("Rate limited", { status: 429 });
			};

			const client = new KagiClient({ apiKey: MOCK_API_KEY, baseUrl: MOCK_BASE_URL, retry: fastRetry });
			try {
				await client.search("test");
				expect.unreachable("Should have thrown");
			} catch (err) {
				expect(err).toBeInstanceOf(KagiApiError);
				expect((err as KagiApiError).status).toBe(429);
			}

			// Should be maxRetries + 1 initial attempt
			expect(callCount).toBe(fastRetry.maxRetries + 1);

			restoreFetch();
		});

		it("throws KagiTimeoutError on abort/timeout", async () => {
			globalThis.fetch = async () => {
				throw new DOMException("The operation was aborted.", "AbortError");
			};

			const client = new KagiClient({ apiKey: MOCK_API_KEY, baseUrl: MOCK_BASE_URL });
			try {
				await client.search("test");
				expect.unreachable("Should have thrown");
			} catch (err) {
				expect(err).toBeInstanceOf(KagiTimeoutError);
			}

			restoreFetch();
		});

		it("retries on network error and eventually succeeds", async () => {
			let callCount = 0;
			globalThis.fetch = async () => {
				callCount++;
				if (callCount < 2) {
					throw new TypeError("fetch failed: ECONNREFUSED");
				}
				return new Response(
					JSON.stringify({
						meta: { id: "test-id", node: "us-east4", ms: 100 },
						data: [],
					}),
					{ status: 200 },
				);
			};

			const client = new KagiClient({ apiKey: MOCK_API_KEY, baseUrl: MOCK_BASE_URL, retry: fastRetry });
			const result = await client.search("test");

			expect(callCount).toBe(2);
			expect(result.items).toEqual([]);

			restoreFetch();
		});

		it("throws KagiNetworkError after max retries on network failure", async () => {
			globalThis.fetch = async () => {
				throw new TypeError("fetch failed: ECONNREFUSED");
			};

			const client = new KagiClient({ apiKey: MOCK_API_KEY, baseUrl: MOCK_BASE_URL, retry: fastRetry });
			try {
				await client.search("test");
				expect.unreachable("Should have thrown");
			} catch (err) {
				expect(err).toBeInstanceOf(KagiNetworkError);
			}

			restoreFetch();
		});
	});

	// ─── Small Web endpoint ────────────────────────────────────

	describe("smallweb()", () => {
		it("makes GET request to /smallweb/feed/ with v1 base URL", async () => {
			const capturedUrls: string[] = [];
			globalThis.fetch = async (input: RequestInfo | URL) => {
				const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
				capturedUrls.push(url);
				return new Response(
					JSON.stringify({
						meta: { id: "test-id", node: "us-east4", ms: 100 },
						data: [],
					}),
					{ status: 200 },
				);
			};

			const client = new KagiClient({ apiKey: MOCK_API_KEY, baseUrl: MOCK_BASE_URL });
			await client.smallweb(5);

			expect(capturedUrls[0]).toContain("/api/v1/smallweb/feed/");
			expect(capturedUrls[0]).toContain("limit=5");

			restoreFetch();
		});
	});

	// ─── Configuration ─────────────────────────────────────────

	describe("configuration", () => {
		it("strips trailing slashes from base URL", async () => {
			globalThis.fetch = async () => {
				return new Response(
					JSON.stringify({
						meta: { id: "test-id", node: "us-east4", ms: 100 },
						data: [],
					}),
					{ status: 200 },
				);
			};

			const client = new KagiClient({ apiKey: MOCK_API_KEY, baseUrl: "https://kagi.com/api/v0/" });
			// The URL should not have double slashes
			const urls: string[] = [];
			const origFetch = globalThis.fetch;
			globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
				urls.push(url);
				return origFetch(input, init);
			};

			await client.search("test");
			expect(urls[0]).not.toContain("//search");

			restoreFetch();
		});

		it("uses KAGI_API_KEY env var when constructing client without config", () => {
			process.env.KAGI_API_KEY = "env-key-123";
			const client = new KagiClient();
			// Client should work — the key is verified at resolve time
			expect(client).toBeDefined();
		});
	});
});