# R005: Code Review — Step 3 (Add Unit Tests for Client Foundation)

**Reviewer:** automated code review  
**Step:** Step 3: Add unit tests for client foundation  
**Date:** 2026-04-12  
**Verdict:** 🔴 Request changes  

---

## Summary

Step 3 adds 66 unit tests across three test files (`config.test.ts`, `errors.test.ts`, `client.test.ts`). All 66 tests pass. The test coverage for `config.ts` and `errors.ts` is solid, and the client test infrastructure (DI via constructor, `fastRetry` config, `globalThis.fetch` mocking) is well-structured.

However, this review must **request changes** because the tests were written against two **critical, known bugs** from R002 that remain unfixed in the implementation:

1. `smallweb()` mutates `this.baseUrl` — concurrency-unsafe, and no test verifies it doesn't
2. Retry logic only retries HTTP 429, not 5xx, contradicting `isRetryableStatus()` — no test for 5xx retry

Both were flagged as 🔴 MUST-fix in R002 and explicitly called out in R003 as prerequisites for test writing. Writing tests that pass against buggy behavior enshrines those bugs as "tested and verified" which is worse than no tests at all.

There are also several test quality/coverage gaps that should be addressed.

---

## Checklist Evaluation

| # | Step 3 Deliverable | Assessment |
|---|-------------------|------------|
| 1 | Config resolution tests (resolveConfig with env var, missing key, validateConfig) | ✅ Good — 9 tests, thorough |
| 2 | Request construction tests (auth header, URL building, params) | ⚠️ Adequate but incomplete — missing POST-specific header tests |
| 3 | Response/error mapping tests (KagiApiError, KagiNetworkError, KagiTimeoutError, isRetryable) | ⚠️ Partial — no test for 5xx retry behavior |
| 4 | Response normalization tests (null snippet, t discriminator, smallweb parsing) | ⚠️ Partial — missing unknown `t` value test, smallweb format variation tests |
| 5 | Retry/backoff tests (429 retry logic, max retries, network retry) | 🔴 Critical gap — only 429 is tested for retry; 5xx is not, because implementation doesn't retry 5xx |

---

## 🔴 Critical Issues (Must Fix Before Approving)

### Issue 1: Tests written against `smallweb()` baseUrl mutation bug — no test catches the concurrency issue

**Severity:** 🔴 Critical — Tests validate buggy behavior

**Problem:** R002 flagged that `smallweb()` temporarily mutates `this.baseUrl` to swap in the v1 URL:

```typescript
// kagi-client.ts:361-378
const smallWebBaseUrl = this.baseUrl.replace("/api/v0", "/api/v1");
const originalBaseUrl = this.baseUrl;
this.baseUrl = smallWebBaseUrl;
try {
    const response = await this.request<unknown>("/smallweb/feed/", { ... });
    return normalizeSmallWebResponse(response);
} finally {
    this.baseUrl = originalBaseUrl;
}
```

The smallweb test verifies the v1 URL is *used*, but does **not** verify that `this.baseUrl` is restored correctly or that the mutation doesn't persist. More importantly, R002 and R003 both said this pattern must be replaced with a per-call `baseUrl` override. The test should verify the *correct* implementation (using override parameter), not the *buggy* one.

**What needs to happen:**
1. Fix `request()` to accept an optional `baseUrl` override parameter
2. Fix `smallweb()` to pass the v1 URL per-call instead of mutating `this.baseUrl`
3. Add a test that verifies `this.baseUrl` is unchanged after `smallweb()` (or tests sequential `smallweb()` then `search()` calls)

**Current test result:** The test passes because it captures the URL *during* the call — it doesn't verify that `this.baseUrl` is restored or that no shared state is mutated.

---

### Issue 2: No test for 5xx retry behavior — implementation bug in plain sight

**Severity:** 🔴 Critical — Implementation contradicts `isRetryableStatus()` contract

**Problem:** R002 and R003 both flagged that the retry loop at line 150 only checks for `response.status === 429`:

