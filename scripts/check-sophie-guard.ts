import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { guardReply, PRICE_REDACTION, CLAIM_REPLACEMENT, type AllowedRange } from '../src/utils/sophieGuard';

/**
 * Sophie never shows a visitor a price or a business claim nobody approved (owner decision 2026-10-17: prevent
 * hallucinations at all cost). Her AI replies pass through guardReply before they render: a sentence quoting a
 * price other than the planning range she was given, or making a claim only the team may make in writing, is
 * replaced whole, so nothing is left half-said or ungrammatical.
 */
let checks = 0;
const ok = (value: unknown, message: string) => { assert(value, message); checks++; };
const range = { low: 18250, high: 33250 };
const redacted = (text: string, given: AllowedRange = null) => guardReply(text, given).text.includes(PRICE_REDACTION);
const claimed = (text: string) => guardReply(text, null).text.includes(CLAIM_REPLACEMENT);

// Prices: every way of writing one is caught, and the sentence goes, not just the number.
for (const reply of [
  'A patio like that usually runs about $25,000.',
  'We charge $40 per sq ft for that.',
  'Expect around 25,000 dollars, maybe 30k.',
  'Budget CAD 25,000 for it.', 'It is 25,000 CAD all in.', 'Roughly USD 25000.', 'About 25 000 $.',
  'That lands around twenty grand to thirty grand.', 'Between 18 and 33 thousand dollars.',
  'Pavers are fifty dollars a square foot.', 'Most walls are 40 to 45 per square foot.',
  'A big build can pass $1.2M.', 'It might be $25 thousand.', 'US$25,000 is typical.',
  'It would cost about 25,000 for a yard that size.',
]) ok(redacted(reply) && !/\d/.test(guardReply(reply, null).text), `price removed with its sentence: "${reply}"`);
{
  const r = guardReply('A $25,000 patio is common. Pavers are laid on a compacted base.', null);
  ok(r.text === `${PRICE_REDACTION} Pavers are laid on a compacted base.` && r.redactedPrices.join() === '$25,000', 'only the priced sentence is replaced, cleanly');
}
{
  const r = guardReply('Your planning range is $18,250–$33,250 + HST.', range);
  ok(r.text === 'Your planning range is $18,250–$33,250 + HST.' && !r.changed, 'the range Sophie was given is kept');
}
ok(!guardReply('So roughly $18k to $33k before tax.', range).changed, 'the given range rounded to thousands is kept');
ok(redacted('Your range is $18,250–$33,250, and lighting adds $5,000.', range), 'a different price beside the given range is not let through');
ok(redacted('That is about twenty thousand dollars.', range), 'a spelled-out amount never passes as the given range');
{
  const plain = 'Call (705) 300-8015 or see /cost-estimator for a 12-16 inch base on 400 sq ft, built in 2026.';
  ok(guardReply(plain, null).text === plain, 'phone numbers, paths, measurements and years are not prices');
}
ok(guardReply('A 1,000 sq ft patio costs more to excavate.', null).text === 'A 1,000 sq ft patio costs more to excavate.', 'an area next to a cost word is not a price');
for (const reply of ['Lighting adds 5,000 to that.', 'Expect to add 8000 for walls.', 'Walls are 12,000 extra.', 'Figure 25,000 plus HST.', 'That is 25 grand.', 'It is ＄25,000.', 'Budget CAD 18,000.']) {
  ok(redacted(reply), `bare or unusual amount caught: "${reply}"`);
}
ok(!guardReply('Your range is 18,250 to 33,250 before HST.', range).changed, 'the given range written without "$" is kept');
for (const fine of [
  'Roughly 3,000 pounds of stone goes on each pallet.', 'About 1000 people ask us that.', 'We produce a CAD 3D render first.',
  'A 1,000 to 1,500 sq ft patio is common.', 'Are you thinking 1 patio and 2 walls, or just the patio?', 'Is this for 2 homes or just one?',
  'The estimator will price 3 projects separately.', 'Warm 2,700K lighting suits stone.',
]) ok(guardReply(fine, null).text === fine, `ordinary answer unchanged: "${fine}"`);
// Fail closed: a big number is a price unless a unit follows its chain.
for (const reply of [
  'Roughly 25K.', 'It is 25K for the patio.', 'About 25 K total.', 'Expect about 30K–40K.', 'Most patios land at 25000 in Barrie.',
  'Roughly 25,000 depending on access.', 'Patios cost 25,000 – 30,000 here.', 'It is a 25,000 patio.', 'A 25,000-dollar patio is typical.',
  'Think 25,000 Canadian.', 'It is 25,000 per patio.', 'Around 25.000 for that.', 'Roughly 25 thousand.', 'Twenty five thousand for that.',
]) ok(redacted(reply), `price caught: "${reply}"`);
for (const fine of [
  'Is it closer to 1,200 or 1,500 square feet?', 'Is the yard 1200 or 1500 sq ft?', 'The lot is 10,000 or 12,000 square feet?',
  'About 1,500 pavers per pallet.', 'Yorkis can reach you at 7053008015 or by email.',
  'It is 1,200 sqft.', 'It costs more for 1,000 sqft.', 'Is it 1200 ft² or so?', 'Call it 1,200 s.f. of patio.', 'That is 1,500 cu ft of stone.',
  'Leave 1,500 millimetres of clearance.', 'A 12,000 BTU fire table.', 'About 1,200 bricks.', 'This is the 1,000th question today.',
]) ok(guardReply(fine, null).text === fine, `size and contact answers unchanged: "${fine}"`);
for (const reply of ['Lighting adds about 950 to that.', 'It is about 500 extra.', 'Roughly 900.', 'Call it fifteen hundred.', 'About 25 hundred for that.', 'Maybe 1.5 mil for the whole yard.', 'About ten K more.']) {
  ok(redacted(reply), `small, spoken or slang amount caught: "${reply}"`);
}
for (const fine of ['A patio of about 300 sq ft.', 'About 120 pavers per pallet.', 'Roughly 600 mm of base.', 'A few hundred square feet is common.', 'Is it for about 150 guests?',
  'It is about 120 in. wide.', 'About 144 in of run.', 'Roughly 120 by 80.', 'Use a 6 mil poly liner.']) {
  ok(guardReply(fine, null).text === fine, `small measured number unchanged: "${fine}"`);
}
ok(claimed('Every visit is for free.') && claimed('We include a free estimate.'), 'a free offer is still a claim');
for (const boast of ['We have completed over 500 patios.', 'We have done 300+ projects.', 'We have built hundreds of patios.']) ok(claimed(boast), `track record replaced: "${boast}"`);
{
  const started = Date.now();
  const huge = guardReply(`${'111,'.repeat(12000)}111 and a patio.`, null);
  ok(Date.now() - started < 1000 && huge.text === CLAIM_REPLACEMENT, 'an over-long sentence is replaced without running the patterns');
}

