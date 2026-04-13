# Review R008: Step 3 Plan — Testing & Verification

**Review Type:** Plan Review  
**Step:** Step 3: Testing & Verification  
**Date:** 2026-04-13  
**Reviewer:** Code Review Agent  
**Status:** ✅ **APPROVE with minor clarifications**

---

## Executive Summary

Step 3 verifies the integration tests, operator docs, and examples from Steps 1–2 are executable and accurate. Based on examination of the current codebase:

- **113 tests pass** across 6 files (client, config, errors, fastgpt-summarizer, search-enrich, integration/manual-routing)
- **Integration harness** (`tests/integration/harness.ts`) is complete with fixture-backed scenarios
- **Operator docs** (`docs/pi-kagi-usage.md`, `docs/pi-kagi-troubleshooting.md`) are authored and ready for verification
- **README** at `.pi/extensions/pi-kagi/README.md` exists but Step 4 handles final cross-linking

The plan for Step 3 should focus on **verification mechanics** and **recording outcomes** in STATUS.md.

---

## Required Plan Elements

### 1. Test Suite Execution

**Acceptance Criteria:**
- [ ] Run full test suite and confirm all tests pass
- [ ] Record test count and pass/fail status in STATUS.md

**Recommended Command:**
```bash
# From repository root
cd .pi/extensions/pi-kagi && bun test

# Or the npm equivalent (package.json delegates to bun)
npm --prefix .pi/extensions/pi-kagi test
```

**Note:** Both commands work because `package.json` defines `"test": "bun test"`. The plan should prefer `bun test` for consistency with the project's Bun-based tooling.

### 2. Manual Smoke Checklist

The smoke checklist should have two tiers:

#### Tier A: Offline Verification (Required)
Verify the extension wiring works correctly without live API calls:

| Check | Method | Expected Result |
|-------|--------|-----------------|
| Extension loads | Integration harness (`manual-routing.test.ts` first test) | `kagi_search`, `kagi_enrich_web`, `kagi_enrich_news`, `kagi_fastgpt`, `kagi_summarize`, `kagi_smallweb` registered; `kagi_web_access` and `kagi_usage` NOT present |
| `/kagi-about` command | Harness test for command registration | Returns extension version, API key status, tool list |
| Missing key handling | `KagiConfigError` test in integration suite | Lazy failure with helpful message |
| Endpoint access errors | 403 stub test | `KagiApiError` with status 403 and actionable message |
| Sparse result guidance | Empty enrich response test | Manual fallback guidance visible in tool output |
| Cost metadata consistency | Cost guidance test in integration suite | All tools return `[Estimated cost: ...]` footer matching `TOOL_COST_GUIDANCE` |

#### Tier B: Live Verification (Optional, requires `KAGI_API_KEY`)
If the operator chooses to run live tests:

| Check | Command/Tool | Expected Result |
|-------|--------------|-----------------|
| API key configured | `/kagi-about` | Shows `API key: ✅ configured` |
| `kagi_smallweb` | Call with `{limit: 3}` | Returns Small Web entries (free endpoint) |
| `kagi_enrich_web` | Call with simple query | Returns results or empty with fallback guidance |
| Error handling | Invalid key (temporarily) | 401 error with auth message |

**Plan Note:** Tier B should be marked optional in the plan since the task explicitly says live tests are optional ("Optional Kagi API key for live smoke examples" in PROMPT.md Environment section).

### 3. Docs Examples Verification

Verify the following in both `docs/pi-kagi-usage.md` and `docs/pi-kagi-troubleshooting.md`:

| Check | Method | Notes |
|-------|--------|-------|
| Shell commands valid | Visual inspection + copy-paste test | `export KAGI_API_KEY=...`, `printenv KAGI_API_KEY`, `pi` |
| JSON examples well-formed | `jq` validation or similar | All tool call examples must be valid JSON |
| Tool call patterns match implementation | Cross-reference with `src/tools/*.ts` | Parameters must match schema definitions |
| Links accessible | Spot-check Kagi URLs | `https://kagi.com/settings?p=api`, `https://kagi.com/settings/billing_api` |
| Document boundaries respected | Content review | Usage guide does NOT duplicate README reference material; Troubleshooting does NOT duplicate usage workflows |

**Specific JSON Examples to Verify:**

From `docs/pi-kagi-usage.md`:
- `kagi_search` with `query` and `limit` ✅
- `kagi_enrich_web` with `query` ✅
- `kagi_enrich_news` with `query` ✅
- `kagi_fastgpt` with `query` and `cache` ✅
- `kagi_summarize` with `url`, `engine`, `summary_type`, `target_language` ✅
- `kagi_summarize` with `text`, `target_language` ✅
- `kagi_smallweb` with `limit` ✅

All examples use correct parameter names matching the tool schemas.

### 4. STATUS.md Recording Requirements

The plan must require recording in `STATUS.md`:

```markdown
### Step 3: Testing & Verification
**Status:** ✅ Complete
- [x] Full test suite passes: 113 tests, 0 failures, 6 files
- [x] Offline smoke checklist completed (Tier A)
- [x] Live smoke checklist: [completed/skipped — requires API key]
- [x] Docs examples verified executable:
  - Shell commands: valid
  - JSON examples: well-formed, match tool schemas
  - Links: verified accessible
```

---

## Potential Issues & Mitigations

### Issue 1: npm vs bun command discrepancy

**Risk:** PROMPT.md specifies `npm --prefix .pi/extensions/pi-kagi test` but project uses Bun.

**Mitigation:** Plan should note both work but prefer `bun test` for consistency with `package.json` and the project's Bun-based workflow.

### Issue 2: Live smoke tests without API key

**Risk:** Operator may not have Kagi API key available during verification.

**Mitigation:** Plan should explicitly tier smoke tests — Tier A (offline) is required; Tier B (live) is optional and should be skipped if no key is available.

### Issue 3: Tool call examples are Pi-specific

**Risk:** The JSON examples in docs are Pi tool invocation patterns, not standalone executable scripts.

**Mitigation:** Plan should clarify that JSON validation (syntax/schema) is the verification method, not execution — these examples are meant for Pi's tool-calling interface.

---

## Checklist for Step 3 Implementation

- [ ] Run `bun test` in `.pi/extensions/pi-kagi/` and record pass/fail count
- [ ] Execute offline smoke checklist using existing integration tests
- [ ] Validate all shell commands in docs are copy-paste ready
- [ ] Validate all JSON examples are syntactically correct
- [ ] Cross-check JSON example parameters against tool schemas
- [ ] Verify external links (Kagi settings pages) are reachable
- [ ] Update STATUS.md with completion record
- [ ] If API key available, run optional live smoke tests

---

## Verdict

**APPROVE** — The plan for Step 3 should proceed with the structure outlined above. The codebase is in good shape (113 passing tests, complete docs, working harness), so Step 3 is primarily verification and recording work.

**Key Success Criteria:**
1. All 113 existing tests pass
2. Offline smoke checklist confirms extension wiring
3. Docs examples validated as executable/accurate
4. STATUS.md updated with outcomes

**Next Step After Approval:** Implement Step 3 verification, record results in STATUS.md, then proceed to Step 4 (Documentation & Delivery) for README cross-linking and final backlog capture.
