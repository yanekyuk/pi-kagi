# R004: Code Review — Step 2 (Implement Core Client)

**Reviewer:** automated code review  
**Step:** Step 2: Implement core client  
**Date:** 2026-04-12  
**Verdict:** 🟡 Approve with conditions  

---

## Summary

Step 2 delivers a fully functional `KagiClient` class with authenticated request handling, retry logic on 429, six typed endpoint methods (search, enrichWeb, enrichNews, fastgpt, summarize, smallweb), and response normalization. The test suite covers config resolution, error classes, request construction, response normalization, retry/backoff, and error mapping with 66 passing tests across 3 files.

The implementation is solid overall, but there are **two must-fix concurrency/correctness issues** from R002 that remain unresolved, plus several should-fix items that affect robustness for a v0 beta API.

---

## Checklist Evaluation

| # | Step 2 Deliverable | Assessment |
|---|---------------------|------------|
| 1 | Authenticated request helper with `Authorization: Bot <TOKEN>` header | ✅ Done — header set correctly in `request()` |
| 2 | Typed raw endpoint methods (search, enrichWeb, enrichNews, fastgpt, summarize, smallweb) | ⚠️ Done, but `smallweb()` has a concurrency bug (Issue 1) |
| 3 | Normalized error mapping (HTTP status, API error payload, network failure, timeout) | ⚠️ Done, but retry logic only retries 429, not 5xx (Issue 2) |

---

## Issues

### 🔴 Issue 1: `smallweb()` mutates `this.baseUrl` — concurrency-unsafe

**Severity:** High — Data race in concurrent usage

**Problem:** The `smallweb()` method temporarily swaps `this.baseUrl` to the v1 API path and restores it in a `finally` block:

```typescript
async smallweb(limit?: number): Promise<SmallWebResponse> {
    const smallWebBaseUrl = this.baseUrl.replace("/api/v0", "/api/v1");
    const originalBaseUrl = this.baseUrl;
    this.baseUrl = smallWebBaseUrl;
    try {
        const response = await this.request<unknown>("/smallweb/feed/", { ... });
        return normalizeSmallWebResponse(response);
    } finally {
        this.baseUrl = originalBaseUrl;
    }
}
```

Between the `this.baseUrl = smallWebBaseUrl` assignment and the `finally` restoration, any interleaved `await` point allows other async operations on the same `KagiClient` instance to observe or use the wrong base URL. If `search()` and `smallweb()` run concurrently, `search()` could be dispatched to `/api/v1/search` instead of `/api/v0/search`.

Additionally, the string replacement `this.baseUrl.replace("/api/v0", "/api/v1")` is fragile — if a user sets a custom `KAGI_API_BASE_URL` that doesn't contain `/api/v0`, the replacement silently does nothing and sends the smallweb request to the v0 endpoint.

**Resolution:**
1. Add a `baseUrl` override parameter to `request()`:
   ```typescript
   private async request<T>(path: string, options: { ... baseUrl?: string } = {}): Promise<T> {
       const url = new URL((options.baseUrl ?? this.baseUrl) + path);
       // ...
   }
   ```
2. Define `KAGI_SMALLWEB_BASE_URL` as a separate constant in `config.ts`:
   ```typescript
   export const KAGI_SMALLWEB_BASE_URL = "https://kagi.com/api/v1";
   ```
3. Allow config to specify `smallWebBaseUrl`:
   ```typescript
   export interface KagiConfig {
       apiKey: string;
       baseUrl: string;
       smallWebBaseUrl?: string; // defaults to KAGI_SMALLWEB_BASE_URL
   }
   ```
4. Rewrite `smallweb()` without state mutation:
   ```typescript
   async smallweb(limit?: number): Promise<SmallWebResponse> {
       const smallWebBaseUrl = this.smallWebBaseUrl;
       const response = await this.request<unknown>("/smallweb/feed/", {
           params: { limit },
           timeout: TIMEOUTS.default,
           baseUrl: smallWebBaseUrl,
       });
       return normalizeSmallWebResponse(response);
   }
   ```

---

### 🔴 Issue 2: 5xx errors are not retried despite `isRetryableStatus()` declaring them retryable

**Severity:** High — Contract violation, breaks expected fallback behavior

**Problem:** `errors.ts` defines `isRetryableStatus()` which returns `true` for 429 and all 5xx codes. `KagiApiError` uses this to set `retryable: true` for 5xx statuses. But the `request()` method in `kagi-client.ts` only retries on HTTP 429:

```typescript
if (response.status === 429 && attempt < this.retryConfig.maxRetries) {
    const delay = backoffDelay(attempt, this.retryConfig);
    await sleep(delay);
    continue;
}
```

A 503 Service Unavailable throws `KagiApiError` with `retryable: true`, but the client never retries it. This violates the contract that `isRetryableStatus()` establishes.

