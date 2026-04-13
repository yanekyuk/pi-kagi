import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	createJsonResponse,
	createPiHarness,
	createTextResponse,
	getRegisteredTool,
	installFetchStub,
	mockExternalModules,
} from "./harness.ts";
import {
	ENRICH_NEWS_RAW_RESPONSE,
	ENRICH_WEB_RAW_RESPONSE,
	FASTGPT_RAW_RESPONSE,
	MANUAL_ROUTING_SCENARIOS,
	SEARCH_RAW_RESPONSE,
	SMALLWEB_RAW_RESPONSE,
	STEP1_SCOPE,
	SUMMARIZE_TEXT_RAW_RESPONSE,
	SUMMARIZE_URL_RAW_RESPONSE,
} from "../fixtures/integration-fixtures.ts";

mockExternalModules();

const { KagiApiError, KagiConfigError, default: extension } = await import("../../index.ts");
const { TOOL_COST_GUIDANCE } = await import("../../src/tool-costs.ts");

const originalApiKey = process.env.KAGI_API_KEY;

let restoreFetch: (() => void) | undefined;

beforeEach(() => {
	process.env.KAGI_API_KEY = "integration-test-key";
});

afterEach(() => {
	restoreFetch?.();
	restoreFetch = undefined;

	if (originalApiKey === undefined) {
		delete process.env.KAGI_API_KEY;
	} else {
		process.env.KAGI_API_KEY = originalApiKey;
	}
});

function parseJsonBody(body: RequestInit["body"]): Record<string, unknown> | undefined {
	if (typeof body !== "string") {
		return undefined;
	}

	return JSON.parse(body) as Record<string, unknown>;
}

describe("TP-009 current-surface manual routing scope", () => {
	it("re-scopes Step 1 to current tools and explicitly defers TP-007/TP-008 assertions", async () => {
		const { api, tools, commands, notifications, ui } = createPiHarness();
		extension(api);

		const registeredNames = tools.map((tool) => tool.name).sort();
		expect(STEP1_SCOPE.reScope).toBe("current-tp005-tp006-surfaces");
		expect(STEP1_SCOPE.deferredAssertions).toContain(
			"TP-007 smart-routing, multi-endpoint fallback, and partial-success aggregation",
		);
		expect(STEP1_SCOPE.deferredAssertions).toContain(
			"TP-008 per-call pricing model and cumulative usage reporting",
		);
		expect(registeredNames).toEqual(expect.arrayContaining([
			"kagi_enrich_news",
			"kagi_enrich_web",
			"kagi_fastgpt",
			"kagi_search",
			"kagi_smallweb",
			"kagi_summarize",
		]));
		expect(registeredNames).not.toContain("kagi_web_access");
		expect(registeredNames).not.toContain("kagi_usage");

		const aboutCommand = commands.get("kagi-about");
		expect(aboutCommand).toBeDefined();
		await aboutCommand!.handler("", { ui });
		expect(notifications[0]?.message).toContain("kagi_search");
		expect(notifications[0]?.message).not.toContain("kagi_web_access");
	});
});

