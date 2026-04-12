# Plan Review: Step 1 — Extract API Capabilities

**Reviewer:** Automated plan review  
**Date:** 2026-04-12  
**Task:** TP-003 — Build Kagi API Capability Map for pi-kagi  
**Step:** Step 1 — Extract API capabilities  
**Verdict:** 🟡 **Approved with action items** — plan is comprehensive but has gaps that must be addressed during execution

---

## 1. Scope Assessment

### What the plan covers

The STATUS.md hydration of Step 1 expands the original PROMPT.md checkboxes from 3 items to 6 concrete deliverables:

| # | Deliverable | Source Coverage |
|---|---|---|
| 1 | Endpoint matrix (purpose, params, pricing/caching) | ✅ Extracted from all 6 reference docs |
| 2 | Availability, pricing, caching, beta caveats | ✅ Covered by all docs + overview |
| 3 | Auth/header contract and shared error handling | ⚠️ Partial — see Gap 3 |
| 4 | Response shape types | ✅ New addition — well-motivated |
| 5 | Validation against all six reference docs | ✅ Explicit validation step |
| 6 | Hydrated Step 1 checkboxes | ✅ Self-referential but correct |

This is a good expansion. The original 3-item list would have produced a thin capability map. The 6-item list is much more likely to produce an implementation-ready artifact.

---

## 2. Gaps and Action Items

### Gap 1: Small Web uses `/api/v1/`, not `/api/v0/`

**Severity:** High — will cause runtime errors if missed  

All documented Kagi endpoints use base URL `https://kagi.com/api/v0`, **except** Small Web, which is documented at:
```
https://kagi.com/api/v1/smallweb/feed/
```

This v0/v1 split is easy to overlook. The capability map must call this out explicitly so that downstream implementation doesn't accidentally construct `https://kagi.com/api/v0/smallweb/feed/`.

**Action:** Add a prominent note in the endpoint matrix about the different base URL for Small Web. Consider a "Base URL" column that makes this visible at a glance.

---

### Gap 2: Small Web authentication is ambiguous

**Severity:** Medium — affects implementation correctness  

The Small Web docs never show an `Authorization` header in the example. The overview.md says "free" but doesn't explicitly state "no auth required." Every other endpoint shows `Authorization: Bot $TOKEN`. The capability map must document this ambiguity and recommend a defensive approach (try without auth first, fall back to auth header if 401).

**Action:** Add an "Auth Required" column to the endpoint matrix. Mark Small Web as "Unclear — docs don't specify; assume optional but test."

---

### Gap 3: Error response shapes are undocumented

**Severity:** Medium — affects defensive coding strategy  

None of the six Kagi reference docs define a formal error response schema. No error codes, no error object structure, no documented HTTP status codes beyond implicit success responses. The SUMMARIZER docs mention the error message `"Insufficient credit to perform this request."` but not its HTTP status or envelope.

The plan says "Capture auth/header contract and shared error handling expectations," but there's not enough source material to fully capture error shapes. The capability map should explicitly note this gap.

**Action:** Add a section titled "Error Handling — Unknowns & Defensiveness" that:
- Notes that Kagi docs don't define error response schemas
- Documents the known error message ("Insufficient credit...")
- Recommends defensive patterns: assume 4xx/5xx may have `{ error: { message } }` or plain text; always try/catch; handle unexpected shapes gracefully
- Notes that `meta.api_balance` is only present in Search responses, making it an unreliable way to detect low-balance states

---

### Gap 4: FastGPT `web_search` parameter is effectively forced-true

**Severity:** High — affects API contract accuracy  

The FastGPT docs state:
> NOTE: Currently, the `web_search` parameter is out of service, and may be removed. Trying to pass any value other than `true` will result in error.

This means:
1. The parameter should be **omitted entirely** in the capability map (or documented as "DEPRECATED — do not expose to callers"), not presented as a legitimate optional parameter.
2. The pricing note about `web_search=false` at `0.15¢` is obsolete and should be marked as such to avoid confusion in downstream cost-estimation logic.

