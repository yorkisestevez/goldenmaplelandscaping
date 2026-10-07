import {physicalSupportTimber} from './physicalQuote';
import {activeCornerChamfers} from './lib/cornerChamfers';
import type {DeckData} from './types';
import type {DeckTakeoff,Member} from './deckTakeoff';
import {getHardwareLayout} from './hardwareLayout';
import {orderListedStock,planStock} from './stockPlan';
import {getStairBoards} from './stairBoards';
import {colourName,deckColourRef,darkSlateBorder} from './boardFinishes';
import {partRef} from './deckPartFinishes';
import {deckingStock,productStock} from './deckingStock';
import {usesCurrentBuildRules} from './buildRules';
export interface ConnectorScheduleRow {quoteResolved?:boolean;name:string;qty:number;unit:string;rate:number|null;basis:string}
/** binLengthsIn: the length each cutting group is bought in, present only when the product lists more than one length
 * (each packed board is bought at the shortest listed length that holds it); stockLengthIn is then the longest. */
export interface StockScheduleRow {name:string;section:string;stockLengthIn:number;binLengthsIn?:number[];orderedPieces:number;cutsIn:number[][];unresolvedIn:number[];installedLf:number;orderedLf:number}
/** Stable keys shared by the drawing schedule and quantity CSVs. */
const rowHash=(key:string)=>{let value=2166136261;for(const c of key){value=Math.imul(value^c.charCodeAt(0),16777619);}return (value>>>0).toString(16).toUpperCase().padStart(8,'0');};
export const connectorRowId=(name:string)=>`C-${rowHash(name).slice(-6)}`;
export const stockRowId=(row:Pick<StockScheduleRow,'name'|'section'|'stockLengthIn'>)=>`F-${rowHash(`${row.name}|${row.section}|${row.stockLengthIn}`).slice(-6)}`;
export function stairStock(data:DeckData,model:DeckTakeoff):StockScheduleRow[]{
  const boards=getStairBoards(data,model);
  if(!boards.length)return [];
  const rows:StockScheduleRow[]=[];
  // Saves from before the 2026-10 build rules keep 9b2ee11's tread-row wording, so the row ID and cut list match old exports.
  const legacy=!usesCurrentBuildRules(data);
  for(const role of ['field','border'] as const){
    const cuts=boards.filter(b=>(b.role??'field')===role).map(b=>b.w);if(!cuts.length)continue;
    // Same purchase rule as the deck boards: shortest listed length per packed board (legacy: the one legacy length).
    const ref=partRef(data,role==='border'?'border':'treads')??deckColourRef(data),slate=role==='border'&&darkSlateBorder(data),label=slate?'Dark Slate — supplier confirms product':colourName(ref),id=slate?'dark-slate':ref.split(':')[0],stock=deckingStock(id,data.boardWidth),product=productStock(data,id),mixed=new Set(product.lengthsIn).size>1,plan=orderListedStock(cuts,0,product);
    rows.push({name:role==='border'?'Stair picture-frame boards — assembly allowance; detail quote required':'Stair tread decking — included in per-riser allowance',section:legacy&&role==='field'?`${data.boardWidth} in decking`:`${data.boardWidth} in decking · ${label}; ${plan.offcutLf.toFixed(1)} lf offcuts; saw kerf included; ${stock.confirmed?'manufacturer-listed stock length, supplier availability pending':'stock-length allowance, supplier confirmation required'}`,stockLengthIn:Math.max(...product.lengthsIn),...(mixed?{binLengthsIn:plan.bins.map(b=>b.lengthIn)}:{}),orderedPieces:plan.bins.length,cutsIn:plan.bins.map(b=>b.cutsIn),unresolvedIn:plan.unresolved,installedLf:plan.installedLf,orderedLf:plan.purchasedLf});
  }
  const stringers=planStock(model.stringers.map(m=>Math.hypot(m.b.x-m.a.x,m.b.y-m.a.y,m.b.z-m.a.z)),192);
  const risers=planStock(model.riserBoards.map(b=>b.w),model.stairSupport.riserStockLengthIn);
  return [...rows,
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
    {name:'Skewed joist and hip hangers',qty:h.skewedHangers?.length??0,unit:'ea',rate:null,basis:activeCornerChamfers(data)?'Supplier quote required; joist hangers skewed 45° where joists meet the angled corners':'Supplier quote required; jack-joist hangers skewed to the corner angle, plus a hip hanger at each house corner'},
    {name:'Ledger bolts',qty:h.ledgerBolts.length,unit:'ea',rate:2.8,basis:'Existing Deck Craft Pro unit rate'},
    {name:'Post anchors',qty:h.postAnchors,unit:'ea',rate:22,basis:'Existing Deck Craft Pro anchor allowance'},
    {name:'Joist-to-beam ties',qty:h.beamTies.length,unit:'ea',rate:null,basis:'Supplier quote required; no confirmed existing unit rate'},
    {name:'Post-to-beam caps',qty:h.postCaps.length,unit:'ea',rate:null,basis:'Supplier quote required; match beam plies and post width'},
    physicalSupportTimber(data,model)??{name:'Support post timber',qty:model.quantities.supportPosts,unit:'posts',rate:null,basis:'Confirm timber inclusion in footing allowance; separate post-length rate unavailable'},
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
