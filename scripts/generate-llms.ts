import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BUSINESS, publicContact, canPublish, publicClaimCopy } from '../src/data/business.ts';

const root = resolve(import.meta.dirname, '..');
const llmsPath = resolve(root, 'public/llms.txt');

function renderBusinessBrief() {
  const hours = canPublish(BUSINESS.hours)
    ? BUSINESS.hours.value.map(h => `${h.days.join(', ')}: ${h.opens}–${h.closes}`).join('; ')
    : 'Contact the team to confirm current hours.';
  return `# ${BUSINESS.publicName.value} — AI Crawler Brief

> Business policies and active service coverage require owner confirmation. This brief is not a contract or independent verification of credentials, reviews, project provenance or image rights. Original disputed claims are preserved in the private source audit, not published here as facts.

## Business Profile

- **Public name:** ${BUSINESS.publicName.value}
- **Founder contact:** ${BUSINESS.founder.value.name}
- **Phone:** ${publicContact.phoneTel}
- **Email:** ${publicContact.email}
- **Website:** ${BUSINESS.canonicalUrl}
- **Location policy:** ${BUSINESS.addressPolicy.value.publicLocality}, ${BUSINESS.addressPolicy.value.region}; street address is not published.
- **Hours:** ${hours}
- **Service enquiries:** ${BUSINESS.services.value.join('; ')}. Confirm availability and scope for your address.
- **Municipality pages:** ${[...BUSINESS.serviceArea.primary.value, ...BUSINESS.serviceArea.secondary.value].join(', ')}. A published page does not confirm active service coverage.
- **Estimator:** ${BUSINESS.canonicalUrl}/cost-estimator — indicative planning calculation, not a quote or universal construction specification.
- **Booking:** ${BUSINESS.canonicalUrl}/book — confirm appointment scope and any fees before booking.

## Public-claim guardrails

- No review rating/count or customer testimonial is validated by this document.
- ${publicClaimCopy(BUSINESS.credentials.liabilityInsurance, BUSINESS.credentials.liabilityInsurance.value)}
- ${publicClaimCopy(BUSINESS.credentials.workmanshipWarranty, BUSINESS.credentials.workmanshipWarranty.value)}
- ${publicClaimCopy(BUSINESS.commercialPolicies.consultation, BUSINESS.commercialPolicies.consultation.value)}
- ${publicClaimCopy(BUSINESS.commercialPolicies.permits, 'Confirm permit responsibilities in the written scope.')}
- Minimum investment, design fees/credits, financing, subcontractor roles, credentials, manufacturer authorization, photo rights and portfolio provenance remain subject to confirmation.
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