```typescript
if (response.status === 429 && attempt < this.retryConfig.maxRetries) {
```

But `isRetryableStatus()` in `errors.ts` correctly declares 5xx as retryable. The error mapping tests verify `isRetryableStatus(500) === true` and `isRetryableStatus(503) === true`, but there is **no test** for the actual retry behavior on 5xx responses. This is because the implementation doesn't retry 5xx — so a test would fail.

The `errors.test.ts` tests verify:
- `isRetryableStatus(500) → true` ✅
- `isRetryableStatus(503) → true` ✅

But `client.test.ts` has no test for "client retries on 500 response" — the implementation skips 5xx in the retry loop.

**What needs to happen:**
1. Fix `request()` to use `isRetryableStatus(response.status)` as the retry condition instead of `response.status === 429`
2. Add tests for 5xx retry behavior (500, 503)
3. Add a test verifying that non-retryable statuses (401, 403, 404) throw immediately without retry

---

### Issue 3: Timeout timer not cleared on error paths — resource leak

**Severity:** 🟡 Should fix (carried from R002)

**Problem:** In `request()`, `clearTimeout(timeoutId)` at line 143 is only reached on the success path of `fetch()`. If `fetch()` throws (network error, AbortError), the timer is never cleared:

```typescript
const timeoutId = setTimeout(() => controller.abort(), timeout ?? TIMEOUTS.default);
const response = await fetch(url.toString(), { ... });
clearTimeout(timeoutId); // ← not reached on throw
```

While each leaked timer is a no-op (it aborts an already-aborted controller), it holds a reference until the timeout duration expires.

**Resolution:** Wrap with `try/finally`:

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), timeout ?? TIMEOUTS.default);
try {
    const response = await fetch(url.toString(), { ... });
    clearTimeout(timeoutId);
    // ... handle response
} catch (err) {
    clearTimeout(timeoutId);
    throw err;
}
```

Or move `clearTimeout` to a `finally` block within the retry loop. This also makes the timeout tests more predictable.

---

## 🟡 Should-Fix Issues

### Issue 4: No common `KagiError` base class — tests can't assert `instanceof KagiError`

**Severity:** Medium — Affects downstream tool catch-block ergonomics

**Problem:** R001 recommended a `KagiError` base class. R002 reiterated this. R003 recommended adding it before writing error tests. The error hierarchy still has four separate `extends Error` classes:

- `KagiConfigError extends Error`
- `KagiApiError extends Error`
- `KagiNetworkError extends Error`
- `KagiTimeoutError extends Error`

Without a common base, downstream tools can't write `catch (err) { if (err instanceof KagiError) ... }` — they must check each class individually.

**The current test suite has no `instanceof KagiError` test** because the class doesn't exist.

**Resolution:** Add `KagiError extends Error` as a common base in `errors.ts`, have all four error classes extend it, and add a test verifying `instanceof KagiError` works for each subclass.

---

### Issue 5: Missing test coverage for important behaviors

**Severity:** Medium — Gaps in test completeness

The following test scenarios are missing from `client.test.ts`:

| Missing Test | Why It Matters | Priority |
|---|---|---|
| **5xx retry** (500, 503 trigger retry) | Core retry contract | 🔴 Critical (see Issue 2) |
| **Non-retryable errors throw immediately** (401, 403, 404 — no retry) | Verifies no false retries | 🔴 Must |
| **`smallweb()` doesn't mutate `this.baseUrl`** | Concurrency safety | 🔴 Critical (see Issue 1) |
| **`Content-Type: application/json`** is set on POST requests but not GET requests | Header correctness | 🟡 Should |
| **`Accept: application/json`** header present on all requests | Header correctness | 🟢 Nice |
| **Unknown `t` discriminator** value produces safe output | v0 API defensiveness | 🟡 Should |
| **`data: null`** in search response doesn't crash | Null safety on empty results | 🟡 Should |
| **`smallweb()`** normalization of different response formats (array, data envelope, null) | Small Web format variability | 🟡 Should |
| **`backoffDelay()`** formula correctness | Exponential backoff contract | 🟢 Nice |
| **Malformed JSON response** → `KagiNetworkError` or clear error | v0 beta defensiveness | 🟡 Should |

---

### Issue 6: Test utility code is unused — `fetchMock`, `mockFetch()`, `mockFetchWithError()` are dead code

**Severity:** Low — Code hygiene

**Problem:** The test file defines a module-level `fetchMock` variable and helper functions `mockFetch()` and `mockFetchWithError()` at lines 10-28, but these are never used. Every test uses inline `globalThis.fetch = async () => ...` instead.

```typescript
let fetchMock: { ... } | null = null;  // never used
const originalFetch = globalThis.fetch;  // used as restore reference

