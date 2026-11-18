import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BUSINESS, LANDSCAPE_MAINTENANCE, publicAddressLine, publicContact, publicClaimCopy, publicHoursLine } from '../src/data/business.ts';
import { OWNER_FACTS, googleReviewBadge, ownerFact, ownerLink } from '../src/data/ownerFacts.ts';
import { BOOKING_WINDOW } from '../src/data/pageUpdates.ts';

const root = resolve(import.meta.dirname, '..');
const llmsPath = resolve(root, 'public/llms.txt');

function line(label: string, value: string | null): string {
  return value ? `- **${label}:** ${value}\n` : '';
}

function renderBusinessBrief() {
  const hours = publicHoursLine();
  const extraHours = ownerFact(OWNER_FACTS.extraHours);
  const areas = [...BUSINESS.serviceArea.primary.value, ...BUSINESS.serviceArea.secondary.value].join(', ');
  const reviewsUrl = ownerLink(OWNER_FACTS.googleReviewsUrl);
  const reviewLine = googleReviewBadge();
  const warranty = ownerFact(OWNER_FACTS.warrantyTerm);
  const insurance = ownerFact(OWNER_FACTS.liabilityCoverage);
  const wsib = ownerFact(OWNER_FACTS.wsibStatus);
  const founded = ownerFact(OWNER_FACTS.foundingYear);
  const minimum = ownerFact(OWNER_FACTS.projectMinimum);
  const certs = ownerFact(OWNER_FACTS.certifications);
  const response = ownerFact(OWNER_FACTS.responseTime);
  return `# ${BUSINESS.publicName.value}

> Residential landscape construction in Barrie, Ontario. Landscape maintenance for homes and commercial properties starts in 2027.

## Business profile

- **Name:** ${BUSINESS.publicName.value}
- **Founder:** ${BUSINESS.founder.value.name}, ${BUSINESS.founder.value.role}
${line('Founded', founded)}- **Phone:** ${publicContact.phoneDisplay} (${publicContact.phoneTel})
- **Email:** ${publicContact.email}
- **Website:** ${BUSINESS.canonicalUrl}
- **Address:** ${publicAddressLine()}
- **Office hours:** ${hours}${extraHours ? `; ${extraHours}` : ''}
- **Booking:** ${BOOKING_WINDOW}
- **FAQ (who we are, what we build, why choose us):** ${BUSINESS.canonicalUrl}/faq/
${line('Response', response)}${reviewsUrl ? `- **Google reviews:** ${reviewsUrl}${reviewLine ? ` (${reviewLine})` : ''}\n` : ''}${line('Liability coverage', insurance)}${line('WSIB', wsib)}${line('Workmanship terms', warranty)}${line('Certifications', certs)}${line('Project minimum', minimum)}
## Construction and property care

Golden Maple builds outdoor spaces for houses in Barrie and nearby Simcoe County towns: interlocking patios, walkways and driveways, retaining walls, composite decks, and full backyard projects that combine those pieces. Spring and fall clean-ups for debris, beds and interlock care are a separate service.

${LANDSCAPE_MAINTENANCE.summary} Maintenance enquiries cover Barrie, Innisfil, Oro-Medonte and Springwater. Scope and timing are confirmed for each property.

- **Landscape maintenance:** ${BUSINESS.canonicalUrl}${LANDSCAPE_MAINTENANCE.path}
- **Request a written maintenance scope:** ${BUSINESS.canonicalUrl}${LANDSCAPE_MAINTENANCE.enquiryPath}

Towns with pages on this site: ${areas}.

## How a construction project starts

1. Send the form at ${BUSINESS.canonicalUrl}/contact/ or call ${publicContact.phoneDisplay}.
2. Use the cost estimator at ${BUSINESS.canonicalUrl}/cost-estimator/ for a planning range. It is not a quote.
3. The price for a property is the written scope for that property. Excavation, drainage and materials are set for the site, not copied from a universal depth.
4. Book a time at ${BUSINESS.canonicalUrl}/book/ when you want a project conversation.

## Questions

- **What do you build?** Interlock, retaining walls and composite decks for residential properties.
- **Who is it for?** We build for homeowners. The 2027 landscape maintenance service covers homes and commercial properties in the maintenance area listed above.
${warranty ? `- **Warranty:** ${warranty}\n` : ''}${insurance ? `- **Insurance:** ${insurance}\n` : ''}- **Permits:** ${publicClaimCopy(BUSINESS.commercialPolicies.permits, 'Permit needs and responsibilities are confirmed for each project.')}
- **Reviews:** Read them on Google${reviewsUrl ? ` (${reviewsUrl})` : ''}. This site does not republish review text.
- **Photos:** Portfolio images under /images/portfolio are owner-photographed Golden Maple jobs.

`;
}

async function main() {
  const current = await readFile(llmsPath, 'utf8');
  const marker = '## Structured Content Map (for AI crawler citation)';
  const tailIndex = current.indexOf(marker);
  if (tailIndex === -1) throw new Error(`Could not find llms.txt marker: ${marker}`);
  const preservedContentMap = current.slice(tailIndex).replace(/\*End of AI Context Document\. Document version:.*\*/g, '*Generated from `src/data/business.ts`; content-map inventory preserved pending separate review.*');
  await writeFile(llmsPath, `${renderBusinessBrief()}${preservedContentMap}`, 'utf8');
  console.log(`Generated ${llmsPath} from src/data/business.ts`);
}
void main();
