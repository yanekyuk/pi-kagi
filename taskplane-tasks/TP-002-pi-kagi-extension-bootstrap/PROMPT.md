# Task: TP-002 - Bootstrap `pi-kagi` Extension and Capture Extension Authoring Notes

**Created:** 2026-04-12
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** This task creates a new project-local extension scaffold and documentation notes, but does not modify runtime-critical orchestrator internals. The main risk is getting extension conventions wrong, so plan review is appropriate.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Canonical Task Folder

```
taskplane-tasks/TP-002-pi-kagi-extension-bootstrap/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Research and document how pi-coding-agent extensions are created, then scaffold a new project-local extension named `pi-kagi`. The extension scaffold must include metadata with the description exactly: **"Pi skill for using Kagi API"** so this repository has a clear baseline for future Kagi tool implementation.

## Dependencies

- **None**

## Context to Read First

> Only load what is needed.

**Tier 2 (area context):**
- `taskplane-tasks/CONTEXT.md`

**Tier 3 (load only if needed):**
- `/home/yanek/.bun/install/global/node_modules/@mariozechner/pi-coding-agent/docs/extensions.md` — authoritative extension API and lifecycle docs
- `/home/yanek/.bun/install/global/node_modules/@mariozechner/pi-coding-agent/examples/extensions/README.md` — practical examples and patterns
- `/home/yanek/.bun/install/global/node_modules/@mariozechner/pi-coding-agent/docs/packages.md` — package metadata and pi package conventions

## Environment

- **Workspace:** repository root (`/home/yanek/Projects/pi-kagi`)
- **Services required:** None

## File Scope

- `.pi/extensions/pi-kagi/index.ts`
- `.pi/extensions/pi-kagi/package.json`
- `.pi/extensions/pi-kagi/README.md`
- `docs/pi-extension-creation-notes.md`

## Steps

### Step 0: Preflight

- [ ] Confirm task folder structure exists and writable
- [ ] Confirm project-local extension auto-discovery target path exists or create it (`.pi/extensions/`)
- [ ] Confirm requested description string is captured exactly: `Pi skill for using Kagi API`

**Artifacts:**
- `.pi/extensions/` (new or verified)

### Step 1: Research and summarize extension creation flow

- [ ] Extract the minimal extension creation workflow from pi docs (placement, entrypoint shape, key APIs)
- [ ] Capture practical conventions from examples (extension layout, commands/tools pattern, reload workflow)
- [ ] Write concise implementation notes for this repo in `docs/pi-extension-creation-notes.md`

**Artifacts:**
- `docs/pi-extension-creation-notes.md` (new)

### Step 2: Scaffold `pi-kagi` extension

- [ ] Create `.pi/extensions/pi-kagi/package.json` with extension metadata and description exactly `Pi skill for using Kagi API`
- [ ] Create `.pi/extensions/pi-kagi/index.ts` with a valid default extension export (`export default function (pi: ExtensionAPI) { ... }`)
- [ ] Add a tiny non-invasive behavior (e.g., a `/kagi-about` command or startup status notice) to prove the extension loads
- [ ] Create `.pi/extensions/pi-kagi/README.md` with usage notes and current scope (scaffold only, API calls to follow)

**Artifacts:**
- `.pi/extensions/pi-kagi/package.json` (new)
- `.pi/extensions/pi-kagi/index.ts` (new)
- `.pi/extensions/pi-kagi/README.md` (new)

### Step 3: Testing & Verification

> Use lightweight validation suitable for a scaffold-only repo.

- [ ] Verify TypeScript extension file is syntactically valid and imports resolve
- [ ] Smoke test extension loading with a non-destructive command path (prefer extension command execution over model-dependent prompts)
- [ ] Record what command(s) were run and observed result in `STATUS.md`

### Step 4: Documentation & Delivery

- [ ] Ensure notes doc reflects the actual scaffold created
- [ ] Ensure README and package metadata both contain the intended extension identity (`pi-kagi`) and description string
- [ ] Log discoveries/limitations (if any) in `STATUS.md`

## Documentation Requirements

**Must Update:**
- `docs/pi-extension-creation-notes.md` — summary of extension authoring workflow and project choices
- `.pi/extensions/pi-kagi/README.md` — local usage and extension purpose

**Check If Affected:**
- `.pi/taskplane-config.json` — no change expected, but confirm task area/workflow assumptions remain valid
- `.gitignore` — confirm no new ignore rule is needed for extension scaffold files

## Completion Criteria

- [ ] Extension scaffold exists at `.pi/extensions/pi-kagi/`
- [ ] `package.json` contains description exactly `Pi skill for using Kagi API`
- [ ] Notes doc created with accurate, actionable extension setup guidance
- [ ] Smoke validation completed and logged

## Git Commit Convention

Commits happen at **step boundaries**. Include task ID in all messages:

- **Step completion:** `feat(TP-002): complete Step N — description`
- **Bug fixes:** `fix(TP-002): description`
- **Docs:** `docs(TP-002): description`
- **Hydration:** `hydrate: TP-002 expand Step N checkboxes`

## Do NOT

- Implement full Kagi API client behavior in this task (scaffold only)
- Add unrelated tooling/framework changes
- Modify Taskplane orchestrator config schema
- Commit without `TP-002` in the commit message

---

## Amendments (Added During Execution)

<!-- Workers add amendments here if issues discovered during execution.
     Format:
     ### Amendment N — YYYY-MM-DD HH:MM
     **Issue:** [what was wrong]
     **Resolution:** [what was changed] -->
