import type {DeckData} from './types';
import {polygonArea,type DeckTakeoff} from './deckTakeoff';
import {polygonUnion,signedArea} from './lib/polygonCuts';
import {RETIRED_DRAINAGE_NOTE,effectiveUnderDeck,underDeckConfig,underDeckSelected} from './underDeckOptions';

/** CAD before HST, checked 26 Sep 2026. Published supply benchmarks, never installed contractor quotes. */
export const UNDER_DECK_RATES={dryspace12OC12:971.68,dryspace16OC12:1004.40,dryspace16OC16:1344.37,zipupPanel12:140.35,zipupRail12:87.75,aluminumPanel:37.44,pvcPanel:31.83,cedarSqft:5.80,fabricRoll600:189,meshRoll400:151,clearStoneTonne:31.50,caddyDeliveredTonne:195,downpipe10:36.88} as const;
/** Explicit planning assumptions / allowances; only the crew-day rate comes from the existing price book. */
export const UNDER_DECK_POLICY={version:'2026-09-26-under-deck-v1',panelWaste:1.10,fabricWaste:1.20,meshWaste:1.20,stoneWaste:1.10,stoneDensityTonnesM3:1.6,ceilingTrimLf:3,furringSqft:1.25,fastenersSqft:.35,cedarFinishSqft:1.25,zipupWallTrimLf:5,gutterLf:8,gutterOutlet:70,gutterDropSpacingFt:12,deliveryHandling:150,meshFixingsSqft:.25,fabricPinsSqft:.20,drainageSqftDay:200,dryspaceSqftDay:180,zipupSqftDay:160,aluminumSqftDay:240,pvcSqftDay:200,cedarSqftDay:160,groundSqftDay:300,meshSqftDay:400,gutterLfDay:60,mobilizationDays:.25,lowAccessFactor:1.5} as const;
export interface UnderDeckRow{name:string;spec:string;qty:number;unit:string;cost:number|null;unitPrice?:number;laborCost?:number}
export interface UnderDeckSection{title:string;icon:string;description:string;quoteRequired?:boolean;total:number;items:UnderDeckRow[]}
const round=(n:number)=>Math.round(n*100)/100;

/** Union in world coordinates: vertically overlapping platforms cover the ground only once. */
export function underDeckGroundArea(model:DeckTakeoff):number{return Math.abs(polygonUnion(model.levels.filter(l=>!l.kind||l.kind==='deck').map(l=>l.footprint.outline.map(p=>({x:p.x+l.offset.x,y:p.y+l.offset.z}))),true).reduce((n,p)=>n+signedArea(p)/144,0));}

