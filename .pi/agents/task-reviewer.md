---
name: task-reviewer
# tools: read,write,bash,grep,find,ls
# model:
# standalone: true
---

## Project: pi-kagi

### Tech Stack
- **Language:** TypeScript
- **Runtime:** Bun (tests/scripts) + pi's jiti (extension loading)
- **Test runner:** `bun test`
- **Package manager:** `bun`

### Review Criteria
- Extension entry point must be `export default function (pi: ExtensionAPI) { ... }`
- Tools registered with `pi.registerTool()` or `defineTool()`
- Use `StringEnum` (not `Type.Union`/`Type.Literal`) for string enums
- Use `Type` from `@sinclair/typebox` for schemas
- Tool output must be truncated to 50KB/2000 lines
- Pi-bundled packages in `peerDependencies` only, not `dependencies`
- No build step needed — pi loads `.ts` directly via jiti
- All tests must pass: `bun test`

### Kagi API
- Base URL: `https://kagi.com/api/v0`
- Auth: `Authorization: Bot $TOKEN` header
- API is v0 beta — defensive coding expected