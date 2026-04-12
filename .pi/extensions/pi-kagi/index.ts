/**
 * pi-kagi — Pi skill for using Kagi API
 *
 * Extension entry point. Registers tools and commands for Kagi API integration.
 * Currently a scaffold: API tool implementations will follow in subsequent tasks.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const VERSION = "0.1.0";

export default function (pi: ExtensionAPI) {
	// Register a startup notice so users can confirm the extension loaded
	pi.on("session_start", async (_event, ctx) => {
		ctx.ui.notify(`pi-kagi v${VERSION} loaded`, "info");
	});

	// Minimal command to prove the extension loads and works
	pi.registerCommand("kagi-about", {
		description: "Show information about the pi-kagi extension",
		handler: async (_args, ctx) => {
			ctx.ui.notify(
				`pi-kagi v${VERSION} — Pi skill for using Kagi API\n` +
					"Kagi API endpoints: search, fastgpt, summarize, enrich/web, enrich/news, smallweb\n" +
					"Status: scaffold (no API calls implemented yet)",
				"info",
			);
		},
	});
}