**Action:** In the endpoint matrix, mark `web_search` as "Effectively required=true. Parameter is deprecated/defunct — do NOT expose to tool callers." Cross out the `0.15¢` discount pricing note as unavailable.

---

### Gap 5: Search API closed-beta availability restriction

**Severity:** High — affects deployment readiness  

The Search API docs are clear:
> The Search API is in closed beta and available upon request. Please reach out to support@kagi.com for invite.

This means the `kagi_search` tool cannot be assumed to work for all users. The capability map must:
1. Mark Search API availability as "Closed beta — invite required"
2. Note that this will affect the smart router in TP-007 (can't fall back to Search if the user doesn't have access)
3. Suggest that the implementation should handle 403/permission errors gracefully

**Action:** Add an "Availability" column or section that clearly marks Search as closed-beta. This directly impacts the routing policy in Step 2.

---

### Gap 6: Enrich billing nuance — free on zero results

**Severity:** Low — but affects cost-estimation accuracy  

The Enrich docs state:
> Since results are niche, we bill only when non-zero results are returned.

This is a useful cost-optimization signal for the router. The capability map should capture this so TP-008 (Usage/Cost Tracking) can factor it into cost estimates.

**Action:** Add a "Payment Trigger" note: "Billed only on non-zero results" for Enrich endpoints.

---

### Gap 7: Summarizer pricing complexity needs full decomposition

**Severity:** Medium — affects cost tracking design  

The Summarizer has tiered pricing that is more complex than any other endpoint:

| Tier | Rate | Notes |
|------|------|-------|
| Consumer (Cecil/Agnes) | $0.030/1K tokens | Capped at 10K tokens per request |
| Consumer (Ultimate plan) | $0.025/1K tokens | Discounted rate |
| Enterprise (Muriel) | $1.00 flat per summary | Regardless of length |

Additional constraints:
- `url` and `text` are mutually exclusive (one required)
- Request size limit: 1MB
- Cached summaries are free
- The `daphne` engine is deprecated ("Soon-to-be-deprecated")

The capability map must include all of these nuances, as they directly affect TP-008's cost modeling and TP-006's parameter validation.

**Action:** Create a dedicated "Summarizer Pricing Matrix" section (or sub-table) that captures all tiers, caps, and constraints. Mark `daphne` as deprecated.

---

### Gap 8: Response shape taxonomy needs cross-endpoint mapping

**Severity:** Medium — affects the normalized contracts in Step 2  

From the reference docs, there are actually **four distinct response shapes**:

| Shape | Endpoints | Fields |
|-------|-----------|--------|
| Search Object | /search, /enrich/web, /enrich/news | `meta` + `data[]` with `t`-discriminated objects |
| FastGPT Answer | /fastgpt | `meta` + `{ output, references[], tokens }` |
| Summarization Object | /summarize | `meta` + `{ output, tokens }` |
| RSS Feed | /smallweb/feed | Entirely different (XML/JSON feed format, undocumented) |

Key differences that affect normalization:
- Search-type results include a `rank` field in Enrich but not in Search
- FastGPT references have a different schema than Search results
- Small Web response format is completely undocumented (no example response shown)
- The `meta.api_balance` field only appears in Search responses

The capability map should explicitly map these shape families to enable the normalized contracts in Step 2.

**Action:** Add a "Response Shape Taxonomy" section that groups endpoints by response shape and highlights the structural differences. Note that Small Web's response format is undocumented and will require empirical testing.

---

### Gap 9: Meta object variance across endpoints

**Severity:** Low — but should be documented  

The `meta` object is not uniform:
- Search: `{ id, node, ms, api_balance }`
- Enrich: `{ id, node, ms }` — no `api_balance`
- FastGPT: `{ id, node, ms }` — no `api_balance`
- Summarizer: `{ id, node, ms }` — no `api_balance`

The capability map should note that only Search returns `api_balance`, since this is relevant for the cost-tracking feature (TP-008).

**Action:** Add a note in the response shapes section about `meta.api_balance` being Search-only.

---

### Gap 10: Small Web response format is undocumented

