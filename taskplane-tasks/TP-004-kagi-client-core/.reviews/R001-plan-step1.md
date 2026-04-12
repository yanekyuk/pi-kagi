# R001: Plan Review — Step 1 (Project Structure + Config Contract)

**Reviewer:** automated code review
**Step:** Step 1: Project structure + config contract
**Date:** 2026-04-12
**Verdict:** 🟡 Approve with conditions

---

## Summary

Step 1 sets up the `src/` directory structure, implements `config.ts` (API key resolution) and `errors.ts` (KagiError class), updates the entry point, and adds test infrastructure. The plan is sound in scope, but has several alignment and design issues that should be addressed before or during implementation.

---

## Checklist Evaluation

| # | Item | Assessment |
|---|------|------------|
| 1 | Create `src/` directory structure | ⚠️ See Issue 1 — entry point conflict |
| 2 | Add package.json scripts for testing | ✅ Straightforward |
| 3 | Implement `src/config.ts` with API key resolver | ⚠️ See Issues 3, 4, 5 |
| 4 | Implement `src/errors.ts` with KagiError | ⚠️ See Issue 6 |
| 5 | Update `index.ts` entry point for config on session_start | ⚠️ See Issue 3 |
| 6 | Install test runner dependency | ✅ bun test is built-in, no install needed |

---

## Issues

### 🔴 Issue 1: Entry point location conflict

**Severity:** High — Will prevent extension from loading

**Problem:** The PROMPT.md file scope lists `src/index.ts`, but pi's extension auto-discovery expects `index.ts` at the **root** of the extension directory (`.pi/extensions/pi-kagi/index.ts`). The current `package.json` already declares `"pi": { "extensions": ["./index.ts"] }` pointing to the root.

The pi documentation is explicit:
> **Directory with index.ts** — for multi-file extensions:
> ```
> ~/.pi/agent/extensions/
> └── my-extension/
>     ├── index.ts        # Entry point (exports default function)
>     ├── tools.ts        # Helper module
>     └── utils.ts        # Helper module
> ```

**Resolution:** `index.ts` MUST remain at `.pi/extensions/pi-kagi/index.ts`. Module implementations go in `src/`. The entry point imports from `./src/config.ts`, `./src/kagi-client.ts`, etc. Do NOT move `index.ts` into `src/`.

The PROMPT.md file scope item `src/index.ts` should be interpreted as the main implementation module—NOT the pi entry point. The root `index.ts` is the thin pi-facing entry point that re-exports and wires things together.

---

### 🟡 Issue 2: Architecture doc layout mismatch

**Severity:** Medium — Needs documentation alignment

**Problem:** `docs/pi-kagi-architecture.md` (Section 1) defines a **flat layout**:
```
client.ts, types.ts, tools/, routing.ts, utils.ts
```
All at the extension root. But the PROMPT.md specifies `src/config.ts`, `src/types.ts`, `src/kagi-client.ts`, `src/errors.ts` — a `src/` subdirectory layout.

