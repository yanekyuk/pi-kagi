import { expect, mock } from "bun:test";

const utf8Encoder = new TextEncoder();

export const MAX_TEST_BYTES = 50 * 1024;
export const MAX_TEST_LINES = 2000;

export interface RegisteredToolDefinition {
	name: string;
	description: string;
	promptSnippet?: string;
	promptGuidelines?: string[];
	parameters: {
		type?: string;
		properties?: Record<string, unknown>;
		additionalProperties?: boolean;
	};
	execute: (...args: any[]) => Promise<any>;
}

export interface RegisteredCommandDefinition {
	description?: string;
	handler: (...args: any[]) => Promise<any>;
}

export interface FetchCall {
	url: string;
	init?: RequestInit;
}

export function countLines(text: string): number {
	return text === "" ? 0 : text.split("\n").length;
}

export function countBytes(text: string): number {
	return utf8Encoder.encode(text).length;
}

export function mockExternalModules(): void {
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
}

export function createPiHarness() {
	const tools: RegisteredToolDefinition[] = [];
	const commands = new Map<string, RegisteredCommandDefinition>();
	const notifications: Array<{ message: string; level: string }> = [];
	const eventHandlers = new Map<string, Array<(...args: any[]) => Promise<void> | void>>();

	const api = {
		registerTool(definition: RegisteredToolDefinition) {
			tools.push(definition);
		},
		registerCommand(name: string, definition: RegisteredCommandDefinition) {
			commands.set(name, definition);
		},
		on(eventName: string, handler: (...args: any[]) => Promise<void> | void) {
			const handlers = eventHandlers.get(eventName) ?? [];
			handlers.push(handler);
			eventHandlers.set(eventName, handlers);
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

	const ui = {
		notify(message: string, level: string) {
			notifications.push({ message, level });
		},
	};

	return {
		api: api as any,
		tools,
		commands,
		notifications,
		eventHandlers,
		ui,
	};
}

export function getRegisteredTool(tools: RegisteredToolDefinition[], name: string): RegisteredToolDefinition {
	const tool = tools.find((candidate) => candidate.name === name);
	expect(tool).toBeDefined();
	return tool!;
}

export function createJsonResponse(body: unknown, init: ResponseInit = {}): Response {
	return new Response(JSON.stringify(body), {
		status: init.status ?? 200,
		headers: {
			"content-type": "application/json",
			...(init.headers ?? {}),
		},
	});
}

export function createTextResponse(body: string, init: ResponseInit = {}): Response {
	return new Response(body, {
		status: init.status ?? 500,
		headers: init.headers,
	});
}

export function installFetchStub(
	responses: Array<Response | Error | ((url: string, init?: RequestInit) => Response | Promise<Response>)>,
) {
	const originalFetch = globalThis.fetch;
	const calls: FetchCall[] = [];
	let index = 0;

	globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
		const url = input instanceof Request ? input.url : String(input);
		calls.push({ url, init });
		const next = responses[index++];
		if (!next) {
			throw new Error(`Unexpected fetch call for ${url}`);
		}
		if (typeof next === "function") {
			return await next(url, init);
		}
		if (next instanceof Error) {
			throw next;
		}
		return next;
	}) as typeof fetch;

	return {
		calls,
		restore() {
			globalThis.fetch = originalFetch;
		},
	};
}
