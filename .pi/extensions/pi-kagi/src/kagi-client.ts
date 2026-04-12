/**
 * Kagi API client — the single source of truth for all HTTP communication
 * with the Kagi API.
 *
 * Handles authentication, timeouts, retries on 429, and response normalization.
 */

import {
	type KagiConfig,
	resolveConfig,
	TIMEOUTS,
	RETRY,
} from "./config.ts";

import {
	KagiApiError,
	KagiNetworkError,
	KagiTimeoutError,
	isRetryableStatus,
	statusToUserMessage,
} from "./errors.ts";

import type {
	Citation,
	FastGPTResponse,
	KagiMeta,
	RawFastGPTData,
	RawKagiResponse,
	RawSearchObject,
	SearchItem,
	SearchResponse,
	SmallWebEntry,
	SmallWebResponse,
	SummarizeResponse,
} from "./types.ts";

// ─── Helpers ─────────────────────────────────────────────────────

/** Sleep for a given number of milliseconds */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Normalise a raw search object into a SearchItem discriminated union */
function normalizeSearchItem(raw: RawSearchObject): SearchItem {
	if (raw.t === 1) {
		return {
			type: "related",
			data: { queries: raw.list },
		};
	}

	// t === 0 (default / search result)
	return {
		type: "result",
		data: {
			url: raw.url,
			title: raw.title,
			snippet: raw.snippet ?? "",
			published: raw.published,
			rank: raw.rank,
			thumbnailUrl: raw.thumbnail?.url,
		},
	};
}

/** Calculate exponential backoff delay */
function backoffDelay(attempt: number): number {
	const delay = RETRY.initialBackoffMs * Math.pow(RETRY.backoffMultiplier, attempt);
	return Math.min(delay, RETRY.maxBackoffMs);
}

// ─── KagiClient ──────────────────────────────────────────────────

export class KagiClient {
	private apiKey: string;
	private baseUrl: string;

	constructor(config?: KagiConfig) {
		const resolved = config ?? resolveConfig();
		this.apiKey = resolved.apiKey;
		this.baseUrl = resolved.baseUrl.replace(/\/+$/, ""); // strip trailing slashes
	}

	// ─── Core Request Helper ────────────────────────────────────

