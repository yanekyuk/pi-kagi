# R003: Plan Review — Step 3 (Add Unit Tests for Client Foundation)

**Reviewer:** automated code review  
**Step:** Step 3: Add unit tests for client foundation  
**Date:** 2026-04-12  
**Verdict:** 🟡 Approve with conditions  

---

## Summary

Step 3 adds unit tests covering config resolution, request construction, response/error mapping, response normalization, and retry/backoff logic. The STATUS.md checklist items are well-scoped and map to the implementation's surface area. However, the plan must grapple with several concrete blockers inherited from R002 (which identified two MUST-fix issues in Step 2 that should be resolved before or during Step 3) and establish a sound test infrastructure that will serve later tasks.

This review evaluates the **plan for Step 3** — i.e., the checklist in STATUS.md and what the test file(s) should cover — against the current implementation in `src/`.

---

## Pre-Conditions: Step 2 Issues That Must Be Resolved First

R002 identified two 🔴 MUST-fix issues in `kagi-client.ts`. These affect test correctness and must be resolved before or simultaneously with Step 3:

### 🔴 Must-Fix 1: `smallweb()` mutates `this.baseUrl` — concurrency-unsafe

**Impact on Step 3:** The `smallweb()` method temporarily swaps `this.baseUrl` to the v1 URL and restores it in a `finally` block. This pattern is untestable in a deterministic way if concurrent requests are involved. More importantly, the tests written against this pattern will need to be rewritten once the fix (per-request `baseUrl` override) is applied.

**Resolution:** Fix `request()` to accept an optional `baseUrl` override parameter, and update `smallweb()` to pass it per-call rather than mutating state. Then write tests against the corrected API.

### 🔴 Must-Fix 2: 5xx errors not retried despite `isRetryableStatus()` declaring them retryable

**Impact on Step 3:** Tests for retry behavior would currently assert that only 429 is retried, which contradicts the contract in `errors.ts`. Writing tests that verify "429 is retried but 500 is not" would enshrine incorrect behavior.

**Resolution:** Fix the retry condition in `request()` to use `isRetryableStatus()` instead of the hardcoded `429` check. Then write retry tests that correctly verify both 429 and 5xx behaviors.

### 🟡 Should-Fix 3: Timeout timer not cleared on error paths