// Claims: scripts/claim-rules.json plus the topics only the team may speak to.
{
  const r = guardReply('We offer a free consultation at your home. Pavers are laid on a compacted base.', null);
  ok(r.text === `${CLAIM_REPLACEMENT} Pavers are laid on a compacted base.`, 'a blocked claim sentence is replaced and the rest kept');
}
for (const reply of [
  'Every job comes with a 5-year warranty.', 'We are WSIB certified.', 'We are fully insured and WSIB covered.',
  'We are licensed and insured.', 'Financing is available with no money down.', 'There is no minimum project size.',
  'We offer a free estimate and a free quote.', 'Our site visit is free of charge.', 'You get a lifetime warranty.',
  'We have 5 stars on Google.', 'We are rated 4.9 stars with 120 reviews.', 'We have 20 years of experience.',
  'We have built over 500 patios.', 'We handle all the permits.', 'We pull the permits for you.',
]) ok(claimed(reply), `claim replaced: "${reply}"`);
for (const fine of ['Feel free to ask about base depth.', 'Interlocking pavers flex with freeze-thaw instead of cracking.', 'Clear stone is free-draining.']) {
  ok(guardReply(fine, null).text === fine, `ordinary answer unchanged: "${fine}"`);
}

// Shape: lists keep their other lines, repeats collapse, abbreviations do not split a sentence.
{
  const r = guardReply('Here is what we do:\n- Patios\n- Free consultation on every job\n- Retaining walls\nCall us!', null);
  ok(r.text === `Here is what we do:\n- Patios\n- ${CLAIM_REPLACEMENT}\n- Retaining walls\nCall us!`, 'one list item is replaced, the others kept');
}
ok(guardReply('It is $40 per sq. ft. installed. It is $5 more for premium.', null).text === PRICE_REDACTION, 'two priced sentences in a row become one replacement, and "sq. ft." does not split a sentence');

