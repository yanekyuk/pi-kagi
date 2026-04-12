# Kagi API Capability Map

**Last Updated:** 2026-04-12  
**Source:** Kagi API v0 beta documentation  
**Status:** Implementation-ready reference for pi-kagi extension

---

## 1. Endpoint Matrix

| #  | Endpoint              | Method   | Path               | Purpose                                              | Required Params                    | Optional Params                          |
|----|-----------------------|----------|--------------------|------------------------------------------------------|-------------------------------------|------------------------------------------|
| 1  | Search                | GET      | `/search`          | Premium web search results                           | `q` (string)                       | `limit` (int)                            |
| 2  | Enrich Web            | GET      | `/enrich/web`      | Non-commercial web results (Teclis index)            | `q` (string)                       | —                                        |
| 3  | Enrich News           | GET      | `/enrich/news`     | Non-commercial news/discussions (TinyGem index)      | `q` (string)                       | —                                        |
| 4  | FastGPT               | POST     | `/fastgpt`         | LLM-generated answer with search-grounded citations  | `query` (string)                   | `cache` (bool, default true), `web_search` (bool, default true — currently forced) |
| 5  | Summarize (GET)       | GET      | `/summarize`       | Summarize a URL or text document                     | `url` or `text` (exclusive)        | `engine`, `summary_type`, `target_language`, `cache` |
| 6  | Summarize (POST)     | POST     | `/summarize`       | Summarize a URL or text (JSON/form body)             | `url` or `text` (exclusive)        | `engine`, `summary_type`, `target_language`, `cache` |
| 7  | Small Web Feed        | GET      | `/smallweb/feed/`  | RSS feed of "small web" content                     | —                                   | `limit` (number)                         |

**Base URL:** `https://kagi.com/api/v0` (note: Small Web uses `/api/v1`)

**Note:** Endpoints 5 and 6 share the same path and response shape; they differ only in HTTP method and how parameters are passed.

---

## 2. Response Shapes

### 2.1 Common Envelope

All Kagi API responses share a common envelope:

```typescript
interface KagiResponse<T> {
  meta: {
    id: string;         // Unique request ID
    node: string;       // Datacenter node (e.g., "us-east4", "us-central1")
    ms: number;         // Response time in milliseconds
    api_balance?: number; // Remaining API balance (Search API only)
  };
  data: T;
}
```

### 2.2 Search Result (`/search`, `/enrich/web`, `/enrich/news`)

Search-type endpoints return an array of search objects:

```typescript
interface SearchResponse {
  meta: KagiMeta;
  data: SearchObject[];
}

// Search object type discriminator
// t=0 → SearchResult, t=1 → RelatedSearches
type SearchObject = SearchResult | RelatedSearches;

interface SearchResult {
  t: 0;
  url: string;
  title: string;
  snippet?: string;        // May be null
  published?: string;     // ISO 8601 timestamp, e.g., "2024-09-30T00:00:00Z"
  thumbnail?: {
    url: string;          // Proxied image URL (relative path)
    height?: number | null;
    width?: number | null;
  };
  rank?: number;          // Present in Enrich results, absent in Search results
}

interface RelatedSearches {
  t: 1;
  list: string[];          // Suggested related search terms
}

interface KagiMeta {
  id: string;
  node: string;
  ms: number;
  api_balance?: number;    // Only present for /search
}
```

**Key differences between Search and Enrich results:**
- `/search` results may include `thumbnail` and do NOT include `rank`.
- `/enrich/*` results include `rank` (1-based position) but may have `snippet: null`.
- `/search` results include `RelatedSearches` (t=1) objects; Enrich results typically only contain `SearchResult` (t=0) objects.

### 2.3 FastGPT Answer (`/fastgpt`)

```typescript
interface FastGPTResponse {
  meta: KagiMeta;
  data: {
    output: string;           // LLM-generated answer text
    tokens: number;           // Tokens processed
    references: FastGPTReference[];
  };
}

interface FastGPTReference {
  title: string;              // Title of referenced search result
  snippet: string;            // Snippet text
  url: string;                // URL of referenced search result
}
```

