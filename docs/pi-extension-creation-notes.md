# Pi Extension Creation Notes

**Project:** pi-kagi  
**Created:** 2026-04-12  
**Source:** pi-coding-agent docs (`docs/extensions.md`, `docs/packages.md`) and examples (`examples/extensions/`)

---

## Minimal Extension Creation Workflow

### 1. Placement

Extensions are auto-discovered from two locations:

| Location | Scope | Pattern |
|----------|-------|---------|
| `~/.pi/agent/extensions/*.ts` | Global (all projects) | Single-file extensions |
| `~/.pi/agent/extensions/*/index.ts` | Global (subdirectory) | Multi-file extensions |
| `.pi/extensions/*.ts` | Project-local | Single-file extensions |
| `.pi/extensions/*/index.ts` | Project-local (subdirectory) | Multi-file extensions |

Project-local extensions under `.pi/extensions/` can be hot-reloaded with the `/reload` command in pi.

**pi-kagi uses:** `.pi/extensions/pi-kagi/index.ts` (project-local subdirectory).

### 2. Entry Point Shape

Every extension exports a default function that receives the `ExtensionAPI`:

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // Subscribe to lifecycle events
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Extension loaded!", "info");
  });

  // Register tools
  pi.registerTool({ ... });

  // Register commands
  pi.registerCommand("my-command", { ... });
}
```

No build step needed — pi loads `.ts` files at runtime via [jiti](https://github.com/unjs/jiti).

### 3. Package Manifest

For directory-style extensions, create a `package.json` alongside `index.ts`:

```json
{
  "name": "pi-kagi",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "pi": {
    "extensions": ["./index.ts"]
  },
  "peerDependencies": {
    "@mariozechner/pi-coding-agent": "*",
    "@mariozechner/pi-ai": "*",
    "@sinclair/typebox": "*"
  }
}
```

Key rules:
- `"private": true` — prevents accidental npm publish
- `"type": "module"` — ESM is the standard for pi extensions
- `"pi": { "extensions": [...] }` — tells pi which files to load as extensions
- **Peer dependencies only** for pi-bundled packages — they're available at runtime, don't add to `dependencies`
- Third-party npm packages go in `dependencies`; run `npm install` or `bun install` in the extension directory

### 4. Key APIs

| API | Purpose |
|-----|---------|
| `pi.registerTool()` | Register a tool callable by the LLM |
| `pi.registerCommand()` | Register a `/slash-command` |
| `pi.on()` | Subscribe to lifecycle events |
| `pi.exec()` | Execute shell commands |
| `ctx.ui.notify()` | Show a notification to the user |
| `ctx.ui.confirm()` | Ask the user a yes/no question |
| `ctx.ui.select()` | Present a selection list |
| `ctx.ui.custom()` | Render custom TUI components |
| `ctx.sessionManager.getBranch()` | Access session history |
| `pi.appendEntry()` | Persist state across sessions |

### 5. Tool Registration

Two approaches:

**Inline tool definition:**

```typescript
pi.registerTool({
  name: "kagi_search",
  label: "Kagi Search",
  description: "Search the web using Kagi",
  parameters: Type.Object({
    query: Type.String({ description: "Search query" }),
  }),
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    return {
      content: [{ type: "text", text: "Results here" }],
      details: {},
    };
  },
});
```

**`defineTool()` helper (recommended for complex tools):**

```typescript
import { defineTool, type ExtensionAPI } from "@mariozechner/pi-coding-agent";

const searchTool = defineTool({
  name: "kagi_search",
  label: "Kagi Search",
  description: "Search the web using Kagi",
  parameters: Type.Object({
    query: Type.String({ description: "Search query" }),
  }),
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    return {
      content: [{ type: "text", text: "Results here" }],
      details: {},
    };
  },
});

export default function (pi: ExtensionAPI) {
  pi.registerTool(searchTool);
}
```

### 6. Command Registration

```typescript
pi.registerCommand("kagi-about", {
  description: "Show information about the pi-kagi extension",
  handler: async (args, ctx) => {
    ctx.ui.notify("pi-kagi v0.1.0 — Pi skill for using Kagi API", "info");
  },
});
```

Commands support tab completion via `getArgumentCompletions`:

```typescript
pi.registerCommand("kagi-about", {
  description: "About pi-kagi",
  getArgumentCompletions: (prefix) => {
    // Return completion items or null
    return null;
  },
  handler: async (args, ctx) => { ... },
});
```

---

## Practical Conventions from Examples

### Schema Conventions

- **Use `StringEnum` from `@mariozechner/pi-ai`** for string enums — required for Google API compatibility. Do NOT use `Type.Union([Type.Literal(...)])`.
- **Use `Type` from `@sinclair/typebox`** for all parameter schemas.
- **Always add `{ description: "..." }`** to schema fields — the LLM uses these to decide when to call the tool.

### State Persistence

Store state in tool result `details` for proper forking support:

```typescript
return {
  content: [{ type: "text", text: "Done" }],
  details: { myState: [...] },  // Persisted in session
};
```

Reconstruct on `session_start` by iterating `ctx.sessionManager.getBranch()`.

### Output Truncation

Always truncate tool output to prevent context bloat:

```typescript
import { truncateHead, truncateTail } from "@mariozechner/pi-coding-agent";

// Truncate large outputs
return {
  content: [{ type: "text", text: truncateTail(result, 50000) }],
  details: {},
};
```

Limits: **50KB** / **2000 lines** for tool output.

### Extension Loading & Reloading

- Extensions in auto-discovered locations (`.pi/extensions/`, `~/.pi/agent/extensions/`) are loaded on pi startup.
- Use `/reload` in pi to hot-reload project-local extensions during development.
- Use `pi -e ./path.ts` for quick one-off testing.

### Directory Layout (recommended for pi-kagi)

```
.pi/extensions/pi-kagi/
├── package.json     # Extension manifest + dependencies
├── index.ts         # Entry point: export default function(pi)
├── tools/           # Individual tool definitions (future)
├── README.md        # Extension documentation
└── node_modules/    # After bun install (gitignored)
```

---

## Project Choices for pi-kagi

1. **Placement:** `.pi/extensions/pi-kagi/` — project-local for version control alongside the codebase.
2. **Entry point:** `index.ts` with `export default function(pi: ExtensionAPI)`.
3. **Tool style:** `defineTool()` helper for each Kagi API tool, registered in the main `index.ts`.
4. **Schema style:** `StringEnum` for API endpoint selectors, `Type.Object` for all parameters.
5. **Output truncation:** All Kagi API responses truncated via `truncateTail()`.
6. **Error handling:** Defensive — Kagi API is v0 beta, expect breaking changes. Wrap every API call in try/catch.
7. **No build step:** TypeScript loaded directly by pi's jiti runtime.
8. **Testing:** `bun test` at repository root with `*.test.ts` files.

---

## References

- [pi extensions.md](https://github.com/nickvdp/pi-coding-agent/blob/main/docs/extensions.md) — Full API reference
- [pi packages.md](https://github.com/nickvdp/pi-coding-agent/blob/main/docs/packages.md) — Package sharing
- [examples/extensions/](https://github.com/nickvdp/pi-coding-agent/tree/main/examples/extensions/) — Working implementations
- [Kagi API docs](https://help.kagi.com/kagi/api/overview.html) — v0 beta API reference