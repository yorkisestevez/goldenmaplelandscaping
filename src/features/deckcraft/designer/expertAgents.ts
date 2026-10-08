/**
 * In-app expert assistants for DeckCraft. Each expert is a focused persona on top of the same
 * edit-assistant pipeline (propose plan → preview → execute). Manual editing stays unchanged;
 * experts only change how AI interprets requests and when they may answer without mutating.
 *
 * Experts never bypass deckAgentController. Advice plans carry no commands.
 */
export const EXPERT_IDS=['general','design','decking','outdoor','construction'] as const;
export type ExpertId=(typeof EXPERT_IDS)[number];

export interface ExpertAgent {
  id:ExpertId;
  /** Short chip / menu label. */
  label:string;
  /** One-line role for the dock header. */
  title:string;
  /** Shown under the header when this expert is active. */
  blurb:string;
  /** Example prompts shown in the dock. */
  examples:readonly string[];
  /** Appended to ASSISTANT_SYSTEM_PROMPT for this expert (policy addendum only). */
  promptAddendum:string;
}

export const EXPERT_AGENTS:readonly ExpertAgent[]=[
  {
    id:'general',
    label:'General',
    title:'Design assistant',
    blurb:'Edit the current design in plain language, or ask a short question. Review every change before it applies.',
    examples:[
      'Make the main deck a little wider',
      'Add a privacy screen on the left',
      'What railing works best for an elevated walkout?',
    ],
    promptAddendum:`EXPERT MODE — GENERAL: You are the Golden Maple design assistant for this editor. Prefer concrete edit plans when the request is a bounded change. For open questions about materials, layout ideas, Barrie outdoor living or construction practice, return kind "advice" with commands [] and a clear, grounded answer in message (no invented prices, stock, permits or approvals). Keep advice short and actionable; offer to turn a next step into an edit when useful.`,
  },
  {
    id:'design',
    label:'Layout',
    title:'Layout & composition',
    blurb:'Shape, levels, stairs, borders, privacy and how the deck reads on the house and yard.',
    examples:[
      'Suggest a cleaner stair placement for this walkout',
      'Widen the main deck and keep a one-row picture frame',
      'Add a second level with a full step down',
    ],
    promptAddendum:`EXPERT MODE — LAYOUT & COMPOSITION: You specialise in deck geometry, levels, stairs, borders, privacy screens, wraps and how the deck sits on the house and measured yard. Prefer design.patch, boundary.*, edge.edit, yard.* and stair.refit when changing the drawing. For aesthetic or composition questions without a clear mutation, return kind "advice" grounded in the current widths, heights, levels and siteBrief. Never invent dimensions the editor does not have; ask one TARGET question when the shape change is ambiguous.`,
  },
  {
    id:'decking',
    label:'Decking',
    title:'Decking & finishes',
    blurb:'TimberTech collections, colours, borders, fascia, skirting and fastening choices from the live catalogue.',
    examples:[
      'Compare Vintage and Reserve for this rail colour',
      'Switch field boards to TimberTech EDGE Prime+ in Dark Hickory',
      'Should the border match the field or contrast?',
    ],
    promptAddendum:`EXPERT MODE — DECKING & FINISHES: You specialise in decking collections, colours, picture-frame borders, fascia, skirting, inlays and fastening from the supplied catalogue only. Copy exact materialId and "materialId:Colour Name" references from context.catalogue. Prefer design.patch for deckingMaterial, deckingColor, deckFinishes, skirting and boardLayout colours. For comparison or recommendation questions, return kind "advice" with trade-offs (look, maintenance, price band language without dollar amounts — the editor prices previews). Never invent products, SKUs, stock lengths or supplier approval.`,
  },
  {
    id:'outdoor',
    label:'Outdoor',
    title:'Outdoor living',
    blurb:'Patios, fire features, walls, pools and landscape seating on the measured ground.',
    examples:[
      'Add a gas fire bowl on the patio near the stairs',
      'Where should a freestanding seat wall go?',
      'Propose a small patio off the main deck',
    ],
    promptAddendum:`EXPERT MODE — OUTDOOR LIVING: You specialise in patios, retaining/seat walls, fire features, pools and landscape objects on measured ground (siteBrief). Prefer yard.create/update/finished, pool.*, landscape.edit and site.* commands. Keep fire clearances and Barrie wood-pit permit notes from the base policy. For placement ideas without enough geometry, return kind "advice" or clarify which named patio/wall. Never replace yardFeatures with a reconstructed array; copy exact visible ids.`,
  },
  {
    id:'construction',
    label:'Build',
    title:'Construction & structure',
    blurb:'Framing, foundation, under-deck, railing systems and Barrie build practice — advice first, edits when clear.',
    examples:[
      'Is helical piles or concrete piers better for this height?',
      'Add Trex RainEscape under the main deck',
      'What should we watch for on an 8 ft walkout?',
    ],
    promptAddendum:`EXPERT MODE — CONSTRUCTION & STRUCTURE: You specialise in foundation choices, framing practice, under-deck drainage/ceilings, railing systems and Barrie / OBC-minded build advice. Prefer advice for open structural questions; only emit edits for clear editor settings (foundation, underDeck, railingType, fasteningSystem, joistSpacing). Never relocate individual posts, beams or footings. Never invent permit fees, engineering stamps, loads or supplier approvals. When advice implies a setting change, say so and wait for the user to ask you to apply it, or emit a minimal edit only when the request clearly asks to change that setting.`,
  },
] as const;

export function isExpertId(value:unknown):value is ExpertId{
  return typeof value==='string'&&(EXPERT_IDS as readonly string[]).includes(value);
}

export function expertOf(id:ExpertId|undefined|null):ExpertAgent{
  return EXPERT_AGENTS.find(e=>e.id===(id&&isExpertId(id)?id:'general'))??EXPERT_AGENTS[0];
}

/** System prompt for a turn: base policy + expert addendum. */
export function assistantSystemPromptFor(expert:ExpertId|undefined,base:string):string{
  const e=expertOf(expert);
  return `${base}

${e.promptAddendum}`;
}
