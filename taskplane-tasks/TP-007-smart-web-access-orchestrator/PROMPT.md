# Task: TP-007 - Build Smart Web Access Orchestrator for pi-kagi

**Created:** 2026-04-12
**Size:** L

## Review Level: 3 (Full)

**Assessment:** This task defines cross-tool decision logic affecting quality, cost, and reliability of web access behavior. It combines routing, fallback, and result synthesis.
**Score:** 6/8 — Blast radius: 2, Pattern novelty: 2, Security: 1, Reversibility: 1

## Canonical Task Folder

```
taskplane-tasks/TP-007-smart-web-access-orchestrator/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Implement a “smart web access” layer for `pi-kagi` that routes user intents to the best Kagi endpoint(s), applies fallbacks, and returns concise citation-backed results suitable for LLM tool usage. The goal is high-quality web access behavior with predictable outputs and graceful degradation.

## Dependencies

- **Task:** TP-005 (Search/Enrich/SmallWeb tools)
- **Task:** TP-006 (FastGPT/Summarizer tools)

## Context to Read First

**Tier 2:**
- `taskplane-tasks/CONTEXT.md`

**Tier 3:**
- `docs/pi-kagi-architecture.md`
- `docs/kagi-api-capability-map.md`
- `docs/search.md`
- `docs/enrich.md`
- `docs/fastgpt.md`
- `docs/summarizer.md`
- `docs/smallweb.md`

## Environment

- **Workspace:** `.pi/extensions/pi-kagi/`
- **Services required:** Kagi API key (recommended for integration smoke)

## File Scope

- `.pi/extensions/pi-kagi/src/index.ts`
- `.pi/extensions/pi-kagi/src/router/intent-router.ts`
- `.pi/extensions/pi-kagi/src/router/fallback-policy.ts`
- `.pi/extensions/pi-kagi/src/tools/smart-web.ts`
- `.pi/extensions/pi-kagi/src/formatters/final-output.ts`
- `.pi/extensions/pi-kagi/tests/smart-router.test.ts`
- `.pi/extensions/pi-kagi/tests/smart-router.integration.test.ts`

## Steps

### Step 0: Preflight
- [ ] Validate TP-005 and TP-006 are available and stable
- [ ] Validate routing policy in architecture doc is concrete enough to implement

### Step 1: Implement intent router
- [ ] Define intent categories (fact lookup, deep answer, summarization, niche discovery, trend/news)
- [ ] Route intents to endpoint strategy (single API or composed flow)
- [ ] Define deterministic fallback order per strategy

### Step 2: Implement smart tool orchestration
- [ ] Implement `smart_web_access` tool that accepts query + intent/options
- [ ] Execute selected endpoint flow and aggregate normalized results
- [ ] Include citations and provenance in all successful responses

### Step 3: Robustness and guardrails
- [ ] Handle partial failures without losing all utility
- [ ] Add bounded result sizes and truncation for LLM safety
- [ ] Add clear user-facing diagnostics for unavailable endpoints/access limits

### Step 4: Testing & Verification
- [ ] Add unit tests for routing and fallback behavior
- [ ] Add integration-style tests for representative end-to-end flows
- [ ] Run full suite: `npm --prefix .pi/extensions/pi-kagi test`

### Step 5: Documentation & Delivery
- [ ] Update README with smart routing behavior and usage examples
- [ ] Document fallback policy and known limitations

## Documentation Requirements

**Must Update:**
- `.pi/extensions/pi-kagi/README.md`

**Check If Affected:**
- `docs/pi-kagi-architecture.md`

## Completion Criteria

- [ ] Smart tool routes queries predictably and sensibly
- [ ] Fallback behavior is deterministic and tested
- [ ] Output remains concise, citation-first, and resilient to partial failures

## Git Commit Convention

- `feat(TP-007): complete Step N — description`
- `test(TP-007): description`

## Do NOT

- Hide source provenance in final answers
- Return unbounded raw payloads
- Couple routing logic tightly to UI-only concerns

---

## Amendments (Added During Execution)

<!-- Worker-owned -->
