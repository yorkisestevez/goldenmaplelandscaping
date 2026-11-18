import type {AgentCommand,AgentRequest,AgentSnapshot} from './deckAgentController';
import type {AssistedSelection} from './naturalLanguageCommands';
export type AssistantEditCommand=Exclude<AgentCommand,{type:'design.replace'|'view.set'|'section.open'|'history.undo'|'history.redo'|'action'}>;
export type AssistantPlan=
 |{kind:'edit';message:string;assumptions:string[];commands:AssistantEditCommand[]}
 |{kind:'clarify';message:string;assumptions:string[];commands:[];question:string;choices:string[]}
 /** Grounded guidance with no design mutation — used by expert assistants for ideas and trade-offs. */
 |{kind:'advice';message:string;assumptions:string[];commands:[];question:string;choices:string[]};
export type AssistantPlanResult={ok:true;plan:AssistantPlan}|{ok:false;error:string};
export type AssistantJson=string|number|boolean|null|AssistantJson[]|{[key:string]:AssistantJson};
export interface AssistantContext {
 /** The measured yard (siteBrief.ts), ahead of everything else; current ground, coverage and clearance warnings. */
 siteBrief?:Record<string,AssistantJson>;siteWarnings?:string[];
 version:1;revision:number;units:'feet-and-inches';
 design:Record<string,AssistantJson>;
 catalogue:{decking:{id:string;name:string;colours:string[]}[];railing:{id:string;name:string;baseType:string}[];lighting:{id:string;name:string}[];options:Record<string,string[]>};
 selection:{objectIds?:string[];parts:Record<string,AssistantJson>[];boards:Record<string,AssistantJson>[];missing:string[];truncated:boolean;hardscape?:import('./selectionState').HardscapeSelection;poolId?:string;yard?:{id:string;kind:'patio'|'retaining-wall';name:string;target:'area'|'edge'|'point';index:number};boardEdit?:{type:'layout.boards';targets:{modelLevel:number;index:number}[];idPrefix:string};deckEdits?:{type:'layout.region';region:{id:string;level:1|2|3;polygon:{x:number;y:number}[]}}[]};
 boundaries:{level:1|2|3;label:string;points:{x:number;y:number}[];offset:{x:number;y:number};widthFt:number;depthFt:number}[];
 edgeSections:{level:1|2|3;edgeId:string;label:string;lengthIn:number;a:{x:number;y:number};b:{x:number;y:number};eligible:{startPct:number;endPct:number}[];railings:{startPct:number;endPct:number}[]}[];
 /** Exact measured yard points. Omitted targets are absent from both geometry and config. */
 yardBoundaries?:{id:string;kind:string;enabled:boolean;points:{x:number;y:number}[];coordinateSpace:'world-inches'}[];
 yardOmittedIds?:string[];
 siteDataOmitted?:boolean;landscapeOmittedCount?:number;editorDataOmitted?:boolean;
  /** The current estimate's subtotal (CAD, before tax) and how many lines are quoted separately. */
 price?:{subtotal:number;quoteItems:number};
 truncated:boolean;
}
export interface AssistantRequestOptions {id:string;expectedRevision:number;snapshot?:AgentSnapshot;selection?:AssistedSelection;requestText?:string}
export type AssistantTranslatedRequest=AgentRequest;
