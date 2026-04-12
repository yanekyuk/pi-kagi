/**
 * kagi_summarize tool — Kagi Universal Summarizer.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { KagiClient } from "../kagi-client.ts";
import { KagiError } from "../config.ts";
import { truncateSummarizeOutput } from "../formatters/answers.ts";

const SUMMARIZER_ENGINES = ["cecil", "agnes", "daphne", "muriel"] as const;
const SUMMARY_TYPES = ["summary", "takeaway"] as const;
const MAX_SUMMARIZER_TEXT_BYTES = 1_000_000;
const SUPPORTED_TARGET_LANGUAGES = new Set([
	"BG",
	"CS",
	"DA",
	"DE",
	"EL",
	"EN",
	"ES",
	"ET",
	"FI",
	"FR",
	"HU",
	"ID",
	"IT",
	"JA",
	"KO",
	"LT",
	"LV",
	"NB",
	"NL",
	"PL",
	"PT",
	"RO",
	"RU",
	"SK",
	"SL",
	"SV",
	"TR",
	"UK",
	"ZH",
	"ZH-HANT",
]);

const utf8Encoder = new TextEncoder();

interface SummarizerParams {
	url?: string;
	text?: string;
	engine?: typeof SUMMARIZER_ENGINES[number];
	summary_type?: typeof SUMMARY_TYPES[number];
	target_language?: string;
	cache?: boolean;
}

function countBytes(text: string): number {
	return utf8Encoder.encode(text).length;
}

function validateSummarizerInput(params: SummarizerParams): SummarizerParams {
	const url = params.url?.trim();
	const text = params.text?.trim();
	const target_language = params.target_language?.trim().toUpperCase();
	const populatedFields = [url, text].filter(Boolean).length;

	if (populatedFields !== 1) {
		throw new KagiError(
			"Provide exactly one of `url` or `text` to kagi_summarize. " +
				"Use `url` for web pages/files and `text` for pasted content.",
		);
	}

	if (url) {
		try {
			new URL(url);
		} catch {
			throw new KagiError(
				"`url` must be an absolute URL such as `https://example.com/article`. " +
					"Use the `text` field instead for pasted content.",
			);
		}
	}

	if (text) {
		const textBytes = countBytes(text);
		if (textBytes > MAX_SUMMARIZER_TEXT_BYTES) {
			throw new KagiError(
				`Summarizer text is ${ (textBytes / 1_000_000).toFixed(2) }MB, but Kagi limits summarize requests to 1MB. ` +
					"Provide a URL instead or shorten the pasted text.",
			);
		}
	}

	if (target_language && !SUPPORTED_TARGET_LANGUAGES.has(target_language)) {
		throw new KagiError(
			"Unsupported `target_language`. Use one of Kagi's documented codes such as EN, ES, FR, JA, ZH, or ZH-HANT.",
		);
	}

	return {
		...params,
		url,
		text,
		target_language,
	};
}

/**
 * Register the kagi_summarize tool.
 *
 * Text payloads are always sent through the client's POST /summarize implementation,
 * which avoids URL length issues for pasted content.
 */
export function registerSummarizerTool(pi: ExtensionAPI, getClient: () => KagiClient): void {
	pi.registerTool({
		name: "kagi_summarize",
		label: "Kagi Summarize",
		description:
			"Summarize a URL or pasted text using Kagi's Universal Summarizer. Supports " +
			"engine, summary type, target language, and cache options. Text submissions are " +
			"sent through POST requests to avoid URL length limits. Costs $0.03-$1 per call " +
			"depending on engine.",
		promptSnippet: "Summarize a specific URL or pasted text into concise prose or takeaways.",
		promptGuidelines: [
			"Use this when the user provides a URL or body of text to condense rather than asking a broad web question.",
			"Prefer kagi_fastgpt when the user wants a synthesized answer grounded in multiple web results instead of a direct summary.",
		],
		parameters: Type.Object(
			{
				url: Type.Optional(
					Type.String({ description: "URL to summarize (mutually exclusive with text)" }),
				),
				text: Type.Optional(
					Type.String({ description: "Text to summarize (mutually exclusive with url)" }),
				),
				engine: Type.Optional(StringEnum(SUMMARIZER_ENGINES)),
				summary_type: Type.Optional(StringEnum(SUMMARY_TYPES)),
				target_language: Type.Optional(
					Type.String({ description: "Desired output language code, e.g. EN or ES" }),
				),
				cache: Type.Optional(Type.Boolean({ description: "Allow cached responses (default: true)" })),
			},
			{ additionalProperties: false },
		),
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			if (signal?.aborted) {
				throw new Error("Request was cancelled");
			}

			const client = getClient();
			const validated = validateSummarizerInput(params);

			try {
				const response = await client.summarize(validated);

				if (signal?.aborted) {
					throw new Error("Request was cancelled");
				}

				return {
					content: [{ type: "text" as const, text: truncateSummarizeOutput(response) }],
					details: {
						input: validated.url
							? { type: "url" as const, value: validated.url }
							: { type: "text" as const, value: validated.text ?? "" },
						engine: validated.engine,
						summary_type: validated.summary_type,
						target_language: validated.target_language,
						cache: validated.cache,
						tokens: response.tokens,
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

export { SUMMARIZER_ENGINES, SUMMARY_TYPES, validateSummarizerInput };
