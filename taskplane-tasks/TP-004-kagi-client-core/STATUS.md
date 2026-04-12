# TP-004: Implement Core Kagi Client, Config, and Error Handling — Status

**Current Step:** Step 1: Project structure + config contract
**Status:** 🟨 In Progress
**Last Updated:** 2026-04-12
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 1
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Dependencies and scaffold verified

---

### Step 1: Project structure + config contract
**Status:** 🟨 In Progress
- [ ] Create `src/` directory structure under `.pi/extensions/pi-kagi/`
- [ ] Add package.json scripts for testing (bun test)
- [ ] Implement `src/config.ts` with Kagi API key resolver (KAGI_API_KEY env var, with helpful error when missing)
- [ ] Implement `src/errors.ts` with KagiError class and error normalization
- [ ] Update `index.ts` entry point to import and use config on session_start
- [ ] Install test runner dependency (bun test built-in, but verify)

---

### Step 2: Implement core client
**Status:** ⬜ Not Started
- [ ] Authenticated request helper implemented
- [ ] Typed raw endpoint methods implemented
- [ ] Error mapping implemented

---

### Step 3: Add unit tests for client foundation
**Status:** ⬜ Not Started
- [ ] Config tests added
- [ ] Request/response mapping tests added
- [ ] Retry boundary tests added (if applicable)

---

### Step 4: Testing & Verification
**Status:** ⬜ Not Started
- [ ] `npm --prefix .pi/extensions/pi-kagi test` passes
- [ ] Extension load smoke validation passes

---

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] README updated
- [ ] Error contract documented

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-04-12 | Task staged | PROMPT.md and STATUS.md created |
| 2026-04-12 16:36 | Task started | Runtime V2 lane-runner execution |
| 2026-04-12 16:36 | Step 0 started | Preflight |

---

## Blockers

*None*
