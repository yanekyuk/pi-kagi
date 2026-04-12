# Task: TP-008 - Add Per-Call Usage Cost Tracking and Reporting

**Created:** 2026-04-12
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Pricing visibility influences endpoint routing and user trust; wrong math or unclear reporting can mislead usage decisions.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 1, Reversibility: 1

## Canonical Task Folder

```
taskplane-tasks/TP-008-usage-cost-tracking/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Implement usage-cost tracking for all Kagi API calls in `pi-kagi`, based on documented pricing models and response metadata. Each tool response should include transparent cost estimation (or explicit uncertainty) so users and agents can make smart tradeoffs.

## Dependencies

- **Task:** TP-005 (Search/Enrich/SmallWeb tools)
- **Task:** TP-006 (FastGPT/Summarizer tools)

## Context to Read First

**Tier 2:**
- `taskplane-tasks/CONTEXT.md`

**Tier 3:**
- `docs/overview.md`
- `docs/search.md`
- `docs/enrich.md`
- `docs/fastgpt.md`
- `docs/summarizer.md`
- `docs/pi-kagi-architecture.md`

## Environment

- **Workspace:** `.pi/extensions/pi-kagi/`
- **Services required:** None (pricing model can be validated via fixtures/tests)

## File Scope

- `.pi/extensions/pi-kagi/src/pricing/pricing-model.ts`
- `.pi/extensions/pi-kagi/src/pricing/cost-estimator.ts`
- `.pi/extensions/pi-kagi/src/formatters/cost.ts`
- `.pi/extensions/pi-kagi/src/types.ts`
- `.pi/extensions/pi-kagi/src/tools/*.ts`
- `.pi/extensions/pi-kagi/tests/cost-estimator.test.ts`
- `.pi/extensions/pi-kagi/README.md`

## Steps

### Step 0: Preflight
- [ ] Extract pricing assumptions and caveats from Kagi docs
- [ ] Identify where response metadata already exposes token/credit info

### Step 1: Implement pricing model + estimator
- [ ] Add centralized pricing constants and endpoint pricing rules
- [ ] Add estimator API for per-call and aggregate cost summaries
- [ ] Handle uncertainty explicitly (e.g., missing token counts, endpoint caveats)

### Step 2: Integrate cost reporting into tools
- [ ] Attach cost block to each tool result details/output
- [ ] Keep formatting concise and consistent across endpoints
- [ ] Ensure no-sensitive-data exposure in cost output

### Step 3: Testing & Verification
- [ ] Add tests for endpoint-specific pricing math and edge cases
- [ ] Add tests for missing/partial metadata behavior
- [ ] Run full suite: `npm --prefix .pi/extensions/pi-kagi test`

### Step 4: Documentation & Delivery
- [ ] Document pricing model assumptions and update guidance in README
- [ ] Document how to update pricing rules when docs change

## Documentation Requirements

**Must Update:**
- `.pi/extensions/pi-kagi/README.md`

**Check If Affected:**
- `docs/kagi-api-capability-map.md`

## Completion Criteria

- [ ] Every Kagi tool response includes cost estimate or explicit "unknown"
- [ ] Pricing logic is centralized and test-covered
- [ ] Assumptions and caveats are documented

## Git Commit Convention

- `feat(TP-008): complete Step N — description`
- `test(TP-008): description`
- `docs(TP-008): description`

## Do NOT

- Hardcode hidden magic numbers without documentation
- Mix pricing logic directly into unrelated tool handlers

---

## Amendments (Added During Execution)

<!-- Worker-owned -->
