/** Form identity and download configuration, without loading submission scoring. */
export const DECK_DESIGN_FORM='deck-design';
/**
 * Attach the branded proposal PDF to a sent design as a Netlify form file (`proposal_pdf`). On since
 * 2026-09-28 (owner: make "one click sends the branded proposal" true); the PDF is well under Netlify's
 * 8 MB request limit, and netlify/functions/submission-created.ts puts its link at the top of the CRM
 * lead's details. It needs `<input type="file" name="proposal_pdf">` in public/__forms.html
 * (check-deck-pdf enforces both ways). A failed upload still falls back to sending without the file.
 */
export const ATTACH_PROPOSAL_PDF=true;
/** The proposal PDF's file name, for the download and the attachment (the PDF builder loads only when asked for). */
export const PROPOSAL_PDF_NAME='golden-maple-deck-proposal.pdf';
