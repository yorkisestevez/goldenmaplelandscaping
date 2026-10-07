# Desktop, voice, and agent controls

Open **Describe a change**, then **Start voice control**. Grant browser microphone permission once. Clear requests without assumptions apply automatically through the existing validated controller; AI assumptions are displayed and spoken for approval. Uncheck **Apply changes automatically** to review each preview and say **apply**. Dictation-only **Talk** remains available.

Examples: “make the deck 20 by 14 feet”, “select Main deck” (or a listed object ID), “show me from above”, “undo”, “redo”, “cancel”, “stop”. Selection resolves unique existing names/IDs and asks when ambiguous. AI clarification answers can be spoken. The canvas displays the preview, and applied edits share the manual undo history. Selection settings are docked beside the canvas at desktop widths of 1280px and above.

Only final speech is submitted, after one second without more speech. The browser handles transcription. Speech output pauses recognition to prevent the assistant hearing itself. Listening resumes afterward and after ordinary silence. Closing, typing, backgrounding, or stopping ends the microphone session. Cancel aborts pending interpretation; an edit already committing must finish and can then be undone.

## Agent interface

- `window.deckcraft.describe()`: supported validated commands and contracts.
- `window.deckcraft.read()`: current public design, revision, quantities, issues, and history state.
- `window.deckcraft.preview(request)`: validate a proposed edit without committing.
- `window.deckcraft.execute(request)`: apply through the same revision checks and undo history.
- `window.deckcraftWorkspace.read()`: current selection and selectable named objects.
- `window.deckcraftWorkspace.select(nameOrId)`: select one unambiguous existing object or return a clarification. Read back after the UI renders. Pass “nothing” to clear.

Use a unique request ID and the current expectedRevision for edits. Never assume a command succeeded; inspect its response and read the rendered state. AI proposals remain limited to supported commands; this does not establish human-level capability across every workflow.

## Validation

Run `node node_modules/tsx/dist/cli.mjs scripts/check-deck-hands-free.ts`, existing voice/client/controller checks, TypeScript, a production build, and `e2e/deck-hands-free.spec.ts`. Browser tests simulate speech events and speech output; a real microphone/acoustic test is separate. Free-form AI requires the existing local assistant service and model; measured commands work without it.
