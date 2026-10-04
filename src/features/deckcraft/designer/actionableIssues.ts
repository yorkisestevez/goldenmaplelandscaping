import type {DeckData} from '../types';
import type {DeckTakeoff} from '../deckTakeoff';
import {houseRailingConflicts} from '../houseRailingClearance';
import type {SectionId} from './sections';

export interface IssueAction {label:string;section:SectionId;partIds?:string[];guidance:string}
export interface ActionableIssue {id:string;message:string;actions:IssueAction[]}
/** Actual clash IDs come from model geometry. Generic warnings navigate to settings without inventing a location or an automatic fix. */
export function actionableIssues(data:DeckData,model:DeckTakeoff,messages:readonly string[]):ActionableIssue[]{
  const clashes=houseRailingConflicts(data,model);
  return [...new Set(messages)].map((message,index)=>{
    const clash=clashes.find(c=>c.message===message);
    if(clash)return {id:`opening-clash:${clash.openingId}`,message,actions:[
      {label:'Locate measured opening',section:'house',partIds:[`opening:${clash.openingId}`],guidance:'Check this against the real house. Edit the measured opening only when the site measurement supports that change.'},
      {label:'Review railing connection',section:'stairs',partIds:[`opening:${clash.openingId}`],guidance:'Review the railing and connection layout against the highlighted opening. Confirm a buildable connection with the builder; this does not move the window automatically.'}
    ]};
    let section:SectionId='proposal',label='Review scope',guidance='Review the scope and outstanding quote requirements. This notice is a construction decision, not an automatic geometry correction.';
    if(/yard|patio|paving|retaining wall|wall (?:base|body|cap|drain|foundation|reinforcement)|geogrid|earthwork|survey|terrain/i.test(message)){section='backyard';label='Review yard & site';guidance='Review the measured yard layout, elevations, drainage and selected construction system. Site and engineering inputs must be confirmed; a price does not resolve them.';}
    else if(/lighting|light|fixture|transformer|cable|voltage|\bVA\b|HUB/i.test(message)){section='lighting';label='Review lighting';guidance='Check selected fixtures, transformer capacity, compatible accessories and cable runs. Preview quantities and prices before committing changes.';}
    else if(/drain|ceiling|gravel|\bfabric\b|mosquito|mesh|under.deck|skirt/i.test(message)){section='extras';label='Review under-deck options';}
    else if(/stair|riser|tread|railing|handrail|glass/i.test(message)){section='stairs';label='Review stairs & railing';}
    else if(/board|decking|pattern|stock|grain|colour|color|inlay|breaker/i.test(message)){section='boards';label='Review board layout & products';}
    else if(/footing|foundation|pier|pile|frost|soil|framing|joist|beam|post|structur|engineering/i.test(message)){section='site';label='Review structure & site';}
    else if(/house|window|opening|door|ledger|attachment|wall/i.test(message)){section='house';label='Review house measurements';}
    else if(/yard|paving|patio|freight|delivery|terrain/i.test(message)){section='backyard';label='Review yard & site';}
    else if(/outline|polygon|level|deck|edge|connection/i.test(message)){section='deck';label='Review deck shape';}
    return {id:`review:${index}`,message,actions:[{label,section,guidance}]};
  });
}
