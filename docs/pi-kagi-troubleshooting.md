# pi-kagi Troubleshooting Guide

This guide is the diagnostics companion to `.pi/extensions/pi-kagi/README.md`.

## Document Boundary

- **README keeps the short error table:** enough to recognize common failures quickly.
- **This troubleshooting guide expands:** diagnostic flows, verification commands, fallback choices, and operator actions for known Kagi beta limitations.
- **`docs/pi-kagi-usage.md` covers happy-path usage:** setup, quick start, and tool-selection guidance live there.
- **README cross-links land in Step 4:** final README references will point here after both docs are complete.

## Fast Triage

Start with these two questions:

1. **Did `/kagi-about` load and show the extension?**
2. **Is the failure auth, access, billing, or timeout related?**

| Symptom | Likely cause | First action |
|---------|--------------|--------------|
| `/kagi-about` shows `API key: ❌ not set` | Missing env var / Pi config | Follow the auth flow below |
| Tool throws `401 Unauthorized` | Wrong or missing key | Re-export the key and restart Pi |
| `kagi_search` throws `403 Forbidden` | Search API beta/invite access missing | Switch to `kagi_enrich_*` or `kagi_smallweb`, then request access from Kagi |
| Tool throws `402 Payment Required` | API credits depleted | Check billing/credits and top up |
| FastGPT or Summarizer times out | Slow upstream response or large request | Retry with cache enabled, a shorter request, or a cheaper fallback |

## 1. Authentication and Configuration Failures

### Symptoms

- `/kagi-about` reports `API key: ❌ not set`
- tools fail with `401 Unauthorized`
- the extension loads, but every authenticated tool errors immediately

### Diagnostic flow

1. Check that the key is present in the current shell:

   ```bash
   printenv KAGI_API_KEY
   ```

2. If the command prints nothing, export the key again:

   ```bash
   export KAGI_API_KEY=your_key_here
   ```

3. Restart Pi from the same shell session:

   ```bash
   pi
   ```

4. Re-run the extension health check:

   ```text
   /kagi-about
   ```

### What success looks like

`/kagi-about` should report `API key: ✅ configured` and list the registered `kagi_*` tools.

### If it still fails

- Verify there are no extra spaces or shell quotes in the exported value.
- Make sure you restarted Pi after changing the variable.
- If you store secrets elsewhere (shell rc, direnv, Pi settings), confirm the current process actually sees `KAGI_API_KEY`.
- If the key exists but Kagi still returns `401`, generate a fresh token from <https://kagi.com/settings?p=api>.

## 2. Search API Beta-Access Problems

### Symptoms

- `kagi_search` returns `403 Forbidden`
- message mentions missing endpoint access or invite-only beta
- enrich tools work, but premium search does not

### Why this happens

Kagi's premium Search API is still limited / invite-only. A valid API key is **not** enough by itself if the account has not been granted Search API access.

### What to do

1. Confirm the failure is specific to `kagi_search` rather than all tools.
2. Switch to a manual fallback while waiting for access:
   - `kagi_enrich_web` for indie/community sources
   - `kagi_enrich_news` for current discussions
   - `kagi_smallweb` for discovery/browsing
3. Request Search API access from Kagi support / account channels.
4. Retry `kagi_search` only after access is confirmed.

### Operator note

This worktree does **not** yet include the TP-007 smart router, so the fallback must be chosen manually.

## 3. Insufficient Credits and Billing Checks

### Symptoms

- tool returns `402 Payment Required`
- error mentions insufficient credits or billing
- requests that used to work now fail consistently

### Diagnostic flow

1. Open Kagi billing:
   - <https://kagi.com/settings/billing_api>
2. Confirm the account has API credits available.
3. If credits were just added, retry the request from Pi.
4. Prefer cheaper tools while stabilizing usage:
   - `kagi_enrich_web` / `kagi_enrich_news` over `kagi_search`
   - cached `kagi_fastgpt` / `kagi_summarize` where appropriate

### Practical interpretation

Step 1 adds **estimated cost** footers to tool output. Use those as planning guidance, but do not treat them as authoritative billing records.

## 4. Timeout Behavior and Retry Guidance

### Current timeout budget

| Tool family | Timeout | Notes |
|-------------|---------|-------|
| `kagi_search`, `kagi_enrich_web`, `kagi_enrich_news` | 30s | Usually fast; repeated failures often indicate upstream issues or access problems |
| `kagi_fastgpt` | 60s | LLM-backed and more likely to be slow |
| `kagi_summarize` | 60s | Large or complex pages can take longer |
| `kagi_smallweb` | 30s | Feed lookup; normally lightweight |

### What happens on timeout

The client raises a `KagiTimeoutError` with the path and timeout window. Retryable upstream failures use exponential backoff internally, but a final timeout still bubbles up to the caller.

### What to try next

- Retry once if the request was transient.
- Leave `cache: true` enabled for `kagi_fastgpt` and `kagi_summarize` unless you specifically need fresh output.
- Use a smaller / more focused query.
- For summarization, prefer a URL over dumping extremely large pasted text.
- Fall back to `kagi_search` / `kagi_enrich_*` when FastGPT is too slow for the task.

## 5. Known Good Verification Path

If you're unsure whether the problem is fixed, use this sequence:

1. `printenv KAGI_API_KEY`
2. Start `pi`
3. Run `/kagi-about`
4. Try one low-risk tool first, such as `kagi_smallweb` or `kagi_enrich_web`
5. Only then retry `kagi_search`, `kagi_fastgpt`, or `kagi_summarize`

That sequence separates shell/config problems from endpoint-specific problems quickly.
