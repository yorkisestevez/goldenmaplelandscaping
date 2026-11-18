import type {SiteGoal} from '../siteConcepts';
import type {SiteMoveKind,MoveValue} from '../siteDesignMoves';

/**
 * The contract between the site designer panel and the AI designer (cloud Claude, or the local model on the owner's
 * PC). The AI never sends geometry or prices: it picks a concept the engine built, chooses which moves to keep and
 * sets their bounded params (siteDesignMoves.ts MOVE_PARAMS); the engine rebuilds, checks and prices the result, and
 * at most one revision turn sends the engine's findings back. Types only: no runtime code, safe to import anywhere.
 */
export interface DesignerAiConceptSummary {
 id:string;title:string;goal:SiteGoal;
 moves:{kind:SiteMoveKind;title:string;params:Record<string,MoveValue>}[];
 skipped:{kind:SiteMoveKind;reason:string}[];
 /** CAD before HST; delta against the design as it stands. */
 subtotal:number;delta:number;
 /** How many quote lines the concept adds (their labels are not sent). */
 newQuotes:number;
 scores:{cost:number;execution:number;trend:number|null};
 reasons:string[];
}
/** What the AI decides: build from concept `base`, keep the moves in `include` (in that order), with `params`
 * overriding the engine's defaults inside MOVE_PARAMS bounds. */
export interface DesignerAiChoice {
 base:string;
 include:SiteMoveKind[];
 params:Partial<Record<SiteMoveKind,Record<string,MoveValue>>>;
 goals?:SiteGoal[];
 /** The most to add to the design as it stands (CAD before HST); null clears it. */
 budget?:number|null;
}
export interface DesignerAiTurn {role:'user'|'assistant';text:string}
export interface DesignerAiRequest {
 version:1;
 /** 'design': choose from the engine's concepts for the visitor's brief. 'revise': the engine found problems with
  * the previous choice (`findings`); fix them once. */
 mode:'design'|'revise';
 /** The visitor's own words (≤ 2000 chars). */
 prompt:string;
 /** siteBrief(data) JSON (siteBrief.ts), ≤ 4 KB. */
 brief:unknown;
 concepts:DesignerAiConceptSummary[];
 baseline:{subtotal:number;quoteCount:number};
 budget?:number;goals?:SiteGoal[];
 previous?:{choice:DesignerAiChoice;findings:string[]};
 /** Earlier turns of this design conversation (≤ 8). */
 conversation?:DesignerAiTurn[];
}
export interface DesignerAiResponse {
 kind:'choice'|'clarify';
 choice?:DesignerAiChoice;
 /** Plain owner-voice explanation for the visitor; cites brief numbers, never invents prices. */
 explanation:string;
 /** 2–4 short points for the card. */
 highlights:string[];
 /** When kind is 'clarify', or when a choice needs the visitor's input (≤ 3). */
 questions?:string[];
 /** Which model answered ('claude-opus-5-5', 'local:qwen3:14b', …) and what this turn cost against the cap. */
 meta?:{model:string;costUsd?:number;remainingTurnsToday?:number};
}
/** Whether the AI designer can be asked right now. When not, the panel shows the engine's concepts alone. */
export interface DesignerAiStatus {
 available:boolean;
 reason?:'not_configured'|'cap_reached'|'rate_limited'|'unavailable';
 remainingTurnsToday?:number;
}
