# Plan Review: Step 1 — Implement FastGPT tool

**Reviewer:** Automated Review  
**Date:** 2026-04-12  
**Step:** Step 1: Implement FastGPT tool  
**Verdict:** ✅ Proceed with qualifications

---

## 1. Scope Reviewed

Per `PROMPT.md` and `STATUS.md`, Step 1 currently plans to:

1. add the FastGPT tool schema,
2. map `output`, `references`, and `tokens` from the existing client response,
3. render FastGPT output as compact answer text with citation-friendly references and token metadata.

That is the right core scope for this step.

---

## 2. Current-State Fit

The current codebase is in good shape for this work:

- `src/kagi-client.ts` already implements `fastgpt(query, { cache? })`, posts to `/fastgpt`, and **forces `web_search=true`**.
- `src/types.ts` already defines `FastGPTResponse` and `Citation`.
- The extension already has an established tool pattern:
  - `src/tools/*.ts` export registration helpers,
  - `index.ts` keeps a lazy `getClient()` closure,
  - tools throw `KagiError` subclasses rather than returning pseudo-error payloads.
- The formatter/truncation pattern from TP-005 is already established in `src/formatters/results.ts`.
- Baseline is green: `bun test` currently passes with **94/94** tests.

So Step 1 should be mostly tool/formatter work, not client or transport work.

---

## 3. Findings / Qualifications

### 1) The plan should explicitly say that `web_search` is **not** a normal user-facing parameter
**Severity:** Medium

This is the most important contract issue.

The task prompt mentions a schema for `query`, `cache`, and `web_search`, but the validated project findings and existing client implementation point the other way:

- `docs/fastgpt.md` says any value other than `true` errors,
- `STATUS.md` already records that FastGPT must never send `web_search=false`,
- `KagiClient.fastgpt()` already forces `web_search=true`,
- the architecture contract for `kagi_fastgpt` only exposes `query` and `cache`.

**Recommendation:** update the plan to state one of these explicitly:

- **preferred:** do **not** expose `web_search` in the public tool schema at all; document the caveat and rely on the client to force `true`, or
- if a compatibility field is kept, reject anything except `true` before the client call with an actionable error.

Leaving this ambiguous risks re-introducing a broken boolean into the tool surface.

---

### 2) The plan is missing an explicit **FastGPT-specific truncation strategy**
**Severity:** Medium

Step 1 mentions compact formatting, but it does not yet say how the tool will stay within the required **50KB / 2000 line** output limit.

This matters more for FastGPT than for search because the output is structured in sections:

- answer body,
- source list,
- token metadata.

The architecture contract is clear that FastGPT truncation must preserve citation usefulness.

**Recommendation:** add an explicit plan item for a formatter/truncation helper, for example:

- format answer body first,
- append a `Sources:` section rendered from `references`,
- append token metadata,
- if truncation is needed, reserve space for sources/tokens and truncate the answer body only.

The important part is not the exact helper name; it is explicitly planning to preserve the citations section instead of blindly truncating the final combined string.

---

### 3) The plan should call out **citation-index alignment** between `output` and `references`
**Severity:** Medium

FastGPT is different from search/enrich because the answer text may already contain inline numeric references such as `[1]`, `[2]`, etc. The formatter must preserve the mapping between those inline markers and the rendered source list.

If the implementation renumbers or reshuffles references independently, the answer can become misleading.

**Recommendation:** add a sentence to the plan that the formatter will:

- preserve the API-provided answer text as the primary answer body,
- render the `references` array in the same order,
- handle empty or partially malformed reference entries defensively.

At minimum, the tool should avoid producing a broken `Sources:` section with blank titles/URLs or numbering that no longer matches the answer text.

---

### 4) The plan should mention the expected **tool result shape** and reuse the existing TP-005 execution pattern
**Severity:** Low

The step bullets focus on text formatting, but this tool should also follow the repo’s existing execution contract:

- use the lazy shared client getter pattern,
- return `content: [{ type: "text", text: ... }]`,
- keep structured metadata in `details` (at least `query`, `tokens`, `meta`, and a reference count),
- throw `KagiError` subclasses unchanged.

This is already how TP-005 tools behave, so Step 1 should explicitly reuse that pattern rather than invent a new one.

---

## 4. Implementation Notes

A plan aligned with the current codebase would look like this:

- add `src/tools/fastgpt.ts` exporting `registerFastGPTTool(pi, getClient)`,
- add `src/formatters/answers.ts` with something like `formatFastGPTResponse()` plus a FastGPT-specific truncation helper,
- keep the current root `index.ts` as the extension entry point,
- defer actual registration wiring to Step 3 if you want to keep steps clean,
- keep the formatter/tool boundaries easy to test in `tests/fastgpt-summarizer.test.ts` later.

Even if full testing is formally Step 4, this step should be planned so formatter and execute-path tests are straightforward to add.

---

## 5. Recommendation

Proceed with Step 1, but tighten the implementation plan to explicitly cover:

1. **no free-form `web_search` parameter** on the public FastGPT tool surface,
2. **FastGPT-specific truncation** that preserves sources and token metadata,
3. **stable numbering/alignment** between inline answer citations and rendered references,
4. **standard tool result/details/error shape** matching TP-005.

With those additions, the Step 1 plan is solid and fits the current repository well.
