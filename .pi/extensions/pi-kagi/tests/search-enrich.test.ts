import { describe, expect, it, beforeEach, afterEach, mock } from "bun:test";
import type { SearchItem, SearchResponse, SmallWebResponse } from "../src/types.ts";

const utf8Encoder = new TextEncoder();
const MAX_TEST_BYTES = 50 * 1024;
const MAX_TEST_LINES = 2000;

function countLines(text: string): number {
	return text === "" ? 0 : text.split("\n").length;
}

function countBytes(text: string): number {
	return utf8Encoder.encode(text).length;
}

mock.module("@mariozechner/pi-coding-agent", () => ({
	DEFAULT_MAX_BYTES: MAX_TEST_BYTES,
	DEFAULT_MAX_LINES: MAX_TEST_LINES,
	truncateHead(content: string, options: { maxLines?: number; maxBytes?: number }) {
		const maxLines = options.maxLines ?? MAX_TEST_LINES;
		const maxBytes = options.maxBytes ?? MAX_TEST_BYTES;
		let truncated = false;
		let result = content;

		if (countLines(result) > maxLines) {
			result = result.split("\n").slice(0, maxLines).join("\n");
			truncated = true;
		}

		while (countBytes(result) > maxBytes && result.length > 0) {
			result = result.slice(0, -1);
			truncated = true;
		}

		return { content: result, truncated };
	},
}));

mock.module("@sinclair/typebox", () => ({
	Type: {
		Object: (properties: Record<string, unknown>, options?: Record<string, unknown>) => ({
			type: "object",
			properties,
			...options,
		}),
		String: (options?: Record<string, unknown>) => ({ type: "string", ...options }),
		Number: (options?: Record<string, unknown>) => ({ type: "number", ...options }),
		Boolean: (options?: Record<string, unknown>) => ({ type: "boolean", ...options }),
		Optional: (schema: Record<string, unknown>) => ({ ...schema, optional: true }),
	},
}));

mock.module("@mariozechner/pi-ai", () => ({
	StringEnum: (values: readonly string[]) => ({ type: "string", enum: [...values] }),
}));

const { default: extension } = await import("../index.ts");
const { KagiError } = await import("../src/config.ts");
const {
	formatSearchResponse,
	formatSmallWebResponse,
	truncateSearchOutput,
	truncateSmallWebOutput,
} = await import("../src/formatters/results.ts");
const { registerSearchTool } = await import("../src/tools/search.ts");
const { registerEnrichWebTool } = await import("../src/tools/enrich.ts");
const { registerSmallWebTool } = await import("../src/tools/smallweb.ts");

interface RegisteredToolDefinition {
	name: string;
	description: string;
	promptSnippet?: string;
	promptGuidelines?: string[];
	parameters: unknown;
	execute: (...args: any[]) => Promise<any>;
}

interface RegisteredCommandDefinition {
	description?: string;
	handler: (...args: any[]) => Promise<any>;
}

const originalApiKey = process.env.KAGI_API_KEY;

function createSearchResponse(items: SearchItem[], meta?: Partial<SearchResponse["meta"]>): SearchResponse {
	return {
		meta: {
			id: "meta-id",
			node: "us-east4",
			ms: 12,
			...meta,
		},
		items,
	};
}

function createSmallWebResponse(entries: SmallWebResponse["entries"]): SmallWebResponse {
	return { entries };
}

function createPiStub() {
	const tools: RegisteredToolDefinition[] = [];
	const commands = new Map<string, RegisteredCommandDefinition>();

	const api = {
		registerTool(definition: RegisteredToolDefinition) {
			tools.push(definition);
		},
		registerCommand(name: string, definition: RegisteredCommandDefinition) {
			commands.set(name, definition);
		},
		on() {
			// Event hooks are not exercised in these tests.
		},
		getAllTools() {
			return tools.map((tool) => ({
				name: tool.name,
				description: tool.description,
				parameters: tool.parameters,
				sourceInfo: { source: "extension", path: "<test>", scope: "top-level", origin: "test" },
			}));
		},
	};

	return { api: api as any, tools, commands };
}

function getRegisteredTool(tools: RegisteredToolDefinition[], name: string): RegisteredToolDefinition {
	const tool = tools.find((candidate) => candidate.name === name);
	expect(tool).toBeDefined();
	return tool!;
}

