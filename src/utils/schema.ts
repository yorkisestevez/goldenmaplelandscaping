/**
 * JSON-LD builders — the site's single entity graph.
 *
 * One business, declared once: root.tsx emits the typed `#business` node (plus
 * `#website` and, when publishable, the `#yorkis-estevez` Person) on every
 * route. Every page-level node REFERENCES those ids instead of re-declaring a
 * LocalBusiness — before 2026-09 the same business was declared under three
 * different types/ids per page, which splits the entity for Google and AI
 * engines. scripts/check-schema-graph.py (postbuild) fails the build if a page
 * declares a second typed #business or any other LocalBusiness.
 *
 * Claims come only from the register: a credential, membership or founder link
 * is emitted only while its fact passes canPublish() in src/data/business.ts.
 * The builders take the register as a parameter so scripts/test-schema.ts can
 * prove the gating with a confirmed copy.
 */
import { BUSINESS, canPublish, publicContact, publicGbpServiceAreas, publicPostalAddress, type BusinessFact } from '../data/business';

export type JsonLd = Record<string, unknown>;
type Register = typeof BUSINESS;

export const ORIGIN = BUSINESS.canonicalUrl;
export const BUSINESS_ID = `${ORIGIN}/#business`;
export const WEBSITE_ID = `${ORIGIN}/#website`;
export const FOUNDER_ID = `${ORIGIN}/#yorkis-estevez`;
export const businessRef = { '@id': BUSINESS_ID } as const;

/**
 * Absolute, trailing-slash URL for an on-site path. Netlify `pretty_urls` serves
 * prerendered routes at the slash form, so canonicals, breadcrumbs and @ids must
 * use it or Google sees a 301 behind every structured-data URL. Off-site URLs,
 * fragments, query strings and file paths (/logo.svg) pass through unchanged.
 */
