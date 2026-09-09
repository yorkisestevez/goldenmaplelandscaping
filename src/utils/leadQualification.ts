/**
 * Client-side gate for Ads/GA4/Meta `generate_lead`.
 *
 * Netlify Forms returns HTTP 200 for honeypot discards and many spam posts.
 * Firing conversions on `res.ok` therefore trains Google Ads on junk.
 *
 * Conservative rules (a real Sept 2026 Ads lead converted in ~57s):
 *   - skip if the honeypot is filled
 *   - require visit_count from behavior capture
 *   - require session_duration_sec >= 8
 *
 * Sophie chat and /book skip this gate — those leads are confirmed server-side.
 */

export const MIN_QUALIFIED_SESSION_SEC = 8;

export const UNGATED_LEAD_FORMS = new Set(['sophie-chat', 'booking']);

export type LeadFormFields = Record<string, string | number | boolean | null | undefined>;

function firstField(payload: LeadFormFields | undefined, ...keys: string[]): string {
  if (!payload) return '';
  for (const key of keys) {
    if (payload[key] == null) continue;
    const value = String(payload[key]).trim();
    if (value !== '') return value;
  }
  return '';
}

/** True when a Netlify form submission looks like a real person, not spam. */
export function isQualifiedFormLead(payload?: LeadFormFields): boolean {
  if (!payload) return false;
  if (firstField(payload, 'bot-field', 'bot_field')) return false;

  const visitCount = Number(firstField(payload, 'visit_count'));
  if (!Number.isFinite(visitCount) || visitCount < 1) return false;

  const duration = Number(firstField(payload, 'session_duration_sec'));
  if (!Number.isFinite(duration) || duration < MIN_QUALIFIED_SESSION_SEC) return false;

  return true;
}

export function shouldFireLeadConversion(
  formName: string,
  payload?: LeadFormFields,
  skipQualification = false,
): boolean {
  if (skipQualification || UNGATED_LEAD_FORMS.has(formName)) return true;
  return isQualifiedFormLead(payload);
}
