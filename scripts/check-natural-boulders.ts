/**
 * Natural stone boulders (NS1). Five CC0 scan shapes coloured by stone type, set partly into the ground, with an
 * estimated weight on an unpriced quote line. Boulders saved before this (assetId natural-boulder, no stone fields)
 * must save, link, take off, quote, price and draw exactly as production 3e94257 did: the outputs frozen in
 * scripts/fixtures/legacy-boulders-golden.json. Never regenerate that golden from current code.
 */
import '../src/features/deckcraft/lib/inlayGeometryRuntime';
import '../src/features/deckcraft/foundationDatumsRuntime';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import * as THREE from 'three';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {ensureLiveDesignExtensions} from '../src/features/deckcraft/designExtensions';
import {parseDesign,serializeDesign} from '../src/features/deckcraft/designPersistence';
import {designLinkJson} from '../src/features/deckcraft/designLink';
import {calculateDeckReleaseEstimate} from '../src/features/deckcraft/deckRelease';
import {LANDSCAPE_ASSETS,landscapeAsset,newBoulder,reshapeBoulder} from '../src/features/deckcraft/landscapeCatalogue';
import {BOULDER_DENSITY_SOURCE,BOULDER_SHAPE_IDS,BOULDER_STONES,BURIAL_SHARES,boulderStone,burialFor} from '../src/features/deckcraft/boulderStones';
import {validateLandscapeObjects,type LandscapeObject} from '../src/features/deckcraft/landscapeTypesRuntime';
import {landscapeQuoteSections,landscapeTakeoff} from '../src/features/deckcraft/landscapeModelRuntime';
import {boulderTint,landscapeInstanceMatrix,landscapeSeatDyIn} from '../src/features/deckcraft/components/viewer3d/Landscape3D';
import {createDeckAgentController,type AgentResponse,type DeckAgentHostState} from '../src/features/deckcraft/designer/deckAgentController';
import {assistantPlanSchemaForContext,buildAssistantContext} from '../src/features/deckcraft/designer/assistantPlan';
import type {DeckData} from '../src/features/deckcraft/types';

let checks=0;const ok=(value:unknown,message:string)=>{assert.ok(value,message);checks++;},eq=(a:unknown,b:unknown,message:string)=>{assert.deepEqual(a,b,message);checks++;};
const near=(a:number,b:number,tolerance:number,message:string)=>ok(Math.abs(a-b)<=tolerance,`${message} (${a} vs ${b})`);
const seeded=(seed:number)=>()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};

// 1. Legacy boulders are byte-identical to production.
{
 const golden=JSON.parse(readFileSync('scripts/fixtures/legacy-boulders-golden.json','utf8')),fixture=JSON.parse(readFileSync('scripts/fixtures/legacy-boulders-design.json','utf8'));
 // The golden was saved at 3e94257, when new designs were priced on '2026-10-piers'.
 const design={...DEFAULT_DECK,buildRules:'2026-10-piers',terrainConfig:{widthFt:80,depthFt:80,elevationIn:6,slopePct:4},landscapeObjects:fixture.landscapeObjects} as DeckData;
 await ensureLiveDesignExtensions(design);
 const saved=serializeDesign(parseDesign(serializeDesign(design))),reopened=parseDesign(saved);
 eq(saved,golden.saved,'A saved legacy boulder design serializes exactly as before');
 eq(designLinkJson(reopened),golden.link,'…and links exactly as before');
 const takeoff=landscapeTakeoff(reopened.landscapeObjects,reopened);
 eq(JSON.parse(JSON.stringify(takeoff)),golden.takeoff,'Legacy boulder takeoff is unchanged (no weight, no new keys)');
 eq(JSON.parse(JSON.stringify(landscapeQuoteSections(reopened.landscapeObjects!,takeoff))),golden.quote,'Legacy boulder quote lines are unchanged');
 eq(JSON.stringify(calculateDeckReleaseEstimate(reopened)),golden.estimateJson,'The release estimate of a legacy boulder design is unchanged');
 const norm=new THREE.Matrix4().makeScale(1/2.4,1/1.47,1/3.06);
 for(const o of reopened.landscapeObjects!)eq(landscapeInstanceMatrix(reopened,o,norm,new THREE.Matrix4()).elements,golden.matrices[o.id],`${o.id} draws with the same instance matrix`);
 for(const o of reopened.landscapeObjects!){ok(boulderStone(o)===undefined,`${o.id} has no stone, so it keeps the scan's own colour`);ok(boulderTint(new THREE.Color(),o)===undefined,`${o.id} is not re-tinted`);eq(landscapeSeatDyIn(o,new Map()),0,`${o.id} sits at its placement, not lowered`);}
}

