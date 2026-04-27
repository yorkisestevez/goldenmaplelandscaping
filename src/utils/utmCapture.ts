/**
 * UTM + click-ID capture for attribution.
 *
 * On first page load with attribution params (utm_*, gclid, fbclid),
 * we stash them in sessionStorage so they survive route changes and
 * get appended to every form submission. The CRM's Netlify webhook
 * receiver expects these exact keys and uses them to bucket leads
 * into the right campaign.
 *
 * Without this, every paid-ad lead lands in the CRM as `source: 'website'`,
 * making per-campaign ROI impossible to measure.
 */

const STORAGE_KEY = 'gm_attribution';

const TRACKED_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'gclid',
  'fbclid',
] as const;

export interface AttributionPayload {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  gclid?: string;
  fbclid?: string;
  landing_page?: string;
  referrer?: string;
}

/** Run once on app boot. Reads URL params, persists to sessionStorage if any are new. */
export function initAttributionCapture(): void {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const incoming: Partial<AttributionPayload> = {};

  for (const param of TRACKED_PARAMS) {
    const value = url.searchParams.get(param);
    if (value && value.trim()) {
      incoming[param] = value.trim();
    }
  }

  // Only overwrite stored attribution if we got at least one param.
  // This way, a user who arrives via google-ads → navigates the site →
  // lands on the contact page (which won't have utms) → still has the
  // original google-ads attribution attached when they submit.
  if (Object.keys(incoming).length > 0) {
    const existing = readAttribution();
    const merged: AttributionPayload = {
      ...existing,
      ...incoming,
      landing_page: window.location.pathname + window.location.search,
      referrer: document.referrer || undefined,
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
      /* sessionStorage disabled, no-op */
    }
  } else if (!readAttribution()) {
    // No UTMs ever — still capture landing_page + referrer for the first visit
    const baseline: AttributionPayload = {
      landing_page: window.location.pathname + window.location.search,
      referrer: document.referrer || undefined,
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(baseline));
    } catch {
      /* no-op */
    }
  }
}

/** Read the persisted attribution payload, or null if none yet. */
export function readAttribution(): AttributionPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AttributionPayload;
  } catch {
    return null;
  }
}

/**
 * Get attribution as a flat object suitable for spreading into Netlify form
 * submissions. Empty fields are omitted (Netlify doesn't need them and the
 * CRM's coalesce logic handles missing fields cleanly).
 */
export function getAttributionFields(): Record<string, string> {
  const a = readAttribution();
  if (!a) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(a)) {
    if (typeof v === 'string' && v.trim()) out[k] = v;
  }
  return out;
}
