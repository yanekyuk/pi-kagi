/**
 * kagi_fastgpt tool — Search-grounded LLM answers from Kagi FastGPT.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { KagiClient } from "../kagi-client.ts";
import { KagiError } from "../config.ts";
import { truncateFastGPTOutput } from "../formatters/answers.ts";

/**
 * Register the kagi_fastgpt tool.
 *
 * FastGPT always runs with web search grounding enabled at the API layer, so the
 * tool schema only exposes the safe public parameters (`query` and optional `cache`).
 */
export function registerFastGPTTool(pi: ExtensionAPI, getClient: () => KagiClient): void {
	pi.registerTool({
		name: "kagi_fastgpt",
		label: "Kagi FastGPT",
		description:
			"Get a search-grounded answer from Kagi FastGPT. Returns concise answer text sourced " +
			"from Kagi's web-backed model. Web search grounding is always enabled by the API, so this " +
			"tool only exposes the question and optional cache flag. Costs ~$0.015 per query " +
			"(cached responses free).",
		promptSnippet: "Get a grounded answer with inline citations for a web research question.",
		promptGuidelines: [
			"Use this when the user wants a synthesized answer or explanation backed by web citations.",
			"Prefer kagi_summarize when the user supplies a specific URL or pasted document that needs condensing.",
		],
		parameters: Type.Object(
			{
				query: Type.String({ description: "Question to answer with a search-grounded LLM response" }),
				cache: Type.Optional(
					Type.Boolean({ description: "Allow cached responses (default: true)" }),
				),
			},
			{ additionalProperties: false },
		),
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			if (signal?.aborted) {
				throw new Error("Request was cancelled");
			}

			const client = getClient();

			try {
				const response = await client.fastgpt(params.query, { cache: params.cache });

				if (signal?.aborted) {
					throw new Error("Request was cancelled");
				}

				return {
					content: [{ type: "text" as const, text: truncateFastGPTOutput(response) }],
					details: {
						query: params.query,
						tokens: response.tokens,
						referenceCount: response.references.length,
						references: response.references,
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
