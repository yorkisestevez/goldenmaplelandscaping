/**
 * Canonical public-business configuration.
 *
 * This is a publishing control, not proof of a business claim. `status` records
 * whether a value is confirmed, merely present in site copy, conflicting, or
 * intentionally unknown. Do not turn `published_unverified` values into new
 * guarantees, review schema, or external-directory submissions.
 */
export type FactStatus = 'confirmed' | 'owner_reported' | 'published_unverified' | 'conflicting' | 'unknown';

export interface BusinessFact<T> {
  value: T;
  status: FactStatus;
  lastVerified: string | null;
  source: string;
  notes?: string;
}

const published = <T>(value: T, source: string, notes?: string): BusinessFact<T> => ({
  value,
  status: 'published_unverified',
  lastVerified: null,
  source,
  notes,
});

const ownerReported = <T>(value: T, source: string, notes?: string): BusinessFact<T> => ({
  value,
  status: 'owner_reported',
  lastVerified: null,
  source,
  notes,
});

const unknown = <T>(source: string, notes?: string): BusinessFact<T | null> => ({
  value: null,
  status: 'unknown',
  lastVerified: null,
  source,
  notes,
});

export const BUSINESS = {
  canonicalUrl: 'https://goldenmaplelandscaping.ca',
  publicName: published('Golden Maple Landscaping', 'Existing site-wide public copy'),
  legalName: ownerReported('Golden Maple Landscaping Inc.', 'Owner-provided context; not independently verified', 'Do not represent this as independently verified legal registry information.'),
  founder: published({ name: 'Yorkis Estevez', role: 'Founder & Lead Builder' }, 'src/data/founder.ts and existing site copy'),
  foundingYear: published('2020', 'Existing root schema and llms.txt'),

  contact: {
    primaryPhone: {
      value: { display: '(705) 300-8015', tel: '+17053008015' },
      status: 'confirmed' as const,
      lastVerified: '2026-09-05',
      source: 'Owner instruction in Telegram: publish Sophie voice agent number instead of the owner’s personal number.',
      notes: 'Approved public contact for Sophie, the voice agent. Ownership and call routing were not independently tested; no telephony changes authorized or performed.',
    },
    legacyPhone: {
      value: { display: '(705) 790-3838', tel: '+17057903838' },
      status: 'conflicting' as const,
      lastVerified: null,
      source: 'Owner confirmation required; not found in the current tracked source search',
      notes: 'Do not publish or route calls to this number until the owner confirms its status.',
    },
    email: published('yorkis@goldenmaplelandscaping.ca', 'Existing public contact links and schema'),
  },

  addressPolicy: published(
    { kind: 'service_area_business' as const, publicStreetAddress: false, publicLocality: 'Barrie', region: 'ON', country: 'CA', postalCodePrefix: 'L4N' },
    'Existing schema publishes Barrie/ON/L4N only; no street address is present',
    'Whether a residential street address should be public remains unresolved.',
  ),
  hours: published(
    [{ days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '08:00', closes: '18:00' }],
    'Existing root and SEO schema',
  ),
  urls: {
    facebook: published('https://www.facebook.com/GoldenMaplegroup', 'Existing root and SEO schema'),
    instagram: {
      value: 'https://www.instagram.com/goldenmaplelandscaping.ca',
      status: 'confirmed' as const,
      lastVerified: '2026-09-13',
      source: 'Graph API GET /17841447335950775?fields=username via scripts/instagram/fetch-top-posts.mjs (IG business account linked to the Golden Maple Landscaping Facebook Page), 2026-09-13',
      notes: 'Previous value (/goldenmaplelandscaping, no .ca) was wrong. The handle is what the fetch script prints as "IG username confirmed".',
    },
    homeStars: published('https://www.homestars.com/companies/2982995-golden-maple-landscaping', 'Existing root schema'),
    yelp: published('https://www.yelp.com/biz/golden-maple-landscaping-barrie-4', 'Existing root and SEO schema'),
    yellowPages: published('https://www.yellowpages.ca/bus/Ontario/Barrie/Golden-Maple-Landscaping/102788299.html', 'Existing root schema'),
    googleBusinessProfile: unknown<string>('Owner supplied a review-link Place ID, but a separate GBP profile URL has not been confirmed'),
    googleReviewUrl: ownerReported('https://search.google.com/local/writereview?placeid=ChIJF79Eei2jKogRfcgR8pCR2qc', 'Owner-provided context; not independently verified', 'A review-link URL is not review evidence and must not enable AggregateRating or Review schema.'),
  },

  credentials: {
    wsib: published('WSIB Certified', 'Existing llms.txt and trust-bar copy'),
    liabilityInsurance: published('$5,000,000 liability coverage', 'Existing llms.txt and trust-bar copy'),
    workmanshipWarranty: published('5-year sink and settlement warranty', 'Existing service copy and llms.txt', 'Exact coverage, exclusions, remedy, and contract wording require confirmation.'),
    cmhaPaverInstaller: {
      value: 'CMHA Certified Concrete Paver Installer',
      status: 'conflicting' as const,
      lastVerified: null,
      source: 'Owner confirmation required; current site instead refers to ICPI',
      notes: 'Do not claim either credential until current certification is documented.',
    },
    icpi: published('ICPI specifications / installation references', 'Existing service copy and llms.txt', 'ICPI terminology may be obsolete or superseded; certification status is not verified.'),
    techoPro: unknown<string>('No current Techo-Pro credential record in tracked source'),
    permaconCertification: unknown<string>('No Permacon authorization/certification record in tracked source'),
  },

  serviceArea: {
    primary: published(['Barrie', 'Innisfil', 'Oro-Medonte', 'Springwater'], 'Existing dedicated location routes'),
    secondary: published(['Orillia', 'Wasaga Beach', 'Midland', 'Collingwood', 'Bradford West Gwillimbury', 'Newmarket'], 'Existing service-location matrix and root schema; Bradford West Gwillimbury + Newmarket added per owner direction 2026-09-25', 'Active service coverage needs owner confirmation.'),
  },
  services: published(
    ['Interlocking stone', 'Composite decking', 'Retaining walls', 'Landscape design', 'Outdoor living / backyard transformations'],
    'Existing services and navigation',
  ),

  commercialPolicies: {
    minimumInvestment: unknown<string>('Existing site has inconsistent general and service-specific price claims', 'Confirm universal minimum and any service-specific exceptions before publishing as a policy.'),
    consultation: published('Free 15-minute discovery call; first in-person visit policy requires confirmation', 'Existing /book and llms.txt copy'),
    design: {
      value: '$99 paid design session, credited toward a project',
      status: 'conflicting' as const,
      lastVerified: null,
      source: 'llms.txt conflicts with src/data/serviceLocations.ts ($2,500–$8,000; 100% credited)',
      notes: 'Price, deliverables, whether it is paid, and credit treatment must be confirmed before new promotion.',
    },
    financing: unknown<string>('No formal financing provider or terms in tracked source', 'Existing phase/progress-payment language is not financing.'),
    permits: unknown<string>('Existing pages conflict on permit handling and fee responsibility', 'Confirm whether Golden Maple applies directly, coordinates, or leaves applications/fees to the client.'),
    subcontractors: unknown<string>('No ownership/subcontractor policy in tracked source'),
  },

  construction: {
    baseDepth: {
      value: 'Published 12–16 inches; owner-reported minimum 10 inches generally and 24 inches for driveways',
      status: 'conflicting' as const,
      lastVerified: null,
      source: 'Published service copy and owner-provided context',
      notes: 'Do not present either depth as a universal standard. Final excavation/base depth is project-specific and must be confirmed in the written scope.',
    },
    baseMaterials: published(['3/4-inch clear stone', 'HPB bedding'], 'Existing service copy and llms.txt'),
    brands: published(['Techo-Bloc', 'Permacon', 'Unilock', 'Trex', 'TimberTech', 'In-Lite', 'Techniseal'], 'Existing llms.txt and service copy', 'Availability and authorization must be confirmed per job.'),
    geotextile: published('Geotextile separation referenced for clay soils', 'Existing service copy'),
    geogrid: published('Geogrid reinforcement referenced for retaining walls', 'Existing service copy', 'Engineering and wall-specific requirements require project review.'),
  },

  reviews: {
    projectCounts: published({ barrie: 47, innisfil: 22, 'oro-medonte': 14, springwater: 9, orillia: 11, 'wasaga-beach': 7, midland: 5, collingwood: 4 }, 'Legacy estimator location records labelled 2025; no job ledger supplied', 'Do not display as completed-project proof without traceable project records and approval.'),
    aggregate: published({ ratingValue: '5.0', reviewCount: '8' }, 'Existing root schema comment and llms.txt', 'Publication is not verification. Do not emit AggregateRating or Review schema until a traceable source and owner approval exist.'),
    testimonials: unknown<string>('No approved, traceable testimonial consent register in tracked source'),
    portfolio: {
      value: 'scripts/portfolio-sources.mjs (owner-attested allowlist) -> src/data/projects.ts',
      status: 'confirmed' as const,
      lastVerified: '2026-09-13',
      source: 'Owner attestation 2026-09-13 (Claude Code session, contact sheet docs/portfolio/contact-sheet-2026-09-13.jpg): every entry in scripts/portfolio-sources.mjs is a Golden Maple job photographed by the owner or crew. Manufacturer, AI, render and unconfirmed files are listed in EXCLUDED and are never emitted.',
      notes: 'Publication is gated per image: build-portfolio-images.mjs refuses unattested sources and --check (npm run lint) fails on drift. Project records carry title, town, category and a descriptive summary only, with no investment figures, durations or testimonials. Revert to unknown if the register is bypassed.',
    },
    photoRights: {
      value: 'Owner-photographed job photos under /images/portfolio and the company Instagram bake under /images/instagram',
      status: 'confirmed' as const,
      lastVerified: '2026-09-13',
      source: 'Same owner attestation as reviews.portfolio (2026-09-13). Instagram images are the company account own posts, mirrored by scripts/instagram/fetch-top-posts.mjs with non-project posts excluded in scripts/instagram/config.json.',
      notes: 'Applies ONLY to paths accepted by isOwnedPhoto() in src/data/portfolioImages.ts. Legacy /images/projects files (manufacturer beauty shots, renders) remain unverified and must not be presented as Golden Maple work.',
    },
  },
} as const;

