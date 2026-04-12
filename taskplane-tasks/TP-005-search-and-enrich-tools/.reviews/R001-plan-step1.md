# Plan Review: Step 1 — Implement Search API Tool

**Reviewer:** Automated Review  
**Date:** 2026-04-12  
**Step:** Step 1: Implement Search API tool  
**Verdict:** ✅ Proceed with qualifications

---

## 1. Scope of Step 1

Per STATUS.md, Step 1 comprises:

1. Create `src/tools/search.ts` with `kagi_search` tool definition
2. Create `src/formatters/results.ts` with shared formatting logic
3. Implement search response formatter: numbered citation list with title/snippet/url/date
4. Handle related searches in formatter without overwhelming context
5. Apply truncation using `truncateHead` for large result sets

---

## 2. Current State Assessment

### What exists (TP-004 deliverables — all solid)

- **`src/kagi-client.ts`** — Fully implemented `KagiClient` with `search()`, `enrichWeb()`, `enrichNews()`, `fastgpt()`, `summarize()`, and `smallweb()` methods. All response normalization is complete (null-safety, discriminator mapping, Small Web format handling).
- **`src/types.ts`** — All normalized types defined: `SearchResult`, `RelatedSearches`, `SearchItem` discriminated union, `SearchResponse`, `KagiMeta`, `SmallWebEntry`, `SmallWebResponse`, raw types, etc.
- **`src/config.ts`** — Config resolution, `KAGI_API_KEY` env var handling, `KAGI_API_BASE_URL` constant.
- **`src/errors.ts`** — Full error hierarchy (`KagiError`, `KagiApiError`, `KagiNetworkError`, `KagiTimeoutError`), status-to-message mapping, retryable status logic.
- **`index.ts`** — Extension entry point with `session_start` handler (API key validation + notification) and `kagi-about` command. **Does NOT yet register any tools.**
- **Tests** — 85 tests all passing. Client tests cover search, enrich, fastgpt, summarize, smallweb, error handling, network failures, retries, and Small Web response format variations.

### What needs to be created

| File | Purpose |
|------|---------|
| `src/tools/search.ts` | Tool definition + execute function for `kagi_search` |
| `src/formatters/results.ts` | Shared formatter for search/enrich results → numbered citation text |

### What needs to be modified

| File | Change |
|------|--------|
| `index.ts` | Register `kagi_search` tool from `src/tools/search.ts` |

---

## 3. Detailed Plan Evaluation

### 3.1 Tool Schema (`kagi_search`)

**Architecture contract specifies:**
```typescript
{
  query: Type.String({ description: "Search query" }),
  limit: Type.Optional(Type.Number({ description: "Max results to return", minimum: 1, maximum: 50 })),
}
```

**Assessment:** ✅ Correct. Matches the Kagi API `GET /search` endpoint parameters (`q`, `limit`).

**Notes for implementation:**
- Use `Type` from `@sinclair/typebox` and `Type.Optional(Type.Number(...))` — NOT `Type.Optional()` wrapper without `Type.Number`, which would produce an `undefined` schema.
- The `limit` parameter should be clamped client-side if needed (the API accepts it as a query param). Consider adding a default limit in the tool execute function if the API returns too many results. The architecture says "10 results" for search default output, so the formatter should cap at displayed results even if the API returns more.
- The `minimum` and `maximum` constraints on `Type.Number` are metadata for the schema; they don't enforce runtime validation in TypeBox by default. If you want runtime enforcement, validate in the `execute` function.

### 3.2 Tool Registration Pattern

The extension currently has one command registered (`kagi-about`) and no tools. The architecture doc specifies **one tool per file** and each tool is self-contained with its own `registerTool` call.

**Recommended pattern for `src/tools/search.ts`:**
```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { KagiClient } from "../kagi-client.ts";
import { formatSearchResults } from "../formatters/results.ts";
import { truncateHead, DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES } from "@mariozechner/pi-coding-agent";

export function registerSearchTool(pi: ExtensionAPI, client: KagiClient) {
  pi.registerTool({
    name: "kagi_search",
    label: "Kagi Search",
    description: "Search the web using Kagi's premium search API. Returns a numbered list of results with title, snippet, URL, and date. Costs ~$0.025 per query.",
    promptSnippet: "Search the web using Kagi for high-quality, citation-backed results",
    promptGuidelines: [
      "Use kagi_search for general web search queries",
      "Each result includes a numbered citation link you can reference",
      "Consider kagi_enrich_web for non-commercial/blog content or kagi_enrich_news for current events",
    ],
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      limit: Type.Optional(Type.Number({ description: "Max results to return", minimum: 1, maximum: 50 })),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      // ...
    },
  });
}
```

