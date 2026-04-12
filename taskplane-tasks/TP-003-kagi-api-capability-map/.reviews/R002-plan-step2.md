# Plan Review: Step 2 — Define pi-kagi Architecture Contract

**Reviewer:** Automated plan review
**Date:** 2026-04-12
**Task:** TP-003 — Build Kagi API Capability Map for pi-kagi
**Step:** Step 2 — Define pi-kagi architecture contract
**Verdict:** 🟡 **Approved with action items** — the plan's scope is correct but the STATUS checklist is underspecified and several key architecture decisions need explicit documentation before downstream tasks can implement confidently.

---

## 1. Scope Assessment

### What the plan covers (STATUS.md checkboxes)

| # | Deliverable | Assessment |
|---|---|---|
| 1 | Define module layout and internal file structure | ⚠️ Underspecified — see Gap 1 |
| 2 | Define normalized TypeScript type contracts for all 7 endpoints | ⚠️ Needs clarification — see Gap 2 |
| 3 | Define smart routing rules | ✅ Core concept is clear, but needs depth — see Gap 3 |
| 4 | Define output requirements (citations, compact summaries, truncation) | ⚠️ Needs specification — see Gap 4 |
| 5 | Create `docs/pi-kagi-architecture.md` | ✅ Clear deliverable |

### What the plan should additionally cover but doesn't yet

The downstream task PROMPTs (TP-004 through TP-007) already imply specific file paths, module boundaries, and architectural decisions. The architecture contract must explicitly confirm or adjust these, or downstream tasks will make ad-hoc decisions that may not be coherent.

---

## 2. Gap Analysis

### Gap 1: Module layout is already partially prescribed — must be confirmed or revised

**Severity: High** — This determines the entire file structure.

The downstream task PROMPTs imply this module structure:

```
.pi/extensions/pi-kagi/
├── package.json
├── index.ts                    # Entry point (export default function)
├── src/
│   ├── index.ts                # Re-exports / registers everything
│   ├── config.ts               # KAGI_API_KEY resolution, base URL
│   ├── types.ts                # Shared type contracts (raw + normalized)
│   ├── kagi-client.ts          # HTTP client with typed endpoint methods
│   ├── errors.ts               # Error types and mapping
│   ├── tools/
│   │   ├── search.ts          # kagi_search tool (defineTool)
│   │   ├── enrich.ts           # kagi_enrich_web, kagi_enrich_news tools
│   │   ├── smallweb.ts         # kagi_smallweb tool
│   │   ├── fastgpt.ts          # kagi_fastgpt tool
│   │   ├── summarizer.ts       # kagi_summarize tool
│   │   └── smart-web.ts        # kagi_smart_web_access orchestrator
│   ├── formatters/
│   │   ├── results.ts          # Search/Enrich/SmallWeb result formatting
│   │   ├── answers.ts          # FastGPT answer formatting
│   │   └── final-output.ts     # Orchestrated output synthesis
│   └── router/
│       ├── intent-router.ts    # Intent → endpoint strategy mapping
│       └── fallback-policy.ts  # Fallback/degradation rules
└── tests/
    ├── client.test.ts
    ├── search-enrich.test.ts
    ├── fastgpt-summarizer.test.ts
    └── smart-router.test.ts
```

**Questions the architecture contract must answer:**

1. **Entry point design:** Is `.pi/extensions/pi-kagi/index.ts` a thin re-exporter that imports from `src/index.ts`, or does it contain the `export default function(pi)` directly? The scaffold currently has the registration logic in the root `index.ts`. The architecture must resolve this — either keep the current flat structure or move to the `src/` subdirectory pattern.

2. **`src/` vs flat structure:** TP-004's file scope uses `src/` paths. The current scaffold has `index.ts` at root level with no `src/` directory. The architecture must explicitly choose a layout and describe the migration path.

