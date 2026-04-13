# pi-kagi

**Pi skill for using Kagi API**

A [pi-coding-agent](https://github.com/nickvdp/pi-coding-agent) extension that exposes Kagi search, answer, summary, and discovery APIs as structured tools for Pi. TP-005 added citation-first web lookup tools; TP-006 adds FastGPT and Universal Summarizer support for grounded answers and direct document summarization.

## Status

**Implemented now:**
- `kagi_search`
- `kagi_enrich_web`
- `kagi_enrich_news`
- `kagi_fastgpt`
- `kagi_summarize`
- `kagi_smallweb`
- `/kagi-about`

All current tools return concise, Pi-friendly text output. Search-style tools enforce head truncation for large result sets, while FastGPT/Summarizer preserve token metadata and citation/summary structure under the same `50KB / 2000 lines` limits.

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

## Operator Guides

- [`../../../docs/pi-kagi-usage.md`](../../../docs/pi-kagi-usage.md) — setup checklist, quick-start workflow, manual-routing patterns, and the tool-selection cheat sheet
- [`../../../docs/pi-kagi-troubleshooting.md`](../../../docs/pi-kagi-troubleshooting.md) — auth, beta-access, credits, and timeout diagnostics

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
| `kagi_fastgpt` | Get a grounded, synthesized answer with inline citations and source metadata | `query` (required), `cache` (optional) | FastGPT API, about **$0.015/query**; cached responses are free |
| `kagi_summarize` | Summarize a specific URL or pasted text with configurable engine/format/language options | `url` or `text` (exactly one), `engine`, `summary_type`, `target_language`, `cache` | Universal Summarizer, about **$0.03-$1/call** depending on engine |
| `kagi_smallweb` | Browse curated Small Web entries from independent sites | `limit` (optional, 1-50) | Free endpoint; useful for discovery rather than exhaustive search |

### Tool Selection Guidance

- Use **`kagi_search`** for broad, general web coverage.
- Use **`kagi_enrich_web`** for indie blogs, forums, and non-commercial perspectives.
- Use **`kagi_enrich_news`** for current events, recent news, and timely discussions.
- Use **`kagi_fastgpt`** when the user wants a synthesized answer backed by web citations.
- Use **`kagi_summarize`** when the user provides a specific URL or pasted text that should be condensed directly.
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

### 4. Grounded answer with FastGPT

```json
{
  "tool": "kagi_fastgpt",
  "arguments": {
    "query": "What changed in Python 3.11?",
    "cache": true
  }
}
```

### 5. Direct summary of a URL or text

```json
{
  "tool": "kagi_summarize",
  "arguments": {
    "url": "https://example.com/article",
    "engine": "agnes",
    "summary_type": "takeaway",
    "target_language": "EN"
  }
}
```

### 6. Small Web discovery

```json
{
  "tool": "kagi_smallweb",
  "arguments": {
    "limit": 5
  }
}
```

## Output Shape

Current tools are designed for downstream LLM use:

- **Search / Enrich** return numbered citations with URL-first references
- **FastGPT** returns answer text with inline citation markers, a matching `Sources:` section, and token metadata
- **Summarizer** returns condensed summary text plus token metadata and normalized option/input details
- **Small Web** returns a compact bulleted feed with title, URL, snippet, and date/author when present
- **Large result sets** are truncated from the head so the most relevant or earliest entries survive
- **Tool details** include structured metadata such as `query`, `tokens`, `references`, `summary_type`, `target_language`, `meta`, or `totalEntries`

## Known Constraints

- **Search API beta access:** `kagi_search` depends on Kagi's premium Search API, which is currently invite-only / closed beta. Even with a valid `KAGI_API_KEY`, the endpoint may still return an access error until Search API access is enabled for the account. See [`../../../docs/pi-kagi-troubleshooting.md`](../../../docs/pi-kagi-troubleshooting.md) for fallback guidance and next steps.
- **FastGPT web search cannot be disabled:** Kagi currently requires `web_search=true` for FastGPT. The extension keeps that flag internal and does not expose a `web_search=false` path because the API errors on any non-true value.
- **Summarizer input rules are strict:** `kagi_summarize` requires exactly one of `url` or `text`. Pasted `text` should use POST semantics and is capped by Kagi's 1MB request limit, so large documents should be provided as a URL instead.
- **Summarizer options are constrained by Kagi docs:** `target_language` must use one of Kagi's documented codes (for example `EN`, `ES`, `FR`, `JA`, `ZH`, `ZH-HANT`). `daphne` is accepted for compatibility but is effectively a legacy alias of `agnes`.
- **Kagi API is still beta:** The extension targets Kagi API v0/v1 beta endpoints and should be treated as a defensive integration. Response formats and availability may change.
- **Enrich indexes are intentionally niche:** `kagi_enrich_web` and `kagi_enrich_news` prioritize non-commercial and non-mainstream sources. They are best for perspective gathering, not exhaustive coverage.
- **Small Web is curated discovery, not exhaustive search:** `kagi_smallweb` is great for browsing and serendipity, but it should not be treated as breaking-news coverage or a complete search index.

## Remaining Gaps / Backlog

- **TP-007 smart router is still pending in this worktree:** operators must choose tools manually using the usage guide instead of relying on an automatic `kagi_web_access` orchestrator.
- **TP-008 usage accounting is still pending in this worktree:** current `[Estimated cost: ...]` footers are planning guidance, not authoritative per-call or cumulative billing records.
- **Live smoke still depends on operator-provided credentials:** this repo can run offline tests without a key, but any live verification still requires `KAGI_API_KEY` and (for `kagi_search`) Search API beta access.

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
│   ├── formatters/
│   │   ├── answers.ts        # FastGPT/Summarizer formatting + truncation helpers
│   │   └── results.ts        # Search/Small Web citation formatting helpers
│   ├── kagi-client.ts        # Authenticated Kagi HTTP client
│   ├── tools/
│   │   ├── enrich.ts         # kagi_enrich_web / kagi_enrich_news
│   │   ├── fastgpt.ts        # kagi_fastgpt
│   │   ├── search.ts         # kagi_search
│   │   ├── smallweb.ts       # kagi_smallweb
│   │   └── summarizer.ts     # kagi_summarize
│   └── types.ts              # Normalized API contracts
└── tests/
    ├── client.test.ts
    ├── config.test.ts
    ├── errors.test.ts
    ├── fastgpt-summarizer.test.ts
    ├── integration/
    │   ├── harness.ts
    │   └── manual-routing.test.ts
    ├── fixtures/
    │   └── integration-fixtures.ts
    └── search-enrich.test.ts
```

## Development

Extensions are loaded as TypeScript by Pi's jiti runtime — no build step needed.

### Running Tests

```bash
# Run all tests from the extension directory
cd .pi/extensions/pi-kagi && bun test

# Or from the repository root
bun test --cwd .pi/extensions/pi-kagi
```

### Test Coverage

- **113 tests across 6 files**
- Config resolution and missing-key behavior
- Error class hierarchy and status code mapping
- Client request construction, auth headers, URL building, retry behavior, FastGPT, and Summarizer request mapping
- Search/enrich/smallweb formatter output and truncation limits
- FastGPT citation alignment, token preservation, and pathological truncation fallbacks
- Summarizer exclusivity, URL/language/size validation, option mapping, and summary truncation behavior
- Tool registration metadata (`promptSnippet` / `promptGuidelines`) and extension wiring
- Offline integration coverage for `/kagi-about`, manual tool routing, missing-key handling, endpoint errors, and cost-guidance consistency

## License

See the project root for license information.
