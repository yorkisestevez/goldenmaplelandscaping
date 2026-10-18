import claimRules from '../../scripts/claim-rules.json';

/**
 * The last check before a visitor reads one of Sophie's AI replies (owner decision 2026-10-17: prevent
 * hallucinations at all cost). Deterministic, no model, and it fails closed: a sentence is replaced whole when
 *   - it states a price other than the planning range Sophie was given, in any form ("$25k", "25,000 dollars",
 *     "twenty grand", "40 to 45 per square foot", "about 25,000" after a cost word), or
 *   - it makes a business claim: anything in scripts/claim-rules.json (the list the build's claim gate uses), or
 *     a topic only the team may speak to in writing (insurance, licensing, warranty, financing, "free", permits,
 *     minimums, ratings, reviews, years in business, job counts).
 * Replacing the sentence, not the number, keeps the reply grammatical and leaves nothing half-said.
 * Used by the chat widget on live ElevenLabs replies and by netlify/functions/chat.ts on the fallback path.
 * No regex lookbehind: Safari before 16.4 cannot parse it, and this module loads with the widget on every page.
 */
export const PRICE_REDACTION = "I won't guess at a price here; the estimator can give you a real planning range for your yard.";
export const CLAIM_REPLACEMENT = 'That is something the team confirms in writing for your project.';

/** The estimator range Sophie was given (whole dollars), if any. */
export type AllowedRange = { low: number; high: number } | null;

/** "$18k" for an $18,250 range end is the same figure, rounded. */
const ROUNDING_TOLERANCE = 0.03;

const NUM = String.raw`\d+(?:[ ,]\d{3})*(?:\.\d+)?`;
const SUFFIX = String.raw`(?:\s?(?:[kKmM]\b|thousand\b|million\b|grand\b))?`;
const SEP = String.raw`\s?(?:–|—|-|to|and)\s?`;
const SIGN = String.raw`(?:US|CA|C|A)?\$`;
const WORD = String.raw`(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|a few|several|a couple of)`;
// Always a price, wherever it stands.
const MONEY = new RegExp(
  [
    String.raw`${SIGN}\s?${NUM}${SUFFIX}(?:${SEP}(?:${SIGN})?\s?${NUM}${SUFFIX})?`, // $25,000 · $18k–$33k · US$25k
    String.raw`\b${NUM}(?:${SEP}${NUM})?${SUFFIX}[\s-]?(?:dollars?|bucks)\b`, // 25,000 dollars · a 25,000-dollar patio
    String.raw`\b${NUM}(?:${SEP}${NUM})?\s?grand\b`, // 25 grand
    String.raw`\b${NUM}(?:${SEP}${NUM})?\s?\$`, // 25 000 $
    String.raw`\b${WORD}(?:[\s-]+${WORD})*(?:[\s-]+(?:thousand|million))?\s+(?:dollars|bucks|grand)\b`, // twenty grand
    String.raw`\b\d{1,3}(?:\.\d+)?\s?k\b(?:${SEP}\d{1,3}(?:\.\d+)?\s?k\b)?`, // 25k · 30K–40K (2,700K is masked as a colour temperature first)
    String.raw`\b${WORD}(?:[\s-]+${WORD})*\s?k\b`, // ten K
    String.raw`\b${NUM}\s?mil\b(?!\s?(?:poly\w*|liner|vapou?r|film|sheet|plastic|membrane|barrier|thick\w*|spec))`, // 1.5 mil (not "6 mil poly")
    String.raw`\b${NUM}(?:${SEP}${NUM})?\s?(?:per|a|an|\/)\s?(?:square|sq\b|sq\.|linear|lin\b|sf\b|lf\b|foot\b|ft\b|hour\b)`, // 40 to 45 per square foot
  ].join('|'),
  'gi',
);
// Case-sensitive: CAD/USD only in capitals and never before a year or "3D" ("a CAD 3D render").
const CURRENCY_AMOUNT = String.raw`(?!(?:19|20)\d\d\b)${NUM}(?![dD]\b)`;
const MONEY_CASED = new RegExp(
  String.raw`\b(?:CAD|USD|CDN)\s?${CURRENCY_AMOUNT}${SUFFIX}(?:${SEP}${CURRENCY_AMOUNT}${SUFFIX})?|\b${CURRENCY_AMOUNT}(?:${SEP}${CURRENCY_AMOUNT})?${SUFFIX}\s?(?:CAD|USD|CDN)\b`,
  'g',
);
const KELVIN = /\b\d{1,2},?\d{3}\s?K\b/g; // 2,700K / 3000K light