**Assessment of this pattern:**

- ✅ **Client injection** — The `KagiClient` should be created once in `index.ts` and passed to each tool's registration function. This avoids re-creating the client per call and keeps config centralized.
- ✅ **`promptSnippet` and `promptGuidelines`** — These are part of Step 3's scope per the PROMPT.md, but since the tool description is intrinsic to registration, it makes sense to include at least `description` now. Consider adding `promptSnippet` and `promptGuidelines` now too since they're cheap and natural to include, but note they're formally Step 3's deliverable.
- ✅ **Cost in description** — The architecture doc requires cost info in the description. Include "Costs ~$0.025 per query" in the `description` field.

**⚠️ Concern: Client construction.** Currently `index.ts` creates a `KagiClient` on-demand via `resolveConfig()` (which reads `KAGI_API_KEY` env var). The tool execute function needs a client. Two approaches:
1. Create `KagiClient` in `session_start` and store it in closure scope.
2. Create `KagiClient` inside each `execute()` call.
   
**Recommendation:** Create the client once in the extension's closure and pass it to registration functions. If config validation fails in `session_start`, still register tools but they'll throw helpful errors when called. This is the cleaner architecture and avoids repeated config resolution.

### 3.3 Response Formatter (`src/formatters/results.ts`)

This is the core value-add of Step 1. The formatter converts a `SearchResponse` into the citation-friendly text format described in the architecture doc:

```
[1](https://en.wikipedia.org/wiki/Topic) — Topic - Wikipedia
    Steven Paul Jobs (February 24, 1955 – October 5, 2011) was an American businessman...

[2](https://example.com/article) — Article Title
    Article snippet text...
```

**Key requirements to validate:**

1. **Numbered citation format:** `[N](url) — Title` for each result
2. **Snippet on the next line** (indented) — not inline, to keep citations scannable
3. **Published date** when available (ISO 8601 → human-readable, e.g., "Oct 5, 2011")
4. **Related searches** — include them without overwhelming context (grouped at the bottom, not inline)
5. **Truncation** — apply `truncateHead` from pi-coding-agent before returning

**Design recommendations:**

```typescript
export function formatSearchResults(response: SearchResponse): string {
  const parts: string[] = [];
  let resultNumber = 0;
  const relatedSearches: string[] = [];

  for (const item of response.items) {
    if (item.type === "result") {
      resultNumber++;
      const { url, title, snippet, published } = item.data;
      let line = `[${resultNumber}](${url}) — ${title}`;
      if (published) {
        line += ` (${formatDate(published)})`;
      }
      parts.push(line);
      if (snippet) {
        parts.push(`    ${snippet}`);
      }
    } else if (item.type === "related") {
      relatedSearches.push(...item.data.queries);
    }
  }

  // Append related searches as a group at the bottom (if any)
  if (relatedSearches.length > 0) {
    parts.push("");
    parts.push("Related searches: " + relatedSearches.slice(0, 10).join(", "));
  }

  // Add cost metadata
  if (response.meta.apiBalance !== undefined) {
    parts.push(`\n[API balance: $${response.meta.apiBalance.toFixed(2)}]`);
  }

  return parts.join("\n");
}
```

**Assessment:**

- ✅ **Separation of concerns** — Formatter is in `src/formatters/results.ts`, not in the tool execute function. This enables reuse by Enrich tools in Step 2 (they produce `SearchResponse` too).
- ✅ **Related searches clamped** — Limit to ~10 related queries. The architecture says "include without overwhelming token budget."
- ✅ **Date formatting** — Convert ISO 8601 to human-readable form for LLM consumption.
- ✅ **API balance** — Include balance metadata when present (search-specific, per `KagiMeta.apiBalance`).
- ⚠️ **Result count limit** — The architecture says "10 results (user can request up to `limit`)" for the output strategy. The formatter should NOT arbitrarily limit to 10 — it should format all results and let truncation handle overflow. But the tool execute function could set a default `limit` of 10 if the user doesn't specify one, which is what the API supports.

