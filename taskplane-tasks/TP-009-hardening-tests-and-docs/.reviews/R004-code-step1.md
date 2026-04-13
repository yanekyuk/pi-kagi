# Code Review: TP-009 Step 1 — Integration and Regression Coverage

**Review Date:** 2026-04-13  
**Step:** Step 1: Integration and regression coverage  
**Verdict:** ✅ **APPROVE**

---

## Summary

This review covers the implementation of Step 1 of TP-009, which adds integration and regression test coverage for the pi-kagi extension. The work successfully navigates the dependency constraint (TP-007/TP-008 outputs not yet available) by re-scoping to current TP-005/TP-006 tool surfaces and providing comprehensive fixture-based integration tests.

---

## Files Changed

| File | Purpose |
|------|---------|
| `src/tool-costs.ts` | New cost estimation guidance module |
| `src/tools/search.ts` | Cost metadata injection in results |
| `src/tools/enrich.ts` | Cost metadata injection in results |
| `src/tools/fastgpt.ts` | Cost metadata injection in results |
| `src/tools/summarizer.ts` | Cost metadata injection in results |
| `src/tools/smallweb.ts` | Cost metadata injection in results |
| `tests/fixtures/integration-fixtures.ts` | Deterministic fixture data for integration tests |
| `tests/integration/harness.ts` | Offline test harness with mocked ExtensionAPI |
| `tests/integration/manual-routing.test.ts` | Integration test suite (scope, scenarios, failures, cost checks) |
| `tests/search-enrich.test.ts` | Updated for cost metadata assertions |
| `tests/fastgpt-summarizer.test.ts` | Updated for cost metadata assertions |

---

## Detailed Review

### 1. Cost Guidance Module (`src/tool-costs.ts`)

**Verdict:** ✅ Well-designed

- Provides a single source of truth for cost estimates via `TOOL_COST_GUIDANCE` constant
- Functions follow clear naming: `estimated<tool>Cost()` with optional cache parameter
- `appendEstimatedCost()` utility cleanly separates formatting concern
- Empty-result enrich returns "$0.00" — accurate since no API call consumed credits

**Minor suggestion:** Consider adding a docstring explaining the "cached responses may be free" note comes from Kagi API documentation.

### 2. Tool Modifications (search, enrich, fastgpt, summarizer, smallweb)

**Verdict:** ✅ Consistent implementation

All tools now:
- Append estimated cost to text output via `appendEstimatedCost()`
- Include `estimatedCost` in the `details` object
- Handle empty results correctly (enrich tools show "$0.00" for no results)

**Pattern consistency check:** Pass. The implementation pattern is identical across all tools:
1. Compute cost using appropriate estimator
2. Pass to `appendEstimatedCost()` for text
3. Include in `details.estimatedCost`

### 3. Integration Test Harness (`tests/integration/harness.ts`)

**Verdict:** ✅ Excellent test infrastructure

- `createPiHarness()` returns a fully functional mock ExtensionAPI
- Properly tracks registered tools, commands, notifications, and event handlers
- `installFetchStub()` provides deterministic fetch mocking with call tracking
- Line/byte counting helpers verify truncation behavior stays within Pi limits
- External module mocking is clean and maintains TypeScript type safety

**Strengths:**
- No actual network calls in tests — fully offline
- Restore functions properly clean up global state
- Response helpers (`createJsonResponse`, `createTextResponse`) reduce boilerplate

### 4. Fixture Data (`tests/fixtures/integration-fixtures.ts`)

**Verdict:** ✅ Deterministic and comprehensive

- `STEP1_SCOPE` explicitly documents the re-scope decision and deferred assertions
- `MANUAL_ROUTING_SCENARIOS` provides a readable scenario matrix with clear reasoning
- Raw response fixtures mirror realistic Kagi API responses
- Each fixture includes `meta` with `api_balance` for consistency checks

### 5. Integration Test Suite (`tests/integration/manual-routing.test.ts`)

**Verdict:** ✅ Excellent coverage

#### Test Categories

| Describe Block | Purpose | Count |
|---------------|---------|-------|
| `TP-009 current-surface manual routing scope` | Validates tool registration and scope boundaries | 1 |
| `TP-009 manual-routing scenario matrix` | End-to-end execution of all 7 manual routing scenarios | 1 |
| `TP-009 failure-path regressions` | Missing key, API errors, sparse-result handling | 3 |
| `TP-009 current-surface cost metadata` | Cost guidance consistency across all tools | 1 |

#### Key Test Scenarios

**Scope validation:**
- Confirms TP-007/TP-008 assertions are explicitly deferred
- Verifies `kagi_web_access` and `kagi_usage` tools are NOT present
- Checks `kagi-about` command only lists shipped tools

**Scenario matrix execution:**
- Runs 7 scenarios sequentially through stubbed fetch
- Validates both text content and details object for each
- Verifies correct HTTP method (GET vs POST) per endpoint
- Checks request body structure for POST endpoints

**Failure-path coverage:**
- Lazy config failure with `KagiConfigError` when key missing
- Endpoint access errors surface correctly with status/body
- Sparse-result fallback guidance preserved in tool definitions

**Cost metadata consistency:**
- All 6 tools return correct cost guidance in both text and details
- Uses `TOOL_COST_GUIDANCE` constants for assertions (not hardcoded strings)

### 6. Test Pass Rate

```
✓ All 113 tests pass (28 integration + 85 existing)
✓ 345 expect() calls
✓ No warnings or flaky tests
```

---

## Criteria Checklist

Per the task PROMPT.md requirements for Step 1:

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Representative integration scenarios for smart routing | ✅ | `MANUAL_ROUTING_SCENARIOS` covers all 7 manual routing cases |
| Regression tests for common failures | ✅ | 3 failure-path tests (missing key, API errors, sparse results) |
| Cost reporting in integrated outputs | ✅ | Cost metadata in all tool results, validated in test suite |
| Defer TP-007/TP-008 assertions | ✅ | `STEP1_SCOPE` constant documents deferral, tests check for absence of those tools |

---

## Architecture Compliance

| Criteria | Status | Notes |
|----------|--------|-------|
| Extension entry point is `export default function (pi: ExtensionAPI)` | ✅ | No change to entry point |
| Tools registered with `pi.registerTool()` | ✅ | Via tool registration functions |
| Uses `StringEnum` (not `Type.Union`/`Type.Literal`) | ✅ | Already in place |
| Uses `Type` from `@sinclair/typebox` | ✅ | Already in place |
| Tool output truncated to 50KB/2000 lines | ✅ | Existing truncation preserved |
| No build step — `.ts` loaded directly | ✅ | No build artifacts added |

---

## Recommendations (Non-blocking)

1. **Cost guidance source:** Consider adding a comment in `tool-costs.ts` referencing the Kagi API pricing documentation URL for future updates.

2. **Fixture versioning:** If Kagi API v0 changes response shapes, consider adding a `schemaVersion` to fixtures to detect drift.

3. **Test isolation:** The scenario matrix test runs 7 scenarios sequentially. While acceptable, splitting into individual tests would provide clearer failure attribution.

---

## Conclusion

The Step 1 implementation successfully delivers comprehensive integration and regression coverage within the documented scope constraints. The test harness is well-architected for future TP-007/TP-008 work, and cost guidance is consistently applied across all tool surfaces.

**Approved for merge.** Proceed to Step 2: Operator documentation.