// 2. The shape library: five CC0 scans with their own proportions, measured fill and triangle budgets.
const manifest=JSON.parse(readFileSync('public/deckcraft/landscape/boulder-library-manifest.json','utf8'));
{
 eq([...BOULDER_SHAPE_IDS],manifest.assets.map((a:{id:string})=>a.id),'Every shape in the manifest is a boulder shape, in the same order');
 ok(BOULDER_SHAPE_IDS.length===5,'Five boulder shapes');
 for(const entry of manifest.assets){
  const asset=landscapeAsset(entry.id);
  ok(asset.kind==='boulder'&&asset.category==='Stone'&&asset.sourceURL===entry.sourceURL&&entry.license==='CC0-1.0'&&entry.sourceURL.startsWith('https://polyhaven.com/a/'),`${entry.id} is a CC0 Poly Haven boulder`);
  eq(asset.triangleCounts,entry.lods.map((l:{triangles:number})=>l.triangles),`${entry.id} triangle budgets match its GLBs`);
  ok(asset.fillShare===entry.fillShare&&entry.fillShare>.25&&entry.fillShare<.6,`${entry.id} carries its measured fill share`);
  const [x,y,z]=entry.sizeM;near(asset.widthIn/asset.depthIn,x/z,.03,`${entry.id} default plan proportions follow the scan`);near(asset.heightIn/asset.depthIn,y/z,.03,`${entry.id} default height follows the scan`);
 }
 ok(LANDSCAPE_ASSETS.some(a=>a.id==='natural-boulder')&&!(BOULDER_SHAPE_IDS as readonly string[]).includes('natural-boulder'),'natural-boulder stays a legacy asset outside the shape library');
 // The tint assumes a grey scan with a linear mean of 0.5 at every level of detail.
 const linear=(v:number)=>{const c=v/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;};
 for(const entry of manifest.assets)for(const lod of entry.lods){
  const glb=readFileSync('public/deckcraft/landscape/'+lod.uri),jsonLength=glb.readUInt32LE(12),json=JSON.parse(glb.subarray(20,20+jsonLength).toString('utf8')),bin=glb.subarray(28+jsonLength);
  const material=json.materials[0],image=json.images[json.textures[material.pbrMetallicRoughness.baseColorTexture.index].source],view=json.bufferViews[image.bufferView];
  const {data,info}=await sharp(bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength)).removeAlpha().raw().toBuffer({resolveWithObject:true});
  let mean=0,colour=0;for(let i=0;i<data.length;i+=info.channels){mean+=linear(data[i]);colour=Math.max(colour,Math.abs(data[i]-data[i+1]),Math.abs(data[i]-data[i+2]));}mean/=data.length/info.channels;
  near(mean,.5,.01,`${lod.uri} base colour has a linear mean of 0.5`);ok(colour<=8,`${lod.uri} base colour is grey, so the stone colour shows true`);
 }
}

// 3. A new boulder: granite, a quarter set into the ground, a random yaw and up to 15 % size variation, all saved.
for(const shape of BOULDER_SHAPE_IDS){
 const asset=landscapeAsset(shape),a=newBoulder(shape,'b-'+shape,24,360,seeded(7)),b=newBoulder(shape,'b-'+shape,24,360,seeded(7)),c=newBoulder(shape,'c-'+shape,24,360,seeded(99));
 ok(validateLandscapeObjects([a]),`A new ${shape} validates`);
 eq(a,b,'The same random source gives the same boulder');ok(JSON.stringify({...a,id:''})!==JSON.stringify({...c,id:''}),'Different draws give different boulders');
 ok(a.kind==='boulder'&&a.assetId===shape&&a.stoneType==='granite'&&a.name==='Granite boulder','New boulders are granite by default and say so');
 for(const k of ['widthIn','heightIn','depthIn'] as const)ok(a[k]>=asset[k]*.85-1e-9&&a[k]<=asset[k]*1.15+1e-9,`${shape} ${k} stays within 15 % of the shape's size`);
 ok(Number.isInteger(a.rotationDeg)&&a.rotationDeg>=0&&a.rotationDeg<360,'The yaw is a saved whole degree');
 eq(a.burialIn,Math.round(a.heightIn/4),'A quarter of the stone is set into the ground');
}