function mockFetch(status, body, headers?) { fetchMock = { ... }; }  // never called
function mockFetchWithError() { fetchMock = null; }                    // never called
```

The `originalFetch` reference IS used as the restore target in `restoreFetch()`, and the `installMockFetch()` function IS defined but never called.

**Resolution:** Remove the unused `fetchMock` state variable, `mockFetch()`, and `mockFetchWithError()`. Keep `originalFetch` and `restoreFetch()` since those are used. Consider simplifying to a consistent mock pattern.

---

### Issue 7: `restoreFetch()` is called per-test instead of in `afterEach` — risk of test pollution

**Severity:** Medium — Potential test isolation issue

**Problem:** In `client.test.ts`, each test manually calls `restoreFetch()` at the end. If an assertion fails before `restoreFetch()`, the global `fetch` remains mocked, polluting subsequent tests. There IS a top-level `afterEach` hook at line 69, but it only cleans env vars — it doesn't restore `globalThis.fetch`.

```typescript
afterEach(() => {
    delete process.env.KAGI_API_KEY;
    delete process.env.KAGI_API_BASE_URL;
    // ← no restoreFetch() here!
});
```

**Resolution:** Move `restoreFetch()` to `afterEach`:

```typescript
afterEach(() => {
    delete process.env.KAGI_API_KEY;
    delete process.env.KAGI_API_BASE_URL;
    restoreFetch();
});
```

And remove inline `restoreFetch()` calls from individual tests.

---

### Issue 8: `process.env` teardown in `client.test.ts` doesn't restore original values

**Severity:** Low — But could cause issues with other test files

**Problem:** In `client.test.ts`, `beforeEach` sets `process.env.KAGI_API_KEY = MOCK_API_KEY` and `afterEach` deletes it. But if the test runner started with `KAGI_API_KEY` already set (e.g., a developer running tests with a real key), the `afterEach` deletes it instead of restoring the original value. Compare with `config.test.ts` which properly saves/restores:

```typescript
// config.test.ts — correct pattern:
const originalKey = process.env.KAGI_API_KEY;
afterEach(() => {
    if (originalKey !== undefined) process.env.KAGI_API_KEY = originalKey;
    else delete process.env.KAGI_API_KEY;
});
```

```typescript
// client.test.ts — loses original value:
afterEach(() => {
    delete process.env.KAGI_API_KEY;  // ← original key lost forever
});
```

**Resolution:** Use the same save/restore pattern as `config.test.ts`.

---

### Issue 9: Small Web URL construction via string replacement is fragile

**Severity:** Medium — Carried from R002

**Problem:** R002 Issue 7 and R003 noted that `this.baseUrl.replace("/api/v0", "/api/v1")` is fragile. If a custom `KAGI_API_BASE_URL` is set without containing `/api/v0`, the URL silently remains unchanged. This should be a separate config constant (`KAGI_SMALLWEB_BASE_URL`).

**Test gap:** There's no test for custom `baseUrl` + `smallweb()`. For example, if `baseUrl` is `https://proxy.example.com/api/v0`, the `replace()` works. But if it's `https://proxy.example.com/kagi`, the `replace()` silently fails and `smallweb()` gets the wrong URL.

---

## Positive Observations

