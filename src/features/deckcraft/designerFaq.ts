import {publicContact} from '../../data/business';

/**
 * The /deck-designer FAQ: rendered under the workspace and emitted as FAQPage JSON-LD from the same array, so the
 * schema can never claim an answer the page doesn't show. The page is prerendered, so every answer passes the
 * build-time claim gate (scripts/claim-rules.json): no permit promises, warranties, free visits or credentials, and
 * nothing the designer itself doesn't do.
 */
export const DESIGNER_FAQ=[
  {
    q:'How does the deck designer work?',
    a:'Draw your deck on a plan of your house, then choose boards, railings, stairs, lighting and extras in any order. The 3D model, framing and itemized price update with every change, and each option shows what it adds to or takes off the price.',
  },
  {
    q:'Is the price a quote?',
    a:'It is a planning price for the design you drew, built from Golden Maple\'s price book. Brand-specific products marked "supplier quote" are not in the total yet. Measurements, connections and engineering are confirmed on site before your written quote.',
  },
  {
    q:'What decking can I choose from?',
    a:'Pressure-treated and cedar wood, TimberTech capped composite and Advanced PVC, and Deckorators composite and mineral-based boards. Colour samples are manufacturer product photos, and each collection explains how it differs.',
  },
  {
    q:'Can I get drawings for a permit application?',
    a:'Yes. Under Proposal & files, the designer draws a planning set on 11 × 17 sheets from your design: a site plan with setbacks, elevations, foundation, framing and guard plans, a typical section and construction details, as a PDF or a DXF. Permit rules vary by town, and your municipality\'s review decides what may be built.',
  },
  {
    q:'Does my design save?',
    a:'It saves automatically in this browser on this device. You can also copy a link to the design, save the design file, or print and download a proposal PDF.',
  },
  {
    q:'What happens when I send my design?',
    a:`Your drawing, selections, planning price and a link to reopen the design go to Golden Maple, and we get back to you about next steps. Prefer to talk first? Call ${publicContact.phoneDisplay}.`,
  },
] as const;
