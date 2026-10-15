import assert from 'node:assert/strict';
import * as THREE from 'three';
import {coverInstances,pointInCover,clearCoverEdge,detailProfile} from '../src/features/deckcraft/components/viewer3d/groundCoverDetail';
import {createLandscapeSurfaceMaterial} from '../src/features/deckcraft/components/viewer3d/landscapeSurfaceMaterial';
import {LANDSCAPE_SURFACES} from '../src/features/deckcraft/landscapeSurfaces';
import {parseSiteInstruction} from '../src/features/deckcraft/designer/siteVoiceCommands';
import type {AgentSnapshot} from '../src/features/deckcraft/designer/deckAgentController';
import {newLandscapeObject} from '../src/features/deckcraft/landscapeCatalogue';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {ensureDesignExtensions} from '../src/features/deckcraft/designExtensions';
import {serializeDeckReleaseDesign,parseDeckReleaseDesign} from '../src/features/deckcraft/deckRelease';
import {encodeDesignLink,decodeDesignLink,designLinkFromHash} from '../src/features/deckcraft/designLink';
import {exportProjectBundle,importProjectBundle} from '../src/features/deckcraft/projectBundle';
import {landscapeTakeoff,landscapeQuoteSections} from '../src/features/deckcraft/landscapeModel';
let count=0;const ok=(v:unknown,message:string)=>{assert.ok(v,message);count++;};
const ring=[{x:0,z:0},{x:120,z:0},{x:120,z:120},{x:0,z:120}],hole=[{x:45,z:45},{x:75,z:45},{x:75,z:75},{x:45,z:75}],rings=[ring,hole];
const cells=[{polygon:ring.map(p=>({x:p.x,y:p.z})),plane:{x:.1,z:.2,constant:12}}],focus={x:60,z:60};
for(const surface of LANDSCAPE_SURFACES){
 const cup={x:24,z:24},items=coverInstances(surface.id,rings,cells,3,focus,144,2000,[cup]),p=detailProfile(surface.id);
 ok(items.length>0&&items.length<=2000,surface.id+' is bounded');
 assert.deepEqual(items,coverInstances(surface.id,rings,cells,3,focus,144,2000,[cup]));count++;
 ok(items.every(v=>pointInCover(v.x,v.z,rings)&&clearCoverEdge(v.x,v.z,rings,Math.max(v.width,v.depth)*.52)),surface.id+' respects holes and whole-particle edge clearance');
 ok(items.every(v=>Math.hypot(v.x-cup.x,v.z-cup.z)>=2.125+v.width*.6),surface.id+' keeps cups clear');
 ok(items.every(v=>Math.abs(v.y-(.1*v.x+.2*v.z+15.05+(p.kind==='blade'?0:v.height*.38)))<1e-8&&v.nx===-.1&&v.nz===-.2),surface.id+' follows the measured plane');
}
ok(coverInstances('river-rock-bed',[],[],3,focus,144,2000).length===0,'empty clipped areas have no geometry');
const brownMulch=createLandscapeSurfaceMaterial('mulch-bed'),blackMulch=createLandscapeSurfaceMaterial('black-mulch-bed');
ok(brownMulch.material.color.getHexString()==='ffffff'&&blackMulch.material.color.getHexString()==='2a2622','hardwood colour is in the fibre shader; black stays a dark multiply');
ok(LANDSCAPE_SURFACES.find(s=>s.id==='mulch-bed')!.color==='#73503a'&&LANDSCAPE_SURFACES.find(s=>s.id==='black-mulch-bed')!.color==='#34302b','planning swatches stay on the original colours');
brownMulch.dispose();blackMulch.dispose();
const a=createLandscapeSurfaceMaterial('river-rock-bed'),b=createLandscapeSurfaceMaterial('river-rock-bed');
ok(a.material!==b.material&&a.material.map===b.material.map,'materials stay viewer-local while maps are shared');
let disposed=0;for(const t of [a.material.map,a.material.normalMap,a.material.roughnessMap])t!.addEventListener('dispose',()=>disposed++);
a.dispose();ok(disposed===0,'one consumer cannot dispose shared textures');b.dispose();ok(disposed===3,'last consumer releases all maps');b.dispose();ok(disposed===3,'release is idempotent');
const load=THREE.TextureLoader.prototype.load,callbacks:((t:THREE.Texture)=>void)[]=[];
try{
 THREE.TextureLoader.prototype.load=function(_url,onLoad){callbacks.push(onLoad!);return new THREE.Texture();};
 const mulch=createLandscapeSurfaceMaterial('mulch-bed');mulch.loadPhotos(()=>{});const first=new THREE.Texture();let released=0;first.addEventListener('dispose',()=>released++);callbacks[0](first);mulch.dispose();ok(released===1,'partial asynchronous scan load is released on unmount');
 for(const callback of callbacks.slice(1)){const t=new THREE.Texture();t.addEventListener('dispose',()=>released++);callback(t);}ok(released===3,'late scan loads are released after unmount');
}finally{THREE.TextureLoader.prototype.load=load;}
const objects=LANDSCAPE_SURFACES.map((s,i)=>({...newLandscapeObject(s.id,'cover-'+i,i*144,360),widthIn:120,depthIn:120})),data={...structuredClone(DEFAULT_DECK),landscapeObjects:objects};
await ensureDesignExtensions(data);
for(const back of [parseDeckReleaseDesign(serializeDeckReleaseDesign(data)),await importProjectBundle(await exportProjectBundle(data)),await decodeDesignLink(designLinkFromHash(new URL(await encodeDesignLink(data,'http://localhost:4329')).hash)!)]){assert.deepEqual(back.landscapeObjects,objects);count++;}
for(const o of objects.slice(9)){const q=landscapeTakeoff([o]);ok(Math.abs((q.aggregateYd3??0)-100*3/324)<1e-8,'new aggregate uses area times selected depth');ok(landscapeQuoteSections([o],q).every(s=>s.amountCents===null),'new aggregate remains quote-required');ok(o.baseDepthIn===undefined,'base depth stays unresolved');}
for(const surface of LANDSCAPE_SURFACES.slice(9)){const parsed=parseSiteInstruction('set '+objects[0].name.toLowerCase()+' material to '+surface.name.toLowerCase(),{design:data} as unknown as AgentSnapshot);ok(parsed&&'command'in parsed&&parsed.command.type==='design.patch'&&parsed.command.patch.landscapeObjects?.[0].assetId===surface.id,'new material name works in command vocabulary');}
for(const [anisotropy,size] of [[4,128],[8,256],[16,512]]){const r=createLandscapeSurfaceMaterial('pea-gravel-bed',anisotropy);ok((r.material.map!.image as {width:number}).width===size,'map resolution follows the automatic quality tier');r.dispose();}
console.log(`GROUND COVER DETAIL OK — ${count} checks`);
