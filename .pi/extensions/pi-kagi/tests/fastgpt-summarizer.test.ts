import { describe, expect, it, mock } from "bun:test";

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
		Boolean: (options?: Record<string, unknown>) => ({ type: "boolean", ...options }),
		Optional: (schema: Record<string, unknown>) => ({ ...schema, optional: true }),
	},
}));

mock.module("@mariozechner/pi-ai", () => ({
	StringEnum: (values: readonly string[]) => ({ type: "string", enum: [...values] }),
}));

const { registerFastGPTTool } = await import("../src/tools/fastgpt.ts");
const { registerSummarizerTool } = await import("../src/tools/summarizer.ts");
const {
	formatFastGPTReference,
	formatFastGPTResponse,
	formatSummarizeResponse,
	truncateFastGPTOutput,
} = await import("../src/formatters/answers.ts");

interface RegisteredToolDefinition {
	name: string;
	description: string;
	parameters: {
		type: string;
		properties: Record<string, unknown>;
		additionalProperties?: boolean;
	};
	execute: (...args: any[]) => Promise<any>;
}

function createPiStub() {
	const tools: RegisteredToolDefinition[] = [];

	const api = {
		registerTool(definition: RegisteredToolDefinition) {
			tools.push(definition);
		},
	};

	return { api: api as any, tools };
}

function getRegisteredTool(tools: RegisteredToolDefinition[], name: string): RegisteredToolDefinition {
	const tool = tools.find((candidate) => candidate.name === name);
	expect(tool).toBeDefined();
	return tool!;
}

describe("TP-006 FastGPT tool schema", () => {
	it("registers query/cache parameters and keeps web_search internal", () => {
		const { api, tools } = createPiStub();

		registerFastGPTTool(api, () => ({ fastgpt: async () => { throw new Error("not used"); } }) as any);
		const tool = getRegisteredTool(tools, "kagi_fastgpt");

		expect(tool.parameters.type).toBe("object");
		expect(tool.parameters.additionalProperties).toBe(false);
		expect(Object.keys(tool.parameters.properties)).toEqual(["query", "cache"]);
		expect(tool.description).toContain("Web search grounding is always enabled by the API");
	});
});

