import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import * as THREE from 'three';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {newLandscapeObject,newLandscapePlant} from '../src/features/deckcraft/landscapeCatalogue';
import {landscapeBedAreas,landscapePlacement,landscapeTakeoff,landscapeQuoteSections} from '../src/features/deckcraft/landscapeModelRuntime';
import {ensureDesignExtensions} from '../src/features/deckcraft/designExtensions';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {exportDeckDXF,exportDeckOBJ} from '../src/features/deckcraft/designExports';
import {landscapeSurfaceCells} from '../src/features/deckcraft/landscapeSurfaceGeometry';
import {LANDSCAPE_SURFACES} from '../src/features/deckcraft/landscapeSurfaces';
import {BED_RELIEF,bedReliefGeometry,bedReliefs,drapedBed,FLUSH_EDGING,flushEdgingPoints,inRings,reliefGround} from '../src/features/deckcraft/components/viewer3d/bedRelief';
import {PLANT_SEAT,plantSeats,STEM_OFFSET,stemCentre,stemRadiusIn} from '../src/features/deckcraft/components/viewer3d/plantSeating';
import {chipClearance,collarFit,collarGeometry,COLLAR_SIDES,SHADE_RING,shadeRingMatrix,shadeRingRadiusIn} from '../src/features/deckcraft/components/viewer3d/plantContactDecals';
import {MULCH_FIBRE_MEAN,MULCH_SCAN_MEAN,mulchPhotoColor,mulchSwatch} from '../src/features/deckcraft/components/viewer3d/landscapeSurfaceMaterial';
import {coverInstances} from '../src/features/deckcraft/components/viewer3d/groundCoverDetail';
import {steelEdgingGeometry} from '../src/features/deckcraft/components/viewer3d/Landscape3D';
import type {LandscapeObject,LandscapePoint} from '../src/features/deckcraft/landscapeTypes';
import type {DeckData} from '../src/features/deckcraft/types';

/**
 * Plants sit in beds (R-P1), render only:
 * - a plain mulch or stone bed draws its top at grade + 1 in, with a 4 in spade-cut taper from grade + 0.4 in along edges
 *   that meet lawn (soil on its lower third), and no cut against another bed or within 3 in of a structure;
 * - plants stand in that top, sunk by form (trees 0, shrubs ½ in, perennials ¾ in), with a soil collar and a mulch lip;
 * - every plant has a soft shade ring, Photo mode skips it, and nothing casts a new shadow;
 * - steel edging on plain beds stands ½ in proud of the ground along the whole outline, on a slope too;
 * - brown, black and cedar mulch each average to their own swatch, in the raster view and in Photo mode;
 * - none of it reaches saved designs, quantities, quote lines or OBJ/DXF exports.
 */
let checks=0;const ok=(v:unknown,label:string)=>{assert.ok(v,label);checks++;};
const near=(a:number,b:number,tol:number,label:string)=>ok(Math.abs(a-b)<=tol,`${label}: ${a} vs ${b} (±${tol})`);
const source=(p:string)=>readFileSync(p,'utf8');
const rect=(id:string,asset:LandscapeObject['assetId'],x0:number,z0:number,x1:number,z1:number,extra:Partial<LandscapeObject>={})=>({...newLandscapeObject(asset,id,(x0+x1)/2,(z0+z1)/2),polygon:[{x:x0,z:z0},{x:x1,z:z0},{x:x1,z:z1},{x:x0,z:z1}],...extra}) as LandscapeObject;
const circle=(id:string,cx:number,cz:number,r:number)=>({...newLandscapeObject('black-mulch-bed',id,cx,cz),polygon:Array.from({length:24},(_,i)=>({x:cx+Math.cos(i/24*Math.PI*2)*r,z:cz+Math.sin(i/24*Math.PI*2)*r}))}) as LandscapeObject;
const ringArea=(rings:LandscapePoint[][])=>Math.abs(rings.reduce((n,p)=>n+p.reduce((m,a,i)=>{const b=p[(i+1)%p.length];return m+a.x*b.z-b.x*a.z;},0)/2,0));
function drawn(g:THREE.BufferGeometry){const p=g.getAttribute('position');let area=0;for(let i=0;i<p.count;i+=3){const ax=p.getX(i),az=p.getZ(i),bx=p.getX(i+1),bz=p.getZ(i+1),cx=p.getX(i+2),cz=p.getZ(i+2);area+=Math.abs((bx-ax)*(cz-az)-(bz-az)*(cx-ax))/2*144;}return area;}