3. **`tools/` directory pattern:** The architecture should confirm whether each tool lives in its own file (as TP-005/006 suggest) or whether related tools share a file. The current split is: `search.ts`, `enrich.ts` (both web+news), `smallweb.ts`, `fastgpt.ts`, `summarizer.ts`. This is reasonable — confirm it.

4. **Where to register tools:** The architecture must specify whether `src/index.ts` registers all tools by importing from `tools/*.ts` and calling `pi.registerTool()`, or whether each tool module self-registers.

**Action:** The architecture doc must include an explicit **Module Layout** section with a full directory tree, file responsibilities, and import/export contract for each module. Include which file owns which tool registration.

---

### Gap 2: "Normalized type contracts" must distinguish raw API types from internal tool types

**Severity: High** — This is the most important contract for TP-004+.

"Define normalized TypeScript type contracts for all 7 endpoints" is ambiguous. There are two distinct type layers:

#### Layer 1: Raw API response types (matching Kagi's actual JSON)

These are direct TypeScript interfaces that mirror the Kagi API response data. They should be exact — including optional fields, nullable fields, and discriminated unions — so that the HTTP client parses and validates what Kagi actually returns.

The capability map (Section 2) already documents these, but the architecture needs to codify:
- How to handle the `t`-discriminated union for Search Objects (`SearchResult | RelatedSearches`)
- How `meta.api_balance` is only present on `/search` responses
- How `/enrich/*` responses add `rank` but may have `snippet: null`
- How the Small Web response format is unknown and needs a placeholder/type assertion

#### Layer 2: Normalized internal types (what tools return to the LLM)

These are the shapes that pi-kagi tools return. The architecture must define what these look like and how they differ from raw types. Key design decisions:

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Unified search result type? | Merge Search/Enrich into one struct, or keep separate | **Merge** — create a single `NormalizedSearchResult` with optional `rank` and `source` discriminant |
| Reference/citation model? | Raw FastGPT references vs. unified citation model | **Unified** — define a `Citation` type `{ url, title, snippet? }` used across all endpoints |
| How to handle RelatedSearches? | Include in search output or drop | **Include** — as a separate field `relatedQueries: string[]` on the normalized output, useful for the orchestrator |
| Small Web normalization? | Parse RSS/Atom into the same search result type | **Yes** — normalize Small Web entries into `NormalizedSearchResult` with `source: "smallweb"` |

**Action:** The architecture doc must include two type sections:
1. **Raw API Types** — interfaces matching Kagi's JSON, keyed by endpoint
2. **Normalized Tool Types** — the shapes tools return, with explicit mapping rules from raw → normalized
3. A **Citation Model** that unifies references across FastGPT and search results

The types should use `Type` from `@sinclair/typebox` (not just TypeScript interfaces) because pi tool parameters use TypeBox schemas, and runtime validation of API responses is prudent given v0 beta status.

---

### Gap 3: Smart routing rules need decision logic, not just a mapping table

**Severity: High** — TP-007 depends on concrete routing logic.

The capability map Section 5 provides an intent-to-endpoint table, but this is insufficient for implementation. The architecture must define:

#### 3a. Intent taxonomy

The smart router needs a finite set of intents. Based on the capability map, I recommend:

```typescript
const WebAccessIntent = StringEnum([
  "search",          // General web search → /search
  "answer",          // LLM-synthesized answer → /fastgpt
  "summarize_url",   // Summarize a URL → /summarize (url mode)
  "summarize_text",  // Summarize pasted text → /summarize (text mode)
  "discover_web",    // Non-commercial web content → /enrich/web
  "discover_news",   // Non-commercial news/discussions → /enrich/news
  "browse_smallweb", // Browse indie/small web → /smallweb/feed
] as const);
```

Or alternatively, make it more open-ended and let the LLM decide via tool descriptions, with a higher-level `kagi_web` orchestrator tool.

**Critical design choice: Individual tools vs. orchestrator or both?**