// Fail closed: a number of 1,000 or more ("25,000", "25000", "25.000", "25 thousand", "fifteen hundred") is a price
// unless what follows the last number of its chain measures something: "1,200 or 1,500 square feet", "3,000 pounds",
// "1000 people". So is a smaller one right after a cost word ("adds about 950", "about 500 extra"). Years and phone
// numbers are not counted.
const ANY = String.raw`\d+(?:[ ,.]\d{3})*(?:\.\d+)?`;
const CHAIN = new RegExp(
  [
    String.raw`\b${ANY}(?:\s?(?:hundred|thousand|million)\b)?(?:\s?(?:or|and|to|–|—|-)\s?${ANY}(?:\s?(?:hundred|thousand|million)\b)?)*`,
    String.raw`\b${WORD}(?:[\s-]+${WORD})*[\s-]+(?:hundred|thousand|million)\b`,
  ].join('|'),
  'gi',
);
const COST_BEFORE = /\b(?:adds?|costs?|runs?|extra|about|roughly|around|approximately|pay|spend|budget|charge[sd]?|price[sd]?)\s+$/i;
const SMALL_PRICE = 100;
// Units that only measure a small number ("about 120 in. wide", "roughly 120 by 80"). Kept out of UNIT_AFTER so
// "adds 1,200 in total" is still a price.
const SMALL_UNIT = /^\s?-?\s?(?:in\b\.?|min(?:ute)?s?\b|volts?|V\b|amps?|A\b|deg(?:rees?)?|°|mph|Hz|gal\b\.?|words?|wide|deep|long|high|tall|thick|by\b|x\b)/i;
const UNIT_AFTER = /^\s?-?\s?(?:sqft|sq\.?\s?ft|sq\b|sq\.|s\.f\.|ft²|ft2|cu\.?\s?ft|cu\.?\s?yd|millimet|centimet|BTU|bricks?|hits|items|boards?|screws?|fasteners?|posts?|balusters?|spindles?|joists?|pcs\b|guests|seats|lumen|kWh?\b|W\b|L\b|ml\b|g\b|th\b|st\b|nd\b|rd\b|square|ft\b|feet|foot|'|"|inch|lbs?\b|pounds|kg\b|kilos?|tonnes?|tons?|mm\b|cm\b|m\b|m2|m²|km\b|kilomet|metres?|meters?|acres?|%|percent|hours?|hrs?|days?|weeks?|months?|years?|people|visitors|residents|homes|households|homeowners|pavers|stones|blocks|units|pieces|pallets|bags|steps|times|gallons|litres?|liters?|lumens|watts|psi|yards?|yd|cubic|linear|lin\b|sf\b|lf\b|plants|trees|of (?:them|those|these))/i;
const PHONE = /\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}\b|\b[2-9]\d{9}\b|\b1[\s.-]?8\d\d[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const YEAR = /^(?:19|20)\d\d$/;

/** The largest amount in a chain like "1,200 or 1,500" ("25.000" read as twenty-five thousand). */
function largest(chain: string): number {
  if (!/\d/.test(chain)) return 1e3; // spelled out: "twenty five thousand", "fifteen hundred"
  const mult = /million/i.test(chain) ? 1e6 : /thousand/i.test(chain) ? 1e3 : /hundred/i.test(chain) ? 100 : 1;
  return Math.max(...[...chain.matchAll(new RegExp(ANY, 'g'))].map(([n]) =>
    (/^\d{1,3}(?:[ ,.]\d{3})+$/.test(n) ? Number(n.replace(/[ ,.]/g, '')) : Number(n)) * mult));
}

function pricesIn(sentence: string): string[] {
  const s = sentence.replace(KELVIN, ' ').replace(PHONE, ' ');
  const found = [...s.matchAll(MONEY), ...s.matchAll(MONEY_CASED)].map((m) => m[0].trim());
  const rest = s.replace(MONEY, ' ').replace(MONEY_CASED, ' ');
  for (const m of rest.matchAll(CHAIN)) {
    const chain = m[0].trim();
    const value = largest(chain);
    if (YEAR.test(chain) || value < SMALL_PRICE) continue;
    const after = rest.slice((m.index ?? 0) + m[0].length);
    if (value < 1000 && (!COST_BEFORE.test(rest.slice(Math.max(0, (m.index ?? 0) - 30), m.index)) || SMALL_UNIT.test(after))) continue;
    if (UNIT_AFTER.test(after)) continue;
    found.push(chain);
  }
  return found;
}

const MULTIPLIER: Record<string, number> = { k: 1e3, thousand: 1e3, grand: 1e3, m: 1e6, million: 1e6 };

/** The dollar amounts in a figure; NaN for anything spelled out, so it can never pass as the given range. */
function amountsIn(figure: string): number[] {
  const digits = [...figure.matchAll(/(\d{1,3}(?:[ ,]\d{3})+|\d+(?:\.\d+)?)\s?(k|m|thousand|million|grand)?\b/gi)];
  if (!digits.length) return [NaN];
  const trailing = /(thousand|million|grand)\b/i.exec(figure)?.[1];
  return digits.map(([, n, unit]) => Number(n.replace(/[ ,]/g, '')) * (MULTIPLIER[(unit || trailing || '').toLowerCase()] ?? 1));
}

const near = (value: number, target: number) => Math.abs(value - target) <= target * ROUNDING_TOLERANCE;
const isGivenRange = (figure: string, range: AllowedRange) =>
  !!range && amountsIn(figure).every((v) => near(v, range.low) || near(v, range.high));

const RULES = (claimRules as { rules: Array<{ id: string; pattern: string; tier?: string }> }).rules
  .filter((r) => (r.tier ?? 'block') === 'block')
  .map((r) => ({ id: r.id, re: new RegExp(r.pattern, 'i') }));

// Topics only the team speaks to, in writing. Broad on purpose: a false hit costs one polite sentence.
const TEAM_ONLY = [
  { id: 'sophie:insurance', re: /\binsur(?:ed|ance)\b|\bWSIB\b|\blicen[sc]ed\b|\bbonded\b|\bliability\b/i },
  { id: 'sophie:warranty', re: /\bwarrant(?:y|ies|ied)\b|\bguarantee/i },
  { id: 'sophie:financing', re: /\bfinanc|\bpayment plans?\b|\bmoney down\b/i },
  { id: 'sophie:free-offer', re: /\bfree\s+(?:quotes?|estimates?|designs?|consult\w*|visits?|assessments?|measure\w*|delivery|install\w*|shipping|upgrades?|service|trial|removal|disposal|haul\w*)\b|\bfor free\b|\bfree of charge\b|\bno[- ](?:charge|cost|obligation)\b|\bat no (?:extra )?cost\b|\bcomplimentary\b/i },
  { id: 'sophie:free', re: /\bfree\b(?![- ](?:to|draining|standing|thaw|flowing|form))/i },
  { id: 'sophie:minimum', re: /\bno (?:job |project )?minimum\b|\bminimum (?:project|job|order|investment|size)\b/i },
  { id: 'sophie:permits', re: /\bpermits?\b/i },
  { id: 'sophie:ratings', re: /\b\d(?:\.\d)?[\s-]*stars?\b|\bfive[- ]star\b|\b\d[\d,]*\+?\s*(?:reviews|ratings)\b|\b(?:top|highly|best)[- ]rated\b|\brated\s+\d/i },
  { id: 'sophie:track-record', re: /\byears? (?:of )?experience\b|\bsince (?:19|20)\d\d\b|\bin business for\b|\b(?:over|more than|built|completed|installed|done|finished|delivered)\s+\d[\d,]*\+?\s*(?:patios|projects|jobs|walls|homes|clients|customers|installs|installations|families)\b|\b\d[\d,]*\+\s*(?:patios|projects|jobs|walls|homes|clients|customers|installs|installations|families)\b|\b(?:hundreds|thousands|dozens) of (?:patios|projects|jobs|walls|homes|clients|customers|installs|installations|families)\b|\baward|\bcertified\b|\baccredited\b|\bBBB\b/i },
];

/** `allow`: TEAM_ONLY topic ids the caller's own prompt is written to discuss. The claim-rules.json list always applies. */
function claimIn(sentence: string, allow: readonly string[] = []): string | undefined {
  const s = sentence.replace(/\bfeel free\b/gi, '');
  return (RULES.find((r) => r.re.test(s)) ?? TEAM_ONLY.find((r) => !allow.includes(r.id) && r.re.test(s)))?.id;
}

const ABBREVIATION = /\b(?:sq|ft|approx|vs|etc|e\.g|i\.e|st|dr|mr|mrs|ms|no)$/i;
const LIST_MARKER = /^\s*(?:[-*•]|\d+[.)])\s+/;

