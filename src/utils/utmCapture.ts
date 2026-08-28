/**
 * UTM, click-ID, and Persuasive Story AI V4 campaign attribution capture.
 * First-touch attribution is stored in localStorage so it survives future visits;
 * latest-touch values change only when campaign or variant URL parameters appear.
 */

const STORAGE_KEY = 'gm_attribution';
const IDENTIFIER_MAX_LENGTH = 128;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const ATTRIBUTION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

const TRACKED_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid',
] as const;
const CAMPAIGN_PARAMS = ['campaign_id', 'variant_id'] as const;

type CampaignParam = typeof CAMPAIGN_PARAMS[number];

export interface AttributionPayload {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  gclid?: string;
  fbclid?: string;
  campaign_id?: string;
  variant_id?: string;
  touch_id?: string;
  latest_campaign_id?: string;
  latest_variant_id?: string;
  latest_touch_id?: string;
  landing_page?: string;
  referrer?: string;
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    // localStorage is intentionally used rather than sessionStorage: first touch
    // must remain available when a prospect returns in a later browser session.
    return localStorage;
  } catch {
    return null;
  }
}

function validIdentifier(value: string | null): value is string {
  return Boolean(value && value.length <= IDENTIFIER_MAX_LENGTH && IDENTIFIER_PATTERN.test(value));
}

function createTouchId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `touch:${crypto.randomUUID()}`;
    }
  } catch {
    /* fall through to a bounded correlation ID */
  }
  return `touch:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 14)}`;
}

function safeText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength && !/[\u0000-\u001f\u007f]/.test(trimmed)
    ? trimmed
    : undefined;
}

function readIncoming(url: URL): Partial<AttributionPayload> {
  const incoming: Partial<AttributionPayload> = {};
  for (const param of TRACKED_PARAMS) {
    const value = safeText(url.searchParams.get(param), 500);
    if (value) incoming[param] = value;
  }
  for (const param of CAMPAIGN_PARAMS) {
    const value = url.searchParams.get(param)?.trim() ?? null;
    if (validIdentifier(value)) incoming[param] = value;
  }
  return incoming;
}

/** Run once on app boot and persist first touch plus an explicit latest campaign touch. */
export function initAttributionCapture(): void {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const incoming = readIncoming(url);
  const existing = readAttribution();
  const hasCampaignTouch = Boolean(incoming.campaign_id && incoming.variant_id);

  const baseline: AttributionPayload = existing ?? {
    landing_page: `${url.pathname}${url.search}`,
    referrer: document.referrer || undefined,
  };

  // Literal first touch is immutable. A later paid visit after an organic first
  // visit is represented only as latest touch; it does not rewrite history.
  const firstTouch: AttributionPayload = { ...baseline };
  if (!existing && hasCampaignTouch) {
    for (const param of CAMPAIGN_PARAMS) {
      if (incoming[param]) firstTouch[param] = incoming[param];
    }
    firstTouch.touch_id = createTouchId();
  }

  const merged: AttributionPayload = { ...firstTouch };
  for (const param of TRACKED_PARAMS) {
    if (!merged[param] && incoming[param]) merged[param] = incoming[param];
  }

  // UTMs/click IDs alone are not a V4 campaign touch. This prevents incidental
  // navigation from overwriting latest campaign/variant lineage.
  if (hasCampaignTouch) {
    for (const param of CAMPAIGN_PARAMS) {
      const value = incoming[param];
      if (value) merged[`latest_${param}` as keyof AttributionPayload] = value;
    }
    merged.latest_touch_id = !existing && firstTouch.touch_id
      ? firstTouch.touch_id
      : createTouchId();
  }

  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify({
      ...merged,
      _expires_at: Date.now() + ATTRIBUTION_TTL_MS,
    }));
  } catch {
    /* Storage can be disabled by browser privacy settings. */
  }
}

/** Read persisted attribution safely, including resilience to malformed legacy data. */
export function readAttribution(): AttributionPayload | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const input = parsed as Record<string, unknown>;
    const expiresAt = input._expires_at;
    if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      store.removeItem(STORAGE_KEY);
      return null;
    }
    const clean: AttributionPayload = {};
    for (const field of TRACKED_PARAMS) {
      const value = safeText(input[field], 500);
      if (value) clean[field] = value;
    }
    for (const field of [
      'campaign_id', 'variant_id', 'touch_id',
      'latest_campaign_id', 'latest_variant_id', 'latest_touch_id',
    ] as const) {
      const value = typeof input[field] === 'string' ? input[field] : null;
      if (validIdentifier(value)) clean[field] = value;
    }
    const landingPage = safeText(input.landing_page, 2048);
    const referrer = safeText(input.referrer, 2048);
    if (landingPage) clean.landing_page = landingPage;
    if (referrer) clean.referrer = referrer;
    return clean;
  } catch {
    return null;
  }
}

/** Flat form fields, omitting empty values for Netlify/CRM payloads. */
export function getAttributionFields(): Record<string, string> {
  const attribution = readAttribution();
  if (!attribution) return {};
  return Object.fromEntries(Object.entries(attribution).filter(([, value]) => typeof value === 'string' && value.trim())) as Record<string, string>;
}

/** Keep Meta browser/server dedup and V4 conversion lineage on one submission ID. */
export function getConversionEventFields(eventId: string): Record<'event_id' | 'conversion_event_id', string> {
  if (!validIdentifier(eventId)) throw new Error('invalid conversion event id');
  return { event_id: eventId, conversion_event_id: eventId };
}
