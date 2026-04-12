# General — Context

**Last Updated:** 2026-04-12
**Status:** Active
**Next Task ID:** TP-010

---

## Project Overview

**pi-kagi** is a **pi-coding-agent extension** (TypeScript) that integrates
[Kagi's APIs](https://help.kagi.com/kagi/api/overview.html) into the pi agent
as callable tools. It provides "smart web access" — intelligently routing
queries to the best Kagi endpoint for high-quality, citation-backed context.

**Type:** Pi extension (not a skill) — uses `pi.registerTool()` / `defineTool()`
to register structured tools with typed parameters. Runs as TypeScript loaded
by pi's extension runtime (jiti). No build step needed for extension itself.

**Repository:** `pi-kagi` on `main` branch
**Language:** TypeScript
**Runtime:** Bun (for tests and scripts) + pi's jiti (for extension loading)
**Test runner:** `bun test`
**Package manager:** bun
**Status:** Greenfield — no source code yet, 8 tasks will build from scratch

---

## Pi Extension Architecture

pi-kagi lives at `.pi/extensions/pi-kagi/` and exports a default function:

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "kagi_search",
    label: "Kagi Search",
    description: "Search the web using Kagi",
    parameters: Type.Object({ query: Type.String() }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      // ...
    },
  });
}
```

Key APIs used:
- **`pi.registerTool()`** — Register tools the LLM can call
- **`pi.exec()`** — Execute shell commands
- **`pi.on("session_start", ...)`** — Init state on session load
- **`Type` from `@sinclair/typebox`** — Schema definitions for parameters
- **`StringEnum` from `@mariozechner/pi-ai`** — String enums (required for Google compat)

Pi-bundled packages (list in `peerDependencies`, do not bundle):
- `@mariozechner/pi-ai`, `@mariozechner/pi-agent-core`, `@mariozechner/pi-coding-agent`, `@mariozechner/pi-tui`, `@sinclair/typebox`

Extension entry point: `.pi/extensions/pi-kagi/index.ts`
Package manifest: `.pi/extensions/pi-kagi/package.json` (with `pi.extensions` array)

---

## Kagi API Surface (v0 beta)

| Endpoint | Method | Purpose | Pricing |
|----------|--------|---------|---------|
| `/search` | GET | Premium search results | $25/1000 queries |
| `/fastgpt` | POST | LLM-generated answers w/ search | Per-query credits |
| `/summarize` | GET/POST | Summarize any URL/text/document | Per-use credits |
| `/enrich/web` | GET | Non-commercial web results (Teclis index) | Per-query |
| `/enrich/news` | GET | Non-commercial news results | Per-query |
| Small Web RSS | GET | Kagi Small Web feed | Free |

**Base URL:** `https://kagi.com/api/v0`
**Auth:** `Authorization: Bot $TOKEN` header
**API key env var:** `KAGI_API_KEY` (or pi config)
**API is v0 beta** — build defensively, expect breaking changes.

Reference docs are in `docs/` (gitignored — fetched reference material).

---

## Task Dependency Chain

```
TP-002 (Bootstrap) ──► TP-003 (API Map) ──► TP-004 (Core Client) ──┬──► TP-005 (Search/Enrich/SmallWeb) ──┬──► TP-007 (Smart Orchestrator) ──┬──► TP-009 (Hardening)
                                                                      └──► TP-006 (FastGPT/Summarizer) ─────┤                                   │
                                                                                                            └──► TP-008 (Usage/Cost Tracking) ─┘
```

Maximum parallelism: **2 lanes** (TP-005 ‖ TP-006, TP-007 ‖ TP-008)

---

## Current State

- ✅ Taskplane configured and 8 tasks staged
- ✅ Kagi API reference docs in `docs/` (gitignored)
- ✅ README and LICENSE committed
- ❌ No source code yet — starts with TP-002
- ❌ No tests, no build, no package.json yet

---

## Key Files

| Category | Path |
|----------|------|
| Tasks | `taskplane-tasks/` |
| Context | `taskplane-tasks/CONTEXT.md` |
| Config | `.pi/taskplane-config.json` |
| Agent templates | `.pi/agents/` |
| API reference | `docs/*.md` (gitignored) |
| Extension scaffold | `.pi/extensions/pi-kagi/` (created by TP-002) |

---

## Conventions

- **Extension entry point:** `.pi/extensions/pi-kagi/index.ts` with `export default function(pi: ExtensionAPI)`
- **Package manifest:** `.pi/extensions/pi-kagi/package.json` with `"pi": { "extensions": ["./index.ts"] }`
- **Description string:** `Pi skill for using Kagi API`
- **Kagi API base URL:** `https://kagi.com/api/v0`
- **API key:** `KAGI_API_KEY` env var or pi config
- **Use `StringEnum`** (not `Type.Union`/`Type.Literal`) for string enums
- **Truncate tool output** to 50KB / 2000 lines (use `truncateHead`/`truncateTail` from pi-coding-agent)
- **Kagi API is v0 beta** — build defensively, expect breaking changes
- **Git commits:** Follow Taskplane conventions (step-level commits with task ID prefixes)
- **No build step needed** — pi loads `.ts` extensions at runtime via jiti
- **Peer dependencies only** — pi-bundled packages are available at runtime, don't bundle them
- **Test runner:** `bun test` — write tests in `*.test.ts` files, run with `bun test`
- **Package manager:** `bun` — use `bun add` for dependencies, `bun install` for installs

---

## Technical Debt / Future Work

_Items discovered during task execution are logged here by agents._