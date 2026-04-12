# Code Review: Step 1 — Implement FastGPT tool

**Reviewer:** Automated Review  
**Date:** 2026-04-12  
**Step:** Step 1: Implement FastGPT tool  
**Verdict:** ⚠️ Changes requested

---

## What I reviewed

- `git diff 2503936b12ea0b9f75eb37efac58917b35dd5fb0..HEAD --name-only`
- `git diff 2503936b12ea0b9f75eb37efac58917b35dd5fb0..HEAD`
- Changed files in:
  - `.pi/extensions/pi-kagi/src/formatters/answers.ts`
  - `.pi/extensions/pi-kagi/src/tools/fastgpt.ts`
  - `.pi/extensions/pi-kagi/tests/fastgpt-summarizer.test.ts`
  - `taskplane-tasks/TP-006-fastgpt-and-summarizer-tools/STATUS.md`
- Supporting context in:
  - `.pi/extensions/pi-kagi/src/kagi-client.ts`
  - `.pi/extensions/pi-kagi/src/types.ts`
  - `.pi/extensions/pi-kagi/src/formatters/results.ts`
  - `docs/pi-kagi-architecture.md`

## Verification

- ✅ `cd .pi/extensions/pi-kagi && bun test tests/fastgpt-summarizer.test.ts`
- ✅ `cd .pi/extensions/pi-kagi && bun test`

---

## Findings

### 1) The uncited-source fallback can still violate Pi's 50KB limit and drops the answer entirely
**Severity:** Medium

`truncateFastGPTOutput()` treats the “no retained inline citations” case as `displayedReferences = allReferences` on every iteration (`.pi/extensions/pi-kagi/src/formatters/answers.ts:197-199`), then falls back to `truncateUncitedSources()` and prepends `FASTGPT_ANSWER_TRUNCATION_NOTICE` afterwards (`:209-214`). That fallback only budgets `section + metadata`, so the extra top-level notice can push the final string back over the byte limit. It also discards the answer completely, even when the answer itself is short and only the source list needs to be compacted.

Repro with the current code:
- `output: "A concise answer with no inline citations."`
- `references: Array.from({ length: 1200 }, (_, i) => ({ title: 'Ref ' + (i + 1), url: 'https://example.com/' + (i + 1), snippet: '' }))`

This returns a string that is **51,266 bytes** long and **omits the answer text entirely**. That breaks the project's “tool output must be truncated to 50KB/2000 lines” contract and loses the primary FastGPT response in a case that could be handled by reserving answer budget first and then compacting uncited sources.

**Suggested fix:** when there are no retained citations, reserve space for the answer + metadata + any notice before truncating the source section, and re-check the fully assembled final output before returning it.

### 2) A single pathological reference can bypass truncation completely
**Severity:** Medium

If `truncateUncitedSources()` cannot fit the source section after its retry loop, it falls back to emitting the first source entry verbatim (`.pi/extensions/pi-kagi/src/formatters/answers.ts:171-176`). Because `formatFastGPTReference()` does not sanitize or bound source titles/URLs (`:81-84`), one oversized or multiline reference from the beta API can still blow past Pi's hard limits.

Two concrete repros against the current implementation:
- one reference with `title: 'T'.repeat(70000)` returns **70,222 bytes**
- one reference with a 2,500-line title returns **2,002 lines**

That means the formatter still has a hard-limit escape hatch in exactly the defensive-coding scenario this endpoint needs to tolerate.

**Suggested fix:** normalize/truncate individual reference labels before formatting them, or apply a final truncation pass to the fallback `Sources:` section so even the last-resort path is guaranteed to stay within 50KB / 2000 lines.

---

## Summary

The overall FastGPT shape is good: the public schema correctly keeps `web_search` internal, the execute path returns the expected `content`/`details` structure, and the citation-alignment regression from R002 is fixed. The remaining problems are both in the last-resort truncation path: it can still exceed Pi's hard output limits, and it can unnecessarily discard the answer. I'd fix those edge cases and add regression coverage for them before marking Step 1 complete.
