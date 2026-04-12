# AGENTS.md — pi-kagi

## Project Overview

This is a greenfield TypeScript project building a Pi extension called `pi-kagi` that integrates with the Kagi search API. Extension lives at `.pi/extensions/pi-kagi/`. No build step — Pi loads `.ts` directly via jiti. Tests run with `bun test`.

## Model Switching via pi-model-switch

The `switch_model` tool lets you change models mid-conversation. Aliases are configured in `.pi/npm/node_modules/pi-model-switch/aliases.json`.

**Cost & rate tiers (ordered by preference):**

| Tier | Provider | Cost | Rate Limits | Use For |
|------|----------|------|-------------|---------|
| 1 — Best | `google-gemini-cli` | Free (subscription) | Generous | Everything — default fallback |
| 2 — Specialist | `openai-codex` | Free (subscription) | Low rate limit | Coding tasks only, expect throttling |
| 3 — Limited | `opencode-go` | $10/mo subscription | Session/weekly/monthly limits | Useful but may hit limits mid-session |
| 4 — Avoid | `opencode` (Zen) | Per-token $$ | — | Only if operator explicitly requests |
| 5 — Avoid | `huggingface` | Per-token $$ | — | Only if operator explicitly requests |
| 6 — Avoid | Claude (via opencode) | Per-token $$$$ | — | Only if operator explicitly requests |

**⚠️ Rate limit auto-switching (critical):**
- `opencode-go` has session-based rate limits. When it throws a rate limit error (429, quota exceeded, etc.), **immediately switch** to `google-gemini-cli/gemini-3.1-pro-preview` and continue working. Do not stop or ask — just switch and keep going.
- `openai-codex` also has low rate limits. If throttled, fall back to `google-gemini-cli/gemini-3.1-pro-preview`.
- `google-gemini-cli` is the safest tier — always prefer it when other providers are rate-limited.

**Workflow:**
- **Quick questions / simple tasks:** switch to "cheap" (Gemini Flash)
- **Coding / implementation:** switch to "coding" (Codex → Gemini Pro → GLM-5.1 fallback chain)
- **Deep reasoning / architecture:** switch to "thinking" (Gemini Pro → kimi-k2.5)
- **Code review:** switch to "review" (Gemini Pro)
- **Large context needed:** switch to "big-context" (Gemini Pro 1M ctx → MiMo V2 Pro)
- **Rate-limited on opencode-go or openai-codex:** switch to "thinking" or "coding" to hit the Gemini fallback

**Never switch to a paid model (opencode, huggingface, Claude) without asking the operator first.**

Other actions: `action="list"` to see all models, `action="search"` to filter by name/provider.

**Note:** `aliases.json` is stored at `.pi/model-switch-aliases.json` (project-local, version-controlled) and symlinked into `node_modules/pi-model-switch/aliases.json` for the extension to pick up. If you run `pi install npm:pi-model-switch` and node_modules gets wiped, re-create the symlink:
```
ln -sf $(pwd)/.pi/model-switch-aliases.json .pi/npm/node_modules/pi-model-switch/aliases.json
```