export const publicContact = {
  phoneDisplay: BUSINESS.contact.primaryPhone.value.display,
  phoneTel: BUSINESS.contact.primaryPhone.value.tel,
  email: BUSINESS.contact.email.value,
} as const;

/** Google Business Profile service areas, in GBP order. Names only. */ export const publicGbpServiceAreas = ['Barrie', 'Orillia', 'Innisfil', 'Newmarket', 'Angus', 'Oro-Medonte', 'Essa', 'Wasaga Beach', 'Thornton', 'Simcoe', 'Keswick', 'Midhurst', 'Alliston', 'Shanty Bay', 'Bradford West Gwillimbury', 'Coldwater', 'Stayner', 'Cookstown', 'Elmvale', 'Tottenham'] as const; export const publicServiceAreas = [
  ...BUSINESS.serviceArea.primary.value,
  ...BUSINESS.serviceArea.secondary.value,
] as const;

/** Service landing-page arguments are kept compatible, never used as branch addresses. */
export function publicPostalAddress(_serviceLocality?: string, _servicePostalCode?: string) {
  return {
    '@type': 'PostalAddress',
    addressLocality: BUSINESS.addressPolicy.value.publicLocality,
    addressRegion: BUSINESS.addressPolicy.value.region,
    addressCountry: BUSINESS.addressPolicy.value.country,
  };
}

