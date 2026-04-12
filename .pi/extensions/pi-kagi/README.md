# pi-kagi

**Pi skill for using Kagi API**

A [pi-coding-agent](https://github.com/nickvdp/pi-coding-agent) extension that exposes Kagi search and discovery APIs as structured tools for Pi. TP-005 adds citation-first web lookup tools for general search, enrich web/news, and Small Web discovery.

## Status

**Implemented now:**
- `kagi_search`
- `kagi_enrich_web`
- `kagi_enrich_news`
- `kagi_smallweb`
- `/kagi-about`

All TP-005 tools return concise, source-first text output and enforce Pi-friendly truncation (`50KB / 2000 lines`) for large result sets.

## Installation

This extension is project-local. Place it at `.pi/extensions/pi-kagi/` and Pi will auto-discover it on startup.

### Requirements

- A Kagi API key ([get one here](https://kagi.com/settings?p=api))
- Set the `KAGI_API_KEY` environment variable, or configure it in Pi settings

### Quick Start

```bash
# Set your API key
export KAGI_API_KEY=your_key_here

# Start Pi in this project
pi

# Verify the extension loaded
/kagi-about
```

## Available Commands

| Command | Description |
|---------|-------------|
| `/kagi-about` | Show extension version, API key status, and currently registered Kagi tools |

## Available Tools

| Tool | Purpose | Parameters | Cost / Notes |
|------|---------|------------|--------------|
| `kagi_search` | General web lookup with numbered citations, snippets, dates, and related searches | `query` (required), `limit` (optional, 1-50) | Premium Search API, about **$0.025/query** |
| `kagi_enrich_web` | Find non-commercial web sources, blogs, and community discussions | `query` (required) | Teclis index, about **$0.002/query**; free when no results |
| `kagi_enrich_news` | Find recent non-mainstream news and current discussions | `query` (required) | TinyGem index, about **$0.002/query**; free when no results |
| `kagi_smallweb` | Browse curated Small Web entries from independent sites | `limit` (optional, 1-50) | Free endpoint; useful for discovery rather than exhaustive search |

### Tool Selection Guidance

- Use **`kagi_search`** for broad, general web coverage.
- Use **`kagi_enrich_web`** for indie blogs, forums, and non-commercial perspectives.
- Use **`kagi_enrich_news`** for current events, recent news, and timely discussions.
- Use **`kagi_smallweb`** for serendipitous browsing of curated small/independent sites.

## Usage Examples

### 1. General web search

```json
{
  "tool": "kagi_search",
  "arguments": {
    "query": "rust async cancellation best practices",
    "limit": 5
  }
}
```

### 2. Independent perspectives / blog posts

```json
{
  "tool": "kagi_enrich_web",
  "arguments": {
    "query": "sqlite litestream production lessons"
  }
}
```

### 3. Recent news and discussions

```json
{
  "tool": "kagi_enrich_news",
  "arguments": {
    "query": "recent browser engine news"
  }
}
```

### 4. Small Web discovery

```json
{
  "tool": "kagi_smallweb",
  "arguments": {
    "limit": 5
  }
}
```

## Output Shape

TP-005 tools are designed for downstream LLM use:

- **Search / Enrich** return numbered citations with URL-first references
- **Small Web** returns a compact bulleted feed with title, URL, snippet, and date/author when present
- **Large result sets** are truncated from the head so the most relevant or earliest entries survive
- **Tool details** include structured metadata such as `query`, `totalResults`, `meta`, or `totalEntries`

## Known Constraints

- **Search API beta access:** `kagi_search` depends on Kagi's premium Search API, which is currently invite-only / closed beta. Even with a valid `KAGI_API_KEY`, the endpoint may still return an access error until Search API access is enabled for the account.
- **Kagi API is still beta:** The extension targets Kagi API v0/v1 beta endpoints and should be treated as a defensive integration. Response formats and availability may change.
- **Enrich indexes are intentionally niche:** `kagi_enrich_web` and `kagi_enrich_news` prioritize non-commercial and non-mainstream sources. They are best for perspective gathering, not exhaustive coverage.
- **Small Web is curated discovery, not exhaustive search:** `kagi_smallweb` is great for browsing and serendipity, but it should not be treated as breaking-news coverage or a complete search index.

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `KAGI_API_KEY` | — | Kagi API key (required for authenticated API tools) |
| `KAGI_API_BASE_URL` | `https://kagi.com/api/v0` | Kagi API base URL override |

The extension validates the API key on session start and shows a warning if it is missing. All authenticated Kagi tools fail with a helpful error message if the key is not configured.

### Missing-Key Warning

```text
pi-kagi v0.1.0 loaded, but KAGI_API_KEY is not set. Kagi tools will not work
until the key is configured. Set it with: export KAGI_API_KEY=your_key_here
```

## Error Handling

The Kagi client provides clear, actionable error messages:

| Error | Message Pattern |
|-------|-----------------|
| 401 Unauthorized | "Invalid or missing API key. Set the KAGI_API_KEY environment variable." |
| 402 Payment Required | "Insufficient API credits. Add credits at https://kagi.com/settings/billing_api" |
| 403 Forbidden | "You do not have access to this endpoint." |
| 429 Rate Limited | "Request rate limit exceeded. Retrying after backoff..." |
| 5xx Server Error | "Kagi is experiencing issues. Try again later." |
| Network Error | "Network error connecting to [endpoint]" |
| Timeout | "Request to [endpoint] timed out after [N]ms" |

All errors inherit from the `KagiError` base class.

### Retry Behavior

- **429 (Rate Limited):** Retries with exponential backoff (1s → 2s → 4s, max 30s, up to 3 retries)
- **5xx (Server Error):** Retries with exponential backoff (same policy)
- **401, 402, 403, 404:** No retry — these are client errors that will not resolve automatically
- **Network failures:** Retries with exponential backoff (up to 3 retries)

## Architecture

```text
.pi/extensions/pi-kagi/
├── index.ts                  # Extension entry point and /kagi-about command
├── package.json              # Package manifest with Pi extension config
├── README.md                 # This file
├── src/
│   ├── config.ts             # Configuration + validation
│   ├── errors.ts             # Error classes and status mapping
│   ├── formatters/results.ts # Citation formatting + truncation helpers
│   ├── kagi-client.ts        # Authenticated Kagi HTTP client
│   ├── tools/
│   │   ├── enrich.ts         # kagi_enrich_web / kagi_enrich_news
│   │   ├── search.ts         # kagi_search
│   │   └── smallweb.ts       # kagi_smallweb
│   └── types.ts              # Normalized API contracts
└── tests/
    ├── client.test.ts
    ├── config.test.ts
    ├── errors.test.ts
    └── search-enrich.test.ts
```

## Development

Extensions are loaded as TypeScript by Pi's jiti runtime — no build step needed.

### Running Tests

```bash
# Run all tests from the extension directory
cd .pi/extensions/pi-kagi && bun test

# Or from the repository root
npm --prefix .pi/extensions/pi-kagi test
```

### Test Coverage

- **94 tests across 4 files**
- Config resolution and missing-key behavior
- Error class hierarchy and status code mapping
- Client request construction, auth headers, URL building, and retry behavior
- Search/enrich/smallweb formatter output and truncation limits
- Tool registration metadata (`promptSnippet` / `promptGuidelines`)
- Tool execute success, empty-result handling, and Kagi error propagation

## License

See the project root for license information.
