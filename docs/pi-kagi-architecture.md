# pi-kagi Architecture Contract

**Last Updated:** 2026-04-12  
**Depends on:** `docs/kagi-api-capability-map.md`  
**Implementation tasks:** TP-004 through TP-009

---

## 1. Module Layout

```
.pi/extensions/pi-kagi/
├── index.ts              # Extension entry point — registers all tools
├── package.json          # Package manifest with "pi" config
├── README.md             # Extension documentation
├── client.ts             # Kagi API client (HTTP, auth, errors, retry)
├── types.ts               # Normalized TypeScript type contracts
├── tools/
│   ├── search.ts          # kagi_search tool
│   ├── enrich-web.ts      # kagi_enrich_web tool
│   ├── enrich-news.ts     # kagi_enrich_news tool
│   ├── fastgpt.ts         # kagi_fastgpt tool
│   ├── summarize.ts       # kagi_summarize tool
│   ├── smallweb.ts        # kagi_smallweb tool
│   └── smart-web.ts       # kagi_web_access orchestrator tool
├── routing.ts             # Smart routing logic
└── utils.ts               # Shared utilities (truncation, formatting, cost tracking)
```

**Key principles:**
- **One tool per file** — each tool is self-contained with its own `registerTool` call
- **`client.ts`** is the single source of truth for all Kagi API communication
- **`types.ts`** normalizes raw API responses into consistent internal types
- **`routing.ts`** contains the intent-to-endpoint mapping logic
- **`index.ts`** imports and registers all tools; handles `session_start` for API key init

---

## 2. Normalized Type Contracts

All types live in `types.ts`. Raw API responses are normalized immediately in `client.ts` so tools always work with consistent shapes.

### 2.1 Common Types

```typescript
/** Standardized metadata returned by all Kagi API calls */
interface KagiMeta {
  id: string;
  node: string;
  ms: number;
  apiBalance?: number;  // Only present for /search
}

/** Common error envelope */
interface KagiError {
  status: number;
  message: string;
  retryable: boolean;
}
```

### 2.2 Search Results (Shared by /search, /enrich/web, /enrich/news)

```typescript
/** Normalized search result — used across all search-type endpoints */
interface SearchResult {
  url: string;
  title: string;
  snippet: string;      // "" if null from API; never undefined
  published?: string;   // ISO 8601 date string if available
  rank?: number;         // Present for enrich results only
  thumbnailUrl?: string;
}

/** Normalized related searches — only from /search */
interface RelatedSearches {
  queries: string[];
}

/** Discriminated union for search data items */
type SearchItem =
  | { type: "result"; data: SearchResult }
  | { type: "related"; data: RelatedSearches };

interface SearchResponse {
  meta: KagiMeta;
  items: SearchItem[];
}
```

### 2.3 FastGPT

```typescript
interface FastGPTResponse {
  meta: KagiMeta;
  output: string;
  tokens: number;
  references: Citation[];
}

interface Citation {
  title: string;
  snippet: string;
  url: string;
}
```

### 2.4 Summarizer

```typescript
type SummarizerEngine = "cecil" | "agnes" | "daphne" | "muriel";
// daphne is deprecated (alias for agnes), included for backward compatibility
type SummaryType = "summary" | "takeaway";

interface SummarizeResponse {
  meta: KagiMeta;
  output: string;
  tokens: number;
}
```

### 2.5 Small Web

```typescript
interface SmallWebEntry {
  title: string;
  url: string;
  snippet: string;
  published?: string;
  author?: string;
  feedUrl?: string;
}

interface SmallWebResponse {
  entries: SmallWebEntry[];
}
```

**Note:** Small Web response format will be determined at implementation time (TP-005). The API returns a feed (RSS/Atom/JSON); parsing must be confirmed by live testing.

---

## 3. Smart Routing Rules

The `kagi_web_access` tool acts as an orchestrator. It inspects the user's query and routes to the best endpoint(s) automatically.

### 3.1 Routing Decision Tree

```
User Query
  │
  ├─ Is it a URL? ────────────────────────► kagi_summarize (url parameter)
  │
  ├─ Is it asking for an LLM-authored answer? ──► kagi_fastgpt
  │   ("explain", "what is", "how does", "tell me about")
  │
  ├─ Is it looking for news/current events? ────► kagi_enrich_news
  │   ("latest", "news", "recent", "this week", headlines)
  │
  ├─ Is it seeking diverse/non-commercial perspectives? ──► kagi_enrich_web
  │   ("opinion", "blog", "discussion", "community", "reddit")
  │
  ├─ Is it a general search query? ─────────────► kagi_search
  │   (default for informational queries)
  │
  └─ Is it browsing/serendipity? ───────────────► kagi_smallweb
      ("discover", "browse", "interesting", "small web")
```

