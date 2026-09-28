/**
 * Entity-graph builders (src/utils/schema.ts): register gating + URL/date hygiene.
 * Uses a confirmed COPY of the register to prove credentials/memberships appear
 * only when their facts pass canPublish() — the live register is never edited.
 */
import assert from 'node:assert/strict';
import { BUSINESS, canPublish } from '../src/data/business.ts';
import {
  BUSINESS_ID, FOUNDER_ID, businessNode, canonicalUrl, faqPage, founderPersonNode, isoDate, serviceNode, siteGraph,
} from '../src/utils/schema.ts';

// --- URL + date helpers ---------------------------------------------------
assert.equal(canonicalUrl('/'), 'https://goldenmaplelandscaping.ca/');
assert.equal(canonicalUrl('https://goldenmaplelandscaping.ca'), 'https://goldenmaplelandscaping.ca/', 'the .ca host is not a file extension');
assert.equal(canonicalUrl('/services/interlocking-barrie'), 'https://goldenmaplelandscaping.ca/services/interlocking-barrie/');
assert.equal(canonicalUrl('/services/interlocking-barrie/'), 'https://goldenmaplelandscaping.ca/services/interlocking-barrie/');
assert.equal(canonicalUrl('/logo.svg'), 'https://goldenmaplelandscaping.ca/logo.svg');
assert.equal(canonicalUrl('/cost-estimator?type=patio'), 'https://goldenmaplelandscaping.ca/cost-estimator/?type=patio');
assert.equal(canonicalUrl('https://en.wikipedia.org/wiki/Barrie'), 'https://en.wikipedia.org/wiki/Barrie');
assert.equal(isoDate('March 15, 2026'), '2026-03-15');
assert.equal(isoDate('May 3, 2026'), '2026-05-03');
assert.equal(isoDate('2026-09-27'), '2026-09-27');
assert.throws(() => isoDate('Spring 2026'));
assert.throws(() => isoDate('Ma 3, 2026'));

// --- page-level nodes reference the business, never re-declare it ---------
const svc = serviceNode({ path: '/services/interlocking-barrie', name: 'x', serviceType: 'y', areaServed: 'Barrie' });
assert.deepEqual(svc.provider, { '@id': BUSINESS_ID });
assert.equal(svc['@id'], 'https://goldenmaplelandscaping.ca/services/interlocking-barrie/#service');
assert.equal((faqPage('/x', [{ q: 'Q?', a: 'A.' }]).mainEntity as unknown[]).length, 1);

// --- live register: founder confirmed, credentials/memberships not ---------
assert.equal(canPublish(BUSINESS.founder), true, 'founder identity was attested 2026-09-27');
const live = businessNode();
assert.deepEqual(live.founder, { '@id': FOUNDER_ID });
assert.equal('hasCredential' in live, false, 'no business credential is confirmed yet');
assert.equal('memberOf' in live, false, 'no membership is confirmed yet');
assert.equal('foundingDate' in live, false, 'founding year is still unverified');
const person = founderPersonNode();
assert.ok(person, 'Person node emitted once the founder fact is confirmed');
assert.equal(person['@id'], FOUNDER_ID);
assert.equal('image' in person, false, 'the site portrait is not a photograph — never attach it to the Person');
assert.equal('hasCredential' in person, false);
const site = siteGraph();
assert.equal(site['@graph'].filter((n) => n['@id'] === BUSINESS_ID).length, 1, 'exactly one typed #business in the site graph');

// --- confirmed copy: gated claims appear, attached to the right entity -----
const confirmed = <T extends object>(fact: T) => ({ ...fact, status: 'confirmed' as const, lastVerified: '2026-09-27', source: 'test fixture' });
const proven = {
  ...BUSINESS,
  credentials: { ...BUSINESS.credentials, cmhaPaverInstaller: confirmed(BUSINESS.credentials.cmhaPaverInstaller), techoPro: confirmed(BUSINESS.credentials.techoPro) },
  memberships: { ...BUSINESS.memberships, landscapeOntario: confirmed(BUSINESS.memberships.landscapeOntario) },
} as unknown as typeof BUSINESS;
const provenBusiness = businessNode(proven);
assert.match(JSON.stringify(provenBusiness.hasCredential), /Techo-Pro/, 'Techo-Pro is a business-level program');
assert.match(JSON.stringify(provenBusiness.memberOf), /Landscape Ontario/);
assert.doesNotMatch(JSON.stringify(provenBusiness.hasCredential), /Paver Installer/, 'the installer certification belongs to the person');
assert.match(JSON.stringify(founderPersonNode(proven)?.hasCredential), /Certified Concrete Paver Installer/);

const unconfirmedFounder = { ...BUSINESS, founder: { ...BUSINESS.founder, status: 'published_unverified' as const, lastVerified: null } } as unknown as typeof BUSINESS;
assert.equal(founderPersonNode(unconfirmedFounder), null);
assert.equal('founder' in businessNode(unconfirmedFounder), false);

console.log('schema entity graph: passed');
