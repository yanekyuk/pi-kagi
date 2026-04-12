/**
 * Shared formatting utilities for Kagi answer-style endpoints.
 *
 * FastGPT responses need section-aware truncation so the answer body can shrink
 * without losing the references and token metadata that downstream reasoning needs.
 */

import { truncateHead, DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES } from "@mariozechner/pi-coding-agent";
import type { Citation, FastGPTResponse, SummarizeResponse } from "../types.ts";

interface IndexedReference {
	index: number;
	reference: Citation;
}

const utf8Encoder = new TextEncoder();
const FASTGPT_ANSWER_TRUNCATION_NOTICE =
	"[FastGPT answer truncated to fit Pi output limits; sources and token metadata preserved.]";
const SOURCE_ENTRY_PATTERN = /^\[\d+\](?:\(| )/gm;
const MAX_REFERENCE_LABEL_BYTES = 320;
const MAX_REFERENCE_URL_BYTES = 2048;

function countLines(text: string): number {
	return text === "" ? 0 : text.split("\n").length;
}

function countBytes(text: string): number {
	return utf8Encoder.encode(text).length;
}

function isWithinPiLimits(text: string): boolean {
	return countLines(text) <= DEFAULT_MAX_LINES && countBytes(text) <= DEFAULT_MAX_BYTES;
}

function joinSections(...sections: Array<string | undefined>): string {
	return sections.filter((section): section is string => Boolean(section && section.trim())).join("\n\n");
}

function allIndexedReferences(references: Citation[]): IndexedReference[] {
	return references.map((reference, index) => ({ index: index + 1, reference }));
}

function extractCitationNumbers(answer: string): number[] {
	const seen = new Set<number>();
	const numbers: number[] = [];

	for (const match of answer.matchAll(/\[(\d+)\]/g)) {
		const index = Number.parseInt(match[1], 10);
		if (Number.isFinite(index) && index > 0 && !seen.has(index)) {
			seen.add(index);
			numbers.push(index);
		}
	}

	return numbers;
}

function citedIndexedReferences(answer: string, references: Citation[]): IndexedReference[] {
	const numbers = extractCitationNumbers(answer);
	if (numbers.length === 0) {
		return [];
	}

	const indexed: IndexedReference[] = [];
	for (const index of numbers) {
		const reference = references[index - 1];
		if (reference) {
			indexed.push({ index, reference });
		}
	}
	return indexed;
}

function normalizeInlineText(value?: string): string {
	return value?.replace(/\s+/g, " ").trim() ?? "";
}

function truncateInlineText(value: string, maxBytes: number): string {
	if (countBytes(value) <= maxBytes) {
		return value;
	}

	const ellipsis = "…";
	let truncated = value;
	while (truncated.length > 0 && countBytes(truncated + ellipsis) > maxBytes) {
		truncated = truncated.slice(0, -1);
	}
	return truncated ? truncated + ellipsis : ellipsis;
}

function fallbackSourceLabel(reference: Partial<Citation>, index: number): string {
	const title = normalizeInlineText(reference.title);
	const url = normalizeInlineText(reference.url);
	return title || url || `Source ${index}`;
}

/**
 * Format a single FastGPT reference while preserving the original citation number.
 */
export function formatFastGPTReference(reference: Partial<Citation>, index: number): string {
	const label = truncateInlineText(fallbackSourceLabel(reference, index), MAX_REFERENCE_LABEL_BYTES);
	const url = normalizeInlineText(reference.url);
	const safeUrl = url ? truncateInlineText(url, MAX_REFERENCE_URL_BYTES) : "";
	return safeUrl ? `[${index}](${safeUrl}) — ${label}` : `[${index}] ${label}`;
}

function formatIndexedSources(indexedReferences: IndexedReference[]): string {
	if (indexedReferences.length === 0) {
		return "";
	}

	const lines = indexedReferences.map(({ reference, index }) => formatFastGPTReference(reference, index));
	return `Sources:\n${lines.join("\n")}`;
}

/**
 * Format the full FastGPT reference list as a compact `Sources:` section.
 */
export function formatFastGPTSources(references: Citation[]): string {
	return formatIndexedSources(allIndexedReferences(references));
}

/**
 * Format token/reference metadata for FastGPT responses.
 */
export function formatFastGPTMetadata(
	response: Pick<FastGPTResponse, "tokens" | "references">,
	displayedSources = response.references.length,
): string {
	if (displayedSources === response.references.length) {
		return `[Tokens processed: ${response.tokens} | Sources: ${response.references.length}]`;
	}

	return `[Tokens processed: ${response.tokens} | Sources shown: ${displayedSources} of ${response.references.length}]`;
}

/**
 * Build the untruncated FastGPT output.
 */
export function formatFastGPTResponse(response: FastGPTResponse): string {
	const answer = response.output.trim() || "Kagi FastGPT returned an empty answer.";
	return joinSections(answer, formatFastGPTSources(response.references), formatFastGPTMetadata(response));
}

function buildFastGPTOutput(
	answer: string | undefined,
	response: Pick<FastGPTResponse, "tokens" | "references">,
	indexedReferences: IndexedReference[],
	includeTruncationNotice: boolean,
): string {
	return joinSections(
		answer,
		includeTruncationNotice ? FASTGPT_ANSWER_TRUNCATION_NOTICE : undefined,
		formatIndexedSources(indexedReferences),
		formatFastGPTMetadata(response as FastGPTResponse, indexedReferences.length),
	);
}

function countShownSources(section: string): number {
	return (section.match(SOURCE_ENTRY_PATTERN) || []).length;
}

function buildOutputWithCompactedUncitedSources(
	answer: string | undefined,
	response: Pick<FastGPTResponse, "tokens" | "references">,
	indexedReferences: IndexedReference[],
	includeTruncationNotice: boolean,
): string {
	const fullSection = formatIndexedSources(indexedReferences);
	if (!fullSection) {
		return buildFastGPTOutput(answer, response, [], includeTruncationNotice);
	}

	let maxLines = DEFAULT_MAX_LINES;
	let maxBytes = DEFAULT_MAX_BYTES;

	for (let attempt = 0; attempt < 6; attempt++) {
		const truncation = truncateHead(fullSection, { maxLines, maxBytes });
		const shownCount = countShownSources(truncation.content);
		const notice = truncation.truncated
			? `[Showing first ${shownCount} of ${indexedReferences.length} sources to fit Pi output limits.]`
			: undefined;
		const sourcesSection = joinSections(truncation.content.trimEnd(), notice);
		const candidate = joinSections(
			answer,
			includeTruncationNotice ? FASTGPT_ANSWER_TRUNCATION_NOTICE : undefined,
			sourcesSection,
			formatFastGPTMetadata(response, shownCount),
		);
		if (shownCount > 0 && isWithinPiLimits(candidate)) {
			return candidate;
		}

		maxLines = Math.max(1, maxLines - Math.max(1, countLines(candidate) - DEFAULT_MAX_LINES));
		maxBytes = Math.max(1, maxBytes - Math.max(1, countBytes(candidate) - DEFAULT_MAX_BYTES));
	}

	const first = indexedReferences[0];
	const sourcesSection = joinSections(
		`Sources:\n${formatFastGPTReference(first.reference, first.index)}`,
		`[Showing first 1 of ${indexedReferences.length} sources to fit Pi output limits.]`,
	);
	let compactAnswer = answer ?? "";
	let candidate = joinSections(
		compactAnswer,
		includeTruncationNotice ? FASTGPT_ANSWER_TRUNCATION_NOTICE : undefined,
		sourcesSection,
		formatFastGPTMetadata(response, 1),
	);

	while (compactAnswer && !isWithinPiLimits(candidate)) {
		compactAnswer = compactAnswer.slice(0, -1).trimEnd();
		candidate = joinSections(
			compactAnswer,
			includeTruncationNotice ? FASTGPT_ANSWER_TRUNCATION_NOTICE : undefined,
			sourcesSection,
			formatFastGPTMetadata(response, 1),
		);
	}

	if (isWithinPiLimits(candidate)) {
		return candidate;
	}

	return joinSections(
		includeTruncationNotice ? FASTGPT_ANSWER_TRUNCATION_NOTICE : undefined,
		sourcesSection,
		formatFastGPTMetadata(response, 1),
	);
}

/**
 * Truncate FastGPT output while preserving source entries for the citations that
 * remain in the retained answer body.
 */
export function truncateFastGPTOutput(response: FastGPTResponse): string {
	const answer = response.output.trim() || "Kagi FastGPT returned an empty answer.";
	const allReferences = allIndexedReferences(response.references);
	const full = buildFastGPTOutput(answer, response, allReferences, false);
	if (isWithinPiLimits(full)) {
		return full;
	}

	let maxLines = DEFAULT_MAX_LINES;
	let maxBytes = DEFAULT_MAX_BYTES;

	for (let attempt = 0; attempt < 8; attempt++) {
		const truncation = truncateHead(answer, { maxLines, maxBytes });
		const truncatedAnswer = truncation.content.trimEnd();
		const citedReferences = citedIndexedReferences(truncatedAnswer, response.references);
		const candidate = citedReferences.length > 0
			? buildFastGPTOutput(truncatedAnswer, response, citedReferences, true)
			: buildOutputWithCompactedUncitedSources(truncatedAnswer, response, allReferences, true);

		if (isWithinPiLimits(candidate)) {
			return candidate;
		}

		maxLines = Math.max(1, maxLines - Math.max(1, countLines(candidate) - DEFAULT_MAX_LINES));
		maxBytes = Math.max(1, maxBytes - Math.max(1, countBytes(candidate) - DEFAULT_MAX_BYTES));
	}

	return buildOutputWithCompactedUncitedSources("", response, allReferences, true);
}

/**
 * Format summarizer output with token metadata.
 */
export function formatSummarizeResponse(response: SummarizeResponse): string {
	const summary = response.output.trim() || "Kagi Summarizer returned an empty summary.";
	return joinSections(summary, `[Tokens processed: ${response.tokens}]`);
}

/**
 * Summaries are already condensed, but token metadata still needs to survive truncation.
 */
export function truncateSummarizeOutput(response: SummarizeResponse): string {
	const summary = response.output.trim() || "Kagi Summarizer returned an empty summary.";
	const metadata = `[Tokens processed: ${response.tokens}]`;
	const full = joinSections(summary, metadata);
	if (isWithinPiLimits(full)) {
		return full;
	}

	let maxLines = DEFAULT_MAX_LINES;
	let maxBytes = DEFAULT_MAX_BYTES;

	for (let attempt = 0; attempt < 4; attempt++) {
		const truncation = truncateHead(summary, { maxLines, maxBytes });
		const candidate = joinSections(truncation.content.trimEnd(), metadata);
		if (isWithinPiLimits(candidate)) {
			return candidate;
		}

		maxLines = Math.max(1, maxLines - Math.max(1, countLines(candidate) - DEFAULT_MAX_LINES));
		maxBytes = Math.max(1, maxBytes - Math.max(1, countBytes(candidate) - DEFAULT_MAX_BYTES));
	}

	return metadata;
}