The capability map says: "The pi-kagi extension should expose individual tools for each endpoint PLUS a higher-level 'smart web access' orchestrator." This is the right approach — both patterns. The architecture must specify:

1. **6 individual tools** (`kagi_search`, `kagi_enrich_web`, `kagi_enrich_news`, `kagi_fastgpt`, `kagi_summarize`, `kagi_smallweb`) — each maps 1:1 with an endpoint
2. **1 orchestrator tool** (`kagi_web`) — accepts intent + query, routes to the best endpoint(s)
3. How the orchestrator relates to individual tools (does it call them via their tool logic or via the API client directly?)

#### 3b. Routing decision logic

The architecture must specify how the orchestrator decides:

| Signal | Example | Default routing |
|--------|---------|-----------------|
| Explicit intent parameter | `intent: "answer"` | → `/fastgpt` |
| URL present in input | query contains a URL | → `/summarize` (url mode) |
| Cost preference | `budget: "low"` | → `/enrich/*` instead of `/search` |
| Search API unavailable | user lacks beta access | → Fall back to `/enrich/web` |

#### 3c. Fallback chains

The capability map identifies Search as closed-beta. The architecture must define fallback chains:

| Primary | Fallback | Condition |
|---------|----------|-----------|
| `/search` | `/enrich/web` | 403/401 or Search unavailable |
| `/fastgpt` | `/search` + manual synthesis | FastGPT timeout or error |
| `/enrich/web` | No fallback | These are already niche |
| `/summarize` | No fallback | Unique capability |

#### 3d. Composition (multi-endpoint calls)

For "deep research" intents, the orchestrator may call multiple endpoints in parallel. The architecture must define:
- When composition is triggered (e.g., `intent: "research"`)
- Which endpoints compose (e.g., FastGPT + Enrich/Web)
- How results are merged
- Cost awareness (FastGPT + Search = $0.025 + $0.015 = $0.04 per composed call)

**Action:** The architecture doc must include a **Smart Routing** section with:
1. Intent taxonomy (StringEnum values or similar)
2. Single-tool routing table with fallback chains
3. Composition rules for multi-endpoint strategies
4. Cost-aware routing guidance
5. The relationship between individual tools and the orchestrator

---

### Gap 4: Output requirements need concrete format specification

**Severity: High** — LLM quality depends on well-formatted tool output.

The plan says "Define output requirements: citations, compact summaries, truncation strategy." This needs to specify:

#### 4a. Tool output shape

Every pi tool must return `{ content: [{ type: "text", text: string }], details: {} }`. The architecture must specify what goes in `content.text` vs `details`:

**Recommendation:**
- `content.text` — Human/LLM-readable formatted result (citations, summaries, key data)
- `details` — Machine-readable structured data for session persistence (raw URL list, token counts, cost data, endpoint used)

#### 4b. Citation format

Define how citations appear in tool output. Options:

```
[1] Title — URL
    Snippet text here...

[2] Title — URL
    Snippet text here...
```

Or Markdown reference style:

```
[1]: URL "Title"
```

**Recommendation:** Use numbered inline citations `[1]` with a reference list at the end, consistent with FastGPT's own reference style. This is LLM-friendly and matches how Kagi itself presents references.

#### 4c. Truncation strategy

Pi enforces a 50KB / 2000 line output limit. The architecture must define:
- Which truncation function to use (`truncateHead` vs `truncateTail`) per tool
- Priority ordering when truncating (which fields to keep, which to drop)
- How to signal truncation to the LLM (append a "Results truncated. Use more specific queries." message)

**Recommendations per endpoint:**

| Endpoint | Truncation | Priority |
|----------|-----------|----------|
| `/search` | `truncateHead` | Keep top results; drop lower-ranked ones |
| `/enrich/*` | `truncateHead` | Keep top results; drop lower-ranked ones |
| `/fastgpt` | `truncateTail` | Keep answer; truncate if reference list is very long |
| `/summarize` | `truncateTail` | Keep summary text; references truncated if needed |
| `/smallweb` | `truncateHead` | Keep most recent entries |

