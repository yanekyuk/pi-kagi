# TP-005: Implement Search, Enrich, and SmallWeb Tools — Status

**Current Step:** Step 2: Implement Enrich + SmallWeb tools
**Status:** ✅ Complete
**Last Updated:** 2026-04-12
**Current Step:** Step 1: Implement Search API tool

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
**Status:** ⬜ Not Started
- [ ] Tool registration completed
- [ ] Prompt snippets/guidelines added
- [ ] Truncation strategy applied

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

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-04-12 | Task staged | PROMPT.md and STATUS.md created |
| 2026-04-12 17:51 | Task started | Runtime V2 lane-runner execution |
| 2026-04-12 17:51 | Step 0 started | Preflight |

---

## Blockers

*None*
| 2026-04-12 18:05 | Review R001 | plan Step 1: UNKNOWN |
| 2026-04-12 18:12 | Review R001 | code Step 1: REVISE |
| 2026-04-12 18:17 | Review R001 | plan Step 2: UNKNOWN |
