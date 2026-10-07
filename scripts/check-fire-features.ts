// S2 fire features: validation and persistence, placement on a patio or on the feature's own gravel pad, the clearance
// and level notes, pricing at the cost estimator's fire pit allowance (no double count with yardAllowances.firePit, a
// further fire feature is a builder quote line, never $0; a gas feature's gas line is its own row at the estimator's
// gas-line figure; a linear table over 48 in carries a quoted size premium; an excluded fire feature leaves the
// allowance charged), and designs without fire features priced exactly as before.
import '../src/features/deckcraft/yardModelAdvancedRuntime';
import '../src/features/deckcraft/siteModelRuntime';
import '../src/features/deckcraft/siteSurfaceEngine';
import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {DeckData,YardAllowances,YardFeature} from '../src/features/deckcraft/types';
import type {SiteModel} from '../src/features/deckcraft/siteModel';
import {buildYardModel,needsAdvancedYard,type YardModel} from '../src/features/deckcraft/yardModel';
import {buildYardTakeoff,type YardTakeoff} from '../src/features/deckcraft/yardTakeoff';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {validateDesign,serializeDesign,parseDesign} from '../src/features/deckcraft/designPersistence';
import {hasAdvancedYard} from '../src/features/deckcraft/designExtensionPresence';
import {FIRE_PRODUCTS,newFireFeature,fireFeatureProblem} from '../src/features/deckcraft/fireFeatures';
import {FIRE_MIN_CLEARANCE_FT,stairFootprints} from '../src/features/deckcraft/fireFeatureModel';
import {FIRE_CLEARANCE} from '../src/features/deckcraft/designRules';
import {NO_ALLOWANCES,newYardFeature} from '../src/features/deckcraft/yardSettings';
import {describeBackyard,backyardElements} from '../src/features/deckcraft/backyard';
import {computeEstimate,FIREPIT_GAS_LINE_CAD,type EstimateInput} from '../src/utils/estimateEngine';
import {PAVER_BRANDS} from '../src/data/carrPrices';

let checks=0;
const check=(v:unknown,msg:string)=>{assert.ok(v,msg);checks++;};
const same=(a:unknown,b:unknown,msg:string)=>{assert.deepEqual(a,b,msg);checks++;};
const same0=(a:unknown,b:unknown)=>{try{assert.deepEqual(a,b);return true;}catch{return false;}};
const throws=(fn:()=>unknown,pattern:RegExp,msg:string)=>{assert.throws(fn,pattern,msg);checks++;};

// DEFAULT_DECK: a 16 x 12 ft deck from the house wall (z = 0) out to z = 144 in; the house lies behind it (z < 0).
const base:DeckData={...structuredClone(DEFAULT_DECK),yardFeatures:[]};
const fire=(id:string,patch:Partial<YardFeature>={}):YardFeature=>({...newFireFeature(base),id,name:id,productId:'fire-wood-ring',...patch});
const patio=(id:string,patch:Partial<YardFeature>={}):YardFeature=>({id,kind:'patio',name:id,enabled:true,xFt:8,zFt:26,widthFt:16,depthFt:12,heightIn:0,rotationDeg:0,productId:'permacon-mondrian-plus',color:'#aaa69b',finishedElevationIn:2,...patch});
const site=(h:(x:number,z:number)=>number):SiteModel=>({version:1,points:[[-240,-240],[600,-240],[600,600],[-240,600]].map(([xIn,zIn],i)=>({id:String(i),xIn,zIn,elevationIn:h(xIn,zIn)})),grading:[],transitions:[]} as unknown as SiteModel);
const design=(yardFeatures:YardFeature[],extra:Partial<DeckData>={}):DeckData=>({...base,yardFeatures,...extra});
const model=(d:DeckData)=>buildYardModel(d,buildDeckTakeoff(d));
const featureOf=(m:YardModel,id:string)=>m.features.find(f=>f.config.id===id)!;
const box=(m:YardModel,id:string,role:string)=>featureOf(m,id).boxes.find(b=>b.role===role);
const has=(m:YardModel,id:string,pattern:RegExp)=>featureOf(m,id).warnings.some(w=>pattern.test(w));
const row=(t:YardTakeoff,id:string)=>t.sections.find(s=>s.id===id);

