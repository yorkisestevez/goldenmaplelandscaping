/**
 * Encode/decode a whole estimator build into a URL parameter.
 *
 * This is what sits behind the lead gate now. It is deliberately a REAL,
 * deliverable artifact: pure client-side, no backend, works the moment it's
 * generated. The estimator previously had no PDF generator anywhere in the
 * repo, so promising a PDF would have been a promise the site couldn't keep —
 * which is exactly the kind of phantom deliverable that erodes trust at the
 * conversion moment. A link that genuinely restores their build does not.
 *
 * Format: base64url of a compact JSON object with short keys. Versioned, so a
 * link someone saved months ago either restores correctly or is ignored
 * cleanly — never silently misinterpreted as a different build.
 */

import type { EstimateInput } from './estimateEngine';
import type { PaverTier } from '../data/carrPrices';
import type { EstimatorLocationKey } from '../data/locations';

const VERSION = 1;

export interface SavedBuild extends EstimateInput {
  targetBudget: number | null;
}

interface Packed {
  v: number;
  p: string | null;          // projectType
  e: string[];               // selectedElements
  s: Record<string, number | string>; // sizes
  d: Record<string, string>; // details
  c: string[];               // conditions that are TRUE
  l: string;                 // location
  t: string;                 // tier
  b: string;                 // paverBrandId
  k: string;                 // deckBrandId
  a: string[];               // addOns
  g: number | null;          // target budget
}

const toBase64Url = (s: string) =>
  btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromBase64Url = (s: string) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(escape(atob(b64 + '==='.slice((b64.length + 3) % 4))));
};

export function encodeBuild(build: EstimateInput, targetBudget: number | null): string {
  const packed: Packed = {
    v: VERSION,
    p: build.projectType,
    e: build.selectedElements,
    s: build.sizes,
    d: build.details,
    c: Object.entries(build.conditions).filter(([, on]) => on).map(([k]) => k),
    l: build.location,
    t: build.tier,
    b: build.paverBrandId,
    k: build.deckBrandId,
    a: build.addOns,
    g: targetBudget,
  };
  return toBase64Url(JSON.stringify(packed));
}

/** Returns null for anything malformed or from a future version — a bad link
 *  should start a fresh estimate, never a wrong one. */
export function decodeBuild(param: string): SavedBuild | null {
  try {
    const raw = JSON.parse(fromBase64Url(param)) as Partial<Packed>;
    if (raw.v !== VERSION) return null;
    if (typeof raw.s !== 'object' || raw.s === null) return null;

    const conditions: Record<string, boolean> = {
      access: false, slope: false, drainage: false, levels: false,
    };
    for (const k of Array.isArray(raw.c) ? raw.c : []) {
      if (k in conditions) conditions[k] = true;
    }

    return {
      projectType: typeof raw.p === 'string' ? raw.p : null,
      selectedElements: Array.isArray(raw.e) ? raw.e : [],
      sizes: raw.s as Record<string, number | string>,
      details: (typeof raw.d === 'object' && raw.d) ? raw.d as Record<string, string> : {},
      conditions,
      location: (typeof raw.l === 'string' ? raw.l : 'barrie') as EstimatorLocationKey,
      tier: (typeof raw.t === 'string' ? raw.t : 'mid') as PaverTier,
      paverBrandId: typeof raw.b === 'string' ? raw.b : 'permacon-mondrian-plus',
      deckBrandId: typeof raw.k === 'string' ? raw.k : 'timbertech-prime',
      addOns: Array.isArray(raw.a) ? raw.a : [],
      targetBudget: typeof raw.g === 'number' ? raw.g : null,
    };
  } catch {
    return null;
  }
}

/** Absolute URL that restores this exact build. */
export function buildPermalink(build: EstimateInput, targetBudget: number | null): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://goldenmaplelandscaping.ca';
  return `${origin}/cost-estimator?build=${encodeBuild(build, targetBudget)}`;
}
