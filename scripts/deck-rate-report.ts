import {unconfirmedRates} from '../src/features/deckcraft/rateConfidence';
import {PRICE_BOOK,priceBookLabel} from '../src/features/deckcraft/priceBook';

// Prints the deck rates still waiting on the owner (src/features/deckcraft/rateConfidence.ts).
// To see what a rate change would do to every existing design: tsx scripts/check-deck-legacy-parity.ts --report
const rates=unconfirmedRates();
console.log(`${priceBookLabel()} (${PRICE_BOOK.fingerprint}): ${rates.length} rates to confirm\n`);
for(const r of rates)console.log(`[${r.status}] ${r.rate}: ${r.value}\n  ${r.note}\n  Where: ${r.where}\n`);
