/**
 * OWNER FACTS — the only file to edit when confirmed business facts arrive.
 *
 * A claim slot stays off the site until all three are filled:
 *   value        the exact public sentence or figure
 *   lastVerified YYYY-MM-DD the owner confirmed it
 *   source       where that confirmation came from (certificate, contract, GBP)
 *
 * Do not invent values. Insurance amount, WSIB, warranty term, founding year,
 * years in business, Google rating/count, certifications, response time,
 * hours beyond Mon–Fri 8–6, and the project minimum are unknown until set here.
 * When a slot is complete, pages that already call ownerFact() / publicClaimCopy()
 * render it. No second edit is required.
 *
 * googleReviewsUrl is a link, not a rating. The place ID is the one already
 * stored on the owner-provided review link. It does not publish a score.
 */

export interface OwnerFactSlot {
  value: string | null;
  lastVerified: string | null;
  source: string;
  /** What belongs in `value`. Never rendered. */
  fill: string;
}

function blank(fill: string): OwnerFactSlot {
  return { value: null, lastVerified: null, source: '', fill };
}

export const OWNER_FACTS = {
  liabilityCoverage: blank('Example shape, not a value to copy: "$2,000,000 commercial general liability, certificate dated YYYY-MM-DD".'),
  wsibStatus: blank('Example: "WSIB clearance current as of YYYY-MM-DD" — only with the clearance certificate.'),
  warrantyTerm: blank('The written term, what it covers, and the exclusions. Example: "2-year workmanship warranty on settlement, excluding drainage changes after handover."'),
  foundingYear: blank('Four-digit year the business started. Example: "2014".'),
  yearsInBusiness: blank('Short label for the homepage. Example: "12 years building in Simcoe County". Set this only after foundingYear is confirmed.'),
  googleRating: blank('Current Google rating only. Example: "5.0". Set together with googleReviewCount.'),
  googleReviewCount: blank('Current Google review count only. Example: "9". Set together with googleRating.'),
  googleReviewsUrl: {
    value: 'https://www.google.com/maps/search/?api=1&query=Golden+Maple+Landscaping&query_place_id=ChIJF79Eei2jKogRfcgR8pCR2qc',
    lastVerified: null,
    source: 'Place ID from the owner-provided Google review link already in this repo (BUSINESS.urls.googleReviewUrl). A link, not a rating or review count.',
    fill: 'Replace with the GBP reviews URL if the owner supplies a different one. Leave the place-ID link if it is still correct.',
  } satisfies OwnerFactSlot,
  certifications: blank('Current, documentable certifications only. Example: "Landscape Ontario member; Techo-Bloc contractor program". Leave null if proof is not on file.'),
  responseTime: blank('A promise the owner will keep. Example: "Yorkis replies within 1 business day." Do not add Saturday hours or 24/7 here unless that is the real policy.'),
  extraHours: blank('Hours beyond Mon–Fri 8:00–18:00. Example: "Saturday 9:00–13:00 for scheduled site visits." Leave null to keep the published weekday hours only.'),
  projectMinimum: blank('Smallest project the company wants, in the owner\'s words. Example: "Hardscape projects from $15,000; seasonal clean-ups quoted per property."'),
} as const;

export type OwnerFactKey = keyof typeof OWNER_FACTS;

/** True only when value, a real verification date, and a source are all present. */
export function ownerFact(slot: OwnerFactSlot): string | null {
  if (slot.value == null) return null;
  const value = slot.value.trim();
  if (!value) return null;
  if (typeof slot.lastVerified !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(slot.lastVerified)) return null;
  if (!Number.isFinite(Date.parse(slot.lastVerified))) return null;
  if (!slot.source.trim()) return null;
  return value;
}

/** A filled https URL. Not a rating, count, or credential. */
export function ownerLink(slot: OwnerFactSlot): string | null {
  if (!slot.value) return null;
  const value = slot.value.trim();
  return /^https:\/\//.test(value) ? value : null;
}

export function googleReviewBadge(): string | null {
  const rating = ownerFact(OWNER_FACTS.googleRating);
  const count = ownerFact(OWNER_FACTS.googleReviewCount);
  if (!rating || !count) return null;
  return `${rating} · ${count} Google reviews`;
}