describe("TP-009 manual-routing scenario matrix", () => {
	it("executes the current tool set end-to-end through the extension entry point", async () => {
		const { api, tools } = createPiHarness();
		extension(api);

		const fetchStub = installFetchStub([
			createJsonResponse(SEARCH_RAW_RESPONSE),
			createJsonResponse(ENRICH_WEB_RAW_RESPONSE),
			createJsonResponse(ENRICH_NEWS_RAW_RESPONSE),
			createJsonResponse(FASTGPT_RAW_RESPONSE),
			createJsonResponse(SUMMARIZE_URL_RAW_RESPONSE),
			createJsonResponse(SUMMARIZE_TEXT_RAW_RESPONSE),
			createJsonResponse(SMALLWEB_RAW_RESPONSE),
		]);
		restoreFetch = fetchStub.restore;

		const results: Array<{ label: string; toolName: string; text: string; details: Record<string, unknown> }> = [];
		for (const [index, scenario] of MANUAL_ROUTING_SCENARIOS.entries()) {
			const tool = getRegisteredTool(tools, scenario.toolName);
			const result = await tool.execute(
				`tool-call-${index + 1}`,
				scenario.arguments,
				undefined,
				undefined,
				{ ui: { notify() {} } },
			);
			results.push({
				label: scenario.label,
				toolName: scenario.toolName,
				text: result.content[0].text,
				details: result.details,
			});
		}

		expect(results).toHaveLength(MANUAL_ROUTING_SCENARIOS.length);
		expect(results[0]?.text).toContain("[1](https://example.com/sqlite-wal) — SQLite WAL Guide");
		expect(results[0]?.text).toContain("Related searches: sqlite wal checkpoint busy timeout");
		expect(results[1]?.text).toContain("Running Litestream in Production");
		expect(results[2]?.text).toContain("Browser Engine Watch");
		expect(results[3]?.text).toContain("Python 3.11 improved performance [1]");
		expect(results[3]?.text).toContain("[Tokens processed: 757 | Sources: 2]");
		expect(results[4]?.text).toContain("• Key takeaway one");
		expect(results[5]?.text).toContain("Short pasted summary.");
		expect(results[6]?.text).toContain("• A Handmade Blog (Jane Example, Jun 1, 2024)");

		expect(fetchStub.calls).toHaveLength(MANUAL_ROUTING_SCENARIOS.length);
		expect(fetchStub.calls[0]?.url).toContain("/search?q=sqlite+wal+checkpoint+behavior&limit=3");
		expect(fetchStub.calls[1]?.url).toContain("/enrich/web?q=litestream+production+lessons");
		expect(fetchStub.calls[2]?.url).toContain("/enrich/news?q=recent+browser+engine+news");
		expect(fetchStub.calls[3]?.url).toContain("/fastgpt");
		expect(fetchStub.calls[3]?.init?.method).toBe("POST");
		expect(parseJsonBody(fetchStub.calls[3]?.init?.body)).toEqual({
			query: "What changed in Python 3.11?",
			cache: false,
			web_search: true,
		});
		expect(fetchStub.calls[4]?.url).toContain("/summarize");
		expect(parseJsonBody(fetchStub.calls[4]?.init?.body)).toEqual({
			url: "https://example.com/article",
			engine: "agnes",
			summary_type: "takeaway",
		});
		expect(parseJsonBody(fetchStub.calls[5]?.init?.body)).toEqual({
			text: "Short pasted text to summarize.",
			target_language: "EN",
		});
		expect(fetchStub.calls[6]?.url).toContain("https://kagi.com/api/v1/smallweb/feed/?limit=2");
	});
});

