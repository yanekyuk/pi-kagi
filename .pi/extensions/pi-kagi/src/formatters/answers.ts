/**
 * Shared formatting utilities for Kagi answer-style endpoints.
 *
 * FastGPT responses need section-aware truncation so the answer body can shrink
 * without losing the references and token metadata that downstream reasoning needs.
 */

import { truncateHead, DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES } from "@mariozechner/pi-coding-agent";
import type { Citation, FastGPTResponse } from "../types.ts";

const utf8Encoder = new TextEncoder();
const FASTGPT_ANSWER_TRUNCATION_NOTICE =
	"[FastGPT answer truncated to fit Pi output limits; sources and token metadata preserved.]";
const FASTGPT_SOURCE_TRUNCATION_NOTICE =
	"[Showing the first references that fit within Pi output limits.]";

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

function fallbackSourceLabel(reference: Partial<Citation>, index: number): string {
	const title = reference.title?.trim();
	const url = reference.url?.trim();
	return title || url || `Source ${index}`;
}

/**
 * Format a single FastGPT reference while preserving the reference array order.
 */
export function formatFastGPTReference(reference: Partial<Citation>, index: number): string {
	const label = fallbackSourceLabel(reference, index);
	const url = reference.url?.trim();
	return url ? `[${index}](${url}) — ${label}` : `[${index}] ${label}`;
}

/**
 * Format the FastGPT references list as a compact `Sources:` section.
 */
export function formatFastGPTSources(references: Citation[]): string {
	if (references.length === 0) {
		return "";
	}

	const lines = references.map((reference, index) => formatFastGPTReference(reference, index + 1));
	return `Sources:\n${lines.join("\n")}`;
}

/**
 * Format token/reference metadata for FastGPT responses.
 */
export function formatFastGPTMetadata(response: Pick<FastGPTResponse, "tokens" | "references">): string {
	return `[Tokens processed: ${response.tokens} | Sources: ${response.references.length}]`;
}

/**
 * Build the untruncated FastGPT output.
 */
export function formatFastGPTResponse(response: FastGPTResponse): string {
	const answer = response.output.trim() || "Kagi FastGPT returned an empty answer.";
	const sourcesSection = formatFastGPTSources(response.references);
	const metadataSection = formatFastGPTMetadata(response);
	return joinSections(answer, sourcesSection, metadataSection);
}

function truncateSourcesSection(sourcesSection: string, totalReferences: number, metadataSection: string): string {
	let maxLines = Math.max(1, DEFAULT_MAX_LINES - countLines(metadataSection) - 2);
	let maxBytes = Math.max(128, DEFAULT_MAX_BYTES - countBytes(metadataSection) - 256);

	for (let attempt = 0; attempt < 4; attempt++) {
		const truncation = truncateHead(sourcesSection, { maxLines, maxBytes });
		if (!truncation.truncated) {
			return truncation.content.trimEnd();
		}

		const candidate = joinSections(
			truncation.content.trimEnd(),
			FASTGPT_SOURCE_TRUNCATION_NOTICE,
			metadataSection,
		);
		if (isWithinPiLimits(candidate)) {
			return joinSections(truncation.content.trimEnd(), FASTGPT_SOURCE_TRUNCATION_NOTICE);
		}

		maxLines = Math.max(1, maxLines - Math.max(1, countLines(candidate) - DEFAULT_MAX_LINES));
		maxBytes = Math.max(128, maxBytes - Math.max(128, countBytes(candidate) - DEFAULT_MAX_BYTES));
	}

	const fallback = truncateHead(sourcesSection, { maxLines: 1, maxBytes: Math.max(128, maxBytes) });
	return joinSections(fallback.content.trimEnd(), `[Showing references 1-${Math.min(totalReferences, 1)}.]`);
}

/**
 * Truncate FastGPT output while preserving the source list and token metadata.
 */
export function truncateFastGPTOutput(response: FastGPTResponse): string {
	const answer = response.output.trim() || "Kagi FastGPT returned an empty answer.";
	const metadataSection = formatFastGPTMetadata(response);
	let sourcesSection = formatFastGPTSources(response.references);

	if (sourcesSection) {
		const suffixOnly = joinSections(sourcesSection, metadataSection);
		if (!isWithinPiLimits(suffixOnly)) {
			sourcesSection = truncateSourcesSection(sourcesSection, response.references.length, metadataSection);
		}
	}

	const full = joinSections(answer, sourcesSection, metadataSection);
	if (isWithinPiLimits(full)) {
		return full;
	}

	let maxLines = DEFAULT_MAX_LINES;
	let maxBytes = DEFAULT_MAX_BYTES;

	for (let attempt = 0; attempt < 6; attempt++) {
		const truncation = truncateHead(answer, { maxLines, maxBytes });
		const truncatedAnswer = truncation.content.trimEnd();
		const candidate = joinSections(
			truncatedAnswer,
			FASTGPT_ANSWER_TRUNCATION_NOTICE,
			sourcesSection,
			metadataSection,
		);

		if (isWithinPiLimits(candidate)) {
			return candidate;
		}

		maxLines = Math.max(1, maxLines - Math.max(1, countLines(candidate) - DEFAULT_MAX_LINES));
		maxBytes = Math.max(1, maxBytes - Math.max(1, countBytes(candidate) - DEFAULT_MAX_BYTES));
	}

	const suffix = joinSections(FASTGPT_ANSWER_TRUNCATION_NOTICE, sourcesSection, metadataSection);
	if (isWithinPiLimits(suffix)) {
		return suffix;
	}

	return joinSections(
		truncateSourcesSection(formatFastGPTSources(response.references), response.references.length, metadataSection),
		metadataSection,
	);
}