// The default design: house x −66…258, z −192…0; deck x 0…192, z 0…144; stairs x 72…120, z 145…188.
const beds:LandscapeObject[]=[
 rect('lone','mulch-bed',300,220,396,280),
 rect('house','mulch-bed',-60,0,-12,60),
 rect('left','mulch-bed',420,220,516,280),rect('right','cedar-mulch-bed',516,220,612,280),
 rect('holed','mulch-bed',500,320,700,440),rect('island','river-rock-bed',580,360,620,400),
 circle('curved',300,420,48),
 rect('edged','mulch-bed',-200,220,-104,280,{edging:true}),
 rect('raised','mulch-bed',-200,320,-104,380,{raisedIn:12}),
 rect('turf','artificial-grass',-200,420,-104,480),
 rect('covers-stairs','mulch-bed',50,140,150,200,{groundCoverOnly:true}),
];
const plants:LandscapeObject[]=[
 newLandscapePlant('buxus-microphylla','shrub-in-bed',348,250),
 newLandscapePlant('hosta','hosta-at-edge',348,222.5),
 newLandscapePlant('hosta','hosta-in-raised',-152,350),
 newLandscapePlant('hosta','hosta-raised-edge',-196,350),
 newLandscapePlant('calamagrostis-karl-foerster','grass-in-turf',-152,450),
 newLandscapePlant('acer-saccharum','tree-in-lawn',300,640),
 newLandscapePlant('hosta','hosta-curved',300,420),
];
const objects=[...beds,...plants];
const flat={...DEFAULT_DECK,landscapeObjects:objects} as DeckData;
const sloped={...DEFAULT_DECK,landscapeObjects:objects,siteModel:{version:1,points:[{id:'a',xIn:-400,zIn:-300,elevationIn:0},{id:'b',xIn:900,zIn:-300,elevationIn:30},{id:'c',xIn:-400,zIn:800,elevationIn:70},{id:'d',xIn:900,zIn:800,elevationIn:44},{id:'e',xIn:340,zIn:260,elevationIn:31}],grading:[]}} as DeckData;
for(const data of [flat,sloped])await ensureDesignExtensions(data);
const savedJson=JSON.stringify(objects),takeoffBefore=JSON.stringify(landscapeTakeoff(objects,flat)),quoteBefore=JSON.stringify(landscapeQuoteSections(objects,landscapeTakeoff(objects,flat))),placementsBefore=JSON.stringify(objects.map(o=>landscapePlacement(sloped,o)));
const model=buildDeckTakeoff(flat),objBefore=exportDeckOBJ(flat,model),dxfBefore=exportDeckDXF(flat,model);

