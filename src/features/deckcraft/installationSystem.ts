import type {DeckTakeoff} from './deckTakeoff';
import type {DeckData} from './types';
import {DECKING_CATALOGUE} from './manufacturerCatalog';
import {buildSkirting,validateSkirting,SKIRTING_REVIEW} from './skirting';
import {buildDrySpace,validateDrySpace,DRY_SPACE_PRODUCTS} from './drySpace';
import {boardFinishStatus,validateBoardFinishes} from './boardFinishes';

export const FRAMING_OPTIONS = ['Pressure-treated lumber','Steel','Aluminum','Engineered wood'] as const;
export type FramingMaterial = typeof FRAMING_OPTIONS[number];
export interface InstallationSelection {
  framing: FramingMaterial;
  framingSystem?: string;
  boardSku?: string;
  profile: 'Unknown'|'Solid'|'Scalloped';
  edge: 'Unknown'|'Grooved'|'Square';
  thicknessMm?: number;
  temperatureC?: number;
  fastenerProduct?: string;
  sideGapMm?: number;
  endGapMm?: number;
  ventilationMm?: number;
}
export const DEFAULT_INSTALLATION:InstallationSelection={framing:'Pressure-treated lumber',profile:'Unknown',edge:'Unknown'};

/** This public input contains selections, never a caller-supplied approval or rules. */
export function validateInstallation(value:unknown):InstallationSelection {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid installation selection.');
  const input=value as Record<string,unknown>, clean:InstallationSelection={...DEFAULT_INSTALLATION};
  const choices={framing:FRAMING_OPTIONS,profile:['Unknown','Solid','Scalloped'],edge:['Unknown','Grooved','Square']} as const;
  for(const key of ['framing','profile','edge'] as const)if(Object.hasOwn(input,key)){
    if(!(choices[key] as readonly unknown[]).includes(input[key]))throw new Error(`Unsupported installation ${key}.`);
    Object.assign(clean,{[key]:input[key]});
  }
  for(const key of ['framingSystem','boardSku','fastenerProduct'] as const)if(Object.hasOwn(input,key)&&input[key]!==undefined){
    if(typeof input[key]!=='string'||input[key].length>160)throw new Error(`Installation ${key} must be at most 160 characters.`);
    clean[key]=input[key].trim();
  }
  const ranges={thicknessMm:[5,80],temperatureC:[-40,70],sideGapMm:[0,25],endGapMm:[0,50],ventilationMm:[0,3000]} as const;
  for(const key of Object.keys(ranges) as (keyof typeof ranges)[])if(input[key]!==undefined){
    const n=input[key], [min,max]=ranges[key];
    if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)throw new Error(`Installation ${key} must be between ${min} and ${max}.`);
    clean[key]=n;
  }
  return clean;
}

