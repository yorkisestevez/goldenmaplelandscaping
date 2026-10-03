import {hardscapeSelection} from './hardscapeCatalogue';
import type {YardFeatureModel} from './yardModel';
import type {PublicYardSection} from './yardTakeoff';

/** Quantities and prerequisites stay synchronous; extended contractor notes load with quote review. */
export function wallQuoteScopes(f:YardFeatureModel,hasAssemblyAllowance:boolean):PublicYardSection[]{
 const c=f.config,q=f.quantities,selected=hardscapeSelection(c),rows:PublicYardSection[]=[];
 const basis=hasAssemblyAllowance?'Existing assembly allowance included; quote additional scope only. ':'Selected supply/installation unpriced. ';
 const add=(id:string,label:string,quantity:number,unit:string,note='Measured planning scope; confirm assembly, labour and order details.')=>{if(quantity>0)rows.push({id:`${id}-${c.id}`,label:`${c.name}: ${label}`,amountCents:null,featureIds:[c.id],quantity,unit,note:basis+note});};
 const status=(id:string,label:string,note:string)=>rows.push({id:`${id}-${c.id}`,label:`${c.name}: ${label}`,amountCents:null,featureIds:[c.id],note});
 status('wall-design','selected wall system and site design confirmation','Surveyed grades, foundation, reinforcement, soil/slope/surcharge stability and discharge require system/site design; costs cannot approve it.');
 if(q.wallAssemblyPending){
  status('wall-assembly','manufacturer backing and top-course assembly confirmation','Backing/base/middle/top assembly pending; model envelopes are not stock orders.');
  add('wall-assembly-review','Preliminary manufacturer assembly survey and quote',1,'scope');
 }
 if(!hasAssemblyAllowance&&!q.wallAssemblyPending){
  const size=(u:{widthMm:number;lengthMm:number;heightMm:number})=>`${u.widthMm} × ${u.lengthMm} × ${u.heightMm} mm`;
  add('wall-body','Wall body stock supply',q.wallBlocks,'stock units',`Buried courses and cut-stock blanks included. ${selected?size(selected.unit):'Generic body'}; confirm end/corner stock and packaging.`);
  add('wall-caps','Selected cap stock supply',q.wallCaps,'stock units',`${selected?.cap?size(selected.cap):'Generic cap'}; confirm cuts and procurement waste.`);
  add('wall-installation','Wall body and cap installation',q.wallFaceSqft,'sq ft exposed face');
 }
 if(q.geogridPlacementPending||q.wallRetainedGradePending)status('wall-retained-grade','retained ground and reinforcement placement confirmation','Reinforcement above proposed ground is excluded from measured placement. Conservative supply/install allowance remains; confirm cover, connections, retained grading and engineering before execution.');
 if(q.drainOutletElevationPending)status('wall-outlet-elevation','drain outlet elevation and fall confirmation','Enter surveyed discharge invert, required fall and route length. Multiple outlets require separate route review; a scalar check cannot approve collector routing or discharge.');
 add('geogrid','Geogrid stock supply',Math.max(q.geogridOrderSqft,q.geogridPlanningOrderSqft??0),'sq ft order',`${q.geogridMaxLayersPerBench??q.geogridLayers} maximum planning layers per foundation bench; ${((q.geogridLengthIn??0)/12).toFixed(2)} ft long. Gross strips/overlap + 10% cuts; design pending.`);
 const scopes:[string,string,number,string][]=[
  ['geogrid-installation','Geogrid installation',Math.max(q.geogridSqft,q.geogridPlanningSqft??0),'sq ft installed'],
  ['wall-base','Compacted leveling aggregate and placement',q.wallBaseYd3,'cu yd compacted'],
  ['wall-drainage','Drainage stone and placement',q.drainageYd3,'cu yd placed'],
  ['wall-backfill','Reinforced backfill and compaction',q.backfillYd3,'cu yd compacted'],
  ['wall-filter','Wall separator fabric and installation',q.wallFilterFabricSqft,'sq ft envelope'],
  ['wall-drain','Main perforated drain and installation',q.drainPipeLf,'linear ft main run'],
  ['wall-outlet-pipe','Drain outlet extension and installation',q.drainOutletPipeLf??0,'linear ft outlet run'],
  ['wall-outlet','Drain outlet fittings and termination',q.drainOutletCount??1,'outlets'],
  ['wall-cap-bond','Cap adhesive and installation',q.wallCapBondLf??(q.wallCaps>0?q.wallLengthLf:0),'linear ft cap bond'],
  ['wall-accessories','Core-fill stone, connectors and special stock',1,'system quote'],
  ['wall-freight','Wall packaging, freight and order adjustments',1,'order'],
  ['wall-engineering','Wall survey/design services',1,'scope']
 ];
 for(const row of scopes)add(...row);
 if(!(q.drainOutletPipeLf>0))status('wall-outlet-route','drain outlet route and length confirmation','Enter surveyed outlet length; confirm gradient and lawful discharge. Main collection length is separate.');
 return rows;
}
