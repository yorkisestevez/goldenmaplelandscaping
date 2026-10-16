/**
 * The design review keeps every message the estimate raises, but only some of them ask for a change. Notes state the
 * planning basis, a code check the drawn design already meets (the guard height and baluster spacing follow the OBC in
 * the takeoff), or what is drawn and priced. Quote items are supplier or builder prices still to collect. Neither counts
 * as an issue; both stay listed. Loaded only with the job bar, the review and the Pro menu.
 */
const NOTES=[
 /^Construction assembly rates, permit fees and unsourced materials remain planning allowances\./,
 /^Deck width\/depth refer to the structural rim centre-line footprint\./,
 /^OBC: Deck > (24|71)" \(\d+mm\) - (36|42)" high railing required\.$/,
 /^OBC: Ensure baluster spacing is < 4"/,
 /^Closed-riser thickness is allowed for in the illustrated stringer notch faces\./,
 // A new design prices a sized pier at its size; a saved one still says the price book allows a smaller pier.
 /^Footings size to \d+ in for the tributary load(?!.*The price book still allows)/,
 /^Selected decking uses a current DeckMart retail purchasing benchmark/,
 /^Lighting supply uses the Islington Nurseries/,
];
export const isReviewNote=(message:string)=>NOTES.some(note=>note.test(message));
export const isQuoteItem=(message:string)=>/\((supplier|builder) quote\)$/.test(message);
/** The messages that ask for a change to the design or its site inputs. */
export const designIssues=(messages:readonly string[])=>messages.filter(m=>!isReviewNote(m)&&!isQuoteItem(m));