	/**
	 * Make an authenticated request to the Kagi API with retry on 429.
	 *
	 * @param path API path (e.g. "/search")
	 * @param options Request options
	 * @returns Parsed JSON response
	 */
	private async request<T>(
		path: string,
		options: {
			method?: string;
			params?: Record<string, string | number | boolean | undefined>;
			body?: Record<string, unknown>;
			timeout?: number;
		} = {},
	): Promise<T> {
		const { method = "GET", params, body, timeout } = options;

		// Build URL
		const url = new URL(this.baseUrl + path);
		if (params) {
			for (const [key, value] of Object.entries(params)) {
				if (value !== undefined) {
					url.searchParams.set(key, String(value));
				}
			}
		}

		// Request headers
		const headers: Record<string, string> = {
			Authorization: `Bot ${this.apiKey}`,
			Accept: "application/json",
		};
		let requestBody: string | undefined;
		if (body) {
			headers["Content-Type"] = "application/json";
			requestBody = JSON.stringify(body);
		}

		// Retry loop (for 429 rate limiting)
		let lastError: KagiApiError | KagiNetworkError | KagiTimeoutError | undefined;

		for (let attempt = 0; attempt <= RETRY.maxRetries; attempt++) {
			try {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), timeout ?? TIMEOUTS.default);

				const response = await fetch(url.toString(), {
					method,
					headers,
					body: requestBody,
					signal: controller.signal,
				});

				clearTimeout(timeoutId);

				// Handle HTTP error statuses
				if (!response.ok) {
					const responseBody = await response.text().catch(() => "");

					// Retry on 429
					if (response.status === 429 && attempt < RETRY.maxRetries) {
						const delay = backoffDelay(attempt);
						await sleep(delay);
						continue;
					}

					throw new KagiApiError(
						response.status,
						statusToUserMessage(response.status, responseBody),
						responseBody,
					);
				}

				// Parse JSON response
				const data = await response.json();
				return data as T;
			} catch (err) {
				// Re-throw our own errors (but retry on 429 already handled above)
				if (err instanceof KagiApiError) {
					throw err;
				}

				// Abort/timeout
				if (err instanceof DOMException && err.name === "AbortError") {
					throw new KagiTimeoutError(
						`Request to ${path} timed out after ${timeout ?? TIMEOUTS.default}ms`,
						timeout ?? TIMEOUTS.default,
					);
				}

				// Network error — retryable
				if (err instanceof TypeError && err.message.includes("fetch")) {
					lastError = new KagiNetworkError(
						`Network error connecting to ${path}: ${err.message}`,
						err,
					);
					if (attempt < RETRY.maxRetries) {
						const delay = backoffDelay(attempt);
						await sleep(delay);
						continue;
					}
					throw lastError;
				}

				// Unknown errors
				throw new KagiNetworkError(
					`Unexpected error during request to ${path}: ${err instanceof Error ? err.message : String(err)}`,
					err instanceof Error ? err : undefined,
				);
			}
		}

		// Should not reach here, but just in case
		throw lastError ?? new KagiNetworkError("Max retries exceeded");
	}

	// ─── Endpoint Methods ──────────────────────────────────────

	/**
	 * Search the web using Kagi's premium search API.
	 * Endpoint: GET /search
	 */
	async search(query: string, limit?: number): Promise<SearchResponse> {
		const raw = await this.request<RawKagiResponse<RawSearchObject[]>>("/search", {
			params: { q: query, limit },
			timeout: TIMEOUTS.search,
		});

		const meta: KagiMeta = {
			id: raw.meta.id,
			node: raw.meta.node,
			ms: raw.meta.ms,
			apiBalance: raw.meta.api_balance,
		};

		const items: SearchItem[] = (raw.data ?? []).map(normalizeSearchItem);

		return { meta, items };
	}

	/**
	 * Search non-commercial web content (Teclis index).
	 * Endpoint: GET /enrich/web
	 */
	async enrichWeb(query: string): Promise<SearchResponse> {
		const raw = await this.request<RawKagiResponse<RawSearchObject[]>>("/enrich/web", {
			params: { q: query },
			timeout: TIMEOUTS.search,
		});

		const meta: KagiMeta = {
			id: raw.meta.id,
			node: raw.meta.node,
			ms: raw.meta.ms,
			apiBalance: raw.meta.api_balance,
		};

		const items: SearchItem[] = (raw.data ?? []).map(normalizeSearchItem);

		return { meta, items };
	}

	/**
	 * Search non-commercial news/discussions (TinyGem index).
	 * Endpoint: GET /enrich/news
	 */
	async enrichNews(query: string): Promise<SearchResponse> {
		const raw = await this.request<RawKagiResponse<RawSearchObject[]>>("/enrich/news", {
			params: { q: query },
			timeout: TIMEOUTS.search,
		});

		const meta: KagiMeta = {
			id: raw.meta.id,
			node: raw.meta.node,
			ms: raw.meta.ms,
			apiBalance: raw.meta.api_balance,
		};

		const items: SearchItem[] = (raw.data ?? []).map(normalizeSearchItem);

		return { meta, items };
	}

	/**
	 * Get an LLM-generated answer with search-grounded citations.
	 * Endpoint: POST /fastgpt
	 */
	async fastgpt(query: string, options?: { cache?: boolean }): Promise<FastGPTResponse> {
		const body: Record<string, unknown> = { query };
		if (options?.cache !== undefined) {
			body.cache = options.cache;
		}
		// web_search is forced true per API documentation
		body.web_search = true;

		const raw = await this.request<RawKagiResponse<RawFastGPTData>>("/fastgpt", {
			method: "POST",
			body,
			timeout: TIMEOUTS.fastgpt,
		});

		const meta: KagiMeta = {
			id: raw.meta.id,
			node: raw.meta.node,
			ms: raw.meta.ms,
			apiBalance: raw.meta.api_balance,
		};

		const references: Citation[] = (raw.data.references ?? []).map((ref) => ({
			title: ref.title,
			snippet: ref.snippet,
			url: ref.url,
		}));

		return {
			meta,
			output: raw.data.output,
			tokens: raw.data.tokens,
			references,
		};
	}

	/**
	 * Summarize a URL or text document.
	 * Endpoint: POST /summarize
	 */
	async summarize(params: {
		url?: string;
		text?: string;
		engine?: string;
		summary_type?: string;
		target_language?: string;
		cache?: boolean;
	}): Promise<SummarizeResponse> {
		const body: Record<string, unknown> = {};
		if (params.url !== undefined) body.url = params.url;
		if (params.text !== undefined) body.text = params.text;
		if (params.engine !== undefined) body.engine = params.engine;
		if (params.summary_type !== undefined) body.summary_type = params.summary_type;
		if (params.target_language !== undefined) body.target_language = params.target_language;
		if (params.cache !== undefined) body.cache = params.cache;

		const raw = await this.request<RawKagiResponse<{ output: string; tokens: number }>>("/summarize", {
			method: "POST",
			body,
			timeout: TIMEOUTS.summarize,
		});

		const meta: KagiMeta = {
			id: raw.meta.id,
			node: raw.meta.node,
			ms: raw.meta.ms,
			apiBalance: raw.meta.api_balance,
		};

		return {
			meta,
			output: raw.data.output,
			tokens: raw.data.tokens,
		};
	}

	/**
	 * Get Small Web feed entries.
	 * Endpoint: GET /smallweb/feed/ (note: v1 API)
	 *
	 * Small Web uses a different base URL path (/api/v1 instead of /api/v0).
	 */
	async smallweb(limit?: number): Promise<SmallWebResponse> {
		// Small Web is on v1 API
		const smallWebBaseUrl = this.baseUrl.replace("/api/v0", "/api/v1");
		const originalBaseUrl = this.baseUrl;

		// Temporarily swap base URL for this request
		this.baseUrl = smallWebBaseUrl;

		try {
			// Small Web may return JSON or feed format; try JSON first
			const response = await this.request<unknown>("/smallweb/feed/", {
				params: { limit },
				timeout: TIMEOUTS.default,
			});

			// Parse response — smallweb format needs runtime confirmation
			// For now, handle both array-in-data and direct-array patterns
			return normalizeSmallWebResponse(response);
		} finally {
			this.baseUrl = originalBaseUrl;
		}
	}
}

