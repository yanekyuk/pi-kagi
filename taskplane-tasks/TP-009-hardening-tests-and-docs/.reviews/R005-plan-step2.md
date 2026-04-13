# Plan Review: Step 2 — Operator Documentation

**Reviewer:** Automated Review  
**Date:** 2026-04-13  
**Step:** Step 2: Operator documentation  
**Verdict:** 🟡 Request Plan Clarification — scope gap on doc splitting and content boundaries

---

## Summary

Step 2 requires three deliverables:
1. Setup + quick-start guide for pi users
2. Troubleshooting guide (auth failures, beta endpoint access, insufficient credits, timeout behavior)
3. "When to use which tool" cheat sheet

The current `README.md` already contains substantial coverage of all three areas:
- Comprehensive setup/quick-start section
- Detailed error handling table + retry behavior
- Tool selection guidance table + decision criteria

**The plan gap:** The STATUS.md does not specify how to split content between the existing README and the two new required docs (`docs/pi-kagi-usage.md`, `docs/pi-kagi-troubleshooting.md`), or what net-new content must be added.

---

## What I Verified

### Documentation inventory

| File | Status | Coverage |
|------|--------|----------|
| `.pi/extensions/pi-kagi/README.md` | ✅ Exists | Setup, quick-start, usage examples, tool selection, error table, constraints, architecture |
| `docs/pi-kagi-usage.md` | ❌ Missing | Required by PROMPT.md |
| `docs/pi-kagi-troubleshooting.md` | ❌ Missing | Required by PROMPT.md |
| `docs/pi-kagi-architecture.md` | ✅ Exists | Technical spec (may need link updates) |

### Current README.md content analysis

**Setup/Quick-start (lines 21-45):**
- Installation instructions (project-local extension)
- Requirements (Kagi API key)
- Export/set key command
- `/kagi-about` verification

**Tool selection guidance (lines 62-70):**
- 6-row table mapping use cases to tools
- Bullet list explaining when to use each tool

**Usage examples (lines 74-124):**
- 6 JSON examples covering all tools
- Parameter variations shown

**Error handling (lines 143-166):**
- Error table with status codes and messages
- Retry behavior section

**Known constraints (lines 130-142):**
- Beta access limitations
- Payment/credit requirements
- Input rules (summarizer URL/text exclusivity)

### Gap analysis for required docs

**docs/pi-kagi-usage.md:**
The README already has a "Quick Start" and "Usage Examples" section. The plan must specify:
- Whether to duplicate this content in `docs/pi-kagi-usage.md`
- Or extract/move it there and have README link to it
- Or make `usage.md` an extended guide (advanced patterns, pi-specific integration tips)

**docs/pi-kagi-troubleshooting.md:**
The README has error codes but not diagnostic flow. Missing content that belongs here:
- Step-by-step diagnostic checklist (is it a key problem? network? credits? beta access?)
- How to verify API key is working (`curl` command or `/kagi-about`)
- How to check API balance/credits
- Beta access request process (Kagi's Search API is invite-only)
- Timeout behavior specifics (what to do if FastGPT/Summarizer times out)
- Log locations (if any) or debug mode

**"When to use which tool" cheat sheet:**
README has this in table + bullet form. Plan must specify:
- Whether to create a separate quick-reference doc
- Or enhance the existing content
- Format: markdown table vs. decision tree diagram vs. copy-paste snippet

---

## Required Plan Updates

Before implementation, update STATUS.md Step 2 with explicit decisions on:

### 1. Content boundaries (must decide)

```markdown
- [ ] docs/pi-kagi-usage.md — DECISION: [move from README | duplicate | extend with advanced patterns]
- [ ] docs/pi-kagi-troubleshooting.md — DECISION: [net-new content only | extract from README + add diagnostics]
- [ ] Tool cheat sheet — DECISION: [standalone file | section within usage.md | enhance README existing]
```

### 2. Required net-new content checklist

Based on PROMPT.md requirements, the troubleshooting guide must explicitly cover:

```markdown
Troubleshooting guide required sections:
- [ ] Auth failures — diagnostic flow (key format, env var check, Pi settings)
- [ ] Beta endpoint access — how to request, what error to expect, fallback options
- [ ] Insufficient credits — 402 error, how to check balance, link to billing
- [ ] Timeout behavior — which tools have longer timeouts, what happens on timeout, retry guidance
```

### 3. README.md linkage (must specify)

```markdown
- [ ] Add "Documentation" section to README linking to usage.md and troubleshooting.md
- [ ] Update "Known Constraints" section to reference troubleshooting.md for resolution steps
```

---

## Why this clarification is needed

**Risk: Content duplication or fragmentation**
Without explicit boundaries, the implementer may either:
- Duplicate large sections from README (maintenance burden), or
- Leave README bare and move everything to docs (discoverability loss)

**Risk: Missing required troubleshooting depth**
The PROMPT.md requires "troubleshooting guidance" beyond the error table already in README. The plan must explicitly call out the diagnostic/flow content that is currently missing.

**Risk: Cheat sheet format undefined**
"Cheat sheet" could mean a markdown file, a code comment block, a ASCII decision tree, or something else. The plan should specify the format and location.

---

## Non-blocking observations

These don't block planning but should be considered:

1. **Tool cost guidance is already consistent** — Step 1 added `TOOL_COST_GUIDANCE` and tests verify it appears in outputs. Any usage docs should reference this as the source of truth.

2. **Integration tests are a doc verification source** — `MANUAL_ROUTING_SCENARIOS` in fixtures provides canonical usage patterns that docs should align with.

3. **Architecture doc may need link updates** — After Step 2, verify `pi-kagi-architecture.md` links correctly to usage/troubleshooting docs.

---

## Recommendation

**Do not proceed with Step 2 implementation yet.**

Update STATUS.md Step 2 to include:
1. Explicit content boundary decisions (README vs. new docs)
2. Net-new content checklist for troubleshooting diagnostics
3. Cheat sheet format and location decision
4. README linkage plan

Once these decisions are recorded in STATUS.md, the plan will be ready for implementation.
