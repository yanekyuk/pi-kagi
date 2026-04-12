# R002: Plan Review — Step 2 (Implement Core Client)

**Reviewer:** automated code review  
**Step:** Step 2: Implement core client  
**Date:** 2026-04-12  
**Verdict:** 🟡 Approve with conditions  

---

## Summary

Step 2 implements the `KagiClient` class with an authenticated request helper, six typed endpoint methods, and the error mapping hierarchy. The implementation is largely well-structured and aligns with the architecture contract. However, there are **two must-fix concurrency/correctness issues** and several should-fix items that should be addressed before marking this step complete.

---

## Checklist Evaluation

| # | Step 2 Deliverable | Assessment |
|---|-------------------|------------|
| 1 | Authenticated request helper with `Authorization: Bot <TOKEN>` header | ⚠️ See Issues 1, 2, 3 |
| 2 | Typed raw endpoint methods (search, enrichWeb, enrichNews, fastgpt, summarize, smallweb) | ⚠️ See Issues 4, 5, 6 |
| 3 | Normalized error mapping (HTTP status, API error payload, network failure, timeout) | ⚠️ See Issues 7, 8 |

---

## Issues

### 🔴 Issue 1: `smallweb()` mutates `this.baseUrl` — concurrency-unsafe

**Severity:** High — Data race in concurrent usage

**Problem:** The `smallweb()` method temporarily swaps `this.baseUrl` to use `/api/v1` and restores it in a `finally` block:

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

If two concurrent calls to `smallweb()` (or `smallweb()` + `search()`) overlap, the shared `this.baseUrl` will be mutated by one call while the other is using it — a classic data race. Even though JavaScript is single-threaded in the event loop, `await` points introduce interleaving. Between the `this.baseUrl = smallWebBaseUrl` assignment and the `finally { this.baseUrl = originalBaseUrl }`, other asynchronous operations can run and observe the wrong base URL.

**Resolution:** The `request()` method should accept an optional `baseUrl` override:

```typescript
private async request<T>(
    path: string,
    options: {
        method?: string;
        params?: Record<string, string | number | boolean | undefined>;
        body?: Record<string, unknown>;
        timeout?: number;
        baseUrl?: string;  // Override per-request
    } = {},
): Promise<T> {
    const url = new URL((options.baseUrl ?? this.baseUrl) + path);
    // ...
}
```

Then `smallweb()` simply passes `baseUrl: smallWebBaseUrl` without mutating state:

```typescript
async smallweb(limit?: number): Promise<SmallWebResponse> {
    const smallWebBaseUrl = this.baseUrl.replace("/api/v0", "/api/v1");
    const response = await this.request<unknown>("/smallweb/feed/", {
        params: { limit },
        timeout: TIMEOUTS.default,
        baseUrl: smallWebBaseUrl,
    });
    return normalizeSmallWebResponse(response);
}
```

This eliminates the shared-state mutation entirely.

---

### 🔴 Issue 2: 5xx errors not retried despite `isRetryableStatus()` declaring them retryable

**Severity:** High — Inconsistent contract, breaks fallback behavior

**Problem:** The capability map (Section 4.2) states: "500: Server error — Retry with backoff." The `isRetryableStatus()` function in `errors.ts` correctly returns `true` for 5xx statuses. But the `request()` method only retries on HTTP 429:

```typescript
if (response.status === 429 && attempt < RETRY.maxRetries) {
    const delay = backoffDelay(attempt);
    await sleep(delay);
    continue;
}
```

A 503 Service Unavailable or 500 Internal Server Error will immediately throw `KagiApiError` with `retryable: true`, but the client never actually retries it. This is a contract violation: the error says "retryable" but the client doesn't retry.

**Resolution:** Use `isRetryableStatus()` as the retry condition instead of a hardcoded 429 check:

```typescript
if (isRetryableStatus(response.status) && attempt < RETRY.maxRetries) {
    const delay = backoffDelay(attempt);
    await sleep(delay);
    continue;
}
```

This automatically retries 429 and all 5xx statuses, consistent with the documented error handling policy. Consider adding `RETRY.maxRetriesServerError` (e.g., 2) for 5xx if you want fewer retries for server errors than rate limits.