export type InstallationFamily='wood'|'tt-composite'|'tt-pvc'|'surestone'|'deckorators-wpc'|'unknown';
export function installationFamily(id:string):InstallationFamily {
  if(['pressure_treated','cedar'].includes(id))return 'wood';
  if(['tt_harvest','tt_harvest_plus','tt_landmark','tt_vintage'].includes(id))return 'tt-pvc';
  if(['tt_prime','tt_prime_plus','tt_premier','tt_premier_plus','tt_terrain','tt_terrain_plus','tt_reserve','tt_legacy'].includes(id))return 'tt-composite';
  if(['deck_voyage','deck_summit'].includes(id))return 'surestone';
  if(['deck_vista','deck_venture','deck_altitude'].includes(id))return 'deckorators-wpc';
  return 'unknown';
}
export const INSTALLATION_SOURCES={
  'tt-composite':{title:'TimberTech Composite installation guide, pp. 3 and 8; revision not established',url:'https://assets.timbertech.com/content/dam/document-library/TimberTech/installation-guides/decking/TimberTech-Composite-Installation-Guide-ENG.pdf'},
  'tt-pvc':{title:'TimberTech Advanced PVC installation guide',url:'https://assets.timbertech.com/content/dam/wp-content/TimberTech-Advanced-PVC-Decking-Installation-Guide_ENG.pdf'},
  surestone:{title:'Deckorators Surestone installation instructions',url:'https://www.deckorators.com/cdn/shop/files/8529-deckorators-surestone-technology-decking-installation-en.pdf'},
  'deckorators-wpc':{title:'Deckorators product-specific installation library',url:'https://www.deckorators.com/pages/installation-instructions'},
  aluminum:{title:'TimberTech Aluminum Framing installation guide (system-specific)',url:'https://assets.timbertech.com/content/dam/wp-content/TimberTech-Aluminum-Framing-Installation-Guide.pdf'},
};
export interface InstallationIssue {id:string;severity:'blocker'|'review';message:string}
export interface InstallationStep {title:string;instruction:string}
export function buildInstallationPlan(data:DeckData){
  const selection=validateInstallation(data.installation??DEFAULT_INSTALLATION);
  const family=installationFamily(data.deckingMaterial);
  const product=DECKING_CATALOGUE.find(p=>p.id===data.deckingMaterial);
  const issues:InstallationIssue[]=[];
  const add=(id:string,message:string,severity:InstallationIssue['severity']='review')=>issues.push({id,message,severity});
  const timberModel=selection.framing==='Pressure-treated lumber';
  if(!timberModel)add('unmodeled-framing',`${selection.framing} framing is a planning selection only. Current geometry, quantities and price remain a timber reference, not this framing system. CAD exports are blocked.`,'blocker');
  if(family==='unknown')add('unknown-product','No installation family or reviewed guide is mapped to this collection.','blocker');
  if(!selection.boardSku)add('board-sku','Record the exact board SKU and confirm current collection availability.');
  if(selection.profile==='Unknown'||selection.edge==='Unknown'||selection.thicknessMm===undefined)add('board-specification','Confirm board profile, edge and actual thickness; collection names alone do not establish the installation detail.');
  if(!selection.fastenerProduct)add('fastener-product','Select an exact fastener / clip product approved for the board and framing substrate.');
  if(data.fasteningSystem==='Hidden'&&selection.edge==='Square')add('square-hidden','Square-edge boards do not establish clip compatibility. Routing and hidden fastening require explicit manufacturer instructions.','blocker');
  if(data.catalogueAccessories?.includes('tt_concealoc')&&!['tt-composite','tt-pvc'].includes(family))add('cross-brand-tt-clip','TimberTech CONCEALoc was selected with another decking family. Compatibility has not been established.','blocker');
  if(data.catalogueAccessories?.includes('dk_stealthlock')&&!['surestone','deckorators-wpc'].includes(family))add('cross-brand-dk-clip','Deckorators StealthLock was selected with another decking family. Compatibility has not been established.','blocker');
  if(!timberModel&&!selection.framingSystem)add('framing-system','Select the framing manufacturer, member series and connection system.','blocker');
  if(selection.framing==='Steel'||selection.framing==='Aluminum'){
    add('metal-fastening','Do not carry wood screws, clips or timber span tables into metal framing. Verify gauge/thickness, fastener penetration, corrosion isolation and system-specific connections.','blocker');
    if(data.catalogueAccessories?.some(id=>['tt_concealoc','dk_stealthlock'].includes(id)))add('wood-clips','Selected catalogue clips have not been verified for this metal framing; no compatibility approval is inferred.','blocker');
  }
  if(selection.framing==='Engineered wood')add('engineered-exposure','Verify exterior exposure/use rating, preservative treatment, manufacturer spans and compatible connectors for the exact engineered member.','blocker');
  if(family!=='wood'&&selection.temperatureC===undefined)add('temperature','Record installation temperature and the product-specific temperature/expansion method.');
  add('gap-review','Entered gaps are proposed inputs, not verified requirements. Confirm side, end, butt/miter and obstruction gaps separately in the applicable guide.');
  if(data.pattern==='Diagonal'||data.pattern==='Herringbone')add('angled-support','Check support spacing for the actual board angle and each board segment; a general straight-board span is insufficient.');
  if(data.pictureFrameRows>0||data.pattern==='Picture Frame'||data.hasInlay)add('border-blocking','Detail independent bearing and fastening for borders, inlays and adjacent field-board ends.');
  if(data.borderFinish==='Dark Slate')add('mixed-border','The Deckorators Dark Slate border is a separate product: confirm its guide, fasteners and movement at interfaces with the field boards.');
  if(data.stairFlights>0)add('stair-assembly','Verify the exact tread profile, stringer spacing, overhang, riser gaps and stair fasteners. Deck joist spacing is not a stair rule.');
  const drySelection=validateDrySpace(data.drySpace),dryProduct=DRY_SPACE_PRODUCTS.find(p=>p.id===drySelection?.system),skirting=validateSkirting(data.skirting),boardFinishes=validateBoardFinishes(data.boardFinishes);
  if(drySelection?.enabled)add('manufacturer-drainage',`${dryProduct!.name} is selected. Coordinate actual joist bays, blocking, pitch, collection gutters, discharge, flashing and service access using the current system instructions. Unknown quantities and installation remain quote-required; an attractive preview is not an approved dry room.`);
  else if(data.hasDrainage&&data.drySpace===undefined)add('drainage','Coordinate the legacy generic drainage allowance with ventilation, fasteners and framing durability; no manufacturer system or approved assembly has been established.');
  if(skirting?.enabled)add('skirting',`${SKIRTING_REVIEW} Boards, backing, connections and labour remain quote-required; obtain product-specific cladding/skirting approval instead of treating every decking board as suitable vertical cladding.`);
  if(skirting?.enabled&&drySelection?.enabled&&drySelection.system==='timbertech-dryspace')add('dryspace-skirting','TimberTech DrySpace prohibits perimeter-wall enclosure. Resolve the proposed skirting, ventilation and service-access arrangement with the manufacturer before construction.','blocker');
  if(boardFinishes.length)add('board-colours',`${boardFinishes.length} individual board colour previews require actual product/SKU and price matching. RGB colours neither select an orderable finish nor authorize painting composite/PVC boards. Recheck unmatched board identifiers after layout changes.`);
  add('structural-review','Loads, spans, footings, ledger, lateral restraint and guard anchorage need a separate project-specific structural review.','blocker');
  const sources=family==='wood'||family==='unknown'?[]:[INSTALLATION_SOURCES[family]];
  if(selection.framing==='Aluminum')sources.push(INSTALLATION_SOURCES.aluminum);
  if(drySelection?.enabled)sources.push({title:`${dryProduct!.name} installation instructions`,url:dryProduct!.guide},{title:`${dryProduct!.name} current instructions / detail library`,url:dryProduct!.sheet});
  const familyNotes:Record<InstallationFamily,string[]>={
    wood:['Confirm species, grade, moisture condition and treatment. Use compatible corrosion-resistant fasteners and the supplier treatment/end-cut instructions.'],
    'tt-composite':['Composite guide p. 3 gives temperature-based butt gaps: 3/16 in at 32 F or below; 1/8 in at 33-74 F; 1/32 in at 75 F or above. Side gaps: 1/8-3/16 in. The breaker assembly uses the end-gap table when temperature is supplied, retaining the larger adjacent gap at fractional band transitions. Other board joints and side gaps are not updated. Confirm exact product applicability.','Stair requirements are collection/profile-specific. The current guide p. 8 differs from some legacy stair assumptions in this model: revalidate the complete tread assembly before use.'],
    'tt-pvc':['Advanced PVC guide p. 5 calls for tight PVC-to-PVC butt/miter/divider joints regardless of temperature; joints to solid obstructions still need clearance. Keep boards cool during fastening. Do not substitute Composite gap rules.','Standard, MAX and porch profiles are not interchangeable. Standard field boards and stair boards have separate support and fastening requirements; confirm the actual SKU.'],
    surestone:['Surestone is a separate mineral-based product system. Use its own support, fastening, gapping and stair requirements, not the Vista/Venture wood-plastic instructions.'],
    'deckorators-wpc':['Select the guide for Vista, Venture or Altitude specifically; do not substitute Surestone requirements.'],
    unknown:['No manufacturer installation instruction has been established for this selection.'],
  };
  const steps:InstallationStep[]=[
    {title:'1. Release the design',instruction:'Resolve the review items below, verify site dimensions and obtain required design/permit approvals before construction.'},
    {title:'2. Confirm supplied materials',instruction:'Match delivered board SKU, profile, thickness, framing members and fasteners to the approved schedule. Check guide revision and regional applicability.'},
    {title:'3. Set out and inspect framing',instruction:'Follow the verified framing layout and connection schedule. Confirm bearing, level/flatness, spacing and blocking before covering framing.'},
    {title:'4. Coordinate water and corrosion protection',instruction:'Detail ledger flashing, drainage and ventilation. Verify tape, coatings, cut-end treatment and dissimilar-material isolation for the selected framing.'},
    {title:'5. Lay out boards and joints',instruction:'Set out the field, borders, breaker boards and butt joints. Record actual installation temperature; use the applicable guide for each gap and board-end support.'},
    {title:'6. Fasten the selected assembly',instruction:'Use the approved board/substrate fastener and specified edge distances, predrilling, embedment and tightening method. Resolve fascia separately.'},
    {title:'7. Complete stairs and guards',instruction:'Use the validated tread/riser and guard details. Recheck finished rise/run, clear widths, gaps, rail heights and attachments.'},
    {title:'8. Inspect and hand over',instruction:'Inspect fasteners, gaps, drainage and interfaces. Record products and installed conditions; provide current care and warranty documents.'},
  ];
  return {status:'review-required' as const,permitReady:false as const,constructionReady:false as const,product:product?.name??data.deckingMaterial,family,selection,timberModel,issues,sources,familyNotes:familyNotes[family],steps,sourceCheckedOn:'2026-09-21',
    geometryNote:'General installation inputs do not yet change board side gaps/thickness or non-timber framing. The breaker layout separately drives timber support geometry and stock quantities, using a product-specific divider-joint gap where established. The viewer remains a conceptual timber model; do not measure installation details from it.'};
}

