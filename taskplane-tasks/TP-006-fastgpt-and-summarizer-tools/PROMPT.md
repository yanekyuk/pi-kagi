# Task: TP-006 - Implement FastGPT and Summarizer Tools

**Created:** 2026-04-12
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Adds high-value LLM-backed endpoints with nuanced parameters (engine, summary type, language, cache) and references handling.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 1, Reversibility: 1

## Canonical Task Folder

```
taskplane-tasks/TP-006-fastgpt-and-summarizer-tools/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Add robust tools for Kagi FastGPT and Universal Summarizer endpoints so pi can answer complex web questions and summarize arbitrary content with controllable options. Ensure clean response formatting with references and token usage details for downstream reasoning.

## Dependencies

- **Task:** TP-004 (Core client and config)

## Context to Read First

**Tier 2:**
- `taskplane-tasks/CONTEXT.md`

**Tier 3:**
- `docs/pi-kagi-architecture.md`
- `docs/fastgpt.md`
- `docs/summarizer.md`
- `/home/yanek/.bun/install/global/node_modules/@mariozechner/pi-coding-agent/docs/extensions.md`

## Environment

- **Workspace:** `.pi/extensions/pi-kagi/`
- **Services required:** Kagi API key (for live smoke)

## File Scope

- `.pi/extensions/pi-kagi/src/index.ts`
- `.pi/extensions/pi-kagi/src/tools/fastgpt.ts`
- `.pi/extensions/pi-kagi/src/tools/summarizer.ts`
- `.pi/extensions/pi-kagi/src/formatters/answers.ts`
- `.pi/extensions/pi-kagi/src/types.ts`
- `.pi/extensions/pi-kagi/tests/fastgpt-summarizer.test.ts`

## Steps

### Step 0: Preflight
- [ ] Validate TP-004 client methods can support `POST /fastgpt` and `GET/POST /summarize`
- [ ] Validate parameter constraints from docs (e.g., FastGPT `web_search` caveat)

### Step 1: Implement FastGPT tool
- [ ] Add typed tool schema for query, cache, web_search
- [ ] Implement response mapping (`output`, `references`, `tokens`)
- [ ] Ensure references are rendered as citation-friendly entries

### Step 2: Implement Summarizer tool
- [ ] Add typed schema for `url`/`text` exclusivity and summary options
- [ ] Implement engine/summary_type/target_language/cache handling
- [ ] Enforce/validate API constraints cleanly with actionable errors

### Step 3: Register tools and UX guidance
- [ ] Register tools in extension entrypoint with clear descriptions
- [ ] Add prompt guidance for choosing FastGPT vs Summarizer
- [ ] Ensure result text is concise while preserving key references/metadata

### Step 4: Testing & Verification
- [ ] Add test coverage for schema constraints and response mapping
- [ ] Run test suite: `npm --prefix .pi/extensions/pi-kagi test`
- [ ] Run smoke checks and log outcomes in STATUS.md

### Step 5: Documentation & Delivery
- [ ] Update README with endpoint options and examples
- [ ] Document known caveats (FastGPT web_search limitation, Summarizer size/engine constraints)

## Documentation Requirements

**Must Update:**
- `.pi/extensions/pi-kagi/README.md`

**Check If Affected:**
- `docs/kagi-api-capability-map.md`

## Completion Criteria

- [ ] FastGPT and Summarizer tools are callable and stable
- [ ] Parameter validation and errors are explicit
- [ ] References/tokens are preserved in normalized output

## Git Commit Convention

- `feat(TP-006): complete Step N — description`
- `test(TP-006): description`

## Do NOT

- Duplicate client transport logic from TP-004
- Implement smart routing/orchestration policy here

---

## Amendments (Added During Execution)

<!-- Worker-owned -->
