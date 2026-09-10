import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {DECKING_CATALOGUE,RAILING_CATALOGUE,MANUFACTURER_ACCESSORIES} from '../src/features/deckcraft/manufacturerCatalog';
import {LIGHTING_CATALOGUE} from '../src/features/deckcraft/lightingCatalogue';
import {activeLightingItems} from '../src/features/deckcraft/lightingSystem';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {newYardFeature,getTerrainConfig} from '../src/features/deckcraft/yardSettings';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import {parseDesign,serializeDesign,validateDesign,MAX_DESIGN_BYTES} from '../src/features/deckcraft/designPersistence';
import {deckExportMeshes,exportDeckDXF,exportDeckOBJ} from '../src/features/deckcraft/designExports';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {getStairBoards} from '../src/features/deckcraft/stairBoards';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {MATERIAL_TIERS,INLITE_PRODUCTS,type DeckData} from '../src/features/deckcraft/types';

let checks=0;
function check(label:string,fn:()=>void){try{fn();checks++;}catch(e){throw new Error(label,{cause:e});}}
const defaultEstimate=calculateEstimate(DEFAULT_DECK,DECK_SETTINGS).total;
for(const material of DECKING_CATALOGUE)check(`catalogue colours and real assets ${material.id}`,()=>{
  for(const color of material.colors){
    const data={...structuredClone(DEFAULT_DECK),deckingMaterial:material.id,deckingColor:color.name};
    const restored=parseDesign(serializeDesign(data));assert.equal(restored.deckingMaterial,material.id);assert.equal(restored.deckingColor,color.name);
    const path=new URL('../src/features/deckcraft/assets/swatches/'+color.swatch,import.meta.url);assert(existsSync(path),color.swatch);
    const bytes=readFileSync(path);assert(bytes.length>1000);assert.equal(bytes[0],255);assert.equal(bytes[1],216);
  }
  const original=MATERIAL_TIERS.find(m=>m.id===material.id);
  if(original)assert.equal(material.costPerSqft,original.costPerSqft);else assert.equal(material.costPerSqft,null);
});
for(const rail of RAILING_CATALOGUE)check(`branded rail round trip ${rail.id}`,()=>{
  const restored=parseDesign(serializeDesign({...structuredClone(DEFAULT_DECK),catalogueRailingId:rail.id,railingType:'None'}));
  assert.equal(restored.catalogueRailingId,rail.id);assert.equal(restored.railingType,rail.baseType);assert.equal(rail.quoteRequired,true);
});
check('unknown branded rail rejected',()=>assert.throws(()=>validateDesign({...DEFAULT_DECK,catalogueRailingId:'fake-free-glass'})));
check('supported accessory identities round trip',()=>{const ids=MANUFACTURER_ACCESSORIES.filter(a=>a.previewSupported).map(a=>a.id);assert.deepEqual(parseDesign(serializeDesign({...DEFAULT_DECK,catalogueAccessories:ids})).catalogueAccessories,ids);});
check('independent border finish persists and enables border geometry',()=>{const restored=parseDesign(serializeDesign({...DEFAULT_DECK,borderFinish:'Dark Slate',pictureFrameRows:0}));assert.equal(restored.borderFinish,'Dark Slate');assert.equal(restored.pictureFrameRows,1);assert.throws(()=>validateDesign({...DEFAULT_DECK,borderFinish:'fake'}));});
check('manufacturer-adjustable border overhang persists within bounds',()=>{for(const pictureFrameOverhangIn of [0,.5,1,1.5])assert.equal(parseDesign(serializeDesign({...DEFAULT_DECK,pictureFrameOverhangIn})).pictureFrameOverhangIn,pictureFrameOverhangIn);assert.throws(()=>validateDesign({...DEFAULT_DECK,pictureFrameOverhangIn:2}));});
check('all supported lighting identities round trip',()=>{const selectedItems=LIGHTING_CATALOGUE.filter(p=>p.supported).map(p=>({productId:p.id,qty:1}));assert.deepEqual(parseDesign(serializeDesign({...DEFAULT_DECK,lightingSystem:{wireDistance:70,selectedItems}})).lightingSystem.selectedItems,selectedItems);});
check('unsupported lighting excluded from imports',()=>{for(const p of LIGHTING_CATALOGUE.filter(p=>!p.supported))assert.throws(()=>validateDesign({...DEFAULT_DECK,lightingSystem:{wireDistance:10,selectedItems:[{productId:p.id,qty:1}]}}));});
check('installation zones and preview toggle remain separate',()=>{const data:DeckData={...structuredClone(DEFAULT_DECK),lightingPreviewOn:false,lightingZoneEnabled:{deck:false,posts:true},lightingSystem:{wireDistance:20,selectedItems:[{productId:'puck',qty:2,zone:'deck'},{productId:'wedge',qty:3,zone:'posts'},{productId:'hub100',qty:1}]}};const restored=parseDesign(serializeDesign(data));assert.deepEqual(restored.lightingSystem,data.lightingSystem);assert.equal(restored.lightingPreviewOn,false);assert.equal(activeLightingItems(restored).filter(p=>p.id==='puck').length,0);assert.equal(activeLightingItems(restored).find(p=>p.id==='wedge')?.qty,3);assert.deepEqual(activeLightingItems(restored),activeLightingItems({...restored,lightingPreviewOn:true}));});
check('house edits round trip without changing deck commercial quantities',()=>{const houseConfig={...getHouseConfig(DEFAULT_DECK),widthFt:42,depthFt:33,storeys:3 as const,roofShape:'Hip' as const,roofFinish:'Metal' as const,cladding:'Brick' as const,claddingColor:'#a35a42',openings:[{id:'left-door',type:'Door' as const,facade:'Left' as const,offsetPct:65,bottomIn:0,widthIn:36,heightIn:84},{id:'upper-window',type:'Window' as const,facade:'Back' as const,offsetPct:40,bottomIn:240,widthIn:60,heightIn:54}]};const data={...DEFAULT_DECK,houseConfig};const restored=parseDesign(serializeDesign(data));assert.deepEqual(restored.houseConfig,houseConfig);assert.equal(calculateEstimate(restored,DECK_SETTINGS).total,calculateEstimate(DEFAULT_DECK,DECK_SETTINGS).total);});
for(const patch of [{widthFt:1000},{roofColor:'javascript:evil'},{storeys:0},{openings:[{id:'x'}]}])check('hostile house values rejected',()=>assert.throws(()=>validateDesign({...DEFAULT_DECK,houseConfig:{...getHouseConfig(DEFAULT_DECK),...patch}})));
check('combined yard features and terrain round trip',()=>{const yardFeatures=(['patio','retaining-wall','water-feature'] as const).map((kind,i)=>({...newYardFeature(kind,DEFAULT_DECK),id:`feature-${i}`,xFt:i*10,zFt:25,rotationDeg:90,enabled:i!==1}));const data={...DEFAULT_DECK,yardFeatures,terrainConfig:{...getTerrainConfig(DEFAULT_DECK),slopePct:3,elevationIn:6}};const restored=parseDesign(serializeDesign(data));assert.deepEqual(restored.yardFeatures,yardFeatures);assert.deepEqual(restored.terrainConfig,data.terrainConfig);});
for(const patch of [{widthFt:10000},{productId:'fake-price'},{kind:'pool'},{enabled:'yes'},{color:'url(evil)'},{rotationDeg:Infinity}])check('hostile yard values rejected',()=>assert.throws(()=>validateDesign({...DEFAULT_DECK,yardFeatures:[{...newYardFeature('patio',DEFAULT_DECK),...patch}]})));
for(const ids of [['fake'],['dk_fascia','dk_fascia'],['dk_sleeper']])check('invalid accessory selection rejected',()=>assert.throws(()=>validateDesign({...DEFAULT_DECK,catalogueAccessories:ids})));
for(const material of MATERIAL_TIERS)check(`round trip ${material.id}`,()=>{
  const data={...structuredClone(DEFAULT_DECK),deckingMaterial:material.id,deckingColor:material.colors.at(-1)!.name,houseVisible:false,sceneLighting:'Evening' as const};
  const json=serializeDesign(data),restored=parseDesign(json);
  assert.equal(serializeDesign(restored),json);
  assert.equal(calculateEstimate(restored,DECK_SETTINGS).total,calculateEstimate(data,DECK_SETTINGS).total);
  assert(!json.includes('materialMarkup'));assert(!json.includes('customOverrides'));
});
check('all light products and custom geometry survive save',()=>{
  const data={...structuredClone(DEFAULT_DECK),levels:2,level2Position:'Left' as const,level2Offset:27,stairType:'Landing' as const,stairTurn:'Left' as const,landingDepthIn:66,lightingSystem:{selectedItems:INLITE_PRODUCTS.map(p=>({productId:p.id,qty:2})),wireDistance:135}};
  const actual=parseDesign(serializeDesign(data));assert.deepEqual(actual.lightingSystem,data.lightingSystem);assert.equal(actual.level2Position,'Left');assert.equal(actual.landingDepthIn,66);
});
check('untrusted contractor overrides cannot change commercial basis',()=>{
  const dirty={...DEFAULT_DECK,materialMarkup:-100,customLaborCost:0,customOverrides:{decking:{qty:0,cost:0}},addOnHardwareCost:0,addOnTransitionLabor:0,crewRates:{Barrie:0},__proto__:{polluted:true}};
  const clean=validateDesign(dirty);assert.equal(clean.materialMarkup,DEFAULT_DECK.materialMarkup);assert.equal(clean.customLaborCost,undefined);assert.equal(clean.customOverrides,undefined);assert.equal(clean.addOnHardwareCost,undefined);assert.equal(calculateEstimate(clean,DECK_SETTINGS).total,defaultEstimate);assert.equal(({} as any).polluted,undefined);
});
for(const [key,value] of [['width',0],['height',100000],['width',NaN],['levels',20],['deckingMaterial','missing'],['deckingColor','invented'],['boardWidth',100],['stairType','spiral'],['hasDemo','yes'],['level2Offset',-1],['houseDoorOffset',101],['scopeOfWork','x'.repeat(2001)]] as const)check(`reject ${key}=${value}`,()=>assert.throws(()=>validateDesign({...DEFAULT_DECK,[key]:value})));
for(const selectedItems of [[{productId:'puck',qty:1.5}],[{productId:'puck',qty:-1}],[{productId:'missing',qty:1}],[{productId:'puck',qty:1},{productId:'puck',qty:2}]])check('reject malformed light selection',()=>assert.throws(()=>validateDesign({...DEFAULT_DECK,lightingSystem:{wireDistance:20,selectedItems}})));
for(const source of ['{','[]','null',JSON.stringify({format:'golden-maple-deck-design',version:999,configuration:DEFAULT_DECK}),' '.repeat(MAX_DESIGN_BYTES+1)])check('invalid JSON envelope',()=>assert.throws(()=>parseDesign(source)));
check('missing additive fields migrate safely',()=>{const legacy={...DEFAULT_DECK};delete legacy.houseVisible;delete legacy.level2Position;assert.equal(validateDesign(legacy).houseVisible,true);assert.equal(validateDesign(legacy).level2Position,'Front');});