**Resolution:** Replace the hardcoded 429 check with `isRetryableStatus()`:

```typescript
if (isRetryableStatus(response.status) && attempt < this.retryConfig.maxRetries) {
    const delay = backoffDelay(attempt, this.retryConfig);
    await sleep(delay);
    continue;
}
```

Add `isRetryableStatus` to the imports at the top of `kagi-client.ts` (it's already imported but not used in the retry condition).

**Note on test impact:** The existing test `"retries on 429 response and eventually succeeds"` only tests 429. After the fix, add a test for 500/503 retries:
```typescript
it("retries on 500 response and eventually succeeds", async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
        callCount++;
        if (callCount < 2) return new Response("Internal Server Error", { status: 500 });
        return new Response(JSON.stringify({ meta: { id: "t", node: "t", ms: 100 }, data: [] }), { status: 200 });
    };
    const client = new KagiClient({ apiKey: MOCK_API_KEY, baseUrl: MOCK_BASE_URL, retry: fastRetry });
    const result = await client.search("test");
    expect(callCount).toBe(2);
    restoreFetch();
});
```

---

### 🟡 Issue 3: Timeout timer not cleared on error paths — resource leak

**Severity:** Medium — Timer leak in error paths

**Problem:** In `request()`, `clearTimeout(timeoutId)` is only reached on the success path. If `fetch()` throws (AbortError, TypeError for network errors), the timeout is never cleared:

```typescript
const timeoutId = setTimeout(() => controller.abort(), timeout ?? TIMEOUTS.default);
const response = await fetch(url.toString(), { ... });
clearTimeout(timeoutId); // ← never reached on throw
```

While each leaked timer is ultimately a no-op (it aborts an already-settled controller), it holds an `AbortController` reference for the full timeout duration. In a retry loop with 30s timeouts and 3 retries, this could accumulate 90s of dangling timers.

**Resolution:** Use try/finally:
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), timeout ?? TIMEOUTS.default);
try {
    const response = await fetch(url.toString(), { ... });
    // ... handle response ...
} finally {
    clearTimeout(timeoutId);
}
```

---

### 🟡 Issue 4: No common `KagiError` base class

**Severity:** Medium — Downstream catch-block ergonomics

**Problem:** The current error hierarchy has four separate `Error` subclasses with no common base:
- `KagiApiError extends Error`
- `KagiNetworkError extends Error`
- `KagiTimeoutError extends Error`
- `KagiConfigError extends Error` (in config.ts)

Without a shared base, downstream tools must catch each type individually:
```typescript
catch (err) {
    if (err instanceof KagiApiError || err instanceof KagiNetworkError || err instanceof KagiTimeoutError) { ... }
}
```

**Resolution:** Introduce `KagiError` base class in `errors.ts`:
```typescript
export class KagiError extends Error {
    override readonly name = "KagiError";
    constructor(message: string) { super(message); }
}
```
Then make `KagiApiError`, `KagiNetworkError`, `KagiTimeoutError` extend `KagiError`, and move `KagiConfigError` to also extend `KagiError`. Add a test for `instanceof KagiError` across all subclasses.

---

### 🟡 Issue 5: Network error detection relies on fragile heuristics

**Severity:** Medium — May silently misclassify errors

**Problem:** The retry logic for network errors uses:
```typescript
if (err instanceof TypeError && err.message.includes("fetch")) {
    // network error — retryable
}
```

This is fragile because:
1. Bun throws `TypeError` with message `"fetch failed"` for DNS failures, but other runtimes may differ
2. `err.message.includes("fetch")` is string-match heuristic that could match unintended TypeErrors
3. Any other error class (e.g., `AggregateError`) falls through to the catch-all `KagiNetworkError` wrapper but WITHOUT retry behavior

The catch at the end:
```typescript
throw new KagiNetworkError(
    `Unexpected error during request to ${path}: ${err instanceof Error ? err.message : String(err)}`,
    err instanceof Error ? err : undefined,
);
```
This throws immediately without retrying — but most "unexpected" errors in a network context are transient and should be retried.

**Resolution:** Make the retry logic more generous — retry any non-KagiApiError, non-KagiTimeoutError:
```typescript
} catch (err) {
    if (err instanceof KagiApiError) throw err;
    if (err instanceof KagiTimeoutError) throw err;
    
    // All other errors are network/transient — retryable
    lastError = new KagiNetworkError(
        `Network error connecting to ${path}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err : undefined,
    );
    if (attempt < this.retryConfig.maxRetries) {
        await sleep(backoffDelay(attempt, this.retryConfig));
        continue;
    }
    throw lastError;
}
```

---

### 🟡 Issue 6: `normalizeSearchItem` silently treats unknown `t` values as "result"

**Severity:** Medium — Reduces defensiveness for v0 beta API

**Problem:** The `normalizeSearchItem` function:
```typescript
function normalizeSearchItem(raw: RawSearchObject): SearchItem {
    if (raw.t === 1) {
        return { type: "related", data: { queries: raw.list } };
    }
    // t === 0 (default / search result)
    return { type: "result", data: { ... } };
}
```

Any unknown `t` value (2, 3, etc.) falls through to the "result" branch. The API is v0 beta and may add new types. Silently treating unknown types as search results could produce malformed data with missing required fields (`url`, `title`).

**Resolution:** Add a defensive handler:
```typescript
// In types.ts, add a third union member:
export type SearchItem =
    | { type: "result"; data: SearchResult }
    | { type: "related"; data: RelatedSearches }
    | { type: "unknown"; data: Record<string, unknown> };

// In kagi-client.ts:
function normalizeSearchItem(raw: RawSearchObject): SearchItem {
    if (raw.t === 1) {
        return { type: "related", data: { queries: (raw as RawRelatedSearches).list } };
    }
    if (raw.t === 0) {
        return { type: "result", data: { ... } };
    }
    console.warn(`pi-kagi: unknown search item type t=${raw.t}, treating as unknown`);
    return { type: "unknown", data: raw as Record<string, unknown> };
}
```

---

### 🟡 Issue 7: `request()` method is private — limits testability of raw request behavior

**Severity:** Medium — Testing concern

**Problem:** The `request()` method is `private`, making it impossible to spy/mock directly. Tests currently replace `globalThis.fetch`, which works but is coarse-grained. The Step 2 scope includes testing "request construction" which is done via observable side-effects (capturing URLs and headers), but direct testing of `request()` logic (parameter encoding, header composition) would be cleaner with DI.

**Resolution (optional):** Consider accepting a custom `fetch` function in the constructor:
```typescript
constructor(config?: KagiConfig & { retry?: RetryConfig; fetch?: typeof globalThis.fetch }) {
    // ...
    this._fetch = config?.fetch ?? globalThis.fetch;
}
```
This makes testing trivial and doesn't require global-side-effect mocking. Not blocking for this step, but recommended for Step 3 (tests) or a follow-up.

---

### 🟢 Issue 8: No response shape validation for v0 beta API

**Severity:** Low — Risk of silent type mismatches

**Problem:** `request()` parses JSON and immediately casts with `as T`:
```typescript
const data = await response.json();
return data as T;
```

For a v0 beta API, response shapes may change without notice. No structural validation means errors manifest as runtime exceptions deep in endpoint methods (accessing `undefined.meta.id`) rather than at the parsing boundary.

**Resolution:** Consider lightweight validation:
```typescript
const data = await response.json();
if (!data || typeof data !== "object" || !("meta" in data)) {
    throw new KagiApiError(response.status, "Unexpected API response format: missing 'meta' field", JSON.stringify(data).slice(0, 200));
}
return data as T;
```

---

### 🟢 Issue 9: `summarize()` doesn't validate `url`/`text` mutual exclusivity

**Severity:** Low — Can be deferred to tool layer

**Problem:** If both `url` and `text` are provided to `summarize()`, both are sent in the request body, and the API returns an error. A defensive check would save a round-trip.

**Resolution:** Add a comment noting the assumption, and validate at the tool layer (TP-006). Not blocking.

---

## Test Assessment

The test suite covers the implementation well for a first pass:

| Area | Coverage | Gaps |
|------|----------|------|
| Config resolution | ✅ Good — 9 tests covering env, trimming, missing key | None significant |
| Error classes | ✅ Good — 12 tests covering all error types, `isRetryableStatus`, `statusToUserMessage` | Missing `instanceof KagiError` base test (not yet implemented) |
| Request construction | ✅ Good — auth headers, URL params, POST body | Missing `Content-Type` header test for POST vs GET |
| Response normalization | ✅ Good — t=0, t=1, null snippet, api_balance, thumbnail | Missing unknown `t` value test |
| Error mapping | ✅ Good — 401, 402, timeout, network errors | Missing 5xx retry test (blocked by Issue 2) |
| Retry/backoff | ✅ Good — 429 retry/succeed, 429 exhaust, network retry/exhaust | **Missing 5xx retry test** (blocked by Issue 2) |
| Small web | ⚠️ — Only tests URL path, not response normalization | Missing tests for array/direct response normalization, null guard |
| Constructor DI | ✅ — Tests use `{ apiKey, baseUrl }` constructor | None |

**Critical test gap:** No test verifies that 5xx responses are retried. This is directly caused by the implementation bug in Issue 2. Once the fix is applied, add a 5xx retry test.

**Missing test:** The `smallweb()` URL test confirms the v1 path is used, but doesn't verify that `this.baseUrl` is NOT mutated after the call (critical for the concurrency fix in Issue 1).

---

## Alignment with Prior Reviews

| R002 Recommendation | Status | Notes |
|---------------------|--------|-------|
| `smallweb()` must NOT mutate `this.baseUrl` | ❌ Not fixed | Still mutates `this.baseUrl` |
| Retry logic must honor `isRetryableStatus()` | ❌ Not fixed | Still only retries 429 |
| Introduce common `KagiError` base class | ❌ Not done | Four separate `Error` subclasses persisted |
| Clear timeout timers in all code paths | ❌ Not done | `clearTimeout` not in try/finally |
| Define `KAGI_SMALLWEB_BASE_URL` as separate constant | ❌ Not done | Still uses string replacement |
| Add defensive handler for unknown `t` values | ❌ Not done | Falls through to `result` type |
| Export `backoffDelay()` for unit testing | ✅ N/A for code review | Tests work around it with `fastRetry` DI |

None of the R002 conditions were addressed in the implementation. These must be resolved before Step 2 can be marked complete.

---

## Positive Observations

1. **Clean separation of concerns** — `config.ts`, `errors.ts`, `types.ts`, and `kagi-client.ts` are well-structured with clear responsibilities.
2. **Good DI for testing** — `KagiClient` constructor accepts `KagiConfig` and `RetryConfig`, making tests fast and deterministic without env-var manipulation.
3. **`fastRetry` test config** — Smart use of `RetryConfig` with 1ms backoff for fast test execution.
4. **Comprehensive `statusToUserMessage()`** — Actionable error messages for 401 (set KAGI_API_KEY), 402 (billing URL), 403 (closed beta), 429 (rate limit).
5. **`validateConfig()` dual-mode** — `resolveConfig()` (throws) for tool calls, `validateConfig()` (returns result) for session_start. Clean API.
6. **Response normalization** — Null snippet → `""`, type discriminator mapping, `api_balance` → `apiBalance` camelCase.
7. **`toResponse()` on error classes** — Consistent `KagiErrorResponse` interface for tool output.
8. **Test coverage** — 66 passing tests with good breadth across config, errors, and client.

---

## Discoveries to Log

| # | Discovery | Disposition | Location |
|---|-----------|-------------|----------|
| D1 | `smallweb()` mutates `this.baseUrl` for v1 API path — concurrency-unsafe | 🔴 Must fix | `kagi-client.ts:168-181` |
| D2 | Retry logic only retries 429, not 5xx, contradicting `isRetryableStatus()` contract | 🔴 Must fix | `kagi-client.ts:107-110` |
| D3 | `clearTimeout()` not called on error paths in `request()` | 🟡 Should fix | `kagi-client.ts:101-105` |
| D4 | No common `KagiError` base class across error hierarchy | 🟡 Should fix | `errors.ts`, `config.ts` |
| D5 | `smallweb()` URL derived via fragile `string.replace("/api/v0", "/api/v1")` | 🟡 Should fix | `kagi-client.ts:169` |
| D6 | `normalizeSearchItem` silently treats unknown `t` values as `result` type | 🟡 Should fix | `kagi-client.ts:32-40` |
| D7 | Network error detection uses `err.message.includes("fetch")` heuristic | 🟡 Should fix — make retry more generous | `kagi-client.ts:122-129` |
| D8 | No response shape validation (`meta` field check) for v0 beta API | 🟢 Nice to have | `kagi-client.ts:116` |

---

## Verdict

**🟡 APPROVE WITH CONDITIONS**

Step 2 has a solid implementation foundation, but two critical issues from R002 remain unfixed. These MUST be resolved before marking Step 2 complete:

1. **🔴 [MUST]** `smallweb()` must NOT mutate `this.baseUrl`. Add a `baseUrl` override parameter to `request()` and define `KAGI_SMALLWEB_BASE_URL` as a separate constant in `config.ts`. This eliminates both the concurrency bug and the fragile string replacement.

2. **🔴 [MUST]** Retry logic must use `isRetryableStatus()` instead of the hardcoded `429` check. This makes 5xx errors retryable as documented. Add a test for 5xx retry after the fix.

3. **🟡 [SHOULD]** Add `clearTimeout` in a try/finally block in `request()`.

4. **🟡 [SHOULD]** Introduce `KagiError` base class and make all error subclasses extend it.

5. **🟡 [SHOULD]** Add defensive handling for unknown `t` values in `normalizeSearchItem`.

6. **🟡 [SHOULD]** Make network error retry logic more generous — retry any non-KagiApiError, non-TimeoutError.

7. **🟢 [NICE]** Add basic response shape validation (check for `meta` field).

8. **🟢 [NICE]** Add `Content-Type` header test for POST vs GET requests.
