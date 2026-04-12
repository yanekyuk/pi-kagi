/**
 * kagi_search tool — Search the web using Kagi's premium search API.
 *
 * Returns a numbered citation list of results with title, snippet, URL, and date.
 * Costs ~$0.025 per query.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { truncateHead, DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES } from "@mariozechner/pi-coding-agent";
import { KagiClient } from "../kagi-client.ts";
import { KagiError } from "../config.ts";
import { formatSearchResponse, countResults, truncationNotice } from "../formatters/results.ts";

/**
 * Register the kagi_search tool with the pi extension API.
 *
 * @param pi - Extension API for registering tools
 * @param getClient - Lazy getter for the shared KagiClient instance.
 *                    Called inside execute() so config resolution is deferred
 *                    until the tool is actually invoked, avoiding hard failures
 *                    during extension bootstrap.
 */
export function registerSearchTool(pi: ExtensionAPI, getClient: () => KagiClient): void {
	pi.registerTool({
		name: "kagi_search",
		label: "Kagi Search",
		description:
			"Search the web using Kagi's premium search API. Returns a numbered list of results " +
			"with title, snippet, URL, and publication date. Also includes related search queries " +
			"when available. Costs ~$0.025 per query.",
		parameters: Type.Object({
			query: Type.String({ description: "Search query" }),
			limit: Type.Optional(
				Type.Number({ description: "Max results to return (1-50)", minimum: 1, maximum: 50 }),
			),
		}),
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			// Check for cancellation before making the API call
			if (signal?.aborted) {
				throw new Error("Search request was cancelled");
			}

			const client = getClient();

			try {
				const response = await client.search(params.query, params.limit);

				// Check if cancelled after the API call
				if (signal?.aborted) {
					throw new Error("Search request was cancelled");
				}

				const totalResults = countResults(response);

				// Handle empty results with a friendly message
				if (totalResults === 0) {
					return {
						content: [{
							type: "text" as const,
							text: `No search results found for "${params.query}".`,
						}],
						details: { query: params.query, totalResults: 0, meta: response.meta },
					};
				}

				const formatted = formatSearchResponse(response);

				// Apply truncation — search results are ordered by relevance,
				// so truncating from the head (keeping the most relevant) is correct
				const truncation = truncateHead(formatted, {
					maxLines: DEFAULT_MAX_LINES,
					maxBytes: DEFAULT_MAX_BYTES,
				});

				let result = truncation.content;

				if (truncation.truncated) {
					// Count how many citation lines survived truncation
					const shownResults = (truncation.content.match(/^\[\d+\]\(/gm) || []).length;
					result += truncationNotice(shownResults, totalResults);
				}

				return {
					content: [{ type: "text" as const, text: result }],
					details: {
						query: params.query,
						totalResults,
						meta: response.meta,
					},
				};
			} catch (err) {
				if (err instanceof KagiError) {
					// Throw to set isError flag — pi requires throw, not return
					throw err;
				}
				// Unexpected errors should propagate
				throw err;
			}
		},
	});
}