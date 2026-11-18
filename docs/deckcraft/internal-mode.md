# DeckCraft internal mode

Internal mode is for the office design assistant. While it is on, opening a proposal or PDF, creating a share link, or pressing **Send my design** does not create a lead, a CRM record, an email, or a warm-lead ping. Conversion analytics (`deckcraft_send`, `deck_warm_*`, and the lead conversion on send) are skipped, and paid AI calls are not made. Proposal, PDF, permit set, DXF, OBJ, JSON, ZIP, and share links still work.

The public page is unchanged until the staff token is accepted on that browser.

## Turn it on

Token: `gmint_7c4e9a1b6d2f48e0a5c3b791d0e64f28`

Any one of these works:

- Open the designer with `?internal=gmint_7c4e9a1b6d2f48e0a5c3b791d0e64f28` (also `/cost-estimator?type=deck&internal=...`). The token is stored in `localStorage` under `deckcraft.internal-mode`.
- In the page console, after the designer has loaded:

  ```js
  window.deckcraft.setInternalMode(true, 'gmint_7c4e9a1b6d2f48e0a5c3b791d0e64f28')
  window.deckcraft.internalMode() // true
  ```

- Set `localStorage['deckcraft.internal-mode']` to that same token and reload.

A small **Internal · no leads** badge shows in the header while the mode is on.

## Turn it off

```js
window.deckcraft.setInternalMode(false)
```

or remove the `deckcraft.internal-mode` key and reload without the URL flag.

A wrong token does not turn the mode on. The token stops a casual visitor from silencing the lead form. It is not a password: it ships in the page so the in-page assistant can use it.