/** A line split into sentences, each keeping its trailing space, so joining them gives the line back. */
function sentences(line: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (const m of line.matchAll(/[.!?]+(?:\s+|$)/g)) {
    const end = (m.index ?? 0) + m[0].length;
    const before = line.slice(start, m.index);
    if (ABBREVIATION.test(before) || /^\s*\d+$/.test(before)) continue; // "sq. ft." or a "1." list number
    out.push(line.slice(start, end));
    start = end;
  }
  if (start < line.length) out.push(line.slice(start));
  return out;
}

/** Longer than any sentence Sophie writes; past it the patterns get slow, so it is replaced unread (fail closed). */
const MAX_SENTENCE = 1000;

/**
 * Claim topics the designers' prompts are written to discuss: the owner's permit guidance (fire pits, walls, decks),
 * and "free" as design prose ("keep the lawn free for play", "maintenance-free"). A free OFFER is still a claim.
 */
export const DESIGNER_ALLOWED_TOPICS = ['sophie:permits', 'sophie:free'] as const;

/**
 * Every price (with its dollar amounts; NaN when spelled out) and every claim in `text`, read the same way guardReply
 * reads Sophie. For the designers' AI, which rejects a bad answer outright instead of redacting it; they pass
 * DESIGNER_ALLOWED_TOPICS.
 */