// 4. Validation: stone fields belong to the scan shapes only, with sane values.
{
 const rock=newBoulder('boulder-fieldstone-round','r',0,300,seeded(3)),legacy={id:'old',name:'Natural boulder',enabled:true,kind:'boulder' as const,assetId:'natural-boulder' as const,xIn:0,zIn:300,rotationDeg:0,heightIn:24,widthIn:42,depthIn:30};
 ok(validateLandscapeObjects([legacy]),'A legacy boulder still validates');
 for(const stone of BOULDER_STONES)ok(validateLandscapeObjects([{...rock,stoneType:stone.id}]),`${stone.name} is a valid stone`);
 ok(validateLandscapeObjects([{...rock,stoneType:undefined,burialIn:undefined}]),'Stone fields are optional (missing stone draws and weighs as granite)');
 for(const [label,bad] of [['an unknown stone',{...rock,stoneType:'marble'}],['a negative burial',{...rock,burialIn:-1}],['burying the whole stone',{...rock,burialIn:rock.heightIn}],['stone on natural-boulder',{...legacy,stoneType:'granite'}],['burial on natural-boulder',{...legacy,burialIn:4}],['stone on a plant',{...rock,kind:'plant',assetId:'rounded-shrub'}]] as const)ok(!validateLandscapeObjects([bad]),`Refuses ${label}`);
}

// 5. Weight: envelope × measured fill × cited density, on an unpriced line; legacy-only designs gain nothing.
{
 const granite=newBoulder('boulder-quarried-block','g',0,300,seeded(5)),lime={...newBoulder('boulder-bench','l',120,300,seeded(6)),stoneType:'limestone' as const},off={...newBoulder('boulder-fieldstone-dome','x',200,300,seeded(8)),enabled:false};
 const expected=(o:LandscapeObject)=>landscapeAsset(o.assetId).fillShare!*o.widthIn*o.heightIn*o.depthIn*1.6387064e-5*BOULDER_STONES.find(s=>s.id===(o.stoneType??'granite'))!.densityTm3;
 // Hand-worked: 0.4044 × 33 × 20 × 42 in = 11,209.97 in³ = 0.18370 m³; × 2.72 t/m³ = 0.4997 t.
 near(expected({...granite,widthIn:33,heightIn:20,depthIn:42}),.4997,.0005,'A 33 × 20 × 42 in granite block weighs about 0.50 t');
 ok(BOULDER_DENSITY_SOURCE.startsWith('https://www.ausimm.com/'),'Densities name their source');
 const takeoff=landscapeTakeoff([granite,lime,off]);
 near(takeoff.items.find(i=>i.objectId==='g')!.stoneTonnes!,expected(granite),1e-9,'Granite weight');
 near(takeoff.items.find(i=>i.objectId==='l')!.stoneTonnes!,expected(lime),1e-9,'Limestone weight uses its own density');
 near(takeoff.boulderTonnes!,expected(granite)+expected(lime),1e-9,'Total stone weight counts enabled boulders only');
 ok(takeoff.items.every(i=>i.quoteRequired)&&takeoff.boulderCount===2,'Boulders stay quote required');
 const lines=landscapeQuoteSections([granite,lime,off],takeoff),line=lines.find(l=>l.id==='landscape-g')!;
 ok(lines.every(l=>l.amountCents===null),'No boulder line carries a price');
 ok(line.quantity===1&&line.unit==='ea'&&/Granite/.test(line.note!)&&new RegExp(`${expected(granite).toFixed(2)} t`).test(line.note!)&&/2\.72 t\/m³/.test(line.note!)&&/estimate/i.test(line.note!),'The note gives the stone, the estimated weight and its basis');
 ok(!/nursery|species/i.test(line.note!),'A stone line no longer talks about nursery stock');
 const legacyOnly=landscapeTakeoff([{id:'old',name:'Natural boulder',enabled:true,kind:'boulder',assetId:'natural-boulder',xIn:0,zIn:300,rotationDeg:0,heightIn:24,widthIn:42,depthIn:30}]);
 ok(!('boulderTonnes' in legacyOnly)&&!('stoneTonnes' in legacyOnly.items[0]),'A legacy boulder gets no weight');
}

