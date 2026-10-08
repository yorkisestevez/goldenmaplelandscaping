import assert from 'node:assert/strict';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {HOME_DEPOT_CONNECTOR_RATES} from '../src/features/deckcraft/connectorRates';
import {PRICED_CONNECTOR_SECTION_NAMES} from '../src/features/deckcraft/schedule';
import {unconfirmedRates} from '../src/features/deckcraft/rateConfidence';

let checks=0;const ok=(v:unknown,m:string)=>{assert(v,m);checks++;};

const e=calculateEstimate(structuredClone(DEFAULT_DECK),DECK_SETTINGS);
const hw=e.sections.find(s=>s.title==='Hardware & Fasteners');
ok(hw&&hw.total>0,'Hardware & Fasteners carries a priced total');

const expect:{name:string;rate:number}[]=[
  {name:'Joist-to-beam ties',rate:HOME_DEPOT_CONNECTOR_RATES.beamTie.unitPrice},
  {name:'Post-to-beam caps',rate:HOME_DEPOT_CONNECTOR_RATES.postCap.unitPrice},
  {name:'Blocking connections',rate:HOME_DEPOT_CONNECTOR_RATES.blockingAngle.unitPrice},
  {name:'Connector fastener sets',rate:HOME_DEPOT_CONNECTOR_RATES.fastenerSet.unitPrice},
  {name:'Railing post anchors/bolts',rate:HOME_DEPOT_CONNECTOR_RATES.railingPostBolt.unitPrice},
];
for(const {name,rate} of expect){
  const row=e.connectorSchedule.find(r=>r.name===name);
  ok(row&&row.rate===rate&&row.qty>0,`${name} uses HD CAD ${rate}`);
  ok(!e.quoteRequired.includes(name),`${name} is not an outstanding supplier quote`);
  const item=hw!.items.find(i=>i.name===name);
  ok(item&&item.cost!==null&&Math.abs(Number(item.cost)-rate*row!.qty*1.35)<.02,`${name} is a Hardware dollar line (qty × rate × markup)`);
}

ok(PRICED_CONNECTOR_SECTION_NAMES.has('Skewed joist and hip hangers'),'Skewed hangers are in the priced connector set');
ok(e.connectorSchedule.some(r=>r.name==='Support post timber'&&r.rate===null),'Support post timber stays unpriced');
ok(unconfirmedRates().some(r=>r.id==='hd-connectors'),'rateConfidence lists the HD connector pack');

const withStairs=calculateEstimate({...structuredClone(DEFAULT_DECK),height:72,stairFlights:1,stairWidth:48,stairType:'Straight'},DECK_SETTINGS);
const stringer=withStairs.connectorSchedule.find(r=>r.name==='Stringer connectors');
ok(stringer&&stringer.rate===HOME_DEPOT_CONNECTOR_RATES.stringerConnector.unitPrice&&stringer.qty>0,'Stringer connectors use LSCZ HD rate when stairs exist');
ok(!withStairs.quoteRequired.includes('Stringer connectors'),'Stringer connectors are not a quote');

console.log(`DECK CONNECTOR RATES OK — ${checks} checks; Home Depot Canada hardware benchmarks priced.`);
