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
- Supporting context in `src/types.ts`, `src/kagi-client.ts`, existing tool/formatter patterns, and docs.

## Verification

- ✅ `cd .pi/extensions/pi-kagi && bun test`
- ✅ `cd .pi/extensions/pi-kagi && bun test tests/fastgpt-summarizer.test.ts`

---

## Findings

### 1) Truncating sources from the head can break FastGPT citation mapping
**Severity:** Medium

`truncateSourcesSection()` in `.pi/extensions/pi-kagi/src/formatters/answers.ts` always keeps the *first* references that fit when the `Sources:` section exceeds Pi's limits. The answer body, however, is preserved independently. That means the returned text can still contain inline citations that no longer have a matching source entry.

Concrete example:
- answer text: `Conclusion supported by [3000].`
- references: 3000 entries
- current output keeps `[3000]` in the answer, but the `Sources:` section only includes refs `1..N` plus the truncation notice

This violates the step's stated goal of preserving citation-friendly references under truncation, because the retained answer can point to citations the model can no longer resolve.

**Suggested fix:** when truncation is required, choose source entries based on the citations still present in the retained answer body (or truncate/remove answer segments whose cited references cannot be preserved), instead of blindly keeping references from the head of the array.

---

## Summary

The overall structure is good: the tool schema is appropriately limited to `query` + `cache`, the execute path matches the existing tool contract, and the formatter does stay within Pi's output limits. The remaining issue is correctness under oversized reference lists: the current truncation strategy can orphan inline citations, which is important enough to fix before calling Step 1 done.
