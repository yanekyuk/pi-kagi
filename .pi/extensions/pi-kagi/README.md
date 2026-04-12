# pi-kagi

**Pi skill for using Kagi API**

A [pi-coding-agent](https://github.com/nickvdp/pi-coding-agent) extension that integrates [Kagi's APIs](https://help.kagi.com/kagi/api/overview.html) as callable tools for the pi agent.

## Status

**Core client ready** — config, error handling, and typed API client implemented. API tool implementations will follow in subsequent development phases.

## Installation

This extension is project-local. Place it at `.pi/extensions/pi-kagi/` and pi will auto-discover it on startup.

### Requirements

- A Kagi API key ([get one here](https://kagi.com/settings?p=api))
- Set the `KAGI_API_KEY` environment variable, or configure it in pi settings

### Quick Start

```bash
# Set your API key
export KAGI_API_KEY=your_key_here

# pi will auto-discover the extension when launched in this project
pi

# Verify the extension loaded
/kagi-about
```

## Available Commands

| Command | Description |
|---------|-------------|
| `/kagi-about` | Show extension version and API key configuration status |

## Available Tools

*(None yet — will be added in future development tasks: TP-005 through TP-007)*

Planned tools:
- `kagi_search` — Premium search results
- `kagi_fastgpt` — LLM-generated answers with search
- `kagi_summarize` — Summarize URLs, text, or documents
- `kagi_enrich_web` — Non-commercial web results (Teclis index)
- `kagi_enrich_news` — Non-commercial news results
- `kagi_smallweb` — Kagi Small Web feed
- `kagi_web_access` — Smart routing orchestrator

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `KAGI_API_KEY` | — | Kagi API key (required) |
| `KAGI_API_BASE_URL` | `https://kagi.com/api/v0` | Kagi API endpoint |

The extension validates the API key on session start and shows a warning if it's missing. All Kagi tools will fail with a helpful error message if the key is not configured.

### Error Messages

When the API key is missing, the extension shows:

```
pi-kagi v0.1.0 loaded, but KAGI_API_KEY is not set. Kagi tools will not work
until the key is configured. Set it with: export KAGI_API_KEY=your_key_here
```

## Error Handling

The Kagi client provides clear, actionable error messages:

| Error | Message Pattern |
|-------|----------------|
| 401 Unauthorized | "Invalid or missing API key. Set the KAGI_API_KEY environment variable." |
| 402 Payment Required | "Insufficient API credits. Add credits at https://kagi.com/settings/billing_api" |
| 403 Forbidden | "You do not have access to this endpoint." |
| 429 Rate Limited | "Request rate limit exceeded. Retrying after backoff..." |
| 5xx Server Error | "Kagi is experiencing issues. Try again later." |
| Network Error | "Network error connecting to [endpoint]" |
| Timeout | "Request to [endpoint] timed out after [N]ms" |

All errors inherit from the `KagiError` base class, making it easy for downstream tools to catch all Kagi-related errors with a single `instanceof` check.

### Error Classes

```
KagiError (base class)
├── KagiConfigError    — Missing or invalid configuration
├── KagiApiError       — HTTP error response from Kagi API
├── KagiNetworkError   — Network failure (no response)
└── KagiTimeoutError   — Request timeout
```

### Retry Behavior

- **429 (Rate Limited)**: Retries with exponential backoff (1s → 2s → 4s, max 30s, up to 3 retries)
- **5xx (Server Error)**: Retries with exponential backoff (same policy)
- **401, 402, 403, 404**: No retry — these are client errors that won't resolve
- **Network failures**: Retries with exponential backoff (up to 3 retries)

## Architecture

```
.pi/extensions/pi-kagi/
├── index.ts              # Extension entry point — registers commands and validates config
├── package.json          # Package manifest with "pi" config and test scripts
├── README.md             # This file
├── src/
│   ├── config.ts         # Configuration resolver (KAGI_API_KEY, base URL, timeouts, retry)
│   ├── kagi-client.ts    # KagiClient class — HTTP client with auth, retry, normalization
│   ├── types.ts           # Normalized TypeScript type contracts
│   └── errors.ts          # Error classes (KagiError, KagiApiError, etc.)
└── tests/
    ├── config.test.ts     # Config resolver tests
    ├── errors.test.ts     # Error class and mapping tests
    └── client.test.ts     # Client request/response/retry tests
```

### Client Design

The `KagiClient` class is the single source of truth for all Kagi API communication:

- **Auth header injection** — Every request includes `Authorization: Bot <TOKEN>`
- **Configurable timeouts** — 30s for search/enrich, 60s for FastGPT and Summarizer
- **Automatic retries** — Exponential backoff on 429 and 5xx responses
- **Response normalization** — Null safety (`snippet: null` → `snippet: ""`), type discriminator mapping
- **Per-call URL override** — Small Web uses `/api/v1` endpoint without mutating shared state

### Type Contracts

All raw API responses are normalized into consistent internal types in `types.ts`:

- `SearchResponse` — discriminated union of result/related items
- `FastGPTResponse` — answer text with citations
- `SummarizeResponse` — summary output with token count
- `SmallWebResponse` — list of feed entries

## Development

Extensions are loaded as TypeScript by pi's jiti runtime — no build step needed.

### Running Tests

```bash
# Run all tests
cd .pi/extensions/pi-kagi && bun test

# Or from project root:
npm --prefix .pi/extensions/pi-kagi test
```

### Test Coverage

- 85 tests across 3 test files
- Config resolution and missing-key behavior
- Error class hierarchy and status code mapping
- Client request construction, auth headers, URL building
- Response normalization (null safety, type discriminator)
- Retry logic (429, 5xx, network failures)
- Timeout handling
- Non-retryable error handling (401, 403, 404 throw immediately)
- Small Web response format variations

## License

See the project root for license information.