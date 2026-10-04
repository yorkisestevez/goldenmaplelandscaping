/**
 * A full backyard's deck, added to the estimate. The deck designer prices the deck (the site's one deck price, see
 * features/deckcraft/estimatorHandoff.ts); the estimator's engine prices everything else and never sees the deck.
 * These add the designer's figure to the engine's so every total on screen (the range, the invoice, the live rail)
 * includes the deck and still reconciles to the cent. No engine coefficient or snapshot is touched.
 *
 * The designer's price is not widened: it is priced from the drawn deck, not from unanswered site questions, so it
 * adds the same amount to both ends of the range.
 */
import engineBaseline from '../data/engine-baseline.json';
import type { PreciseResult } from './estimateEngine';

const HST_RATE = engineBaseline.facts.hstRate;

export type PreciseWithDeck = PreciseResult & { deckCents: number };

/** A displayed range with the deck added, kept on the estimator's $250 steps. */
export function withDeckRange<T extends { low: number; high: number }>(range: T, deckCents: number): T {
  if (deckCents <= 0 || range.low <= 0) return range;
  const deck = deckCents / 100;
  return { ...range, low: Math.round((range.low + deck) / 250) * 250, high: Math.round((range.high + deck) / 250) * 250 };
}

/** The engine's invoice with the deck as its own line: subtotal, HST on the new subtotal, and the grand total. */
export function withDeckPrecise(precise: PreciseResult | null, deckCents: number): PreciseWithDeck | null {
  if (!precise) return null;
  if (deckCents <= 0) return { ...precise, deckCents: 0 };
  const subtotalCents = precise.subtotalCents + deckCents;
  const hstCents = Math.round(subtotalCents * HST_RATE);
  return { ...precise, deckCents, subtotalCents, hstCents, grandTotalCents: subtotalCents + hstCents };
}
