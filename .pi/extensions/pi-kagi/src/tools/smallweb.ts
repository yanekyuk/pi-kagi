/**
 * kagi_smallweb tool — Kagi Small Web feed.
 *
 * Surfaces recent content from the "small web" — personal blogs, independent
 * websites, and non-commercial content. Free API endpoint.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { truncateHead, DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES } from "@mariozechner/pi-coding-agent";
import { KagiClient } from "../kagi-client.ts";
import { KagiError } from "../config.ts";
import { formatSmallWebResponse } from "../formatters/results.ts";

/**
 * Register the kagi_smallweb tool.
 *
 * Fetches recent Small Web entries from Kagi's curated feed of
 * independent, non-commercial websites.
 */
export function registerSmallWebTool(pi: ExtensionAPI, getClient: () => KagiClient): void {
	pi.registerTool({
		name: "kagi_smallweb",
		label: "Kagi Small Web",
		description:
			"Browse Kagi's Small Web feed — a curated selection of recent content from " +
			"personal blogs and independent websites. Free to use. Great for discovering " +
			"interesting, non-commercial content from around the web.",
		parameters: Type.Object({
			limit: Type.Optional(
				Type.Number({ description: "Max entries to return (1-50)", minimum: 1, maximum: 50 }),
			),
		}),
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			if (signal?.aborted) {
				throw new Error("Request was cancelled");
			}

			const client = getClient();

			try {
				const response = await client.smallweb(params.limit);

				if (signal?.aborted) {
					throw new Error("Request was cancelled");
				}

				const formatted = formatSmallWebResponse(response);

				const truncation = truncateHead(formatted, {
					maxLines: DEFAULT_MAX_LINES,
					maxBytes: DEFAULT_MAX_BYTES,
				});

				let result = truncation.content;

				if (truncation.truncated) {
					const totalEntries = response.entries.length;
					const shownEntries = (truncation.content.match(/^• /gm) || []).length;
					result += `\n\n[Showing ${shownEntries} of ${totalEntries} Small Web entries.]`;
				}

				return {
					content: [{ type: "text" as const, text: result }],
					details: {
						totalEntries: response.entries.length,
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