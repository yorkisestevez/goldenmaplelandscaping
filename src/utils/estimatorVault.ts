/**
 * Estimator vault — the device-local memory behind "first estimate free,
 * email unlocks repeats".
 *
 * localStorage `gm_estimator` holds the visitor's unlock state (email, when)
 * and their last few completed estimates (permalink + summary), so a returning
 * visitor can reopen and compare builds. Same defensive read/write pattern as
 * utils/behavior.ts: every storage touch is try/catch'd and the module is
 * SSR-safe — the prerender never executes a read because all callers live in
 * effects/handlers.
 *
 * Privacy posture: the email lives here only so the device stays unlocked.
 * It is sent ONCE, to the `estimator-unlock` Netlify form (→ CRM bridge),
 * at the moment the visitor submits it — never re-transmitted after that.
 */

const KEY = 'gm_estimator';
const MAX_ESTIMATES = 10;

export interface VaultEstimate {
  id: string;
  savedAt: string; // ISO
  permalink: string;
  projectType: string;
  city: string;
  sqft: number;
  /** Pre-tax subtotal in cents — matches the headline the visitor saw. */
  subtotalCents: number;
}

export interface EstimatorVault {
  email: string | null;
  unlockedAt: string | null;
  estimates: VaultEstimate[];
}

const EMPTY_VAULT: EstimatorVault = { email: null, unlockedAt: null, estimates: [] };

export function readVault(): EstimatorVault {
  if (typeof window === 'undefined') return EMPTY_VAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_VAULT;
    const parsed = JSON.parse(raw) as Partial<EstimatorVault>;
    return {
      email: typeof parsed.email === 'string' ? parsed.email : null,
      unlockedAt: typeof parsed.unlockedAt === 'string' ? parsed.unlockedAt : null,
      estimates: Array.isArray(parsed.estimates) ? parsed.estimates.slice(0, MAX_ESTIMATES) : [],
    };
  } catch {
    return EMPTY_VAULT;
  }
}

function writeVault(v: EstimatorVault): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    // Storage full / blocked — the estimator still works, just doesn't remember.
  }
}

export function isUnlocked(): boolean {
  return readVault().unlockedAt !== null;
}

export function unlockVault(email: string): void {
  const v = readVault();
  writeVault({ ...v, email: email || v.email, unlockedAt: v.unlockedAt ?? new Date().toISOString() });
}

/** Record a completed estimate. Dedupes on permalink so a re-render or a
 *  workbench tweak followed by another look doesn't spam the list — the most
 *  recent version of the same build replaces it. */
export function recordEstimate(e: Omit<VaultEstimate, 'id' | 'savedAt'>): void {
  const v = readVault();
  const rest = v.estimates.filter(x => x.permalink !== e.permalink);
  const entry: VaultEstimate = {
    ...e,
    id: `est_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    savedAt: new Date().toISOString(),
  };
  writeVault({ ...v, estimates: [entry, ...rest].slice(0, MAX_ESTIMATES) });
}