#### 4d. Compact summary format for search results

For search-type endpoints, the architecture must define how to present multiple results. Give the LLM structured, scannable output:

```
## Search Results

1. **Title** (published)
   URL
   Snippet

2. **Title**
   URL
   Snippet
```

**Action:** The architecture doc must include an **Output Format Contract** section with:
1. Content vs details structure
2. Citation format specification
3. Truncation strategy per tool
4. Result rendering templates for each endpoint type
5. Compact search result format

---

### Gap 5: Error handling architecture is undefined

**Severity: Medium** — TP-004's file scope includes `errors.ts`, but the architecture doesn't define the error contract.

The capability map (Section 4) documents Kagi's HTTP error codes, but the architecture must define the internal error handling strategy:

1. **Error type hierarchy:** What custom error classes does pi-kagi use? (e.g., `KagiApiError` with subclasses for auth, rate-limit, credit, network, etc.)
2. **Error propagation:** Do tools surface Kagi errors to the LLM as-is, or wrap them in user-friendly messages?
3. **Retry policy:** Which error codes trigger automatic retry? (429 → yes with backoff; 500 → maybe; 401/402/403 → no)
4. **Graceful degradation:** When Search API returns 403 (no beta access), does the tool fail or fall back?

**Recommendation:** Define in architecture:

```typescript
class KagiApiError extends Error {
  constructor(status: number, code: string, message: string) { ... }
}

class KagiAuthError extends KagiApiError { ... }  // 401
class KagiCreditError extends KagiApiError { ... } // 402
class KagiRateLimitError extends KagiApiError { ... } // 429
class KagiServerError extends KagiApiError { ... } // 500+

// Retry policy: retry on 429 (up to 3x, exponential backoff 1s/2s/4s)
//                retry on 500 (up to 2x, backoff 2s)
//                no retry on 400/401/402/403/404
```

**Action:** Add an **Error Handling Architecture** section to the architecture doc.

---

### Gap 6: Configuration and API key management strategy is undefined

**Severity: Medium** — TP-004's scope includes `config.ts`, but the architecture doesn't specify the contract.

The architecture must define:

1. **API key resolution order:** `KAGI_API_KEY` env var → pi config → error
2. **Base URL configuration:** Default `https://kagi.com/api/v0`; Small Web override to `https://kagi.com/api/v1`
3. **Config interface:**

```typescript
interface KagiConfig {
  apiKey: string;           // Resolved from env or pi config
  baseUrl: string;          // Default: https://kagi.com/api/v0
  smallWebBaseUrl: string;  // Default: https://kagi.com/api/v1 (different base!)
  timeout: number;          // Default: 30000ms
  retries: number;          // Default: 3
  cacheEnabled: boolean;    // Default: true (FastGPT/Summarizer)
}
```

4. **How config is accessed:** Is it loaded once at session start, or per-request? (Recommendation: once at session start via `pi.on("session_start", ...)`, stored in extension state)

**Action:** Add a **Configuration Contract** section to the architecture doc.

---

### Gap 7: pi tool registration and `promptSnippet`/`promptGuidelines` strategy is undefined

**Severity: Medium** — Affects LLM tool selection quality.

The pi API supports `promptSnippet` and `promptGuidelines` on tools. These are crucial for the LLM to understand when to use which Kagi tool. The architecture should define the prompt strategy for each tool:

| Tool | promptSnippet | promptGuidelines |
|------|--------------|-----------------|
| `kagi_search` | "Search the web for information" | "Use for general web searches when you need diverse, current results." |
| `kagi_enrich_web` | "Find non-commercial, indie web content" | "Use for discovering niche blogs, personal sites, and non-commercial content." |
| `kagi_enrich_news` | "Find non-mainstream news and discussions" | "Use for finding interesting discussions and non-mainstream perspectives." |
| `kagi_fastgpt` | "Get an AI-generated answer with web sources" | "Use when you need a synthesized answer grounded in web search, not just links." |
| `kagi_summarize` | "Summarize a URL or text document" | "Use when the user wants to summarize content from a URL or pasted text." |
| `kagi_smallweb` | "Browse curated small/indie web content" | "Use to discover interesting independent web content." |
| `kagi_web` | "Smart web access — routes to the best Kagi endpoint" | "Use this for general web queries when you're unsure which specific tool to use." |