/** Only independently confirmed facts can be phrased as verified public proof. */
export function canPublish<T>(fact: BusinessFact<T>): boolean {
  return fact.status === 'confirmed'
    && typeof fact.lastVerified === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(fact.lastVerified)
    && Number.isFinite(Date.parse(fact.lastVerified))
    && fact.source.trim().length > 0;
}

/** Conservative shared wording that cannot promote unresolved facts to proof. */
export function publicClaimCopy<T>(fact: BusinessFact<T>, verifiedCopy: string): string {
  if (canPublish(fact)) return verifiedCopy;
  if (fact === BUSINESS.reviews.aggregate) return 'Discuss your project with our team.';
  if (fact === BUSINESS.credentials.wsib || fact === BUSINESS.credentials.liabilityInsurance) return 'Ask us for current coverage documentation.';
  if (fact === BUSINESS.credentials.workmanshipWarranty) return 'Ask for the current written workmanship terms for your project.';
  if (fact === BUSINESS.commercialPolicies.consultation || fact === BUSINESS.commercialPolicies.design) return 'Contact us to confirm the current consultation and design scope.';
  if (fact === BUSINESS.commercialPolicies.permits) return 'Permit needs and responsibilities are confirmed for each project.';
  return 'Please contact us to confirm current project details.';
}

export const conservativeTrustItems = [
  publicClaimCopy(BUSINESS.reviews.aggregate, 'Verified Google reviews.'),
  publicClaimCopy(BUSINESS.credentials.wsib, 'WSIB coverage is documented.'),
  publicClaimCopy(BUSINESS.credentials.liabilityInsurance, 'Current liability coverage is documented.'),
  publicClaimCopy(BUSINESS.credentials.workmanshipWarranty, 'Written workmanship terms are available.'),
] as const;