export function canonicalUrl(pathOrUrl: string): string {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${ORIGIN}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
  if (!url.startsWith(ORIGIN)) return url;
  const [base, rest = ''] = url.split(/(?=[?#])/, 2);
  const path = base.slice(ORIGIN.length); // '' for the bare origin — never test the host's ".ca" as a file extension
  if (path.endsWith('/') || /\.[a-z0-9]{2,5}$/i.test(path)) return url;
  return `${base}/${rest}`;
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** 'March 15, 2026' | '2026-03-15' → '2026-03-15'. Throws on anything else so a bad date fails the build, not Search Console. */
export function isoDate(input: string): string {
  const s = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(s);
  const month = m ? MONTHS.findIndex((name) => name.startsWith(m[1].toLowerCase()) && m[1].length >= 3) : -1;
  if (!m || month < 0) throw new Error(`isoDate: unrecognised date "${input}"`);
  const day = Number(m[2]);
  if (day < 1 || day > 31) throw new Error(`isoDate: bad day in "${input}"`);
  return `${m[3]}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Topics the business demonstrably covers on this site. Topics, not claims — no credential or rating language. */
export const BUSINESS_KNOWS_ABOUT = [
  'Hardscaping',
  'Interlocking concrete pavers',
  'Paver patios',
  'Interlock driveways',
  'Retaining walls',
  'Geogrid-reinforced segmental retaining walls',
  'Aggregate base preparation for freeze-thaw climates',
  'Landscape drainage and grading',
  'Composite decking',
  'Landscape design',
  'Natural stone',
  'Outdoor living spaces',
] as const;

export const FOUNDER_KNOWS_ABOUT = [
  'Interlocking paver installation',
  'Clear stone and HPB base construction',
  'Retaining wall construction',
  'Freeze-thaw and clay-soil site conditions in Simcoe County',
  'Drainage and grading for patios and driveways',
  'Outdoor living design and construction',
] as const;

const org = (name: string, url?: string): JsonLd => ({ '@type': 'Organization', name, ...(url ? { url } : {}) });

type CredentialDef = { fact: BusinessFact<unknown>; holder: 'person' | 'business'; name: string; recognizedBy: JsonLd };
type MembershipDef = { fact: BusinessFact<unknown>; organization: JsonLd };

function credentialDefs(r: Register): CredentialDef[] {
  return [
    { fact: r.credentials.cmhaPaverInstaller, holder: 'person', name: 'Certified Concrete Paver Installer', recognizedBy: org('Concrete Masonry & Hardscapes Association', 'https://masonryandhardscapes.org/') },
    { fact: r.credentials.techoPro, holder: 'business', name: 'Techo-Pro contractor program', recognizedBy: org('Techo-Bloc', 'https://www.techo-bloc.com/') },
  ];
}

function membershipDefs(r: Register): MembershipDef[] {
  return [{ fact: r.memberships.landscapeOntario, organization: org('Landscape Ontario', 'https://landscapeontario.com/') }];
}

function credentialsFor(r: Register, holder: CredentialDef['holder']): JsonLd[] {
  return credentialDefs(r)
    .filter((c) => c.holder === holder && canPublish(c.fact))
    .map((c) => ({ '@type': 'EducationalOccupationalCredential', credentialCategory: 'certification', name: c.name, recognizedBy: c.recognizedBy }));
}

const nonEmpty = <K extends string>(key: K, list: unknown[]) => (list.length ? { [key]: list } : {});

/** The one typed business node. Emitted by root.tsx only. */
export function businessNode(r: Register = BUSINESS): JsonLd {
  return {
    '@type': ['LocalBusiness', 'HomeAndConstructionBusiness', 'GeneralContractor'],
    '@id': BUSINESS_ID,
    name: r.publicName.value,
    description: `${r.publicName.value}: discuss ${r.services.value.join(', ')}. Confirm project scope and availability for your address.`,
    url: `${ORIGIN}/`,
    image: `${ORIGIN}/logo-mark.png`,
    logo: `${ORIGIN}/logo-mark.png`,
    ...(canPublish(r.founder) ? { founder: { '@id': FOUNDER_ID } } : {}),
    ...(canPublish(r.foundingYear) ? { foundingDate: r.foundingYear.value } : {}),
    telephone: publicContact.phoneTel,
    email: publicContact.email,
    priceRange: '$$$',
    currenciesAccepted: 'CAD',
    address: publicPostalAddress(),
    areaServed: publicGbpServiceAreas.map((name) => ({ '@type': 'City', name })),
    ...(canPublish(r.hours) ? { openingHoursSpecification: r.hours.value.map((hours) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: hours.days,
      opens: hours.opens,
      closes: hours.closes,
    })) } : {}),
    knowsAbout: [...BUSINESS_KNOWS_ABOUT],
    ...nonEmpty('hasCredential', credentialsFor(r, 'business')),
    ...nonEmpty('memberOf', membershipDefs(r).filter((m) => canPublish(m.fact)).map((m) => m.organization)),
    sameAs: [
      r.urls.facebook.value,
      r.urls.instagram.value,
      r.urls.homeStars.value,
      r.urls.yelp.value,
      r.urls.yellowPages.value,
    ],
  };
}

/**
 * The founder as a Person entity — null until the founder fact is confirmed.
 * Deliberately no `image`: the site portrait is not a photograph (founder.ts).
 */
export function founderPersonNode(r: Register = BUSINESS): JsonLd | null {
  if (!canPublish(r.founder)) return null;
  return {
    '@type': 'Person',
    '@id': FOUNDER_ID,
    name: r.founder.value.name,
    jobTitle: r.founder.value.role,
    worksFor: businessRef,
    knowsAbout: [...FOUNDER_KNOWS_ABOUT],
    ...nonEmpty('hasCredential', credentialsFor(r, 'person')),
  };
}

export function websiteNode(r: Register = BUSINESS): JsonLd {
  return { '@type': 'WebSite', '@id': WEBSITE_ID, url: `${ORIGIN}/`, name: r.publicName.value, publisher: businessRef, inLanguage: 'en-CA' };
}

export function breadcrumb(items: { name: string; path: string }[]): JsonLd {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: canonicalUrl(item.path) })),
  };
}

export function serviceNode(o: {
  path: string;
  name: string;
  serviceType: string;
  description?: string;
  areaServed: string | JsonLd | (string | JsonLd)[];
  priceDescription?: string;
}): JsonLd {
  const toPlace = (a: string | JsonLd) => (typeof a === 'string' ? { '@type': 'City', name: a } : a);
  const areas = Array.isArray(o.areaServed) ? o.areaServed.map(toPlace) : toPlace(o.areaServed);
  return {
    '@type': 'Service',
    '@id': `${canonicalUrl(o.path)}#service`,
    name: o.name,
    serviceType: o.serviceType,
    ...(o.description ? { description: o.description } : {}),
    provider: businessRef,
    areaServed: areas,
    ...(o.priceDescription
      ? { offers: { '@type': 'Offer', priceSpecification: { '@type': 'PriceSpecification', priceCurrency: 'CAD', description: o.priceDescription } } }
      : {}),
  };
}

export type FaqInput = { q: string; a: string } | { question: string; answer: string };

export function faqPage(path: string, faqs: readonly FaqInput[]): JsonLd {
  return {
    '@type': 'FAQPage',
    '@id': `${canonicalUrl(path)}#faq`,
    mainEntity: faqs.map((f) => {
      const [q, a] = 'q' in f ? [f.q, f.a] : [f.question, f.answer];
      return { '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } };
    }),
  };
}

/** Wrap nodes in one @graph payload, dropping nulls (e.g. an unpublishable Person). */
export function graph(...nodes: (JsonLd | null | undefined | false)[]): { '@context': string; '@graph': JsonLd[] } {
  return { '@context': 'https://schema.org', '@graph': nodes.filter((n): n is JsonLd => Boolean(n)) };
}

/** Site-wide graph for root.tsx. */
export function siteGraph(r: Register = BUSINESS) {
  return graph(websiteNode(r), businessNode(r), founderPersonNode(r));
}