describe("search/enrich formatters", () => {
	it("formats search results with citations, dates, related queries, and API balance", () => {
		const response = createSearchResponse(
			[
				{
					type: "result",
					data: {
						url: "https://example.com/alpha",
						title: "Alpha Result",
						snippet: "Alpha snippet",
						published: "2024-01-02T00:00:00Z",
						rank: 3,
					},
				},
				{
					type: "result",
					data: {
						url: "https://example.com/beta",
						title: "Beta Result",
						snippet: "",
					},
				},
				{
					type: "related",
					data: { queries: ["query one", "query two", "query three", "query four"] },
				},
			],
			{ apiBalance: 12.34 },
		);

		const formatted = formatSearchResponse(response, { includeRank: true, maxRelatedQueries: 3 });

		expect(formatted).toContain("[1](https://example.com/alpha) — Alpha Result (Jan 2, 2024) [rank: 3]");
		expect(formatted).toContain("    Alpha snippet");
		expect(formatted).toContain("[2](https://example.com/beta) — Beta Result");
		expect(formatted).toContain("Related searches: query one, query two, query three");
		expect(formatted).not.toContain("query four");
		expect(formatted).toContain("[API balance: $12.34]");
		expect(formatted).not.toContain("undefined");
	});

	it("formats Small Web entries and handles empty feeds", () => {
		const populated = formatSmallWebResponse(
			createSmallWebResponse([
				{
					title: "Indie Post",
					url: "https://small.example/post",
					snippet: "A thoughtful note.",
					author: "Jane Example",
					published: "2024-03-04T00:00:00Z",
				},
				{
					title: "Snippetless",
					url: "https://small.example/quiet",
					snippet: "",
				},
			]),
		);

		expect(populated).toContain("• Indie Post (Jane Example, Mar 4, 2024)");
		expect(populated).toContain("  https://small.example/post");
		expect(populated).toContain("  A thoughtful note.");
		expect(populated).toContain("• Snippetless");
		expect(populated).not.toContain("undefined");

		const empty = formatSmallWebResponse(createSmallWebResponse([]));
		expect(empty).toBe("No Small Web entries found.");
	});
});

describe("TP-005 truncation helpers", () => {
	it("keeps truncated search output within pi line limits and appends a notice", () => {
		const formatted = Array.from(
			{ length: MAX_TEST_LINES + 150 },
			(_, index) => `[${index + 1}](https://example.com/${index + 1}) — Result ${index + 1}`,
		).join("\n");

		const truncated = truncateSearchOutput(formatted, MAX_TEST_LINES + 150);

		expect(countLines(truncated)).toBeLessThanOrEqual(MAX_TEST_LINES);
		expect(countBytes(truncated)).toBeLessThanOrEqual(MAX_TEST_BYTES);
		expect(truncated).toStartWith("[1](https://example.com/1) — Result 1");
		expect(truncated).toContain("[Showing");
		expect(truncated).not.toContain(`[${MAX_TEST_LINES + 150}](https://example.com/${MAX_TEST_LINES + 150})`);
	});

	it("keeps truncated search output within pi byte limits after the notice is appended", () => {
		const longTitle = "X".repeat(1600);
		const formatted = Array.from(
			{ length: 80 },
			(_, index) => `[${index + 1}](https://example.com/${index + 1}) — ${longTitle}`,
		).join("\n");

		const truncated = truncateSearchOutput(formatted, 80);

		expect(countBytes(truncated)).toBeLessThanOrEqual(MAX_TEST_BYTES);
		expect(truncated).toContain("[Showing");
	});

	it("keeps truncated Small Web output within pi limits and uses the Small Web notice", () => {
		const formatted = Array.from(
			{ length: MAX_TEST_LINES + 150 },
			(_, index) => `• Entry ${index + 1}`,
		).join("\n");

		const truncated = truncateSmallWebOutput(formatted, MAX_TEST_LINES + 150);

		expect(countLines(truncated)).toBeLessThanOrEqual(MAX_TEST_LINES);
		expect(countBytes(truncated)).toBeLessThanOrEqual(MAX_TEST_BYTES);
		expect(truncated).toStartWith("• Entry 1");
		expect(truncated).toContain("Small Web entries.");
		expect(truncated).not.toContain(`• Entry ${MAX_TEST_LINES + 150}`);
	});
});