**Action:** Add a **Tool Prompt Strategy** section to the architecture doc with `promptSnippet` and `promptGuidelines` for each tool.

---

### Gap 8: Small Web response format handling needs an explicit strategy

**Severity: Medium** — The capability map correctly identifies that Small Web's response format is undocumented.

The architecture must specify how to handle this unknown:

1. **Initially:** Parse as JSON and fall back to XML (RSS/Atom) parsing
2. **Runtime detection:** Check `Content-Type` header to determine format
3. **Normalization:** Map whatever Small Web returns into `NormalizedSearchResult[]`
4. **Graceful failure:** If the format is unrecognizable, return a descriptive error rather than crashing

**Action:** Add a **Small Web Format Strategy** section noting the empirical testing requirement and the fallback parsing approach.

---

### Gap 9: `StringEnum` usage and `Type` schema patterns must be specified

**Severity: Low-Medium** — The project guidelines require `StringEnum` from `@mariozechner/pi-ai` for string enums, but the architecture hasn't specified which parameters use enums.

Parameters that should use `StringEnum`:

| Tool | Parameter | StringEnum values |
|------|-----------|-------------------|
| `kagi_summarize` | `engine` | `"cecil"`, `"agnes"`, `"muriel"` (exclude deprecated `"daphne"`) |
| `kagi_summarize` | `summary_type` | `"summary"`, `"takeaway"` |
| `kagi_summarize` | `target_language` | Full list from docs (30+ codes) |
| `kagi_web` (orchestrator) | `intent` | `"search"`, `"answer"`, `"summarize_url"`, `"summarize_text"`, `"discover_web"`, `"discover_news"`, `"browse_smallweb"` |
| `kagi_enrich` | `type` | `"web"`, `"news"` (if unified into one tool) |

**Action:** The architecture doc should explicitly list which parameters use `StringEnum` vs `Type.String()` with descriptions.

---

### Gap 10: Cost-awareness in routing needs explicit threshold guidance

**Severity: Low** — Affects how the orchestrator makes cost tradeoffs.

The capability map has pricing data. The architecture should include cost-awareness guidance:

| Endpoint | Cost per query | Relative cost |
|----------|---------------|----------------|
| `/search` | $0.025 | 12.5× Enrich |
| `/fastgpt` | $0.015 | 7.5× Enrich |
| `/enrich/*` | $0.002 | Baseline |
| `/summarize` | $0.03–$1.00 | Variable (engine-dependent) |
| `/smallweb` | Free | — |

The architecture should specify:
- Whether to include cost estimates in tool `details` output (yes — for TP-008)
- Whether the orchestrator should default to cost-saving endpoints (e.g., prefer Enrich over Search unless user explicitly needs premium results)
- How to handle 402 (insufficient credits) — inform user, suggest cheaper alternative

**Action:** Add cost-awareness notes to the Smart Routing section.

---

## 3. Structural Recommendation for `docs/pi-kagi-architecture.md`

Based on the gaps above, I recommend the following document structure:

