import { BUSINESS, publicClaimCopy } from './business';

/**
 * The homepage "Common Questions". Shared with /faq so both pages show the same
 * words; edit them here, never on a page.
 */
export const HOME_FAQS = [
  {
    q: 'Why is the base different on every property?',
    a: 'Freeze-thaw, drainage, soil, access, and how you will use the surface all change the excavation and base. Those details are written into the scope for that property. There is no single depth we publish for every patio.',
  },
  {
    q: 'Why TimberTech instead of regular wood decking?',
    a: 'TimberTech AZEK is a capped composite. It does not need the seasonal sanding and staining that wood decking does, and the manufacturer publishes its own fade and stain warranty for the board line you choose. We confirm that product paperwork with the written scope.',
  },
  {
    q: 'What if a patio is already sinking?',
    a: 'A settled or uneven interlock patio is a repair and re-level, not a new install. Start with the Barrie patio rebuild page, or send the quote form with “Patio repair or re-level” selected.',
  },
  {
    q: 'What happens after I send the form?',
    a: 'We use your name, phone, town, project type, and timing to reply about the scope. Sending the form does not book a date. If you want a time on the calendar, use the booking page once we have the project details.',
  },
].concat(
  [
    publicClaimCopy(BUSINESS.credentials.workmanshipWarranty, ''),
  ].filter(Boolean).map((answer) => ({
    q: 'What workmanship terms are in writing?',
    a: answer,
  })),
);