// Final review (2026-10-18): forms that got through, and ordinary answers that were wrongly blanked.
for (const reply of [
  'A patio that size is usually around eighteen thousand dollars.', 'Most walls like that land near sixteen thousand.',
  "That's roughly thirteen grand.", 'Pavers are about eighteen dollars a square foot.', 'Expect sixteen bucks a square foot for that stone.',
  'Lighting usually adds about a thousand dollars.', 'Lighting adds a couple thousand.', 'Expect a couple grand for the steps.', 'Steps add about a grand each.',
  'Most interlock patios run 40 to 60 per sqft installed.', 'Interlock is usually 35-55/sqft.', 'Natural stone is 75 psf.',
  'Walls are usually 250 per lineal foot.', 'Excavation is about 90 a yard.',
]) ok(redacted(reply), `price caught: "${reply}"`);
for (const reply of [
  "There's no fee for the site visit.", 'We offer a no-fee site visit.', "The site visit won't cost you anything.", 'It costs nothing to have us come out.',
  'Yes, the site visit is on the house.', 'We stand behind our work for five years.', 'We back every patio for five years against sinking.',
  'If anything sinks or settles within 5 years, we come back and fix it.', "We've been in business over 10 years.",
  'Yorkis has a decade of experience building patios.', 'Yorkis has 15 years in the trade.', 'Our customers rate us 4.9 out of 5.',
  'The patio sits on grade, so it needs no building permit.', 'This low deck is permit-free in Barrie.', 'The design is approved for your lot.', 'This layout meets the Ontario Building Code.',
]) ok(claimed(reply), `claim replaced: "${reply}"`);
for (const fine of [
  'Polymeric sand keeps the joints weed-free. It also stops ants.', 'Composite is low-maintenance and splinter-free, so it suits a busy family.',
  'The base has to be free of topsoil and roots.', 'Our deck designer offers TimberTech PRO Reserve and Legacy boards.',
  "You're booked for Thursday at 10 a.m. at 2976 Horseshoe Valley Rd W in Oro-Medonte. Yorkis will text you the day before.",
  'Got it, so the house at 1450 Bayfield St in Barrie.', 'Are you planning for 2026 or 2027?', 'We are booking the 2026-2027 season now.',
  'Is it about 1,200+ sq ft?', 'Decks must sit at least 2 ft from the rear and side lot lines under zoning by-law 2009-141.',
  'Each of the 3 risers is 6.5 in, inside the 4.875–7.875 in range Barrie asks for.', 'Raise the main deck to 30.125 in so it sits one riser below the sill.',
  'Use a 1.125 in board.', 'The survey runs from -144 to 1,080 in across.', 'A gas fire bowl needs no open-air burn permit.',
  'This is planning guidance, not a guarantee.', 'A 2 star inlay works in the centre.',
]) ok(guardReply(fine, null).text === fine, `ordinary answer unchanged: "${fine}"`);
ok(claimed('Book a cost-free visit.'), '"cost-free" is still a free offer');
ok(guardReply('Adds 1,200 in total.', null).text === PRICE_REDACTION && guardReply('Most patios land at 25000 in Barrie.', null).text === PRICE_REDACTION, '"in total" and "in Barrie" are not inches');
// Round 5 (2026-10-18).
for (const reply of [
  "He's been building patios for 15 years.", "We've been around for 10 years.", 'Over 10 years in Barrie.', 'Decades of experience go into every job.',
  'Yorkis has been doing this for twenty years.', 'Over 500 happy customers.', 'Hundreds of happy homeowners.', 'We build to code.', 'Compliant with the Building Code.',
  'It will pass inspection.', 'Engineer-approved designs.', "We're a Unilock Authorized Contractor.", 'Permacon approved installer.', 'ICPI trained crew.',
  "We're 4.9 on Google.", 'Our rating is 4.9.', 'Deposit is 10%.', 'We take 30% down.', 'You can pay over time.', 'Pay in instalments.',
  'The manufacturer warrants them.', 'We hold a business licence.', "We'll fix it if it sinks.",
]) ok(claimed(reply), `claim replaced: "${reply}"`);
for (const fine of [
  'If pavers sink, the usual fix is a deeper compacted base.', 'A patio that heaves usually needs the base redone.',
  'A sealer should cover the joints and be reapplied every 3 years.', 'Anything more than 6 feet should be engineered.',
  'A grand entrance needs wide steps.', 'Your booking ID is 1234.',
]) ok(guardReply(fine, null).text === fine, `ordinary answer unchanged: "${fine}"`);
for (const reply of ['That would be $2000-2050.', 'About $2000 to 2050.']) ok(redacted(reply), `a "$" year-shaped amount is still a price: "${reply}"`);

// Rounding and formatting the given range, and repeating any range shown earlier in the chat.
{
  const walk = { low: 7250, high: 15750 };
  ok(!guardReply("That's roughly $7k to $16k before HST.", walk).changed, 'a range rounded to the nearest $1k is kept, even at the low end');
  ok(!guardReply('Your planning range is $10,750.00–$23,000.00 + HST.', { low: 10750, high: 23000 }).changed, 'a range written with cents is kept');
  const both = [{ low: 10750, high: 23000 }, { low: 11750, high: 24000 }];
  ok(!guardReply('Your patio range was $10,750–$23,000 + HST, and the wall is $11,750–$24,000 + HST.', both).changed, 'every range shown in the chat may be repeated');
  ok(redacted('Your patio range was $10,750–$23,000 + HST, and lighting adds $4,000.', both), 'a price that was never shown is still redacted');
}

// The widget loads this on every page; Safari before 16.4 cannot parse a regex lookbehind.
ok(!/\(\?<[=!]/.test(readFileSync(new URL('../src/utils/sophieGuard.ts', import.meta.url), 'utf8')), 'no regex lookbehind in the guard');

console.log(`SOPHIE GUARD OK — ${checks} checks: invented prices and team-only claims are replaced, whole sentence, before a visitor sees them.`);