```markdown
# pi-kagi Architecture Contract

## 1. Module Layout
   - Directory tree with all modules
   - Import/export contract for each module
   - Entry point design (index.ts vs src/index.ts)
   - Tool registration pattern (centralized vs distributed)

## 2. Raw API Type Contracts
   - Per-endpoint request and response types (TypeBox schemas)
   - Discriminated union handling for search object types
   - Optional/nullable field documentation
   - Small Web type placeholder (pending empirical testing)

## 3. Normalized Internal Types
   - NormalizedSearchResult (unified for Search, Enrich, SmallWeb)
   - NormalizedFastGPTAnswer
   - NormalizedSummary
   - Citation type (unified reference model)
   - Mapping rules: raw → normalized transformation per type

## 4. Tool Specifications
   - Per-tool: name, label, description, promptSnippet, promptGuidelines
   - Per-tool: parameters with TypeBox schemas (using StringEnum where needed)
   - Per-tool: output format (content.text template, details structure)
   - Per-tool: truncation strategy (truncateHead vs truncateTail)

## 5. Smart Routing Policy
   - Intent taxonomy (StringEnum values)
   - Single-tool routing table with fallback chains
   - Composition rules for multi-endpoint strategies
   - Cost-awareness guidance
   - Relationship between individual tools and orchestrator

## 6. Output Format Contract
   - Content vs details structure
   - Citation format specification
   - Result rendering templates per endpoint
   - Compact search result format
   - Truncation rules and priority ordering

## 7. Error Handling Architecture
   - Error type hierarchy
   - Error propagation strategy
   - Retry policy (which status codes, how many retries, backoff)
   - Graceful degradation rules

## 8. Configuration Contract
   - API key resolution order
   - Base URL configuration (v0 vs v1)
   - Timeout, retry, cache defaults
   - Config access pattern (session-start vs per-request)

## 9. Small Web Format Strategy
   - Empirical testing requirement
   - Fallback parsing approach (JSON → XML)
   - Normalization strategy

## 10. Implementation-Ready Checklist
   - Per-module checklist with clear dependencies
   - Type availability requirements per downstream task
```

---

## 4. Consistency Check: Capability Map vs Architecture Needs

The Step 1 capability map is solid and addresses the R001 review items well. Here's what the architecture must incorporate from it:

| Capability Map Item | Architecture Impact |
|--------------------|--------------------|
| Small Web uses `/api/v1` | Config must define separate `smallWebBaseUrl` |
| FastGPT `web_search` forced true | Tool schema must NOT expose `web_search` as a parameter |
| Search API closed beta | Routing fallback: Search → Enrich/Web |
| Enrich free on zero results | Cost tracking: bill only on non-zero results |
| Summarizer pricing tiers | Tool parameter validation: Muriel = $1 flat |
| `meta.api_balance` Search-only | Cost tracking: only available from Search responses |
| `snippet: null` in Enrich | Normalized type must handle missing snippet |
| `t`-discriminated union | Raw type must include type guard |
| Daphne engine deprecated | StringEnum for engine must exclude "daphne" |
| Cache defaults true | Config should default `cacheEnabled: true` |
| 1MB request size limit (Summarizer) | Tool must validate text parameter size before sending |

---

## 5. Consistency Check: Downstream Task Dependency Chain

The architecture document will be the primary reference for TP-004 through TP-009. Here's a consistency check:

| Downstream Task | Architecture Dependencies | Risk if Missing |
|----------------|--------------------------|-----------------|
| **TP-004** (Core Client) | Module layout, raw API types, config contract, error types, client interface | Client interface mismatch with tools |
| **TP-005** (Search/Enrich/SmallWeb) | Normalized types, tool specs, output format, truncation | Inconsistent output format across tools |
| **TP-006** (FastGPT/Summarizer) | Normalized types, tool specs, schema validation rules | Exposing `web_search` as param (broken) |
| **TP-007** (Smart Orchestrator) | Routing policy, intent taxonomy, composition rules, fallback chains | ad-hoc routing with no design rationale |
| **TP-008** (Cost Tracking) | Config, cost data per endpoint, `api_balance` handling | Inaccurate or missing cost data |
| **TP-009** (Hardening) | Error handling, edge cases, truncation boundaries | Incomplete test coverage |

The architecture document must be complete enough that **TP-004 can implement the client without any ambiguity about method signatures, return types, or error types**.

