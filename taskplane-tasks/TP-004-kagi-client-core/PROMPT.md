# Task: TP-004 - Implement Core Kagi Client, Config, and Error Handling

**Created:** 2026-04-12
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Introduces core HTTP client and configuration contracts used by all tools; mistakes here cascade into every feature.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 1, Reversibility: 0

## Canonical Task Folder

```
taskplane-tasks/TP-004-kagi-client-core/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Implement the reusable foundation for `pi-kagi`: typed API client, environment/config loading, request wrapper, response normalization primitives, and robust error handling. This task must establish a testable base so feature tools can be implemented without duplicating protocol logic.

## Dependencies

- **Task:** TP-003 (Capability map + architecture contract)

## Context to Read First

**Tier 2 (area context):**
- `taskplane-tasks/CONTEXT.md`

**Tier 3:**
- `docs/pi-kagi-architecture.md`
- `docs/kagi-api-capability-map.md`
- `/home/yanek/.bun/install/global/node_modules/@mariozechner/pi-coding-agent/docs/extensions.md`

## Environment

- **Workspace:** `.pi/extensions/pi-kagi/`
- **Services required:** Optional Kagi API key for live smoke test

## File Scope

- `.pi/extensions/pi-kagi/package.json`
- `.pi/extensions/pi-kagi/src/index.ts`
- `.pi/extensions/pi-kagi/src/config.ts`
- `.pi/extensions/pi-kagi/src/types.ts`
- `.pi/extensions/pi-kagi/src/kagi-client.ts`
- `.pi/extensions/pi-kagi/src/errors.ts`
- `.pi/extensions/pi-kagi/tests/client.test.ts`

## Steps

### Step 0: Preflight
- [ ] Validate architecture docs from TP-003 are present
- [ ] Validate extension scaffold from TP-002 is present

### Step 1: Project structure + config contract
- [ ] Introduce `src/` structure and package scripts for testing
- [ ] Implement config loader for Kagi API key and base URL (`https://kagi.com/api/v0` default)
- [ ] Add clear user-facing errors when key/config is missing

### Step 2: Implement core client
- [ ] Implement shared request helper with `Authorization: Bot <TOKEN>` header
- [ ] Implement typed client methods for raw endpoint calls (without feature formatting)
- [ ] Implement normalized error mapping (HTTP status, API error payload, network failure, timeout)

### Step 3: Add unit tests for client foundation
- [ ] Add tests for config resolution and missing-key behavior
- [ ] Add tests for request construction and response/error mapping
- [ ] Add tests for retry/no-retry policy boundaries (if implemented)

### Step 4: Testing & Verification
- [ ] Run test suite: `npm --prefix .pi/extensions/pi-kagi test`
- [ ] Run targeted smoke validation for extension load path

### Step 5: Documentation & Delivery
- [ ] Update extension README with config requirements
- [ ] Document error classes/contracts for downstream tools

## Documentation Requirements

**Must Update:**
- `.pi/extensions/pi-kagi/README.md`

**Check If Affected:**
- `docs/pi-kagi-architecture.md`

## Completion Criteria

- [ ] Shared client exists and is tested
- [ ] Missing/invalid config errors are explicit
- [ ] Downstream tools can call typed client methods without duplicating auth/transport logic

## Git Commit Convention

- `feat(TP-004): complete Step N — description`
- `test(TP-004): description`

## Do NOT

- Implement endpoint-specific UX formatting here
- Hardcode API token values in tracked files

---

## Amendments (Added During Execution)

<!-- Worker-owned -->