for(const [label,data] of [['flat',flat],['sloped',sloped]] as const){
 const areas=landscapeBedAreas(objects,data),reliefs=bedReliefs(data,objects,areas),ground=reliefGround(data);
 ok([...reliefs.keys()].sort().join()===beds.filter(drapedBed).map(b=>b.id).sort().join(),`${label}: plain mulch and stone beds are drawn as a relief; raised and turf beds are not`);
 const cut=(id:string,x:number,z:number)=>reliefs.get(id)!.cutDistance(x,z)<.01;
 ok(cut('lone',348,220)&&cut('lone',300,250)&&cut('lone',396,250)&&cut('lone',348,280),`${label}: a bed in the lawn is cut on every side`);
 ok(!cut('house',-36,0)&&cut('house',-36,60)&&cut('house',-60,30)&&cut('house',-12,30),`${label}: no cut against the house wall; the cut runs along the lawn sides (12 in from the deck too)`);
 ok(!cut('left',516,250)&&!cut('right',516,250)&&cut('left',420,250)&&cut('right',612,250),`${label}: two beds that touch share an uncut edge`);
 ok(!cut('holed',580,380)&&!cut('holed',600,360)&&cut('holed',500,380),`${label}: the edge around another bed inside a bed is not cut`);
 ok(!cut('covers-stairs',96,188.5)&&!cut('covers-stairs',60,144),`${label}: a ground-cover bed is not cut where it meets the stairs or the deck`);
 for(const r of reliefs.values()){
  const g=bedReliefGeometry(data,r),p=g.getAttribute('position'),c=g.getAttribute('color'),bed=ringArea(r.polys);
  near(drawn(g)/bed,1,.005,`${label} ${r.object.id}: drawn area equals the bed's area`);
  let plateau=0,low=Infinity,soil=0,soilBad=0,riseBad=0;
  for(let i=0;i<p.count;i++){const x=p.getX(i)*12,z=p.getZ(i)*12,above=p.getY(i)*12-ground.height(x,z);low=Math.min(low,above);if(Math.abs(above-r.rise(x,z))>.02)riseBad++;if(r.cutDistance(x,z)>=BED_RELIEF.taperIn-1e-6&&Math.abs(above-BED_RELIEF.topIn)<1e-3)plateau++;if(c.getX(i)!==1){soil++;if(r.cutDistance(x,z)>BED_RELIEF.taperIn*BED_RELIEF.soilShare+.06)soilBad++;}}
  ok(riseBad===0,`${label} ${r.object.id}: every vertex is on the ground's face plus the drawn rise`);
  ok(plateau>0&&low>=.25,`${label} ${r.object.id}: the top is grade + 1 in, and the cut stays at least 0.25 in above the ground (lowest ${low.toFixed(3)})`);
  ok((r.tapered.length>0)===(soil>0)&&soilBad===0,`${label} ${r.object.id}: soil colours only the cut's lower third`);
  ok(p.count/3<=260+(data===sloped?200:0),`${label} ${r.object.id}: the relief stays within its triangle budget (${p.count/3})`);
  g.dispose();
 }
 // Mulch top: at least ¾ in above grade and below the 90th-percentile grass tip (GrassBlades: blade 0.7–0.98 × tuft 1.3–2.4).
 const tips:number[]=[];for(let b=0;b<9;b++)for(let u=0;u<=100;u++)tips.push((.7+b*.035)*(1.3+u/100*1.1));tips.sort((a,b)=>a-b);
 ok(BED_RELIEF.topIn>=.75&&BED_RELIEF.topIn<=tips[Math.floor(tips.length*.9)],`${label}: the mulch top sits between ¾ in and the grass tips`);
 // Seats.
 const seats=plantSeats(data,objects,reliefs),seat=(id:string)=>seats.get(id)!,base=(id:string)=>landscapePlacement(data,objects.find(o=>o.id===id)!).y*12+seat(id).dyIn;
 near(base('shrub-in-bed'),ground.height(348,250)+BED_RELIEF.topIn-PLANT_SEAT.shrub.sinkIn,.01,`${label}: a shrub sits ½ in into the mulch top`);
 const edge=seat('hosta-at-edge');near(base('hosta-at-edge'),ground.height(348,222.5)+reliefs.get('lone')!.rise(348,222.5)-PLANT_SEAT.perennial.sinkIn,.01,`${label}: near a cut edge a perennial sits ¾ in into the cut's height`);ok(edge.surfaceIn<ground.height(348,222.5)+BED_RELIEF.topIn-.1,`${label}: the cut's height is used near the edge`);
 const raisedPlant=objects.find(o=>o.id==='hosta-in-raised')!;near(base('hosta-in-raised'),landscapePlacement(data,raisedPlant).y*12-PLANT_SEAT.perennial.sinkIn,.01,`${label}: a raised bed keeps its soil-top rule, minus the sink`);ok(seat('hosta-in-raised').raised&&seat('hosta-in-raised').bed?.id==='raised',`${label}: raised-bed plants get the raised bed's collars`);
 ok(seat('grass-in-turf').dyIn===0&&!seat('grass-in-turf').bed,`${label}: a plant in artificial turf stays at grade, with no collar`);
 ok(seat('tree-in-lawn').dyIn===0&&!seat('tree-in-lawn').bed&&seat('tree-in-lawn').form==='tree',`${label}: a lawn tree stays at grade (a shade ring only)`);
 ok(seat('hosta-curved').bed?.id==='curved',`${label}: membership follows the drawn (curved) bed`);
 // Collars, lips, rings.
 const inLone=[...seats].filter(([,s])=>s.bed?.id==='lone').map(([id,s])=>({object:objects.find(o=>o.id===id)!,seat:s})),lonePolys=reliefs.get('lone')!.polys,cg=collarGeometry(data,inLone,new THREE.Color(1,0,0),lonePolys,reliefs.get('lone'));
 ok(cg.getAttribute('position').count/3===inLone.filter(p=>collarFit(p.object,p.seat,lonePolys)).length*COLLAR_SIDES*5,`${label}: one collar and lip per fitting bed plant`);
 {const p=cg.getAttribute('position');let outside=0;for(let i=0;i<p.count;i++)if(!inRings(p.getX(i)*12,p.getZ(i)*12,reliefs.get('lone')!.polys)&&!inRings(p.getX(i)*12+.05,p.getZ(i)*12+.05,reliefs.get('lone')!.polys))outside++;ok(outside===0,`${label}: collars and lips stay inside their bed`);}
 const shrubFit=collarFit(objects[beds.length],seat('shrub-in-bed'),lonePolys)!;near(shrubFit[0],stemRadiusIn(objects[beds.length])+PLANT_SEAT.shrub.pullIn,1e-9,`${label}: the mulch is pulled back 2 in from a shrub's stems`);near(shrubFit[1]-shrubFit[0],1.75,1e-9,`${label}: the lip is 1¾ in wide`);
 const tree=objects.find(o=>o.id==='tree-in-lawn')!,rm=shadeRingMatrix(data,tree,seat('tree-in-lawn')),rp=new THREE.Vector3(),rs=new THREE.Vector3();rm.decompose(rp,new THREE.Quaternion(),rs);
 near(rs.x*12,stemRadiusIn(tree)+SHADE_RING.treeReachIn,1e-6,`${label}: a tree's shade ring reaches 10 in past its trunk`);near(rp.x*12,stemCentre(tree).x,1e-6,`${label}: the ring is centred on the trunk, not the canopy's envelope`);
 ok(shadeRingRadiusIn(objects.find(o=>o.id==='hosta-at-edge')!,edge)<=SHADE_RING.lowMaxIn,`${label}: a low plant's ring is at most 30 in`);
 // A raised bed's collars stay inside its wall too, even for a plant 4 in from its edge.
 const raisedPolys=areas.get('raised')!,inRaised=[...seats].filter(([,s])=>s.bed?.id==='raised').map(([id,s])=>({object:objects.find(o=>o.id===id)!,seat:s})),rg=collarGeometry(data,inRaised,new THREE.Color(1,0,0),raisedPolys);
 {const p=rg.getAttribute('position');let outside=0;for(let i=0;i<p.count;i++)if(!inRings(p.getX(i)*12,p.getZ(i)*12,raisedPolys)&&!inRings(p.getX(i)*12+.05,p.getZ(i)*12+.05,raisedPolys))outside++;ok(inRaised.length===2&&outside===0,`${label}: raised-bed collars stay inside the bed's wall`);}
 // Chips keep off the cut's soil and the collars, and sit on the drawn top.
 const lone=reliefs.get('lone')!,clearance=chipClearance(lone,inLone,lone.polys)!,cells=landscapeSurfaceCells(data,lone.polys),chips=coverInstances('mulch-bed',lone.polys,cells,3,{x:348,z:250},216,6000,[],clearance);
 ok(chips.length>500,`${label}: chips cover the bed (${chips.length})`);
 ok(chips.every(c=>lone.cutDistance(c.x,c.z)>=BED_RELIEF.taperIn*BED_RELIEF.soilShare),`${label}: no chip on the cut's soil`);
 ok(chips.every(c=>inLone.every(p=>Math.hypot(c.x-p.seat.x,c.z-p.seat.z)>=(collarFit(p.object,p.seat,lone.polys)?.[1]??0))),`${label}: no chip on a collar or lip`);
 ok(chips.every(c=>Math.abs(c.y-c.height*.38-(ground.height(c.x,c.z)+lone.rise(c.x,c.z)))<.02),`${label}: chips sit on the drawn top`);
 const time=(f:()=>void)=>{const runs:number[]=[];for(let i=0;i<7;i++){const t=performance.now();f();runs.push(performance.now()-t);}return runs.sort((a,b)=>a-b)[3];};
 const plain=time(()=>coverInstances('mulch-bed',lone.polys,cells,3,{x:348,z:250},216,6000)),withClearance=time(()=>coverInstances('mulch-bed',lone.polys,cells,3,{x:348,z:250},216,6000,[],clearance));
 ok(withClearance<=plain*1.25+2,`${label}: chip layout stays about as fast (${plain.toFixed(1)} → ${withClearance.toFixed(1)} ms)`);
 // Flush edging: ½ in proud of the ground along the whole outline, on a slope too (split at the ground's face edges).
 const edged=landscapeBedAreas(objects,data).get('edged')![0],points=flushEdgingPoints(data,edged),ribbon=steelEdgingGeometry(points),rise=4;
 let worst=0;for(let i=0;i+1<points.length;i++)for(let t=0;t<=1;t+=.125){const x=(points[i].x+(points[i+1].x-points[i].x)*t)*12,z=(points[i].z+(points[i+1].z-points[i].z)*t)*12,y=(points[i].y+(points[i+1].y-points[i].y)*t)*12+rise;worst=Math.max(worst,Math.abs(y-(ground.height(x,z)+FLUSH_EDGING.proudIn)));}
 ok(worst<=.05,`${label}: steel edging stands ½ in above the ground everywhere (worst ${worst.toFixed(4)} in)`);ribbon.dispose();
 // An edging run (the outline less a stretch shared with a bed of the same surface) stays open, end to end.
 const run=edged.slice(0,3),open=flushEdgingPoints(data,run,false),end=open.at(-1)!,whole=flushEdgingPoints(data,[...edged,edged[0]],false);
 ok(Math.abs(open[0].x*12-run[0].x)<1e-6&&Math.abs(open[0].z*12-run[0].z)<1e-6&&Math.abs(end.x*12-run[2].x)<1e-6&&Math.abs(end.z*12-run[2].z)<1e-6,`${label}: an open edging run starts and ends at its own ends`);
 ok(open.every(p=>Math.abs(p.y*12+rise-(ground.height(p.x*12,p.z*12)+FLUSH_EDGING.proudIn))<.05),`${label}: an open edging run stands ½ in above the ground too`);
 ok(whole.length===points.length&&whole.every((p,i)=>p.distanceTo(points[i])<1e-9),`${label}: a run that goes all the way round is the closed ring's edging`);
}
ok(FLUSH_EDGING.buryIn+FLUSH_EDGING.proudIn===4,'The 4 in ribbon is buried 3½ in');

