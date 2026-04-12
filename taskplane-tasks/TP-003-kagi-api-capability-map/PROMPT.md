# Task: TP-003 - Build Kagi API Capability Map for pi-kagi

**Created:** 2026-04-12
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** This task is design/documentation only, but it defines contracts for all implementation tasks that follow.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Canonical Task Folder

```
taskplane-tasks/TP-003-kagi-api-capability-map/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Create a precise capability map for Kagi APIs and convert it into an implementation contract for the `pi-kagi` extension. The output must define which endpoint should be used for which user intent, normalized response shapes, safety/error expectations, and cost-awareness guidance so downstream coding tasks can implement confidently.

## Dependencies

- **Task:** TP-002 (Extension scaffold exists)

## Context to Read First

**Tier 2 (area context):**
- `taskplane-tasks/CONTEXT.md`

**Tier 3 (load only if needed):**
- `docs/overview.md`
- `docs/search.md`
- `docs/enrich.md`
- `docs/fastgpt.md`
- `docs/summarizer.md`
- `docs/smallweb.md`
- `/home/yanek/.bun/install/global/node_modules/@mariozechner/pi-coding-agent/docs/extensions.md`

## Environment

- **Workspace:** `/home/yanek/Projects/pi-kagi`
- **Services required:** None

## File Scope

- `docs/kagi-api-capability-map.md`
- `docs/pi-kagi-architecture.md`

## Steps

### Step 0: Preflight
- [ ] Confirm all six Kagi reference docs exist in `docs/`
- [ ] Confirm TP-002 task packet exists

### Step 1: Extract API capabilities
- [ ] Document endpoint matrix: purpose, required params, optional params, pricing/caching behavior
- [ ] Identify API limitations and availability caveats (e.g., Search API beta, FastGPT `web_search` caveat)
- [ ] Capture auth/header contract and shared error handling expectations

**Artifacts:**
- `docs/kagi-api-capability-map.md` (new)

### Step 2: Define pi-kagi architecture contract
- [ ] Define extension module layout and normalized internal data contracts
- [ ] Define smart routing rules: when to use Search vs Enrich vs FastGPT vs Summarizer vs SmallWeb
- [ ] Define output requirements for LLM-facing tool responses (citations, compact summaries, truncation)

**Artifacts:**
- `docs/pi-kagi-architecture.md` (new)

### Step 3: Testing & Verification
- [ ] Validate docs are internally consistent and aligned with source references
- [ ] Validate all downstream tasks can reference these contracts without ambiguity

### Step 4: Documentation & Delivery
- [ ] Add a short “implementation-ready” checklist in `docs/pi-kagi-architecture.md`
- [ ] Log key discoveries in STATUS.md

## Documentation Requirements

**Must Update:**
- `docs/kagi-api-capability-map.md`
- `docs/pi-kagi-architecture.md`

**Check If Affected:**
- `.pi/extensions/pi-kagi/README.md`

## Completion Criteria

- [ ] Endpoint-to-intent mapping is explicit and complete
- [ ] Smart routing policy is documented
- [ ] Contracts are concrete enough for implementation tasks TP-004+

## Git Commit Convention

- `docs(TP-003): complete Step N — description`

## Do NOT

- Implement runtime code in this task
- Change Kagi API semantics beyond what docs specify

---

## Amendments (Added During Execution)

<!-- Worker-owned -->
