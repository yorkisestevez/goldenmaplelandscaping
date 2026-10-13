import {useSyncExternalStore} from 'react';

/**
 * Internal designer mode. Proposals, PDFs, share links and "Send my design" do not create a lead, a CRM record,
 * an email or a warm-lead ping, and they skip conversion analytics and paid AI calls. Exports still work.
 *
 * Off unless this device has the staff token. `?internal=<token>` stores it; `window.deckcraft.setInternalMode`
 * turns it on or off. It is a staff switch so a public visitor cannot silence the lead form. It is not a
 * password for customer data: anyone who can read the page source can see the token.
 */
export const INTERNAL_MODE_TOKEN = 'gmint_7c4e9a1b6d2f48e0a5c3b791d0e64f28';
const KEY = 'deckcraft.internal-mode';
let on: boolean | undefined;
const listeners = new Set<() => void>();

function tokenMatches(value: string | null | undefined) {
  return value === INTERNAL_MODE_TOKEN;
}

function readStored(): boolean {
  let value = false;
  try {
    const query = new URLSearchParams(location.search).get('internal');
    value = tokenMatches(query) || tokenMatches(localStorage.getItem(KEY));
    if (tokenMatches(query)) localStorage.setItem(KEY, INTERNAL_MODE_TOKEN);
  } catch { /* storage or location unavailable */ }
  return value;
}

/** Throws when internal mode is on, before a design can be posted to the CRM. */
export function assertLeadsAllowed(): void {
  if (internalModeOn()) throw new Error('Internal designer mode is on. This design was not sent, and no lead or CRM record was created.');
}

/** True only after the staff token has been accepted on this device. */
export function internalModeOn(): boolean {
  if (on !== undefined) return on;
  if (typeof window === 'undefined') return false;
  return (on = readStored());
}

/**
 * Turn the mode on only with the staff token. Turning it off does not need the token.
 * Returns whether the requested state is now active.
 */
export function setInternalMode(enabled: boolean, token?: string): boolean {
  if (enabled && !tokenMatches(token)) return false;
  on = enabled;
  try {
    if (typeof localStorage !== 'undefined') {
      if (enabled) localStorage.setItem(KEY, INTERNAL_MODE_TOKEN);
      else localStorage.removeItem(KEY);
    }
  } catch { /* private window: keep the choice for this visit */ }
  for (const listen of listeners) listen();
  return true;
}

export const useInternalMode = () => useSyncExternalStore(
  listen => { listeners.add(listen); return () => { listeners.delete(listen); }; },
  internalModeOn,
  () => false,
);
