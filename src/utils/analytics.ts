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
 * Every function no-ops cleanly when the relevant ID is missing — safe to call
 * unconditionally from components.
 */

import { pushPage, pushClick, getBehaviorFields } from './behavior';
import { shouldFireLeadConversion, type LeadFormFields } from './leadQualification';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

const env = import.meta.env;
const GA4_ID = (env.VITE_GA4_ID as string | undefined)?.trim() || '';
const META_PIXEL_ID = (env.VITE_META_PIXEL_ID as string | undefined)?.trim() || '';
const GOOGLE_ADS_ID = (env.VITE_GOOGLE_ADS_ID as string | undefined)?.trim() || '';
const GOOGLE_ADS_LEAD_LABEL =
  (env.VITE_GOOGLE_ADS_LEAD_LABEL as string | undefined)?.trim() || '';
// Click to call — CID 513-052-1150. Do not use the page-load Contact label.
const GOOGLE_ADS_CALL_LABEL =
  (env.VITE_GOOGLE_ADS_CALL_LABEL as string | undefined)?.trim() ||
  'AW-10839158941/0CDHCIO2iPEbEJ3hwbAo';
const CLARITY_ID = (env.VITE_CLARITY_ID as string | undefined)?.trim() || '';

const isDev = env.DEV === true;
const isBrowser = typeof window !== 'undefined';

let initialized = false;

/** Boot gtag.js + Meta Pixel. Call once on app mount. Idempotent. */
export function initAnalytics(): void {
  if (!isBrowser || initialized) return;
  initialized = true;

  // ---- Google (gtag.js) — covers both GA4 and Google Ads ----
  // Skip a second script inject if the static HTML snippet already booted gtag.
  if ((GA4_ID || GOOGLE_ADS_ID) && typeof window.gtag !== 'function') {
    const primaryId = GA4_ID || GOOGLE_ADS_ID;
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${primaryId}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    // gtag.js only processes dataLayer entries that are `arguments` objects —
    // pushing a rest-param Array is silently ignored (no config, no events).
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments as unknown as unknown[]);
    } as Window['gtag'];
    window.gtag('js', new Date());
    if (GA4_ID) window.gtag('config', GA4_ID, { send_page_view: false });
    if (GOOGLE_ADS_ID) window.gtag('config', GOOGLE_ADS_ID);
  }

  // ---- Meta Pixel ----
  if (META_PIXEL_ID) {
    /* eslint-disable */
    (function (f: any, b: Document, e: string, v: string) {
      let n: any, t: any, s: any;
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      t = b.createElement(e) as HTMLScriptElement;
      t.async = true;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode!.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq?.('init', META_PIXEL_ID);
  }

  // ---- Microsoft Clarity (heatmaps + session recordings) ----
  if (CLARITY_ID) {
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

/** SPA page-view event. Call on every route change. */
export function trackPageView(path: string, title?: string): void {
  if (!isBrowser) return;
  if (GA4_ID) {
    window.gtag?.('event', 'page_view', {
      page_path: path,
      page_title: title || document.title,
      page_location: window.location.href,
    });
  }
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
 * Click-to-call conversion. Fires on every tel:7055003581 click.
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
