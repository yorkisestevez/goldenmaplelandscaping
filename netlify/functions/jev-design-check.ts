// Design-rule check (internal): POST a DeckCraft design JSON with the internal token, get a pass/fail report per rule.
// Jev (TypeSafe System One) judges a summary of the design. Needs JEV_API_KEY and JEV_ROUTE_TOKEN; 503 without them.
// Rules, rate limits and the summary: server/jevDesignCheck.ts. Setup and cost: docs/deckcraft/jev.md.
import {jevDesignCheckFunction} from '../../server/jevDesignCheck';

export default (request:Request,context?:{ip?:string})=>jevDesignCheckFunction(request,context);
