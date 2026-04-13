export const TOOL_COST_GUIDANCE = {
	kagi_search: "~$0.025/query",
	kagi_enrich_web: "~$0.002/query",
	kagi_enrich_news: "~$0.002/query",
	kagi_fastgpt_uncached: "~$0.015/query",
	kagi_fastgpt_cached: "~$0.015/query (cached responses may be free)",
	kagi_summarize_uncached: "$0.03-$1/call depending on engine",
	kagi_summarize_cached: "$0.03-$1/call depending on engine (cached responses may be free)",
	kagi_smallweb: "$0.00 (free endpoint)",
	enrich_empty: "$0.00 (no results)",
} as const;

export function appendEstimatedCost(text: string, estimatedCost: string): string {
	return `${text}\n\n[Estimated cost: ${estimatedCost}]`;
}

export function estimatedEnrichCost(totalResults: number, toolName: "kagi_enrich_web" | "kagi_enrich_news"): string {
	return totalResults === 0 ? TOOL_COST_GUIDANCE.enrich_empty : TOOL_COST_GUIDANCE[toolName];
}

export function estimatedFastgptCost(cache?: boolean): string {
	return cache === false ? TOOL_COST_GUIDANCE.kagi_fastgpt_uncached : TOOL_COST_GUIDANCE.kagi_fastgpt_cached;
}

export function estimatedSummarizeCost(cache?: boolean): string {
	return cache === false ? TOOL_COST_GUIDANCE.kagi_summarize_uncached : TOOL_COST_GUIDANCE.kagi_summarize_cached;
}