const escapeHtml=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
/** No scripts or external assets: safe to open locally and print/save as PDF. */
export function exportInstallationHTML(data:DeckData,model?:DeckTakeoff):string {
  const plan=buildInstallationPlan(data), e=escapeHtml;
  const breakers=model?.levels.flatMap(l=>l.breakerAssemblies??[])??[];
  const breakerSection=model?`<h2>Modeled breaker assemblies</h2><p>${model.stockLength/12} ft planning stock. ${breakers.length} divider lines; ${model.levels.flatMap(l=>l.joists).filter(j=>j.role==='breaker-field-support').length} field-end support joist pieces; ${model.levels.flatMap(l=>l.blocking).filter(j=>j.role==='breaker-ladder').length} ladder blocks. Same parts feed 3D, plan and takeoff. Connections remain unverified.</p><ul>${breakers.map(a=>`<li>${e(a.id)}: x ${a.x.toFixed(2)} in, field/divider gap ${a.jointGapIn.toFixed(3)} in, ${e(a.reason)}.</li>`).join('')}</ul>`:'';
  const entries=Object.entries(plan.selection).map(([k,v])=>`<tr><th>${e(k)}</th><td>${e(v)}</td></tr>`).join('');
  const skirtSelection=validateSkirting(data.skirting),drySelection=validateDrySpace(data.drySpace),colours=validateBoardFinishes(data.boardFinishes);
  const skirt=model&&skirtSelection?.enabled?buildSkirting(data,model):undefined,dry=model&&drySelection?.enabled?buildDrySpace(data,model):undefined,finishStatus=model&&colours.length?boardFinishStatus(data,model):undefined;
  const rows=(items:{name:string;qty:number;unit:string;spec:string}[])=>`<table><thead><tr><th>Component</th><th>Quantity</th><th>Basis / unresolved detail</th><th>Price status</th></tr></thead><tbody>${items.map(r=>`<tr><td>${e(r.name)}</td><td>${e(r.qty)} ${e(r.unit)}</td><td>${e(r.spec)}</td><td>QUOTE REQUIRED</td></tr>`).join('')}</tbody></table>`;
  const warnings=(items:string[])=>`<ul>${items.map(s=>`<li>${e(s)}</li>`).join('')}</ul>`;
  const noModel='<p class="notice">No shared construction model was supplied to this export. Installed counts, geometry conflicts and coverage have NOT been evaluated. Regenerate from the current design before ordering or installing.</p>';
  const skirtingSection=skirtSelection?.enabled?`<section data-package-section="skirting"><h2>Deck skirting and support framing — quote required</h2><p>${e(skirtSelection.orientation)} boards; preview colour ${e(skirtSelection.color)}; proposed board gap ${e(skirtSelection.gapIn)} in; grade clearance ${e(skirtSelection.groundClearanceIn)} in; backing spacing ${e(skirtSelection.frameSpacingIn)} in.</p><p>${e(SKIRTING_REVIEW)}</p>${skirt?`<p>${skirt.boards.length} board cut pieces and ${skirt.framing.length} backing members modeled. ${skirt.staleExclusions.length} saved edge exclusions require reassignment.</p>${rows(skirt.rows)}${warnings(skirt.issues)}`:noModel}<h3>Before releasing skirting installation</h3><ol><li>Measure final grade and select ventilation, removable access and water-discharge openings. This export assumes flat grade; keep structural and drainage inspections accessible.</li><li>Obtain the exact manufacturer's written approval and installation detail for the proposed board/profile as skirting or cladding. Confirm orientation, expansion gaps, finish, end support and fasteners.</li><li>Review backing attachments and corner/joint support. The preview is non-load-bearing and does not specify engineered anchorage or substitute for primary deck framing.</li><li>Match every colour preview to an available SKU or approved coating system, then obtain the supplier and installation quote.</li></ol></section>`:'';
  const dryProduct=DRY_SPACE_PRODUCTS.find(p=>p.id===drySelection?.system);
  const drainageSection=drySelection?.enabled?`<section data-package-section="dry-space"><h2>${e(dryProduct!.name)} — under-deck rain management, quote required</h2><p>${e(dryProduct!.position)}; ${e(drySelection.finish)} preview; ${e(drySelection.outletSide)} outlet end per collection zone. Not an enclosed waterproof room, roof certification or permit approval.</p>${dry?`<p>${dry.modeledBays} modeled bays; ${dry.blockedBays} unresolved bays; ${dry.outletCount} collection outlets. Model run ${dry.runIn.toFixed(2)} in; system fall ${dry.fallIn.toFixed(2)} in; uncovered depth beyond termination ${dry.uncoveredDepthIn.toFixed(2)} in. ${dry.modeled?'Only the schematic quantities below have geometry.':'SELECTED SYSTEM NOT MODELED — do not order installed quantities from this export.'}</p>${dry.rows.length?rows(dry.rows):'<p>No installed component quantities are claimed. The system and installation scope remain quote-required.</p>'}${warnings(dry.issues)}<h3>Manufacturer-specific installation hold points</h3><ol>${dry.installationSteps.map(s=>`<li>${e(s)}</li>`).join('')}</ol>`:noModel}<p><a href="${e(dryProduct!.guide)}">Manufacturer installation guide</a> · <a href="${e(dryProduct!.sheet)}">Current instructions / detail library</a> · <a href="${e(dryProduct!.supplier)}">Ontario supplier listing — confirm availability</a></p></section>`:'';
  const boardSection=colours.length?`<section data-package-section="board-colours"><h2>Individual board colour schedule — product matching required</h2><p>Colours below are RGB previews, not orderable product selections, material approvals or permission to paint composite/PVC decking. Base board quantities and priced subtotal are unchanged; actual product matching and any revised costs remain quote-required.</p>${finishStatus?`<p>${finishStatus.matched.length} matching installed pieces; ${finishStatus.unmatched.length} unmatched saved selections. Unmatched identifiers must be reselected, not silently moved onto another board.</p>`:noModel}<table><thead><tr><th>Board identifier</th><th>Hex colour</th><th>Model status</th></tr></thead><tbody>${colours.map(c=>`<tr><td>${e(c.id)}</td><td>${e(c.color)}</td><td>${finishStatus?(finishStatus.matched.some(m=>m.id===c.id)?'Matched — product quote required':'UNMATCHED — review layout'):'Not evaluated — shared model missing'}</td></tr>`).join('')}</tbody></table></section>`:'';
  const finishingSections=skirtingSection+drainageSection+boardSection;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>DeckCraft installation planning package</title><style>body{font:15px/1.5 Arial,sans-serif;max-width:900px;margin:40px auto;color:#17251e;padding:0 20px}h1{font-size:28px}h2{margin-top:30px}.notice{border:2px solid #8a5200;padding:14px;background:#fff8e8}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:7px;text-align:left;overflow-wrap:anywhere}th{width:35%}li{margin:9px 0}a{overflow-wrap:anywhere}footer{border-top:1px solid #888;margin-top:32px;font-size:12px}@media print{body{margin:0;max-width:none;color:black}h2,h3{break-after:avoid}li,tr{break-inside:avoid}a{color:black}.notice{background:none}@page{margin:18mm}}</style><body><header><p>GOLDEN MAPLE / DECKCRAFT PRO</p><h1>Installation planning package</h1><p>${e(data.projectAddress||'Site not supplied')}<br>${e(plan.product)} | ${e(data.width)} x ${e(data.length)} ft</p></header><section class="notice"><strong>REVIEW REQUIRED - NOT FOR CONSTRUCTION OR PERMIT SUBMISSION</strong><p>This is a project-specific planning checklist, not a complete installation manual or engineering approval.</p><p>${e(plan.geometryNote)}</p></section><h2>Selected system and proposed inputs</h2><p>Gap, thickness and ventilation inputs are mm; temperature is degrees C. Values are unverified user selections.</p><table>${entries}<tr><th>Pattern / fastener method</th><td>${e(data.pattern)} / ${e(data.fasteningSystem)}</td></tr><tr><th>Requested joist spacing</th><td>${e(data.joistSpacing)} in (verify actual model and product requirement)</td></tr></table>${breakerSection}${finishingSections}<h2>Product-specific instruction basis</h2><ul>${plan.familyNotes.map(n=>`<li>${e(n)}</li>`).join('')}</ul><h2>Hold points / compatibility checks</h2><ul>${plan.issues.map(i=>`<li><strong>${e(i.severity.toUpperCase())}:</strong> ${e(i.message)}</li>`).join('')}</ul><h2>Installation sequence and inspection checkpoints</h2>${plan.steps.map(s=>`<section><h3>${e(s.title)}</h3><p>${e(s.instruction)}</p></section>`).join('')}<h2>Manufacturer references</h2><p>Reference lookup: ${e(plan.sourceCheckedOn)}. Reconfirm the latest edition and the exact product/region before installation. A link is not a compatibility certification.</p><ul>${plan.sources.map(s=>`<li>${e(s.title)}<br><a href="${e(s.url)}">${e(s.url)}</a></li>`).join('')||'<li>Obtain the supplier documentation for the exact wood product.</li>'}</ul><footer>Not sealed or certified. Unresolved selections remain unresolved in every export. Print at actual size or use your browser Save as PDF.</footer></body></html>`;
}
