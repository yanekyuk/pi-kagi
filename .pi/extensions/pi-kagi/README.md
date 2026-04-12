# pi-kagi

**Pi skill for using Kagi API**

A [pi-coding-agent](https://github.com/nickvdp/pi-coding-agent) extension that integrates [Kagi's APIs](https://help.kagi.com/kagi/api/overview.html) as callable tools for the pi agent.

## Status

**Scaffold** — extension loads and registers a `/kagi-about` command. API tool implementations will follow in subsequent development phases.

## Installation

This extension is project-local. Place it at `.pi/extensions/pi-kagi/` and pi will auto-discover it on startup.

### Requirements

- A Kagi API key ([get one here](https://kagi.com/settings?p=api))
- Set the `KAGI_API_KEY` environment variable, or configure it in pi settings

### Quick Start

```bash
# Set your API key
export KAGI_API_KEY=your_key_here

# pi will auto-discover the extension when launched in this project
pi

# Verify the extension loaded
/kagi-about
```

## Available Commands

| Command | Description |
|---------|-------------|
| `/kagi-about` | Show extension version and status |

## Available Tools

*(None yet — will be added in future development)*

Planned tools:
- `kagi_search` — Premium search results
- `kagi_fastgpt` — LLM-generated answers with search
- `kagi_summarize` — Summarize URLs, text, or documents
- `kagi_enrich_web` — Non-commercial web results (Teclis index)
- `kagi_enrich_news` — Non-commercial news results
- `kagi_smallweb` — Kagi Small Web feed

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `KAGI_API_KEY` | — | Kagi API key (required) |
| Base URL | `https://kagi.com/api/v0` | Kagi API endpoint |

## Development

Extensions are loaded as TypeScript by pi's jiti runtime — no build step needed.

To test changes during development, use pi's `/reload` command to hot-reload the extension.

## Architecture

```
.pi/extensions/pi-kagi/
├── package.json     # Extension manifest
├── index.ts         # Entry point: registers commands and tools
└── README.md        # This file
```

## License

See the project root for license information.