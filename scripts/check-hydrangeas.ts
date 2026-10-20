/**
 * Hydrangea pilot (2026-10-20): Limelight, Annabelle and Endless Summer are built in-repo to their botany, with flower
 * heads made of real-photo florets. Sizes are checked against the sourced ranges in
 * docs/deckcraft/hydrangeas-2026-10-20/research/botany.md, not against the builder's own table, and every texture must
 * trace to a CC0 photo.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {LANDSCAPE_SPECIES,PLANT_LIBRARY,newLandscapePlant} from '../src/features/deckcraft/landscapeCatalogue';
import {HYDRANGEA_TRIANGLES,hydrangeaCultivar,hydrangeaTriangleCounts,type HydrangeaCultivar} from '../src/features/deckcraft/hydrangeaCultivars';
import {buildHydrangea,hydrangeaLod,hydrangeaTriangles,type HydrangeaPlant} from '../src/features/deckcraft/components/viewer3d/hydrangea/hydrangeaModel';
import {HYDRANGEA_FILL,HYDRANGEA_TEXTURES} from '../src/features/deckcraft/components/viewer3d/hydrangea/hydrangeaTextures';
import {landscapeRenderLods} from '../src/features/deckcraft/landscapeModelRuntime';

let checks=0;
const ok=(value:unknown,message:string)=>{assert.ok(value,message);checks++;};
const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/Math.max(1,xs.length);
const within=(x:number,[lo,hi]:[number,number])=>x>=lo&&x<=hi;

// Sourced ranges (research/botany.md): leaf blade length and width, head length (along its axis) and width, sterile floret diameter, inches.
const BOTANY:Record<HydrangeaCultivar,{species:string;leafL:[number,number];leafW:[number,number];headL:[number,number];headW:[number,number];floret:[number,number];shape:'panicle'|'dome'}>={
 limelight:{species:'hydrangea-paniculata',leafL:[3,6],leafW:[1.5,3],headL:[6,12],headW:[4.7,7],floret:[1.1,1.85],shape:'panicle'},
 annabelle:{species:'hydrangea-arborescens-annabelle',leafL:[3,8],leafW:[2,6],headL:[3,9],headW:[6,12],floret:[.5,1.2],shape:'dome'},
 'endless-summer':{species:'hydrangea-macrophylla-endless-summer',leafL:[4,8],leafW:[3,6],headL:[2,7.5],headW:[3,10],floret:[.8,1],shape:'dome'},
};

// 1. Species and catalogue.
for(const [cultivar,b] of Object.entries(BOTANY) as [HydrangeaCultivar,typeof BOTANY[HydrangeaCultivar]][])ok(hydrangeaCultivar(b.species)===cultivar,`${b.species} draws as ${cultivar}`);
ok(hydrangeaCultivar('syringa-vulgaris')===undefined&&hydrangeaCultivar(undefined)===undefined,'Other species keep their own models');
const es=LANDSCAPE_SPECIES.find(s=>s.id==='hydrangea-macrophylla-endless-summer');
ok(es&&/Endless Summer/.test(es.commonName)&&es.sourceURL.startsWith('https://endlesssummerhydrangeas.com/')&&es.matureHeightIn[0]===36&&es.matureHeightIn[1]===60&&/pink/i.test(es.sourceNote),'Endless Summer is a sourced species, pink in Ontario soil');
const esVisual=PLANT_LIBRARY.find(p=>p.speciesId==='hydrangea-macrophylla-endless-summer');
ok(esVisual?.group==='Shrubs'&&esVisual.assetId==='rounded-shrub'&&PLANT_LIBRARY.length===27,'Endless Summer is in the Shrubs palette on the saved shrub asset');

// 2. Built to botany, at each cultivar's palette size.
const plants=new Map<HydrangeaCultivar,HydrangeaPlant>();
for(const [cultivar,b] of Object.entries(BOTANY) as [HydrangeaCultivar,typeof BOTANY[HydrangeaCultivar]][]){
 const o=newLandscapePlant(b.species,'check-'+cultivar);
 const plant=buildHydrangea(cultivar,o);plants.set(cultivar,plant);
 ok(plant.canes.length>=8&&plant.heads.length>=8,`${cultivar}: a multi-stemmed shrub with a head per flowering cane`);
 ok(within(mean(plant.leaves.map(l=>l.bladeIn)),b.leafL)&&within(mean(plant.leaves.map(l=>l.widthIn)),b.leafW),`${cultivar}: leaves are real size (${mean(plant.leaves.map(l=>l.bladeIn)).toFixed(2)} in)`);
 const nodes=new Map<string,number>();for(const l of plant.leaves)nodes.set(l.node,(nodes.get(l.node)??0)+1);
 ok([...nodes.values()].every(n=>n===2||(cultivar==='limelight'&&n===3)),`${cultivar}: leaves are opposite pairs${cultivar==='limelight'?' (or whorls of 3)':''}`);
 ok(plant.heads.every(h=>h.shape===b.shape),`${cultivar}: ${b.shape} heads`);
 ok(within(mean(plant.heads.map(h=>h.lengthIn)),b.headL)&&within(mean(plant.heads.map(h=>h.widthIn)),b.headW),`${cultivar}: heads are real size (${mean(plant.heads.map(h=>h.widthIn)).toFixed(1)} in wide)`);
 ok(within(mean(plant.florets.map(f=>f.sizeIn)),b.floret),`${cultivar}: florets are real size (${mean(plant.florets.map(f=>f.sizeIn)).toFixed(2)} in)`);
 const perHead=plant.florets.length/plant.heads.length;
 ok(perHead>=60,`${cultivar}: each head is built of many florets (${perHead.toFixed(0)})`);
 const reach=Math.max(...plant.bounds.map(([x,,z])=>Math.hypot(x,z))),top=Math.max(...plant.bounds.map(p=>p[1]));
 ok(reach<=Math.max(o.widthIn,o.depthIn)/2*1.12&&top<=o.heightIn*1.08&&top>=o.heightIn*.85,`${cultivar}: fills its ${o.widthIn} x ${o.heightIn} in envelope (reach ${reach.toFixed(1)}, top ${top.toFixed(1)})`);
 const again=buildHydrangea(cultivar,o),other=buildHydrangea(cultivar,{...o,id:'check-other'});
 ok(JSON.stringify(again)===JSON.stringify(plant)&&JSON.stringify(other.florets[0])!==JSON.stringify(plant.florets[0]),`${cultivar}: the same plant always builds the same, and neighbours differ`);
 // Distance detail: fewer, larger cards cover about the same area.
 const lod0=hydrangeaLod(plant,0),lod1=hydrangeaLod(plant,1),lod2=hydrangeaLod(plant,2),area=(fs:{sizeIn:number}[])=>fs.reduce((a,f)=>a+f.sizeIn**2,0);
 ok(lod1.florets.length<=lod0.florets.length/4&&lod2.florets.length<lod1.florets.length&&Math.abs(area(lod1.florets)/area(lod0.florets)-1)<.35&&Math.abs(area(lod2.florets)/area(lod0.florets)-1)<.45,`${cultivar}: distant heads use fewer cluster cards over the same area`);
 ok(lod1.leaves.length<lod0.leaves.length&&lod2.leaves.length<lod1.leaves.length,`${cultivar}: distant leaves thin out`);
 const counts=[0,1,2].map(l=>hydrangeaTriangles(plant,l as 0|1|2));
 ok(counts[0]>counts[1]&&counts[1]>counts[2]&&counts.every((n,i)=>Math.abs(n/HYDRANGEA_TRIANGLES[cultivar][i]-1)<.3),`${cultivar}: triangle costs ${counts.join('/')} match the level-of-detail table`);
}
ok(mean(plants.get('annabelle')!.canes.map(c=>c.tipLeanDeg))>mean(plants.get('limelight')!.canes.map(c=>c.tipLeanDeg))+10,'Annabelle canes arch and flop under their heads; Limelight stands upright');
ok(mean(plants.get('limelight')!.florets.map(f=>f.color[1]-f.color[2]))>0&&mean(plants.get('endless-summer')!.florets.map(f=>f.color[0]-f.color[1]))>.1,'Limelight florets are lime-white; Endless Summer florets are pink');

// 3. Level of detail is costed per species.
ok(hydrangeaTriangleCounts('hydrangea-paniculata')===HYDRANGEA_TRIANGLES.limelight&&hydrangeaTriangleCounts('acer-rubrum')===undefined,'Hydrangea triangle costs come from the hydrangea table');
{
 const near=newLandscapePlant('hydrangea-arborescens-annabelle','near',0,120),lods=landscapeRenderLods([near],{x:0,y:5,z:0},900,'high');
 ok(lods.get('near')===0,'A close hydrangea on a high-tier screen draws its full florets');
 const crowd=Array.from({length:120},(_,i)=>newLandscapePlant('hydrangea-arborescens-annabelle','c'+i,(i%12)*48,120+Math.floor(i/12)*48));
 const many=landscapeRenderLods(crowd,{x:240,y:5,z:0},900,'high');
 ok([...many.values()].filter(l=>l===0).length<crowd.length,'A crowd of hydrangeas stays inside the near-detail triangle budget');
}

// 4. Textures trace to CC0 photos.
const manifestPath='public/deckcraft/landscape/hydrangea/SOURCES.json';
ok(existsSync(manifestPath),'The hydrangea texture manifest is published');
const manifest=JSON.parse(readFileSync(manifestPath,'utf8')) as {photos:{photoId:number;url:string;observationUrl:string;observer:string;licence:string;use:string}[];textures:{file:string;sha256:string;photoIds:number[]}[]};
ok(manifest.photos.length>=6&&manifest.photos.every(p=>p.licence==='cc0'&&/^https:\/\/inaturalist-open-data\.s3\.amazonaws\.com\/photos\/\d+\/original\.(jpe?g|png)$/.test(p.url)&&p.url.includes('/'+p.photoId+'/')&&/^https:\/\/www\.inaturalist\.org\/observations\/\d+$/.test(p.observationUrl)&&p.observer),'Every source photo is an iNaturalist CC0 original with its observation and observer');
for(const t of manifest.textures){
 const path='public/deckcraft/landscape/hydrangea/'+t.file;
 ok(existsSync(path)&&createHash('sha256').update(readFileSync(path)).digest('hex')===t.sha256,`${t.file} is the file the manifest describes`);
 ok(t.photoIds.length>0&&t.photoIds.every(id=>manifest.photos.some(p=>p.photoId===id)),`${t.file} is made only from listed CC0 photos`);
}
ok(readdirSync('public/deckcraft/landscape/hydrangea').filter(f=>f!=='SOURCES.json').every(f=>manifest.textures.some(t=>t.file===f)),'Every file published beside the hydrangea textures is in the manifest');
for(const [atlas,file] of [['florets','florets.webp'],['leaves','leaves.webp']] as const)ok(JSON.stringify((manifest.textures.find(t=>t.file===file) as unknown as {fill:unknown}).fill)===JSON.stringify(HYDRANGEA_FILL[atlas]),`The renderer sizes ${atlas} cards from the cut-outs' measured fill`);
for(const url of Object.values(HYDRANGEA_TEXTURES))ok(manifest.textures.some(t=>url.endsWith('/hydrangea/'+t.file)),`${url} is in the manifest`);
const attribution=readFileSync('public/deckcraft/landscape/ATTRIBUTION.md','utf8');
ok(/hydrangea/i.test(attribution)&&attribution.includes('SOURCES.json'),'The landscape attribution page points to the hydrangea photo sources');

// 5. Wiring: the hydrangea species leave the shared shrub model and the generic flower cards.
const scene=readFileSync('src/features/deckcraft/components/viewer3d/Landscape3D.tsx','utf8');
ok(/const Hydrangeas3D=lazy\(\(\)=>import\('\.\/hydrangea\/Hydrangeas3D'\)\)/.test(scene)&&/<Hydrangeas3D /.test(scene),'The landscape draws hydrangeas with their own models, loaded only when a design has one');
ok(/hydrangeaCultivar\(o\.speciesRecord\?\.id\)/.test(scene),'Hydrangea plants are kept out of the shared shrub instances and the generic flower cards');

// 6. Seasons: the hydrangeas take the scene's season (bare canes holding dried heads in winter, no heads in spring) and
// are left out of the generic season stems, which would draw a second set of canes.
ok(/<PlantStems data=\{data\} objects=\{others\}/.test(scene)&&/<Hydrangeas3D [^>]*season=\{season\}/.test(scene),'Hydrangeas follow the season and are not given the generic season stems');
const renderer=readFileSync('src/features/deckcraft/components/viewer3d/hydrangea/Hydrangeas3D.tsx','utf8');
for(const cultivar of ['limelight','annabelle',"'endless-summer'"])ok(new RegExp(`${cultivar}:\{spring:\{leaves:'#[0-9a-f]{6}',heads:null\},summer:\{leaves:'summer',heads:'summer'\},fall:\{leaves:'#[0-9a-f]{6}',heads:'#[0-9a-f]{6}'\},winter:\{leaves:null,heads:'#[0-9a-f]{6}'\}\}`).test(renderer),`${cultivar}: fresh leaves and no heads in spring, fall colour, bare canes with dried heads in winter`);
console.log(`check-hydrangeas: ${checks} checks passed`);
