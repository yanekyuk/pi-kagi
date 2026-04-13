/**
 * kagi_search tool — Search the web using Kagi's premium search API.
 *
 * Returns a numbered citation list of results with title, snippet, URL, and date.
 * Costs ~$0.025 per query.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { KagiClient } from "../kagi-client.ts";
import { KagiError } from "../config.ts";
import { formatSearchResponse, countResults, truncateSearchOutput } from "../formatters/results.ts";
import { TOOL_COST_GUIDANCE, appendEstimatedCost } from "../tool-costs.ts";

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
		promptSnippet: "Search the web for general information with source links.",
		promptGuidelines: [
			"Use this as the default web lookup when the user needs broad coverage or direct citations.",
			"Prefer kagi_enrich_web for independent/community perspectives and kagi_enrich_news for recent news or current discussions.",
		],
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
							text: appendEstimatedCost(
								`No search results found for "${params.query}".`,
								TOOL_COST_GUIDANCE.kagi_search,
							),
						}],
						details: {
							query: params.query,
							totalResults: 0,
							meta: response.meta,
							estimatedCost: TOOL_COST_GUIDANCE.kagi_search,
						},
					};
				}

				const formatted = formatSearchResponse(response);

				// Search results are ordered by relevance, so we keep the head of the list
				const result = truncateSearchOutput(formatted, totalResults);

				return {
					content: [{
						type: "text" as const,
						text: appendEstimatedCost(result, TOOL_COST_GUIDANCE.kagi_search),
					}],
					details: {
						query: params.query,
						totalResults,
						meta: response.meta,
						estimatedCost: TOOL_COST_GUIDANCE.kagi_search,
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