### 3.2 Multi-Endpoint Strategies

For complex queries, the orchestrator may combine endpoints:

| Strategy              | Endpoints Called              | When                                      |
|-----------------------|-------------------------------|-------------------------------------------|
| Deep research         | `fastgpt` + `enrich/web`      | User needs both an answer and diverse sources |
| Cost-sensitive search | `enrich/web` or `enrich/news` | User explicitly requests budget mode      |
| Summary + sources     | `summarize` (URL) + `search`  | User asks about a specific URL + context  |

### 3.3 Routing Heuristics

The orchestrator uses **keyword/intent analysis**, not a separate LLM call:

1. **URL detection** — if query contains a URL, route to `kagi_summarize`
2. **Question patterns** — "what is", "how does", "explain" → `kagi_fastgpt`
3. **News signals** — "latest", "news", "recent" → `kagi_enrich_news`
4. **Non-commercial signals** — "opinion", "blog", "discussion" → `kagi_enrich_web`
5. **Default** — `kagi_search` for general web queries

**Heuristics are intentionally simple and keyword-based.** They can be refined over time. The orchestrator MUST always expose the underlying tools individually so users can bypass routing when desired.

### 3.4 Fallback Behavior

| Primary fails      | Fallback                          | Reason                              |
|---------------------|-----------------------------------|-------------------------------------|
| `/search` 402/403   | `/enrich/web`                     | Premium search may be unavailable   |
| `/fastgpt` timeout  | `/search` with manual synthesis  | FastGPT can be slow                 |
| `/enrich/*` empty   | `/search`                         | Niche indexes may have no results   |
| Any 401             | Error with helpful message        | API key issue, can't auto-fix       |
| Any 429             | Retry with exponential backoff   | Rate limited, transient             |

---

## 4. Tool Definitions

### 4.1 Tool Registry

All tools are registered via `pi.registerTool()` in `index.ts`. Each tool module exports a registration function.

| Tool Name             | Endpoints            | TP Task  |
|-----------------------|----------------------|----------|
| `kagi_search`         | `/search`            | TP-005   |
| `kagi_enrich_web`     | `/enrich/web`        | TP-005   |
| `kagi_enrich_news`    | `/enrich/news`       | TP-005   |
| `kagi_fastgpt`        | `/fastgpt`           | TP-006   |
| `kagi_summarize`      | `/summarize`         | TP-006   |
| `kagi_smallweb`       | `/smallweb/feed/`    | TP-005   |
| `kagi_web_access`     | Orchestrator         | TP-007   |

### 4.2 Tool Parameter Schemas

Each tool uses `Type.Object()` from `@sinclair/typebox` for parameters, with `StringEnum` from `@mariozechner/pi-ai` for string enums.

#### kagi_search
```typescript
{
  query: Type.String({ description: "Search query" }),
  limit: Type.Optional(Type.Number({ description: "Max results to return", minimum: 1, maximum: 50 })),
}
```

#### kagi_enrich_web
```typescript
{
  query: Type.String({ description: "Query for non-commercial web content" }),
}
```

#### kagi_enrich_news
```typescript
{
  query: Type.String({ description: "Query for non-commercial news and discussions" }),
}
```

#### kagi_fastgpt
```typescript
{
  query: Type.String({ description: "Question to get an LLM-generated answer for" }),
  cache: Type.Optional(Type.Boolean({ description: "Allow cached responses (default: true)" })),
}
```

#### kagi_summarize
```typescript
{
  url: Type.Optional(Type.String({ description: "URL to summarize (mutually exclusive with text)" })),
  text: Type.Optional(Type.String({ description: "Text to summarize (mutually exclusive with url)" })),
  engine: Type.Optional(StringEnum(["cecil", "agnes", "daphne", "muriel"] as const)),  // daphne deprecated; alias for agnes
  summary_type: Type.Optional(StringEnum(["summary", "takeaway"] as const)),
  target_language: Type.Optional(Type.String({ description: "ISO 639-1 language code (e.g., 'EN', 'ES')" })),
  cache: Type.Optional(Type.Boolean({ description: "Allow cached responses (default: true)" })),
}
```

#### kagi_smallweb
```typescript
{
  limit: Type.Optional(Type.Number({ description: "Max entries to return", minimum: 1, maximum: 50 })),
}
```

#### kagi_web_access (orchestrator)
```typescript
{
  query: Type.String({ description: "What you're looking for — can be a question, search query, or URL" }),
  mode: Type.Optional(StringEnum(["auto", "search", "enrich_web", "enrich_news", "fastgpt", "summarize", "smallweb"] as const)),
}
```