**Impact on Step 3:** Tests involving timeout errors may leave dangling timers if `clearTimeout` is never called in the catch path. This can cause test flakes (especially with `bun test`'s 5s default timeout).

**Resolution:** Add try/finally around the `fetch` call in `request()` to guarantee timer cleanup. This also makes timeout-related tests more predictable.

### 🟡 Should-Fix 4: No common `KagiError` base class

**Impact on Step 3:** Tests that assert error types need to know the inheritance hierarchy. If `KagiError` base is added later, tests will need updating.

**Resolution:** Add `KagiError` base class now (before writing tests). This is a small change that prevents rework.

**Recommendation:** All four issues above should be resolved before writing the test suite. The test file should be written against the **corrected** implementation, not the current buggy version. Step 2 should be marked complete only after these fixes.

---

## Test File Organization

### File Location

**ISSUE:** No `tests/` directory exists yet. The PROMPT.md file scope lists `tests/client.test.ts`. Bun test looks for `*.test.ts` or `*.spec.ts` files by default.

**Resolution:** Create `tests/` under the extension root:

```
.pi/extensions/pi-kagi/
├── ...
├── src/
│   ├── config.ts
│   ├── errors.ts
│   ├── kagi-client.ts
│   └── types.ts
└── tests/
    ├── config.test.ts      # Config resolution & validation
    ├── errors.test.ts       # Error classes & helpers
    └── client.test.ts       # KagiClient request/response/retry
```

Splitting into three files keeps tests organized by module and avoids a monolithic 400-line test file. Each file aligns with a `src/` module.

### Import Paths

All source files use `.ts` extensions in imports (e.g., `import { resolveConfig } from "./config.ts"`). This works with Bun's jiti-style resolution. Tests must match this convention.

---

## Detailed Test Plan

### 1. Config Resolution Tests (`tests/config.test.ts`)

These tests cover `src/config.ts`: `resolveConfig()`, `validateConfig()`, `KagiConfigError`, and the exported constants.

| Test Case | What It Verifies | Priority |
|-----------|-------------------|----------|
| `resolveConfig()` returns config when `KAGI_API_KEY` is set | Basic happy path | 🔴 Must |
| `resolveConfig()` trims whitespace from `KAGI_API_KEY` | Whitespace handling | 🟡 Should |
| `resolveConfig()` throws `KagiConfigError` when `KAGI_API_KEY` is not set | Missing key error | 🔴 Must |
| `resolveConfig()` throws `KagiConfigError` when `KAGI_API_KEY` is empty string | Empty key error | 🔴 Must |
| `resolveConfig()` uses default `baseUrl` when `KAGI_API_BASE_URL` not set | Default URL = `https://kagi.com/api/v0` | 🟡 Should |
| `resolveConfig()` uses custom `baseUrl` when `KAGI_API_BASE_URL` is set | Environment override | 🟡 Should |
| `resolveConfig()` strips trailing slashes from `baseUrl` | URL normalization (done in KagiClient constructor) | 🟢 Nice |
| `validateConfig()` returns `{ valid: true, config }` when key is set | Validated happy path | 🔴 Must |
| `validateConfig()` returns `{ valid: false, error }` when key is missing | Validated error path (no throw) | 🔴 Must |
| `KagiConfigError` has correct `name` and `message` | Error class contract | 🟢 Nice |
| `TIMEOUTS` and `RETRY` export correct values | Constants contract | 🟢 Nice |

**Implementation Notes:**
- Must save/restore `process.env.KAGI_API_KEY` around each test using `beforeEach`/`afterEach` to prevent cross-test contamination.
- Use `delete process.env.KAGI_API_KEY` and `process.env.KAGI_API_KEY = "test-key"` to control the environment.
- `resolveConfig()` should be tested with `expect(() => resolveConfig()).toThrow()` pattern.

**Example sketch:**
```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { resolveConfig, validateConfig, KagiConfigError, KAGI_API_BASE_URL } from "../src/config.ts";

describe("resolveConfig", () => {
  const originalKey = process.env.KAGI_API_KEY;
  const originalBaseUrl = process.env.KAGI_API_BASE_URL;

  afterEach(() => {
    process.env.KAGI_API_KEY = originalKey;
    process.env.KAGI_API_BASE_URL = originalBaseUrl;
  });

  test("returns config when KAGI_API_KEY is set", () => {
    process.env.KAGI_API_KEY = "  test-key-123  ";
    const config = resolveConfig();
    expect(config.apiKey).toBe("test-key-123"); // trimmed
    expect(config.baseUrl).toBe(KAGI_API_BASE_URL);
  });

  test("throws KagiConfigError when KAGI_API_KEY is not set", () => {
    delete process.env.KAGI_API_KEY;
    expect(() => resolveConfig()).toThrow(KagiConfigError);
  });
  // ...
});
```

### 2. Error Class Tests (`tests/errors.test.ts`)

These tests cover `src/errors.ts`: `KagiApiError`, `KagiNetworkError`, `KagiTimeoutError`, `isRetryableStatus()`, `statusToUserMessage()`, and (if added) `KagiError` base class.

| Test Case | What It Verifies | Priority |
|-----------|-------------------|----------|
| `isRetryableStatus(429)` → `true` | Rate limit is retryable | 🔴 Must |
| `isRetryableStatus(500)` → `true` | Server error is retryable | 🔴 Must |
| `isRetryableStatus(503)` → `true` | Service unavailable is retryable | 🔴 Must |
| `isRetryableStatus(400)` → `false` | Client error not retryable | 🔴 Must |
| `isRetryableStatus(401)` → `false` | Auth error not retryable | 🔴 Must |
| `isRetryableStatus(404)` → `false` | Not found not retryable | 🟡 Should |
| `KagiApiError` has correct `status`, `retryable`, `message`, `body` | Error properties | 🔴 Must |
| `KagiApiError.toResponse()` returns correct shape | Error response contract | 🟡 Should |
| `KagiNetworkError` has `retryable = true`, preserves `cause` | Network error properties | 🟡 Should |
| `KagiNetworkError.toResponse()` returns `status: 0` | Response contract | 🟡 Should |
| `KagiTimeoutError` has `retryable = true`, preserves `timeoutMs` | Timeout error properties | 🟡 Should |
| `statusToUserMessage(401)` includes guidance about `KAGI_API_KEY` | Actionable 401 message | 🟢 Nice |
| `statusToUserMessage(402)` includes billing URL | Actionable 402 message | 🟢 Nice |
| `statusToUserMessage(429)` mentions rate limiting | Actionable 429 message | 🟢 Nice |
| (If `KagiError` base class is added) `instanceof KagiError` works for all subclasses | Inheritance | 🟡 Should |

**Note on `KagiError` base class:** R001 and R002 both recommended adding a `KagiError` base class. If this is done before/with Step 3, add the `instanceof` test. If not, skip it and add a discovery noting the gap.

### 3. Client Tests (`tests/client.test.ts`)

This is the most complex test file. The core challenge is that `KagiClient` uses `globalThis.fetch` for HTTP requests. Tests must mock `fetch` without making real network calls.

**Mock Strategy:** Use Bun's `mock.module()` or direct `globalThis.fetch` replacement. The recommended approach is:

```typescript
import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
// mock.module if needed, or just replace globalThis.fetch
```

**Approach 1 (Recommended): Replace `globalThis.fetch`**
- Simplest, works in Bun test environment
- Replace `globalThis.fetch` with a mock in `beforeEach`, restore in `afterEach`
- Full control over response status, body, and timing

**Approach 2: DI in KagiClient constructor (would require code change)**
- Pass `fetch` as a constructor parameter with default to `globalThis.fetch`
- More testable, but requires modifying `KagiClient` — out of scope for Step 3 unless fixing pre-existing design issues

**Recommendation:** Use Approach 1 (replace `globalThis.fetch`) for Step 3. If DI is desired, it can be added in a later refactoring step.

#### 3a. Request Construction Tests

| Test Case | What It Verifies | Priority |
|-----------|-------------------|----------|
| `search("test query")` sends `GET /search?q=test+query` with `Authorization: Bot <key>` | Auth header + URL + params | 🔴 Must |
| `search("test", 10)` sends `limit=10` param | Optional params | 🟡 Should |
| `fastgpt("explain quantum")` sends `POST /fastgpt` with JSON body and `web_search: true` | POST request with body | 🔴 Must |
| `fastgpt("test", { cache: false })` sends `cache: false` in body | Optional POST params | 🟡 Should |
| `summarize({ url: "https://example.com" })` sends `POST /summarize` with `url` in body | Summarize body construction | 🟡 Should |
| `enrichWeb("test")` sends `GET /enrich/web?q=test` | Enrich endpoint URL | 🟢 Nice |
| `enrichNews("test")` sends `GET /enrich/news?q=test` | Enrich endpoint URL | 🟢 Nice |
| `Content-Type: application/json` set only for POST requests | Header logic | 🟡 Should |
| `Accept: application/json` header set on all requests | Accept header | 🟢 Nice |
| Client strips trailing slashes from `baseUrl` | URL normalization | 🟢 Nice |

**Test Pattern for Request Construction:**
```typescript
describe("KagiClient request construction", () => {
  let client: KagiClient;
  let fetchMock: typeof fetch;

  beforeEach(() => {
    process.env.KAGI_API_KEY = "test-api-key";
    fetchMock = mock(() => Promise.resolve(new Response(JSON.stringify({
      meta: { id: "test", node: "test", ms: 100, api_balance: 50 },
      data: [],
    }), { headers: { "Content-Type": "application/json" } })));
    globalThis.fetch = fetchMock;
    client = new KagiClient();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("search sends GET /search with auth header", async () => {
    await client.search("test query");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url.toString()).toContain("/search?q=test+query");
    expect(init.headers.Authorization).toBe("Bot test-api-key");
  });
});
```

**Note:** After R002's fix (adding `baseUrl` override to `request()`), the `smallweb()` test should verify that the v1 baseUrl is used per-call without mutating `this.baseUrl`.

#### 3b. Response Normalization Tests

| Test Case | What It Verifies | Priority |
|-----------|-------------------|----------|
| `search()` normalizes `t: 0` items to `{ type: "result", data: SearchResult }` | Type discriminator mapping | 🔴 Must |
| `search()` normalizes `t: 1` items to `{ type: "related", data: RelatedSearches }` | Related searches mapping | 🔴 Must |
| `search()` converts `snippet: null` to `snippet: ""` | Null safety | 🔴 Must |
| `search()` handles `data: null` (empty results) gracefully | Null data array | 🟡 Should |
| `fastgpt()` normalizes references into `Citation[]` | FastGPT reference mapping | 🟡 Should |
| `fastgpt()` forces `web_search: true` in request body | Web search forcing | 🟡 Should |
| `summarize()` returns `{ meta, output, tokens }` | Summarize response mapping | 🟢 Nice |
| `smallweb()` normalizes response with `data` envelope | Small Web envelope | 🟡 Should |
| `smallweb()` normalizes direct array response | Small Web array format | 🟡 Should |
| `smallweb()` handles `null`/`undefined` response gracefully | Small Web null guard | 🟢 Nice |

**Priority rationale:** The `t` discriminator and null-safety are the most critical because they directly affect downstream tool correctness. FastGPT and Small Web normalization are secondary because their API response shapes need live confirmation (v0 beta).

#### 3c. Error Mapping Tests

| Test Case | What It Verifies | Priority |
|-----------|-------------------|----------|
| 401 response → `KagiApiError` with `status: 401`, `retryable: false` | Auth error | 🔴 Must |
| 402 response → `KagiApiError` with `status: 402`, retryable: false | Payment error | 🟡 Should |
| 404 response → `KagiApiError` with `status: 404` | Not found error | 🟡 Should |
| 500 response → `KagiApiError` with `retryable: true` | Server error retryability | 🔴 Must |
| Error message includes actionable guidance (e.g., set KAGI_API_KEY for 401) | User-facing messages | 🟢 Nice |
| Network failure (fetch throws TypeError) → `KagiNetworkError` with `retryable: true` | Network error mapping | 🔴 Must |
| Timeout (AbortError) → `KagiTimeoutError` with `timeoutMs` | Timeout error mapping | 🟡 Should |
| `KagiApiError.toResponse()` returns `{ status, message, retryable }` | Response contract | 🟡 Should |

#### 3d. Retry/Backoff Tests

| Test Case | What It Verifies | Priority |
|-----------|-------------------|----------|
| 429 response triggers up to `RETRY.maxRetries` retries | Rate limit retry | 🔴 Must |
| 5xx responses trigger retry (after fix per R002) | Server error retry | 🔴 Must |
| Successful response on retry (after 429) returns data | Retry success path | 🟡 Should |
| Exhausted retries (all 429s) throws `KagiApiError(429)` | Retry exhaustion | 🔴 Must |
| Backoff delay increases exponentially (1s → 2s → 4s) | Exponential backoff | 🟡 Should |
| Backoff is capped at `RETRY.maxBackoffMs` | Backoff ceiling | 🟢 Nice |
| Network errors are retried (after fix per R002 Issue 6) | Network retry | 🟡 Should |
| Non-retryable errors (400, 401) throw immediately | No-retry policy | 🔴 Must |

**Note on testing backoff timing:** Do NOT write tests that actually `sleep()` for real seconds. Instead:
1. Mock `sleep`/`setTimeout` to track that it was called with expected delays, or
2. Test `backoffDelay()` as a pure function (it's not exported currently — see Issue below).
3. Use Bun's `mock` to replace the module-internal `sleep` function.

**ISSUE:** The `backoffDelay()` and `sleep()` functions in `kagi-client.ts` are module-private (not exported). This makes them untestable in isolation. Two options:
- **Option A (Preferred):** Export `backoffDelay` for unit testing. `sleep` doesn't need testing, but `backoffDelay` should be verifiable.
- **Option B:** Test retry behavior end-to-end by mocking `fetch` to return 429 N times then 200, and verifying the call count. This tests observable behavior without needing to access internals.

**Recommendation:** Use Option B for the main retry tests (verify call count and final result). Optionally extract and export `backoffDelay` for a quick unit test of the formula.

**Test Pattern for Retry:**
```typescript
describe("KagiClient retry behavior", () => {
  test("retries on 429 and succeeds on second attempt", async () => {
    let callCount = 0;
    globalThis.fetch = mock(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(new Response("rate limited", { status: 429 }));
      }
      return Promise.resolve(new Response(JSON.stringify({
        meta: { id: "test", node: "test", ms: 100 },
        data: [],
      }), { headers: { "Content-Type": "application/json" } }));
    });

    const result = await client.search("test");
    expect(callCount).toBe(2);
    expect(result.items).toEqual([]);
  });

  test("throws KagiApiError after exhausting retries on 429", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("rate limited", { status: 429 }))
    );

    await expect(client.search("test")).rejects.toThrow(KagiApiError);
    // Verify it retried maxRetries times
    expect(fetchMock).toHaveBeenCalledTimes(RETRY.maxRetries + 1); // initial + retries
  });
});
```

**WARNING:** Retry tests with real `sleep()` will be very slow (1s + 2s + 4s = 7s+ per test). Either:
- Mock the `sleep` function in the module, OR
- Set `RETRY.initialBackoffMs` to 0 in tests by temporarily overriding it, OR
- Accept slow tests and set a high `bun test --timeout`

The recommended approach is to use Bun's `mock.module()` to replace `sleep` with a no-op for retry tests:

```typescript
import { mock } from "bun:test";
mock.module("../src/kagi-client.ts", () => {
  // ... this is complex; consider extracting sleep to a separate testable module
});
```

Actually, the **simplest approach** is to set `RETRY.initialBackoffMs` to a very small value (1ms) for tests, since it's a `const` exported from config. Since `RETRY` is `as const`, you'd need to temporarily mock it. An easier path: mock `globalThis.fetch` such that retry tests resolve instantly by having `setTimeout` mocked. Bun doesn't have a built-in timer mock yet, so the pragmatic approach is:

1. Export `backoffDelay` for unit testing the formula.
2. For integration retry tests, mock fetch to return 429 N times then 200, and accept that the test takes ~0ms because the sleep durations are negligible when bun's event loop processes them immediately in test context (they're micro-delays).

**Final recommendation for retry timing:** Don't overthink it. Use the real `backoffDelay` formula, mock `fetch`, and set the test timeout to 30s. The total sleep time across 3 retries at default config is 1s + 2s + 4s = 7s max, which is acceptable for a unit test. If this becomes too slow, extract sleep into a separate module and mock it.

---

## Coverage Gaps and Missing Test Scenarios

### Items NOT in STATUS.md That Should Be Tested

| Missing Test | Why It Matters | Priority |
|---|---|---|
| `KagiClient` constructor accepts explicit `KagiConfig` (DI for testing) | The constructor takes `config?: KagiConfig` which is the primary testing hook. Must verify it works. | 🔴 Must |
| `KagiClient` constructor falls back to `resolveConfig()` when no config passed | Verifies env-based config resolution path | 🟡 Should |
| `smallweb()` uses v1 base URL without mutating `this.baseUrl` (after R002 fix) | Critical concurrency safety test | 🔴 Must |
| Response JSON parse error → `KagiNetworkError` or clear error | Defensive for v0 beta API | 🟢 Nice |
| Request with `body` sets `Content-Type: application/json` | Header correctness | 🟡 Should |
| Request without `body` does NOT set `Content-Type` | No false headers on GET | 🟡 Should |
| Malformed API response (missing `meta` or `data`) → clear error | v0 beta defensive coding | 🟡 Should |

### Items in STATUS.md That Need Clarification

**STATUS.md says:** "Retry/no-retry policy boundaries (if implemented)"

This is conditional language ("if implemented"). The retry logic IS implemented in `kagi-client.ts` (the `request()` method has a full retry loop). This test MUST be included. The STATUS.md should drop the "if implemented" hedge — retries are implemented and must be tested.

---

## Test Infrastructure Concerns

### 1. Environment Variable Isolation

`resolveConfig()` reads `process.env.KAGI_API_KEY` and `process.env.KAGI_API_BASE_URL`. Tests must save/restore these variables. Recommended pattern:

```typescript
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  // Reset env for each test
  process.env.KAGI_API_KEY = "test-key";
  delete process.env.KAGI_API_BASE_URL; // use default
});

afterEach(() => {
  // Restore original env
  process.env = { ...ORIGINAL_ENV };
});
```

**Note:** Modifying `process.env` in Bun tests works, but `Object.assign(process.env, ...)` is safer than `process.env = { ... }` because the latter may not propagate to all modules. Prefer `delete process.env.KAGI_API_KEY` and `process.env.KAGI_API_KEY = "test-key"`.

### 2. `fetch` Mocking

Global `globalThis.fetch` replacement is the simplest approach for Bun. Must save and restore the original fetch:

```typescript
const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = mockFetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});
```

### 3. Timer Handling for Retry Tests

As discussed above, real `setTimeout`-based sleep in retry tests will add seconds. Consider:
- A `mockSleep` helper that advances timers manually (if Bun adds timer mocking)
- Setting a generous test timeout (`bun test --timeout 30000`)
- Extracting sleep to a mockable module

### 4. TypeScript Import Paths

Source files use `.ts` extensions in imports (e.g., `import { resolveConfig } from "./config.ts"`). Test files must use the same `.ts` extension convention. Bun resolves these correctly.

---

## Alignment with R002 Discoveries

| R002 Discovery | Test Coverage Required | Notes |
|---|---|---|
| D1: `smallweb()` mutates `this.baseUrl` | Test that `smallweb()` uses v1 URL without mutating `this.baseUrl` (after fix) | Critical for concurrency safety |
| D2: 5xx not retried (only 429 retried) | Test that 500/503 triggers retry (after fix) | Must fix before writing test |
| D3: No common `KagiError` base class | Test `instanceof KagiError` across all error types (after adding) | Should fix before writing test |
| D4: Timeout timer not cleared on error | Test timeout path doesn't leak (hard to unit test; verify with `afterEach` timer check) | Should fix in impl |
| D5: Small Web URL string replacement | Test that custom `baseUrl` works for smallweb (after fix with separate constant) | Should fix before writing test |
| D6: `normalizeSearchItem` silently treats unknown `t` as result | Test that unknown `t` values produce a sensible output (after adding `console.warn` or `unknown` type) | Should add defensive handling |

---

## Recommended Test File Structure

```
tests/
├── config.test.ts         ~80 lines   (11 test cases)
├── errors.test.ts         ~70 lines   (12 test cases)  
└── client.test.ts         ~250 lines  (30+ test cases)
    ├── describe("KagiClient constructor")
    ├── describe("request construction")
    ├── describe("response normalization")
    │   ├── describe("search normalization")
    │   ├── describe("fastgpt normalization")
    │   ├── describe("summarize normalization")
    │   └── describe("smallweb normalization")
    ├── describe("error mapping")
    └── describe("retry and backoff")
```

Total: ~400 lines across 3 files, ~53 test cases.

---

## Discoveries to Log

| # | Discovery | Disposition |
|---|-----------|-------------|
| D1 | Step 2 has two 🔴 MUST-fix issues (smallweb baseUrl mutation, 5xx retry) that must be resolved before Step 3 tests are meaningful | Block — fix in Step 2 first |
| D2 | `backoffDelay()` and `sleep()` are module-private and untestable in isolation | Consider exporting `backoffDelay` for direct unit testing |
| D3 | Retry tests with real `sleep()` will take 7+ seconds at default config | Accept slow tests or mock sleep |
| D4 | STATUS.md says "retry/no-retry policy boundaries (if implemented)" — retry IS implemented; remove hedging | Clarify in STATUS.md |
| D5 | No `tests/` directory exists yet; must create it | Create before writing tests |
| D6 | `KagiClient` constructor accepts `config?: KagiConfig` — this is the DI hook for tests | Use it in all client tests instead of env var manipulation |

---

## Verdict

**🟡 APPROVE WITH CONDITIONS**

Step 3 can proceed, but with these prerequisites and conditions:

1. **🔴 [MUST]** Resolve R002's two critical issues before writing tests:
   - `smallweb()` must use per-call `baseUrl` override instead of mutating `this.baseUrl`
   - Retry logic must use `isRetryableStatus()` to retry 5xx, not just 429
2. **🔴 [MUST]** Do NOT write tests that assert incorrect behavior (e.g., "429 is retried but 500 is not"). Write tests against the corrected implementation.
3. **🟡 [SHOULD]** Add `KagiError` base class before writing error tests — prevents rework when it's added later.
4. **🟡 [SHOULD]** Fix timeout cleanup (try/finally in `request()`) before writing timeout tests.
5. **🟡 [SHOULD]** Use `KagiClient` constructor's `config` parameter for DI in all client tests rather than manipulating `process.env`.
6. **🟡 [SHOULD]** Export `backoffDelay()` for direct unit testing of the formula.
7. **🟢 [NICE]** Split tests into 3 files (`config.test.ts`, `errors.test.ts`, `client.test.ts`) for organization.
8. **🟢 [NICE]** Accept that retry tests will be slow at default config; set `--timeout 30000` and move on.

**Estimated new code:** ~400 lines of tests across 3 files, ~53 test cases.
