/**
 * Error handling for pi-kagi extension.
 *
 * Provides a normalized error hierarchy for Kagi API errors,
 * including HTTP status mapping, retry policy, and user-facing messages.
 */

/** Standardized error metadata for any Kagi API failure */
export interface KagiErrorResponse {
	status: number;
	message: string;
	retryable: boolean;
}

/**
 * Determine whether an HTTP status code indicates a retryable error.
 *
 * - 429 (rate limited) → retryable
 * - 5xx (server errors) → retryable
 * - everything else → not retryable
 */
export function isRetryableStatus(status: number): boolean {
	return status === 429 || (status >= 500 && status < 600);
}

/**
 * Map an HTTP status code to a user-facing error message with
 * actionable guidance.
 */
export function statusToUserMessage(status: number, body?: string): string {
	switch (status) {
		case 400:
			return `Kagi API error (400 Bad Request): ${body || "Invalid request parameters. Check your query and try again."}`;
		case 401:
			return "Kagi API error (401 Unauthorized): Invalid or missing API key. Set the KAGI_API_KEY environment variable or configure it in pi settings.";
		case 402:
			return "Kagi API error (402 Payment Required): Insufficient API credits. Add credits at https://kagi.com/settings/billing_api";
		case 403:
			return "Kagi API error (403 Forbidden): You do not have access to this endpoint. It may require an invite (e.g., Search API is closed beta).";
		case 404:
			return `Kagi API error (404 Not Found): The requested endpoint or resource does not exist.${body ? ` ${body}` : ""}`;
		case 429:
			return `Kagi API error (429 Rate Limited): Request rate limit exceeded. Retrying after backoff...`;
		default:
			if (status >= 500) {
				return `Kagi API error (${status} Server Error): Kagi is experiencing issues. Try again later.`;
			}
			return `Kagi API error (${status}): ${body || "Unexpected error."}`;
	}
}

/** Base error class for all Kagi API errors */
export class KagiApiError extends Error {
	/** HTTP status code from the API response */
	readonly status: number;
	/** Whether the request can be retried */
	readonly retryable: boolean;
	/** Raw response body (if available) */
	readonly body?: string;

	constructor(status: number, message?: string, body?: string) {
		const userMessage = message || statusToUserMessage(status, body);
		super(userMessage);
		this.name = "KagiApiError";
		this.status = status;
		this.retryable = isRetryableStatus(status);
		this.body = body;
	}

	/** Convert to a normalized error response object */
	toResponse(): KagiErrorResponse {
		return {
			status: this.status,
			message: this.message,
			retryable: this.retryable,
		};
	}
}

/** Error thrown when a network request fails (no HTTP response) */
export class KagiNetworkError extends Error {
	readonly retryable = true;

	constructor(
		message: string,
		public readonly cause?: Error,
	) {
		super(`Kagi network error: ${message}`);
		this.name = "KagiNetworkError";
	}

	toResponse(): KagiErrorResponse {
		return {
			status: 0,
			message: this.message,
			retryable: true,
		};
	}
}

/** Error thrown when a request times out */
export class KagiTimeoutError extends Error {
	readonly retryable = true;

	constructor(
		message: string,
		public readonly timeoutMs: number,
	) {
		super(`Kagi timeout: ${message}`);
		this.name = "KagiTimeoutError";
	}

	toResponse(): KagiErrorResponse {
		return {
			status: 0,
			message: this.message,
			retryable: true,
		};
	}
}