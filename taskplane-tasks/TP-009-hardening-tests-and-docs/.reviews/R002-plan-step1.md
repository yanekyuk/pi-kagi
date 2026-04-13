# Plan Review: Step 1 — Integration and regression coverage

**Reviewer:** Automated Review  
**Date:** 2026-04-13  
**Step:** Step 1: Integration and regression coverage  
**Verdict:** 🟡 Revise before execution

---

## Summary

This is a meaningful improvement over R001: the plan now acknowledges the dependency gap up front, calls for a fixture-backed harness, and re-anchors Step 1 around the surfaces that actually exist in this worktree.

That said, it is still not quite execution-ready. The repo still does **not** contain TP-007 smart-routing or TP-008 cost-tracking outputs, and the Step 1 checklist is still broad enough that implementation could drift into either:

- more unit-style tests that do not meaningfully raise integration confidence, or
- over-claiming completion on “cost reporting” by checking static copy rather than actual integrated output behavior.

Current baseline remains healthy: `.pi/extensions/pi-kagi` has only the TP-005/TP-006-era tools (`kagi_search`, `kagi_enrich_*`, `kagi_fastgpt`, `kagi_summarize`, `kagi_smallweb`), and `bun test` passes with **107/107** tests.

---

## What Improved Since R001

The revised Step 1 bullets are directionally better:

- `Scope decision for missing TP-007/TP-008 outputs recorded and applied`
- `Fixture-backed integration harness added for current worktree surfaces`
- `Representative manual-routing integration scenarios added`
- `Failure-path regression tests added`
- `Cost guidance / estimate consistency checks added`

These changes address the main structural complaint from R001: the plan now admits that TP-009 cannot pretend the missing orchestrator/pricing layers already exist.

---

## Findings

### 1) The plan still needs an explicit re-scope/defer statement for TP-007 and TP-008 requirements
**Severity:** High

The new “scope decision” item is better, but it still does not say what Step 1 will consider **done** when TP-007 and TP-008 are absent.

Right now the prompt’s original Step 1 requirements are still phrased in terms of:

- smart-routing flows,
- partial fallback,
- cost reporting in integrated outputs.

Those features do not exist in this worktree. If the chosen scope is “re-scope to currently shipped tools,” the plan should state that explicitly and also state which original checks are being **deferred** pending TP-007/TP-008.

Without that, the worker can complete the revised checklist while the task still reads as though true smart-routing/cost-reporting hardening was delivered.

**Needed revision:** add a first checklist item or note such as:

- `Re-scope Step 1 to current TP-005/TP-006 tool surfaces; defer TP-007 routing/fallback and TP-008 per-call cost-reporting assertions until those task outputs land.`

That makes the acceptance boundary honest and reviewable.

---

### 2) “Representative manual-routing integration scenarios” is still too vague
**Severity:** Medium

This is the biggest remaining planning gap.

Given the current repo contents, Step 1 should identify the actual scenarios to cover across the shipped tools. Otherwise “integration” may collapse into one shallow happy-path test.

At minimum, the plan should name the intended matrix for current surfaces, e.g.:

- extension-level registration + invocation flow for each shipped tool,
- search vs enrich-web vs enrich-news selection scenarios,
- FastGPT answer flow with citations/tokens,
- summarizer URL flow and text flow,
- Small Web feed flow,
- one or two cross-tool comparison scenarios that justify the “manual-routing” label.

If those are not named now, the checklist is still underspecified.

---

### 3) The integration harness boundary is not defined tightly enough
**Severity:** Medium

“Fixture-backed integration harness” is the right direction, but the plan should say what the harness integrates:

- the extension entry point plus registered tools,
- or tool registration + execute paths,
- or the client layer against mocked `fetch`.

Those are different test levels.

Because existing coverage is already strong at the unit-ish level, Step 1 should bias toward **extension/tool wiring** with deterministic fixtures, not just more formatter/client tests under a new directory.

**Needed revision:** specify that the new harness will exercise `index.ts` registration and tool execution end-to-end with mocked client/fetch responses, while remaining offline under `bun test`.

---

### 4) The “cost guidance / estimate consistency” item risks drifting away from the task requirement
**Severity:** Medium

This revised wording is understandable given TP-008 is missing, but it is materially weaker than the prompt’s original requirement to ensure cost reporting appears consistently in integrated outputs.

Today’s codebase has:

- cost language in tool descriptions,
- token metadata in FastGPT/Summarizer output,
- API balance metadata on some Kagi responses,
- but **no** central per-call pricing model or integrated cost block.

So if Step 1 is re-scoped, the plan should be explicit that it is only checking **currently shipped cost-related affordances** and not treating that as fulfillment of TP-008-style output reporting.

Otherwise the step risks papering over a real dependency gap.

**Needed revision:** rename or annotate this item so it reads more like:

- `Current-surface cost metadata/guidance consistency checks added (tool descriptions, token/API-balance metadata); TP-008 per-call reporting deferred`

---

## Recommendation

Revise the Step 1 plan one more time before execution.

The right final version should do three things clearly:

1. **Declare the re-scope/defer decision** for missing TP-007/TP-008 outputs.
2. **Name the concrete integration matrix** for the tools that actually exist today.
3. **Define the harness boundary** so Step 1 produces real integration coverage rather than more repackaged unit tests.

Once those are written into `STATUS.md`, the plan should be ready to execute.
