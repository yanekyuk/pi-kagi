# Code Review: Step 3 — Register tools and prompt metadata

**Reviewer:** Automated Review  
**Date:** 2026-04-12  
**Step:** Step 3: Register tools and prompt metadata  
**Verdict:** ✅ Approve with minor cleanup

---

## Scope Reviewed
Diff vs baseline `65b4af6`:
- `.pi/extensions/pi-kagi/index.ts`
- `.pi/extensions/pi-kagi/src/formatters/results.ts`
- `.pi/extensions/pi-kagi/src/tools/search.ts`
- `.pi/extensions/pi-kagi/src/tools/enrich.ts`
- `.pi/extensions/pi-kagi/src/tools/smallweb.ts`

## Validation
- Ran `git diff 65b4af6..HEAD --name-only`
- Ran `git diff 65b4af6..HEAD`
- Read all changed files for context
- Ran `cd .pi/extensions/pi-kagi && bun test` → **85 pass, 0 fail**
- Spot-checked the shared truncation helpers with synthetic search/smallweb payloads; final outputs stayed within pi's `50KB / 2000 lines` limits for representative valid inputs

---

## What looks good
- ✅ `promptSnippet` / `promptGuidelines` were added at the tool definition site, which is the right place for pi tool-selection metadata.
- ✅ `kagi-about` now derives its tool list from `pi.getAllTools()`, which removes the duplicated hand-maintained table from the entrypoint.
- ✅ The shared truncation helper now reserves room for truncation notices instead of blindly appending them after a max-sized payload.
- ✅ The prompt copy clearly differentiates general search vs enrich web vs enrich news vs smallweb browsing.

---

## Finding

### 1) `index.ts` now contains a raw NUL byte, so Git treats the entrypoint as a binary file
**Severity:** Low  
**Location:** `.pi/extensions/pi-kagi/index.ts:26`

`summarizeDescription()` currently contains a literal `0x00` byte inside the regex used by `replace(...)`. Because of that, the required review command:

```bash
git diff 65b4af6..HEAD
```

reports `index.ts` as a **binary file** instead of showing a normal text diff. That makes future reviews harder and can confuse tooling/editors that expect a plain UTF-8 TypeScript source file.

The line should use an escaped NUL pattern (`/\0/g`) if you really want that sanitization, or just remove the sanitization entirely if it is unnecessary.

**Suggested fix:** replace the raw control byte with a normal text escape, e.g.

```ts
return firstSentence?.trim().replace(/\0/g, "") ?? description;
```

---

## Recommendation
Step 3 is otherwise in good shape and the earlier truncation/help-text issues appear resolved. I would merge this after removing the stray NUL byte. Step 4 should still add a lightweight registration test for the TP-005 `promptSnippet` / `promptGuidelines` metadata.