describe("TP-009 failure-path regressions", () => {
	it("fails lazily with KagiConfigError when the API key is missing", async () => {
		delete process.env.KAGI_API_KEY;
		const { api, tools } = createPiHarness();
		extension(api);

		const searchTool = getRegisteredTool(tools, "kagi_search");
		await expect(
			searchTool.execute("missing-key", { query: "why is wal useful?" }, undefined, undefined, undefined),
		).rejects.toBeInstanceOf(KagiConfigError);
	});

	it("surfaces endpoint access errors from the real client layer", async () => {
		const { api, tools } = createPiHarness();
		extension(api);

		const fetchStub = installFetchStub([
			createTextResponse("Search API closed beta", { status: 403 }),
		]);
		restoreFetch = fetchStub.restore;

		const searchTool = getRegisteredTool(tools, "kagi_search");
		let thrown: unknown;
		try {
			await searchTool.execute("search-403", { query: "closed beta endpoint" }, undefined, undefined, undefined);
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toBeInstanceOf(KagiApiError);
		expect(thrown).toMatchObject({ name: "KagiApiError", status: 403 });
		expect((thrown as Error).message).toContain("You do not have access to this endpoint");
	});

	it("keeps sparse-result manual fallback guidance visible on current enrich surfaces", async () => {
		const { api, tools } = createPiHarness();
		extension(api);

		const fetchStub = installFetchStub([
			createJsonResponse({
				meta: { id: "empty-enrich", node: "us-east4", ms: 9, api_balance: 42.3 },
				data: [],
			}),
		]);
		restoreFetch = fetchStub.restore;

		const enrichTool = getRegisteredTool(tools, "kagi_enrich_web");
		expect(enrichTool.promptGuidelines).toContain(
			"If coverage is sparse or the user needs broader results, follow up with kagi_search.",
		);

		const result = await enrichTool.execute(
			"empty-enrich",
			{ query: "quiet topic" },
			undefined,
			undefined,
			undefined,
		);
		expect(result.content[0].text).toBe(
			'No enrich web results found for "quiet topic".\n\n[Estimated cost: $0.00 (no results)]',
		);
		expect(result.details).toEqual({
			query: "quiet topic",
			totalResults: 0,
			estimatedCost: "$0.00 (no results)",
		});
	});
});

describe("TP-009 current-surface cost metadata", () => {
	it("keeps estimated-cost guidance consistent in integrated outputs while deferring TP-008 reporting", async () => {
		const { api, tools } = createPiHarness();
		extension(api);

		const fetchStub = installFetchStub([
			createJsonResponse(SEARCH_RAW_RESPONSE),
			createJsonResponse(ENRICH_WEB_RAW_RESPONSE),
			createJsonResponse(ENRICH_NEWS_RAW_RESPONSE),
			createJsonResponse(FASTGPT_RAW_RESPONSE),
			createJsonResponse(SUMMARIZE_URL_RAW_RESPONSE),
			createJsonResponse(SMALLWEB_RAW_RESPONSE),
		]);
		restoreFetch = fetchStub.restore;

		const searchResult = await getRegisteredTool(tools, "kagi_search").execute(
			"cost-search",
			{ query: "sqlite wal checkpoint behavior", limit: 3 },
			undefined,
			undefined,
			undefined,
		);
		const enrichWebResult = await getRegisteredTool(tools, "kagi_enrich_web").execute(
			"cost-enrich-web",
			{ query: "litestream production lessons" },
			undefined,
			undefined,
			undefined,
		);
		const enrichNewsResult = await getRegisteredTool(tools, "kagi_enrich_news").execute(
			"cost-enrich-news",
			{ query: "recent browser engine news" },
			undefined,
			undefined,
			undefined,
		);
		const fastgptResult = await getRegisteredTool(tools, "kagi_fastgpt").execute(
			"cost-fastgpt",
			{ query: "What changed in Python 3.11?" },
			undefined,
			undefined,
			undefined,
		);
		const summarizeResult = await getRegisteredTool(tools, "kagi_summarize").execute(
			"cost-summarize",
			{ url: "https://example.com/article", engine: "agnes" },
			undefined,
			undefined,
			undefined,
		);
		const smallwebResult = await getRegisteredTool(tools, "kagi_smallweb").execute(
			"cost-smallweb",
			{ limit: 2 },
			undefined,
			undefined,
			undefined,
		);

		expect(searchResult.content[0].text).toContain(`[Estimated cost: ${TOOL_COST_GUIDANCE.kagi_search}]`);
		expect(searchResult.details.estimatedCost).toBe(TOOL_COST_GUIDANCE.kagi_search);
		expect(enrichWebResult.content[0].text).toContain(`[Estimated cost: ${TOOL_COST_GUIDANCE.kagi_enrich_web}]`);
		expect(enrichWebResult.details.estimatedCost).toBe(TOOL_COST_GUIDANCE.kagi_enrich_web);
		expect(enrichNewsResult.content[0].text).toContain(`[Estimated cost: ${TOOL_COST_GUIDANCE.kagi_enrich_news}]`);
		expect(enrichNewsResult.details.estimatedCost).toBe(TOOL_COST_GUIDANCE.kagi_enrich_news);
		expect(fastgptResult.content[0].text).toContain(`[Estimated cost: ${TOOL_COST_GUIDANCE.kagi_fastgpt_cached}]`);
		expect(fastgptResult.details.estimatedCost).toBe(TOOL_COST_GUIDANCE.kagi_fastgpt_cached);
		expect(summarizeResult.content[0].text).toContain(`[Estimated cost: ${TOOL_COST_GUIDANCE.kagi_summarize_cached}]`);
		expect(summarizeResult.details.estimatedCost).toBe(TOOL_COST_GUIDANCE.kagi_summarize_cached);
		expect(smallwebResult.content[0].text).toContain(`[Estimated cost: ${TOOL_COST_GUIDANCE.kagi_smallweb}]`);
		expect(smallwebResult.details.estimatedCost).toBe(TOOL_COST_GUIDANCE.kagi_smallweb);
	});
});
