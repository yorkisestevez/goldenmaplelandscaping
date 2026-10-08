/**
 * Single source of truth for analytics + conversion tracking.
 *
 * Configured via Vite env vars (set in Netlify environment variables):
 *   VITE_GA4_ID                   — e.g. "G-XXXXXXXXXX"
 *   VITE_META_PIXEL_ID            — e.g. "2084193635490617"
 *   VITE_GOOGLE_ADS_ID            — e.g. "AW-1234567890"
 *   VITE_GOOGLE_ADS_LEAD_LABEL    — conversion action label for the "Lead" event,
 *                                   formatted as "AW-1234567890/AbCdEfGhIj"
 *   VITE_CLARITY_ID               — Microsoft Clarity project ID, e.g. "qxz1abc2de"
 *                                   Enables session recordings + heatmaps.
 *
 * Production builds keep the live IDs in this module even when env injection
 * is missing, so the post-deploy guard can still see them. Dev builds stay
 * dark unless the env vars are set. Every function no-ops cleanly when the
 * relevant ID is missing.
 *
 * Clarity and the Meta Pixel wait for the first interaction or ~3s, and only
 * load after advertising/analytics consent. gtag stays in the document head
 * (advanced Consent Mode) so Ads scanners still see the tag. Lead and call
 * events are never gated here — Consent Mode decides storage.
 */

import { pushPage, pushClick, getBehaviorFields } from './behavior';
import { shouldFireLeadConversion, type LeadFormFields } from './leadQualification';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
    clarity?: (...args: unknown[]) => void;
  }
}

const CONSENT_KEY = 'gm-consent';

/** Live IDs. Kept as literals so production bundles contain them. */
const GA4_ID =
  (import.meta.env.VITE_GA4_ID as string | undefined)?.trim() ||
  (import.meta.env.PROD ? 'G-1BRTV91W3Z' : '');
const META_PIXEL_ID =
  (import.meta.env.VITE_META_PIXEL_ID as string | undefined)?.trim() ||
  (import.meta.env.PROD ? '2084193635490617' : '');
const GOOGLE_ADS_ID =
  (import.meta.env.VITE_GOOGLE_ADS_ID as string | undefined)?.trim() ||
  (import.meta.env.PROD ? 'AW-10839158941' : '');
const GOOGLE_ADS_LEAD_LABEL =
  (import.meta.env.VITE_GOOGLE_ADS_LEAD_LABEL as string | undefined)?.trim() || '';
// Click to call — CID 513-052-1150. Do not use the page-load Contact label.
const GOOGLE_ADS_CALL_LABEL =
  (import.meta.env.VITE_GOOGLE_ADS_CALL_LABEL as string | undefined)?.trim() ||
  'AW-10839158941/0CDHCIO2iPEbEJ3hwbAo';
const CLARITY_ID =
  (import.meta.env.VITE_CLARITY_ID as string | undefined)?.trim() ||
  (import.meta.env.PROD ? 'wisgcj7yvw' : '');

const isDev = import.meta.env.DEV === true;
const isBrowser = typeof window !== 'undefined';

export type ConsentChoice = 'granted' | 'denied';

type ConsentState = 'granted' | 'denied';

const consentUpdate = (state: ConsentState) => ({
  ad_storage: state,
  analytics_storage: state,
  ad_user_data: state,
  ad_personalization: state,
});

export function readStoredConsent(): ConsentChoice | null {
  if (!isBrowser) return null;
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    if (value === 'granted' || value === 'denied') return value;
  } catch {
    /* private mode */
  }
  return null;
}

let initialized = false;
let metaArmed = false;
let pixelScriptRequested = false;
let clarityScriptRequested = false;
let deferredArmed = false;

function installFbqStub(): void {
  if (!isBrowser || window.fbq) return;
  const n = function fbq(this: { callMethod?: (...args: unknown[]) => void; queue: unknown[] }) {
    // eslint-disable-next-line prefer-rest-params
    const args = arguments;
    if (typeof this.callMethod === 'function') this.callMethod.apply(this, args as unknown as unknown[]);
    else this.queue.push(args);
  } as Window['fbq'] & { queue: unknown[]; loaded?: boolean; version?: string; push?: unknown };
  window.fbq = n;
  if (!window._fbq) window._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = '2.0';
  n.queue = [];
}

