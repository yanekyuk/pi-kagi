# TP-005: Implement Search, Enrich, and SmallWeb Tools — Status

**Current Step:** Step 3: Register tools and prompt metadata
**Iteration:** 2
**Status:** 🟨 In Progress
**Last Updated:** 2026-04-12

---

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Verify KagiClient.search/enrichWeb/enrichNews/smallweb methods match expected contracts
- [x] Verify normalized types (SearchResponse, SearchItem, SmallWebResponse) are as documented
- [x] Verify extension entry point structure (index.ts) and package.json setup
- [x] Confirm pi-coding-agent tool registration API (registerTool, defineTool, truncateHead, etc.)

---

### Step 1: Implement Search API tool
**Status:** ✅ Complete
- [x] Create src/tools/search.ts with kagi_search tool definition
- [x] Create src/formatters/results.ts with shared formatting logic
- [x] Implement search response formatter: numbered citation list with title/snippet/url/date
- [x] Handle related searches in formatter without overwhelming context
- [x] Apply truncation using truncateHead for large result sets

---

### Step 2: Implement Enrich + SmallWeb tools
**Status:** ✅ Complete
- [x] Create src/tools/enrich.ts with kagi_enrich_web and kagi_enrich_news tools
- [x] Create src/tools/smallweb.ts with kagi_smallweb tool
- [x] Share formatSearchResponse between search and enrich tools (includeRank option)
- [x] Apply truncation to enrich and smallweb outputs
- [x] Register enrich and smallweb tools in index.ts

---

### Step 3: Register tools and prompt metadata
**Status:** 🟨 In Progress
- [x] Audit tool registration wiring and keep extension entrypoint messaging aligned
- [x] Add concise prompt snippets/guidelines to TP-005 tool definitions
- [x] Verify truncation remains applied across search, enrich, and smallweb outputs
- [ ] Bound shared truncation helpers so final output (including notices) stays within pi limits
- [ ] Derive `kagi-about` tool help from registered tool metadata to avoid drift

---

### Step 4: Testing & Verification
**Status:** ⬜ Not Started
- [ ] Mapping tests added
- [ ] `npm --prefix .pi/extensions/pi-kagi test` passes
- [ ] Smoke check completed and logged

---

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] README updated
- [ ] API caveats documented

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|
| R001 | plan | Step 1 | ✅ Proceed | .reviews/R001-plan-step1.md |
| R001 | code | Step 1 | REVISE → fixed | .reviews/R001-code-step1.md |
| R001 | plan | Step 3 | ✅ Proceed with qualifications | .reviews/R001-plan-step3.md |
| R001 | code | Step 3 | REVISE | .reviews/R001-code-step3.md |

---

## Notes

- Step 4 should add a lightweight registration test for TP-005 `promptSnippet`/`promptGuidelines` metadata (review suggestion from R001 code Step 3).

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-04-12 | Task staged | PROMPT.md and STATUS.md created |
| 2026-04-12 18:xx | Step 0-2 completed | Search, enrich, smallweb tools implemented and committed. Steps 1-2 received code/plan reviews. Wrap-up signal received, pausing before Step 3 |
| 2026-04-12 18:21 | Agent reply | Status report for TP-005: /  / **Completed:** / - ✅ Step 0: Preflight / - ✅ Step 1: Search API tool (with code review fixes applied) / - ✅ Step 2: Enrich + SmallWeb tools (just committed) /  / **In pr |
| 2026-04-12 18:21 | ⚠️ Steering | Supervisor check: operator suspects lane may be stuck. Please reply with current activity, whether you saw the wrap-up signal, and whether your current TP-005 changes are safe/checkpointed yet. Keep i |
| 2026-04-12 18:21 | Worker iter 1 | done in 1817s, tools: 75 |
| 2026-04-12 18:21 | Step 3 started | Register tools and prompt metadata |
| 2026-04-12 18:xx | Review R001 | plan Step 3 approved with qualifications: focus on prompt metadata, registration audit, and truncation regression check |
| 2026-04-12 18:xx | Review R001 | code Step 3 requested fixes: keep final truncated output within limits and avoid duplicated kagi-about metadata |

---

## Blockers

*None*
| 2026-04-12 18:05 | Review R001 | plan Step 1: UNKNOWN |
| 2026-04-12 18:12 | Review R001 | code Step 1: REVISE |
| 2026-04-12 18:17 | Review R001 | plan Step 2: UNKNOWN |
| 2026-04-12 18:27 | Review R001 | plan Step 3: UNKNOWN |
| 2026-04-12 18:36 | Review R001 | code Step 3: REVISE |
