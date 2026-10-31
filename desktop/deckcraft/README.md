# DeckCraft desktop app

An Electron shell around the standalone DeckCraft build. The app serves `dist/deckcraft` over a private `app://deckcraft` scheme and makes no network requests: remote fonts, analytics, the deck assistant and the send form do not work in it.

| Command (from the repo root) | What it does |
|---|---|
| `npm run build:deckcraft` | Builds the designer page alone into `dist/deckcraft` (`vite.config.ts` here), then checks it against its size budget (`scripts/check-deckcraft-desktop-bundle.ts`). |
| `npm run desktop:test` | Tests the request handler (`appServer.cjs`). |
| `npm run desktop:start` | Runs the shell against `dist/deckcraft`. Run `npm --prefix desktop/deckcraft install` once first. |
| `npm run desktop:dist` | Builds the page, installs this folder's tools, and writes the Windows installer to `desktop/deckcraft/release/`. |

- The installer is unsigned NSIS and installs per user to `%LOCALAPPDATA%\Programs\DeckCraft`. The `appId` (`ca.goldenmaplelandscaping.deckcraft`) must not change: it keeps a new installer upgrading the installed app in place.
- Bump `version` in `package.json` for every installer you hand out.
- Saved designs live in the app's own storage (`%APPDATA%\DeckCraft`) and survive upgrades.