---

### 🟡 Issue 3: Timeout timer not cleared on error paths — resource leak

**Severity:** Medium — Timer leak in error paths

**Problem:** In the `request()` method, `clearTimeout(timeoutId)` is only reached on the success path. If `fetch()` throws (e.g., network error or AbortError), the timeout is never cleared:

```typescript
const timeoutId = setTimeout(() => controller.abort(), timeout ?? TIMEOUTS.default);
const response = await fetch(url.toString(), { ... });
clearTimeout(timeoutId); // ← never reached on throw
```

While each leaked timer is a no-op (it tries to abort an already-aborted controller), it still holds a reference to the AbortController for the full timeout duration. In a retry loop with long timeouts, this could accumulate unnecessary timer pressure.

**Resolution:** Use try/finally to guarantee cleanup:

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), timeout ?? TIMEOUTS.default);
try {
    const response = await fetch(url.toString(), { ... });
    // ... handle response
} finally {
    clearTimeout(timeoutId);
}
```

This ensures the timer is always cancelled regardless of how the `fetch()` promise resolves.

---

### 🟡 Issue 4: No common `KagiError` base class across error hierarchy

**Severity:** Medium — Affects catch-block ergonomics for downstream tools

**Problem:** The current error hierarchy has no common base beyond `Error`:

- `KagiApiError extends Error`
- `KagiNetworkError extends Error`
- `KagiTimeoutError extends Error`
- `KagiConfigError extends Error` (in config.ts)

R001 specifically recommended a `KagiError` base class. Without it, downstream tool code must catch each error type individually:

```typescript
// Without common base:
catch (err) {
    if (err instanceof KagiApiError || err instanceof KagiNetworkError || 
        err instanceof KagiTimeoutError) { ... }
}

// With common base:
catch (err) {
    if (err instanceof KagiError) { ... }
}
```

**Resolution:** Introduce a common `KagiError` base:

```typescript
export class KagiError extends Error {
    override readonly name = "KagiError";
    constructor(message: string) { super(message); }
}

export class KagiApiError extends KagiError {
    readonly status: number;
    readonly retryable: boolean;
    readonly body?: string;
    // ...
}

export class KagiNetworkError extends KagiError { ... }
export class KagiTimeoutError extends KagiError { ... }
```

And move `KagiConfigError` to also extend `KagiError`. This enables `catch (err) { if (err instanceof KagiError) ... }` — a single catch for all Kagi-related failures.

---

### 🟡 Issue 5: `normalizeSearchItem` silently discards unknown `t` discriminator values

**Severity:** Medium — Reduces defensiveness for v0 beta API

**Problem:** The capability map explicitly warns (Section 4.3): "Always handle unknown `t` values gracefully — the API may add new types." The current implementation defaults any unknown `t` value to the "result" type:

```typescript
function normalizeSearchItem(raw: RawSearchObject): SearchItem {
    if (raw.t === 1) {
        return { type: "related", data: { queries: raw.list } };
    }
    // t === 0 (default / search result)
    return { type: "result", data: { ... } };
}
```

If the API adds `t === 2` (e.g., "video result"), it will be silently treated as a regular search result, potentially with missing required fields. The `RawSearchObject` union type (`RawSearchResult | RawRelatedSearches`) also can't represent new types, so TypeScript won't help here.

**Resolution:** At minimum, add a `console.warn` for unknown types and consider a third union member:

```typescript
// In types.ts:
export type SearchItem =
    | { type: "result"; data: SearchResult }
    | { type: "related"; data: RelatedSearches }
    | { type: "unknown"; data: Record<string, unknown> };  // Defensive

