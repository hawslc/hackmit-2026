# hackmit-2026

hackmit project for 2026, education track

## Layout

An npm-workspaces monorepo:

| Package | What it is |
|---|---|
| [`shared/`](shared/src) | The contract: every type and constant that crosses client / server / ai-review. Source-only. |
| [`client/`](client/src) | React + Vite app (Setup → Practice → Review). `src/api/` holds the real HTTP client and a mock; `VITE_USE_MOCK_API` picks one. |
| [`server/`](server/src) | Express: file extraction, request validation, and routes that wrap `ai-review`. Holds no state. |
| [`ai-review/`](ai-review) | The LLM reviewers, orchestrator and synthesizer. See its README. |

Change a type in `shared/` and every package that disagrees stops compiling. Docs live in [`docs/`](docs).

## Commands

```bash
npm install
npm run dev         # server + client
npm run typecheck   # every workspace
npm test            # every workspace (offline, mock LLM provider)
npm run build
```