### 3.4 Truncation Strategy

**Architecture specifies:**
- Soft limit: 50KB / 2000 lines (pi defaults)
- Search results: If over limit, keep first N results that fit within 25KB / 1000 lines, then append a note: `"[Showing {N} of {total} results. Use a more specific query to narrow results.]"`

**Implementation approach:**
```typescript
import { truncateHead, DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, formatSize } from "@mariozechner/pi-coding-agent";

async execute(toolCallId, params, signal, onUpdate, ctx) {
  const response = await client.search(params.query, params.limit);
  const formatted = formatSearchResults(response);
  
  const truncation = truncateHead(formatted, {
    maxLines: DEFAULT_MAX_LINES,
    maxBytes: DEFAULT_MAX_BYTES,
  });
  
  let result = truncation.content;
  if (truncation.truncated) {
    const totalResults = response.items.filter(i => i.type === "result").length;
    const shownResults = /* count results in truncated output */;
    result += `\n\n[Showing ${shownResults} of ${totalResults} results. Use a more specific query to narrow results.]`;
  }
  
  return {
    content: [{ type: "text", text: result }],
    details: { meta: response.meta, totalResults: response.items.filter(i => i.type === "result").length },
  };
}
```

**Assessment:** ✅ Correct. Uses `truncateHead` (not `truncateTail`) since search results are ordered by relevance and the most important ones come first.

**⚠️ Consideration:** Counting "shown results" after truncation is tricky. Options:
1. Count `[N](` patterns in the truncated output — simple regex.
2. Track result count separately and compute based on byte budget.
3. Use a simpler approach: just mark it as truncated with total count.

**Recommendation:** Use approach 1 (simple regex on `[N](http` pattern) or include result count in the `details` object for reference.

### 3.5 Error Handling in Tool Execute

The `KagiClient` methods throw `KagiApiError`, `KagiNetworkError`, or `KagiTimeoutError` — all extending `KagiError`. The tool's `execute` function should catch these and return user-friendly error messages.

```typescript
try {
  const response = await client.search(params.query, params.limit);
  // ... format and return
} catch (err) {
  if (err instanceof KagiError) {
    return {
      content: [{ type: "text", text: err.message }],
      details: { error: err.message },
      isError: true,
    };
  }
  throw err; // Unexpected errors should propagate
}
```

**Assessment:** ✅ Matches architecture's error message format. The `statusToUserMessage` function in `errors.ts` already provides actionable messages (401 → "Set KAGI_API_KEY", 402 → "Add credits", etc.).