---

## 5. Output Requirements

### 5.1 LLM-Facing Tool Response Format

All tool `execute` functions return a consistent shape:

```typescript
{
  content: [{ type: "text", text: string }],
  details: { ... }  // tool-specific metadata for rendering
}
```

### 5.2 Citation Format

Citations are embedded in the text output using a markdown link format:

```
[1](https://example.com) — Title of the source
```

For search results, citations are numbered sequentially:

```
[1](https://en.wikipedia.org/wiki/Topic) — Topic - Wikipedia
[2](https://example.com/article) — Article Title
```

For FastGPT answers, citations use bracketed numbers matching the `references` array:

```
Python 3.11 introduced several improvements: faster performance [1], exception groups [1], and 
improved type hints [2].

Sources:
[1](https://docs.python.org/3/whatsnew/3.11.html) — What's New In Python 3.11
[2](https://earthly.dev/blog/python-3.11-new-features/) — New Features in Python 3.11
```

### 5.3 Compaction & Formatting Rules

| Endpoint          | Output Strategy                                                    |
|-------------------|--------------------------------------------------------------------|
| `/search`         | Numbered list of results with title, snippet, URL, date           |
| `/enrich/*`       | Numbered list with rank, title, snippet, URL                      |
| `/fastgpt`        | Answer text with inline numbered citations, then source list      |
| `/summarize`      | Summary text (already condensed by LLM)                           |
| `/smallweb/feed/` | Bulleted list of entries with title, snippet, URL                 |

**Maximum results per tool call:**
- Search: 10 results (user can request up to `limit`)
- Enrich: All results returned (typically 20-30)
- FastGPT: 1 answer with citations
- Summarize: 1 summary

### 5.4 Truncation Strategy

All tool output MUST be truncated to avoid overwhelming the LLM context:

```typescript
import { truncateHead, DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES } from "@mariozechner/pi-coding-agent";
```

- **Soft limit:** 50KB / 2000 lines (pi defaults)
- **Search results:** If over limit, keep first N results that fit within 25KB / 1000 lines, then append a note: `"[Showing {N} of {total} results. Use a more specific query to narrow results.]"`  
- **FastGPT output:** Truncate answer text if needed; always preserve the citations section
- **Summarize output:** Already condensed; truncate only if extremely long
- **Small Web:** Keep most recent entries that fit within limits

### 5.5 Error Message Format

Tool errors are returned as human-readable messages with actionable guidance:

```
Kagi API error (401 Unauthorized): Invalid or missing API key. Set the KAGI_API_KEY environment variable or configure it in pi settings.
```

```
Kagi API error (402 Payment Required): Insufficient API credits. Add credits at https://kagi.com/settings/billing_api
```

```
Kagi API error (429 Rate Limited): Request rate limit exceeded. Retrying in {backoffMs}ms...
```

---

## 6. Client Architecture (client.ts)

### 6.1 Design

The `KagiClient` class handles all HTTP communication with the Kagi API:

```typescript
class KagiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string);

  // Search endpoints
  search(query: string, limit?: number): Promise<SearchResponse>;
  enrichWeb(query: string): Promise<SearchResponse>;
  enrichNews(query: string): Promise<SearchResponse>;

  // FastGPT
  fastgpt(query: string, options?: { cache?: boolean }): Promise<FastGPTResponse>;

  // Summarizer
  summarize(params: SummarizeParams): Promise<SummarizeResponse>;

  // Small Web
  smallweb(limit?: number): Promise<SmallWebResponse>;
}
```

### 6.2 Key Implementation Requirements

1. **Auth header:** Every request includes `Authorization: Bot ${apiKey}`
2. **Timeout:** 30s for search/enrich, 60s for FastGPT, 60s for summarize
3. **Retry logic:** Exponential backoff on 429 (1s → 2s → 4s → 8s, max 3 retries)
4. **Error normalization:** All HTTP errors mapped to `KagiError` with `retryable` flag
5. **Response normalization:** Raw API responses mapped to typed contracts in `types.ts`
6. **Null safety:** API `snippet: null` becomes `snippet: ""`
7. **Type discriminator:** API `t: 0/1` mapped to discriminated union `{ type: "result" } | { type: "related" }`

### 6.3 API Key Resolution

```typescript
// Priority order:
// 1. KAGI_API_KEY environment variable
// 2. pi configuration (if available)
// 3. Throw helpful error at session_start
```

---

## 7. Cost Awareness

### 7.1 Per-Call Cost Estimates

