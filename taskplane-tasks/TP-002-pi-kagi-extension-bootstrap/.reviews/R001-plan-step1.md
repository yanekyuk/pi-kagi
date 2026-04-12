# Plan Review R001 — Step 1: Research and Summarize Extension Creation Flow

**Reviewer:** Automated plan review
**Date:** 2026-04-12
**Step:** Step 1 (Research and summarize extension creation flow)
**Verdict:** ✅ Approved with recommendations

---

## Summary

Step 1 is a documentation-only step: extract the extension creation workflow from pi's docs and practical conventions from examples, then write it up as `docs/pi-extension-creation-notes.md`. This is the correct starting point for a greenfield extension project — understand before building.

The plan is sound. The three checkboxes (core workflow, example conventions, notes doc) map cleanly to the available reference material and cover what Step 2 needs. Below are findings and recommendations to strengthen execution.

---

## Findings from Source Review

### 1. `defineTool()` is a real exported API — document the distinction

The project-level guidance mentions both `pi.registerTool()` and `defineTool()`. I confirmed that `defineTool` is exported from `@mariozechner/pi-coding-agent` as a standalone function:

```typescript
export declare function defineTool<TParams extends TSchema, TDetails = unknown, TState = any>(
  tool: ToolDefinition<TParams, TDetails, TState>
): ToolDefinition<TParams, TDetails, TState> & AnyToolDefinition;
```

It's an identity function that preserves type inference. The practical distinction for the notes doc:

- **`pi.registerTool(def)`** — Registers a tool with the runtime immediately. Used in the extension entry point.
- **`defineTool(def)`** — Creates a typed tool definition with full `TParams`/`TDetails`/`TState` inference, useful for defining tools in separate modules. The result can then be passed to `pi.registerTool()`.

**Recommendation:** The notes should explain both patterns and recommend `defineTool` for multi-file extensions (which `pi-kagi` will become) with `pi.registerTool` in the entry point.

### 2. `package.json` manifest field is required — capture the exact shape

The extensions doc and packages doc specify that a directory-based extension needs a `package.json` with a `pi` key. The exact minimal shape for Step 2:

```json
{
  "name": "pi-kagi",
  "description": "Pi skill for using Kagi API",
  "pi": {
    "extensions": ["./index.ts"]
  }
}
```

**Recommendation:** The notes doc should include this exact manifest shape as a template. Missing or incorrect `pi.extensions` will silently prevent auto-discovery.

### 3. Peer dependencies pattern — critical for correct bundling

The packages doc is explicit: pi-bundled packages (`@mariozechner/pi-ai`, `@mariozechner/pi-agent-core`, `@mariozechner/pi-coding-agent`, `@mariozechner/pi-tui`, `@sinclair/typebox`) must be in `peerDependencies` with `"*"` range, NOT in `dependencies`. This ensures jiti resolves them from the pi runtime rather than installing duplicate copies.

**Recommendation:** Include a `peerDependencies` template in the notes. This is a common pitfall that will cause runtime type mismatches if gotten wrong.

### 4. `StringEnum` mandate — highlight as a hard rule

The docs and CONTEXT.md both call this out, but it deserves strong emphasis in the notes: **always use `StringEnum` from `@mariozechner/pi-ai` for string enum parameters, never `Type.Union([Type.Literal(...)])`**. The reason is Google API compatibility — `Type.Union` of `Type.Literal` values does not serialize correctly for Google's Gemini models.

This will matter immediately for Kagi endpoint parameters like `/search` engine type, `/summarize` engine type, etc.

### 5. Tool output truncation — document the 50KB/2000-line rule

The project-level guidance specifies truncating tool output to 50KB/2000 lines. The pi SDK provides `truncateHead`/`truncateTail` from `@mariozechner/pi-coding-agent` for this. The `truncated-tool.ts` example demonstrates the pattern.

**Recommendation:** Include truncation as a standard pattern in the notes, since future Kagi tools (search, summarize) will return potentially large payloads.

### 6. State persistence via `details` — key pattern for future tools

Extensions with state must store it in tool result `details` (not in-memory variables alone), because pi supports session forking and branching. In-memory state is reconstructed from `details` on `session_start`. This is the pattern `pi-kagi` will need for any stateful tools (e.g., usage tracking).

### 7. Extension auto-discovery and `/reload`

Key details for the notes:
- Project-local extensions auto-discovered from `.pi/extensions/*/index.ts`
- Global extensions from `~/.pi/agent/extensions/*/index.ts`
- Auto-discovered extensions support `/reload` for hot-reloading during development
- One-off testing via `pi -e ./path.ts`

### 8. `docs/` gitignore is selective — notes doc will be committed

The `.gitignore ` specifically ignores individual API reference files (`docs/enrich.md`, `docs/fastgpt.md`, etc.) but does NOT blanket-ignore `docs/`. So `docs/pi-extension-creation-notes.md` will be tracked by git. ✅

---

## Recommended Notes Doc Structure

For the `docs/pi-extension-creation-notes.md` output, I suggest this structure to ensure it covers everything Step 2 needs:

```markdown
# Pi Extension Creation Notes

## Quick Reference
- Entry point, auto-discovery paths, `pi.extensions` manifest
- Minimal package.json template (with peerDependencies)

## Key APIs
- `export default function (pi: ExtensionAPI) { ... }`
- `pi.registerTool()` / `defineTool()` distinction
- `pi.registerCommand()` 
- `pi.on("session_start", ...)` for state init
- `pi.exec()` for shell commands
- `ctx.ui.notify()` / `ctx.ui.confirm()` / `ctx.ui.select()`

## Hard Rules
- StringEnum (not Type.Union/Type.Literal)
- peerDependencies with "*" for pi-bundled packages
- Tool output truncation (50KB/2000 lines)
- State persistence via details, not just in-memory

## Development Workflow
- Hot reload with /reload
- One-off testing with pi -e
- TypeScript loaded directly via jiti — no build step

## Project-local vs Global Placement
- .pi/extensions/*/index.ts (project-local)
- ~/.pi/agent/extensions/*/index.ts (global)
```

---

## Verdict

**✅ Approved.** The plan is solid. The three deliverables well-cover what Step 2 needs. Incorporate the above findings into the notes doc to ensure no scaffolding details are missed or incorrectly implemented.

No blockers. No amendments needed to the PROMPT.md — just recommendations for the worker executing this step.
