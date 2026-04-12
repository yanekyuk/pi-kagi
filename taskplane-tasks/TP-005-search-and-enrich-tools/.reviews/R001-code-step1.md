# Code Review: Step 1 — Implement Search API tool

**Reviewer:** Automated Review  
**Date:** 2026-04-12  
**Step:** Step 1: Implement Search API tool  
**Verdict:** ❌ Changes requested

---

## Scope Reviewed
Diff vs baseline `302139e`:
- `.pi/extensions/pi-kagi/index.ts`
- `.pi/extensions/pi-kagi/src/tools/search.ts`
- `.pi/extensions/pi-kagi/src/formatters/results.ts`
- task status/review docs

## What looks good
- ✅ Tool is registered with `pi.registerTool()` and uses `Type` from `@sinclair/typebox`.
- ✅ Search output formatting is centralized in a shared formatter (`formatSearchResponse`).
- ✅ Related searches are capped (`maxRelatedQueries`, default 10), which helps context budget.
- ✅ Output uses `truncateHead` with pi defaults (`DEFAULT_MAX_BYTES`/`DEFAULT_MAX_LINES`) satisfying 50KB/2000-line truncation guardrails.
- ✅ Existing test suite still passes (`cd .pi/extensions/pi-kagi && bun test` → 85 pass).

---

## Findings

### 1) `KagiClient` is not actually lazy; config is resolved at extension init
**Severity:** High  
**Location:** `.pi/extensions/pi-kagi/index.ts:46`

`registerSearchTool(pi, getClient())` eagerly invokes `getClient()` during extension registration, so `resolveConfig()` runs immediately. This defeats the intended lazy behavior and can throw before session startup handling/warnings.

```ts
// current
registerSearchTool(pi, getClient());
```

This regresses the previous behavior where missing `KAGI_API_KEY` was surfaced as a warning on `session_start` instead of hard failure at load time.

**Suggested fix:** pass a client getter into the tool (`() => getClient()`) and instantiate inside `execute`, or construct client in a guarded path that doesn’t throw during extension bootstrap.

---

### 2) Truncation notice always reports `shown === total`
**Severity:** Medium  
**Location:** `.pi/extensions/pi-kagi/src/tools/search.ts:61-63`

When output is truncated, code appends:

```ts
result += truncationNotice(totalResults, totalResults);
```

This always prints “Showing X of X results” even when truncation happened, which is misleading.

**Suggested fix:** compute `shown` from truncated content (e.g., count citation lines like `/^\[\d+\]\(/gm`) and pass `truncationNotice(shown, totalResults)`.

---

### 3) New search tool/formatter paths have no direct tests yet
**Severity:** Medium  
**Location:** test coverage gap

The existing suite passes, but it does not cover:
- `registerSearchTool` execution path,
- `formatSearchResponse` formatting edge cases,
- truncation-notice behavior.

Given new user-facing output logic, this should be covered in Step 1/Step 4 before merge.

---

## Minor notes (non-blocking)
- Unused imports:
  - `KagiConfigError` in `index.ts`
  - `ExtensionContext` in `src/tools/search.ts`
  - `SearchItem` in `src/formatters/results.ts`
- `STATUS.md` has conflicting header lines (`Current Step` appears twice with different values).

---

## Recommendation
Address Findings #1 and #2 before approving Step 1. Add at least basic formatter/tool tests (Finding #3) in `tests/search-enrich.test.ts` as follow-up in this task.
