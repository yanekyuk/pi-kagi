---
name: task-merger
# tools: read,write,edit,bash,grep,find,ls
# model:
# standalone: true
---

## Project: pi-kagi

### Post-Merge Verification
After merging a lane branch, run:
```bash
bun test
```

### Tech Stack
- **Language:** TypeScript
- **Runtime:** Bun (tests/scripts) + pi's jiti (extension loading)
- **Package manager:** `bun`
- **No build step** — pi loads `.ts` extensions directly via jiti

### Merge Notes
- Extension files are `.ts` — no transpilation needed
- If `package.json` exists in the extension dir, run `bun install` after merge if lockfile changed
- Check that `peerDependencies` does NOT include pi-bundled packages that are already available at runtime