### 2.4 Summarization (`/summarize`)

```typescript
interface SummarizeResponse {
  meta: KagiMeta;
  data: {
    output: string;           // Summarization text
    tokens: number;          // Tokens processed
  };
}
```

### 2.5 Small Web Feed (`/smallweb/feed/`)

```typescript
interface SmallWebFeedResponse {
  // RSS/Atom feed format — varies; likely XML or JSON feed
  // The docs don't provide a detailed JSON schema for this endpoint
  // Will need to inspect at runtime
}
```

**⚠️ Note:** Small Web is the only endpoint on `/api/v1` (not `/api/v0`). The response format is a feed and may differ from the JSON envelope pattern used by other endpoints.

---

## 3. Availability, Pricing & Caching

### 3.1 Pricing Matrix

| Endpoint           | Pricing                                       | Notes                                                        |
|--------------------|-----------------------------------------------|--------------------------------------------------------------|
| `/search`          | $25 per 1,000 queries ($0.025/query)          | Invite-only closed beta                                      |
| `/enrich/web`      | $2 per 1,000 queries ($0.002/query)           | Billed only when non-zero results returned                    |
| `/enrich/news`     | $2 per 1,000 queries ($0.002/query)           | Billed only when non-zero results returned                    |
| `/fastgpt`         | $15 per 1,000 queries ($0.015/query)          | `web_search` forced true; cached responses free              |
| `/summarize`       | Consumer: $0.03/1K tokens (min $0.03/doc)     | Docs >10K tokens billed as 10K; Muriel is $1 flat rate       |
| `/smallweb/feed/`  | Free                                          | No API key required? Docs say "public" but auth may still be needed |

### 3.2 Caching Behavior

| Endpoint      | Cache Control        | Behavior                                                                 |
|---------------|---------------------|--------------------------------------------------------------------------|
| `/search`     | Not documented       | Assume no explicit caching; responses may vary with account settings     |
| `/enrich/*`   | Not documented       | Assume no caching                                                        |
| `/fastgpt`    | `cache` param (bool) | Default `true`; cached responses are **free**                           |
| `/summarize`  | `cache` param (bool) | Default `true`; cached summaries of same URL are **free**                |
| `/smallweb`   | Feed-based           | Standard HTTP caching (ETag, Last-Modified)                              |

**Implementation note:** For FastGPT and Summarizer, setting `cache=true` (the default) means identical queries cost nothing on repeat. The pi-kagi client should default to `cache=true` to minimize cost unless the user explicitly requests fresh results.

### 3.3 Availability Caveats

| Endpoint       | Caveat                                                                 |
|----------------|------------------------------------------------------------------------|
| `/search`      | **Closed beta, invite-only.** Access must be requested from Kagi support. |
| `/fastgpt`     | **`web_search` parameter is out of service.** Only `true` accepted; passing `false` causes an error. This param may be removed. |
| `/summarize`   | `text` and `url` params are mutually exclusive. Total request size limited to **1MB**. |
| `/enrich/*`    | These are **niche indexes** (Teclis/TinyGem), not general-purpose search. Best for finding non-commercial, small-web content. |
| All endpoints   | **v0 beta** — breaking changes possible. Build defensively.            |

---

## 4. Auth & Error Contract

### 4.1 Authentication

- **Method:** HTTP header `Authorization: Bot $TOKEN`
- **Token source:** `KAGI_API_KEY` environment variable or pi configuration
- **Token format:** Generated at https://kagi.com/settings/api → "Generate API Token"
- **Account required:** Yes — requires Kagi account with API credits

### 4.2 Error Responses

Kagi API uses standard HTTP status codes:

| Status | Meaning                          | Client Handling                                    |
|--------|----------------------------------|----------------------------------------------------|
| 200    | Success                          | Parse response body                                |
| 400    | Bad request (invalid params)     | Check param types, retry with corrected params     |
| 401    | Unauthorized (missing/invalid key) | Check API key, fall back to user prompt           |
| 402    | Insufficient credits             | `api_balance` may be in meta; notify user          |
| 429    | Rate limited                      | Exponential backoff, retry after delay              |
| 500    | Server error                      | Retry with backoff; log and fallback if persistent  |

**Known error messages:**
- `"Insufficient credit to perform this request."` — API balance depleted
- FastGPT: Error if `web_search` is not `true`

### 4.3 Defensive Implementation Guidelines

1. **Always validate API key presence** before making requests
2. **Handle unknown `t` values** in search objects gracefully — the API may add new types
3. **Don't assume all fields are present** — `snippet`, `published`, `thumbnail`, `rank` are all optional
4. **Set reasonable timeouts** — FastGPT and Summarizer can take several seconds
5. **Cache FastGPT and Summarizer responses** by default (pass `cache: true`)
6. **Treat `null` snippet as valid** — Enrich results sometimes have `snippet: null`
7. **Respect the 1MB request size limit** for Summarizer `text` parameter

---

## 5. Endpoint-to-Intent Mapping

This section maps user intents to the appropriate Kagi endpoint, forming the basis for the pi-kagi smart routing logic.

| User Intent                            | Primary Endpoint  | Alt Endpoint      | Rationale                                              |
|----------------------------------------|--------------------|--------------------|--------------------------------------------------------|
| General web search                     | `/search`          | —                  | Most comprehensive commercial search results          |
| Find niche/non-commercial web content  | `/enrich/web`      | —                  | Teclis index surfaces small-web, non-commercial sites |
| Find non-mainstream news/discussions   | `/enrich/news`     | —                  | TinyGem index for interesting non-mainstream articles |
| Get an LLM answer with citations       | `/fastgpt`         | —                  | Generates synthesized answer grounded by web search   |
| Summarize a URL                        | `/summarize`       | —                  | purpose-built for document summarization              |
| Summarize pasted text                  | `/summarize`       | —                  | Use `text` param instead of `url`                     |
| Browse small/indie web                 | `/smallweb/feed/`  | —                  | Curated feed of non-commercial web content            |
| Research a topic deeply                | `/fastgpt` + `/enrich/web` | `/search`  | Combine LLM synthesis with deep web discovery         |
| Cost-sensitive search                  | `/enrich/web`      | `/enrich/news`     | $0.002/query vs $0.025/query for premium search       |
| Get answer without search             | (not available)    | —                  | FastGPT `web_search=false` is out of service           |

**Implementation note:** The pi-kagi extension should expose individual tools for each endpoint PLUS a higher-level "smart web access" orchestrator that selects the best endpoint(s) based on the user's phrased intent.

---

## 6. Rate Limits & Concurrency

The Kagi API documentation does not document specific rate limits. Implementation should:

1. **Start conservative** — default to 1 concurrent request per endpoint
2. **Respect 429 responses** — implement exponential backoff starting at 1s, doubling up to 30s
3. **Track request counts** — the `api_balance` field on Search responses can help monitor spend
4. **Batch when possible** — prefer single rich queries over multiple narrow ones

---

## 7. Small Web Feed Specifics

The Small Web API stands apart from the other endpoints:

- **Base URL:** `https://kagi.com/api/v1/smallweb/feed/` (v1, not v0)
- **Method:** GET
- **Auth:** Not explicitly documented as required (listed as "free" and "public")
- **Response:** Feed format (likely RSS/Atom or JSON Feed — not a standard Kagi JSON envelope)
- **Parameters:** `limit` (number, optional)
- **Content:** Curated entries from Kagi's "Small Web" collection — personal blogs, indie sites, non-commercial content

**Implementation note:** The Small Web feed may require a different parser than the other JSON-based endpoints. Test the actual response format before building the type contract.