import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {deckExportMeshes} from '../src/features/deckcraft/designExports';
import {getFramelessSystem} from '../src/features/deckcraft/framelessSystems';
import {buildFramelessGeometry} from '../src/features/deckcraft/framelessGeometry';
import {polygonCut,signedArea} from '../src/features/deckcraft/lib/polygonCuts';
import type {Box} from '../src/features/deckcraft/deckTakeoff';
import type {DeckData} from '../src/features/deckcraft/types';

let checks=0;
const check=(name:string,fn:()=>void)=>{try{fn();checks++;console.log(`PASS ${name}`);}catch(e){throw new Error(name,{cause:e});}};
const fixture=(patch:Partial<DeckData>={}):DeckData=>({...structuredClone(DEFAULT_DECK),width:24,length:12,height:36,shape:'Rectangle',levels:1,deckType:'Attached',stairFlights:0,railingType:'Glass Panels',catalogueRailingId:'nv_spigot',...patch});
const outline=(b:Box)=>{const angle=b.angle??0,c=Math.cos(angle),s=Math.sin(angle);return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>({x:b.x+c*x*b.w/2+s*z*b.d/2,y:b.z-s*x*b.w/2+c*z*b.d/2}));};
for(const id of ['nv_spigot','tag_ninfa4']){
  check(`${id}: real system lookup and finite panel/mount geometry`,()=>{
    const data=fixture({catalogueRailingId:id}),system=getFramelessSystem(data)!;assert.ok(system);
    const model=buildDeckTakeoff(data);assert.ok(model.railing.frameless);assert.ok(model.railing.glass.length);assert.ok(model.railing.mounts.length);
    assert.equal(model.railing.posts.length,0);assert.equal(model.railing.rails.length,0);assert.equal(model.railing.balusters.length,0);assert.equal(model.quantities.railingPosts,0);
    for(const panel of model.railing.glass){assert.equal(panel.a.y,panel.b.y);assert.equal(panel.width,system.glassThicknessIn);assert.ok(Math.hypot(panel.b.x-panel.a.x,panel.b.z-panel.a.z)<=system.panelMaxIn);assert.equal(panel.depth,system.previewHeightIn-system.glassBottomIn);assert.ok([...Object.values(panel.a),...Object.values(panel.b),panel.width,panel.depth].every(Number.isFinite));}
    for(const mount of model.railing.mounts)assert.ok([mount.x,mount.y,mount.z,mount.w,mount.h,mount.d,mount.angle??0].every(Number.isFinite));
    if(system.mount==='spigot'){assert.equal(model.railing.spigotCount,model.railing.glass.length*2);assert.equal(model.railing.mounts.length,model.railing.glass.length*4);}
    else {assert.ok(model.railing.shoeLengthIn>0);assert.equal(model.railing.mounts.length,model.railing.glass.length);}
  });
  check(`${id}: removal updates shared panels, mounts and quantity scope`,()=>{
    const data=fixture({catalogueRailingId:id}),base=buildDeckTakeoff(data),section=base.railing.sections[0];
    const changed=buildDeckTakeoff({...data,removedRailingSections:[section.id]});
    assert.equal(changed.railing.glass.length,base.railing.glass.length-1);assert.ok(changed.railing.mounts.length<base.railing.mounts.length);assert.equal(changed.quantities.railingSections,base.quantities.railingSections-1);
    assert.ok(!changed.railing.glass.some(p=>p.assemblyId===section.id));
    const cleared=buildDeckTakeoff({...data,removedRailingSections:base.railing.sections.map(s=>s.id)});assert.equal(cleared.railing.glass.length,0);assert.equal(cleared.railing.mounts.length,0);assert.equal(cleared.quantities.railingLf,0);
    assert.deepEqual(buildDeckTakeoff(data).railing.glass,base.railing.glass);
  });
  check(`${id}: slope remains unresolved scope, not fake glass`,()=>{
    const data=fixture({catalogueRailingId:id,stairFlights:1,stairType:'Straight'}),model=buildDeckTakeoff(data);
    const slopes=model.railing.sections.filter(s=>s.enabled&&s.a.y!==s.b.y);assert.ok(slopes.length);assert.ok(model.railing.glass.every(p=>p.a.y===p.b.y));
    assert.ok(slopes.every(s=>model.railing.unmodeledSectionIds.includes(s.id)));assert.ok(model.quantities.stairRailingLf>0);assert.ok(model.issues.some(s=>s.includes('NOT drawn')));
  });
  check(`${id}: CAD contains exact shared glass/mount counts, no conventional guard solids`,()=>{
    const data=fixture({catalogueRailingId:id}),model=buildDeckTakeoff(data),meshes=deckExportMeshes(data,model);
    assert.equal(meshes.filter(m=>m.name.startsWith('frameless_glass_panel_envelope_')).length,model.railing.glass.length);
    assert.equal(meshes.filter(m=>m.name.startsWith('frameless_glass_mount_envelope_')).length,model.railing.mounts.length);
    assert.equal(meshes.filter(m=>/^(railing_post_|rail_|baluster_|glass_panel_)/.test(m.name)).length,0);
  });
  for(const shape of ['Rectangle','L-Shape','Multi-corner'] as const)check(`${id} / ${shape}: inset mounting envelopes supported and corners do not overlap`,()=>{
    const data=fixture({catalogueRailingId:id,shape,deckType:'Freestanding'}),model=buildDeckTakeoff(data),footprint=model.levels[0].footprint.outline;
    const mounts=getFramelessSystem(data)!.mount==='spigot'?model.railing.mounts.filter(p=>p.h===.25):model.railing.mounts;
    assert.ok(mounts.length);
    for(const mount of mounts){const polygon=outline(mount),inside=polygonCut([polygon],[footprint]).reduce((n,p)=>n+Math.abs(signedArea(p)),0);assert.ok(Math.abs(inside-Math.abs(signedArea(polygon)))<.001);}
    for(let i=0;i<mounts.length;i++)for(let j=i+1;j<mounts.length;j++)assert.ok(polygonCut([outline(mounts[i])],[outline(mounts[j])]).reduce((n,p)=>n+Math.abs(signedArea(p)),0)<.001,'Mount corners overlap');
    const panels=model.railing.glass.map(p=>({x:(p.a.x+p.b.x)/2,y:0,z:(p.a.z+p.b.z)/2,w:Math.hypot(p.b.x-p.a.x,p.b.z-p.a.z),h:1,d:p.width,angle:-Math.atan2(p.b.z-p.a.z,p.b.x-p.a.x)}));
    for(let i=0;i<panels.length;i++)for(let j=i+1;j<panels.length;j++)assert.ok(polygonCut([outline(panels[i])],[outline(panels[j])]).reduce((n,p)=>n+Math.abs(signedArea(p)),0)<.001,'Glass corners overlap');
  });
  check(`${id}: interior bays retain stationing after inward setback`,()=>{
    const model=buildDeckTakeoff(fixture({catalogueRailingId:id})),sections=model.railing.sections.filter(s=>s.a.z===144&&s.b.z===144).sort((a,b)=>Math.min(a.a.x,a.b.x)-Math.min(b.a.x,b.b.x));
    assert.ok(sections.length>2);
    for(const section of sections.slice(1,-1)){const p=model.railing.glass.find(p=>p.assemblyId===section.id)!;assert.ok(p);assert.equal(p.a.z,141);assert.equal(p.b.z,141);assert.ok(Math.abs((p.a.x+p.b.x)/2-(section.a.x+section.b.x)/2)<.001);}
  });
}
check('winder horizontal end segments are unresolved too',()=>{
  const model=buildDeckTakeoff(fixture({height:80,stairFlights:1,stairType:'Winder'}));
  assert.ok(model.railing.unmodeledSectionIds.length);assert.ok(model.railing.sections.some(s=>s.a.y===s.b.y&&model.railing.unmodeledSectionIds.includes(s.id)));
});
check('short run leaves explicit unresolved mounting scope',()=>{
  const system=getFramelessSystem(fixture())!,result=buildFramelessGeometry([{id:'tiny',label:'Tiny',a:{x:0,y:36,z:0},b:{x:3,y:36,z:0},enabled:true,lengthIn:3}],system);
  assert.equal(result.glass.length,0);assert.equal(result.mounts.length,0);assert.deepEqual(result.unmodeledSectionIds,['tiny']);
});
check('conventional glass remains unchanged and None cannot leave a frameless remnant',()=>{
  const standard=buildDeckTakeoff(fixture({catalogueRailingId:undefined}));assert.ok(!standard.railing.frameless);assert.ok(standard.railing.posts.length);assert.ok(standard.railing.rails.length);assert.equal(standard.railing.mounts.length,0);
  const none=buildDeckTakeoff(fixture({railingType:'None'}));assert.ok(!none.railing.frameless);assert.equal(none.railing.glass.length,0);assert.equal(none.railing.mounts.length,0);
});
console.log(`DECK FRAMELESS OK — ${checks} shared geometry, removal, unresolved-scope and export checks.`);
