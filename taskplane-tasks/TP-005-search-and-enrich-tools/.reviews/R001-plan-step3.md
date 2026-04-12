# Plan Review: Step 3 — Register tools and prompt metadata

**Reviewer:** Automated Review  
**Date:** 2026-04-12  
**Step:** Step 3: Register tools and prompt metadata  
**Verdict:** ✅ Proceed with qualifications

---

## 1. Scope Reviewed

Per `STATUS.md`, Step 3 currently plans to:

1. Complete tool registration
2. Add `promptSnippet` / prompt guidelines
3. Ensure truncation strategy is applied

---

## 2. Current-State Fit

The plan is directionally right, but the scope is now narrower than `STATUS.md` suggests:

- `index.ts` already registers all four TP-005 tools:
  - `kagi_search`
  - `kagi_enrich_web`
  - `kagi_enrich_news`
  - `kagi_smallweb`
- The tool definitions already have solid, cost-aware `description` fields.
- Search/enrich/smallweb already apply `truncateHead` and tool-appropriate truncation notices.
- `bun test` is currently green (`85/85` passing), though there is still no test coverage for tool registration metadata.

So Step 3 is **not really a fresh registration step anymore**. It is mainly:
1. prompt metadata,
2. a quick registration audit,
3. a truncation regression check.

---

## 3. Findings / Qualifications

### 1) The Step 3 checklist is stale about “tool registration”
**Severity:** Medium

`STATUS.md` still treats tool registration as incomplete, but Step 2 already says enrich/smallweb were registered, and `index.ts` now confirms all four tools are wired.

That mismatch matters because it can cause unnecessary churn in `index.ts` or duplicate work during Step 3.

**What to change in the plan:**
- Mark the registration wiring as already complete.
- Reframe Step 3 as: **audit existing registrations + add prompt metadata + verify truncation remains in place**.
- Avoid rewriting the registration pattern unless a real defect is found.

---

### 2) The plan must specify concrete `promptSnippet` / `promptGuidelines` per tool
**Severity:** High

This is the main missing detail.

Per pi's extension docs:
- `promptSnippet` adds a tool to the one-line **Available tools** section.
- If `promptSnippet` is omitted, **custom tools are left out of that section**.
- `promptGuidelines` adds tool-specific bullets to the system prompt while the tool is active.

Right now the TP-005 tools have descriptions, but no prompt metadata. Descriptions alone are not enough if the goal of Step 3 is to improve LLM tool selection.

**What to add to the plan:**
- Explicit `promptSnippet` text for each tool
- Explicit `promptGuidelines` bullets for each tool
- A check that the copy reflects the routing rules from `docs/pi-kagi-architecture.md`

Without that, the plan is too vague for the step's main deliverable.

---

### 3) Prompt metadata should live in the tool modules, not in `index.ts`
**Severity:** Medium

Each tool already owns its `pi.registerTool()` call inside:
- `src/tools/search.ts`
- `src/tools/enrich.ts`
- `src/tools/smallweb.ts`

That means Step 3 should add `promptSnippet` and `promptGuidelines` **at the tool definition site**, not create a second metadata layer in the extension entrypoint.

This keeps each tool self-contained and avoids drift between:
- actual behavior,
- description text,
- prompt routing guidance.

**What to change in the plan:**
- Say “update tool definitions” rather than “add prompt metadata in the entrypoint.”
- Keep `index.ts` focused on invoking the registration helpers.

---

### 4) The prompt copy should be concise and contrastive
**Severity:** Medium

Because this metadata becomes part of the system prompt, too much prose will add noise. The useful part is not long explanations; it is clear differentiation between the tools.

The plan should explicitly aim for:
- **one short `promptSnippet`** per tool
- **~2 short guideline bullets** per tool
- wording that makes the tool boundaries obvious

The key distinctions to preserve are:
- **`kagi_search`** → default broad web search
- **`kagi_enrich_web`** → independent/blog/community/non-commercial perspectives
- **`kagi_enrich_news`** → recent news/current discussions
- **`kagi_smallweb`** → browsing/discovery/serendipity

If the plan just says “add guidelines” without a contrast strategy, the metadata is likely to become repetitive and much less useful.

---

### 5) Truncation should be treated as a regression check, not a new implementation task
**Severity:** Low

The current tool implementations already use `truncateHead` for long outputs, which satisfies the project requirement.

So Step 3 does **not** need a fresh truncation design. It only needs to ensure that prompt-metadata edits do not accidentally bypass or remove the existing truncation path.

**What to change in the plan:**
- Phrase this item as “verify truncation remains applied across all TP-005 tools.”
- Do not refactor truncation into `index.ts` or duplicate helpers unless an actual gap is found.

---

### 6) Add a lightweight metadata verification note for Step 4
**Severity:** Low

Current tests pass, but none verify that the registered tools expose:
- `description`
- `promptSnippet`
- `promptGuidelines`

This is easy to miss in review because the extension still loads and the tool logic still works.

**What to add to the plan:**
- A follow-up Step 4 test using a mocked `ExtensionAPI` (or equivalent) to assert that each TP-005 tool is registered with the expected prompt metadata.

This does not have to block Step 3, but it should be planned.

---

## 4. Suggested Prompt Strategy

To make Step 3 implementation-ready, I recommend adding a small table like this to the plan:

| Tool | `promptSnippet` | `promptGuidelines` |
|------|------------------|--------------------|
| `kagi_search` | `Search the web for general information with source links.` | `Use as the default web lookup when the user needs broad coverage or direct sources.`<br>`Prefer enrich_web for indie/community perspectives and enrich_news for recent news/discussions.` |
| `kagi_enrich_web` | `Find non-commercial web sources, blogs, and community discussions.` | `Use when the user wants blogs, forums, indie sites, or non-mainstream perspectives.`<br>`If coverage is sparse or the user needs comprehensive results, follow with kagi_search.` |
| `kagi_enrich_news` | `Find recent non-mainstream news and current discussions.` | `Use for latest/recent/news/headline requests and current-event discussion.`<br>`If you need broader factual coverage, supplement with or fall back to kagi_search.` |
| `kagi_smallweb` | `Browse curated Small Web posts from independent sites.` | `Use for discovery, browsing, and serendipitous exploration.`<br>`Do not treat it as exhaustive search coverage or breaking-news lookup.` |

This is short enough for prompt use and closely matches the routing guidance already documented in the architecture.

---

## 5. Recommendation

Proceed with Step 3, but tighten the plan first:

1. **Update the scope** to reflect that registration wiring is already done.
2. **Specify exact prompt metadata per tool** — this is the real deliverable of the step.
3. **Keep metadata in the tool modules**, not in a parallel `index.ts` mapping.
4. **Treat truncation as a verification item**, not a new design effort.
5. **Queue a small registration-metadata test** for Step 4.

With those adjustments, Step 3 becomes a small, low-risk polish step instead of a vague rework pass.
