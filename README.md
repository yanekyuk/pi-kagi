# pi-kagi

`pi-kagi` is an extension for [pi](https://github.com/mariozechner/pi-coding-agent) that integrates [Kagi's powerful APIs](https://help.kagi.com/kagi/api/overview.html) directly into the agent's workflow.

It equips the agent with "smart web access" by providing high-quality, citation-backed context for LLM tasks.

## Features

- **🔍 Search:** Direct access to Kagi's premium search results with full metadata
- **⚡ FastGPT:** Get fast, LLM-generated answers powered by Kagi's search engine
- **📝 Universal Summarizer:** Summarize web content, documents, or audio files
- **🌐 Enrichment APIs:** Access the "small web" with non-commercial web (Teclis) and news (TinyGem) results
- **💰 Cost Tracking:** Built-in tracking of API costs per call

## Installation

### Via npm (when published)

```bash
pi install npm:pi-kagi
```

### Via git (current)

```bash
pi install git:github.com/yanekyuk/pi-kagi
```

### Project-local (development)

Clone this repository and install locally:

```bash
git clone https://github.com/yanekyuk/pi-kagi.git
pi install ./pi-kagi
```

## Configuration

Set your Kagi API key as an environment variable:

```bash
export KAGI_API_KEY=your_key_here
```

Or create a `.env` file in your project root:

```
KAGI_API_KEY=your_key_here
```

Get your API key from [kagi.com/settings](https://kagi.com/settings).

## Available Tools

Once installed, the following tools become available to the agent:

| Tool | Description | Cost |
|------|-------------|------|
| `kagi_search` | Web search with results | ~$0.015/query |
| `kagi_fastgpt` | AI-powered answers | ~$0.015/query |
| `kagi_summarize` | Summarize URLs or text | $0.03-$1/call |
| `kagi_enrich_web` | Non-commercial web results | ~$0.002/query |
| `kagi_enrich_news` | Non-commercial news results | ~$0.002/query |
| `kagi_smallweb` | Curated small web feed | Free |

## Commands

- `/kagi-about` — Show extension info and registered tools

## Development

This project uses [Taskplane](https://github.com/henry-lach/taskplane) for autonomous task orchestration. 

To view pending tasks:
```bash
/orch-plan all
```

To run tasks:
```bash
/orch all
```

## License

MIT
