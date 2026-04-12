/**
 * pi-kagi — Pi skill for using Kagi API
 *
 * Extension entry point. Registers tools and commands for Kagi API integration.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { KagiClient } from "./src/kagi-client.ts";
import { resolveConfig, validateConfig, KagiConfigError } from "./src/config.ts";
import { registerSearchTool } from "./src/tools/search.ts";

export { KagiClient, KAGI_SMALLWEB_BASE_URL } from "./src/kagi-client.ts";
export { resolveConfig, validateConfig, KagiConfigError, KAGI_API_BASE_URL, TIMEOUTS, RETRY, type RetryConfig } from "./src/config.ts";
export { KagiError, KagiApiError, KagiNetworkError, KagiTimeoutError, isRetryableStatus, statusToUserMessage } from "./src/errors.ts";

const VERSION = "0.1.0";

export default function (pi: ExtensionAPI) {
	// Create the KagiClient lazily — resolved when first needed
	let client: KagiClient | null = null;

	function getClient(): KagiClient {
		if (!client) {
			const config = resolveConfig();
			client = new KagiClient(config);
		}
		return client;
	}

	// Validate config on session start — gives early feedback if key is missing
	pi.on("session_start", async (_event, ctx) => {
		const result = validateConfig();
		if (result.valid) {
			ctx.ui.notify(`pi-kagi v${VERSION} loaded (API key configured)`, "info");
		} else {
			ctx.ui.notify(
				`pi-kagi v${VERSION} loaded, but KAGI_API_KEY is not set. ` +
					"Kagi tools will not work until the key is configured. " +
					"Set it with: export KAGI_API_KEY=your_key_here",
				"warn",
			);
		}
	});

	// Register tools
	registerSearchTool(pi, getClient());

	// Show extension info
	pi.registerCommand("kagi-about", {
		description: "Show information about the pi-kagi extension",
		handler: async (_args, ctx) => {
			const result = validateConfig();
			const keyStatus = result.valid ? "✅ configured" : "❌ not set";
			ctx.ui.notify(
				`pi-kagi v${VERSION} — Pi skill for using Kagi API\n` +
					`API key: ${keyStatus}\n` +
					"Tools: kagi_search\n" +
					"Endpoints: search, enrich/web, enrich/news, fastgpt, summarize, smallweb",
				"info",
			);
		},
	});
}