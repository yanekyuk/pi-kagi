# Plan Review: Step 2 — Scaffold `pi-kagi` Extension

**Reviewer:** Automated plan review  
**Date:** 2026-04-12  
**Task:** TP-002  
**Step:** 2 — Scaffold `pi-kagi` extension  

---

## Verdict: ✅ APPROVE (with observations)

The step plan is well-defined, correctly scoped, and aligned with the PROMPT requirements and the research captured in Step 1. No blocking issues found. A few non-blocking recommendations are noted below.

---

## Checklist Assessment

| Sub-task | Assessment | Notes |
|----------|-----------|-------|
| Create `package.json` with correct metadata & description | ✅ Sound plan | See Observation 1 |
| Create `index.ts` with valid default extension export | ✅ Sound plan | See Observation 2 |
| Add minimal load-proof behavior | ✅ Sound plan | `/kagi-about` command is appropriate |
| Create `README.md` with usage notes & scope | ✅ Sound plan | See Observation 3 |

---

## Observations

### Observation 1: `package.json` should include `"description"` field

The PROMPT requires the description string exactly **"Pi skill for using Kagi API"**. The notes document's `package.json` template shows the correct shape but omits a top-level `"description"` field. Since npm `package.json` convention supports this field and the PROMPT explicitly calls for "extension metadata" including the description, the implementation **should include**:

```json
{
  "name": "pi-kagi",
  "private": true,
  "version": "0.1.0",
  "description": "Pi skill for using Kagi API",
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

The `"description"` field is both a standard npm field and the canonical place for the PROMPT's mandated description string. This makes it machine-discoverable and satisfies the exact-string requirement unambiguously.

**Severity:** Low (advisory). Could also satisfy the requirement via README content alone, but `description` in `package.json` is the single source of truth for extension metadata.

### Observation 2: `index.ts` should prefer `/kagi-about` command over `session_start` notification

The step says *"a `/kagi-about` command or startup status notice."* Of these two options, a registered command is the better choice for the scaffold because:

- Commands are invocable on demand and produce deterministic output — ideal for smoke testing in Step 3.
- `session_start` notifications fire at every session load, which is noisy for a scaffold without API functionality yet.
- A command exercises `pi.registerCommand()`, verifying the `ExtensionAPI` contract end-to-end.

**Recommendation:** Implement `/kagi-about` only. A future step can add `session_start` when real functionality warrants it.

Suggested scaffold body for `index.ts`:

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("kagi-about", {
    description: "Show information about the pi-kagi extension",
    handler: async (_args, ctx) => {
      ctx.ui.notify("pi-kagi v0.1.0 — Pi skill for using Kagi API", "info");
    },
  });
}
```

This is minimal, non-invasive, and proves the extension loads and the `ExtensionAPI` binding works. No tools, no event subscriptions, no state — just the scaffold baseline.

### Observation 3: `README.md` should mark scope as scaffold-only explicitly

The README should clearly state this is a scaffold — no API connectivity, no configuration, no tools yet. Future steps will add:
- Kagi API token configuration
- `kagi_search`, `kagi_fastgpt`, `kagi_summarizer` tools
- Output truncation
- Error handling for v0 beta API

A concise README like:

```markdown
# pi-kagi

Pi skill for using Kagi API.

> **Status:** Scaffold — no tools implemented yet.

## Installation

Project-local extension at `.pi/extensions/pi-kagi/`. Loaded automatically by pi.  
Use `/reload` after changes during development.

## Commands

| Command | Description |
|---------|-------------|
| `/kagi-about` | Show extension version and status |

## Development

No build step needed. TypeScript is loaded directly by pi's jiti runtime.

```bash
# Run tests (when available)
bun test
```
```

### Observation 4: `.gitignore` should account for `node_modules` in extensions

The current `.gitignore` covers `.pi/npm/` (pi's package cache) but not `node_modules` inside `.pi/extensions/`. If `bun install` is ever run inside the extension directory (for third-party deps in future steps), those should be gitignored.

**Recommendation:** Add this line to `.gitignore`:

```
.pi/extensions/*/node_modules/
```

This is not strictly needed for the scaffold (no third-party deps yet), but it's a small proactive step. The PROMPT's "Check If Affected" section for `.gitignore` says "confirm no new ignore rule is needed" — and indeed, one is needed for future-proofing.

**Severity:** Low (can be deferred to Step 4 or a future task, but noted now).

### Observation 5: Version consistency across files

The scaffold will reference version `"0.1.0"` in at least `package.json` and potentially the `/kagi-about` command output. To avoid duplication and drift, consider defining the version in one place (e.g., `package.json`) and importing it or hardcoding a single constant. Since jiti can't easily `import` from `package.json` without a build step, hardcoding the version string in `index.ts` and keeping them in sync manually is acceptable for the scaffold. Just be aware this exists when real tool implementation begins.

**Severity:** Negligible for scaffold; worth noting for future tool implementation.

---

## Alignment with Project Conventions

| Convention | Status |
|-----------|--------|
| Extension entry point: `export default function (pi: ExtensionAPI)` | ✅ Planned correctly |
| `StringEnum` for string enums (not `Type.Union`/`Type.Literal`) | ⬜ N/A for scaffold (no enums yet) |
| `Type` from `@sinclair/typebox` for schemas | ⬜ N/A for scaffold (no tool schemas yet) |
| Output truncation ≤ 50KB / 2000 lines | ⬜ N/A for scaffold (no API calls yet) |
| Pi packages as `peerDependencies` only | ✅ Correctly specified in notes template |
| No build step — jiti loads `.ts` directly | ✅ Planned correctly |
| `bun test` for testing | ✅ Referenced in task |

---

## Summary

Step 2 is well-planned and ready to execute. The three files to create (`package.json`, `index.ts`, `README.md`) are clearly defined, the extension conventions from the research phase are accurately captured, and the chosen minimal behavior (`/kagi-about` command) is appropriate for a scaffold. No blocking issues.

**Action items for the worker:**
1. Include `"description": "Pi skill for using Kagi API"` in `package.json` (top-level field).
2. Implement `/kagi-about` command only (skip `session_start` notification).
3. Mark README as scaffold-only with future scope section.
4. Consider adding `.pi/extensions/*/node_modules/` to `.gitignore` (proactive, low urgency).