// Nothing in data moves.
ok(JSON.stringify(objects)===savedJson,'Seats, reliefs and collars never change the saved objects');
ok(JSON.stringify(landscapeTakeoff(objects,flat))===takeoffBefore&&JSON.stringify(landscapeQuoteSections(objects,landscapeTakeoff(objects,flat)))===quoteBefore,'Bed quantities and quote lines are unchanged');
ok(JSON.stringify(objects.map(o=>landscapePlacement(sloped,o)))===placementsBefore,'landscapePlacement is unchanged');
ok(exportDeckOBJ(flat,model)===objBefore&&exportDeckDXF(flat,model)===dxfBefore,'OBJ and DXF exports are byte-identical');
const exportsSrc=source('src/features/deckcraft/designExports.ts');ok(!/bedRelief|plantSeating|plantContactDecals/.test(exportsSrc),'Exports never import the render-only bed relief');

// Mulch colour: each product averages to its own swatch (photo scan and the procedural fallback), and they differ.
const lin=(c:number)=>{c/=255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);};
const {data:scan,info}=await sharp('public/deckcraft/landscape/mulch-diffuse.jpg').raw().toBuffer({resolveWithObject:true});
let sr=0,sg=0,sb=0;for(let i=0;i<scan.length;i+=info.channels){sr+=lin(scan[i]);sg+=lin(scan[i+1]);sb+=lin(scan[i+2]);}const n=info.width*info.height;
near(sr/n,MULCH_SCAN_MEAN.rgb[0],.002,'The recorded scan mean is the scan’s (red)');near(sg/n,MULCH_SCAN_MEAN.rgb[1],.002,'… green');near(sb/n,MULCH_SCAN_MEAN.rgb[2],.002,'… blue');
const fract=(x:number)=>x-Math.floor(x),ss=(a:number,b:number,x:number)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);},mix=(a:number,b:number,t:number)=>a+(b-a)*t;
let fibre=0,fn=0;for(let i=0;i<400;i++)for(let j=0;j<400;j++){const u=i/400*3.7,v=j/400*3.1,slide=u*9.5+v*1.6,N=fract(Math.sin(Math.floor(slide)*127.1+Math.floor(v*8)*311.7)*43758.5453),f=ss(.04,.22,Math.abs(fract(slide+N*.45)-.5));fibre+=mix(.7,1,f)*mix(.82,1.08,N);fn++;}
near(fibre/fn,MULCH_FIBRE_MEAN,.01,'The fibre pattern is normalised to average 1');
let lumaShare=0;for(let i=0;i<scan.length;i+=info.channels){const l=.2126*lin(scan[i])+.7152*lin(scan[i+1])+.0722*lin(scan[i+2]);lumaShare+=Math.min(1.4,Math.max(.6,l/MULCH_SCAN_MEAN.luma));}lumaShare/=n;
const albedo:Record<string,THREE.Color>={};
for(const id of ['mulch-bed','black-mulch-bed','cedar-mulch-bed'] as const){
 const swatch=mulchSwatch(id),raster=swatch.clone().multiplyScalar(lumaShare),photo=mulchPhotoColor(id,MULCH_SCAN_MEAN);albedo[id]=raster;
 for(const k of ['r','g','b'] as const){near(raster[k]/swatch[k],1,.08,`${id}: the raster mulch averages to its swatch (${k})`);near(photo[k]*MULCH_SCAN_MEAN.rgb['rgb'.indexOf(k)],swatch[k],swatch[k]*.01,`${id}: Photo mode averages to the same swatch (${k})`);}
 ok(swatch.getHexString()===new THREE.Color(LANDSCAPE_SURFACES.find(s=>s.id===id)!.color).getHexString(),`${id}: the swatch is the catalogue's colour`);
}
const lab=(c:THREE.Color)=>{const f=(t:number)=>t>.008856?Math.cbrt(t):7.787*t+16/116,x=(c.r*.4124+c.g*.3576+c.b*.1805)/.95047,y=c.r*.2126+c.g*.7152+c.b*.0722,z=(c.r*.0193+c.g*.1192+c.b*.9505)/1.08883;return [116*f(y)-16,500*(f(x)-f(y)),200*(f(y)-f(z))];};
const de00=(c1:THREE.Color,c2:THREE.Color)=>{const [L1,a1,b1]=lab(c1),[L2,a2,b2]=lab(c2),rad=Math.PI/180,C1=Math.hypot(a1,b1),C2=Math.hypot(a2,b2),Cm=(C1+C2)/2,G=.5*(1-Math.sqrt(Cm**7/(Cm**7+25**7))),a1p=a1*(1+G),a2p=a2*(1+G),C1p=Math.hypot(a1p,b1),C2p=Math.hypot(a2p,b2),h=(b:number,a:number)=>{const v=Math.atan2(b,a)/rad;return v<0?v+360:v;},h1=h(b1,a1p),h2=h(b2,a2p),dL=L2-L1,dC=C2p-C1p;let dh=h2-h1;if(C1p*C2p===0)dh=0;else if(dh>180)dh-=360;else if(dh<-180)dh+=360;const dH=2*Math.sqrt(C1p*C2p)*Math.sin(dh*rad/2),Lm=(L1+L2)/2,Cmp=(C1p+C2p)/2;let hm=h1+h2;if(C1p*C2p!==0){if(Math.abs(h1-h2)>180)hm+=hm<360?360:-360;hm/=2;}const T=1-.17*Math.cos((hm-30)*rad)+.24*Math.cos(2*hm*rad)+.32*Math.cos((3*hm+6)*rad)-.2*Math.cos((4*hm-63)*rad),SL=1+.015*(Lm-50)**2/Math.sqrt(20+(Lm-50)**2),SC=1+.045*Cmp,SH=1+.015*Cmp*T,RT=-2*Math.sqrt(Cmp**7/(Cmp**7+25**7))*Math.sin(60*Math.exp(-(((hm-275)/25)**2))*rad);return Math.sqrt((dL/SL)**2+(dC/SC)**2+(dH/SH)**2+RT*(dC/SC)*(dH/SH));};
const lum=(c:THREE.Color)=>c.r*.2126+c.g*.7152+c.b*.0722,[brown,black,cedar]=[albedo['mulch-bed'],albedo['black-mulch-bed'],albedo['cedar-mulch-bed']];
ok(lum(black)<lum(brown)&&lum(brown)<lum(cedar),'Black is darker than brown, which is darker than cedar');
for(const [a,b,label] of [[brown,black,'brown/black'],[brown,cedar,'brown/cedar'],[black,cedar,'black/cedar']] as const)ok(de00(a,b)>=15,`${label} mulch differ by ΔE00 ≥ 15 (${de00(a,b).toFixed(1)})`);

