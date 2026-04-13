# Plan Review: Step 1 — Integration and regression coverage

**Reviewer:** Automated Review  
**Date:** 2026-04-13  
**Step:** Step 1: Integration and regression coverage  
**Verdict:** 🟡 Revise before execution

---

## 1. Scope Reviewed

Per `PROMPT.md` and `STATUS.md`, Step 1 is intended to:

1. add representative integration scenarios for smart-routing flows,
2. add regression coverage for common failures (missing key, endpoint errors, partial fallback),
3. ensure cost reporting appears consistently in integrated outputs,
4. apply scope guidance for the missing TP-007 / TP-008 outputs.

That is the right *target* scope for TP-009, but the current plan is not yet actionable enough to execute safely.

---

## 2. Current-State Fit

The repository baseline is healthy, but the planned Step 1 surface does not exist yet in this worktree:

- `TP-007` status is still **Ready / Not Started**.
- `TP-008` status is still **Ready / Not Started**.
- `.pi/extensions/pi-kagi/src/` currently contains only the TP-004/005/006-era client, formatter, and individual tool modules.
- `.pi/extensions/pi-kagi/tests/` currently contains only:
  - `client.test.ts`
  - `config.test.ts`
  - `errors.test.ts`
  - `search-enrich.test.ts`
  - `fastgpt-summarizer.test.ts`
- There is **no** router/orchestrator module, pricing module, or `tests/integration/` directory yet.
- Current baseline is green: `bun test` passes with **107/107** tests.

So the blocker described in `STATUS.md` is real. As written, Step 1 is still mostly a placeholder for work that depends on code from TP-007 and TP-008.

---

## 3. Findings / Required Revisions

### 1) The plan needs an explicit decision gate, not just a vague “scope guidance” checkbox
**Severity:** High

The new checkbox:

- `Scope guidance for missing TP-007/TP-008 outputs applied`

correctly acknowledges the blocker, but it is too vague to drive implementation.

Right now there are three materially different paths:

1. **Wait** for TP-007 and TP-008 to land, then write TP-009 Step 1 against those outputs.
2. **Absorb dependency work** into TP-009, which turns this step into feature implementation plus tests.
3. **Re-scope** TP-009 Step 1 to only harden currently shipped TP-005/TP-006 tools.

Those are not interchangeable. They produce different files, different review scope, and different completion criteria.

**Recommendation:** revise the plan so the first item is an explicit gate with named outcomes, for example:

- supervisor decision recorded: **wait / absorb / re-scope**,
- blocked status retained until one option is chosen,
- no test implementation starts until the chosen branch is documented in `STATUS.md`.

Without that, the worker can claim Step 1 is “in progress” while still having no executable plan.

---

### 2) The plan needs a concrete post-blocker test matrix
**Severity:** High

The remaining Step 1 bullets are still too broad:

- “Smart-routing integration scenarios added”
- “Failure-path regression tests added”
- “Cost-reporting consistency checks added”

Once TP-007/TP-008 are available, the step should name the actual scenarios it intends to pin down. Otherwise the likely failure mode is adding one shallow happy-path test and calling the step done.

A useful Step 1 matrix should explicitly cover at least:

- **routing happy paths**
  - default lookup route,
  - deep-answer route,
  - URL/document summarization route,
  - niche / Small Web route if supported by TP-007;
- **fallback behavior**
  - `/search` access error falling back to `/enrich/web`,
  - FastGPT timeout or outage falling back to a cheaper / broader path,
  - partial-success aggregation where one branch fails but usable output is still returned;
- **cost reporting**
  - cost block/details present on single-endpoint success,
  - cost block/details present on fallback flows,
  - explicit `unknown` / uncertainty path when metadata is missing.

**Recommendation:** rewrite the step so each of those categories appears as a named checklist item or sub-bullets in `STATUS.md`.

---

### 3) The plan should commit to deterministic, fixture-backed integration tests
**Severity:** Medium

`PROMPT.md` scopes Step 1 to:

- `.pi/extensions/pi-kagi/tests/integration/*.test.ts`
- `.pi/extensions/pi-kagi/tests/fixtures/*`

But the current step plan does not mention fixtures at all.

That matters because these tests should be **integration-style**, not live-network-dependent. Step 3 is where smoke verification belongs. Step 1 should stay deterministic under `bun test` and should not require a Kagi API key.

**Recommendation:** add an explicit item that Step 1 will:

- create `tests/integration/`,
- add reusable mocked payloads under `tests/fixtures/`,
- stub client/orchestrator responses rather than calling live Kagi endpoints.

That will keep the regression suite fast, offline, and stable.

---

### 4) The plan should state how it will behave if supervisor guidance is “re-scope to current worktree”
**Severity:** Medium

If upstream guidance says to proceed **without** TP-007/TP-008, the current Step 1 wording becomes misleading:

- there are no real “smart-routing integration scenarios” to test,
- there is no implemented cost-reporting layer to verify.

In that case, the plan should explicitly pivot to something like:

- broaden regression coverage for the currently shipped tools,
- document TP-007/TP-008-dependent checks as deferred,
- avoid inventing fake orchestrator / pricing test scaffolding for features that do not yet exist.

**Recommendation:** include a fallback branch in the plan stating that if the task is re-scoped, the step will be renamed or its checklist updated so completed work matches real repository surfaces.

---

### 5) Keep the step aligned with the project’s canonical test command
**Severity:** Low

This is not the main issue, but the task prompt still uses:

```bash
npm --prefix .pi/extensions/pi-kagi test
```

For this project, the canonical command remains:

```bash
cd .pi/extensions/pi-kagi && bun test
```

That matters because Step 1 is specifically about adding regression coverage, and the plan should be framed around the repo’s actual test runner.

**Recommendation:** when the plan is revised, refer to `bun test` as the primary local verification path, optionally noting the `npm --prefix ... test` wrapper as equivalent.

---

## 4. Suggested Revised Step-1 Plan

A tighter, execution-ready Step 1 plan would look more like this:

- [ ] Record supervisor decision for missing TP-007/TP-008 outputs (**wait / absorb / re-scope**) in `STATUS.md`
- [ ] If still blocked, leave Step 1 explicitly blocked and do not start placeholder test code
- [ ] If TP-007 is available, add deterministic integration tests under `tests/integration/` for representative routing flows
- [ ] Add fallback regressions for primary-endpoint failure, timeout, and partial-success behavior
- [ ] If TP-008 is available, assert cost information is present and consistently shaped across success, fallback, and uncertainty cases
- [ ] Add mocked response fixtures under `tests/fixtures/` so `bun test` remains offline and repeatable

That version would be specific enough for the worker and next reviewer.

---

## 5. Recommendation

Do **not** execute Step 1 as currently written beyond the blocker/escalation work already completed.

The blocker has been identified correctly, but the plan still needs two things before implementation starts:

1. an explicit scope decision for missing TP-007 / TP-008 outputs, and
2. a concrete, fixture-backed test matrix for routing, fallback, and cost-reporting behavior.

Once those are added, the step will be in good shape for execution.