describe("TP-006 FastGPT formatters", () => {
	it("formats answer text, citation-friendly sources, and token metadata in reference order", () => {
		const formatted = formatFastGPTResponse({
			meta: { id: "meta-id", node: "us-east4", ms: 42 },
			output: "Python 3.11 improved performance [1] and typing ergonomics [2].",
			tokens: 757,
			references: [
				{
					title: "What's New In Python 3.11",
					snippet: "Official release notes",
					url: "https://docs.python.org/3/whatsnew/3.11.html",
				},
				{
					title: "Earthly blog",
					snippet: "Feature overview",
					url: "https://earthly.dev/blog/python-3-11-new-features/",
				},
			],
		});

		expect(formatted).toContain("Python 3.11 improved performance [1] and typing ergonomics [2].");
		expect(formatted).toContain("Sources:\n[1](https://docs.python.org/3/whatsnew/3.11.html) — What's New In Python 3.11");
		expect(formatted).toContain("[2](https://earthly.dev/blog/python-3-11-new-features/) — Earthly blog");
		expect(formatted).toContain("[Tokens processed: 757 | Sources: 2]");
		expect(formatFastGPTReference({}, 3)).toBe("[3] Source 3");
	});

	it("truncates only the answer body while preserving sources and token metadata", () => {
		const longAnswer = Array.from(
			{ length: MAX_TEST_LINES + 120 },
			(_, index) => `Answer line ${index + 1} — ${"X".repeat(40)}`,
		).join("\n");
		const truncated = truncateFastGPTOutput({
			meta: { id: "meta-id", node: "us-east4", ms: 42 },
			output: longAnswer,
			tokens: 1200,
			references: [
				{
					title: "Ref One",
					snippet: "One",
					url: "https://example.com/one",
				},
				{
					title: "Ref Two",
					snippet: "Two",
					url: "https://example.com/two",
				},
			],
		});

		expect(countLines(truncated)).toBeLessThanOrEqual(MAX_TEST_LINES);
		expect(countBytes(truncated)).toBeLessThanOrEqual(MAX_TEST_BYTES);
		expect(truncated).toContain("[FastGPT answer truncated to fit Pi output limits; sources and token metadata preserved.]");
		expect(truncated).toContain("Sources:\n[1](https://example.com/one) — Ref One");
		expect(truncated).toContain("[Tokens processed: 1200 | Sources");
		expect(truncated).not.toContain(`Answer line ${MAX_TEST_LINES + 120}`);
	});

	it("keeps cited high-index references when the full source list would overflow Pi limits", () => {
		const references = Array.from({ length: 3000 }, (_, index) => ({
			title: `Reference ${index + 1}`,
			snippet: `Snippet ${index + 1}`,
			url: `https://example.com/${index + 1}`,
		}));
		const truncated = truncateFastGPTOutput({
			meta: { id: "meta-id", node: "us-east4", ms: 42 },
			output: "Conclusion supported by [3000].",
			tokens: 2048,
			references,
		});

		expect(countLines(truncated)).toBeLessThanOrEqual(MAX_TEST_LINES);
		expect(countBytes(truncated)).toBeLessThanOrEqual(MAX_TEST_BYTES);
		expect(truncated).toContain("Conclusion supported by [3000].");
		expect(truncated).toContain("Sources:\n[3000](https://example.com/3000) — Reference 3000");
		expect(truncated).toContain("[Tokens processed: 2048 | Sources shown: 1 of 3000]");
		expect(truncated).not.toContain("[1](https://example.com/1) — Reference 1");
	});

	it("preserves a concise uncited answer while compacting an oversized source list", () => {
		const references = Array.from({ length: 1200 }, (_, index) => ({
			title: `Reference ${index + 1}`,
			snippet: "",
			url: `https://example.com/${index + 1}`,
		}));
		const truncated = truncateFastGPTOutput({
			meta: { id: "meta-id", node: "us-east4", ms: 42 },
			output: "A concise answer with no inline citations.",
			tokens: 333,
			references,
		});

		expect(countLines(truncated)).toBeLessThanOrEqual(MAX_TEST_LINES);
		expect(countBytes(truncated)).toBeLessThanOrEqual(MAX_TEST_BYTES);
		expect(truncated).toContain("A concise answer with no inline citations.");
		expect(truncated).toContain("[Showing first");
		expect(truncated).toContain("[Tokens processed: 333 | Sources shown:");
	});

	it("keeps pathological single-reference fallbacks inside Pi hard limits", () => {
		const hugeTitle = `${"T".repeat(70000)}\n${"U\n".repeat(2500)}`;
		const truncated = truncateFastGPTOutput({
			meta: { id: "meta-id", node: "us-east4", ms: 42 },
			output: "Brief answer with no citations.",
			tokens: 444,
			references: [
				{
					title: hugeTitle,
					snippet: "",
					url: "https://example.com/pathological",
				},
			],
		});

		expect(countLines(truncated)).toBeLessThanOrEqual(MAX_TEST_LINES);
		expect(countBytes(truncated)).toBeLessThanOrEqual(MAX_TEST_BYTES);
		expect(truncated).toContain("Brief answer with no citations.");
		expect(truncated).not.toContain("\n\n\n");
	});
});

describe("TP-006 FastGPT execute path", () => {
	it("maps output, references, and tokens into the standard content/details shape", async () => {
		const { api, tools } = createPiStub();
		const response = {
			meta: { id: "meta-id", node: "us-east4", ms: 42 },
			output: "Python 3.11 improved performance [1].",
			tokens: 757,
			references: [
				{
					title: "What's New In Python 3.11",
					snippet: "Official release notes",
					url: "https://docs.python.org/3/whatsnew/3.11.html",
				},
			],
		};

		registerFastGPTTool(api, () => ({ fastgpt: async () => response }) as any);
		const tool = getRegisteredTool(tools, "kagi_fastgpt");

		const result = await tool.execute(
			"tool-call-id",
			{ query: "What changed in Python 3.11?", cache: false },
			undefined,
			undefined,
			undefined,
		);

		expect(result.content).toEqual([
			{
				type: "text",
				text:
					"Python 3.11 improved performance [1].\n\n" +
					"Sources:\n" +
					"[1](https://docs.python.org/3/whatsnew/3.11.html) — What's New In Python 3.11\n\n" +
					"[Tokens processed: 757 | Sources: 1]",
			},
		]);
		expect(result.details).toEqual({
			query: "What changed in Python 3.11?",
			tokens: 757,
			referenceCount: 1,
			references: response.references,
			meta: response.meta,
		});
	});
});