1. **Clean test structure** — Three well-organized test files matching source modules. Each `describe` block is logically grouped.
2. **Good mock strategy** — Using `KagiClient({ apiKey, baseUrl })` constructor injection for tests, avoiding env var manipulation in most client tests.
3. **`fastRetry` config** — Using a fast retry config for tests (`initialBackoffMs: 1, backoffMultiplier: 1`) is the right approach to keep tests fast.
4. **Config tests are thorough** — Whitespace trimming, empty key, whitespace-only key all tested.
5. **Error class tests are complete** — `isRetryableStatus`, `statusToUserMessage`, all three error classes, and `toResponse()` methods well-covered.
6. **Search normalization tests** — `t=0` → result, `t=1` → related, `null` snippet → `""`, thumbnail URL preservation — all good.
7. **All 66 tests pass** — Baseline correctness is solid for the behaviors that ARE tested.

---

## Test Coverage Assessment

| Module | Lines | Test Coverage | Quality |
|--------|-------|-------------|---------|
| `config.ts` | 82 | 9 tests | ✅ Good — all paths covered |
| `errors.ts` | 117 | 17 tests | ✅ Good — all public API tested |
| `kagi-client.ts` | 430 | 22 tests | ⚠️ Partial — missing retry scenarios, header tests, smallweb formats |

**Estimated missing tests:** ~15 additional test cases needed to address the gaps above.

---

## Alignment with R002/R003 Discoveries

| R002/R003 Discovery | Implementation Status | Test Status |
|---|---|---|
| D1: `smallweb()` mutates `this.baseUrl` | ❌ Not fixed — still mutates | ⚠️ Test verifies URL used, not that state is unmutated |
| D2: 5xx not retried (only 429) | ❌ Not fixed — still only retries 429 | ❌ No test for 5xx retry |
| D3: No common `KagiError` base class | ❌ Not fixed | ❌ No test for `instanceof KagiError` |
| D4: Timeout timer not cleared | ❌ Not fixed — no `try/finally` around `fetch` | N/A (hard to test directly) |
| D5: Small Web URL via string replace | ❌ Not fixed | ❌ No test for custom `baseUrl` + `smallweb` |
| D6: Unknown `t` discriminator values | ❌ Not fixed — silently treated as result type | ❌ No test for `t=2` or unknown `t` |

---

## Verdict

**🔴 REQUEST CHANGES**

Step 3 tests are well-structured and pass, but they were written against two critical implementation bugs identified in R002 that must be fixed first. The tests must be updated to verify the correct behavior, not the buggy behavior.

**Required changes before approval:**

1. **🔴 [MUST]** Fix `smallweb()` to use per-call `baseUrl` override instead of mutating `this.baseUrl`. Add a test verifying `this.baseUrl` is unchanged after `smallweb()` and that sequential `smallweb()` + `search()` calls use the correct URLs.
2. **🔴 [MUST]** Fix retry logic to use `isRetryableStatus()` instead of `response.status === 429`. Add tests for 5xx retry behavior and non-retryable immediate-throw behavior.
3. **🔴 [MUST]** Add test for non-retryable errors (401, 403) throwing immediately without retries.
4. **🟡 [SHOULD]** Fix timeout cleanup with `try/finally` in `request()`.
5. **🟡 [SHOULD]** Add `KagiError` base class and test `instanceof KagiError` across all error types.
6. **🟡 [SHOULD]** Add tests for `Content-Type` header (present on POST, absent on GET).
7. **🟡 [SHOULD]** Add tests for unknown `t` discriminator values, `data: null`, and smallweb response format variations.
8. **🟡 [SHOULD]** Move `restoreFetch()` to `afterEach` and use env save/restore pattern from `config.test.ts`.
9. **🟢 [NICE]** Remove unused `fetchMock`/`mockFetch`/`mockFetchWithError` dead code.
10. **🟢 [NICE]** Define `KAGI_SMALLWEB_BASE_URL` as a separate constant and add a test for custom `baseUrl` with `smallweb()`.
