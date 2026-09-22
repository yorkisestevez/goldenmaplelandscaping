import type {DeckData} from './types';
import type {DeckTakeoff,Member} from './deckTakeoff';
import {getHardwareLayout} from './hardwareLayout';
import {planStock} from './stockPlan';
import {getStairBoards} from './stairBoards';
export interface ConnectorScheduleRow {name:string;qty:number;unit:string;rate:number|null;basis:string}
export interface StockScheduleRow {name:string;section:string;stockLengthIn:number;orderedPieces:number;cutsIn:number[][];unresolvedIn:number[];installedLf:number;orderedLf:number}
export function stairStock(data:DeckData,model:DeckTakeoff):StockScheduleRow[]{
  const cuts=getStairBoards(data,model).map(p=>p.w);
  if(!cuts.length)return [];
  const plan=planStock(cuts,model.stockLength);
  const stringers=planStock(model.stringers.map(m=>Math.hypot(m.b.x-m.a.x,m.b.y-m.a.y,m.b.z-m.a.z)),192);
  const risers=planStock(model.riserBoards.map(b=>b.w),model.stairSupport.riserStockLengthIn);
  return [{name:'Stair tread decking — included in per-riser allowance',section:`${data.boardWidth} in decking`,stockLengthIn:model.stockLength,orderedPieces:plan.bins.length,cutsIn:plan.bins.map(b=>b.cutsIn),unresolvedIn:plan.unresolved,installedLf:plan.installedLf,orderedLf:plan.purchasedLf},
    {name:'Stair stringers — included in per-riser allowance',section:'1.5 × 9.25 in framing',stockLengthIn:192,orderedPieces:stringers.bins.length,cutsIn:stringers.bins.map(b=>b.cutsIn),unresolvedIn:stringers.unresolved,installedLf:stringers.installedLf,orderedLf:stringers.purchasedLf},
    {name:'Closed stair riser faces — included in per-riser allowance',section:`${model.stairSupport.riserThicknessIn} × ${model.stairSupport.riserStockWidthIn} in; rip to actual rise less tread thickness`,stockLengthIn:model.stairSupport.riserStockLengthIn,orderedPieces:risers.bins.length,cutsIn:risers.bins.map(b=>b.cutsIn),unresolvedIn:risers.unresolved,installedLf:risers.installedLf,orderedLf:risers.purchasedLf}];
}
export function constructionStock(model:DeckTakeoff):StockScheduleRow[]{
  const groups=new Map<string,{members:Member[];section:string}>();
  for(const l of model.levels)for(const m of [...l.joists,...l.beams,...l.blocking,...((l as typeof l&{rim?:Member[]}).rim||[])]){
    const section=`${m.width} × ${m.depth} in`,g=groups.get(section)||{members:[],section};g.members.push(m);groups.set(section,g);
  }
  return [...groups.values()].map(g=>{const plan=planStock(g.members.map(m=>Math.hypot(m.b.x-m.a.x,m.b.y-m.a.y,m.b.z-m.a.z)),192);return {name:'Framing lumber',section:g.section,stockLengthIn:192,orderedPieces:plan.bins.length,cutsIn:plan.bins.map(b=>b.cutsIn),unresolvedIn:plan.unresolved,installedLf:plan.installedLf,orderedLf:plan.purchasedLf};});
}
export function connectorSchedule(data:DeckData,model:DeckTakeoff,h=getHardwareLayout(data,model)):ConnectorScheduleRow[]{
  return [
    {name:'Joist hangers',qty:h.hangers.length,unit:'ea',rate:4.5,basis:'Existing Deck Craft Pro unit rate; hanger selection to match member'},
    {name:'Skewed joist and hip hangers',qty:h.skewedHangers?.length??0,unit:'ea',rate:null,basis:'Supplier quote required; jack-joist hangers skewed to the corner angle, plus a hip hanger at each house corner'},
    {name:'Ledger bolts',qty:h.ledgerBolts.length,unit:'ea',rate:2.8,basis:'Existing Deck Craft Pro unit rate'},
    {name:'Post anchors',qty:h.postAnchors,unit:'ea',rate:22,basis:'Existing Deck Craft Pro anchor allowance'},
    {name:'Joist-to-beam ties',qty:h.beamTies.length,unit:'ea',rate:null,basis:'Supplier quote required; no confirmed existing unit rate'},
    {name:'Post-to-beam caps',qty:h.postCaps.length,unit:'ea',rate:null,basis:'Supplier quote required; match beam plies and post width'},
    {name:'Support post timber',qty:model.quantities.supportPosts,unit:'posts',rate:null,basis:'Confirm timber inclusion in footing allowance; separate post-length rate unavailable'},
    {name:'Blocking connections',qty:h.blockingAngles.length,unit:'ea',rate:null,basis:'Supplier quote required for selected angle and fastener set'},
    {name:'Stringer connectors',qty:h.stringerConnectors.length,unit:'ea',rate:null,basis:'Supplier quote required for stair connector and fastener set'},
    {name:'Splice fasteners',qty:h.spliceBolts.length,unit:'ea',rate:null,basis:'Supplier quote required after connection design'},
    {name:'Railing brackets',qty:h.railBrackets,unit:'ea',rate:8.5,basis:'Existing railing bracket rate; included in railing system'},
    {name:'Railing cap/skirt sets',qty:h.railCaps,unit:'sets',rate:25,basis:'Existing cap/skirt rate; included in railing system'},
    {name:'Railing post anchors/bolts',qty:h.railBolts.length,unit:'ea',rate:null,basis:'Confirm inclusion in selected railing kit; separate rate unavailable'},
    {name:'Connector fastener sets',qty:h.hangers.length+(h.skewedHangers?.length??0)+h.beamTies.length+h.blockingAngles.length+h.stringerConnectors.length,unit:'sets',rate:null,basis:'One manufacturer-approved fastening set per connector; exact nails/screws and rate require connector selection'},
    ...(h.hidden?[{name:'Hidden clips',qty:h.screws.length,unit:'modeled fixings',rate:null,basis:'Priced by existing $0.85/sqft area allowance; no per-clip conversion'}]:[{name:'Deck screws',qty:Math.ceil(h.screws.length*1.1),unit:'ea',rate:.28,basis:'Existing screw rate; modeled positions plus 10% allowance'}]),
  ].filter(r=>r.qty>0);
}