/** Normalize whatever the Small Web feed returns into our standard shape */
function normalizeSmallWebResponse(raw: unknown): SmallWebResponse {
	// If it's null/undefined
	if (!raw || typeof raw !== "object") {
		return { entries: [] };
	}

	// If it's an array directly
	if (Array.isArray(raw)) {
		return {
			entries: raw.map(normalizeSmallWebEntry),
		};
	}

	// If it has a `data` property (standard Kagi envelope)
	const obj = raw as Record<string, unknown>;
	if ("data" in obj) {
		const data = obj.data;
		if (Array.isArray(data)) {
			return {
				entries: data.map(normalizeSmallWebEntry),
			};
		}
		if (data && typeof data === "object") {
			// data might have entries as a nested array
			const dataObj = data as Record<string, unknown>;
			if ("entries" in dataObj && Array.isArray(dataObj.entries)) {
				return {
					entries: dataObj.entries.map(normalizeSmallWebEntry),
				};
			}
		}
	}

	// Unknown format
	return { entries: [] };
}

/** Normalize a single Small Web entry from raw API response */
function normalizeSmallWebEntry(raw: unknown): SmallWebEntry {
	if (!raw || typeof raw !== "object") {
		return { title: "", url: "", snippet: "" };
	}
	const entry = raw as Record<string, unknown>;
	return {
		title: String(entry.title ?? ""),
		url: String(entry.url ?? ""),
		snippet: String(entry.snippet ?? ""),
		published: entry.published ? String(entry.published) : undefined,
		author: entry.author ? String(entry.author) : undefined,
		feedUrl: entry.feedUrl ?? entry.feed_url ?? undefined,
	};
}