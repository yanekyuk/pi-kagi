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

const { registerFastGPTTool } = await import("../src/tools/fastgpt.ts");
const {
	formatFastGPTReference,
	formatFastGPTResponse,
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
		expect(truncated).toContain("[2](https://example.com/two) — Ref Two");
		expect(truncated).toContain("[Tokens processed: 1200 | Sources: 2]");
		expect(truncated).not.toContain(`Answer line ${MAX_TEST_LINES + 120}`);
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
