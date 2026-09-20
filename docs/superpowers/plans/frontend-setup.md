# Frontend Plan: Setup Screen (UX owner)

## Context
TA Practice Coach helps TAs rehearse recitation and get feedback. Per `docs/tasks.md`, the UX owner builds the Setup → Practice → Review screens. This session covers the **Setup screen only**, plus the minimum glue to hand off to the live-capture teammate. Review UI, live meters, transcription and recording are out of scope. No frontend code exists yet, so this includes scaffolding.

## Decisions agreed
- **Stack:** Vite + React + TypeScript + Tailwind in `client/`. No router (a simple `view` state) and no UI library.
- **Backend:** it doesn't exist yet, so all network calls go through one `api` module with a mock fallback.
- **Upload:** up to 5 lecture files, uploaded as soon as they're picked.
- **Key concepts:** extracted from the uploaded files via `POST /api/materials/concepts`, then shown as **fully editable chips**. The TA can remove any concept and add their own.
- **Start practice:** enabled even with no files. It **immediately requests mic permission**.
- **Recording:** it's live (mic → Scribe/MediaRecorder), never uploaded. Setup only *acquires the mic stream*. The live teammate owns everything after that.

## Setup screen
A single centered card with encouraging copy.
1. **Header:** app name and a one-line pitch ("Upload your materials, then teach out loud.").
2. **Materials (optional):**
   - An "Upload files" button plus drag-and-drop. It accepts `.pptx .pdf .docx .txt .md`, up to 5 files at 20 MB each.
   - Each file row shows name, size, status (uploading / ready / error) and a remove button. Errors are per row and can be removed alone.
   - Client-side validation gives friendly errors for too many files (the picker is disabled at 5), oversized files, wrong types and duplicate names. `.ppt .key .doc .pages` get an "export as .pptx / .docx / PDF" hint.
   - A truncation notice appears on a row if the server reports it (60k chars).
3. **Key concepts** (appears once at least one file is ready; hidden when there are no files, though the TA can still add their own):
   - After uploads settle, the client calls `POST /api/materials/concepts` with all ready files and shows "Finding key ideas…".
   - Results appear as removable chips. An "Add a concept" input (Enter or comma) lets the TA add their own. Duplicates (case-insensitive) and empty entries are ignored.
   - Each concept is tagged `extracted` or `user`. On re-extraction (files added or removed), extracted concepts are refreshed, user-added ones are kept, and concepts the TA removed stay dismissed for the session.
   - If extraction fails, the screen shows "Couldn't find key ideas automatically. You can add them yourself." with a Retry button. Starting is never blocked by it.
   - Helper text: "What should students walk away knowing?"
4. **Start practice** (primary button):
   - Disabled only while an upload or extraction is in flight, with hint text "Uploading…" or "Finding key ideas…".
   - Enabled with zero files. A small note says the content review is skipped without materials.
   - On click, `navigator.mediaDevices.getUserMedia({ audio: true })` is called **directly in the click handler**, and the button shows "Requesting microphone…".
   - Success: switch to the Practice screen and pass the material and the live `MediaStream`.
   - Denied, no device or insecure context: stay on Setup with a friendly inline error explaining how to re-enable the mic. Nothing is lost and the TA can retry.

## Practice screen (stub, integration point only)
`PracticeScreen({ material, stream, onFinish })`
- Shows "Live practice goes here (TODO(live))", a mic-active indicator and a **Finish** button.
- Finish stops all stream tracks and returns to Setup. Review is a later task.
- Passing the already-open stream avoids a second permission prompt and lets the live teammate use the same stream for Scribe, Web Audio and MediaRecorder.

## Data and API
- `LectureMaterial { files: SourceFile[], concepts: Concept[] }` lives in `App` state (the design has the client hold it).
- Types: use `shared/src/index.ts` once it exists. Until then, a temporary `client/src/types.ts` mirrors the names in `docs/design.md` and is marked `TODO: replace with shared`. Any shared-type change is announced to the team.
- `client/src/api/materials.ts`:
  - `uploadFile(file): Promise<SourceFile>` calls `POST /api/materials/file` (multipart, one file per request, in parallel).
  - `extractConcepts(files): Promise<Concept[]>` calls `POST /api/materials/concepts`.
  - Mock mode (env flag `VITE_USE_MOCK_API`, on by default until the server lands): simulates latency, returns a stub `SourceFile`, and returns a few canned concepts.
- A user-added concept is a `Concept` with `name` only (no source file or importance). The exact shape gets reconciled with the AI owner. `Concept` also needs a client-only `origin` flag (`extracted` | `user`) that's stripped or ignored when sent to the server.

## File layout
```
client/
  package.json, vite.config.ts, tsconfig*.json, index.html, .env.example
  src/
    main.tsx, App.tsx, index.css   (Tailwind)
    types.ts                       (temporary, mirrors shared)
    api/materials.ts
    lib/validateFile.ts            (limits, allowlist, error messages)
    screens/SetupScreen.tsx
    screens/PracticeScreen.tsx     (stub)
    components/FileUploader.tsx
    components/ConceptChips.tsx    (editable chips, extraction status, add input)
```
Dependencies are pinned exactly, using versions at least 7 days old (per `docs/tasks.md`).

## Out of scope
Review screen, live meters and transcript, Scribe, MediaRecorder, Web Audio, the server-side concept extraction itself, stretch goals (e.g. the live concept checklist).

## Assumptions to confirm with teammates
- The upload is multipart with field name `file`, and the response is a `SourceFile` (with an optional truncated flag).
- `POST /api/materials/concepts` takes the array of `SourceFile`s and returns `Concept[]`. `Concept` accepts just a name for user-added ones.
- Mic permission needs `localhost` or HTTPS (fine for dev and the demo).

## Verification
1. Run `npm run dev` in `client/` and open it in a browser (mock API on).
2. Upload 1 to 5 files: rows show uploading, then ready. Removing works. The 6th file is blocked. `.ppt`, oversized and duplicate files show friendly errors.
3. After uploads finish, "Finding key ideas…" runs and extracted chips appear. Remove one, add your own (duplicates ignored), then add or remove a file: extracted chips refresh, your own chips stay, and removed ones stay gone. Simulate an extraction failure: the error and Retry show, and Start still works.
4. Start is enabled with zero files and disabled while an upload or extraction is in flight.
5. Click Start: the browser mic prompt appears. Allow goes to the Practice stub with the mic indicator. Deny stays on Setup with an error, and retrying works. Finish releases the mic (the browser's recording indicator turns off).
6. `npm run build` and `tsc` pass. Check the layout at phone width.