/** Queue Meta events immediately once consent is granted; the network script waits. */
function armMeta(): void {
  if (!isBrowser || !META_PIXEL_ID || metaArmed) return;
  metaArmed = true;
  installFbqStub();
  window.fbq?.('init', META_PIXEL_ID);
}

function loadMetaScript(): void {
  if (!isBrowser || !metaArmed || pixelScriptRequested) return;
  pixelScriptRequested = true;
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);
}

function loadClarity(): void {
  if (!isBrowser || !CLARITY_ID || clarityScriptRequested) return;
  clarityScriptRequested = true;
  /* eslint-disable */
  (function (c: any, l: Document, a: string, r: string, i: string) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
    const t = l.createElement(r) as HTMLScriptElement;
    t.async = true;
    t.src = 'https://www.clarity.ms/tag/' + i;
    const y = l.getElementsByTagName(r)[0];
    y.parentNode!.insertBefore(t, y);
  })(window, document, 'clarity', 'script', CLARITY_ID);
  /* eslint-enable */
}

function scheduleDeferredTrackers(): void {
  if (!isBrowser || deferredArmed || readStoredConsent() !== 'granted') return;
  deferredArmed = true;
  armMeta();
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    cleanup();
    loadMetaScript();
    loadClarity();
  };
  const events = ['pointerdown', 'keydown', 'touchstart'] as const;
  const cleanup = () => {
    events.forEach((event) => window.removeEventListener(event, start));
  };
  events.forEach((event) => window.addEventListener(event, start, { once: true, passive: true }));
  window.setTimeout(start, 3000);
}

export function applyConsent(choice: ConsentChoice): void {
  if (!isBrowser) return;
  try {
    localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    /* private mode */
  }
  window.gtag?.('consent', 'update', consentUpdate(choice));
  if (choice === 'granted') scheduleDeferredTrackers();
}

/** Boot gtag.js companions. Call once on app mount. Idempotent. */
export function initAnalytics(): void {
  if (!isBrowser || initialized) return;
  initialized = true;

  // The document head already loads gtag. This path covers a head-less boot.
  if ((GA4_ID || GOOGLE_ADS_ID) && typeof window.gtag !== 'function') {
    const primaryId = GA4_ID || GOOGLE_ADS_ID;
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${primaryId}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments as unknown as unknown[]);
    } as Window['gtag'];
    window.gtag('consent', 'default', { ...consentUpdate('denied'), wait_for_update: 500 });
    if (readStoredConsent() === 'granted') window.gtag('consent', 'update', consentUpdate('granted'));
    window.gtag('js', new Date());
    if (GA4_ID) window.gtag('config', GA4_ID, { send_page_view: false });
    if (GOOGLE_ADS_ID) window.gtag('config', GOOGLE_ADS_ID, { send_page_view: false });
  }

  if (readStoredConsent() === 'granted') scheduleDeferredTrackers();

  if (isDev) {
    // eslint-disable-next-line no-console
    console.log('[analytics] initialized', {
      ga4: GA4_ID || '(none)',
      meta: META_PIXEL_ID || '(none)',
      googleAds: GOOGLE_ADS_ID || '(none)',
      clarity: CLARITY_ID || '(none)',
    });
  }
}

/** One page_view per destination. send_to stops the event reaching every tag. */
export function trackPageView(path: string, title?: string): void {
  if (!isBrowser) return;
  const payload = {
    page_path: path,
    page_title: title || document.title,
    page_location: window.location.href,
  };
  if (GA4_ID) window.gtag?.('event', 'page_view', { ...payload, send_to: GA4_ID });
  if (GOOGLE_ADS_ID) window.gtag?.('event', 'page_view', { ...payload, send_to: GOOGLE_ADS_ID });
  window.fbq?.('track', 'PageView');
  pushPage(path, title);
  if (isDev) console.log('[analytics] pageview', path);
}