describe("TP-005 registration metadata", () => {
	beforeEach(() => {
		process.env.KAGI_API_KEY = "test-api-key";
	});

	afterEach(() => {
		if (originalApiKey === undefined) {
			delete process.env.KAGI_API_KEY;
		} else {
			process.env.KAGI_API_KEY = originalApiKey;
		}
	});

	it("registers TP-005 tools with prompt metadata and exposes them via kagi-about", async () => {
		const { api, tools, commands } = createPiStub();
		extension(api);

		const toolNames = tools.map((tool) => tool.name).sort();
		expect(toolNames).toEqual(expect.arrayContaining([
			"kagi_enrich_news",
			"kagi_enrich_web",
			"kagi_search",
			"kagi_smallweb",
		]));

		const searchTool = getRegisteredTool(tools, "kagi_search");
		expect(searchTool.promptSnippet).toBe("Search the web for general information with source links.");
		expect(searchTool.promptGuidelines).toContain(
			"Use this as the default web lookup when the user needs broad coverage or direct citations.",
		);

		const enrichTool = getRegisteredTool(tools, "kagi_enrich_web");
		expect(enrichTool.promptSnippet).toBe(
			"Find non-commercial web sources, blogs, and community discussions.",
		);
		expect(enrichTool.promptGuidelines).toContain(
			"If coverage is sparse or the user needs broader results, follow up with kagi_search.",
		);

		const aboutCommand = commands.get("kagi-about");
		expect(aboutCommand).toBeDefined();

		const notifications: Array<{ message: string; level: string }> = [];
		await aboutCommand!.handler("", {
			ui: {
				notify(message: string, level: string) {
					notifications.push({ message, level });
				},
			},
		});

		expect(notifications.length).toBe(1);
		expect(notifications[0].level).toBe("info");
		expect(notifications[0].message).toContain("API key: ✅ configured");
		expect(notifications[0].message).toContain(
			"- kagi_search: Search the web using Kagi's premium search API",
		);
		expect(notifications[0].message).toContain(
			"- kagi_smallweb: Browse Kagi's Small Web feed — a curated selection of recent content from personal blogs and independent websites",
		);
	});
});

describe("TP-005 tool execute paths", () => {
	it("executes the search tool and returns formatted citations with details", async () => {
		const { api, tools } = createPiStub();
		const response = createSearchResponse(
			[
				{
					type: "result",
					data: {
						url: "https://example.com/search",
						title: "Search Result",
						snippet: "Search snippet",
						published: "2024-02-01T00:00:00Z",
					},
				},
				{ type: "related", data: { queries: ["query alt"] } },
			],
			{ apiBalance: 9.99 },
		);

		registerSearchTool(api, () => ({ search: async () => response }) as any);
		const searchTool = getRegisteredTool(tools, "kagi_search");

		const result = await searchTool.execute(
			"call-1",
			{ query: "test query", limit: 5 },
			new AbortController().signal,
			() => {},
			{} as any,
		);

		expect(result.content[0].text).toContain("[1](https://example.com/search) — Search Result (Feb 1, 2024)");
		expect(result.content[0].text).toContain("Related searches: query alt");
		expect(result.content[0].text).toContain("[Estimated cost: ~$0.025/query]");
		expect(result.details).toEqual({
			query: "test query",
			totalResults: 1,
			meta: response.meta,
			estimatedCost: "~$0.025/query",
		});
	});

	it("returns a friendly empty-result response for the enrich web tool", async () => {
		const { api, tools } = createPiStub();
		registerEnrichWebTool(api, () => ({ enrichWeb: async () => createSearchResponse([]) }) as any);
		const enrichTool = getRegisteredTool(tools, "kagi_enrich_web");

		const result = await enrichTool.execute(
			"call-2",
			{ query: "quiet topic" },
			new AbortController().signal,
			() => {},
			{} as any,
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

	it("rethrows KagiError values from the smallweb tool", async () => {
		const { api, tools } = createPiStub();
		const expectedError = new KagiError("network exploded");
		registerSmallWebTool(api, () => ({ smallweb: async () => Promise.reject(expectedError) }) as any);
		const smallWebTool = getRegisteredTool(tools, "kagi_smallweb");

		await expect(
			smallWebTool.execute(
				"call-3",
				{ limit: 3 },
				new AbortController().signal,
				() => {},
				{} as any,
			),
		).rejects.toBe(expectedError);
	});
});
