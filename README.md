# hackmit-2026

hackmit project for 2026, education track

## Layout

An npm-workspaces monorepo:

| Package | What it is |
|---|---|
| [`shared/`](shared/src) | The contract: every type and constant that crosses client / server / ai-review. Source-only. |
| [`client/`](client/src) | React + Vite app (Setup → Practice → Review). `src/api/` is the HTTP client that talks to the server. |
| [`server/`](server/src) | Express: file extraction, request validation, and routes that wrap `ai-review`. Holds no state. |
| [`ai-review/`](ai-review) | The LLM reviewers, orchestrator and synthesizer. See its README. |

### Real AI instead of mocks

Everything runs offline on mocks by default. To use real OpenAI (key-concept extraction and reviews),
flip both switches:

1. Root `.env`: `LLM_PROVIDER=openai` and `OPENAI_API_KEY=...`
2. `client/.env.local`: `VITE_USE_MOCK_API=false`

If the key is missing or OpenAI fails, the Setup screen shows a "Couldn't find key ideas" banner with Retry,
and the TA can still add concepts by hand.

Change a type in `shared/` and every package that disagrees stops compiling. Docs live in [`docs/`](docs).

## Commands

```bash
npm install
npm run dev         # server + client
npm run typecheck   # every workspace
npm test            # every workspace (offline, mock LLM provider)
npm run build
```