// --- Products, validation and persistence ----------------------------------------------------------------------------
same(FIRE_PRODUCTS.map(p=>[p.id,p.fuel,p.round,p.min,p.max]),[['fire-wood-ring','wood',true,36,48],['fire-gas-bowl','gas',true,30,48],['fire-gas-linear','gas',false,48,84]],'Three fire products with their size ranges');
const fresh=newFireFeature(base);
check(fresh.kind==='fire-feature'&&fresh.productId==='fire-gas-bowl'&&fresh.widthFt*12===42&&fresh.depthFt===fresh.widthFt&&fireFeatureProblem(fresh)==='','The default is a valid 42 in gas fire bowl (no Barrie burn permit)');
check(newYardFeature('fire-feature',base).kind==='fire-feature','newYardFeature hands a fire feature to newFireFeature');
const linear=fire('linear',{productId:'fire-gas-linear',widthFt:5,depthFt:20/12,heightIn:18,rotationDeg:30});
const bowl=fire('bowl',{productId:'fire-gas-bowl',widthFt:3,depthFt:3,heightIn:12,xFt:-12});
const onPatio=fire('on-patio',{xFt:8,zFt:26,supportFeatureId:'p1'});
const saved=validateDesign(design([patio('p1'),onPatio,linear,bowl]));
same(saved.yardFeatures?.map(f=>[f.id,f.kind,f.productId,f.supportFeatureId]),[['p1','patio','permacon-mondrian-plus',undefined],['on-patio','fire-feature','fire-wood-ring','p1'],['linear','fire-feature','fire-gas-linear',undefined],['bowl','fire-feature','fire-gas-bowl',undefined]],'All three products validate; the patio a fire feature stands on is kept');
same(parseDesign(serializeDesign(saved)).yardFeatures,saved.yardFeatures,'Fire features round-trip through a saved design');
check(!('supportFeatureId' in saved.yardFeatures![2]),'No support field is invented for a fire feature on its own pad');
const bad=(f:Partial<YardFeature>,pattern:RegExp,msg:string)=>throws(()=>validateDesign(design([patio('p1'),{...fire('bad'),...f} as YardFeature])),pattern,msg);
bad({productId:'pond'},/not supported/,'A water product is not a fire feature');
bad({productId:'permacon-mondrian-plus'},/not supported/,'A paver is not a fire feature');
bad({widthFt:5,depthFt:5},/36 to 48 in across/,'A wood ring is 36 to 48 in across');
bad({depthFt:3},/as deep as it is wide/,'A round fire feature is as deep as it is wide');
bad({productId:'fire-gas-linear',widthFt:5,depthFt:2.5},/18 to 24 in deep/,'A linear table is 18 to 24 in deep');
bad({heightIn:30},/12 to 24 in high/,'Bodies are 12 to 24 in high');
bad({supportFeatureId:'bad'},/only stand on a patio/,'A fire feature cannot stand on itself');
bad({supportFeatureId:'no spaces allowed'},/only stand on a patio/,'A support id is a plain id');
bad({finishedElevationIn:12},/takes only its product/,'Fire features take no finished level');
bad({hardscape:{finishId:'a',colorId:'b',unitId:'c',patternId:'d',angleDeg:0,jointMm:3}},/supplier variant|takes only its product/,'Fire features take no supplier paving');
bad({outline:[{x:0,y:0},{x:12,y:0},{x:12,y:12}]},/not compatible/,'Fire features take no outline');
bad({baseElevationIn:4},/Only walls/,'Fire features take no wall base');
throws(()=>validateDesign(design([patio('p1',{supportFeatureId:'p2'} as Partial<YardFeature>)])),/Only a fire feature/,'Only a fire feature names a patio to stand on');
throws(()=>validateDesign(design([{...patio('p1'),kind:'fire-pit'} as unknown as YardFeature])),/Invalid or duplicate yard feature/,'Unknown kinds stay rejected');
// A design saved before fire features validates to exactly what it was.
const legacy=design([patio('p1')],{yardAllowances:{...NO_ALLOWANCES,firePit:'wood'}});
same(validateDesign(validateDesign(legacy)),validateDesign(legacy),'Older designs validate unchanged');
check(!needsAdvancedYard(base)&&!hasAdvancedYard(base),'A deck-only design needs no advanced yard runtime');
check(needsAdvancedYard(design([fire('f')]))&&hasAdvancedYard(design([fire('f')]))&&hasAdvancedYard({configuration:design([fire('f')])}),'A fire feature loads the advanced yard runtime (live and saved files)');