// Wiring: picking, Photo mode, shadows, tiers.
const landscape=source('src/features/deckcraft/components/viewer3d/Landscape3D.tsx'),decals=source('src/features/deckcraft/components/viewer3d/plantContactDecals.tsx'),photo=source('src/features/deckcraft/components/viewer3d/photoMaterials.ts'),material=source('src/features/deckcraft/components/viewer3d/landscapeSurfaceMaterial.ts');
ok(/name="landscape-bed-collars" userData=\{\{pickPartId:'landscape\/'\+object\.id/.test(landscape)&&/name=\{relief\?'landscape-bed-relief':undefined\} userData=\{\{pickPartId:'landscape\/'\+object\.id/.test(landscape),'A click on a collar, lip or the cut selects the bed');
ok(decals.includes('mesh.raycast=()=>{};')&&decals.includes("mesh.userData={photoSkip:true,coversGround:false,renderOnly:true}")&&decals.includes('mesh.castShadow=false'),'A shade ring never stops a click, is skipped by Photo mode and casts nothing');
ok(!/landscape-bed-collars"[^>]*castShadow|landscape-bed-relief[^>]*castShadow/.test(landscape),'Collars, lips and the cut cast no shadow');
ok(decals.includes('<PlantShadeRings')===false&&landscape.includes('<PlantShadeRings data={data} plants={seated}/>')&&!/tier/.test(decals.slice(decals.indexOf('export function PlantShadeRings'))),'Shade rings draw on every tier');
ok(SHADE_RING.day<=.4&&SHADE_RING.night<=.12&&decals.includes("evening||hour==='night'?SHADE_RING.night"),'Rings are soft by day and faint at night, so bases are never crushed to black');
ok(photo.includes("patches.includes('mulch-shred-fiber-v3')&&material.userData.mulchPhotoColor instanceof THREE.Color")&&material.includes("key:'mulch-shred-fiber-v3'"),'Photo mode traces the same mulch colour');
ok(/m\.aoMap=occlusion\?\.texture\?\?NO_OCCLUSION;m\.aoMapIntensity=\.75/.test(landscape),'Beds take the lawn’s shared occlusion map');
ok(landscape.includes('NO_OCCLUSION.channel=1;'),'The stand-in occlusion map uses the lawn map’s uv1 channel, so the bed shader does not recompile when the lawn map arrives');
ok(landscape.includes('const flush=!!relief,')&&landscape.includes('polys.flatMap(p=>edgingRuns(p,joins)).map(run=>steelEdgingGeometry(flush?flushEdgingPoints(data,run,false):'),'Only plain (relief) beds get flush edging; raised, turf and putting-green beds keep their ribbon and its steel');
ok(Object.keys(STEM_OFFSET).every(id=>Math.abs(STEM_OFFSET[id]![0])<.5&&Math.abs(STEM_OFFSET[id]![1])<.5),'Stem offsets stay inside the envelope');
console.log(`BED EDGES OK — ${checks} checks: mulch at grade + 1 in with a spade-cut edge (none against beds or structures), plants seated by form with collars and lips, shade rings on every tier, flush edging on a slope, honest mulch colours (raster and Photo), data and exports unchanged.`);
