import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {DeckData,YardFeature,PatioInlay} from '../src/features/deckcraft/types';
import {HARDSCAPE_PRODUCTS,hardscapeBody,rectangularUnit,hardscapeSelection} from '../src/features/deckcraft/hardscapeCatalogue';
import {hardscapeBlanks} from '../src/features/deckcraft/hardscapeLayout';
import {buildYardModel,yardArea,yardClip,projectedYardPavers,YARD_PAVER_BUDGET} from '../src/features/deckcraft/yardModel';
import {buildYardTakeoff} from '../src/features/deckcraft/yardTakeoff';
import {patioInlayProblem,patioInlayPlans,patioInlayOutline,normalizePavingAngle} from '../src/features/deckcraft/patioInlays';
import {yardFeatureOutline} from '../src/features/deckcraft/yardPathGeometry';
import {yardShapePull} from '../src/features/deckcraft/yardShapeEditing';
import {parseDesign,serializeDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {encodeDesignLink,decodeDesignLink,designLinkFromHash} from '../src/features/deckcraft/designLink';
import {createDeckAgentController,type DeckAgentHostState,type AgentCommand} from '../src/features/deckcraft/designer/deckAgentController';
import {emptyHistory,recordChange,undoChange,redoChange} from '../src/features/deckcraft/designer/designHistory';

let checks=0;const failures:string[]=[];
function check(v:unknown,label:string){checks++;assert.ok(v,label);}
function close(a:number,b:number,label:string,tolerance=1e-5){check(Math.abs(a-b)<=tolerance,`${label}: ${a} versus ${b}`);}
// Clipper rounds each vertex to 1e-5 inch. Aggregate union area has a separate
// rounding pass, so a patio-sized comparison allows < 0.015 square inch drift.
const areaClose=(a:number,b:number,label:string)=>close(a,b,label,.0001);
async function scenario(name:string,run:()=>unknown){try{await run();console.log(`PASS ${name}`);}catch(e){failures.push(`${name}: ${(e as Error).message}`);console.error(`FAIL ${name}: ${(e as Error).message}`);}}
function stock(thickness=60,exclude=''){
 for(const product of HARDSCAPE_PRODUCTS.filter(p=>p.category!=='wall'&&p.id!==exclude))for(const finish of product.finishes)for(const unit of finish.units){
  const color=finish.colors.find(c=>!unit.colorIds||unit.colorIds.includes(c.id));
  if(hardscapeBody(unit.role)&&rectangularUnit(unit)&&unit.heightMm===thickness&&color&&unit.widthMm>=150&&unit.lengthMm>=150)return {productId:product.id,color:color.hex??'#554433',hardscape:{finishId:finish.id,colorId:color.id,unitId:unit.id,patternId:'stack-bond',angleDeg:0,jointMm:3}};
 }
 throw Error(`No fixture stock at ${thickness} mm`);
}
const field=stock(),contrast=stock(60,field.productId);
const base:YardFeature={id:'qa_patio',kind:'patio',name:'QA patio',enabled:true,xFt:60,zFt:60,widthFt:12,depthFt:12,heightIn:0,rotationDeg:31,...field};
const inlay=(patch:Partial<PatioInlay>={}):PatioInlay=>({id:'qa_inlay',name:'QA cut-paver inlay',shape:'rectangle',xIn:3,yIn:-4,widthIn:42,depthIn:36,rotationDeg:23,...contrast,...patch});
const data=(f:YardFeature):DeckData=>({...structuredClone(DEFAULT_DECK),houseVisible:false,yardFeatures:[f]});
const polygons=(model:ReturnType<typeof buildYardModel>)=>model.boxes.filter(b=>b.role==='paver').map(b=>b.polygon!);
function fixture(initial:DeckData){
 let state:DeckAgentHostState={data:initial,view:'plan',openSections:[],canUndo:false,canRedo:false,ready:true},history=emptyHistory<DeckData>(),commits=0;
 const api=createDeckAgentController({getState:()=>state,commitDesign:next=>{history=recordChange(history,state.data,`qa-${++commits}`,commits*1000);state={...state,data:next,canUndo:true,canRedo:false};},undo:()=>{const u=undoChange(history,state.data);assert.ok(u);history=u.history;state={...state,data:u.design,canUndo:history.past.length>0,canRedo:true};},redo:()=>{const r=redoChange(history,state.data);assert.ok(r);history=r.history;state={...state,data:r.design,canUndo:true,canRedo:history.future.length>0};},setView:view=>{state={...state,view};},openSection:section=>{state={...state,openSections:[...state.openSections,section]};},waitForRender:predicate=>predicate(state)?Promise.resolve():Promise.reject(Error('Host render not acknowledged')),shareOrigin:'http://localhost:4319'});
 return {api,get state(){return state;},get commits(){return commits;},get history(){return history;}};
}
let requestId=0;const request=(commands:AgentCommand[])=>({id:`patio-qa-${++requestId}`,commands});

async function main(){
 await scenario('Oblique repeat tiles non-two-to-one stock through concave edges, rotations and inlays',async()=>{
  // Synthetic engineering fixture, not a supplier recipe: the 98x198 ratio is
  // deliberately not 2:1. An invented joint or a stretched brick cannot pass.
  const product={id:'qa-oblique-stock',name:'Synthetic oblique stock',brand:'QA',category:'paver',sourceUrl:'https://example.invalid/qa',finishes:[{id:'qa-finish',colors:[{id:'qa-color',hex:'#987654'}],units:[{id:'qa-98-198',widthMm:98,lengthMm:198,heightMm:60,role:'standard'}],patterns:[{id:'qa-oblique',name:'Synthetic perpendicular repeat',sourceUrl:'https://example.invalid/qa',layout:{widthMm:296,depthMm:296,jointMm:0,repeatBasisMm:[[198,-198],[98,98]] as [[number,number],[number,number]],cells:[{unitId:'qa-98-198',xMm:0,yMm:0,rotationDeg:0},{unitId:'qa-98-198',xMm:0,yMm:98,rotationDeg:90}]}}]}]};
  HARDSCAPE_PRODUCTS.push(product);
  try{
   const h={finishId:'qa-finish',colorId:'qa-color',unitId:'qa-98-198',patternId:'qa-oblique',angleDeg:0,jointMm:0};
   const concave=[{x:-72,y:-72},{x:72,y:-72},{x:72,y:-12},{x:12,y:-12},{x:12,y:72},{x:-72,y:72}];
   for(const outline of [undefined,concave])for(const angleDeg of [0,1,37,89,127,225,359])for(const withInlay of [false,true]){
    const i=inlay({productId:product.id,hardscape:{...h,angleDeg:73},widthIn:24,depthIn:24,xIn:-30,yIn:10,rotationDeg:31});
    const f:YardFeature={...base,xFt:-60,zFt:-40,rotationDeg:47,productId:product.id,hardscape:{...h,angleDeg},outline,inlays:withInlay?[i]:undefined},m=buildYardModel(data(f)),fm=m.features[0],stones=m.boxes.filter(b=>b.role==='paver'),expected=yardArea(yardClip(yardFeatureOutline(f)));
    check(!fm.excluded,'Oblique repeat retains complete patio at every angle');
    areaClose(yardArea(polygons(m)),expected,'Nominal zero-joint oblique repeat leaves no holes');
    areaClose(yardArea(polygons(m)),yardArea(yardClip(polygons(m))),'Adjacent oblique cells never overlap');
    close(yardArea(yardClip(polygons(m),yardFeatureOutline(f),'difference')),0,'Concave and negative-coordinate clipping stays inside footprint');
    for(const b of hardscapeBlanks(f)){close(b.length,198/25.4,'Oblique stock has unmodified 198mm length');close(b.width,98/25.4,'Oblique stock has unmodified 98mm width');}
    close(fm.quantities.paverPieces,new Set(stones.map(b=>b.unitId)).size,'Oblique fragments count each original stock once');
    close(fm.stockSchedule!.reduce((n,u)=>n+u.pieces,0),fm.quantities.paverPieces,'Oblique stock schedule reconciles');
    if(withInlay){check(patioInlayPlans(f,fm.footprints)[0].status==='ok','Rotated oblique inlay remains inside concave patio');close(fm.pavingZones!.reduce((n,z)=>n+z.areaSqft,0),expected,'Inlay and field partition whole area');}
   }
   const persisted={...base,productId:product.id,hardscape:{...h,angleDeg:359},inlays:[inlay({productId:product.id,hardscape:{...h,angleDeg:127}})]};
   assert.deepEqual(parseDesign(serializeDesign(data(persisted))).yardFeatures,[persisted]);checks++;
   const link=await encodeDesignLink(data(persisted),'http://localhost:4319');assert.deepEqual((await decodeDesignLink(designLinkFromHash(new URL(link).hash)!)).yardFeatures,[persisted]);checks++;
   const large={...base,widthFt:60,depthFt:60,productId:product.id,hardscape:{...h,angleDeg:45}};
   check(hardscapeBlanks(large,20001).length===20001,'Oblique enumeration stops at shared preflight sentinel');
   check(projectedYardPavers(large)>YARD_PAVER_BUDGET,'Oblique stock reserves full budget before rendering');
   const over=buildYardModel(data(large));check(over.features[0].excluded&&over.quantities.paverPieces===0,'Over-budget oblique repeat has no partial installed quantity');
  }finally{HARDSCAPE_PRODUCTS.splice(HARDSCAPE_PRODUCTS.indexOf(product),1);}
 });
 await scenario('Arbitrary source-cell angles tile full physical stock through concave boundaries and inlays',async()=>{
  // Independent rotated rectangular lattice, not a manufacturer recipe. A
  // quarter-turn-only envelope or a snapped cell angle leaves holes here.
  const angles=[30,60,120,225,359.999],L=300,W=150;
  const patterns=angles.map((deg,i)=>{const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return {id:`qa-angular-${i}`,name:'Synthetic angular full-body repeat',sourceUrl:'https://example.invalid/qa',layout:{widthMm:Math.abs(c)*L+Math.abs(s)*W,depthMm:Math.abs(s)*L+Math.abs(c)*W,jointMm:0,angleDeg:17,repeatBasisMm:[[c*L,s*L],[-s*W,c*W]] as [[number,number],[number,number]],cells:[{unitId:'qa-150-300',xMm:0,yMm:0,rotationDeg:deg}]}};});
  const product={id:'qa-angular-stock',name:'Synthetic angular stock',brand:'QA',category:'paver',sourceUrl:'https://example.invalid/qa',finishes:[{id:'qa-finish',colors:[{id:'qa-color'}],units:[{id:'qa-150-300',widthMm:W,lengthMm:L,heightMm:60,role:'standard'}],patterns}]};
  HARDSCAPE_PRODUCTS.push(product);
  try{
   const concave=[{x:-72,y:-72},{x:72,y:-72},{x:72,y:-12},{x:12,y:-12},{x:12,y:72},{x:-72,y:72}];
   for(const [index,cellAngle] of angles.entries())for(const angleDeg of [0,37,359])for(const outline of [undefined,concave]){
    const h={finishId:'qa-finish',colorId:'qa-color',unitId:'qa-150-300',patternId:patterns[index].id,angleDeg,jointMm:0};
    const f:YardFeature={...base,xFt:-60,zFt:-40,rotationDeg:47,productId:product.id,hardscape:h,outline,inlays:[inlay({productId:product.id,hardscape:{...h,angleDeg:127},widthIn:24,depthIn:24,xIn:-30,yIn:10,rotationDeg:31})]},m=buildYardModel(data(f)),fm=m.features[0],expected=yardArea(yardClip(yardFeatureOutline(f))),stones=m.boxes.filter(b=>b.role==='paver');
    check(!fm.excluded,'Arbitrary source-cell angle is constructible');areaClose(yardArea(polygons(m)),expected,'Angular full bodies leave no patio holes');areaClose(yardArea(polygons(m)),yardArea(yardClip(polygons(m))),'Angular full bodies have no overlaps');
    close(yardArea(yardClip(polygons(m),yardFeatureOutline(f),'difference')),0,'Angular bounds clip correctly at concave negative-coordinate edges');
    for(const b of hardscapeBlanks(f)){close(b.length,L/25.4,'Angular stock keeps300mm body');close(b.width,W/25.4,'Angular stock keeps150mm body');close(Math.sin(b.angle-(cellAngle+angleDeg+17)*Math.PI/180),0,'Source-cell, intrinsic and user rotations combine without snapping');}
    close(fm.quantities.paverPieces,new Set(stones.map(b=>b.unitId)).size,'Angular cut fragments count stock once');close(fm.stockSchedule!.reduce((n,u)=>n+u.pieces,0),fm.quantities.paverPieces,'Angular stock schedule reconciles');
   }
   const f={...base,productId:product.id,hardscape:{finishId:'qa-finish',colorId:'qa-color',unitId:'qa-150-300',patternId:patterns[2].id,angleDeg:359,jointMm:0},inlays:[inlay({productId:product.id,hardscape:{finishId:'qa-finish',colorId:'qa-color',unitId:'qa-150-300',patternId:patterns[1].id,angleDeg:73,jointMm:0}})]};
   assert.deepEqual(parseDesign(serializeDesign(data(f))).yardFeatures,[f]);checks++;
   const link=await encodeDesignLink(data(f),'http://localhost:4319');assert.deepEqual((await decodeDesignLink(designLinkFromHash(new URL(link).hash)!)).yardFeatures,[f]);checks++;
   const large={...f,widthFt:100,depthFt:100,inlays:undefined};check(hardscapeBlanks(large,20001).length===20001,'Angular lattice stops at shared budget sentinel');check(buildYardModel(data(large)).features[0].excluded,'Over-budget angular pattern is excluded completely');
  }finally{HARDSCAPE_PRODUCTS.splice(HARDSCAPE_PRODUCTS.indexOf(product),1);}
 });
 await scenario('Positive-joint herringbone preserves full bodies and complete uniform joint topology',()=>{
  const product={id:'qa-jointed-stock',name:'Synthetic jointed stock',brand:'QA',category:'paver',sourceUrl:'https://example.invalid/qa',finishes:[{id:'qa-finish',colors:[{id:'qa-color'}],units:[{id:'qa-150-300',widthMm:150,lengthMm:300,heightMm:100,role:'standard'}],patterns:[{id:'qa-jointed',name:'Synthetic 12mm joint repeat',sourceUrl:'https://example.invalid/qa',layout:{widthMm:312,depthMm:474,jointMm:12,repeatBasisMm:[[312,-312],[162,162]] as [[number,number],[number,number]],cells:[{unitId:'qa-150-300',xMm:0,yMm:0,rotationDeg:0},{unitId:'qa-150-300',xMm:0,yMm:162,rotationDeg:90}]}}]}]};
  HARDSCAPE_PRODUCTS.push(product);
  try{
   const target=[{x:-72,y:-72},{x:72,y:-72},{x:72,y:72},{x:-72,y:72}];
   for(const angleDeg of [0,1,37,45,89,127,225,359]){
    const f={...base,xFt:0,zFt:0,widthFt:14,depthFt:14,rotationDeg:0,productId:product.id,hardscape:{finishId:'qa-finish',colorId:'qa-color',unitId:'qa-150-300',patternId:'qa-jointed',angleDeg,jointMm:12}},blanks=hardscapeBlanks(f);
    const rectangle=(b:typeof blanks[number],paddingMm:number)=>{const l=(b.length+paddingMm/25.4)/2,w=(b.width+paddingMm/25.4)/2,c=Math.cos(b.angle),s=Math.sin(b.angle);return [[-l,-w],[l,-w],[l,w],[-l,w]].map(([x,y])=>({x:b.cx+c*x-s*y,y:b.cy+s*x+c*y}));};
    const bodies=yardClip(blanks.map(b=>rectangle(b,0)),[target],'intersection'),modules=yardClip(blanks.map(b=>rectangle(b,12)),[target],'intersection');
    areaClose(yardArea(modules),144,'Six-mm expansion on each body side closes the entire joint module');
    const bodySum=blanks.reduce((n,b)=>n+yardArea(yardClip([rectangle(b,0)],[target],'intersection')),0);
    areaClose(bodySum,yardArea(bodies),'Full physical bodies do not overlap at any laying angle');
    // Use unclipped cells for overlap checking: union clipping alone could hide
    // duplicate module coverage. Restrict to the test window afterwards.
    const rawModules=blanks.map(b=>rectangle(b,12)),sum=rawModules.reduce((n,p)=>n+yardArea(yardClip([p],[target],'intersection')),0);
    areaClose(sum,yardArea(modules),'Expanded modules tile exactly once, with no widened or missing joint region');
    for(const b of blanks){close(b.length,300/25.4,'Joint recipe does not shorten full 300mm stock');close(b.width,150/25.4,'Joint recipe does not shorten full 150mm stock');}
    const m=buildYardModel(data(f));check(!m.features[0].excluded,'Jointed source repeat constructs');close(m.features[0].stockSchedule!.reduce((n,u)=>n+u.pieces,0),m.quantities.paverPieces,'Jointed source stock schedule reconciles');
   }
  }finally{HARDSCAPE_PRODUCTS.splice(HARDSCAPE_PRODUCTS.indexOf(product),1);}
 });
 await scenario('Full circle laying angles preserve patio footprint and physical stock',()=>{
  const expected=yardFeatureOutline(base);
  for(const angleDeg of [0,1,37,89,90,137,180,225,270,315,359,359.9999,normalizePavingAngle(360)]){
   const f={...base,hardscape:{...base.hardscape!,angleDeg}},m=buildYardModel(data(f));
   assert.deepEqual(m.features[0].footprints,yardClip(expected));checks++;
   check(m.boxes.some(b=>b.role==='paver'),'Every angle constructs paving');
   const s=hardscapeSelection(f)!,blanks=hardscapeBlanks(f);
   for(const b of blanks){close(b.length,s.unit.lengthMm/25.4,'Full stock length unchanged');close(b.width,s.unit.widthMm/25.4,'Full stock width unchanged');}
   areaClose(yardArea(polygons(m)),yardArea(yardClip(polygons(m))),'Stock has no overlapping area');
   close(yardArea(yardClip(polygons(m),expected,'difference')),0,'No pavers extend beyond patio');
  }
 });
 await scenario('Aberdeen source sizes and all five original recipes survive arbitrary laying rotation',()=>{
  const product=HARDSCAPE_PRODUCTS.find(p=>p.id==='techo-aberdeen-slab')!,finish=product.finishes[0];
  const expected=[[254,508,57],[508,508,57],[508,762,57],[762,762,57]],sizes=finish.units.map(u=>[u.widthMm,u.lengthMm,u.heightMm]);
  for(const size of expected)check(sizes.some(s=>s.every((n,i)=>n===size[i])),'Four active Aberdeen stock sizes remain unchanged');
  // The official legacy sheet also documents discontinued 30x10 stock. It may
  // be retained for remaining-stock work, but it must not enter current recipes.
  check(sizes.every(s=>[...expected,[254,762,57]].some(e=>e.every((n,i)=>n===s[i]))),'All selectable Aberdeen units have documented current or legacy dimensions');
  check(finish.patterns.length===5,'All five manufacturer Aberdeen recipes are selectable');
  check(finish.patterns.flatMap(p=>p.layout.cells).every(c=>{const u=finish.units.find(u=>u.id===c.unitId)!;return expected.some(e=>e[0]===u.widthMm&&e[1]===u.lengthMm&&e[2]===u.heightMm);}), 'Current Aberdeen recipes exclude discontinued 30x10 stock');
  for(const recipe of finish.patterns)for(const angleDeg of [0,37,127,359]){
   const first=recipe.layout.cells[0],f={...base,widthFt:9,depthFt:8,productId:product.id,hardscape:{finishId:finish.id,colorId:finish.colors[0].id,unitId:first.unitId,patternId:recipe.id,angleDeg,jointMm:recipe.layout.jointMm??0}},m=buildYardModel(data(f)),blanks=hardscapeBlanks(f);
   check(!m.features[0].excluded,`${recipe.name} is constructible at ${angleDeg} degrees`);
   for(const b of blanks){const u=finish.units.find(u=>u.id===b.unitId)!;check(!!u,'Every recipe blank binds actual catalogue stock');close(b.length,u.lengthMm/25.4,'Aberdeen nominal length not reduced for joints');close(b.width,u.widthMm/25.4,'Aberdeen nominal width not reduced for joints');}
   areaClose(yardArea(polygons(m)),72,'Joint-free original repeat fills nominal patio exactly');
   areaClose(yardArea(polygons(m)),yardArea(yardClip(polygons(m))),'Original recipe stones do not overlap');
   const angle=(angleDeg+(recipe.layout.angleDeg??0))*Math.PI/180;check(blanks.some(b=>Math.abs(Math.sin(b.angle-angle))<1e-8),'Intrinsic manufacturer direction combines with user laying rotation');
   assert.deepEqual(parseDesign(serializeDesign(data(f))).yardFeatures,[f]);checks++;
  }
 });
 await scenario('Inspected manufacturer diagrams retain their original intrinsic direction',()=>{
  // Independent visual checks: Techo hatch atlas PDF6 (Everest03), PDF9
  // (Para09), and Permacon Ontario product guide PDF17/PDF19 (18x36 slabs).
  const cases=[
   ['techo-everest-slab','linear-pattern-03-100-250x500',0],
   ['techo-para-slab','l77-herringbone-laying-pattern-09-100-500x750',45],
   ['permacon-melia-18-36-durafusion-slab','manufacturer-herringbone',45],
   ['permacon-melville-18-36-durafusion-slab','manufacturer-herringbone',45],
  ] as const;
  for(const [productId,patternId,angle]of cases){
   const product=HARDSCAPE_PRODUCTS.find(p=>p.id===productId)!,finish=product.finishes.find(f=>f.patterns.some(p=>p.id===patternId))!,recipe=finish.patterns.find(p=>p.id===patternId)!;
   check(!!recipe,`${productId}: inspected pattern is available`);close(recipe.layout.angleDeg??0,angle,'Intrinsic direction agrees with actual supplier drawing');
   if(productId==='techo-everest-slab'){close(recipe.layout.widthMm,500,'Everest03 horizontal repeat width');close(recipe.layout.depthMm,250,'Everest03 horizontal course depth');check(recipe.layout.cells.every(c=>c.rotationDeg===0),'Everest03 is horizontal stock rather than a vertically rotated stand-in');}
  }
 });
 await scenario('Every inlay outline physically removes field paving and counts cut stock once',()=>{
  for(const shape of ['rectangle','diamond','circle','compass','band','custom'] as const){
   const i=inlay({shape,...(shape==='band'?{widthIn:110,depthIn:10}:{}),...(shape==='custom'?{widthIn:42,depthIn:36,points:[{x:-21,y:-18},{x:21,y:-18},{x:21,y:0},{x:0,y:0},{x:0,y:18},{x:-21,y:18}]}:{})}),f={...base,inlays:[i]},m=buildYardModel(data(f)),fm=m.features[0],p=patioInlayPlans(f)[0];
   check(p.status==='ok',`${shape} is constructible`);check(!fm.excluded,'Patio remains present');
   const stones=m.boxes.filter(b=>b.role==='paver'),inside=stones.filter(b=>b.unitId!.startsWith(`${f.id}-inlay-`)),outside=stones.filter(b=>!b.unitId!.startsWith(`${f.id}-inlay-`));
   check(inside.length>0&&outside.length>0,'Both material zones build');
   close(yardArea(yardClip(outside.map(b=>b.polygon!),[p.outline],'intersection')),0,'Field cuts clear inlay');
   close(yardArea(yardClip(inside.map(b=>b.polygon!),[p.outline],'difference')),0,'Inlay cuts stay inside shape');
   areaClose(yardArea(polygons(m)),yardArea(yardClip(polygons(m))),`${shape} physical fragments never overlap`);
   const stockCount=new Set(stones.map(b=>b.unitId)).size;
   close(fm.quantities.paverPieces,stockCount,'Fragment quantity identifies original stock');
   close(fm.stockSchedule!.reduce((n,u)=>n+u.pieces,0),stockCount,'Stock schedule matches units once');
   close(fm.pavingZones!.reduce((n,z)=>n+z.areaSqft,0),144,'Material zones partition whole patio area');
   const quoted=buildYardTakeoff(data(f),m);close(quoted.materials.reduce((n,u)=>n+u.installedAreaSqft,0),144,'Product supply area does not double count');
   check(quoted.materials.some(u=>u.productId===i.productId),'Contrasting stock listed separately');
   check(quoted.sections.some(s=>s.id.startsWith('patio-inlay-')&&s.amountCents===null),'Cutting installation has explicit quote scope');
   check(inside.every(b=>b.color===i.color),'Inlay colour survives geometry');
   close(yardArea(m.boxes.filter(b=>b.role==='base').map(b=>b.polygon!)),144,'Shared base exists once');
   assert.deepEqual(parseDesign(serializeDesign(data(f))).yardFeatures,[f]);checks++;
  }
 });
 await scenario('Outside, overlapping and incompatible thickness are retained but excluded',()=>{
  const valid=inlay({id:'valid',widthIn:36,depthIn:36,xIn:-20,yIn:0}),outside=inlay({id:'outside',xIn:200}),overlap=inlay({id:'overlap',xIn:-20,yIn:0}),wrong=inlay({id:'wrong',...stock(80),xIn:40,yIn:30,widthIn:18,depthIn:18}),f={...base,inlays:[valid,outside,overlap,wrong]},plans=patioInlayPlans(f),m=buildYardModel(data(f));
  assert.deepEqual(plans.map(p=>p.status),['ok','outside','overlap','invalid']);checks++;
  check(m.features[0].pavingZones!.length===2,'Only field and valid inlay supply are generated');
  check(m.features[0].warnings.filter(w=>w.includes('excluded')).length>=3,'Each omitted inlay is explained');
  assert.deepEqual(parseDesign(serializeDesign(data(f))).yardFeatures,[f]);checks++;
 });
 await scenario('Point and edge shape edits preserve inlays in world coordinates',()=>{
  const f={...base,inlays:[inlay()]},before=patioInlayPlans(f)[0].outline;
  for(const kind of ['point','edge'] as const){const edited=yardShapePull(f,kind,0,-18,-8),after=patioInlayPlans(edited)[0].outline;before.forEach((p,n)=>{close(p.x,after[n].x,'Inlay world x remains fixed');close(p.y,after[n].y,'Inlay world y remains fixed');});}
  const moved=yardShapePull(f,'area',0,19,-7),after=patioInlayPlans(moved)[0].outline;before.forEach((p,n)=>{close(p.x+19,after[n].x,'Whole patio translation carries inlay x');close(p.y-7,after[n].y,'Whole patio translation carries inlay y');});
 });
 await scenario('Plain-value import rejects getters, sparse arrays, duplicated IDs and over-cap lists',()=>{
  const i=inlay();let invoked=0;const getter=Object.defineProperty({...i},'xIn',{enumerable:true,get(){invoked++;return 0;}});
  check(!!patioInlayProblem(getter),'Top-level accessor refused');check(invoked===0,'No top-level getter invoked');
  const hardscape=Object.defineProperty({...i.hardscape},'unitId',{enumerable:true,get(){invoked++;return i.hardscape!.unitId;}});
  check(!!patioInlayProblem({...i,hardscape}),'Nested material accessor refused');check(invoked===0,'No nested getter invoked');
  const points=[{x:-21,y:-18},{x:21,y:-18},{x:21,y:18},{x:-21,y:18}];Object.defineProperty(points[0],'x',{enumerable:true,get(){invoked++;return -21;}});
  check(!!patioInlayProblem({...i,shape:'custom',points}),'Custom point accessor refused');check(invoked===0,'No point getter invoked');
  const sparse=new Array(2);sparse[1]=i;
  for(const entries of [[i,i],Array.from({length:13},(_,n)=>({...i,id:`many_${n}`})),sparse]){assert.throws(()=>validateDesign(data({...base,inlays:entries})));checks++;}
  assert.throws(()=>validateDesign(data({...base,inlays:[{...i,rotationDeg:360}]})));checks++;
  check(normalizePavingAngle(360)===0&&normalizePavingAngle(-1)===359,'Full-circle input has canonical persisted angle');
 });
 await scenario('Shared base allowance stays full-size when quoted stock replaces field area',()=>{
  const f={...base,productId:'permacon-melville',color:'#aaa69b',hardscape:undefined,rotationDeg:0},plain=buildYardTakeoff(data(f)),changed=buildYardTakeoff(data({...f,inlays:[inlay({widthIn:48,depthIn:48,rotationDeg:0,xIn:0,yIn:0})]}));
  close(changed.quantities.baseYd3,plain.quantities.baseYd3,'Geometric base unchanged');
  close(changed.quantities.aggregateTonnes,plain.quantities.aggregateTonnes,'Full-footprint aggregate allowance unchanged');
  close(changed.quantities.fabricRolls,plain.quantities.fabricRolls,'Full-footprint fabric allowance unchanged');
 });
 await scenario('Legacy patio cut stock renders as one stone rather than decomposition fragments',()=>{
  const f={...base,productId:'permacon-melville',color:'#aaa69b',hardscape:undefined,rotationDeg:0,inlays:[inlay({shape:'circle',widthIn:48,depthIn:48,rotationDeg:0,xIn:0,yIn:0})]},m=buildYardModel(data(f)),stones=m.boxes.filter(b=>b.role==='paver'),stockCount=new Set(stones.map(b=>b.unitId)).size;
  check(stones.length>stockCount,'Fixture contains an inlay that cuts stock into multiple physical fragments');
  check(stones.filter(b=>!b.renderDuplicate).length===stockCount,'3D and plan draw each original stone once with its complete cut contours');
 });
 await scenario('Different supplier zones produce unique quote-section identifiers',()=>{
  const q=buildYardTakeoff(data({...base,inlays:[inlay()]}));check(new Set(q.sections.map(s=>s.id)).size===q.sections.length,'No duplicate supply quote identifiers');
  check(q.materials.every(s=>s.amountCents===null),'Exact-SKU field and inlay do not inherit another supplier material price');
  check(q.quantities.aggregateTonnes===0,'Entirely unpriced stock assembly does not invent priced aggregate quantities');
 });
 await scenario('Preflight includes additional inlay stock before shared paver budget',()=>{
  const smallest=HARDSCAPE_PRODUCTS.filter(p=>p.category!=='wall').flatMap(p=>p.finishes.flatMap(f=>f.units.filter(u=>hardscapeBody(u.role)&&rectangularUnit(u)&&u.heightMm===60).map(u=>({p,f,u})))).sort((a,b)=>a.u.widthMm*a.u.lengthMm-b.u.widthMm*b.u.lengthMm)[0],color=smallest.f.colors.find(c=>!smallest.u.colorIds||smallest.u.colorIds.includes(c.id))!;
  const dense={...base,widthFt:60,depthFt:60,hardscape:{finishId:smallest.f.id,colorId:color.id,unitId:smallest.u.id,patternId:'stack-bond',angleDeg:37,jointMm:0},productId:smallest.p.id};
  const withInlays={...dense,inlays:Array.from({length:12},(_,n)=>inlay({id:`budget_${n}`,widthIn:100,depthIn:100,xIn:-250+(n%4)*150,yIn:-200+Math.floor(n/4)*150}))};
  check(projectedYardPavers(withInlays)>projectedYardPavers(dense),'Budget reserves inlay units in addition to field stock');
  if(projectedYardPavers(withInlays)>YARD_PAVER_BUDGET){const m=buildYardModel(data(withInlays));check(m.features[0].excluded,'Over-budget whole patio omitted');check(m.quantities.paverPieces===0,'No misleading partial quantity remains');}
 });
 await scenario('Agent preview, atomic history, full-circle rotation and share restoration',async()=>{
  const f=fixture(data(base)),commands:AgentCommand[]=[{type:'yard.inlay.place',id:base.id,inlay:inlay()},{type:'yard.inlay.move',id:base.id,inlayId:'qa_inlay',dxIn:7,dyIn:11},{type:'yard.inlay.rotate',id:base.id,inlayId:'qa_inlay',rotationDeg:360}],req=request(commands),preview=await f.api.preview(req);
  check(preview.ok,'Agent preview accepts patio commands');check(f.commits===0,'Preview has no persistence side effects');
  const applied=await f.api.execute(req);check(applied.ok,'Agent transaction succeeds');check(f.commits===1&&f.history.past.length===1,'Place, move and rotate are one undo step');
  const edited=f.state.data.yardFeatures![0].inlays![0];check(edited.xIn===10&&edited.yIn===7&&edited.rotationDeg===0,'Agent uses patio-local inch offsets and wraps full circle');
  if(preview.ok&&applied.ok){assert.deepEqual(applied.snapshot.patioInlays,preview.snapshot.patioInlays);checks++;check(applied.snapshot.patioInlays[0].coordinateSpace==='world-inches','Inventory identifies its coordinate space');}
  check((await f.api.execute(request([{type:'history.undo'}]))).ok&&!f.state.data.yardFeatures![0].inlays,'Single undo removes whole transaction');
  check((await f.api.execute(request([{type:'history.redo'}]))).ok,'Redo restores transaction');
  const link=await encodeDesignLink(f.state.data,'http://localhost:4319'),decoded=await decodeDesignLink(designLinkFromHash(new URL(link).hash)!);assert.deepEqual(decoded.yardFeatures,f.state.data.yardFeatures);checks++;
  const before=serializeDesign(f.state.data),commits=f.commits;
  check(!(await f.api.execute(request([{type:'yard.inlay.move',id:base.id,inlayId:edited.id,dxIn:10000,dyIn:0}]))).ok,'Out-of-range command refused');check(f.commits===commits&&serializeDesign(f.state.data)===before,'Failed command has no partial mutation');
  check((await f.api.execute(request([{type:'yard.inlay.remove',id:base.id,inlayId:edited.id}]))).ok,'Agent deletes selected inlay');check(f.state.data.yardFeatures![0].inlays?.length===0||!f.state.data.yardFeatures![0].inlays,'No orphaned selected inlay remains');f.api.dispose();
 });
 await scenario('Agent status agrees with installed mask after house clips patio',()=>{
  const f={...base,xFt:10,zFt:0,rotationDeg:0,inlays:[inlay({widthIn:24,depthIn:24,xIn:0,yIn:-40,rotationDeg:0})]},d={...data(f),houseVisible:true},m=buildYardModel(d),expected=patioInlayPlans(f,m.features[0].footprints)[0];
  check(expected.status==='outside','House intersection excludes this inlay from the available patio');
  const host=fixture(d),actual=host.api.read().patioInlays[0];check(actual.status===expected.status,'Agent inventory cannot report an excluded inlay as constructible');host.api.dispose();
 });
 console.log(`${checks} patio inlay assertions; ${failures.length} failing scenarios.`);
 if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
