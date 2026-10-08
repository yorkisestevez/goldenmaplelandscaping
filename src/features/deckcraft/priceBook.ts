/**
 * The Golden Maple price book the deck estimate uses, named by the date it was last changed. Proposals and
 * the PDF print it, every sent design carries it, and a design link records it, so a design reopened after
 * a price change says so instead of silently showing a different number.
 *
 * `fingerprint` covers every rate table the estimate reads and the priced total of every legacy parity
 * scenario (scripts/check-deck-price-book.ts). Any rate change fails that check until `version` is moved
 * to the date of the change and `fingerprint` to the value the check prints. Rates only change with the
 * owner's approval, so this changes with them.
 */
export const PRICE_BOOK={version:'2026-10-08',fingerprint:'3bb02a58'} as const;

/** "Golden Maple price book 2026-09-23" */
export const priceBookLabel=(version:string=PRICE_BOOK.version)=>`Golden Maple price book ${version}`;

/** A price-book version as written in a design link or file: an ISO date, else null. */
export const readPriceBookVersion=(value:unknown):string|null=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value:null;
