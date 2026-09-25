import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BUSINESS, publicContact, canPublish, publicClaimCopy } from '../src/data/business.ts';

const root = resolve(import.meta.dirname, '..');
const llmsPath = resolve(root, 'public/llms.txt');

function renderBusinessBrief() {
  const hours = canPublish(BUSINESS.hours)
    ? BUSINESS.hours.value.map(h => `${h.days.join(', ')}: ${h.opens}–${h.closes}`).join('; ')
    : 'Contact the team to confirm current hours.';
  const areas = [...BUSINESS.serviceArea.primary.value, ...BUSINESS.serviceArea.secondary.value].join(', ');
  return `# ${BUSINESS.publicName.value} — AI Crawler Brief

> Business policies and active service coverage require owner confirmation. This brief is not a contract or independent verification of credentials, reviews, project provenance or image rights. Original disputed claims are preserved in the private source audit, not published here as facts.

## Business Profile

- **Public name:** ${BUSINESS.publicName.value}
- **Founder:** ${BUSINESS.founder.value.name} — ${BUSINESS.founder.value.role}
- **Founded:** ${BUSINESS.foundingYear.value} (per site schema)
- **Phone:** ${publicContact.phoneTel}
- **Email:** ${publicContact.email}
- **Website:** ${BUSINESS.canonicalUrl}
- **Location policy:** ${BUSINESS.addressPolicy.value.publicLocality}, ${BUSINESS.addressPolicy.value.region}; street address is not published.
- **Hours:** ${hours}

## What Golden Maple does

- **Interlocking stone** — patios, walkways, and driveways planned around site conditions and Ontario freeze-thaw cycles.
- **Composite decking** — composite deck options for Ontario weather; product choice and manufacturer terms are confirmed with the selected product documentation.
- **Retaining walls** — engineered structural walls with geogrid reinforcement for sloped lots; engineering to project review.
- **Landscape design** — full-property design: site assessment, renderings, planting plans, and construction scope.
- **Outdoor living / backyard transformations** — complete outdoor spaces. Confirm availability and scope for your address.

Service areas with dedicated pages: ${areas}. A published page does not confirm active service coverage — confirm availability for your address.

## Starting a project

1. **Discovery call** — ${publicClaimCopy(BUSINESS.commercialPolicies.consultation, 'Free 15-minute discovery call.')}
2. **Cost estimator** — ${BUSINESS.canonicalUrl}/cost-estimator: an indicative planning calculation, not a quote or universal construction specification.
3. **Book a consultation** — ${BUSINESS.canonicalUrl}/book: confirm appointment scope and any fees before booking.
4. **Written scope** — every project gets a written scope; excavation/base depth, drainage, and materials are confirmed per project, not assumed.

## Common questions

- **Do you warranty your work?** ${publicClaimCopy(BUSINESS.credentials.workmanshipWarranty, 'Written workmanship terms are available.')}
- **Are you insured?** ${publicClaimCopy(BUSINESS.credentials.liabilityInsurance, 'Current liability coverage is documented.')}
- **How much does landscaping cost?** See the cost estimator (${BUSINESS.canonicalUrl}/cost-estimator) for indicative planning figures; final pricing is confirmed in the written scope.
- **Do I need a permit?** ${publicClaimCopy(BUSINESS.commercialPolicies.permits, 'Permit needs and responsibilities are confirmed for each project.')}
- **Where do you work?** ${areas}. Confirm availability and scope for your address.

## Public-claim guardrails

- No review rating/count or customer testimonial is validated by this document.
- ${publicClaimCopy(BUSINESS.credentials.wsib, 'WSIB coverage is documented.')}
- ${publicClaimCopy(BUSINESS.credentials.liabilityInsurance, 'Current liability coverage is documented.')}
- ${publicClaimCopy(BUSINESS.credentials.workmanshipWarranty, 'Written workmanship terms are available.')}
- ${publicClaimCopy(BUSINESS.commercialPolicies.consultation, 'Free 15-minute discovery call.')}
- ${publicClaimCopy(BUSINESS.commercialPolicies.permits, 'Permit needs and responsibilities are confirmed for each project.')}
- Portfolio photos under /images/portfolio are owner-photographed Golden Maple jobs (attested register in the repo, 2026-09-13); project pages list town, category and a description only.
- Minimum investment, design fees/credits, financing, subcontractor roles, credentials, manufacturer authorization and testimonials remain subject to confirmation.
- Construction depth and materials depend on site conditions, loading and written project specifications. Estimator assumptions are not universal installation promises.
- Brand references in articles are comparisons, not installer authorization or manufacturer-warranty commitments.

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