**Severity:** Medium — affects implementation confidence  

The Small Web docs show the endpoint URL and parameters but never include an example response. The capability map must flag this as an information gap requiring empirical testing before implementation.

**Action:** Mark Small Web as "Response format undocumented — requires empirical test against live API." This should be flagged as a blocker or risk item for TP-005.

---

## 3. Structural Recommendations for the Capability Map Document

Based on the gaps above, I recommend the following document structure for `docs/kagi-api-capability-map.md`:

```markdown
# Kagi API Capability Map

## Overview
- Base URL, auth model, beta status

## Endpoint Matrix
- Table with: Endpoint, Method, Path, Purpose, Required Params, Optional Params,
  Auth Required, Availability, Response Shape, Pricing, Payment Trigger

## Pricing & Caching Details
- Per-endpoint pricing with tiers
- Caching policies (when responses are free)
- Cost-estimation notes for router

## Availability & Caveats
- Search API: closed beta
- FastGPT web_search: forced true / deprecated
- Summarizer daphne engine: deprecated
- Small Web: v1 base URL, auth ambiguous
- General: v0 beta, expect breaking changes

## Response Shape Taxonomy
- Search Object family (search, enrich/web, enrich/news)
  - Fields, discriminated types, rank presence
- FastGPT Answer family
  - Fields, references structure
- Summarization Object family
  - Fields, engine/summary_type options
- Small Web Feed
  - UNDOCUMENTED — empirical test needed

## Auth & Headers
- Header: `Authorization: Bot $TOKEN`
- Missing auth documentation for Small Web
- API key env var: `KAGI_API_KEY`

## Error Handling — Unknowns & Defensiveness
- No documented error response schema
- Known error message: insufficient credits
- Recommended defensive patterns
- Meta.api_balance only in Search responses

## Undocumented / Needs Testing
- Small Web response format
- Error response shapes
- Rate limits (not mentioned anywhere)
- Request size limits (only Summarizer documents 1MB)
```

---

## 4. Missing from Current Plan

| Item | Status | Recommendation |
|------|--------|----------------|
| Rate limiting | Not documented by Kagi | Note as unknown in capability map |
| Request size limits | Only Summarizer (1MB) documented | Note as unknown for other endpoints |
| HTTP timeout expectations | Not documented | Note as unknown; recommend sensible defaults |
| Pagination | Not documented for any endpoint | Note as limitation; `limit` param only on Search |
| Small Web response format | No example in docs | Flag as requires empirical testing |

---

## 5. Summary of Action Items

| # | Priority | Action |
|---|----------|--------|
| 1 | **High** | Document v0 vs v1 base URL difference for Small Web |
| 2 | **Medium** | Mark Small Web auth as ambiguous; recommend defensive approach |
| 3 | **Medium** | Add "Error Handling — Unknowns" section documenting undocumented error schemas |
| 4 | **High** | Mark FastGPT `web_search` as forced-true/deprecated; strike the 0.15¢ pricing tier |
| 5 | **High** | Mark Search API as closed-beta, invite-only |
| 6 | **Low** | Note Enrich billing: free on zero results |
| 7 | **Medium** | Create Summarizer pricing matrix with all tiers, caps, and constraints |
| 8 | **Medium** | Add response shape taxonomy across all endpoints |
| 9 | **Low** | Note `meta.api_balance` is Search-only |
| 10 | **Medium** | Flag Small Web response format as undocumented; requires empirical testing |

---

## 6. Verdict

**🟡 Approved with action items.** The plan's expanded 6-item checklist is sound and well-structured. The gaps identified above are not blockers for Step 1 itself, but they **must** be addressed in the capability map document for downstream tasks (TP-004 through TP-009) to implement correctly. The most critical gaps are:

1. The v0/v1 base URL split (will cause bugs)
2. FastGPT's forced-true `web_search` (will cause errors if exposed as an option)
3. Search API closed-beta status (affects routing design)
4. Undocumented Small Web response format (blocks implementation)

If these four items are explicitly documented in the capability map, Step 1 will produce a solid foundation for all subsequent tasks.
