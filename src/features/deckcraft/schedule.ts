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
import {usesPhysicalElevations} from './elevationDatum';
import {gTapeBasis,G_TAPE_RATE,hdConnectorBasis,hdPostStockBasis,HOME_DEPOT_CONNECTOR_RATES,HOME_DEPOT_POST_STOCK} from './connectorRates';
export interface ConnectorScheduleRow {quoteResolved?:boolean;name:string;qty:number;unit:string;rate:number|null;basis:string}
/** Connector schedule rows already carried as dollar lines in the legacy Hardware & Fasteners section. */
export const LEGACY_HARDWARE_CONNECTOR_NAMES=new Set(['Joist hangers','Ledger bolts','Post anchors','Deck screws','Hidden clips']);
/** Rows priced from Home Depot Canada / G-Tape that must also appear as Hardware & Fasteners dollar lines. */
export const PRICED_CONNECTOR_SECTION_NAMES=new Set([
  'Joist-to-beam ties','Post-to-beam caps','Blocking connections','Stringer connectors',
  'Skewed joist and hip hangers','Railing post anchors/bolts','Connector fastener sets',
  'G-Tape framing protection','Support post timber',
]);
/** Manufacturer joist-tape accessories replace the priced G-Tape line (supplier quote for the branded product). */
export const MANUFACTURER_JOIST_TAPE_IDS=new Set(['tt_protac_joist','dk_joist_tape']);
const memberLf=(m:{a:{x:number;y:number;z:number};b:{x:number;y:number;z:number}})=>Math.hypot(m.b.x-m.a.x,m.b.y-m.a.y,m.b.z-m.a.z)/12;
/** Support posts: 2026-10 packs cut lengths into HD PT 6×6 stock; legacy keeps the old quote wording/units. */
export function supportPostTimberRow(data:DeckData,model:DeckTakeoff):ConnectorScheduleRow|null{
  const cuts=model.foundationSupports.filter(f=>f.postHeightIn!==null&&f.postHeightIn>0).map(f=>f.postHeightIn as number);
  if(!cuts.length)return null;
  const cutLf=cuts.reduce((n,c)=>n+c,0)/12,physical=usesPhysicalElevations(data);
  if(!usesCurrentBuildRules(data)){
    return physical
      ?{name:'Support post timber',qty:model.foundationQuantities.supportPostLf,unit:'lf',rate:null,basis:'Measured cut length from local proposed ground to beam bearing. Confirm stock lengths, waste and inclusion in foundation allowance; quote only the separate timber scope.'}
      :{name:'Support post timber',qty:cuts.length,unit:'posts',rate:null,basis:'Confirm timber inclusion in footing allowance; separate post-length rate unavailable'};
  }
  const lengthsIn=HOME_DEPOT_POST_STOCK.map(p=>p.lengthFt*12),priceByIn=new Map(HOME_DEPOT_POST_STOCK.map(p=>[p.lengthFt*12,p]));
  const plan=orderListedStock(cuts,0,{lengthsIn,trimIn:0});
  if(plan.unresolved.length||!plan.bins.length){
    return physical
      ?{name:'Support post timber',qty:cutLf,unit:'lf',rate:null,basis:`Supplier quote required: ${plan.unresolved.length} cut(s) exceed the longest Home Depot Canada 6×6 stock (16 ft). Modeled ${cutLf.toFixed(1)} lf.`}
      :{name:'Support post timber',qty:cuts.length,unit:'posts',rate:null,basis:`Supplier quote required: ${plan.unresolved.length} cut(s) exceed the longest Home Depot Canada 6×6 stock (16 ft).`};
  }
  const byLength=new Map<number,{lengthFt:number;qty:number;unitPrice:number}>();
  for(const b of plan.bins){
    const src=priceByIn.get(b.lengthIn)!;
    const row=byLength.get(b.lengthIn)??{lengthFt:src.lengthFt,qty:0,unitPrice:src.unitPrice};
    row.qty++;byLength.set(b.lengthIn,row);
  }
  const ordered=[...byLength.values()].sort((a,b)=>a.lengthFt-b.lengthFt);
  const total=ordered.reduce((n,o)=>n+o.qty*o.unitPrice,0),qty=plan.bins.length,rate=total/qty;
  return {name:'Support post timber',qty,unit:'pcs',rate,basis:hdPostStockBasis(ordered,cutLf)};
}
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
  // Home Depot Canada / G-Tape retail applies to 2026-10 designs only; legacy saves keep the old supplier-quote status so reopened drawings and prices match what was saved.
  const hd=usesCurrentBuildRules(data),R=HOME_DEPOT_CONNECTOR_RATES;
  const rate=(source:typeof R[keyof typeof R])=>hd?source.unitPrice:null;
  const basis=(source:typeof R[keyof typeof R],legacy:string)=>hd?hdConnectorBasis(source):legacy;
  const skewedBasis=hd
    ?(activeCornerChamfers(data)
      ?`${hdConnectorBasis(R.skewedHanger)} Joist hangers skewed where joists meet the angled corners.`
      :`${hdConnectorBasis(R.skewedHanger)} Jack-joist hangers skewed to the corner angle, plus a hip hanger at each house corner.`)
    :(activeCornerChamfers(data)?'Supplier quote required; joist hangers skewed 45° where joists meet the angled corners':'Supplier quote required; jack-joist hangers skewed to the corner angle, plus a hip hanger at each house corner');
  // G-Tape covers modeled joist and beam tops. A selected manufacturer joist-tape accessory replaces this priced line.
  const brandedTape=data.catalogueAccessories?.some(id=>MANUFACTURER_JOIST_TAPE_IDS.has(id));
  const tapeLf=model.levels.reduce((n,l)=>n+l.joists.reduce((s,j)=>s+memberLf(j),0)+l.beams.reduce((s,b)=>s+memberLf(b),0),0);
  const tapeRolls=tapeLf>0?Math.ceil(tapeLf/G_TAPE_RATE.rollLf):0;
  return [
    {name:'Joist hangers',qty:h.hangers.length,unit:'ea',rate:4.5,basis:'Existing Deck Craft Pro unit rate; hanger selection to match member'},
    {name:'Skewed joist and hip hangers',qty:h.skewedHangers?.length??0,unit:'ea',rate:rate(R.skewedHanger),basis:skewedBasis},
    {name:'Ledger bolts',qty:h.ledgerBolts.length,unit:'ea',rate:2.8,basis:'Existing Deck Craft Pro unit rate'},
    {name:'Post anchors',qty:h.postAnchors,unit:'ea',rate:22,basis:'Existing Deck Craft Pro anchor allowance'},
    {name:'Joist-to-beam ties',qty:h.beamTies.length,unit:'ea',rate:rate(R.beamTie),basis:basis(R.beamTie,'Supplier quote required; no confirmed existing unit rate')},
    {name:'Post-to-beam caps',qty:h.postCaps.length,unit:'ea',rate:rate(R.postCap),basis:basis(R.postCap,'Supplier quote required; match beam plies and post width')},
    supportPostTimberRow(data,model)??{name:'Support post timber',qty:0,unit:'posts',rate:null,basis:'No support posts modeled'},
    {name:'Blocking connections',qty:h.blockingAngles.length,unit:'ea',rate:rate(R.blockingAngle),basis:basis(R.blockingAngle,'Supplier quote required for selected angle and fastener set')},
    {name:'Stringer connectors',qty:h.stringerConnectors.length,unit:'ea',rate:rate(R.stringerConnector),basis:basis(R.stringerConnector,'Supplier quote required for stair connector and fastener set')},
    {name:'Splice fasteners',qty:h.spliceBolts.length,unit:'ea',rate:null,basis:'Supplier quote required after connection design'},
    {name:'Railing brackets',qty:h.railBrackets,unit:'ea',rate:8.5,basis:'Existing railing bracket rate; included in railing system'},
    {name:'Railing cap/skirt sets',qty:h.railCaps,unit:'sets',rate:25,basis:'Existing cap/skirt rate; included in railing system'},
    {name:'Railing post anchors/bolts',qty:h.railBolts.length,unit:'ea',rate:rate(R.railingPostBolt),basis:basis(R.railingPostBolt,'Confirm inclusion in selected railing kit; separate rate unavailable')},
    {name:'Connector fastener sets',qty:h.hangers.length+(h.skewedHangers?.length??0)+h.beamTies.length+h.blockingAngles.length+h.stringerConnectors.length,unit:'sets',rate:rate(R.fastenerSet),basis:basis(R.fastenerSet,'One manufacturer-approved fastening set per connector; exact nails/screws and rate require connector selection')},
    // 2026-10 only: legacy saves never listed framing tape, so omitting it keeps reopened quote lists and totals identical.
    ...(hd&&tapeRolls>0&&!brandedTape?[{name:'G-Tape framing protection',qty:tapeRolls,unit:'rolls',rate:G_TAPE_RATE.unitPrice,basis:`${gTapeBasis()} ${tapeLf.toFixed(1)} lf of joist and beam tops.`}]:[]),
    ...(h.hidden?[{name:'Hidden clips',qty:h.screws.length,unit:'modeled fixings',rate:null,basis:'Priced by existing $0.85/sqft area allowance; no per-clip conversion'}]:[{name:'Deck screws',qty:Math.ceil(h.screws.length*1.1),unit:'ea',rate:.28,basis:'Existing screw rate; modeled positions plus 10% allowance'}]),
  ].filter(r=>r.qty>0);
}