const scenarios:Partial<DeckData>[]=[{}, {shape:'L-Shape'}, {shape:'Curved',foundation:'Helical Piles',foundationDepthIn:84}, {levels:2,level2Position:'Left',stairType:'Landing'}, {stairType:'Winder'}, {pattern:'Herringbone'}, {benchLf:8,privacySqft:24,pergolaSqft:64,hasDrainage:true,lightingSystem:{wireDistance:40,selectedItems:[{productId:'ace',qty:2},{productId:'fusion',qty:3}]}}];
for(const [scenario,patch] of scenarios.entries())check(`actual CAD/model geometry ${scenario}`,()=>{
  const data={...structuredClone(DEFAULT_DECK),...patch},model=buildDeckTakeoff(data),meshes=deckExportMeshes(data,model);
  assert(meshes.length>model.quantities.installedBoardPieces);assert.equal(meshes.filter(m=>/^level_\d+_board_/.test(m.name)).length,model.quantities.installedBoardPieces);
  for(const [li,level] of model.levels.entries()){
    assert.equal(meshes.filter(m=>m.name.startsWith(`level_${li+1}_rim_`)).length,level.rim?.length??0);
    for(const [bi,board] of level.boards.entries())if(board.polygon){
      const mesh=meshes.find(m=>m.name===`level_${li+1}_board_${bi+1}`)!;
      for(const p of board.polygon)assert(mesh.vertices.some(v=>Math.abs(v.x-p.x-level.offset.x)<1e-6&&Math.abs(v.z-p.y-level.offset.z)<1e-6));
    }
  }
  const stairBoards=getStairBoards(data,model);assert.equal(meshes.filter(m=>m.name.startsWith('stair_tread_board_')).length,stairBoards.length);
  assert.equal(meshes.filter(m=>m.name.startsWith('closed_stair_riser_')).length,model.riserBoards?.length??0);
  for(const [bi,board] of stairBoards.entries())for(const p of board.polygon??[]){const mesh=meshes.find(m=>m.name===`stair_tread_board_${bi+1}`)!;assert(mesh.vertices.some(v=>Math.abs(v.x-p.x)<1e-6&&Math.abs(v.z-p.y)<1e-6));}
  for(const [si,stringer] of model.stringers.entries())if(stringer.stair&&stringer.stair.risers>2){const mesh=meshes.find(m=>m.name===`stair_stringer_${si+1}`)!;assert(mesh.vertices.length>8);for(let i=1;i<stringer.stair.risers;i++)assert(mesh.vertices.some(v=>Math.abs(v.y-(stringer.stair!.top-i*stringer.stair!.rise-1))<1e-6));}
  assert(meshes.some(m=>m.vertices.some(v=>v.y<0)));
  for(const mesh of meshes){assert(mesh.vertices.every(p=>[p.x,p.y,p.z].every(Number.isFinite)));for(const face of mesh.faces)assert(face.every(i=>Number.isInteger(i)&&i>=0&&i<mesh.vertices.length));}
  const obj=exportDeckOBJ(data,model),vertices=obj.split('\n').filter(l=>l.startsWith('v ')),objFaces=obj.split('\n').filter(l=>l.startsWith('f '));
  assert.equal(vertices.length,meshes.reduce((sum,m)=>sum+m.vertices.length,0));assert(objFaces.length>0);assert(!/NaN|Infinity/.test(obj));
  for(const face of objFaces)for(const index of face.slice(2).split(' ').map(Number))assert(index>=1&&index<=vertices.length);
  const dxf=exportDeckDXF(data,model),pairs=dxf.trim().split('\n');assert.equal(pairs.length%2,0);assert(dxf.endsWith('0\nEOF\n'));assert(dxf.includes('9\n$INSUNITS\n70\n1\n'));
  const faceCount=pairs.filter((v,i)=>i%2===1&&pairs[i-1]==='0'&&v==='3DFACE').length;assert.equal(faceCount,meshes.reduce((sum,m)=>sum+m.faces.reduce((n,f)=>n+f.length-2,0),0));
  assert(!/NaN|Infinity/.test(dxf));
});
console.log(`Deck design IO: ${checks} save, validation, price-isolation and CAD/model geometry checks passed.`);
