/**
 * kagi_search tool — Search the web using Kagi's premium search API.
 *
 * Returns a numbered citation list of results with title, snippet, URL, and date.
 * Costs ~$0.025 per query.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { truncateHead, DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES } from "@mariozechner/pi-coding-agent";
import { KagiClient } from "../kagi-client.ts";
import { KagiError } from "../config.ts";
import { formatSearchResponse, countResults, truncationNotice } from "../formatters/results.ts";

/**
 * Register the kagi_search tool with the pi extension API.
 *
 * @param pi - Extension API for registering tools
 * @param client - Shared KagiClient instance
 */
export function registerSearchTool(pi: ExtensionAPI, client: KagiClient): void {
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

			try {
				const response = await client.search(params.query, params.limit);

				// Check if cancelled after the API call
				if (signal?.aborted) {
					throw new Error("Search request was cancelled");
				}

				const totalResults = countResults(response);
				const formatted = formatSearchResponse(response);

				// Apply truncation — search results are ordered by relevance,
				// so truncating from the head (keeping the most relevant) is correct
				const truncation = truncateHead(formatted, {
					maxLines: DEFAULT_MAX_LINES,
					maxBytes: DEFAULT_MAX_BYTES,
				});

				let result = truncation.content;

				if (truncation.truncated) {
					result += truncationNotice(totalResults, totalResults);
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