/**
 * Form-submission lead event. Fires GA4 generate_lead, Meta Pixel Lead,
 * and Google Ads conversion (if conversion label configured).
 *
 * @param formName — used as the GA4 form_name parameter and Meta content_category
 * @param tier     — funnel position ("high-intent" or "top-of-funnel")
 * @param value    — optional monetary value of the lead, in CAD
 * @param eventId  — UUID shared with the CAPI server-side event for Meta dedup
 * @param identifiers — optional user-provided email/phone for Enhanced
 *   Conversions for Leads. Passed PLAIN; gtag.js normalizes + SHA-256-hashes
 *   them in-browser. Lets Google match this lead — and a later offline "job
 *   won" upload keyed on the same hashed identifier — back to the ad click.
 * @param qualification — form payload used to drop honeypot/spam 200s.
 *   Sophie chat and booking skip this gate by form name.
 */
export function trackLead(
  formName: string,
  tier: 'high-intent' | 'top-of-funnel' = 'high-intent',
  value?: number,
  eventId?: string,
  identifiers?: { email?: string | null; phone?: string | null },
  qualification?: { payload?: LeadFormFields; skipQualification?: boolean },
): void {
  if (!isBrowser) return;

  const mergedPayload = {
    ...getBehaviorFields(),
    ...(qualification?.payload ?? {}),
  };
  if (!shouldFireLeadConversion(formName, mergedPayload, qualification?.skipQualification)) {
    if (isDev) console.log('[analytics] trackLead skipped (unqualified)', { formName, eventId });
    return;
  }

  if (GA4_ID) {
    window.gtag?.('event', 'generate_lead', {
      form_name: formName,
      tier,
      currency: 'CAD',
      value: value || 0,
    });
  }

  window.fbq?.(
    'track',
    'Lead',
    {
      content_name: formName,
      content_category: tier,
      currency: 'CAD',
      value: value || 0,
    },
    eventId ? { eventID: eventId } : undefined,
  );

  // Enhanced Conversions for Leads — set user-provided identifiers BEFORE the
  // conversion event so gtag attaches them to it. Plain values; gtag.js
  // normalizes + SHA-256-hashes them in-browser. Only set fields we have.
  if (GOOGLE_ADS_LEAD_LABEL && identifiers) {
    const ud: { email?: string; phone_number?: string } = {};
    if (identifiers.email && identifiers.email.trim()) ud.email = identifiers.email.trim();
    if (identifiers.phone && identifiers.phone.trim()) ud.phone_number = identifiers.phone.trim();
    if (ud.email || ud.phone_number) window.gtag?.('set', 'user_data', ud);
  }

  if (GOOGLE_ADS_LEAD_LABEL) {
    window.gtag?.('event', 'conversion', {
      send_to: GOOGLE_ADS_LEAD_LABEL,
      value: value || 0,
      currency: 'CAD',
    });
  }

  if (isDev) console.log('[analytics] trackLead', { formName, tier, value, eventId });
}

/**
 * Click-to-call conversion. Fires on configured public telephone-link clicks.
 * send_to is the existing Ads "Click to call" action — do not rename,
 * and do not fire the page-load Contact conversion from here.
 */
export function trackCall(label = 'phone_call'): void {
  if (!isBrowser) return;
  if (GA4_ID) {
    window.gtag?.('event', 'cta_click', { event_label: label });
  }
  if (GOOGLE_ADS_CALL_LABEL) {
    window.gtag?.('event', 'conversion', { send_to: GOOGLE_ADS_CALL_LABEL });
  }
  pushClick(label);
  if (isDev) console.log('[analytics] trackCall', label, GOOGLE_ADS_CALL_LABEL);
}

/** Generic engagement event for non-lead actions (PDF download, video play, etc). */
export function trackEngagement(action: string, label?: string): void {
  if (!isBrowser) return;
  if (GA4_ID) {
    window.gtag?.('event', action, { event_label: label });
  }
  window.fbq?.('trackCustom', action, label ? { label } : undefined);
  if (label) pushClick(label);
  if (isDev) console.log('[analytics] engagement', action, label);
}
