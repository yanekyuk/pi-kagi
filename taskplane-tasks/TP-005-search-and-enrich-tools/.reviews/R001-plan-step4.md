# Plan Review: Step 4 — Testing & Verification

**Reviewer:** Automated Review  
**Date:** 2026-04-12  
**Step:** Step 4: Testing & Verification  
**Verdict:** ✅ Proceed with qualifications

---

## 1. Scope Reviewed

Per `PROMPT.md` and `STATUS.md`, Step 4 currently plans to:

1. Add mapping / registration metadata tests
2. Run the test suite
3. Execute smoke checks and log the outcome in `STATUS.md`

---

## 2. Current-State Fit

This step is necessary and still materially unfinished.

Current coverage is limited to:
- `tests/client.test.ts`
- `tests/config.test.ts`
- `tests/errors.test.ts`

Those tests validate the HTTP client, config, and error normalization well, and `bun test` is currently green (`85/85`). But there is still **no direct coverage** for the TP-005 surface area that was added in Steps 1–3:
- `src/formatters/results.ts`
- `src/tools/search.ts`
- `src/tools/enrich.ts`
- `src/tools/smallweb.ts`
- extension registration metadata added in Step 3

So Step 4 should focus on the **tool/formatter layer**, not re-test the client exhaustively.

---

## 3. Findings / Qualifications

### 1) The plan needs a concrete test matrix for the new formatter + tool layer
**Severity:** High

`STATUS.md` currently says only:
- “Mapping and registration metadata tests added”

That is too vague for this step. The prompt explicitly calls out:
- mapping
- empty data
- missing fields
- verification

Given the current code, the highest-value tests are:
- `formatSearchResponse()`
  - numbered citation formatting
  - date rendering
  - related-search grouping and cap
  - optional rank rendering for enrich
  - missing/empty snippet handling
  - API balance rendering when present
- `formatSmallWebResponse()`
  - author/date formatting
  - empty feed message
- `truncateSearchOutput()` / `truncateSmallWebOutput()`
  - truncation notice text
  - correct “shown vs total” counts
  - final output remains within pi limits
- tool execute paths
  - happy path
  - empty-result responses
  - error propagation from `KagiError`
  - `details` shape consistency

Without that specificity, the step can easily stop after one shallow registration test and still miss the real regression surface.

**Plan adjustment:** explicitly target `tests/search-enrich.test.ts` for formatter + tool execution coverage.

---

### 2) Registration metadata should be tested via a `registerTool()` capture stub, not `pi.getAllTools()`
**Severity:** High

The Step 3 review note correctly asked for a metadata test around `promptSnippet` / `promptGuidelines`. But the plan should be careful about *how* that is verified.

Per pi's type definitions, `pi.getAllTools()` returns `ToolInfo`, which includes:
- `name`
- `description`
- `parameters`
- `sourceInfo`

It does **not** expose:
- `promptSnippet`
- `promptGuidelines`

So a Step 4 test cannot rely on `getAllTools()` to prove that prompt metadata was registered correctly.

**Plan adjustment:**
- build a lightweight mock `ExtensionAPI` whose `registerTool()` stores the full definitions
- invoke either the individual registration helpers or the extension entrypoint
- assert on the captured tool definitions directly

This is the most important implementation detail missing from the current plan.

---

### 3) Add truncation regression coverage explicitly
**Severity:** Medium

Step 3 changed the truncation path to reserve room for notices so final output stays within pi's `50KB / 2000 lines` limits. That is exactly the kind of logic that should now be pinned down in tests.

The current Step 4 wording does not mention truncation at all, but it should.

**Plan adjustment:** add at least one synthetic large-payload test for:
- search/enrich output
- smallweb output

And assert:
- output is truncated from the head
- notice text is appended
- notice wording is tool-appropriate
- final result still fits within pi bounds

That gives direct coverage for one of the project-specific review criteria.

---

### 4) Smoke verification needs a clear fallback path for environment limits
**Severity:** Medium

The prompt asks for smoke commands and `PROMPT.md` notes that a Kagi API key is required for live smoke. There are two practical wrinkles the plan should acknowledge:

1. `KAGI_API_KEY` may be absent locally
2. `/search` is still beta-gated and may return access errors even with a valid key

A good Step 4 plan should distinguish between:
- **extension-load smoke** — deterministic, no API dependency
- **live API smoke** — optional / environment-dependent

**Plan adjustment:**
- always run a deterministic load check, e.g. extension load + `/kagi-about` path or equivalent one-off extension load command
- if `KAGI_API_KEY` is present, run one minimal live smoke
- if live smoke is skipped or blocked by beta access, log that explicitly in `STATUS.md` as an environment limitation, not as an unqualified pass/fail

That will make the status log much more useful for the next reviewer.

---

### 5) Use `bun test` as the canonical verification command
**Severity:** Low

`PROMPT.md` still says:

```bash
npm --prefix .pi/extensions/pi-kagi test
```

That works here because the package script delegates to Bun, but the project standard is still `bun test`.

**Plan adjustment:** record the canonical command as:

```bash
cd .pi/extensions/pi-kagi && bun test
```

Optionally note the `npm --prefix ... test` wrapper as an equivalent invocation from project root.

This is a consistency issue, not a blocker.

---

## 4. Suggested Step-4 Test Breakdown

A tighter plan would call out something like this:

| Area | What to test |
|---|---|
| Search formatter | citation numbering, snippets, dates, related searches cap, API balance |
| Enrich formatter path | `includeRank: true`, empty-result handling at tool layer |
| SmallWeb formatter | author/date formatting, empty feed message |
| Truncation helpers | notice text, shown/total counts, final size within limits |
| Tool execute | success, empty results, thrown `KagiError`, details payload |
| Registration metadata | tool names, descriptions, `promptSnippet`, `promptGuidelines` via `registerTool()` capture |

That would keep the step scoped while covering the real risk areas added by TP-005.

---

## 5. Suggested Smoke Strategy

A low-risk smoke plan would be:

1. **Deterministic smoke**
   - Verify the extension loads and exposes `/kagi-about`
   - Log exact command used and outcome

2. **Live smoke when `KAGI_API_KEY` is available**
   - Prefer one low-cost or free call first (`smallweb` is ideal)
   - Optionally add one search/enrich call for end-to-end API validation
   - If `/search` is unavailable due to beta access, log that as an access limitation

3. **Status logging**
   - record command
   - record pass/fail/skip
   - record why skipped if no key / no beta access

---

## 6. Recommendation

Proceed with Step 4, but tighten the plan before execution:

1. **Define the concrete formatter/tool tests** instead of just “mapping tests”.
2. **Capture full `registerTool()` definitions** for prompt-metadata verification.
3. **Add truncation regression tests** for both search/enrich and smallweb.
4. **Separate deterministic smoke from live smoke**, and log skips/access limits explicitly.
5. **Use `bun test` as the primary verification command**.

With those additions, the step will properly validate the new TP-005 behavior rather than only confirming that the old client tests still pass.
