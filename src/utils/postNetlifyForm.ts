import { getAttributionFields } from './utmCapture';
import { getBehaviorFields } from './behavior';
import { genEventId } from './eventId';
import { scoreGoldenMapleLead, type LeadScoreInput } from './leadScoring';

const encode = (data: Record<string, string>) =>
  Object.keys(data)
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(data[k] ?? ''))
    .join('&');

export type NetlifyFormName =
  | 'contact'
  | 'quick-quote'
  | 'estimate-request'
  | 'cost-guide'
  | 'guide-download';

export interface LeadPayloadInput {
  formName: NetlifyFormName;
  source: string;
  name: string;
  phone: string;
  email: string;
  service: string;
  town: string;
  timing: string;
  budget: string;
  details: string;
  botField: string;
  /** Extra fields already declared for this form-name in public/__forms.html. */
  extra?: Record<string, string>;
  scoreInput?: LeadScoreInput;
}

export interface PostedLead {
  eventId: string;
  payload: Record<string, string>;
}

/**
 * POST the same Netlify field names the hidden schemas expect.
 * Attribution (utm_*, gclid, fbclid), event_id and lead score are added here,
 * not typed by the visitor. Does not run in a way that targets the live site
 * from this helper — callers fetch the current origin (`/`).
 */
export async function postNetlifyForm(input: LeadPayloadInput): Promise<PostedLead> {
  const eventId = genEventId();
  const leadScore = scoreGoldenMapleLead({
    budget: input.budget,
    service: input.service,
    details: [input.details, input.town, input.timing].filter(Boolean).join(' '),
    city: input.town,
    ...input.scoreInput,
  });
  const notes = [
    input.service && `Service: ${input.service}`,
    input.town && `Town: ${input.town}`,
    input.timing && `Timing: ${input.timing}`,
    input.budget && `Budget: ${input.budget}`,
    input.details && input.details,
  ].filter(Boolean).join(' · ');

  const payload: Record<string, string> = {
    'form-name': input.formName,
    'bot-field': input.botField,
    source: input.source,
    event_id: eventId,
    ...getAttributionFields(),
    ...getBehaviorFields(),
    name: input.name,
    phone: input.phone,
    email: input.email,
    service: input.service,
    town: input.town,
    timing: input.timing,
    budget: input.budget,
    details: notes,
    lead_score: String(leadScore.score),
    lead_tier: leadScore.tier,
    lead_score_reasons: leadScore.reasons.join(','),
    ...input.extra,
  };
  if (input.formName === 'cost-guide') payload.address = input.town;

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(`[dev] ${input.formName} payload (would POST to Netlify):`, payload);
    return { eventId, payload };
  }

  const res = await fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: encode(payload),
  });
  if (!res.ok) throw new Error('Network response was not ok');
  return { eventId, payload };
}
