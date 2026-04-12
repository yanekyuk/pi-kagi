# pi-kagi

`pi-kagi` is an extension for the [pi-coding-agent](https://github.com/mariozechner/pi-coding-agent) that integrates [Kagi's powerful APIs](https://help.kagi.com/kagi/api/overview.html) directly into the agent's workflow.

It equips the agent with "smart web access" by intelligently routing intents to the most appropriate Kagi endpoint, providing high-quality, citation-backed context for LLM tasks.

## Features (Planned)

- **Search:** Direct programmable access to Kagi's premium search results.
- **FastGPT:** Get fast, LLM-generated answers powered by a full search engine underneath.
- **Universal Summarizer:** Summarize any web content, document, or audio file with unlimited token length.
- **Enrichment APIs:** Tap into the "small web" with non-commercial web and news results (Teclis and TinyGem indexes).
- **Smart Web Orchestrator:** An intelligent routing layer that automatically chooses the best Kagi endpoint based on the query intent.
- **Usage Cost Tracking:** Built-in tracking of API credits and token usage per call.

## Installation

*(Coming soon once implementation tasks are complete)*

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
