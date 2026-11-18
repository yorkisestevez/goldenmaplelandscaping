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

/** An estimator range Sophie was given (whole dollars). */
type Range = { low: number; high: number };
/** The range(s) Sophie was given in this conversation, if any: every one she showed may be repeated. */
export type AllowedRange = Range | readonly Range[] | null;
/** How many of a conversation's ranges are kept (the widget) and re-priced (netlify/functions/chat.ts). */
export const MAX_SHOWN_RANGES = 5;

/** "$18k" for an $18,250 range end is the same figure, rounded: within 3%, or $500 for rounding to the nearest $1k. */
const ROUNDING_TOLERANCE = 0.03;
const ROUNDING_DOLLARS = 500;

const NUM = String.raw`\d+(?:[ ,]\d{3})*(?:\.\d+)?`;
const SUFFIX = String.raw`(?:\s?(?:[kKmM]\b|thousand\b|million\b|grand\b))?`;
const SEP = String.raw`\s?(?:–|—|-|to|and)\s?`;
const SIGN = String.raw`(?:US|CA|C|A)?\$`;
const WORD = String.raw`(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|a few|several|a couple(?: of)?)`;
// Per-unit rates in trade shorthand: "40 to 60 per sqft", "35-55/sqft", "75 psf", "250 per lineal foot", "90 a yard".
const PER_UNIT = String.raw`(?:square|sq\.?\s?ft|sqft|sq\b|sq\.|sf\b|psf\b|linear|lineal|lin\b|lf\b|face|foot\b|ft\b|ft²|yard|yd\b|m2|m²|metre|meter|ton\b|tonne|hour\b|hr\b)`;
// Always a price, wherever it stands.
const MONEY = new RegExp(
  [
    String.raw`${SIGN}\s?${NUM}${SUFFIX}(?:${SEP}(?:${SIGN})?\s?${NUM}${SUFFIX})?`, // $25,000 · $18k–$33k · US$25k
    String.raw`\b${NUM}(?:${SEP}${NUM})?${SUFFIX}[\s-]?(?:dollars?|bucks)\b`, // 25,000 dollars · a 25,000-dollar patio
    String.raw`\b${NUM}(?:${SEP}${NUM})?\s?grand\b`, // 25 grand
    String.raw`\b${NUM}(?:${SEP}${NUM})?\s?\$`, // 25 000 $
    String.raw`\b${WORD}(?:[\s-]+${WORD})*(?:[\s-]+(?:thousand|million))?\s+(?:dollars|bucks|grand)\b`, // twenty grand
    String.raw`\b(?:an?|a\s+couple(?:\s+of)?)\s+(?:(?:hundred|thousand)\s+(?:dollars|bucks)|grand(?=\s*(?:$|[.,;:!?)]|(?:for|or|and|to|more|less|extra|per|each|apiece|on|in|plus|a|an|tops|max)\b)))\b`, // a thousand dollars · a grand
    String.raw`\b\d{1,3}(?:\.\d+)?\s?k\b(?:${SEP}\d{1,3}(?:\.\d+)?\s?k\b)?`, // 25k · 30K–40K (2,700K is masked as a colour temperature first)
    String.raw`\b${WORD}(?:[\s-]+${WORD})*\s?k\b`, // ten K
    String.raw`\b${NUM}\s?mil\b(?!\s?(?:poly\w*|liner|vapou?r|film|sheet|plastic|membrane|barrier|thick\w*|spec))`, // 1.5 mil (not "6 mil poly")
    String.raw`\b${NUM}(?:${SEP}${NUM})?\s?(?:per|a|an|\/)\s?(?:(?:running|linear|lineal)\s+)?${PER_UNIT}`, // 40 to 45 per square foot
    String.raw`\b${NUM}(?:${SEP}${NUM})?\s?psf\b`, // 75 psf
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
// Thousands are grouped with a comma or space only: "7.875 in" is a riser height, not 7,875.
const ANY = String.raw`\d+(?:[ ,]\d{3})*(?:\.\d+)?`;
const CHAIN = new RegExp(
  [
    String.raw`\b${ANY}(?:\s?(?:hundred|thousand|million)\b)?(?:\s?(?:or|and|to|–|—|-)\s?${ANY}(?:\s?(?:hundred|thousand|million)\b)?)*`,
    String.raw`\b${WORD}(?:[\s-]+${WORD})*[\s-]+(?:hundred|thousand|million)\b`,
    String.raw`\b(?:an?|a\s+couple(?:\s+of)?)\s+(?:hundred|thousand|million)\b`, // a thousand · a couple thousand
  ].join('|'),
  'gi',
);
const COST_BEFORE = /\b(?:adds?|costs?|runs?|extra|about|roughly|around|approximately|pay|spend|budget|charge[sd]?|price[sd]?)\s+$/i;
const SMALL_PRICE = 100;
// Units that only measure a small number ("about 120 in. wide", "roughly 120 by 80"). Kept out of UNIT_AFTER so
// "adds 1,200 in total" is still a price.
// A connector may sit between a measurement and its unit: "1,200+ sq ft", "1,500 or so sq ft", "2,000-ish pavers".
const LEAD = String.raw`^\s?(?:\+|-?ish|or so|or more|odd)?\s?-?\s?`;
const SMALL_UNIT = new RegExp(String.raw`${LEAD}(?:in\b\.?|min(?:ute)?s?\b|volts?|V\b|amps?|A\b|deg(?:rees?)?|°|mph|Hz|gal\b\.?|words?|wide|deep|long|high|tall|thick|by\b|x\b)`, 'i');
// Inches only when what follows says so ("30.125 in so it sits", "1,080 in across"), never "in total" or "in Barrie".
const INCHES = String.raw`in\b\.?(?=\s*(?:$|[.,;:)]|(?:wide|deep|long|high|tall|thick|from|along|across|apart|above|below|by|x|to|and|or|on|o\.?c\.?|risers?|treads?|rise|run|range|of|so|boards?|posts?|steps?|deck|over|under)\b))`;
const UNIT_AFTER = new RegExp(String.raw`${LEAD}(?:${INCHES}|per\s+(?:pallet|bag|bundle|box)|pounds?|gallons?|watts?|kelvin|psf\b|sqft|sq\.?\s?ft|sq\b|sq\.|s\.f\.|ft²|ft2|cu\.?\s?ft|cu\.?\s?yd|millimet|centimet|BTU|bricks?|hits|items|boards?|screws?|fasteners?|posts?|balusters?|spindles?|joists?|pcs\b|guests|seats|lumen|kWh?\b|W\b|L\b|ml\b|g\b|th\b|st\b|nd\b|rd\b|square|ft\b|feet|foot|'|"|inch|lbs?\b|pounds|kg\b|kilos?|tonnes?|tons?|mm\b|cm\b|m\b|m2|m²|km\b|kilomet|metres?|meters?|acres?|%|percent|hours?|hrs?|days?|weeks?|months?|years?|people|visitors|residents|homes|households|homeowners|pavers|stones|blocks|units|pieces|pallets|bags|steps|times|gallons|litres?|liters?|lumens|watts|psi|yards?|yd|cubic|linear|lin\b|sf\b|lf\b|plants|trees|of (?:them|those|these))`, 'i');
const PHONE = /\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}\b|\b[2-9]\d{9}\b|\b1[\s.-]?8\d\d[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const YEAR = /^(?:19|20)\d\d$/;
// Not prices, so masked before the bare-number rule: a street address in a booking confirmation ("2976 Horseshoe
// Valley Rd W"), a year span ("2026-2027 season"), a by-law or regulation number ("zoning by-law 2009-141").
const ADDRESS = /\b\d{1,6}\s+(?:[A-Z][\w'-]*\s+){1,4}(?:St|Street|Rd|Road|Ave|Avenue|Dr|Drive|Cres|Crescent|Ct|Court|Line|Conc|Concession|Blvd|Boulevard|Way|Lane|Ln|Pl|Place|Trail|Tr|Hwy|Highway|Sideroad|Side Road|Pkwy|Parkway|Gate|Circle|Cir|Terrace|Blvd)\b/g;
const YEARS = /\b(?:19|20)\d\d\s?(?:–|—|-|\/|or|and|to)\s?(?:(?:19|20)?\d\d)\b/g;
const REFERENCE = /\b(?:ID|no\.|ref(?:erence)?|confirmation|order|booking|invoice|unit|suite|apt)\s*(?:is\s+|number\s+|#\s*|:\s*)?#?\d[\d-]*\b|#\d[\d-]*\b/gi;
const BYLAW =/\b(?:by-?laws?|O\.?\s?Reg\.?|Regulation|Table|s\.|section)\s+(?:No\.?\s*)?\d{1,4}[-/.]\d{1,4}(?:[-/.]\d+)*\b/gi;

/** The largest amount in a chain like "1,200 or 1,500". */
function largest(chain: string): number {
  if (!/\d/.test(chain)) return 1e3; // spelled out: "twenty five thousand", "fifteen hundred", "a thousand"
  const mult = /million/i.test(chain) ? 1e6 : /thousand/i.test(chain) ? 1e3 : /hundred/i.test(chain) ? 100 : 1;
  return Math.max(...[...chain.matchAll(new RegExp(ANY, 'g'))].map(([n]) =>
    (/^\d{1,3}(?:[ ,]\d{3})+(?:\.\d+)?$/.test(n) ? Number(n.replace(/[ ,]/g, ''))
      : /^\d{2,3}\.\d{3}$/.test(n) ? Number(n.replace('.', '')) // "25.000" written the European way; "7.875" stays a decimal
        : Number(n)) * mult));
}

function pricesIn(sentence: string): string[] {
  const s = sentence.replace(KELVIN, ' ').replace(PHONE, ' ');
  const found = [...s.matchAll(MONEY), ...s.matchAll(MONEY_CASED)].map((m) => m[0].trim());
  // Masked only after the "$" forms are read, so "$2000-2050" is still a price.
  const rest = s.replace(MONEY, ' ').replace(MONEY_CASED, ' ').replace(ADDRESS, ' ').replace(YEARS, ' ').replace(BYLAW, ' ').replace(REFERENCE, ' ');
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
  const digits = [...figure.matchAll(/(\d{1,3}(?:[ ,]\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s?(k|m|thousand|million|grand)?\b/gi)];
  if (!digits.length) return [NaN];
  const trailing = /(thousand|million|grand)\b/i.exec(figure)?.[1];
  return digits.map(([, n, unit]) => Number(n.replace(/[ ,]/g, '')) * (MULTIPLIER[(unit || trailing || '').toLowerCase()] ?? 1));
}

const near = (value: number, target: number) => Math.abs(value - target) <= Math.max(target * ROUNDING_TOLERANCE, ROUNDING_DOLLARS);
const rangesOf = (allowed: AllowedRange): readonly Range[] => (!allowed ? [] : 'low' in allowed ? [allowed] : allowed);
const isGivenRange = (figure: string, allowed: AllowedRange) => {
  const ranges = rangesOf(allowed);
  return ranges.length > 0 && amountsIn(figure).every((v) => ranges.some((r) => near(v, r.low) || near(v, r.high)));
};

const RULES = (claimRules as { rules: Array<{ id: string; pattern: string; tier?: string }> }).rules
  .filter((r) => (r.tier ?? 'block') === 'block')
  .map((r) => ({ id: r.id, re: new RegExp(r.pattern, 'i') }));

// Topics only the team speaks to, in writing. Broad on purpose: a false hit costs one polite sentence.
const TEAM_ONLY = [
  { id: 'sophie:insurance', re: /\binsur(?:ed|ance)\b|\bWSIB\b|\blicen[sc](?:ed|es?)\b|\bbonded\b|\bliability\b/i },
  // Warranty, or implying one. The implied kinds need the business as their subject, so "if pavers sink, the usual fix
  // is a deeper base" is advice, not a promise.
  { id: 'sophie:warranty', re: /\bwarrant(?:y|ies|ied|s)?\b|\bguarantee|\bstands? behind\b|\b(?:we|we'll|we've|our|I|I'll|Yorkis)\b[^.]{0,40}\b(?:back|cover)(?:s|ed)?\b[^.]{0,40}\b(?:\d+|one|two|three|five|ten)[ -]?years?\b|\b(?:sinks?|settles?|shifts?|heaves?)\b[^.]{0,40}\b(?:we|we'll|I'll|Yorkis)\b[^.]{0,20}\b(?:fix|redo|repair|come back)|\b(?:we|we'll|I'll|Yorkis)\b[^.]{0,20}\b(?:fix|redo|repair)\b[^.]{0,30}\bif\b[^.]{0,30}\b(?:sinks?|settles?|shifts?|heaves?)/i },
  { id: 'sophie:financing', re: /\bfinanc|\bpayment plans?\b|\bmoney down\b|\bdeposit\b|\b\d+\s?%\s*(?:down|up ?front|deposit)\b|\bpay (?:over time|in (?:instal?ments|installments)|on completion|monthly)\b|\binstal?l?ments\b/i },
  { id: 'sophie:free-offer', re: /\bfree\s+(?:quotes?|estimates?|designs?|consult\w*|visits?|assessments?|measure\w*|delivery|install\w*|shipping|upgrades?|service|trial|removal|disposal|haul\w*)\b|\bfor free\b|\bfree of charge\b|\bno[- ](?:charge|cost|obligation|fees?)\b|\bat no (?:extra )?cost\b|\bcomplimentary\b|\b(?:won'?t|doesn'?t|does not|will not) cost (?:you )?(?:anything|a (?:thing|cent|dime))\b|\bcosts? (?:you )?nothing\b|\bon the house\b|\b(?:it'?s|is) on us\b|\bcost-free\b/i },
  { id: 'sophie:free', re: /\bfree\b(?![- ](?:to|draining|standing|thaw|flowing|form))/i },
  { id: 'sophie:minimum', re: /\bno (?:job |project )?minimum\b|\bminimum (?:project|job|order|investment)\b/i },
  // Permit outcomes and approvals: never, not even in the designers, whose prompts forbid them.
  { id: 'sophie:permit-outcome', re: /\bpermit[- ](?:free|exempt|ready)\b|\bexempt\b|\b(?:no|not|n['’]t|without|never)\b[^.;]{0,30}\bpermits?\b|\bwill (?:be )?approved?\b/i },
  { id: 'sophie:approval', re: /\b(?:is|are|be|been|gets?)\s+(?:approved|engineered)\b|\bcode[- ]compliant\b|\bmeets (?:the )?(?:Ontario )?(?:Building )?Code\b|\bbuil[dt] to code\b|\bcompliant with\b[^.]{0,20}\bcode\b|\bpass(?:es)? (?:the |an? )?inspection\b|\bengineer[- ]approved\b/i },
  { id: 'sophie:permits', re: /\bpermits?\b/i },
  { id: 'sophie:dealer', re: /\bauthori[sz]ed (?:contractor|installer|dealer)\b|\b(?:approved|preferred|certified) (?:installer|contractor)\b|\b(?:ICPI|factory|manufacturer)[- ]trained\b/i },
  { id: 'sophie:ratings', re: /\b\d(?:\.\d)?[\s-]*stars?\b(?!\s*(?:inlays?|patterns?|shapes?|motifs?|medallions?))|\bfive[- ]star\b|\b\d[\d,]*\+?\s*(?:reviews|ratings)\b|\b(?:top|highly|best)[- ]rated\b|\brated\s+\d|\brates? us\b|\b\d(?:\.\d)? out of 5\b|\b\d\.\d\b[^.]{0,20}\b(?:on Google|rating|stars?)\b|\brating (?:is|of)\s+\d/i },
  { id: 'sophie:track-record', re: /\byears? (?:of )?experience\b|\bdecades? of experience\b|\bsince (?:19|20)\d\d\b|\b(?:founded|established|started|opened)\b[^.]{0,20}\b(?:19|20)\d\d\b|\bin business (?:for |over |more than )?\d?|\b(?:a|over a|two|several) decades?\b|\bover \d+ years in\b|\b\d+\+?\s*years? (?:in|of) (?:the )?(?:trade|business|industry|landscaping|hardscap\w*)\b|\b(?:we|we've|we're|I've|he|he's|she's|Yorkis|our (?:team|crew|company))\b[^.;]{0,15}\b(?:been|building|doing|installing|working|serving|in business|around)\b[^.;]{0,40}\b(?:\d+|ten|fifteen|twenty|thirty)\+?[ -]years?\b|\b(?:over|more than|built|completed|installed|done|finished|delivered)\s+\d[\d,]*\+?\s*(?:\w+\s+){0,2}(?:patios|projects|jobs|walls|homes|clients|customers|installs|installations|families|homeowners)\b|\b\d[\d,]*\+\s*(?:\w+\s+){0,2}(?:patios|projects|jobs|walls|homes|clients|customers|installs|installations|families|homeowners)\b|\b(?:hundreds|thousands|dozens) of (?:\w+\s+){0,2}(?:patios|projects|jobs|walls|homes|clients|customers|installs|installations|families|homeowners)\b|\baward|\bcertified\b|\baccredited\b|\bBBB\b/i },
];

/** `allow`: TEAM_ONLY topic ids the caller's own prompt is written to discuss. The claim-rules.json list always applies. */
function claimIn(sentence: string, allow: readonly string[] = []): string | undefined {
  const s = sentence
    .replace(/\bfeel free\b/gi, '')
    // Material words, not offers: "weed-free joints", "free of topsoil". "cost-free" and "free of charge" stay claims.
    .replace(/\b(?!(?:cost|charge|fee|obligation|risk|interest|tax|commission|duty|permit)-)[a-z]+-free\b/gi, '')
    .replace(/\bfree (?:of|from)\b(?! (?:charge|cost))/gi, '')
    // Product names, not a contractor programme: the deck designer sells TimberTech PRO Reserve, Legacy and Terrain.
    .replace(/\bTimberTech PRO (?:Reserve|Legacy|Terrain)\b/gi, 'TimberTech')
    // Hedges, not promises.
    .replace(/\b(?:not|no|isn['’]t|cannot|can['’]t) (?:a )?guarantee[ds]?\b/gi, '')
    // Advice that a design needs engineering is not a claim that it was engineered.
    .replace(/\b(?:should|must|needs? to|has to|have to|will need to) be engineered\b/gi, 'needs an engineer')
    // The owner's own fire guidance: a gas bowl needs no open-air burn permit.
    .replace(/\bno (?:open[- ]air )?burn permits?\b/gi, 'burn rules');
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
