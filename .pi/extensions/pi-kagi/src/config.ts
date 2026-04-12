/**
 * Config loader for pi-kagi extension.
 *
 * Resolves the Kagi API key and base URL from environment variables
 * with helpful errors when configuration is missing.
 */

/** Default Kagi API base URL (v0) */
export const KAGI_API_BASE_URL = "https://kagi.com/api/v0";

/** Default timeout in milliseconds per endpoint category */
export const TIMEOUTS = {
	/** 30s for search/enrich endpoints */
	search: 30_000,
	/** 60s for FastGPT (can be slow) */
	fastgpt: 60_000,
	/** 60s for Summarizer (can be slow) */
	summarize: 60_000,
	/** 30s default for other endpoints */
	default: 30_000,
} as const;

/** Retry configuration for 429 rate-limit responses */
export const RETRY = {
	/** Maximum number of retries on 429 */
	maxRetries: 3,
	/** Initial backoff in ms */
	initialBackoffMs: 1_000,
	/** Backoff multiplier */
	backoffMultiplier: 2,
	/** Maximum backoff in ms */
	maxBackoffMs: 30_000,
} as const;

/** Resolved configuration for the Kagi client */
export interface KagiConfig {
	apiKey: string;
	baseUrl: string;
}

/**
 * Resolve the Kagi configuration, prioritising the KAGI_API_KEY environment
 * variable. Throws a helpful error if the key is missing.
 */
export function resolveConfig(): KagiConfig {
	const apiKey = process.env.KAGI_API_KEY?.trim();

	if (!apiKey) {
		throw new KagiConfigError(
			"KAGI_API_KEY environment variable is not set. " +
				"Get an API key at https://kagi.com/settings?p=api and set it with: " +
				"export KAGI_API_KEY=your_key_here",
		);
	}

	return {
		apiKey,
		baseUrl: process.env.KAGI_API_BASE_URL?.trim() || KAGI_API_BASE_URL,
	};
}

/**
 * Validate that the Kagi API key is present without throwing.
 * Returns a validation result that can be used for conditional logic.
 */
export function validateConfig(): { valid: true; config: KagiConfig } | { valid: false; error: KagiConfigError } {
	try {
		const config = resolveConfig();
		return { valid: true, config };
	} catch (err) {
		if (err instanceof KagiConfigError) {
			return { valid: false, error: err };
		}
		throw err;
	}
}

/** Error thrown when Kagi configuration is missing or invalid */
export class KagiConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "KagiConfigError";
	}
}