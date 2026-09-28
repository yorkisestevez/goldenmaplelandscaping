import type {AgentCommand,AgentRequest,AgentSnapshot} from './deckAgentController';
import type {AssistedSelection} from './naturalLanguageCommands';
export type AssistantEditCommand=Exclude<AgentCommand,{type:'design.replace'|'view.set'|'section.open'|'history.undo'|'history.redo'|'action'}>;
export type AssistantPlan=
 |{kind:'edit';message:string;assumptions:string[];commands:AssistantEditCommand[]}
 |{kind:'clarify';message:string;assumptions:string[];commands:[];question:string;choices:string[]};
export type AssistantPlanResult={ok:true;plan:AssistantPlan}|{ok:false;error:string};
export type AssistantJson=string|number|boolean|null|AssistantJson[]|{[key:string]:AssistantJson};
export interface AssistantContext {
 version:1;revision:number;units:'feet-and-inches';
 design:Record<string,AssistantJson>;
 catalogue:{decking:{id:string;name:string;colours:string[]}[];railing:{id:string;name:string;baseType:string}[];lighting:{id:string;name:string}[];options:Record<string,string[]>};
 selection:{parts:Record<string,AssistantJson>[];boards:Record<string,AssistantJson>[];missing:string[];truncated:boolean;boardEdit?:{type:'layout.boards';targets:{modelLevel:number;index:number}[];idPrefix:string};deckEdits?:{type:'layout.region';region:{id:string;level:1|2|3;polygon:{x:number;y:number}[]}}[]};
 boundaries:{level:1|2|3;label:string;points:{x:number;y:number}[];offset:{x:number;y:number};widthFt:number;depthFt:number}[];
 edgeSections:{level:1|2|3;edgeId:string;label:string;lengthIn:number;a:{x:number;y:number};b:{x:number;y:number};eligible:{startPct:number;endPct:number}[];railings:{startPct:number;endPct:number}[]}[];
 truncated:boolean;
}
export interface AssistantRequestOptions {id:string;expectedRevision:number;snapshot?:AgentSnapshot;selection?:AssistedSelection;requestText?:string}
export type AssistantTranslatedRequest=AgentRequest;
