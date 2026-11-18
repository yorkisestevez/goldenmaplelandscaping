import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {getHousePlacement} from '../src/features/deckcraft/housePlacement';
import {calculateDeckReleaseEstimate} from '../src/features/deckcraft/deckRelease';
import {houseRailingConflicts} from '../src/features/deckcraft/houseRailingClearance';
import {actionableIssues} from '../src/features/deckcraft/designer/actionableIssues';

let checks=0;const ok=(condition:unknown,message:string)=>{assert(condition,message);checks++;};
const data=structuredClone(DEFAULT_DECK),house=getHouseConfig(data),place=getHousePlacement(data);
data.houseConfig={...house,openings:[{id:'site-window',type:'Window',facade:'Front',offsetPct:(0-place.x0)/place.widthIn*100,bottomIn:48,widthIn:48,heightIn:54}]};
const before=JSON.stringify(data),estimate=calculateDeckReleaseEstimate(data),clash=houseRailingConflicts(data,estimate.model)[0];
ok(clash?.openingId==='site-window','Fixture intersects actual railing at measured window');
const issues=actionableIssues(data,estimate.model,[clash.message,clash.message]);
ok(issues.length===1,'Repeated notice appears once');
ok(issues[0].actions[0].partIds?.[0]==='opening:site-window','Location resolves to actual inventory ID');
ok(issues[0].actions[0].section==='house','Measured-opening correction stays in house settings');
ok(issues[0].actions[1].section==='stairs','Connection review reaches actual railing settings');
ok(issues[0].actions.every(a=>/measur|connection/i.test(a.guidance)),'No invented automatic fix');
ok(before===JSON.stringify(data),'Review never changes customer geometry');
ok(estimate.total===calculateDeckReleaseEstimate(data).total,'Review never changes pricing');
for(const [message,section] of [
 ['Lighting requires a compatible transformer; none is included.','lighting'],
 ['Known fixture load 150 VA exceeds included transformer capacity 100 VA.','lighting'],
 ['Under-deck drainage needs a discharge site quote.','extras'],
 ['Stair width requires a builder confirmation.','stairs'],
 ['Custom board layout stock requires confirmation.','boards'],
 ['Footing depth depends on soil conditions.','site'],
 ['Window measured height needs confirmation.','house'],
 ['Yard freight needs supplier confirmation.','backyard'],
 ['Second level connection needs review.','deck'],
 ['Custom fabrication must be confirmed.','proposal']
 ]){const issue=actionableIssues(data,estimate.model,[message])[0];ok(issue.actions[0].section===section,`Warning reaches ${section}`);ok(!issue.actions[0].partIds,'Unlocated warning does not invent a canvas position');}
ok(actionableIssues({...data,houseVisible:false},estimate.model,[]).length===0,'Hidden/no-warning state is empty');
console.log(`ACTIONABLE ISSUES OK: ${checks} geometry, navigation, deduplication and price invariance checks.`);
