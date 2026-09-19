# Task division

Three owners, split along the architecture in [design.md](design.md) so we can work in parallel
without stepping on each other. Stubs in the code will be tagged `TODO(live)`, `TODO(ai)` or
`TODO(ux)`. Grep for your tag.

| Owner | Tag | Area |
|---|---|---|
| **Live capture** | `live` | The practice session: "Start practice" → mic → Scribe live transcription (+ `/api/scribe-token`), recorder, Web Audio pitch/volume, delivery metrics (WPM, pauses, fillers), speaking score, live meters, "Finish" |
| **AI review** | `ai` | The LLM helper (OpenAI / Llama), concept extraction from materials, the three reviewers (delivery tips, content gaps, teaching skills), the synthesizer, all prompts, and [rubric.md](rubric.md) |
| **Materials + UX + demo** | `ux` | Materials upload (up to 5 files: pptx, pdf, docx, txt, md) and file-to-text extraction, the Setup → Practice → Review screens, review UI (speaking score card, content gaps, teaching scores, recording playback), styling, demo script, stretch goals |

## Order of work

1. **Live** lands the mic and `/api/scribe-token` first. Everything live depends on them.
2. **AI** and **UX** start right away against mock mode (`LLM_PROVIDER=mock`), which returns
   canned concepts and reviews without any API keys.
3. Swap mocks for the real thing piece by piece. Mock mode stays as the demo fallback.

## Working agreements

- **Shared types are the contract.** Everything that crosses between client and server lives in
  `shared/`. Announce in the team chat before changing a type, because it breaks the other side
  at compile time.
- **The rubric is the source of truth for review prompts.** Change [rubric.md](rubric.md) first,
  then the prompts and types.
- **Pin dependencies exactly**, using versions at least 7 days old.