// --- Model: on a patio, on its own pad, support fallbacks, level and clearance notes --------------------------------
const flat=model(design([patio('p1'),onPatio]));
const patioTop=featureOf(flat,'p1').topIn,body=box(flat,'on-patio','fire-body')!;
check(!featureOf(flat,'on-patio').excluded&&!box(flat,'on-patio','fire-pad'),'On its patio a fire feature has no gravel pad');
check(Math.abs(body.y-body.h/2-patioTop)<1e-9&&Math.abs(featureOf(flat,'on-patio').topIn-(patioTop+16))<1e-9,`It stands on the patio top (${patioTop} in) and rises its 16 in body`);
check(!!box(flat,'on-patio','fire-ring')&&!box(flat,'on-patio','fire-burner'),'A wood ring carries a steel ring insert');
check(!flat.boxes.some(b=>b.role.startsWith('fire-'))&&!featureOf(flat,'p1').warnings.some(w=>/fire/i.test(w)),'Fire boxes stay on the fire feature, out of the shared yard boxes the generic renderer and exports read');
same(model(design([patio('p1')])).quantities,flat.quantities,'A fire feature on a patio changes none of the yard quantities');
same(featureOf(model(design([patio('p1')])),'p1').quantities,featureOf(flat,'p1').quantities,'...nor the patio it stands on');
const overhang=model(design([patio('p1'),fire('edge',{xFt:8,zFt:19.5,supportFeatureId:'p1'})]));
check(!!box(overhang,'edge','fire-pad')&&has(overhang,'edge',/not wholly on p1/),'Overhanging its patio, it stands on its own pad with a note');
const gone=model(design([fire('orphan',{supportFeatureId:'p9'})]));
check(!!box(gone,'orphan','fire-pad')&&has(gone,'orphan',/not in the design/),'A missing support patio falls back to a pad with a note');
const disabledPatio=model(design([patio('p1',{enabled:false}),fire('lonely',{xFt:8,zFt:26,supportFeatureId:'p1'})]));
check(!!box(disabledPatio,'lonely','fire-pad'),'An excluded support patio falls back to a pad');
const sloped=(zPct:number)=>model(design([patio('p1',{patioSlope:{xPct:0,zPct}}),onPatio]));
check(has(sloped(3),'on-patio',/not on a level surface.*3\.0 %/),'On a patio sloping 3 % it is flagged as not on a level surface');
check(!has(sloped(1.5),'on-patio',/level surface/),'A 1.5 % drainage slope is level enough');
const slopedTop=featureOf(sloped(3),'on-patio'),slopedBody=slopedTop.boxes.find(b=>b.role==='fire-body')!;
check(slopedBody.y-slopedBody.h/2>=patioTop-1e-9,'On a sloped patio the body sits at the highest paving under it');
// Measured ground: a 5 % slope out from the house varies 2.7 in under a 54 in pad.
const slope5=design([fire('ground',{xFt:8,zFt:30})],{siteModel:site((_x,z)=>z*.05)});
const ground=model(slope5),pad=box(ground,'ground','fire-pad')!,groundBody=box(ground,'ground','fire-body')!;
const padHigh=(30*12+27)*.05,padLow=(30*12-27)*.05;
check(pad.y+pad.h/2>=padHigh&&pad.y+pad.h/2<=padHigh+.75+1e-9,`Its pad is levelled just above the highest ground under it (${(pad.y+pad.h/2).toFixed(2)} in over ${padHigh.toFixed(2)} in)`);
check(pad.y-pad.h/2<=padLow+1e-9&&Math.abs(groundBody.y-groundBody.h/2-(pad.y+pad.h/2))<1e-9,'The pad reaches the lowest ground and the body sits on the pad');
check(has(ground,'ground',/varies 2\.7 in, so it needs a level pad/),'Ground varying more than 1 in under the pad needs a level pad');
check(featureOf(ground,'ground').quantities.firePadGravelYd3>0&&!ground.formationRegions.some(r=>r.featureId==='ground'),'Pad gravel is counted for the feature but not added to the yard excavation (it is in the allowance)');
const levelGround=model(design([fire('ground',{xFt:8,zFt:30})],{siteModel:site(()=>6)}));
check(!has(levelGround,'ground',/level pad/)&&Math.abs(box(levelGround,'ground','fire-pad')!.y+box(levelGround,'ground','fire-pad')!.h/2-6.5)<1e-9,'On level ground there is no level-pad note; the pad stands 1/2 in proud');
const outside=model(design([fire('far',{xFt:8,zFt:60})],{siteModel:site(()=>0)}));
check(featureOf(outside,'far').excluded&&featureOf(outside,'far').exclusionReason==='site-coverage'&&has(outside,'far',/outside the measured survey/),'A pad outside the survey is excluded with the reason');
// Clearance (draft local rules): a wood ring needs 13.1 ft, a gas bowl 4 ft, from the house, the deck and its stairs.
// DEFAULT_DECK's stair runs from the deck's front (z 144.75) to z 187.5 at x 72–120 (its last tread's nosing to 188).
same(FIRE_MIN_CLEARANCE_FT,{wood:FIRE_CLEARANCE.woodFt,gas:FIRE_CLEARANCE.gasFt},'Clearances are read from designRules FIRE_CLEARANCE');
const sixOut=12+1.75+6;
const nearWood=model(design([fire('w',{zFt:sixOut})])),nearGas=model(design([fire('g',{zFt:sixOut,productId:'fire-gas-bowl'})]));
check(has(nearWood,'w',new RegExp(`6\\.0 ft from the deck.*enclosed wood-burning appliance at least ${FIRE_CLEARANCE.woodFt} ft.*City of Barrie rule, confirmed`)),'A wood ring (an enclosed appliance) 6 ft from the deck is flagged against the confirmed 4 m rule');
check(!nearGas.warnings.some(w=>/\d ft from the (deck|house)\./.test(w)),'A gas bowl 6 ft from the deck is clear of the deck and house (4 ft)');
// Regression (review S, fire clearance ignored stairs): the stair is a structure too. The same bowl is 2.3 ft from the
// stair's foot, the wood ring 6 ft from the deck is 2.3 ft from the stair against its 4 m.
same(stairFootprints(buildDeckTakeoff(base)).length,1+buildDeckTakeoff(base).treads.length,'Every flight and tread is a stair footprint');
check(has(nearGas,'g',/^g: 2\.3 ft from the stair, inside its 4 ft clearance\. Keep a gas fire feature at least 4 ft from the house, the deck and its stairs \(unconfirmed default/),'A gas bowl 2.3 ft from the stair is flagged against its 48 in clearance');
check(has(nearWood,'w',/2\.3 ft from the stair, inside its 13\.1 ft clearance.*City of Barrie rule, confirmed/),'A wood ring 2.3 ft from the (wood) stair is flagged against the confirmed 4 m rule');
const onStair=model(design([fire('s',{xFt:8,zFt:14,productId:'fire-gas-bowl'})]));
check(has(onStair,'s',/^s: overlaps the stair\. Move it off the stair\./)&&!has(onStair,'s',/ft from the stair/),'A bowl standing on the stair is a conflict, not a clearance');
const besideStair=model(design([fire('b',{xFt:8,zFt:(188+21+60)/12,productId:'fire-gas-bowl'})]));
check(!besideStair.warnings.some(w=>/stair/.test(w)),'A gas bowl 5 ft past the stair is clear of it');
const farWood=model(design([fire('f',{xFt:8,zFt:(188+21+13.2*12)/12})]));
check(!has(farWood,'f',/from the stair/)&&!has(farWood,'f',/ft from the (deck|house)\./),'A wood ring 13.2 ft past the stair is clear of it and the deck');
const gasClose=model(design([fire('g',{zFt:12+1.75+3,productId:'fire-gas-bowl'})]));
check(has(gasClose,'g',/3\.0 ft from the deck.*at least 4 ft.*unconfirmed default/),'A gas bowl 3 ft from the deck is flagged, the 48 in default marked unconfirmed');
const byHouse=model(design([fire('h',{xFt:-4,zFt:5})]));
check(has(byHouse,'h',/ft from the house/)&&has(byHouse,'h',/ft from the deck/),'Beside the house and deck both clearances are flagged');
const woodNote=model(design([fire('w')])),gasNote=model(design([fire('g',{productId:'fire-gas-linear',widthFt:5,depthFt:20/12})]));
check(has(woodNote,'w',/^w: Open wood fire pits need a City of Barrie permit and 15 m from any building; this assumes an approved enclosed wood-burning appliance — confirm with Barrie Fire\.$/)&&!has(woodNote,'w',/Gas hook-up/),'A wood ring always carries the open-fire permit note');
check(has(gasNote,'g',/^g: Gas hook-up and gas line by a licensed \(TSSA-registered\) gas contractor\. Keep it 48 in from combustibles \(unconfirmed default/)&&!has(gasNote,'g',/Open wood fire/),'A gas feature always carries the licensed hook-up note with its unconfirmed 48 in clearance');
const fresh16=model(design([fresh]));
check(!fresh16.warnings.some(w=>/ft from the (deck|house)/.test(w)),'The default fire bowl is placed clear of the deck and house');
const lin=model(design([linear]));
check(!!box(lin,'linear','fire-burner')&&Math.abs(box(lin,'linear','fire-body')!.polygon!.length-4)===0,'A linear table is a rectangle with a burner pan');

// --- Pricing: the estimator's fire pit allowance, no double count ------------------------------------------------------
const takeoff=(d:DeckData)=>buildYardTakeoff(d,model(d));
const allowances=(patch:Partial<YardAllowances>):YardAllowances=>({...NO_ALLOWANCES,...patch});
const engineInput=(tier:YardAllowances['finish'],fuel?:'wood'|'gas'):EstimateInput=>({projectType:'full',selectedElements:fuel?['firepit']:[],sizes:{patio:0,wall:0,wallHeight:'Under 2ft',...(fuel?{firepit:'Medium'}:{})},details:{'patio.surface':'grass','patio.shape':'simple','wall.wallPurpose':'garden',...(fuel?{'firepit.fuel':fuel}:{})},conditions:{access:false,slope:false,drainage:false},location:'barrie',tier,paverBrandId:PAVER_BRANDS[0].id,deckBrandId:'',addOns:[]});
const enginePrice=(i:EstimateInput)=>computeEstimate(i).precise?.subtotalCents??0;
const byTier:Record<string,number>={},totals:Record<string,number>={};
// The estimator's gas-line figure, at its midpoint (as its precise price takes a band).
const GAS_LINE_CENTS=Math.round((FIREPIT_GAS_LINE_CAD.low+FIREPIT_GAS_LINE_CAD.high)/2*100);
check(GAS_LINE_CENTS===225000,'The gas line is the estimator figure, $1,500-$3,000, at its $2,250 midpoint');
for(const finish of ['budget','mid','premium'] as const)for(const [fuel,productId] of [['wood','fire-wood-ring'],['gas','fire-gas-bowl'],['gas','fire-gas-linear']] as const){
 const size=productId==='fire-gas-linear'?{widthFt:5,depthFt:20/12}:{widthFt:3.5,depthFt:3.5};
 // The fire feature itself is the estimator's fire pit; a gas feature's gas line is its own row after it.
 const viaAllowance=takeoff(design([],{yardAllowances:allowances({finish,firePit:'wood'})}));
 const placed=takeoff(design([fire('f1',{productId,...size})],{yardAllowances:allowances({finish})}));
 const a=row(viaAllowance,'allowance-firepit'),p=row(placed,'fire-feature-f1'),gas=row(placed,'fire-gas-line-f1');
 check(a&&p&&a.amountCents!==null&&p.amountCents===a.amountCents,`${finish} ${productId}: priced exactly at the estimator's fire pit allowance (${p?.amountCents} vs ${a?.amountCents})`);
 check(p!.amountCents===enginePrice(engineInput(finish,'wood'))-enginePrice(engineInput(finish)),`${finish} ${productId}: the same figure the estimator engine adds for a fire pit without a gas line`);
 same(p!.featureIds,['f1'],`${finish} ${productId}: the line names its feature`);
 if(fuel==='gas'){
  check(gas&&gas.amountCents===GAS_LINE_CENTS&&gas.featureIds?.[0]==='f1'&&/: gas line and hook-up \(estimator allowance\)$/.test(gas.label)&&/\$1,500–\$3,000, at its midpoint: a planning allowance, not a quote/.test(gas.note??''),`${finish} ${productId}: its gas line is its own row at the estimator's gas-line figure`);
  check(!/gas line/.test(p!.label)&&placed.sections.indexOf(gas!)===placed.sections.indexOf(p!)+1,`${finish} ${productId}: the fire feature row no longer claims the gas line; the gas line row follows it`);
 }else check(!gas&&!placed.sections.some(s=>/gas/i.test(s.label)),`${finish} ${productId}: a wood ring has no gas line`);
 check(placed.knownSubtotalCents===viaAllowance.knownSubtotalCents+(fuel==='gas'?GAS_LINE_CENTS:0)&&!row(placed,'allowance-firepit'),`${finish} ${productId}: the backyard subtotal is the fire pit allowance${fuel==='gas'?' plus the gas line':''}, with no separate fire pit allowance`);
 byTier[`${finish}-${fuel}`]=p!.amountCents!;totals[`${finish}-${productId}`]=placed.knownSubtotalCents;
}
check(byTier['budget-wood']<byTier['mid-wood']&&byTier['mid-wood']<byTier['premium-wood'],'Wood allowances rise with the finish tier');
// Regression (review S, gas priced the same as wood): alone in a yard the estimator's crew-day minimum absorbs a gas line
// priced as a difference (all of it at Standard). As its own row at the estimator's figure, gas is wood plus the gas line.
check(enginePrice(engineInput('budget','gas'))===enginePrice(engineInput('budget','wood')),'(The estimator alone: at Standard its crew-day minimum absorbs the whole gas line)');
check(['budget','mid','premium'].every(t=>totals[`${t}-fire-gas-bowl`]-totals[`${t}-fire-wood-ring`]===GAS_LINE_CENTS),'A placed gas fire feature prices its gas line at every tier: wood plus $2,250, never the same as wood');
// Regression (review S, gas line both included and quoted): the wording matches what is priced.
{const gasDesign=design([fire('g',{productId:'fire-gas-bowl'})],{yardAllowances:allowances({})}),gm=model(gasDesign),gt=buildYardTakeoff(gasDesign,gm);
 check(!gm.warnings.some(w=>/gas/i.test(w)&&/\(quote\)/.test(w))&&!gt.sections.some(s=>/with its gas line|includes its gas line/.test(s.label))&&gt.sections.filter(s=>/gas line/.test(s.label)).length===1,'The gas line is named once, as a priced allowance row, and nowhere called a quote');}
// Regression (review S, an 84 in linear table priced like a 42 in bowl): past the estimator's 48 in fire pit, a linear
// table carries a builder-quote size premium with its extra length; the allowance itself is unchanged.
{const long=takeoff(design([fire('f1',{productId:'fire-gas-linear',widthFt:7,depthFt:2})],{yardAllowances:allowances({})})),bowl=takeoff(design([fire('f1',{productId:'fire-gas-bowl'})],{yardAllowances:allowances({})})),premium=row(long,'fire-size-f1');
 check(premium&&premium.amountCents===null&&premium.quantity===36&&premium.unit==='in over 48 in'&&/: Linear fire table over 48 in \(size premium\)$/.test(premium.label)&&same0(premium.featureIds,['f1']),`An 84 in table: a builder-quote size premium for its 36 in over 48 in (${premium?.label})`);
 check(long.quoteRequired&&long.grandTotalCents===null&&!long.sections.some(s=>s.amountCents===0),'...so its total needs a quote, never $0');
 check(long.knownSubtotalCents===bowl.knownSubtotalCents&&!row(bowl,'fire-size-f1'),'...on the same allowance as a bowl, which has no premium');
 for(const [productId,widthFt,depthFt] of [['fire-gas-linear',4,2],['fire-gas-bowl',4,4],['fire-wood-ring',4,4]] as const)check(!row(takeoff(design([fire('f1',{productId,widthFt,depthFt})],{yardAllowances:allowances({})})),'fire-size-f1'),`A 48 in ${productId}: no size premium`);}
// The chosen fire pit allowance is replaced, never charged as well; other allowances keep their place and price.
const single=()=>takeoff(design([fire('f1')],{yardAllowances:allowances({})}));
const both=takeoff(design([fire('f1')],{yardAllowances:allowances({firePit:'gas',kitchen:'basic',lighting:true})}));
const plain=takeoff(design([],{yardAllowances:allowances({firePit:'wood',kitchen:'basic',lighting:true})}));
check(!row(both,'allowance-firepit')&&both.sections.filter(s=>/fire/.test(s.id)).length===1,'With a fire pit allowance and a placed fire feature only the feature is charged');
same(both.sections.map(s=>s.amountCents),plain.sections.map(s=>s.amountCents),'...at the wood allowance, with the kitchen and lighting allowances unchanged');
check(both.knownSubtotalCents===plain.knownSubtotalCents,'...and the same subtotal');
check(both.warnings.some(w=>/replaces the fire pit allowance/.test(w)),'The replacement is stated');
check(!single().warnings.some(w=>/Not drawn in 3D/.test(w)),'A placed fire feature alone is not called "not drawn in 3D"');
// A second fire feature is a builder quote line, never $0.
const two=takeoff(design([fire('f1'),fire('f2',{xFt:-14,productId:'fire-gas-bowl'})],{yardAllowances:allowances({})}));
const second=row(two,'fire-feature-f2');
check(second&&second.amountCents===null&&/builder quote/.test(second.label)&&/gas line/.test(second.label)&&two.quoteRequired&&two.grandTotalCents===null,'A second fire feature is a builder quote line and the total needs a quote');
check(row(two,'fire-feature-f1')!.amountCents===row(single(),'fire-feature-f1')!.amountCents&&two.knownSubtotalCents===single().knownSubtotalCents,'The first is priced as when alone');
check(!two.sections.some(s=>s.amountCents===0),'No $0 lines');
// Regression (review S, an excluded fire wiped the fire pit allowance): only a placed fire feature replaces it. An
// excluded one is a builder quote line and the chosen allowance stays charged, at the same price as without it.
for(const firePit of ['wood','gas'] as const){
 const allowanceOnly=takeoff(design([],{siteModel:site(()=>0),yardAllowances:allowances({firePit})}));
 const excluded=takeoff(design([fire('far',{xFt:8,zFt:60})],{siteModel:site(()=>0),yardAllowances:allowances({firePit})}));
 check(row(excluded,'allowance-firepit')!.amountCents===row(allowanceOnly,'allowance-firepit')!.amountCents&&row(excluded,'allowance-firepit')!.amountCents!>0&&!row(excluded,'fire-feature-far')&&row(excluded,'excluded-far')?.amountCents===null,`${firePit}: an excluded fire feature is a builder quote line and the fire pit allowance stays charged`);
 check(excluded.knownSubtotalCents===allowanceOnly.knownSubtotalCents,`${firePit}: ...at the known subtotal of the allowance alone (${excluded.knownSubtotalCents})`);
 check(excluded.warnings.some(w=>/^far is excluded, so the fire pit allowance stays in the price until it is placed\.$/.test(w))&&!excluded.warnings.some(w=>/replaces the fire pit allowance/.test(w)),`${firePit}: ...and says so`);
}
{const placedAndExcluded=takeoff(design([fire('f1'),fire('far',{xFt:8,zFt:60})],{siteModel:site(()=>0),yardAllowances:allowances({firePit:'gas'})}));
 check(!row(placedAndExcluded,'allowance-firepit')&&row(placedAndExcluded,'fire-feature-f1')!.amountCents!>0&&row(placedAndExcluded,'excluded-far')?.amountCents===null,'A placed fire feature still replaces the allowance beside an excluded one');}
// On a patio: the patio is priced as before; the fire feature adds its allowance after it.
const patioOnly=takeoff(design([patio('p1')]));
const patioFire=takeoff(design([patio('p1'),onPatio]));
same(patioFire.sections.filter(s=>!/fire/.test(s.id)).map(s=>[s.id,s.amountCents]),patioOnly.sections.map(s=>[s.id,s.amountCents]),'A fire feature on a patio leaves every patio line as it was');
check(patioFire.knownSubtotalCents===patioOnly.knownSubtotalCents+row(patioFire,'fire-feature-on-patio')!.amountCents!,'...and adds exactly its own allowance line');
const afterPatio=row(patioFire,'fire-feature-on-patio')!.amountCents!;
check(afterPatio>0&&afterPatio<=byTier['mid-wood']&&!/one-time site work/.test(row(patioFire,'fire-feature-on-patio')!.note??''),`After a patio the fire pit allowance carries no second site-work minimum (${afterPatio} vs ${byTier['mid-wood']} alone)`);
// Designs without fire features: the same price as before, line for line.
const measured=design([patio('p1')],{siteModel:site((x,z)=>x*.01+z*.02),yardAllowances:allowances({firePit:'gas',kitchen:'full',turfSqft:400,lighting:true,finish:'premium'})});
const withDisabled=design([patio('p1'),fire('off',{enabled:false})],{siteModel:measured.siteModel,yardAllowances:measured.yardAllowances});
same(takeoff(withDisabled),takeoff(measured),'A switched-off fire feature changes nothing (sections, totals, warnings)');
const noFire=takeoff(measured);
check(row(noFire,'allowance-firepit')!.amountCents!>0&&!noFire.sections.some(s=>/^fire-feature-/.test(s.id))&&noFire.warnings.some(w=>/Not drawn in 3D/.test(w)),'Without a fire feature the fire pit allowance is charged as it always was');

// --- Words ---------------------------------------------------------------------------------------------------------
const words=design([fire('f1')],{yardAllowances:allowances({firePit:'gas',kitchen:'basic'})});
check(/a wood-burning fire ring \(fire pit allowance\)/.test(describeBackyard(model(words),words.yardAllowances)??'')&&!/gas fire pit/.test(describeBackyard(model(words),words.yardAllowances)??''),'The backyard description names the placed fire feature, not the replaced allowance');
check(backyardElements(words).includes('fire pit'),'Lead scoring hears a fire pit');

console.log(`Fire features: ${checks} checks passed (validation, placement on patio and pad, level and clearance notes, allowance pricing with no double count, unchanged designs without fire).`);