// In kagi-client.ts:
function normalizeSearchItem(raw: RawSearchObject): SearchItem {
    if (raw.t === 1) return { type: "related", data: { queries: (raw as any).list } };
    if (raw.t === 0) return { type: "result", data: { ... } };
    console.warn(`pi-kagi: unknown search item type t=${raw.t}, treating as unknown`);
    return { type: "unknown", data: raw as Record<string, unknown> };
}
```

The `unknown` variant lets downstream tools skip or log items they don't understand, rather than producing malformed results.

---

### 🟡 Issue 6: Network error detection relies on fragile runtime-specific heuristics

**Severity:** Medium — May silently swallow or misclassify errors

**Problem:** The retry logic for network errors detects them with:

```typescript
if (err instanceof TypeError && err.message.includes("fetch")) {
    // network error — retryable
}
```

This is fragile because:
1. In Bun, a failed DNS lookup throws `TypeError` with message `"fetch failed"`, but other runtimes may throw differently.
2. `err.message.includes("fetch")` is a string-match heuristic that could match non-network TypeErrors.
3. Any other error type (e.g., `AggregateError` from Bun's HTTP client) falls through to the catch-all `KagiNetworkError` wrapper, which is fine, but the.retry behavior differs.

**Resolution:** Make the retry logic more generous — retry any non-KagiApiError, non-timeout error up to `RETRY.maxRetries` for network-type failures:

```typescript
} catch (err) {
    if (err instanceof KagiApiError) throw err;
    if (err instanceof KagiTimeoutError) throw err;
    
    // Network/unknown errors are retryable
    lastError = new KagiNetworkError(
        `Network error connecting to ${path}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err : undefined,
    );
    if (attempt < RETRY.maxRetries) {
        await sleep(backoffDelay(attempt));
        continue;
    }
    throw lastError;
}
```

This ensures all network failures get retried regardless of the specific error class.

---

### 🟡 Issue 7: `smallweb()` URL construction via string replacement is fragile

**Severity:** Medium — Breaks with custom base URLs

**Problem:** The Small Web URL is derived by string replacement:

```typescript
const smallWebBaseUrl = this.baseUrl.replace("/api/v0", "/api/v1");
```

If a user sets `KAGI_API_BASE_URL` to `https://staging.kagi.com/api/v0`, this works. But if they set it to `https://kagi.com/custom-proxy` (no `/api/v0` substring), `replace()` returns the original string unchanged, silently routing Small Web requests to the v0 endpoint.

**Resolution:** Define both base URLs as constants in `config.ts` (as R001 recommended):

```typescript
export const KAGI_API_BASE_URL = "https://kagi.com/api/v0";
export const KAGI_SMALLWEB_BASE_URL = "https://kagi.com/api/v1";
```

Then in the client, construct the Small Web URL directly from the constant, with an env-var override:

```typescript
// In config.ts:
export interface KagiConfig {
    apiKey: string;
    baseUrl: string;
    smallWebBaseUrl: string;
}

// In resolveConfig():
return {
    apiKey,
    baseUrl: process.env.KAGI_API_BASE_URL?.trim() || KAGI_API_BASE_URL,
    smallWebBaseUrl: process.env.KAGI_SMALLWEB_BASE_URL?.trim() || KAGI_SMALLWEB_BASE_URL,
};
```

And `smallweb()` uses `this.smallWebBaseUrl` directly — no string replacement needed.

---

### 🟢 Issue 8: No basic response shape validation for v0 beta API

**Severity:** Low — Risk of silent type mismatches

**Problem:** The `request()` method parses JSON and immediately casts with `as T`:

```typescript
const data = await response.json();
return data as T;
```

For a v0 beta API where response shapes may change, there's no structural validation. If the API returns an unexpected shape (e.g., missing `meta` or `data` fields), the error manifests as runtime type errors deep in endpoint methods rather than at the parsing boundary.

**Resolution:** Consider adding a lightweight validation in `request()`:

```typescript
const data = await response.json();
if (!data || typeof data !== "object" || !("meta" in data)) {
    throw new KagiApiError(
        response.status,
        `Unexpected API response format: missing 'meta' field`,
        JSON.stringify(data).slice(0, 200),
    );
}
return data as T;
```

This catches malformed responses early with a helpful error, without requiring a full schema validation library.

---

### 🟢 Issue 9: `summarize()` params don't validate `url`/`text` mutual exclusivity

**Severity:** Low — Deferred to tool layer is acceptable

**Problem:** The Kagi API requires `url` and `text` to be mutually exclusive. The current `summarize()` method passes both through to the API:

```typescript
if (params.url !== undefined) body.url = params.url;
if (params.text !== undefined) body.text = params.text;
```

If both are provided, the API will return an error. A defensive check would save a round-trip.

**Resolution:** Adding a runtime check in `summarize()` is a nice defensive measure for a v0 API, but this can also be enforced at the tool layer (TP-006). Either location is acceptable. If deferring, add a comment noting the assumption.

---

### 🟢 Issue 10: `request()` is private — limits testability

**Severity:** Low — Test strategy concern

**Problem:** The `request()` method is `private`, making it impossible to spy/mock in unit tests without reaching into private internals. The Step 3 scope includes "Add tests for request construction and response/error mapping."

**Resolution:** Consider one of:
1. Change `request()` to `protected` — allows subclass-based test doubles.
2. Accept a custom `fetch` function in the constructor (dependency injection) — most testable.
3. Use Bun's module mocking (`bun:test` `mock.module`) to mock `globalThis.fetch`.

Option 3 (module mocking) is simplest and doesn't require API changes. Just note this in Step 3 planning.

---

## Alignment with R001 Recommendations

| R001 Rec | Status | Notes |
|----------|--------|-------|
| `index.ts` stays at root, imports from `src/` | ✅ Done | `index.ts` at root, re-exports from `./src/*` |
| Config resolution should be lazy, not crash at `session_start` | ✅ Done | `validateConfig()` for warnings, `resolveConfig()` for hard errors |
| Provide both `resolveApiKey()` (nullable) and `requireApiKey()` (throw) | ⚠️ Partial | Uses `resolveConfig()` (throws) and `validateConfig()` (returns result); no nullable resolver |
| `KagiError` as Error subclass with common base | ❌ Not done | Four separate Error subclasses, no common `KagiError` base |
| Create `tests/` directory with smoke test | ❌ Not done | No tests directory yet (planned for Step 3) |
| Define both base URL constants | ❌ Not done | Only `KAGI_API_BASE_URL`; Small Web URL derived via string replacement |

---

## Discoveries to Log

| # | Discovery | Disposition | Location |
|---|-----------|-------------|----------|
| D1 | `smallweb()` mutates `this.baseUrl` for v1 path — concurrency-unsafe | 🔴 Must fix before Step 2 complete | `kagi-client.ts:147-163` |
| D2 | `isRetryableStatus()` says 5xx is retryable, but client only retries 429 | 🔴 Must fix — contract violation | `kagi-client.ts` vs `errors.ts` |
| D3 | No common `KagiError` base class across error hierarchy | 🟡 Should fix for downstream ergonomics | `errors.ts`, `config.ts` |
| D4 | Timeout timer not cleared on error paths in `request()` | 🟡 Should fix — resource hygiene | `kagi-client.ts` |
| D5 | Small Web URL relies on string replacement of `/api/v0` → `/api/v1` | 🟡 Should fix — fragile with custom base URLs | `kagi-client.ts`, `config.ts` |
| D6 | `normalizeSearchItem` silently treats unknown `t` values as `result` | 🟡 Should add defensive handling | `kagi-client.ts:24` |

---

## Verdict

**🟡 APPROVE WITH CONDITIONS**

Step 2 can proceed to completion, but must address:

1. **🔴 [MUST]** `smallweb()` must NOT mutate `this.baseUrl`. Add a `baseUrl` override parameter to `request()` and pass the v1 URL per-call.
2. **🔴 [MUST]** Retry logic must honor `isRetryableStatus()` — retry both 429 and 5xx, not just 429. This fixes a contract inconsistency between `errors.ts` and `kagi-client.ts`.
3. **🟡 [SHOULD]** Introduce a common `KagiError` base class so downstream tools can catch all Kagi errors with a single `instanceof` check.
4. **🟡 [SHOULD]** Clear timeout timers in all code paths using try/finally.
5. **🟡 [SHOULD]** Define `KAGI_SMALLWEB_BASE_URL` as a separate constant in `config.ts` instead of string replacement.
6. **🟡 [SHOULD]** Add a defensive handler for unknown `t` values in `normalizeSearchItem` — at minimum, a `console.warn`.