// 6. Drawing: stone colour on a grey scan, and the buried part below the placement.
{
 const rock=newBoulder('boulder-fieldstone-round','paint',0,300,seeded(11));
 for(const stone of BOULDER_STONES){
  const tint=boulderTint(new THREE.Color(),{...rock,stoneType:stone.id})!,base=new THREE.Color(stone.colour).multiplyScalar(2);
  for(const k of ['r','g','b'] as const){near(tint[k],base[k],1e-9,`${stone.name} tint ${k} is twice the stone colour (the scan's grey mean is 0.5)`);ok(tint[k]<=1,'Tints stay within 0–1 for Photo mode');}
 }
 eq(boulderTint(new THREE.Color(),{...rock,stoneType:undefined})!.getHex(),boulderTint(new THREE.Color(),{...rock,stoneType:'granite'})!.getHex(),'A shape boulder without a stone draws as granite');
 eq(landscapeSeatDyIn(rock,new Map()),-rock.burialIn!,'The buried part is drawn below the placement');
 eq(landscapeSeatDyIn({...rock,burialIn:undefined},new Map([[rock.id,{dyIn:1.5} as never]])),1.5,'A seat offset still applies when nothing is buried');
 ok(BURIAL_SHARES.every(s=>s>=0&&s<=.5),'Burial presets stay within half the stone');
 for(const h of [1,1.5,3,24])for(const s of BURIAL_SHARES)ok(burialFor(h,s)<h&&validateLandscapeObjects([{...rock,heightIn:h,burialIn:burialFor(h,s)}]),`A ${h} in stone set ${s} in stays valid`);
}

// 7. Changing shape keeps the stone's volume and takes the new shape's proportions.
{
 const legacy:LandscapeObject={id:'old',name:'Natural boulder',enabled:true,kind:'boulder',assetId:'natural-boulder',xIn:10,zIn:300,rotationDeg:30,heightIn:24,widthIn:42,depthIn:30};
 for(const shape of BOULDER_SHAPE_IDS){
  const next=reshapeBoulder(legacy,shape),asset=landscapeAsset(shape);
  ok(validateLandscapeObjects([next])&&next.assetId===shape&&next.stoneType==='granite'&&next.burialIn===Math.round(next.heightIn/4),`A legacy boulder converts to ${shape} as granite, a quarter buried`);
  near(next.widthIn*next.heightIn*next.depthIn,42*24*30,42*24*30*.01,`${shape} keeps the stone's volume`);
  near(next.widthIn/next.depthIn,asset.widthIn/asset.depthIn,.01,`${shape} takes its own proportions`);
  ok(next.xIn===10&&next.zIn===300&&next.rotationDeg===30&&next.id==='old','Position, yaw and id are kept');
 }
 const named={...newBoulder('boulder-bench','n',0,300,seeded(4)),name:'Bench stone'};ok(reshapeBoulder(named,'boulder-fieldstone-dome').name==='Bench stone','A name the user typed is kept');
}

// 8. The agent API and the assistant accept the stone fields.
{
 const data={...structuredClone(DEFAULT_DECK),houseVisible:false} as DeckData;
 let state:DeckAgentHostState={data,view:'plan',openSections:[],canUndo:false,canRedo:false,ready:true};
 const api=createDeckAgentController({getState:()=>state,commitDesign:next=>{state={...state,data:next};},undo:()=>{},redo:()=>{},setView:()=>{},openSection:()=>{},waitForRender:async()=>{}});
 const object=newBoulder('boulder-quarried-fractured','agent-rock',0,420,seeded(12));
 const created=await api.execute({id:'nb-1',commands:[{type:'landscape.edit',id:object.id,edit:{action:'create',object}}]}) as AgentResponse;
 ok(created.ok,`The agent creates a stone boulder (${created.ok===false?created.error.message:''})`);
 const patched=await api.execute({id:'nb-2',commands:[{type:'landscape.edit',id:object.id,edit:{action:'patch',patch:{stoneType:'sandstone',burialIn:6}}}]}) as AgentResponse;
 ok(patched.ok&&state.data.landscapeObjects!.find(o=>o.id===object.id)!.stoneType==='sandstone','…and changes its stone and burial');
 const schema=JSON.stringify(assistantPlanSchemaForContext(buildAssistantContext(api.read())));
 ok(schema.includes('"stoneType"')&&schema.includes('"burialIn"'),'The assistant schema offers stone and burial');
}

console.log(`NATURAL BOULDERS OK — ${checks} checks: legacy boulders byte-identical to 3e94257, ${BOULDER_SHAPE_IDS.length} CC0 shapes, stone tint, burial, weight on unpriced lines, agent and assistant fields.`);
