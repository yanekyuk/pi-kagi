# Code Review: Step 3 — Register tools and prompt metadata

**Reviewer:** Automated Review  
**Date:** 2026-04-12  
**Step:** Step 3: Register tools and prompt metadata  
**Verdict:** ❌ Changes requested

---

## Scope Reviewed
Diff vs baseline `65b4af6`:
- `.pi/extensions/pi-kagi/index.ts`
- `.pi/extensions/pi-kagi/src/formatters/results.ts`
- `.pi/extensions/pi-kagi/src/tools/search.ts`
- `.pi/extensions/pi-kagi/src/tools/enrich.ts`
- `.pi/extensions/pi-kagi/src/tools/smallweb.ts`
- task status doc

## What looks good
- ✅ `promptSnippet` and `promptGuidelines` were added at the tool definition site, which matches pi’s extension model and keeps the registration metadata close to behavior.
- ✅ The prompt copy is concise and clearly differentiates the four TP-005 tools.
- ✅ Truncation logic was deduplicated into shared helpers instead of being copied in three tool modules.
- ✅ Extension tests still pass: `cd .pi/extensions/pi-kagi && bun test` → 85 pass.

---

## Findings

### 1) The new shared truncation helpers can return outputs above pi’s hard 50KB / 2000-line limits
**Severity:** High  
**Location:** `.pi/extensions/pi-kagi/src/formatters/results.ts:163-191`

`truncateSearchOutput()` and `truncateSmallWebOutput()` call `truncateHead()` with pi’s default limits, but then append a truncation notice **after** the truncation step:

```ts
const truncation = truncateHead(formatted, {
  maxLines: DEFAULT_MAX_LINES,
  maxBytes: DEFAULT_MAX_BYTES,
});
...
return truncation.content + truncationNotice(...)
```

That means the final tool output can exceed the contract you are trying to enforce. This now affects all three TP-005 result paths (`kagi_search`, both enrich tools, and `kagi_smallweb`) because they all route through these helpers.

I reproduced this locally:
- a 2000-line search payload returns **2002 lines** after the notice is appended
- a byte-truncated payload returned **51274 bytes** with `DEFAULT_MAX_BYTES === 51200`

This conflicts with the project requirement that tool output be truncated to 50KB / 2000 lines.

**Suggested fix:** reserve room for the notice before the initial truncation, or do a second bounded truncation pass that guarantees the final returned string (including the notice) stays within `DEFAULT_MAX_LINES` / `DEFAULT_MAX_BYTES`.

---

### 2) `kagi-about` now introduces a second hard-coded tool metadata table that can drift from the real registrations
**Severity:** Low  
**Location:** `.pi/extensions/pi-kagi/index.ts:19-24,65-71`

Step 3 correctly put the real prompt metadata on each `pi.registerTool()` call, but `index.ts` also adds a separate `AVAILABLE_TOOLS` array with hand-maintained summaries for `/kagi-about`.

That creates a second metadata source for the same tool set:
- tool name / description / prompt metadata live in `src/tools/*.ts`
- command help text lives in `AVAILABLE_TOOLS`

This is easy to forget during later TP-006/TP-007 work, and the command output can silently drift from the actual registered tools or their current wording.

**Suggested fix:** derive the help output from the registered tools (`pi.getAllTools()`), or at least reuse shared constants exported from the tool modules so the help text and tool registrations stay in sync.

---

## Minor notes
- Non-blocking, but Step 4 should add a lightweight registration test that asserts each TP-005 tool exposes the expected `promptSnippet` / `promptGuidelines`.

## Recommendation
Please fix Finding #1 before approving Step 3. Finding #2 is lower risk, but worth cleaning up while this metadata work is still fresh.
