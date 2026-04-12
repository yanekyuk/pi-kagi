/**
 * pi-kagi — Pi skill for using Kagi API
 *
 * Extension entry point. Registers tools and commands for Kagi API integration.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { resolveConfig, validateConfig } from "./src/config.ts";

export { KagiClient, KAGI_SMALLWEB_BASE_URL } from "./src/kagi-client.ts";
export { resolveConfig, validateConfig, KagiConfigError, KAGI_API_BASE_URL, TIMEOUTS, RETRY, type RetryConfig } from "./src/config.ts";
export { KagiError, KagiApiError, KagiNetworkError, KagiTimeoutError, isRetryableStatus, statusToUserMessage } from "./src/errors.ts";

const VERSION = "0.1.0";

export default function (pi: ExtensionAPI) {
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

	// Show extension info
	pi.registerCommand("kagi-about", {
		description: "Show information about the pi-kagi extension",
		handler: async (_args, ctx) => {
			const result = validateConfig();
			const keyStatus = result.valid ? "✅ configured" : "❌ not set";
			ctx.ui.notify(
				`pi-kagi v${VERSION} — Pi skill for using Kagi API\n` +
					`API key: ${keyStatus}\n` +
					"Endpoints: search, fastgpt, summarize, enrich/web, enrich/news, smallweb\n" +
					"Status: core client ready, tools will be added in subsequent tasks",
				"info",
			);
		},
	});
}