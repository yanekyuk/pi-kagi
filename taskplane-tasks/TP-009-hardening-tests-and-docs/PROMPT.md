# Task: TP-009 - Production Hardening: Integration Tests, Docs, and Release Readiness

**Created:** 2026-04-12
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Consolidates and validates all prior work, adding regression coverage and operator-facing docs needed for reliable daily use.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Canonical Task Folder

```
taskplane-tasks/TP-009-hardening-tests-and-docs/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Harden `pi-kagi` for practical use: end-to-end validation scenarios, clear setup docs, troubleshooting guidance, and operator usage patterns. Ensure the extension can be onboarded quickly and trusted under real-world conditions.

## Dependencies

- **Task:** TP-007 (Smart web orchestration)
- **Task:** TP-008 (Usage cost tracking)

## Context to Read First

**Tier 2:**
- `taskplane-tasks/CONTEXT.md`

**Tier 3:**
- `.pi/extensions/pi-kagi/README.md`
- `docs/pi-kagi-architecture.md`
- `/home/yanek/.bun/install/global/node_modules/@mariozechner/pi-coding-agent/docs/extensions.md`

## Environment

- **Workspace:** repository root + `.pi/extensions/pi-kagi/`
- **Services required:** Optional Kagi API key for live smoke examples

## File Scope

- `.pi/extensions/pi-kagi/tests/integration/*.test.ts`
- `.pi/extensions/pi-kagi/tests/fixtures/*`
- `.pi/extensions/pi-kagi/README.md`
- `docs/pi-kagi-usage.md`
- `docs/pi-kagi-troubleshooting.md`

## Steps

### Step 0: Preflight
- [ ] Confirm TP-007 and TP-008 merged outputs are available
- [ ] Inventory current tests and docs coverage gaps

### Step 1: Integration and regression coverage
- [ ] Add representative integration scenarios for smart routing flows
- [ ] Add regression tests for common failures (missing key, endpoint errors, partial fallback)
- [ ] Ensure cost reporting appears consistently in integrated outputs

### Step 2: Operator documentation
- [ ] Write setup and quick-start guide for pi users
- [ ] Write troubleshooting guide (auth failures, beta endpoint access, insufficient credits, timeout behavior)
- [ ] Add “when to use which tool” cheat sheet

### Step 3: Testing & Verification
- [ ] Run full suite: `npm --prefix .pi/extensions/pi-kagi test`
- [ ] Perform manual smoke checklist and record outcomes in STATUS.md
- [ ] Verify docs commands/examples are executable and accurate

### Step 4: Documentation & Delivery
- [ ] Ensure README links to usage/troubleshooting docs
- [ ] Capture remaining known limitations and next-step backlog

## Documentation Requirements

**Must Update:**
- `.pi/extensions/pi-kagi/README.md`
- `docs/pi-kagi-usage.md`
- `docs/pi-kagi-troubleshooting.md`

**Check If Affected:**
- `docs/pi-kagi-architecture.md`

## Completion Criteria

- [ ] Regression/integration coverage exists for core smart web flows
- [ ] Operator docs are complete and practical
- [ ] Extension is ready for repeatable real-use onboarding

## Git Commit Convention

- `test(TP-009): complete Step N — description`
- `docs(TP-009): description`
- `chore(TP-009): description`

## Do NOT

- Introduce major new features in hardening task
- Leave critical troubleshooting paths undocumented

---

## Amendments (Added During Execution)

<!-- Worker-owned -->
