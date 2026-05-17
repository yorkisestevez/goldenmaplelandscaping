/**
 * Per-visitor browsing-behavior capture.
 *
 * Companion to utmCapture.ts. Where utmCapture answers "where did this lead
 * come from?", this answers "what did they actually do on the site before
 * converting?" — every page visited, every CTA clicked, dwell time per page,
 * total visit count, plus a deep-link to their Clarity session recording.
 *
 * Same pattern as utmCapture: store client-side, expose a flat-object
 * getter, spread into form submissions next to getAttributionFields().
 *
 * Storage:
 *   localStorage  `gm_visitor`           — long-lived identity across sessions
 *   sessionStorage `gm_session_behavior` — pages + clicks for the current visit
 *
 * The CRM stores everything as columns on the lead row — no extra API needed.
 */

const VISITOR_KEY = 'gm_visitor';
const SESSION_KEY = 'gm_session_behavior';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 min idle = new session
const MAX_PAGES = 30;
const MAX_CLICKS = 30;

const CLARITY_PROJECT_ID =
  (import.meta.env.VITE_CLARITY_ID as string | undefined)?.trim() || '';

interface VisitorIdentity {
  id: string;
  first_visit_at: string; // ISO
  last_visit_at: string;  // ISO
  visit_count: number;
  ga4_client_id?: string; // cached from gtag('get', ...) once available
}

interface SessionBehavior {
  started_at: string; // ISO
  pages: { path: string; title: string; t: string; dwell_ms?: number }[];
  clicks: { label: string; t: string }[];
}

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

function uuid(): string {
  // RFC 4122 v4 via crypto.getRandomValues — falls back to Math.random
  // on ancient browsers. Not cryptographically critical here, just unique.
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function readVisitor(): VisitorIdentity | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(VISITOR_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as VisitorIdentity;
  } catch {
    return null;
  }
}

function writeVisitor(v: VisitorIdentity): void {
  try {
    localStorage.setItem(VISITOR_KEY, JSON.stringify(v));
  } catch {
    /* localStorage disabled, no-op */
  }
}

function readSession(): SessionBehavior | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionBehavior;
  } catch {
    return null;
  }
}

function writeSession(s: SessionBehavior): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    /* no-op */
  }
}

/** Run once at app boot. Establishes visitor identity, opens a session. */
export function initBehaviorCapture(): void {
  if (typeof window === 'undefined') return;
  const now = new Date().toISOString();

  // 1. Visitor identity (long-lived)
  let visitor = readVisitor();
  if (!visitor) {
    visitor = { id: uuid(), first_visit_at: now, last_visit_at: now, visit_count: 1 };
  } else {
    const last = new Date(visitor.last_visit_at).getTime();
    const idleMs = Date.now() - last;
    if (idleMs > SESSION_TIMEOUT_MS) {
      visitor.visit_count = (visitor.visit_count || 0) + 1;
    }
    visitor.last_visit_at = now;
  }
  writeVisitor(visitor);

  // 2. Session (per-tab)
  if (!readSession()) {
    writeSession({ started_at: now, pages: [], clicks: [] });
  }

  // 3. Tag the Clarity session with our visitor id so we can deep-link recordings.
  // Clarity may load after this runs; we retry briefly. Once tagged, we can
  // construct a URL that opens the Clarity dashboard filtered to this user.
  let attempts = 0;
  const tagClarity = () => {
    if (typeof window.clarity === 'function') {
      try { window.clarity('identify', visitor!.id); } catch { /* no-op */ }
      try { window.clarity('set', 'visitor_id', visitor!.id); } catch { /* no-op */ }
      return;
    }
    if (++attempts < 20) setTimeout(tagClarity, 500);
  };
  tagClarity();

  // 4. Cache GA4 client_id once gtag is loaded. Same retry pattern.
  let gaAttempts = 0;
  const fetchClientId = () => {
    if (typeof window.gtag === 'function') {
      const ga4Id = (import.meta.env.VITE_GA4_ID as string | undefined)?.trim();
      if (!ga4Id) return;
      try {
        // gtag('get', target, field, cb) — async
        window.gtag('get', ga4Id, 'client_id', (cid: unknown) => {
          if (typeof cid === 'string' && cid) {
            const v = readVisitor();
            if (v) writeVisitor({ ...v, ga4_client_id: cid });
          }
        });
        return;
      } catch {
        /* fall through to retry */
      }
    }
    if (++gaAttempts < 20) setTimeout(fetchClientId, 500);
  };
  fetchClientId();
}

/** Called from analytics.trackPageView(). Closes prior page's dwell, opens new. */
export function pushPage(path: string, title?: string): void {
  if (typeof window === 'undefined') return;
  const s = readSession() || { started_at: new Date().toISOString(), pages: [], clicks: [] };
  const now = new Date().toISOString();

  // Close prior page's dwell time
  const prior = s.pages[s.pages.length - 1];
  if (prior && !prior.dwell_ms) {
    prior.dwell_ms = Date.now() - new Date(prior.t).getTime();
  }

  s.pages.push({ path, title: title || (typeof document !== 'undefined' ? document.title : ''), t: now });
  if (s.pages.length > MAX_PAGES) s.pages.splice(0, s.pages.length - MAX_PAGES);
  writeSession(s);
}

/** Called from analytics.trackEngagement(). Records a CTA click. */
export function pushClick(label: string): void {
  if (typeof window === 'undefined') return;
  const s = readSession() || { started_at: new Date().toISOString(), pages: [], clicks: [] };
  s.clicks.push({ label, t: new Date().toISOString() });
  if (s.clicks.length > MAX_CLICKS) s.clicks.splice(0, s.clicks.length - MAX_CLICKS);
  writeSession(s);
}

/**
 * Flat field bag for spreading into form submissions. Mirrors
 * getAttributionFields(). Empty values omitted.
 */
export function getBehaviorFields(): Record<string, string> {
  const visitor = readVisitor();
  const session = readSession();
  if (!visitor) return {};

  const out: Record<string, string> = {
    visitor_id: visitor.id,
    visit_count: String(visitor.visit_count),
    first_visit_at: visitor.first_visit_at,
  };

  if (visitor.ga4_client_id) out.ga4_client_id = visitor.ga4_client_id;

  if (CLARITY_PROJECT_ID) {
    out.clarity_recording_url =
      `https://clarity.microsoft.com/projects/view/${CLARITY_PROJECT_ID}/impressions?Custom_userId=is;${encodeURIComponent(visitor.id)}`;
  }

  if (session) {
    const startMs = new Date(session.started_at).getTime();
    out.session_duration_sec = String(Math.max(0, Math.round((Date.now() - startMs) / 1000)));

    // Close current page's dwell on the fly so the timeline reflects "right now"
    const pages = session.pages.slice();
    const last = pages[pages.length - 1];
    if (last && !last.dwell_ms) {
      pages[pages.length - 1] = { ...last, dwell_ms: Date.now() - new Date(last.t).getTime() };
    }

    out.behavior_json = JSON.stringify({ pages, clicks: session.clicks });
  }

  return out;
}