| Tool                | Estimated Cost per Call   | Notes                                    |
|---------------------|---------------------------|------------------------------------------|
| `kagi_search`       | $0.025                    | 2.5¢ per query                           |
| `kagi_enrich_web`   | $0.002                    | 0.2¢ per query; free on empty results    |
| `kagi_enrich_news`  | $0.002                    | 0.2¢ per query; free on empty results    |
| `kagi_fastgpt`      | $0.015                    | 1.5¢ per query; cached responses free    |
| `kagi_summarize`    | $0.03–$1.00               | $0.03 min (cecil/agnes); $1 flat (muriel)|
| `kagi_smallweb`     | $0.00                     | Free                                     |

### 7.2 Cost Guidance for Tools

Each tool's `description` field should include cost information so the LLM can make cost-aware decisions:

- `kagi_search`: "Costs ~$0.025 per query"
- `kagi_enrich_web`: "Costs ~$0.002 per query (free if no results)"
- `kagi_enrich_news`: "Costs ~$0.002 per query (free if no results)"
- `kagi_fastgpt`: "Costs ~$0.015 per query (cached responses free)"
- `kagi_summarize`: "Costs $0.03-$1 per call depending on engine"
- `kagi_smallweb`: "Free"
- `kagi_web_access`: "Routes to the most cost-effective endpoint"

### 7.3 Spending Awareness (TP-008)

The architecture should allow for a future spending tracker (TP-008) that:
- Tracks cumulative spend per tool
- Provides session-level spend summaries
- Optionally sets spend limits per session

For now, tools log estimated cost after each call in their output:

```
[Cached FastGPT response — $0.00]
```

```
[10 search results returned — estimated cost: $0.025]
```

---

## 8. Implementation-Ready Checklist

This checklist guides downstream tasks (TP-004 through TP-007). Each item should be verified at implementation time.

### TP-004: Kagi Client Core
- [ ] Implement `KagiClient` class with auth header injection
- [ ] Implement all 7 endpoint methods (search, enrichWeb, enrichNews, fastgpt, summarize, smallweb)
- [ ] Implement request timeout configuration (30s/60s defaults)
- [ ] Implement exponential backoff retry on 429
- [ ] Implement error normalization (HTTP status → KagiError with retryable flag)
- [ ] Implement response normalization (null safety, type discriminator mapping)
- [ ] Implement API key resolution (KAGI_API_KEY env var first)
- [ ] Write unit tests for client methods with mocked HTTP responses
- [ ] Write integration smoke test (optional, requires API key)

### TP-005: Search / Enrich / SmallWeb Tools
- [ ] Implement `kagi_search` tool with query + limit params
- [ ] Implement `kagi_enrich_web` tool
- [ ] Implement `kagi_enrich_news` tool
- [ ] Implement `kagi_smallweb` tool (handle v1 base URL and feed format)
- [ ] Format all search results as numbered lists with citations
- [ ] Implement truncation using `truncateHead` from pi-coding-agent
- [ ] Add cost estimate to tool description strings
- [ ] Write tests for each tool

### TP-006: FastGPT & Summarizer Tools
- [ ] Implement `kagi_fastgpt` tool with query param
- [ ] Handle `web_search` forced-true caveat in FastGPT
- [ ] Implement `kagi_summarize` tool with url/text, engine, summary_type params
- [ ] Validate url/text mutual exclusivity in tool logic
- [ ] Handle 1MB request size limit for text summarization
- [ ] Format FastGPT output with inline numbered citations + source list
- [ ] Implement truncation (preserve citations section)
- [ ] Add cost estimate to tool description strings
- [ ] Write tests for each tool

### TP-007: Smart Web Access Orchestrator
- [ ] Implement intent detection (keyword-based routing heuristics)
- [ ] Implement `kagi_web_access` tool with query + mode params
- [ ] Implement routing decision tree (URL → summarize, questions → fastgpt, etc.)
- [ ] Implement multi-endpoint strategies (deep research: fastgpt + enrich)
- [ ] Implement fallback behavior (search → enrich, fastgpt timeout → search)
- [ ] Implement result merging and deduplication across endpoints
- [ ] Add `mode` parameter documentation explaining each option
- [ ] Write tests for routing logic

### TP-008: Usage & Cost Tracking
- [ ] Implement per-call cost tracking in client
- [ ] Track cumulative spend per tool and per session
- [ ] Optionally expose spending summary as a `kagi_usage` tool or command
- [ ] Add spend limit configuration option

### TP-009: Hardening & Documentation
- [ ] Full test suite (unit + integration)
- [ ] Error handling edge cases (network failures, malformed responses, auth errors)
- [ ] README update with usage examples
- [ ] Extension documentation in `.pi/extensions/pi-kagi/README.md`