export function buildUnderDeckPricing(data:DeckData,model:DeckTakeoff,markup=1,crewDayRate=3700){
  const saved=underDeckConfig(data),c=effectiveUnderDeck(saved),flags:string[]=[],quoteRequired:string[]=[],rows:UnderDeckRow[]=[];
  if(saved.drainage==='rainescape')flags.push(RETIRED_DRAINAGE_NOTE);
  const platforms=model.levels.filter(l=>!l.kind||l.kind==='deck'),selected=c.scope==='all'?platforms:platforms.slice(0,1);
  const area=selected.reduce((n,l)=>n+polygonArea(l.footprint),0),groundArea=underDeckGroundArea(model);
  let days=0,gutterLf=0,drops=0,downpipes=0,clearance=Infinity;
  const add=(name:string,qty:number,unit:string,rate:number,spec:string)=>{if(qty>0)rows.push({name,qty:round(qty),unit,spec,cost:round(qty*rate*markup),unitPrice:round(rate*markup)});};
  const pending=(name:string,spec:string,kind:'builder'|'supplier'='builder')=>{const label=`${name} (${kind} quote)`;quoteRequired.push(label);rows.push({name:label,qty:1,unit:'review',spec,cost:null});};
  if(!underDeckSelected(c))return {config:c,area,groundArea,crewDays:0,sections:[] as UnderDeckSection[],quoteRequired,flags};
  for(const l of selected){
    const p=l.footprint.outline,xs=p.map(v=>v.x),ys=p.map(v=>v.y),w=(Math.max(...xs)-Math.min(...xs))/12,run=(Math.max(...ys)-Math.min(...ys))/12;
    const bays=Math.max(1,Math.ceil(w*12/data.joistSpacing));
    // Stock ordering is conservative by each platform envelope; a fitted zone layout remains a separate review.
    const isRectangle=p.length===4&&p.every((v,i)=>{const q=p[(i+1)%p.length];return Math.abs(q.x-v.x)<.01||Math.abs(q.y-v.y)<.01;});
    clearance=Math.min(clearance,l.top-Math.max(0,...l.joists.map(j=>j.depth))-2);
    if(c.drainage!=='none'){
      const maxStock=c.drainage==='zipup'||c.drainage==='dryspace'&&data.joistSpacing===12?12:16,zones=Math.ceil(run/maxStock);
      const outlets=Math.max(1,Math.ceil(w/UNDER_DECK_POLICY.gutterDropSpacingFt))*zones;gutterLf+=w*zones;drops+=outlets;downpipes+=outlets*Math.max(1,Math.ceil((l.top+24)/120));
      if(!isRectangle||l.zones&&l.zones.length>1)pending('Under-deck fitted drainage layout', 'Stock envelope budget included. Confirm zones, joist directions, beam crossings, post penetrations, drops and cut losses before a fixed quote.');
      if(run>16)pending('Long drainage run collection detail','Supply budget includes separate stock-length collection zones. Never splice drainage stock to extend it; intermediate gutters, waterproof transitions and final layout need a builder quote.');
      if(c.drainage==='dryspace'){
        const stock=data.joistSpacing===12?12:run<=12?12:16,segments=Math.ceil(run/stock),kits=Math.ceil(bays/6)*segments;
        if(run>stock&&run<=16)pending('DrySpace intermediate collection detail','12 in-centre kits use 12 ft stock; longer runs require a separately confirmed intermediate drainage layout. Supply budget included.');
        const rate=data.joistSpacing===12?UNDER_DECK_RATES.dryspace12OC12:stock===12?UNDER_DECK_RATES.dryspace16OC12:UNDER_DECK_RATES.dryspace16OC16;
        add(`DrySpace ${data.joistSpacing} in OC × ${stock} ft kits`,kits,'kits',rate,'Deck Outlet CAD benchmark; each kit has six panels, seven combo brackets and one ledger F bracket. Finished vinyl ceiling included.');
      }else{
        add('Zip-UP black serrated 12 ft panels',Math.ceil(w*UNDER_DECK_POLICY.panelWaste)*Math.ceil(run/12),'panels',UNDER_DECK_RATES.zipupPanel12,'TUDS CAD benchmark; 12 in wide. Whole stock panels with 10% cross-width waste. Finished waterproof ceiling included.');
        add('Zip-UP black 12 ft main rails',Math.ceil(run/2+1)*Math.ceil(w/12),'rails',UNDER_DECK_RATES.zipupRail12,'Planning rail spacing maximum 24 in; confirm current installation guide, transitions and available stock.');
        add('Zip-UP wall trim allowance',2*(w+run)*1.10,'lf',UNDER_DECK_POLICY.zipupWallTrimLf,'Planning supply allowance $5/lf before markup; matching profiles and transitions require order confirmation.');
        if(run>12||w>12)pending('Zip-UP stock transitions','Panels and rails are budgeted as separate 12 ft stock. Final manufacturer-approved transitions and collection layout require a builder quote; no seam is assumed waterproof.');
      }
    }
  }
  const low=clearance<48,access=low?UNDER_DECK_POLICY.lowAccessFactor:1;
  if(c.drainage==='zipup')pending('Zip-UP stock and oversized freight','TUDS black 12 ft benchmark is currently backordered, with oversized freight quoted at checkout. A $150 handling/delivery planning allowance is included; actual stock and freight difference need supplier confirmation.','supplier');
  if(c.drainage!=='none'){
    add('Gutter and hangers allowance',gutterLf*1.10,'lf',UNDER_DECK_POLICY.gutterLf,'Planning supply allowance $8/lf including hangers/end caps. Collects each platform separately.');
    add('Peak aluminum 10 ft downpipes',downpipes,'pcs',UNDER_DECK_RATES.downpipe10,'Home Depot Canada CAD benchmark. Drops at maximum 12 ft gutter spacing; whole pipe lengths from platform height plus 2 ft outlet extension.');
    add('Gutter outlets and downpipe fittings allowance',drops,'sets',UNDER_DECK_POLICY.gutterOutlet,'Planning supply allowance $70 per drop, including elbows, outlets and straps; straight downpipes listed separately. Discharge position needs site confirmation.');
    days+=area/(c.drainage==='dryspace'?UNDER_DECK_POLICY.dryspaceSqftDay:UNDER_DECK_POLICY.zipupSqftDay)+gutterLf/UNDER_DECK_POLICY.gutterLfDay;
    pending('Under-deck discharge and waterproofing confirmation','Planning drainage supply and installation included. Confirm pitch, ledger flashing, above/below-beam clearances, post penetrations and legal discharge. Underground drains, sump, demolition and repairs are excluded pending site quote.');
  }
  if(c.ceiling!=='none'){
    if(c.drainage==='none')pending('Waterproofing above the decorative ceiling','Ceiling supply and installation included; decorative aluminum, PVC and wood are not drainage systems. For a dry underside choose DrySpace or Zip-UP, which include their own ceiling. PVC needs waterproofing above it, confirmed before order.');
    const envelope=selected.reduce((n,l)=>{const p=l.footprint.outline;return n+(Math.max(...p.map(v=>v.x))-Math.min(...p.map(v=>v.x)))*(Math.max(...p.map(v=>v.y))-Math.min(...p.map(v=>v.y)))/144;},0);
    const perimeter=selected.reduce((n,l)=>n+l.footprint.outline.reduce((s,p,i,o)=>s+Math.hypot(p.x-o[(i+1)%o.length].x,p.y-o[(i+1)%o.length].y)/12,0),0);
    if(c.ceiling==='aluminum')add('Peak aluminum 10 ft × 16 in nonvented panels',Math.ceil(envelope*1.10/(10*16/12)),'panels',UNDER_DECK_RATES.aluminumPanel,'Home Depot Canada black soffit benchmark; conservative envelope and 10% stock waste.');
    if(c.ceiling==='pvc')add('Trusscore PVC 8 ft × 16 in panels',Math.ceil(envelope*1.10/(8*16/12)),'panels',UNDER_DECK_RATES.pvcPanel,'Home Depot Canada white Wall&CeilingBoard benchmark. Sheltered from direct sun; needs waterproofing above, confirmed before order.');
    if(c.ceiling==='cedar'){
      add('Western red cedar knotty 1×4 T&G',envelope*1.10,'sqft',UNDER_DECK_RATES.cedarSqft,'Springwater Lumber published CAD supply; 10% envelope waste. Confirm exposed-face coverage, moisture and sheltered exterior suitability.');
      add('Cedar protective finish allowance',envelope*1.10,'sqft',UNDER_DECK_POLICY.cedarFinishSqft,'Planning supply allowance $1.25/sqft; finish labour is included in the cedar productivity allowance.');
    }
    add('Ceiling perimeter trim allowance',perimeter*1.10,'lf',UNDER_DECK_POLICY.ceilingTrimLf,'Planning supply allowance $3/lf; matching channels, expansion gaps and access panels confirmed before order.');
    add('Ceiling furring allowance',envelope,'sqft',UNDER_DECK_POLICY.furringSqft,'Planning supply allowance $1.25/sqft; vented / serviceable installation with required support.');
    add('Ceiling corrosion-resistant fixings allowance',envelope,'sqft',UNDER_DECK_POLICY.fastenersSqft,'Planning supply allowance $0.35/sqft.');
    days+=envelope/(c.ceiling==='cedar'?UNDER_DECK_POLICY.cedarSqftDay:c.ceiling==='pvc'?UNDER_DECK_POLICY.pvcSqftDay:UNDER_DECK_POLICY.aluminumSqftDay);
    pending('Sheltered ceiling finish suitability','Supply and installation planning allowances included. Confirm drainage, ventilation, panel span/support, maintenance access, finish suitability and clearance before a fixed quote.');
  }
  let stoneTonnes=0,fabricRolls=0,meshRolls=0;
  if(c.gravel){
    stoneTonnes=groundArea*c.gravelDepthIn/12/35.3146667*UNDER_DECK_POLICY.stoneDensityTonnesM3*UNDER_DECK_POLICY.stoneWaste;
    const bags=Math.ceil(stoneTonnes);fabricRolls=Math.ceil(groundArea*UNDER_DECK_POLICY.fabricWaste/600);
    add('3/4 in clear stone',bags,'tonne bags',UNDER_DECK_RATES.clearStoneTonne,`${round(groundArea)} union sq ft × ${c.gravelDepthIn} in depth; ${round(stoneTonnes)} t planning need including 10%, at 1.6 t/m³. Whole 1 t Carr caddy bags ordered.`);
    add('Carr caddy bag packaging and delivery',bags,'bags',UNDER_DECK_RATES.caddyDeliveredTonne-UNDER_DECK_RATES.clearStoneTonne,'2026 list: $195 delivered per 1 t clear-stone caddy, less $31.50 trade stone already listed. Delivery zones 1–3; confirm weight/coverage on order.');
    add('RSI weed fabric 6 ft × 100 ft',fabricRolls,'rolls',UNDER_DECK_RATES.fabricRoll600,'Home Depot Canada CAD benchmark; 600 sq ft/roll, 20% total overlap / cut allowance. Gravel and fabric cover ground projection once.');
    add('Fabric pins allowance',groundArea,'sqft',UNDER_DECK_POLICY.fabricPinsSqft,'Planning supply allowance $0.20/sqft; not an insect screen.');
    days+=groundArea/UNDER_DECK_POLICY.groundSqftDay;
    pending('Under-deck ground conditions and freight zone','Light weed removal, fabric and hand-spreading installation included. Major excavation, spoil disposal, grading/drainage correction, concealed utilities and delivery beyond Carr zones 1–3 need a site quote.');
  }
  if(c.floorMesh){
    meshRolls=Math.ceil(area*UNDER_DECK_POLICY.meshWaste/400);
    add('Phifer fibreglass insect mesh 48 in × 100 ft',meshRolls,'rolls',UNDER_DECK_RATES.meshRoll400,'Home Depot Canada CAD benchmark; 400 sq ft/roll, 20% total overlap/cut allowance. Floor gaps only; open sides remain unscreened.');
    add('Insect mesh fixings allowance',area,'sqft',UNDER_DECK_POLICY.meshFixingsSqft,'Planning supply allowance $0.25/sqft; secure supported overlaps.');
    days+=area/UNDER_DECK_POLICY.meshSqftDay;
    flags.push('Floor insect mesh blocks entry through deck-board gaps only; open sides remain unscreened. It does not create a mosquito-proof enclosure: side screens, door and roof seals are not included. Plan mesh before decking; deck removal/retrofit is excluded.');
    if(c.drainage!=='none')pending('Combined floor mesh and drainage detail','Both selected allowances included; confirm mesh placement without puncturing drainage membranes or obstructing water/maintenance access.');
  }
  days=round((days+UNDER_DECK_POLICY.mobilizationDays)*access);
  add('Non-aggregate delivery and handling allowance',1,'trip',UNDER_DECK_POLICY.deliveryHandling,'Planning allowance $150 before markup, separate from Carr caddy delivery; confirm oversized freight and split supplier trips.');
  if(low)flags.push(`Under-deck clear-height budget is about ${round(Math.max(0,clearance))} in. Installation planning uses a 1.5× restricted-access factor below 48 in; this is not a habitable-room clearance approval.`);
  if(data.siteType!=='Standard'||data.hasDemo)pending('Under-deck access and retrofit extras','New-build standard-access installation planning included (restricted-height factor where applicable). Existing board removal, special lifting/scaffold, difficult-site transport, island freight and repairs need a site quote.');
  rows.push({name:'Under-deck installation planning allowance',qty:days,unit:'crew-days',unitPrice:crewDayRate,laborCost:crewDayRate,spec:`${days} crew-days × $${crewDayRate}/day; planning productivity, shared 0.25 day setup${low?', 1.5× restricted-height access':''}. Labour receives no material markup. Base deck labour is separate.`,cost:round(days*crewDayRate)});
  const sections:UnderDeckSection[]=[{title:'Under-deck options',icon:'🌧',description:`${c.scope==='all'?'All deck platforms':'Main deck'}: ${round(area)} sq ft. Ground footprint: ${round(groundArea)} sq ft (union). Published CAD supply benchmarks plus explicit installation and ancillary allowances; site details pending. ${c.drainage==='dryspace'||c.drainage==='zipup'?'Drainage system includes finished ceiling; no separate ceiling charge.':''}`,quoteRequired:quoteRequired.length>0,total:round(rows.reduce((n,r)=>n+(r.cost??0),0)),items:rows}];
  flags.push('Under-deck prices are planning budgets using dated published supply benchmarks and disclosed crew productivity. Confirm chosen profiles, availability, delivery and site details before a fixed customer quote.');
  return {config:c,area,groundArea,stoneTonnes,fabricRolls,meshRolls,crewDays:days,sections,quoteRequired:[...new Set(quoteRequired)],flags};
}
