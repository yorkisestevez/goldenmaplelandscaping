import FACTS from './publishedPriceFacts.json';
import { priceRangeFromFigure, type PriceRange } from '../utils/schema';

/**
 * Offer price range for a page that already publishes an engine figure.
 * Reads the first figure of an engine fact (publishedPriceFacts.json, generated
 * from the cost estimator), so the schema range is the same number the page shows.
 */
export function engineFactRange(id: string, unitText: string): PriceRange {
  const fact = FACTS.facts.find((f) => f.id === id);
  if (!fact || !fact.figures.length) throw new Error(`engineFactRange: no figures for fact "${id}"`);
  return priceRangeFromFigure(fact.figures[0], unitText);
}