describe("TP-006 Summarizer schema and validation", () => {
	it("registers url/text options with typed summary controls", () => {
		const { api, tools } = createPiStub();

		registerSummarizerTool(api, () => ({ summarize: async () => { throw new Error("not used"); } }) as any);
		const tool = getRegisteredTool(tools, "kagi_summarize");

		expect(tool.parameters.type).toBe("object");
		expect(tool.parameters.additionalProperties).toBe(false);
		expect(Object.keys(tool.parameters.properties)).toEqual([
			"url",
			"text",
			"engine",
			"summary_type",
			"target_language",
			"cache",
		]);
		expect((tool.parameters.properties.engine as any).enum).toEqual(["cecil", "agnes", "daphne", "muriel"]);
		expect((tool.parameters.properties.summary_type as any).enum).toEqual(["summary", "takeaway"]);
		expect(tool.description).toContain("Text submissions are sent through POST requests");
	});

	it("rejects missing or conflicting url/text inputs with an actionable error", async () => {
		const { api, tools } = createPiStub();
		registerSummarizerTool(api, () => ({ summarize: async () => ({}) }) as any);
		const tool = getRegisteredTool(tools, "kagi_summarize");

		expect(
			tool.execute("tool-call-id", { url: "https://example.com", text: "duplicate" }, undefined, undefined, undefined),
		).rejects.toThrow("Provide exactly one of `url` or `text`");
		expect(
			tool.execute("tool-call-id", {}, undefined, undefined, undefined),
		).rejects.toThrow("Provide exactly one of `url` or `text`");
	});

	it("formats summarizer output and maps option details into the tool result", async () => {
		const { api, tools } = createPiStub();
		const response = {
			meta: { id: "meta-id", node: "us-east4", ms: 25 },
			output: "• Key takeaway one\n• Key takeaway two",
			tokens: 500,
		};
		let capturedParams: Record<string, unknown> | undefined;

		registerSummarizerTool(api, () => ({
			summarize: async (params: Record<string, unknown>) => {
				capturedParams = params;
				return response;
			},
		}) as any);
		const tool = getRegisteredTool(tools, "kagi_summarize");

		expect(formatSummarizeResponse(response as any)).toContain("[Tokens processed: 500]");

		const result = await tool.execute(
			"tool-call-id",
			{
				url: "https://example.com/article",
				engine: "agnes",
				summary_type: "takeaway",
				target_language: "en",
				cache: false,
			},
			undefined,
			undefined,
			undefined,
		);

		expect(capturedParams).toEqual({
			url: "https://example.com/article",
			engine: "agnes",
			summary_type: "takeaway",
			target_language: "EN",
			cache: false,
		});
		expect(result.content[0].text).toContain("• Key takeaway one");
		expect(result.content[0].text).toContain("[Tokens processed: 500]");
		expect(result.details).toEqual({
			input: { type: "url", value: "https://example.com/article" },
			engine: "agnes",
			summary_type: "takeaway",
			target_language: "EN",
			cache: false,
			tokens: 500,
			meta: response.meta,
		});
	});

	it("rejects unsupported languages, oversized text, and invalid URLs with actionable guidance", async () => {
		const { api, tools } = createPiStub();
		registerSummarizerTool(api, () => ({ summarize: async () => ({}) }) as any);
		const tool = getRegisteredTool(tools, "kagi_summarize");

		expect(
			tool.execute(
				"tool-call-id",
				{ url: "https://example.com", target_language: "xx" },
				undefined,
				undefined,
				undefined,
			),
		).rejects.toThrow("Unsupported `target_language`");
		expect(
			tool.execute(
				"tool-call-id",
				{ text: "A".repeat(1_000_001) },
				undefined,
				undefined,
				undefined,
			),
		).rejects.toThrow("Provide a URL instead or shorten the pasted text.");
		expect(
			tool.execute(
				"tool-call-id",
				{ url: "not-a-url" },
				undefined,
				undefined,
				undefined,
			),
		).rejects.toThrow("`url` must be an absolute URL");
	});
});