**Resolution:** The PROMPT.md task spec takes precedence (it's the task under execution). Use the `src/` layout. The architecture doc should be updated in a later documentation step (Step 5) to reflect the actual layout. Add a discovery noting this discrepancy so it's tracked.

---

### 🟡 Issue 3: Config resolution should be lazy, not throw at session_start

**Severity:** Medium — UX risk

**Problem:** The architecture doc says:
```
// 3. Throw helpful error at session_start
```

Throwing at `session_start` would crash the extension load and prevent pi from registering ANY tools. If the API key isn't configured, the user would see a broken extension with no feedback mechanism (since `session_start` is the very first event).

Additionally, there is **no pi configuration API for custom extension settings** — the `settings.json` and `pi-coding-agent` docs show no mechanism for extensions to read custom config values. The "priority 2: pi configuration" path is not implementable with current APIs.

**Resolution:**

1. **Config resolution should be lazy** — resolve it when a tool calls the client, not at `session_start`.
2. **`session_start` should notify**, not throw:
   ```typescript
   // session_start handler:
   const key = resolveApiKey();
   if (!key) {
     ctx.ui.notify(
       "pi-kagi: KAGI_API_KEY not set. Set it to enable Kagi API tools.",
       "warning"
     );
   }
   ```
3. **Tool execution should throw with a clear message** when the key is missing — this is the right place for a hard error because the LLM can see the error and communicate it to the user.
4. Drop "pi configuration" as a config priority level — it's not implementable. The resolution order becomes:
   - `KAGI_API_KEY` environment variable
   - (Future: pi extension config, if added later)
   - Throw `KagiConfigError` when a tool is invoked without a key

---

### 🟡 Issue 4: `config.ts` should export both a resolver and a validated getter

**Severity:** Medium — API design

**Problem:** The plan says "Implement config loader for Kagi API key and base URL" but doesn't specify the API contract. Downstream consumers (the client, tests) need different access patterns:
- The client needs a guaranteed `string` (or throw)
- `session_start` needs a nullable check (to warn, not crash)
- Tests need to inject values

**Resolution:** `config.ts` should export:

```typescript
// Config resolution — returns undefined if key is missing (no throw)
export function resolveApiKey(): string | undefined;

// Validated getter — throws KagiConfigError if key is missing
export function requireApiKey(): string;

// Base URL (defaulting to https://kagi.com/api/v0)
// Future: allow override for testing
export function getBaseUrl(): string;

// Config error class
export class KagiConfigError extends Error { ... }
```

This lets `session_start` call `resolveApiKey()` for the warning, and tool `execute()` calls `requireApiKey()` for the hard error. Tests can inject via `process.env.KAGI_API_KEY` or by exposing a setter for DI.

---

### 🟢 Issue 5: Base URL default should support the Small Web v1 difference

**Severity:** Low (Step 2 concern) — But affects config contract now

**Problem:** The capability map notes: "Small Web uses `/api/v1` (not `/api/v0)". The config's `getBaseUrl()` returns `https://kagi.com/api/v0` by default, but the Small Web endpoint needs `https://kagi.com/api/v1`.

**Resolution:** The config should support this at the contract level now, even if implementation is Step 2:

```typescript
export function getBaseUrl(endpoint?: "search" | "enrich" | "fastgpt" | "summarize" | "smallweb"): string;
// For smallweb: returns https://kagi.com/api/v1
// For everything else: returns https://kagi.com/api/v0
```

OR (simpler): just define the default URL and let the Small Web tool override it per-call. The simpler approach is recommended — define the default constant, and the Small Web tool passes a different base URL. Decide now to avoid rework.

**Recommendation:** Keep it simple. Export `KAGI_API_BASE_URL = "https://kagi.com/api/v0"` and `KAGI_SMALLWEB_BASE_URL = "https://kagi.com/api/v1"`. The client handles endpoint-to-URL mapping.

---

### 🟡 Issue 6: KagiError should be an Error subclass, not just an interface

**Severity:** Medium — Affects error handling ergonomics

**Problem:** The architecture defines `KagiError` as an interface:
```typescript
interface KagiError {
  status: number;
  message: string;
  retryable: boolean;
}
```

This works as a type, but JavaScript error handling relies on `instanceof`, `Error.prototype.stack`, and `.name`. A plain interface can't be caught with `instanceof` and has no stack trace.

**Resolution:** Define `KagiError` as an `Error` subclass:

```typescript
export class KagiError extends Error {
  override readonly name = "KagiError";
  readonly status: number;
  readonly retryable: boolean;

  constructor(status: number, message: string, retryable: boolean) {
    super(message);
    this.status = status;
    this.retryable = retryable;
  }
}

// Also define KagiConfigError for missing/invalid config
export class KagiConfigError extends KagiError {
  override readonly name = "KagiConfigError";
  constructor(message: string) {
    super(0, message, false);
  }
}
```

This gives:
- `instanceof KagiError` / `instanceof KagiConfigError` checks in catch blocks
- Proper `.stack` traces
- Downstream tools can distinguish config errors from API errors
- The `status` and `retryable` fields match the architecture's interface contract

---

### 🟢 Issue 7: Step 1 should set up the test directory structure even though tests are Step 3

**Severity:** Low — Housekeeping

**Problem:** The file scope includes `tests/client.test.ts` but Step 1 only adds test scripts to `package.json`. If the `tests/` directory doesn't exist, early test commands fail with confusing path errors.

**Resolution:** Create `tests/` directory and a minimal smoke test (e.g., `tests/config.test.ts`) that validates config resolution. This proves the test infrastructure works and provides an early sanity check. The empty/placeholder test can be:

```typescript
import { describe, test, expect } from "bun:test";
// Will be populated in Step 3
```

---

### 🟢 Issue 8: `package.json` needs `scripts` section

**Severity:** Low — Obvious but worth calling out

The taskplane config says:
```json
"testing": {
  "commands": {
    "test": "bun test",
    "test:target": "bun test {path}"
  }
}
```

The current `package.json` has no `scripts` section. Add:

```json
"scripts": {
  "test": "bun test"
}
```

This allows both `npm --prefix .pi/extensions/pi-kagi test` and `bun test` to work.

---

## Recommended File Layout After Step 1

```
.pi/extensions/pi-kagi/
├── package.json          # Updated with scripts.test
├── index.ts              # Pi entry point — imports from src/, wires session_start
├── README.md             # Existing (updated in Step 5)
├── src/
│   ├── config.ts         # resolveApiKey(), requireApiKey(), getBaseUrl(), KagiConfigError
│   ├── errors.ts         # KagiError class (extends Error)
│   ├── types.ts          # (Optional) Minimal — just KagiMeta for now, or empty placeholder
│   └── kagi-client.ts    # (Optional) Empty placeholder for Step 2
└── tests/
    └── config.test.ts    # Minimal smoke test validating config resolution
```

---

## Discoveries to Log

| # | Discovery | Disposition |
|---|-----------|-------------|
| D1 | Architecture doc shows flat layout; PROMPT.md specifies `src/` layout | Use `src/` per PROMPT.md; update architecture doc in Step 5 |
| D2 | No pi extension config API available for custom settings | Drop "pi configuration" as config priority; use env var only |
| D3 | Small Web uses `/api/v1` vs `/api/v0` for all other endpoints | Define both URL constants in config |
| D4 | `index.ts` must stay at extension root (pi auto-discovery requirement) | Keep entry point at root; implementation in `src/` |

---

## Verdict

**🟡 APPROVE WITH CONDITIONS**

Step 1 can proceed, but must address:
1. **🔴 [MUST]** `index.ts` stays at the extension root — do NOT move to `src/`. The root `index.ts` imports from `./src/*`.
2. **🟡 [SHOULD]** Config resolution must be lazy (not crash at `session_start`). Use `resolveApiKey()` (nullable) for session_start warnings, `requireApiKey()` (throws) for tool calls. Drop "pi configuration" as unimplementable.
3. **🟡 [SHOULD]** `KagiError` must be an `Error` subclass, not just an interface. Include `KagiConfigError` as a subclass.
4. **🟢 [NICE]** Create `tests/` directory and a smoke test for config resolution.
5. **🟢 [NICE]** Add both base URL constants (`/api/v0` and `/api/v1`) in config from the start.