**🚨 Important:** The architecture doc says tool errors are returned as human-readable messages. Per pi's tool API, **you must `throw` an error to set `isError: true`**. Returning a result object never sets `isError: true`. So for error paths, either:
1. `throw new Error(err.message)` — lets pi set `isError: true` automatically, OR
2. Return normally but include error text (the LLM sees it but it's not flagged as an error)

The extensions docs explicitly state: *"To mark a tool execution as failed (sets `isError: true`), throw an error from `execute`. Returning a value never sets the error flag."*

**Recommendation:** Throw errors for API failures (4xx/5xx) so the LLM knows the tool call failed. For "no results" scenarios, return a normal response saying "No results found" — those aren't errors.

### 3.6 AbortSignal Handling

The `execute` function receives a `signal: AbortSignal` parameter. The `KagiClient` doesn't currently accept an `AbortSignal` — it creates its own `AbortController` internally for timeouts only.

**Gap identified:** The `KagiClient.request()` method creates an `AbortController` for timeout but doesn't accept an external signal to chain cancellation. This means if the user cancels a tool call, the Kagi API request will continue until timeout.

**Severity:** Low. This is a minor issue that doesn't block Step 1. The `signal?.aborted` check at the start of `execute` is a reasonable minimum. Full signal chaining can be addressed in a future hardening task (TP-009).

**Recommendation for Step 1:** Add a `signal?.aborted` check at the start of the execute function and before formatting. Don't refactor `KagiClient` to accept signals in this step — that's a broader change.

### 3.7 File Organization & Architecture Alignment

**Current `index.ts` structure:**
- Exports default function
- Registers `session_start` handler and `kagi-about` command
- Exports re-exports from modules

**After Step 1, `index.ts` should:**
1. Create `KagiClient` instance (with config validation)
2. Call `registerSearchTool(pi, client)` to register the search tool
3. Keep existing `session_start` handler and `kagi-about` command

**Architecture doc specifies file layout:**
```
tools/
├── search.ts          # kagi_search tool
├── enrich-web.ts      # kagi_enrich_web tool
├── enrich-news.ts      # kagi_enrich_news tool
...
```

**⚠️ Concern:** The architecture doc puts tool files in `tools/` (top-level inside the extension), but the STATUS.md references `src/tools/search.ts` and `src/formatters/results.ts`. Either location works, but consistency matters.

**Recommendation:** Use `src/tools/search.ts` and `src/formatters/results.ts` (as STATUS.md says), matching the pattern where `src/` contains all source code. The `tools/` directory in the architecture doc can be reconciled later — the key is being consistent within this step.

### 3.8 Index.ts Modification Strategy

The current `index.ts` constructs `KagiClient` and `resolveConfig`/`validateConfig` dynamically. For tool registration, the client needs to be available before tools are called. Two viable approaches:

**Approach A (recommended):** Create client lazily in the extension closure:
```typescript
export default function (pi: ExtensionAPI) {
  let client: KagiClient | null = null;
  
  function getClient(): KagiClient {
    if (!client) {
      const config = resolveConfig();
      client = new KagiClient(config);
    }
    return client;
  }

  registerSearchTool(pi, getClient());
  // ... etc
}
```

**Approach B:** Create in `session_start`:
```typescript
export default function (pi: ExtensionAPI) {
  let client: KagiClient | null = null;
  
  pi.on("session_start", async (_event, ctx) => {
    const result = validateConfig();
    if (result.valid) {
      client = new KagiClient(result.config);
    }
  });
  
  // Register tool with a getter
  registerSearchTool(pi, () => client);
}
```

**Recommendation:** Approach A is simpler and works because pi loads extensions at startup. If `KAGI_API_KEY` is not set, `resolveConfig()` throws, and the tool's execute function will be called but fail with a clear error. This matches the current pattern where `session_start` validates but doesn't block. However, Approach A means if the key isn't set, calling the tool crashes. A better hybrid: create the client whenever first needed, catch `KagiConfigError`, and throw with a helpful message.

### 3.9 Test Strategy for Step 1

STATUS.md Step 4 covers testing, but some tests should come with Step 1 to ensure the formatter is correct before moving on.

**Minimum tests for Step 1:**
1. `formatSearchResults` — basic formatting with results
2. `formatSearchResults` — with related searches
3. `formatSearchResults` — with `published` dates
4. `formatSearchResults` — with null/empty snippets
5. `formatSearchResults` — empty response
6. `formatSearchResults` — mixed results and related searches
7. `formatSearchResults` — API balance in metadata
8. Tool execute — integration test with mocked `KagiClient.search()`
9. Tool execute — error handling (API errors propagated)
10. Tool execute — truncation triggered for large output

**Where to put tests:** Since the PROMPT.md specifies `tests/search-enrich.test.ts`, tests for search formatting and tool execution should go there. But Step 1 only covers search, so either:
- Create `tests/search-enrich.test.ts` now with just search tests (enrich tests added in Step 2)
- Create `tests/search.test.ts` now, renamed/merged in Step 2

**Recommendation:** Create the file per the PROMPT spec (`tests/search-enrich.test.ts`) with a `describe("kagi_search tool")` block. Add `describe.skip` placeholders for enrich/smallweb if desired, or just add the search tests now and extend in Step 2.

---

## 4. Issues & Risks

### Issue 1: No `AbortSignal` propagation in `KagiClient`
**Severity:** Low  
**Description:** The `KagiClient` doesn't accept an `AbortSignal` parameter, meaning tool cancellation doesn't abort in-flight HTTP requests.  
**Mitigation:** Check `signal.aborted` in the execute function. Full signal chaining can be added in TP-009. Not a blocker.

### Issue 2: `isError` flag requires `throw`, not a return value
**Severity:** Medium (correctness)  
**Description:** The pi extension docs are clear: "To mark a tool execution as failed (sets `isError: true`), throw an error from `execute`. Returning a value never sets the error flag." The implementation must `throw` KagiError instances from the execute function for API failures, not return them in a content object.  
**Mitigation:** Use `throw err` for `KagiError` subclasses in the execute function to properly signal errors to the LLM.

### Issue 3: Formatter reusability across search and enrich
**Severity:** Medium (design)  
**Description:** Both search and enrich endpoints return `SearchResponse` (same normalized type). The formatter should be generic enough to handle both. Enrich results have a `rank` field that search results don't. The formatter should conditionally include rank.  
**Mitigation:** Make `formatSearchResults` accept an options parameter or create a `formatSearchResponse` function that works for both. Consider naming it `formatSearchResponse` since it handles `SearchResponse` which is shared.

### Issue 4: `details` object shape
**Severity:** Low  
**Description:** The architecture says tool output uses `{ content: [...], details: { ... } }`. The `details` object should contain metadata useful for rendering and state tracking, like the total result count and API balance. Include enough info for the future cost tracker (TP-008) to reference.  
**Mitigation:** Include `meta`, `totalResults`, and `query` in `details`.

### Issue 5: Default limit behavior
**Severity:** Low  
**Description:** The Kagi API may return a large number of results if no `limit` is specified. The architecture says "Search: 10 results (user can request up to `limit`)". Should the tool enforce a default limit of 10 if the user doesn't specify one?  
**Recommendation:** If `params.limit` is undefined, pass `undefined` to the client (which doesn't send the param to the API). The formatter will truncate if needed. This lets the API decide its default, and truncation handles overflow. Alternatively, set default to 10 for cost control. Both are valid — pick one and document it.

---

## 5. Summary of Required Implementation Checklist

### Must Create
- [ ] `src/tools/search.ts` — `kagi_search` tool registration function
  - Schema: `query` (required string), `limit` (optional number, min 1, max 50)
  - Description includes cost: "Costs ~$0.025 per query"
  - Execute: create/obtain KagiClient, call `client.search(query, limit)`, format, truncate, return
  - Error handling: throw `KagiError` subclasses for API failures
  - Abort signal: check `signal.aborted` before API call

- [ ] `src/formatters/results.ts` — Shared `formatSearchResponse()` function
  - Input: `SearchResponse` from `src/types.ts`
  - Output: formatted string with numbered citations `[N](url) — Title`
  - Snippet on next line (indented)
  - Published date in parentheses when available
  - Related searches grouped at bottom (max ~10)
  - API balance appended when present

### Must Modify
- [ ] `index.ts` — Import `registerSearchTool`, create `KagiClient`, register tool
  - Create client from config (with graceful error handling)
  - Call `registerSearchTool(pi, client)` in extension entry function

### Must Test
- [ ] `tests/search-enrich.test.ts` — Formatter unit tests (6+ cases)
  - Basic formatting, related searches, dates, null snippets, empty response, API balance
  - Tool execute with mocked client
  - Truncation for large output
  - Error propagation

### Must NOT Do (out of scope for Step 1)
- ❌ Don't implement `kagi_enrich_web`, `kagi_enrich_news`, or `kagi_smallweb` tools
- ❌ Don't add `promptSnippet`/`promptGuidelines` (Step 3) — unless trivially included with registration
- ❌ Don't refactor `KagiClient` to accept `AbortSignal`
- ❌ Don't add FastGPT or Summarizer tools
- ❌ Don't create `routing.ts` or `smart-web.ts`

---

## 6. Verdict

**✅ Proceed with qualifications.**

The plan for Step 1 is sound. The KagiClient is well-implemented with comprehensive test coverage, the types are correctly normalized, and the extension entry point structure is established. Key qualifications:

1. **Use `throw` for error propagation** in tool execute, not `return { isError: true }` — pi requires throw to set the error flag.
2. **Make the formatter generic** enough for `SearchResponse` (shared by search + enrich) by naming it `formatSearchResponse` and handling optional `rank`.
3. **Create `KagiClient` once** in the extension closure and pass it to tool registration functions.
4. **Apply truncation with `truncateHead`** and include a truncation notice with result counts.
5. **Write formatter tests** as part of this step, even though Step 4 is the formal testing step.
6. **Keep file locations** at `src/tools/search.ts` and `src/formatters/results.ts` per STATUS.md.
