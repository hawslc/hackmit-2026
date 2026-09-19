# hackmit-2026
hackmit project for 2026, education track

## Development

```sh
npm install                       # one-time, installs all workspaces
cp server/.env.example server/.env  # then add ELEVENLABS_API_KEY
npm run dev:server                # API on :3001
npm run dev:client                # vite dev server on :5173 (proxies /api)
npm run typecheck                 # all workspaces
```

- `shared/` — client↔server contract types + `computeSpeakingScore`. Announce changes in the team chat.
- `client/src/live/` — live capture: mic, Scribe realtime, recorder, pitch/volume, metrics. `DevHarness` is a scratch page until the real screens land.
- `server/src/routes/` — `/api/scribe-token` is live; `materials` and `review` are `TODO(ux)`/`TODO(ai)` stubs.
