# Plan Review: Step 2 — Implement Enrich + SmallWeb tools

**Reviewer:** Automated Review  
**Date:** 2026-04-12  
**Step:** Step 2: Implement Enrich + SmallWeb tools  
**Verdict:** ✅ Proceed with qualifications

---

## 1. Scope Reviewed

Per `STATUS.md`, Step 2 currently plans to:

1. Create `src/tools/enrich.ts` with `kagi_enrich_web` and `kagi_enrich_news` tools
2. Create `src/tools/smallweb.ts` with `kagi_smallweb` tool
3. Share `formatSearchResponse` between search and enrich tools (`includeRank` option)
4. Apply truncation to enrich and smallweb outputs
5. Register enrich and smallweb tools in `index.ts`

---

## 2. Current-State Fit

The plan is broadly aligned with the codebase as it exists now:

- `KagiClient` already exposes `enrichWeb()`, `enrichNews()`, and `smallweb()`.
- `src/formatters/results.ts` already contains the key shared pieces:
  - `formatSearchResponse()` with `includeRank`
  - `formatSmallWebResponse()`
  - `countResults()`
  - search-specific truncation notice helper
- `index.ts` already has the lazy `getClient()` pattern in place, which Step 2 should keep using.
- Baseline test suite is green: `bun test` currently passes with **85/85** tests.

So this step is mostly wiring + tool definitions, not new API-client work.

---

## 3. Findings / Qualifications

### 1) The plan should explicitly cover **empty-result behavior** for enrich tools
**Severity:** Medium

This is the main gap.

`/enrich/web` and `/enrich/news` can legitimately return zero results. The current shared search formatter does **not** produce a friendly empty-state message for an empty `SearchResponse`; it can return an empty string.

That would lead to a poor tool response for the LLM.

**What to add to the plan:**
- Either make `formatSearchResponse()` return a clear empty-state message when there are no result items, or
- Handle the empty case inside each enrich tool before formatting.

Example acceptable output:
- `No enrich web results found for "{query}".`
- `No enrich news results found for "{query}".`

SmallWeb is in better shape here because `formatSmallWebResponse()` already returns `No Small Web entries found.`

---

### 2) Since Step 2 includes registration, the plan should call out **description/details parity**
**Severity:** Medium

If this step is going to register the tools in `index.ts`, then the tool definitions should include the same level of completeness as `kagi_search`:

- clear descriptions
- correct cost guidance
- consistent `details` payloads

The architecture/capability docs expect cost-aware descriptions:
- `kagi_enrich_web`: costs about **$0.002/query** and is free if no results
- `kagi_enrich_news`: costs about **$0.002/query** and is free if no results
- `kagi_smallweb`: **Free**

And the return `details` should stay consistent with the existing search tool style, e.g.:
- enrich: `query`, `totalResults`, `meta`
- smallweb: `totalEntries` (and no `meta` unless there actually is normalized metadata available)

This does not need a huge design section, but it should be explicit in the plan because registration is part of the step.

---

### 3) SmallWeb truncation should use **SmallWeb-specific wording**
**Severity:** Low

The current truncation helper text is search-oriented:

`[Showing N of M results. Use a more specific query to narrow results.]`

That wording is fine for search/enrich, but it does not fit SmallWeb entries very well.

**What to add to the plan:**
- truncate SmallWeb from the head as well (most recent items first), but
- use entry-specific wording if truncation occurs, e.g. `Showing N of M Small Web entries`.

This avoids awkward copy/paste behavior from the search tool.

---

## 4. Implementation Notes

- `formatSearchResponse(..., { includeRank: true })` already exists, so Step 2 should **reuse** it rather than refactor the search formatter unnecessarily.
- Keep the current **lazy client getter** pattern. Do **not** instantiate `KagiClient` at extension bootstrap just to register the new tools.
- The PROMPT scopes a combined `src/tools/enrich.ts`; that is acceptable, but export **separate registration functions** (`registerEnrichWebTool`, `registerEnrichNewsTool`) so `index.ts` wiring and future tests stay clean.
- Even though tests land formally in Step 4, keep the tool/formatter seams easy to test in `tests/search-enrich.test.ts` later.

---

## 5. Recommendation

Proceed with Step 2, but update the implementation plan to explicitly cover:

1. friendly empty-state handling for enrich results,
2. cost-aware descriptions + consistent `details` payloads for the newly registered tools,
3. SmallWeb-specific truncation wording.

With those additions, the plan is solid and fits the current codebase well.
