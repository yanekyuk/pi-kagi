/**
 * Normalized TypeScript type contracts for pi-kagi.
 *
 * Raw Kagi API responses are normalized into these types by the client,
 * so tools always work with consistent shapes.
 */

// ─── Common Types ───────────────────────────────────────────────

/** Standardized metadata returned by all Kagi API calls */
export interface KagiMeta {
	id: string;
	node: string;
	ms: number;
	/** Only present for /search */
	apiBalance?: number;
}

// ─── Search Results ─────────────────────────────────────────────

/** Normalized search result — used across all search-type endpoints */
export interface SearchResult {
	url: string;
	title: string;
	/** Empty string if null from API; never undefined */
	snippet: string;
	/** ISO 8601 date string if available */
	published?: string;
	/** Present for enrich results only */
	rank?: number;
	thumbnailUrl?: string;
}

/** Normalized related searches — only from /search */
export interface RelatedSearches {
	queries: string[];
}

/** Discriminated union for search data items */
export type SearchItem =
	| { type: "result"; data: SearchResult }
	| { type: "related"; data: RelatedSearches };

/** Normalized search response */
export interface SearchResponse {
	meta: KagiMeta;
	items: SearchItem[];
}

// ─── FastGPT ───────────────────────────────────────────────────

/** Citation in a FastGPT answer */
export interface Citation {
	title: string;
	snippet: string;
	url: string;
}

/** Normalized FastGPT response */
export interface FastGPTResponse {
	meta: KagiMeta;
	output: string;
	tokens: number;
	references: Citation[];
}

// ─── Summarizer ─────────────────────────────────────────────────

/** Available summarizer engines */
export type SummarizerEngine = "cecil" | "agnes" | "daphne" | "muriel";
// daphne is deprecated (alias for agnes), included for backward compatibility

/** Summary output types */
export type SummaryType = "summary" | "takeaway";

/** Parameters for the summarize endpoint */
export interface SummarizeParams {
	/** URL to summarize (mutually exclusive with text) */
	url?: string;
	/** Text to summarize (mutually exclusive with url) */
	text?: string;
	engine?: SummarizerEngine;
	summary_type?: SummaryType;
	target_language?: string;
	cache?: boolean;
}

/** Normalized summarizer response */
export interface SummarizeResponse {
	meta: KagiMeta;
	output: string;
	tokens: number;
}

// ─── Small Web ──────────────────────────────────────────────────

/** A single Small Web entry */
export interface SmallWebEntry {
	title: string;
	url: string;
	snippet: string;
	published?: string;
	author?: string;
	feedUrl?: string;
}

/** Normalized Small Web response */
export interface SmallWebResponse {
	entries: SmallWebEntry[];
}

// ─── Error ──────────────────────────────────────────────────────

/** Normalized error envelope (mirrors KagiErrorResponse from errors.ts) */
export interface KagiErrorPayload {
	status: number;
	message: string;
	retryable: boolean;
}

// ─── Raw API Types (before normalization) ────────────────────────

/** Raw search object from the Kagi API (before normalization) */
export interface RawSearchResult {
	t: 0;
	url: string;
	title: string;
	snippet?: string | null;
	published?: string;
	thumbnail?: {
		url: string;
		height?: number | null;
		width?: number | null;
	};
	rank?: number;
}

/** Raw related searches object from the Kagi API */
export interface RawRelatedSearches {
	t: 1;
	list: string[];
}

/** Raw search object discriminator */
export type RawSearchObject = RawSearchResult | RawRelatedSearches;

/** Raw FastGPT reference from the Kagi API */
export interface RawFastGPTReference {
	title: string;
	snippet: string;
	url: string;
}

/** Raw FastGPT response data from the Kagi API */
export interface RawFastGPTData {
	output: string;
	tokens: number;
	references: RawFastGPTReference[];
}

/** Raw Kagi API envelope */
export interface RawKagiResponse<T = unknown> {
	meta: {
		id: string;
		node: string;
		ms: number;
		api_balance?: number;
	};
	data: T;
}