export function findPricesAndClaims(text: string, allow: readonly string[] = []) {
  const prices: Array<{ figure: string; amounts: number[] }> = [];
  const claims: string[] = [];
  for (const line of text.split('\n')) {
    for (const sentence of sentences(line)) {
      if (sentence.length > MAX_SENTENCE) { claims.push('sophie:too-long'); continue; }
      const probe = sentence.normalize('NFKC');
      const claim = claimIn(probe, allow);
      if (claim) claims.push(claim);
      for (const figure of pricesIn(probe)) prices.push({ figure, amounts: amountsIn(figure) });
    }
  }
  return { prices, claims };
}

export function guardReply(text: string, range: AllowedRange) {
  const redactedPrices: string[] = [];
  const blockedClaims: string[] = [];

  const guardSentence = (sentence: string): string => {
    const marker = LIST_MARKER.exec(sentence)?.[0] ?? '';
    const space = /\s*$/.exec(sentence)?.[0] ?? '';
    if (sentence.length > MAX_SENTENCE) {
      blockedClaims.push('sophie:too-long');
      return marker + CLAIM_REPLACEMENT + space;
    }
    const probe = sentence.normalize('NFKC'); // read "＄25,000" as "$25,000"; the visitor still sees their own text
    const claim = claimIn(probe);
    if (claim) {
      blockedClaims.push(claim);
      return marker + CLAIM_REPLACEMENT + space;
    }
    const prices = pricesIn(probe).filter((p) => !isGivenRange(p, range));
    if (!prices.length) return sentence;
    redactedPrices.push(...prices);
    return marker + PRICE_REDACTION + space;
  };

  let previous = '';
  const source = text.split('\n');
  const lines = source.map((line) => {
    const kept: string[] = [];
    for (const s of sentences(line)) {
      const out = guardSentence(s);
      const core = out.replace(LIST_MARKER, '').trim();
      // The same replacement twice in a row says nothing new.
      if (out !== s && core === previous) continue;
      kept.push(out);
      previous = out !== s ? core : '';
    }
    return kept.join('');
  });
  const guarded = lines.filter((line, i) => line.trim() || !source[i].trim()).join('\n').trimEnd();

  return { text: guarded, redactedPrices, blockedClaims, changed: redactedPrices.length > 0 || blockedClaims.length > 0 };
}
