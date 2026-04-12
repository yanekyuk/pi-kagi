/**
 * Shared formatting utilities for Kagi search/enrich results.
 *
 * Converts normalized SearchResponse and SmallWebResponse objects into
 * citation-friendly text for LLM consumption with numbered references.
 */

import { truncateHead, DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES } from "@mariozechner/pi-coding-agent";
import type { SearchResponse, SmallWebResponse } from "../types.ts";

// ─── Search / Enrich Result Formatting ────────────────────────────

/** Options for formatting search results */
export interface FormatSearchOptions {
	/** Include rank number in citation (for enrich results). Default: false */
	includeRank?: boolean;
	/** Maximum number of related search queries to include. Default: 10 */
	maxRelatedQueries?: number;
}

/**
 * Format a SearchResponse into a citation-friendly text string.
 *
 * Output format:
 * ```
 * [1](https://example.com) — Title Here (Oct 5, 2011)
 *     Snippet text here...
 *
 * [2](https://other.com) — Another Title
 *     Another snippet...
 *
 * Related searches: query1, query2, query3
 *
 * [API balance: $42.50]
 * ```
 *
 * Handles both search and enrich results (enrich includes rank).
 */
export function formatSearchResponse(
	response: SearchResponse,
	options?: FormatSearchOptions,
): string {
	const { includeRank = false, maxRelatedQueries = 10 } = options ?? {};
	const parts: string[] = [];
	let resultNumber = 0;
	const relatedSearches: string[] = [];

	for (const item of response.items) {
		if (item.type === "result") {
			resultNumber++;
			const { url, title, snippet, published, rank } = item.data;

			// Citation line: [N](url) — Title (date) [rank: N]
			let line = `[${resultNumber}](${url}) — ${title}`;
			if (published) {
				line += ` (${formatDate(published)})`;
			}
			if (includeRank && rank !== undefined) {
				line += ` [rank: ${rank}]`;
			}
			parts.push(line);

			// Snippet on the next line (indented)
			if (snippet) {
				parts.push(`    ${snippet}`);
			}
		} else if (item.type === "related") {
			relatedSearches.push(...item.data.queries);
		}
	}

	// Append related searches as a group at the bottom
	if (relatedSearches.length > 0) {
		parts.push("");
		const limited = relatedSearches.slice(0, maxRelatedQueries);
		parts.push(`Related searches: ${limited.join(", ")}`);
	}

	// Append API balance metadata when present
	if (response.meta.apiBalance !== undefined) {
		parts.push(`\n[API balance: $${response.meta.apiBalance.toFixed(2)}]`);
	}

	return parts.join("\n");
}

// ─── Small Web Result Formatting ──────────────────────────────────

/**
 * Format a SmallWebResponse into a bulleted list of entries.
 *
 * Output format:
 * ```
 * • Title Here (author, Oct 5, 2011)
 *   https://example.com
 *   Snippet text here...
 * ```
 */
export function formatSmallWebResponse(response: SmallWebResponse): string {
	if (response.entries.length === 0) {
		return "No Small Web entries found.";
	}

	const parts: string[] = [];

	for (const entry of response.entries) {
		let header = `• ${entry.title}`;
		const meta: string[] = [];
		if (entry.author) meta.push(entry.author);
		if (entry.published) meta.push(formatDate(entry.published));
		if (meta.length > 0) {
			header += ` (${meta.join(", ")})`;
		}
		parts.push(header);
		parts.push(`  ${entry.url}`);
		if (entry.snippet) {
			parts.push(`  ${entry.snippet}`);
		}
	}

	return parts.join("\n");
}

// ─── Helpers ──────────────────────────────────────────────────────

/**
 * Convert an ISO 8601 date string to a human-readable format.
 * Falls back to the raw string if parsing fails.
 */
export function formatDate(isoDate: string): string {
	try {
		const date = new Date(isoDate);
		if (isNaN(date.getTime())) {
			return isoDate;
		}
		return date.toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	} catch {
		return isoDate;
	}
}

/**
 * Count the number of result entries in a SearchResponse.
 */
export function countResults(response: SearchResponse): number {
	return response.items.filter((item) => item.type === "result").length;
}

/**
 * Build a truncation notice for search results.
 */
export function truncationNotice(shown: number, total: number): string {
	return `\n\n[Showing ${shown} of ${total} results. Use a more specific query to narrow results.]`;
}

const utf8Encoder = new TextEncoder();

function countLines(text: string): number {
	return text === "" ? 0 : text.split("\n").length;
}

function countBytes(text: string): number {
	return utf8Encoder.encode(text).length;
}

function truncateHeadWithNotice(
	formatted: string,
	countShown: (content: string) => number,
	buildNotice: (shown: number) => string,
): string {
	let maxLines = DEFAULT_MAX_LINES;
	let maxBytes = DEFAULT_MAX_BYTES;

	for (let attempt = 0; attempt < 3; attempt++) {
		const truncation = truncateHead(formatted, {
			maxLines,
			maxBytes,
		});

		if (!truncation.truncated) {
			return truncation.content;
		}

		const shown = countShown(truncation.content);
		const notice = buildNotice(shown);
		const finalOutput = truncation.content + notice;

		if (countLines(finalOutput) <= DEFAULT_MAX_LINES && countBytes(finalOutput) <= DEFAULT_MAX_BYTES) {
			return finalOutput;
		}

		maxLines = Math.max(1, DEFAULT_MAX_LINES - countLines(notice));
		maxBytes = Math.max(1, DEFAULT_MAX_BYTES - countBytes(notice));
	}

	const truncation = truncateHead(formatted, {
		maxLines,
		maxBytes,
	});
	const shown = countShown(truncation.content);
	return truncation.content + buildNotice(shown);
}

/**
 * Apply the standard head-truncation strategy for search/enrich result text.
 */
export function truncateSearchOutput(formatted: string, totalResults: number): string {
	return truncateHeadWithNotice(
		formatted,
		(content) => (content.match(/^\[\d+\]\(/gm) || []).length,
		(shown) => truncationNotice(shown, totalResults),
	);
}

/**
 * Apply the standard head-truncation strategy for Small Web output.
 */
export function truncateSmallWebOutput(formatted: string, totalEntries: number): string {
	return truncateHeadWithNotice(
		formatted,
		(content) => (content.match(/^• /gm) || []).length,
		(shown) => `\n\n[Showing ${shown} of ${totalEntries} Small Web entries.]`,
	);
}
