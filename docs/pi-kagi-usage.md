# pi-kagi Usage Guide

This guide extends `.pi/extensions/pi-kagi/README.md` instead of duplicating it.

## Document Boundary

- **README stays concise:** installation, available tools, reference-style examples, and release-level constraints.
- **This usage guide expands:** operator onboarding, quick-start workflow, manual-routing patterns, and a compact tool-selection cheat sheet.
- **`docs/pi-kagi-troubleshooting.md` owns diagnostics:** auth, beta-access, billing, and timeout resolution steps.
- **README cross-links land in Step 4:** once both operator docs exist, the README will link here rather than copying the full walkthrough.

## Setup Checklist

1. Confirm the extension is present at `.pi/extensions/pi-kagi/`.
2. Export a valid Kagi API key before launching Pi:

   ```bash
   export KAGI_API_KEY=your_key_here
   ```

3. Start Pi from the repository root:

   ```bash
   pi
   ```

4. Verify the extension loaded:

   ```text
   /kagi-about
   ```

5. If the command reports `API key: ❌ not set`, stop and follow the auth flow in `docs/pi-kagi-troubleshooting.md`.

## Five-Minute Quick Start

### 1. Check extension health

Run `/kagi-about` first. It confirms whether Pi discovered the extension and whether `KAGI_API_KEY` is configured.

### 2. Start with the narrowest useful tool

The current worktree ships **individual tools**, not the planned TP-007 orchestrator. That means operators should choose the tool explicitly based on the task:

- start with `kagi_search` for broad web lookup
- use `kagi_enrich_web` or `kagi_enrich_news` when you want lower-cost niche sources
- use `kagi_fastgpt` when you want a synthesized answer with citations
- use `kagi_summarize` for a specific URL or pasted text
- use `kagi_smallweb` for browsing and discovery

### 3. Watch the cost note in tool output

Step 1 hardening added a consistent `[Estimated cost: ...]` footer to current tool outputs. Treat that as **guidance**, not TP-008-grade accounting:

- it helps compare tools before repeated use
- it does **not** replace per-call billing data or cumulative usage reporting
- cached FastGPT and Summarizer requests may effectively cost `$0.00` on repeat, but that depends on Kagi cache hits

### 4. Keep a manual fallback in mind

Because the orchestrator is not present yet in this worktree, use these manual fallbacks yourself:

- if `kagi_enrich_web` is sparse, retry with `kagi_search`
- if `kagi_enrich_news` is too narrow, supplement with `kagi_search`
- if a user gives you a URL and also wants outside context, pair `kagi_summarize` with `kagi_search`
- if `kagi_fastgpt` is overkill, answer with `kagi_search` or `kagi_enrich_*` results directly

## Tool-Selection Cheat Sheet

| If the operator wants... | Use this tool | Why | Manual fallback |
|--------------------------|---------------|-----|-----------------|
| broad web coverage with direct citations | `kagi_search` | best default for general research | `kagi_enrich_web` / `kagi_enrich_news` if Search API access is unavailable |
| blogs, forums, or independent perspectives | `kagi_enrich_web` | cheaper niche-source lookup | `kagi_search` if results are sparse |
| recent discussions or non-mainstream news | `kagi_enrich_news` | tuned for current discussions | `kagi_search` for broader background |
| a synthesized answer with citations | `kagi_fastgpt` | returns grounded prose instead of raw links | `kagi_search` if latency/cost is too high |
| a summary of one URL or pasted document | `kagi_summarize` | purpose-built for direct summarization | pair with `kagi_search` for outside context |
| exploratory browsing and discovery | `kagi_smallweb` | curated feed of independent sites | `kagi_enrich_web` if you need targeted lookup |

### Quick decision rules

- **Question about the web at large?** Start with `kagi_search`.
- **Need smaller, cheaper, or more indie sources?** Try `kagi_enrich_web` or `kagi_enrich_news`.
- **Need an answer, not just links?** Use `kagi_fastgpt`.
- **Got a specific URL or pasted text?** Use `kagi_summarize`.
- **Just browsing?** Use `kagi_smallweb`.

## Manual-Routing Workflow Patterns

## Broad research with direct citations

Use `kagi_search` when the user wants mainstream coverage, direct citations, or a general web lookup.

```json
{
  "tool": "kagi_search",
  "arguments": {
    "query": "sqlite wal checkpoint behavior",
    "limit": 5
  }
}
```

**Expected outcome:** numbered citations, snippets, related searches, and an estimated-cost footer.

## Independent perspectives and blogs

Use `kagi_enrich_web` when the user wants community posts, blogs, or non-commercial viewpoints.

```json
{
  "tool": "kagi_enrich_web",
  "arguments": {
    "query": "litestream production lessons"
  }
}
```

**Manual fallback:** if coverage is sparse, follow up with `kagi_search`.

## Recent discussions and current events

Use `kagi_enrich_news` for current discussions, interesting non-mainstream news, or "what's new lately?" prompts.

```json
{
  "tool": "kagi_enrich_news",
  "arguments": {
    "query": "recent browser engine news"
  }
}
```

**Manual fallback:** use `kagi_search` when you need broader background or more conventional sources.

## Synthesized answer with citations

Use `kagi_fastgpt` when the operator wants a grounded answer rather than raw links.

```json
{
  "tool": "kagi_fastgpt",
  "arguments": {
    "query": "What changed in Python 3.11?",
    "cache": true
  }
}
```

**Good fit:** explainers, comparisons, and "give me the answer with sources" requests.

## Summarize a specific source

Use `kagi_summarize` when the input is a URL or pasted text that should be condensed directly.

### URL summarization

```json
{
  "tool": "kagi_summarize",
  "arguments": {
    "url": "https://example.com/article",
    "engine": "agnes",
    "summary_type": "takeaway",
    "target_language": "EN"
  }
}
```

### Pasted text summarization

```json
{
  "tool": "kagi_summarize",
  "arguments": {
    "text": "Short pasted text to summarize.",
    "summary_type": "summary"
  }
}
```

**Remember:** provide exactly one of `url` or `text`.

## Browse the Small Web

Use `kagi_smallweb` when the task is exploratory and serendipitous rather than exhaustive.

```json
{
  "tool": "kagi_smallweb",
  "arguments": {
    "limit": 5
  }
}
```

**Best for:** discovering independent sites, personal blogs, and interesting recent posts.

## Daily-Use Operator Notes

- Start sessions with `/kagi-about` if you're unsure whether the extension or API key is loaded.
- Prefer cached `kagi_fastgpt` / `kagi_summarize` calls unless you specifically need a fresh answer.
- Treat `kagi_search` as the premium, broad-coverage option and `kagi_enrich_*` as the cheaper niche-source option.
- If the Search API returns an access error, see `docs/pi-kagi-troubleshooting.md` for beta-access guidance before retrying repeatedly.
- When a user asks for both a summary and outside verification, combine `kagi_summarize` with either `kagi_search` or `kagi_enrich_web`.
