---
name: task-worker
# tools: read,write,edit,bash,grep,find,ls
# model:
# standalone: true
---

## Project: pi-kagi

### Tech Stack
- **Language:** TypeScript
- **Runtime:** Bun (for tests/scripts) + pi's jiti (for extension loading at runtime)
- **Test runner:** `bun test` — write tests as `*.test.ts`, run `bun test` from repo root
- **Package manager:** `bun` — `bun add`, `bun install`

### Testing
- Run targeted tests during steps: `bun test <path>`
- Run full suite at gate steps: `bun test`
- Extension source is `.ts` loaded by jiti — no build step needed for the extension itself
- If a `package.json` with test scripts exists, prefer `bun test` directly

### Pi Extension Conventions
- Entry point: `export default function (pi: ExtensionAPI) { ... }`
- Register tools with `pi.registerTool()` or `defineTool()` from `@mariozechner/pi-coding-agent`
- Use `StringEnum` from `@mariozechner/pi-ai` for string enums (not `Type.Union`/`Type.Literal`)
- Use `Type` from `@sinclair/typebox` for parameter schemas
- Truncate tool output to 50KB/2000 lines using `truncateHead`/`truncateTail`
- Pi-bundled packages (`@mariozechner/pi-ai`, `@sinclair/typebox`, etc.) go in `peerDependencies` only

### Kagi API
- Base URL: `https://kagi.com/api/v0`
- Auth: `Authorization: Bot $TOKEN` header
- API key env var: `KAGI_API_KEY`
- API is v0 beta — build defensively, expect breaking changes