# Task: TP-005 - Implement Search, Enrich, and SmallWeb Tools

**Created:** 2026-04-12
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Adds multiple user-facing web discovery tools and normalization logic; correctness and clarity of returned references matter for agent quality.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 1, Reversibility: 1

## Canonical Task Folder

```
taskplane-tasks/TP-005-search-and-enrich-tools/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Implement pi tools for Kagi Search API, Enrich Web/News APIs, and SmallWeb feed so pi can retrieve web results with explicit source links and structured output. Keep tool outputs concise and citation-first for reliable downstream LLM use.

## Dependencies

- **Task:** TP-004 (Core client and config)

## Context to Read First

**Tier 2:**
- `taskplane-tasks/CONTEXT.md`

**Tier 3:**
- `docs/pi-kagi-architecture.md`
- `docs/search.md`
- `docs/enrich.md`
- `docs/smallweb.md`
- `/home/yanek/.bun/install/global/node_modules/@mariozechner/pi-coding-agent/docs/extensions.md`

## Environment

- **Workspace:** `.pi/extensions/pi-kagi/`
- **Services required:** Kagi API key (for live smoke)

## File Scope

- `.pi/extensions/pi-kagi/src/index.ts`
- `.pi/extensions/pi-kagi/src/tools/search.ts`
- `.pi/extensions/pi-kagi/src/tools/enrich.ts`
- `.pi/extensions/pi-kagi/src/tools/smallweb.ts`
- `.pi/extensions/pi-kagi/src/formatters/results.ts`
- `.pi/extensions/pi-kagi/src/types.ts`
- `.pi/extensions/pi-kagi/tests/search-enrich.test.ts`

## Steps

### Step 0: Preflight
- [ ] Validate TP-004 client interfaces used by feature tools
- [ ] Validate expected normalized output shape from architecture doc

### Step 1: Implement Search API tool
- [ ] Add tool schema for query + optional limit
- [ ] Map Kagi search response into normalized references list
- [ ] Include related searches when present without overwhelming token budget

### Step 2: Implement Enrich + SmallWeb tools
- [ ] Add enrich web/news tools with shared formatter
- [ ] Add smallweb feed tool with optional limit parameter
- [ ] Ensure outputs include URL/title/snippet/date when available

### Step 3: Register tools and prompt metadata
- [ ] Register tools in extension entrypoint with clear descriptions
- [ ] Add `promptSnippet`/guidelines to encourage correct use by LLM
- [ ] Ensure output truncation strategy is used for long result sets

### Step 4: Testing & Verification
- [ ] Add/extend tests for mapping and edge cases (empty data, missing fields)
- [ ] Run test suite: `npm --prefix .pi/extensions/pi-kagi test`
- [ ] Execute smoke check command(s) and log result in STATUS.md

### Step 5: Documentation & Delivery
- [ ] Update extension README with tool list and usage examples
- [ ] Note known constraints (Search API beta access)

## Documentation Requirements

**Must Update:**
- `.pi/extensions/pi-kagi/README.md`

**Check If Affected:**
- `docs/kagi-api-capability-map.md`

## Completion Criteria

- [ ] Search, enrich, and smallweb tools are callable through extension
- [ ] Returned results are normalized and citation-friendly
- [ ] Tests cover key transformation paths

## Git Commit Convention

- `feat(TP-005): complete Step N — description`
- `test(TP-005): description`

## Do NOT

- Implement summarizer/FastGPT in this task
- Return giant unbounded result payloads to the LLM

---

## Amendments (Added During Execution)

<!-- Worker-owned -->
