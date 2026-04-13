# Plan Review: Step 1 — Integration and regression coverage

**Reviewer:** Automated Review  
**Date:** 2026-04-13  
**Step:** Step 1: Integration and regression coverage  
**Verdict:** 🟢 Approve plan; proceed with execution

---

## Summary

This revision is now specific enough to execute.

Compared with R001/R002, the Step 1 plan now does the important things explicitly:

- re-scopes the work to the **actual TP-005/TP-006 surfaces present in this worktree**,
- explicitly **defers TP-007 routing/fallback assertions** and **TP-008 per-call cost-reporting assertions**,
- defines an **offline integration harness** around **extension registration + tool execution**,
- names a concrete **manual-routing scenario matrix** for the currently shipped tools,
- and narrows “cost reporting” to **current-surface metadata/guidance consistency** rather than pretending the missing pricing layer exists.

That addresses the main planning risks from the prior reviews.

---

## What I verified

### Repository state matches the re-scope

Current `.pi/extensions/pi-kagi/` contents still reflect only the TP-005/TP-006-era extension surface:

- tools: `kagi_search`, `kagi_enrich_web`, `kagi_enrich_news`, `kagi_fastgpt`, `kagi_summarize`, `kagi_smallweb`
- no TP-007 orchestrator/router files
- no TP-008 pricing/cost-tracking files
- no `tests/integration/` directory yet

Dependency task status files also still show the upstream work as not started:

- `TP-007-smart-web-access-orchestrator/STATUS.md` → Ready / Not Started
- `TP-008-usage-cost-tracking/STATUS.md` → Ready / Not Started

### Baseline tests are green

I ran:

```bash
cd .pi/extensions/pi-kagi && bun test
```

Result: **107/107 passing**.

So the plan is starting from a stable baseline, and adding deterministic Step 1 coverage is the right next move.

---

## Why this plan is now acceptable

The updated Step 1 checklist in `STATUS.md` is now concrete and reviewable:

1. **Re-scope/defer statement is explicit**  
   It no longer implies TP-007/TP-008 behavior exists here.

2. **Harness boundary is good enough**  
   “Offline integration harness for extension registration + tool execution with fixtures” is the right level for this repo, given current coverage is already strong at the formatter/client/unit-ish layer.

3. **Scenario matrix is named against real surfaces**  
   Search/enrich, FastGPT, summarizer URL/text, and Small Web are the actual shipped tool families.

4. **Failure-path scope is honest**  
   Missing key, API errors, and sparse-result/manual-fallback guidance fit the current implementation surface without inventing smart-router fallback logic.

5. **Cost wording is no longer misleading**  
   The plan properly limits Step 1 to current metadata/guidance consistency and explicitly defers TP-008-style per-call reporting.

---

## Non-blocking execution notes

These are not reasons to stop, but they should be kept in mind during implementation:

- Keep the new tests focused on **`index.ts` registration + tool execute paths**, not just more formatter-only assertions under a new directory.
- Keep Step 1 fully **offline and fixture-backed**; live Kagi calls belong in later smoke verification, not in `bun test`.
- When Step 1 is completed, avoid wording that suggests **true smart routing** or **centralized cost reporting** has been delivered in this task branch.

---

## Recommendation

**Proceed with Step 1 implementation as currently planned.**

The plan is now sufficiently scoped, dependency-aware, and concrete for execution in this worktree.
