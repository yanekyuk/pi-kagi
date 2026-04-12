/**
 * kagi_enrich_web and kagi_enrich_news tools — Non-commercial enrichment APIs.
 *
 * Kagi's Enrich APIs surface unique, non-commercial web content (Teclis index)
 * and news/discussions (TinyGem index). Costs ~$0.002 per query (free if no results).
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { KagiClient } from "../kagi-client.ts";
import { KagiError } from "../config.ts";
import { formatSearchResponse, countResults, truncateSearchOutput } from "../formatters/results.ts";

/**
 * Register the kagi_enrich_web tool.
 *
 * Fetches non-commercial web content (Teclis index) for a given query.
 */
export function registerEnrichWebTool(pi: ExtensionAPI, getClient: () => KagiClient): void {
	pi.registerTool({
		name: "kagi_enrich_web",
		label: "Kagi Enrich Web",
		description:
			"Search non-commercial web content using Kagi's Teclis index. " +
			"Finds blogs, discussions, and perspectives from the independent web. " +
			"Costs ~$0.002 per query (free if no results returned).",
		promptSnippet: "Find non-commercial web sources, blogs, and community discussions.",
		promptGuidelines: [
			"Use this when the user wants blogs, forums, indie sites, or non-mainstream perspectives.",
			"If coverage is sparse or the user needs broader results, follow up with kagi_search.",
		],
		parameters: Type.Object({
			query: Type.String({ description: "Query for non-commercial web content" }),
		}),
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			if (signal?.aborted) {
				throw new Error("Request was cancelled");
			}

			const client = getClient();

			try {
				const response = await client.enrichWeb(params.query);

				if (signal?.aborted) {
					throw new Error("Request was cancelled");
				}

				const totalResults = countResults(response);

				// Handle empty results with a friendly message
				if (totalResults === 0) {
					return {
						content: [{
							type: "text" as const,
							text: `No enrich web results found for "${params.query}".`,
						}],
						details: { query: params.query, totalResults: 0 },
					};
				}

				const formatted = formatSearchResponse(response, { includeRank: true });
				const result = truncateSearchOutput(formatted, totalResults);

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
					throw err;
				}
				throw err;
			}
		},
	});
}

/**
 * Register the kagi_enrich_news tool.
 *
 * Fetches non-commercial news and discussions (TinyGem index) for a given query.
 */
export function registerEnrichNewsTool(pi: ExtensionAPI, getClient: () => KagiClient): void {
	pi.registerTool({
		name: "kagi_enrich_news",
		label: "Kagi Enrich News",
		description:
			"Search non-commercial news and discussions using Kagi's TinyGem index. " +
			"Finds interesting discussions and news from typically non-mainstream sources. " +
			"Costs ~$0.002 per query (free if no results returned).",
		promptSnippet: "Find recent news and current discussions from varied sources.",
		promptGuidelines: [
			"Use this for latest, recent, news, or current-events requests.",
			"If the user needs broader background or evergreen sources, supplement with kagi_search.",
		],
		parameters: Type.Object({
			query: Type.String({ description: "Query for non-commercial news and discussions" }),
		}),
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			if (signal?.aborted) {
				throw new Error("Request was cancelled");
			}

			const client = getClient();

			try {
				const response = await client.enrichNews(params.query);

				if (signal?.aborted) {
					throw new Error("Request was cancelled");
				}

				const totalResults = countResults(response);

				if (totalResults === 0) {
					return {
						content: [{
							type: "text" as const,
							text: `No enrich news results found for "${params.query}".`,
						}],
						details: { query: params.query, totalResults: 0 },
					};
				}

				const formatted = formatSearchResponse(response, { includeRank: true });
				const result = truncateSearchOutput(formatted, totalResults);

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
					throw err;
				}
				throw err;
			}
		},
	});
}