---

## 6. Key Design Decisions Requiring Explicit Resolution

The following decisions must be made in the architecture document — they cannot be left for implementation tasks:

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| D1 | Entry point structure | Flat `index.ts` vs `src/` directory | Use `src/` directory for tools, formatters, router; keep `index.ts` as thin entry point that delegates to `src/` |
| D2 | Tool registration pattern | Centralized (all in `src/index.ts`) vs distributed (each tool self-registers) | Centralized in `src/index.ts` — all tools imported and registered in one place for discoverability |
| D3 | Unified search result type | Separate types per endpoint vs unified `NormalizedSearchResult` | Unified type with `source` discriminator (`"search" | "enrich_web" | "enrich_news" | "smallweb"`) |
| D4 | Enrich tool structure | One tool `kagi_enrich` with `type` param vs two tools `kagi_enrich_web` + `kagi_enrich_news` | Two separate tools — clearer intent, simpler schemas, let LLM pick naturally |
| D5 | Summarizer tool structure | One tool `kagi_summarize` with mode switch vs two tools | One tool with `url`/`text` mutual exclusion — matches Kagi API design, simpler for LLM |
| D6 | Orchestrator tool name | `kagi_web` vs `kagi_smart_web` vs `kagi_web_access` | `kagi_web` — concise, discoverable, matches the "smart web access" mission |
| D7 | Orchestrator implementation | Calls individual tools' logic or calls client methods directly | Calls client methods directly — avoids tool overhead, enables composition/parallelism |
| D8 | `details` usage | Store full results vs store metadata only | Store metadata: `{ endpoint, query, resultCount, tokensUsed?, costEstimate? }` — keeps session lean |
| D9 | `daphne` engine | Include as deprecated option vs exclude entirely | Exclude from StringEnum — deprecated, will confuse LLM |
| D10 | `web_search` param on FastGPT | Omit entirely vs include with forced true | Omit entirely from tool schema — it's forced true, exposing it would mislead |

---

## 7. Summary of Action Items

| # | Priority | Action |
|---|----------|--------|
| 1 | **High** | Define complete module layout with directory tree and per-module import/export contracts |
| 2 | **High** | Define two-layer type system: raw API types and normalized internal types, with explicit mapping rules |
| 3 | **High** | Define smart routing policy with intent taxonomy, routing table, fallback chains, and composition rules |
| 4 | **High** | Define output format contract: content vs details, citation format, truncation per tool, result templates |
| 5 | **Medium** | Define error handling architecture: type hierarchy, retry policy, propagation strategy |
| 6 | **Medium** | Define configuration contract: key resolution, base URLs (v0/v1), defaults |
| 7 | **Medium** | Define `promptSnippet`/`promptGuidelines` for each tool |
| 8 | **Medium** | Define Small Web format strategy (empirical testing + fallback parsing) |
| 9 | **Low-Medium** | Specify `StringEnum` usage per parameter |
| 10 | **Low** | Define cost-awareness guidance for the routing layer |

---

## 8. Verdict

**🟡 Approved with action items.** The plan's four deliverables (module layout, type contracts, routing rules, output requirements) are the right things to define. However, the current STATUS.md checkboxes are too vague — "Define normalized TypeScript type contracts" and "Define smart routing rules" don't specify the key design decisions listed above.

**Minimum requirements for a passing architecture document:**

1. **Module layout** with file tree and per-module responsibilities (resolves D1-D2)
2. **Two-layer type system** — raw API types + normalized types with mapping (resolves D3)
3. **Routing policy** — intent taxonomy, routing table with fallbacks, composition rules (resolves D3-D7)
4. **Output format spec** — citation format, content/details split, truncation per endpoint, result templates (resolves D8)
5. **Key design decisions** — explicitly state decisions D1-D10

Without these five items, downstream tasks will make inconsistent ad-hoc decisions, leading to a fragmented codebase that's hard to compose in the orchestrator (TP-007).
