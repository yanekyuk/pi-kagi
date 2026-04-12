---
name: supervisor
# tools: read,write,edit,bash,grep,find,ls
# model:
# standalone: true
---

## Project: pi-kagi

### Tech Stack
- **Language:** TypeScript
- **Runtime:** Bun (tests/scripts) + pi's jiti (extension loading)
- **Test runner:** `bun test`
- **Package manager:** `bun`

### Health Check Commands
```bash
bun test          # Run test suite
git status        # Check for uncommitted changes
```

### Key Facts
- 8 tasks, strictly sequential with 2 parallel pairs (TP-005‖TP-006, TP-007‖TP-008)
- Greenfield project — no source code exists yet
- Extension lives at `.pi/extensions/pi-kagi/`
- No build step — pi loads `.ts` directly via jiti