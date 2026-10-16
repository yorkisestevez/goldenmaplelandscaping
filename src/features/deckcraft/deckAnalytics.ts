import {internalModeOn} from './internalMode';

/**
 * DeckCraft funnel analytics: a closed set of events with fixed, self-describing labels. The designer
 * page plugs in the site's `trackEngagement` (GA4 + Meta, and the per-visit behaviour trail that reaches
 * the CRM with a lead); this module stays free of browser-only imports so the checks can run it.
 * Labels are constants built here, never customer text, dimensions or prices.
 *
 * Steps, sections, features and views count once per visit; outputs, links and sends count every time.
 * Since the sections replaced the numbered wizard (R1), a step label means "opened a section of that old step"
 * (the page load still counts the first); `deckcraft_section` counts each section opened (`deck_section_<id>`)
 * and first changed (`deck_changed_<id>`). `deckcraft_plan` (R4) counts the site plan used: a handle dragged or moved
 * from the keyboard (`deck_plan_drag`), a figure typed (`deck_plan_typed`) and a shape shortcut (`deck_plan_shortcut`);
 * since R5 also the plan's tools: stairs placed or slid (`deck_plan_stairs`), a custom outline drawn or reshaped
 * (`deck_plan_outline`) and the house resized from its wall ends (`deck_plan_house`).
 * Since R4 the page opens on the site plan, so `deck_view_plan` fires on load; `deck_view_drawing` is the 2D framing plan.
 */
export type DeckEvent='deckcraft_step'|'deckcraft_section'|'deckcraft_plan'|'deckcraft_feature'|'deckcraft_view'|'deckcraft_output'|'deckcraft_link'|'deckcraft_send';
export const DECK_LABEL=/^deck_[a-z0-9_]{1,36}$/;
const ONCE_PER_VISIT:ReadonlySet<DeckEvent>=new Set(['deckcraft_step','deckcraft_section','deckcraft_plan','deckcraft_feature','deckcraft_view']);
const SESSION_KEY='gm_deckcraft_events';

type Sink=(event:DeckEvent,label:string)=>void;
let sink:Sink=()=>{};
/** Sets where events go (the page passes `trackEngagement`; checks pass a recorder); returns the previous sink. */
export function setDeckAnalyticsSink(next:Sink):Sink{const previous=sink;sink=next;return previous;}

let memory=new Set<string>();
function sentThisVisit():Set<string>{
  try{return new Set(JSON.parse(sessionStorage.getItem(SESSION_KEY)??'[]') as string[]);}catch{return memory;}
}
function remember(sent:Set<string>){
  memory=sent;
  try{sessionStorage.setItem(SESSION_KEY,JSON.stringify([...sent]));}catch{/* The in-memory set still de-duplicates this page view. */}
}
/** Forget which once-per-visit events were sent (checks and "start over" use this). */
export function resetDeckAnalyticsVisit(){memory=new Set();try{sessionStorage.removeItem(SESSION_KEY);}catch{/* Nothing stored. */}}

/** Sends one DeckCraft event. Labels outside the fixed vocabulary are dropped, never sent. */
export function trackDeck(event:DeckEvent,label:string){
  if(!DECK_LABEL.test(label))return;
  if(internalModeOn()&&(event==='deckcraft_send'||label.startsWith('deck_warm_')))return;
  if(ONCE_PER_VISIT.has(event)){
    const sent=sentThisVisit(),key=`${event}:${label}`;
    if(sent.has(key))return;
    sent.add(key);remember(sent);
  }
  sink(event,label);
}

const STEP_NAMES=['dimensions','materials','stairs_railings','site_extras','backyard','estimate'] as const;
/** Label for an old wizard step (0-based index); a section reports its `legacyStep` through it. */
export const stepLabel=(index:number)=>`deck_step_${index+1}_${STEP_NAMES[index]??'other'}`;
