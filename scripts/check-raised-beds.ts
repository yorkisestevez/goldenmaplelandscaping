// S2 raised and terraced beds: validation and persistence, the soil-top rule, planting soil against a brute-force
// integral (within 2 %), warnings, quote lines (never $0), the 3D level top and faces, planTerraces on the measured
// Craighurst ground (e2e/fixtures/craighurst-ground-fit.json) on its steepest area, and designs without raised beds
// left exactly as they were.
import '../src/features/deckcraft/siteModelRuntime';
import '../src/features/deckcraft/siteSurfaceEngine';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {ensureLiveDesignExtensions} from '../src/features/deckcraft/designExtensions';
import {parseDesign,serializeDesign} from '../src/features/deckcraft/designPersistence';
import {loadAdvancedYardRuntime} from '../src/features/deckcraft/yardModel';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {validateLandscapeObjects} from '../src/features/deckcraft/landscapeTypesRuntime';
import {landscapeTakeoff,landscapeQuoteSections,landscapePlacement,landscapeBedAreas,raisedBedLevel} from '../src/features/deckcraft/landscapeModelRuntime';
import {applyLandscapeEdit} from '../src/features/deckcraft/landscapeEdits';
import {newLandscapeObject} from '../src/features/deckcraft/landscapeCatalogue';
import {landscapeOutlinePaths} from '../src/features/deckcraft/landscapeOutline';
import {RAISED_BED,planeGround,planeFillYd3} from '../src/features/deckcraft/raisedBeds';
import {planTerraces} from '../src/features/deckcraft/terracedBeds';
import {createSiteSurface,designSiteModel,type SiteSurface} from '../src/features/deckcraft/siteSurfaceEngine';
import {sampleSiteHeight} from '../src/features/deckcraft/siteSurface';
import {getTerrainConfig,newYardFeature} from '../src/features/deckcraft/yardSettings';
import {landscapeSurfaceCells,raisedBedFaces,raisedBedTop} from '../src/features/deckcraft/landscapeSurfaceGeometry';
import {landscapeBedGeometry} from '../src/features/deckcraft/components/viewer3d/Landscape3D';
import {buildYardTakeoff} from '../src/features/deckcraft/yardTakeoff';
import type {DeckData} from '../src/features/deckcraft/types';
import type {LandscapeObject,LandscapePoint} from '../src/features/deckcraft/landscapeTypes';

let checks=0;const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;},near=(a:number,b:number,tol:number,m:string)=>ok(Math.abs(a-b)<=tol,`${m}: ${a} vs ${b}`);
await loadAdvancedYardRuntime();
const FIXTURE=readFileSync(new URL('../e2e/fixtures/craighurst-ground-fit.json',import.meta.url),'utf8');
const craighurst=async(edit?:(c:any)=>void)=>{const doc=JSON.parse(FIXTURE);edit?.(doc.configuration);await ensureLiveDesignExtensions(doc);return parseDesign(JSON.stringify(doc));};
const measured=await craighurst(),surface=createSiteSurface(designSiteModel(measured),getTerrainConfig(measured));
const inside=(p:LandscapePoint,ring:LandscapePoint[])=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)yes=!yes;}return yes;};
const bed=(id:string,patch:Partial<LandscapeObject>={}):LandscapeObject=>({...newLandscapeObject('mulch-bed',id),...patch});
const polyBed=(id:string,polygon:LandscapePoint[],patch:Partial<LandscapeObject>={})=>{const xs=polygon.map(p=>p.x),zs=polygon.map(p=>p.z);return bed(id,{polygon,xIn:(Math.min(...xs)+Math.max(...xs))/2,zIn:(Math.min(...zs)+Math.max(...zs))/2,widthIn:Math.max(...xs)-Math.min(...xs),depthIn:Math.max(...zs)-Math.min(...zs),...patch});};
/** Brute force: the outline's lowest ground (dense walk), the highest ground inside (grid), and the soil integral. */
function brute(data:DeckData,o:LandscapeObject,raisedIn:number,step=.25){
 const ring=landscapeOutlinePaths(o)[0],h=(x:number,z:number)=>sampleSiteHeight(data,x,z);let low=Infinity,high=-Infinity;
 for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.05);for(let k=0;k<=n;k++){const g=h(a.x+(b.x-a.x)*k/n,a.z+(b.z-a.z)*k/n);if(g!==undefined){low=Math.min(low,g);high=Math.max(high,g);}}}
 const xs=ring.map(p=>p.x),zs=ring.map(p=>p.z);for(let x=Math.min(...xs);x<=Math.max(...xs);x+=step/2)for(let z=Math.min(...zs);z<=Math.max(...zs);z+=step/2)if(inside({x,z},ring)){const g=h(x,z);if(g!==undefined)high=Math.max(high,g);}
 const top=Math.max(low+raisedIn,high-RAISED_BED.slackIn),area=landscapeBedAreas([o],data).get(o.id)!;let soil=0;
 for(let x=Math.min(...xs)+step/2;x<Math.max(...xs);x+=step)for(let z=Math.min(...zs)+step/2;z<Math.max(...zs);z+=step){const p={x,z},w=area.reduce((n,r)=>n+(inside(p,r)?1:0),0)%2;if(!w)continue;const g=h(x,z);if(g!==undefined&&top>g)soil+=(top-g)*step*step;}
 return {low,high,top,soilYd3:soil/46656};
}

// 1. Validation and persistence. ------------------------------------------------------------------------------
{
 const good=[bed('a',{raisedIn:0}),bed('b',{raisedIn:36,edge:{kind:'timber'}}),bed('c',{raisedIn:18,edge:{kind:'steel'}}),bed('d',{raisedIn:12,edge:{kind:'wall'}}),bed('e',{raisedIn:12,edge:{kind:'wall',wallFeatureId:'retaining-wall-1'}})];
 ok(validateLandscapeObjects(good),'Raised beds with every edge kind validate');
 for(const [label,o] of [['negative height',bed('x',{raisedIn:-1})],['over 36 in',bed('x',{raisedIn:36.01})],['NaN height',bed('x',{raisedIn:NaN})],['string height',bed('x',{raisedIn:'12' as never})],['edge without raisedIn',bed('x',{edge:{kind:'timber'}})],['unknown edge kind',bed('x',{raisedIn:12,edge:{kind:'stone' as never}})],['wall id on timber',bed('x',{raisedIn:12,edge:{kind:'timber',wallFeatureId:'w'}})],['extra edge key',bed('x',{raisedIn:12,edge:{kind:'wall',heightIn:12} as never})],['empty wall id',bed('x',{raisedIn:12,edge:{kind:'wall',wallFeatureId:' '}})],['edge array',bed('x',{raisedIn:12,edge:[] as never})]] as const)ok(!validateLandscapeObjects([o]),`Rejects ${label}`);
 const plant={...newLandscapeObject('rounded-shrub','p'),raisedIn:12};ok(!validateLandscapeObjects([plant]),'Rejects raisedIn on a plant');
 const legacy=structuredClone(DEFAULT_DECK) as DeckData,saved={...legacy,landscapeObjects:good},round=parseDesign(serializeDesign(saved));
 assert.deepEqual(round.landscapeObjects,good);checks++;ok(serializeDesign(round)===serializeDesign(saved),'Raised beds survive save and load byte for byte');
 const plain={...legacy,landscapeObjects:[bed('plain')]},text=serializeDesign(plain);ok(!/raisedIn|"edge"/.test(text),'A plain bed saves no raised fields');ok(serializeDesign(parseDesign(text))===text,'A plain bed round-trips byte for byte');
 const doc=JSON.parse(FIXTURE);await ensureLiveDesignExtensions(doc);const a=serializeDesign(parseDesign(JSON.stringify(doc)));ok(serializeDesign(parseDesign(a))===a&&!/raisedIn/.test(a),'The Craighurst design saves unchanged');
}

// 2. The soil-top rule and planting soil on a legacy terrain plane (exact). ---------------------------------------
{
 const data={...structuredClone(DEFAULT_DECK),terrainConfig:{widthFt:120,depthFt:120,elevationIn:0,slopePct:10}} as DeckData;
 delete (data as Partial<DeckData>).siteModel;
 // 120 in across, 240…312 in out: the ground rises 0.1 in per inch out, from 24 in to 31.2 in.
 const tall=bed('tall',{xIn:60,zIn:276,widthIn:120,depthIn:72,raisedIn:12}),low=bed('low',{xIn:60,zIn:276,widthIn:120,depthIn:72,raisedIn:2});
 const lt=raisedBedLevel(data,tall)!,ll=raisedBedLevel(data,low)!;
 near(lt.topIn,36,1e-9,'Soil top = lowest edge ground + raisedIn');near(ll.topIn,29.2,1e-9,'Soil top never more than 2 in below the highest ground');
 const q=landscapeTakeoff([tall],data),q2=landscapeTakeoff([low],data);
 near(q.items[0].soilYd3!,72576/46656,1e-9,'Exact soil volume on a plane (full fill)');near(q2.items[0].soilYd3!,16224/46656,1e-9,'Exact soil volume on a plane (fill ends where the ground meets the top)');
 const b1=brute(data,tall,12,.5),b2=brute(data,low,2,.5);near(q.items[0].soilYd3!,b1.soilYd3,q.items[0].soilYd3!*.02,'Legacy soil vs brute force (2 %)');near(q2.items[0].soilYd3!,b2.soilYd3,q2.items[0].soilYd3!*.02,'Legacy partial soil vs brute force (2 %)');
 near(planeFillYd3([[{x:0,z:0},{x:12,z:0},{x:12,z:12},{x:0,z:12}].reverse()],{x:0,z:0,constant:0},10),1440/46656,1e-12,'Clockwise rings integrate the same');
 near(q.items[0].raisedMaxIn!,12,1e-9,'Highest soil over the ground is at the low edge');
 // Warnings, edging and holding.
 const flat={...data,terrainConfig:{...data.terrainConfig!,slopePct:0}},open=landscapeTakeoff([bed('open',{xIn:60,zIn:276,widthIn:120,depthIn:72,raisedIn:18})],flat);
 ok(open.warnings.some(w=>/no holding wall or edging/.test(w)),'Unheld soil over 6 in warns');ok(open.items[0].unheld,'Unheld bed is flagged');
 ok(!landscapeTakeoff([bed('short',{xIn:60,zIn:276,widthIn:120,depthIn:72,raisedIn:6})],flat).warnings.some(w=>/holding/.test(w)),'6 in or less needs no holding edge');
 const timber=landscapeTakeoff([bed('timber',{xIn:60,zIn:276,widthIn:120,depthIn:72,raisedIn:18,edge:{kind:'timber'}})],flat);
 ok(!timber.warnings.some(w=>/holding/.test(w)),'Timber edging holds the soil');near(timber.items[0].raisedEdgeLf!,32,1e-9,'Timber edging runs the perimeter');near(timber.raisedEdgeLf!,32,1e-9,'Raised edging total');
 const unlinked=landscapeTakeoff([bed('walled',{xIn:60,zIn:276,widthIn:120,depthIn:72,raisedIn:18,edge:{kind:'wall'}})],flat);
 ok(unlinked.warnings.some(w=>/not linked to an enabled retaining wall/.test(w)),'An unlinked wall warns');near(unlinked.items[0].wallLf!,32,1e-6,'Unlinked wall run = where the soil stands over the ground');ok(!unlinked.items[0].wallLinked,'Unlinked wall flagged');
 const wall=newYardFeature('retaining-wall',flat),withWall={...flat,yardFeatures:[wall]},linked=landscapeTakeoff([bed('walled',{xIn:60,zIn:276,widthIn:120,depthIn:72,raisedIn:18,edge:{kind:'wall',wallFeatureId:wall.id}})],withWall);
 ok(!linked.warnings.some(w=>/holding|retaining wall/.test(w)),'A linked enabled wall holds the soil');ok(linked.items[0].wallLinked&&linked.items[0].wallLf===wall.widthFt,'Linked wall run comes from the wall');
 const disabled=landscapeTakeoff([bed('walled',{xIn:60,zIn:276,widthIn:120,depthIn:72,raisedIn:18,edge:{kind:'wall',wallFeatureId:wall.id}})],{...flat,yardFeatures:[{...wall,enabled:false}]});ok(disabled.warnings.some(w=>/not linked to an enabled/.test(w)),'A disabled wall does not hold the soil');
 // Pricing: quote lines with quantities, never $0, and the yard quote stays open.
 const objects=[bed('open',{xIn:60,zIn:276,widthIn:120,depthIn:72,raisedIn:18}),bed('timber',{xIn:240,zIn:276,widthIn:96,depthIn:48,raisedIn:18,edge:{kind:'steel'}}),bed('walled',{xIn:420,zIn:276,widthIn:96,depthIn:48,raisedIn:18,edge:{kind:'wall'}})];
 const lines=landscapeQuoteSections(objects,landscapeTakeoff(objects,flat)),by=(id:string)=>lines.find(l=>l.id===id);
 for(const id of ['landscape-soil-open','landscape-soil-timber','landscape-soil-walled','landscape-raised-edge-timber','landscape-wall-pending-walled','landscape-hold-pending-open'])ok(by(id),`Quote line ${id}`);
 for(const id of ['landscape-soil-open','landscape-raised-edge-timber','landscape-wall-pending-walled'])ok(by(id)!.amountCents===null&&by(id)!.quantity!>0,`${id} is a quote line with a quantity`);
 ok(by('landscape-raised-edge-timber')!.label.includes('steel raised-bed edging'),'Edging line names its material');
 ok(!lines.some(l=>l.amountCents===0),'No landscape line is $0');
 const yard=buildYardTakeoff({...flat,landscapeObjects:objects});ok(yard.quoteRequired&&yard.grandTotalCents===null,'Raised beds keep the yard total open for quotes');ok(yard.sections.filter(s=>/^landscape-(soil|raised|wall|hold)/.test(s.id)).every(s=>s.amountCents===null)&&yard.sections.some(s=>s.id==='landscape-soil-open'),'Yard quote carries the raised-bed lines unpriced');
 // Plants stand on the soil, not the ground; a plant outside stays on the ground.
 const shrub={...newLandscapeObject('rounded-shrub','shrub'),xIn:60,zIn:276},outsideShrub={...shrub,id:'out',zIn:400},planted={...flat,landscapeObjects:[objects[0],shrub,outsideShrub]};
 near(landscapePlacement(planted,shrub).y*12,18+3,1e-9,'A plant inside sits on the soil top + mulch');near(landscapePlacement(planted,outsideShrub).y*12,0,1e-9,'A plant outside stays on the ground');
 // One edit, one undo step: a patch through landscape.edit.
 const one=applyLandscapeEdit({...flat,landscapeObjects:[bed('e1',{xIn:60,zIn:276})]},'e1',{action:'patch',patch:{raisedIn:24,edge:{kind:'timber'}}});ok(one.landscapeObjects![0].raisedIn===24&&one.landscapeObjects![0].edge?.kind==='timber','A raised bed is one patch edit');
 assert.throws(()=>applyLandscapeEdit({...flat,landscapeObjects:[bed('e2')]},'e2',{action:'patch',patch:{edge:{kind:'timber'}}}));checks++;
}

// 3. Measured ground (Craighurst): soil-top rule and planting soil against brute force. -----------------------------
const steep=[{x:-8,z:62},{x:52,z:44},{x:58,z:68},{x:4,z:84}];
{
 for(const raisedIn of [0,6,12,24]){
  const o=polyBed('m'+raisedIn,steep,{raisedIn}),data={...measured,landscapeObjects:[o]},level=raisedBedLevel(data,o)!,b=brute(data,o,raisedIn),q=landscapeTakeoff([o],data).items[0];
  near(level.lowIn,b.low,.02,`Lowest outline ground (${raisedIn} in)`);near(level.highIn,b.high,.05,`Highest ground inside (${raisedIn} in)`);near(level.topIn,b.top,.05,`Soil top rule on measured ground (${raisedIn} in)`);
  near(q.soilYd3!,b.soilYd3,Math.max(b.soilYd3*.02,1e-4),`Measured soil vs brute force within 2 % (${raisedIn} in)`);ok(level.complete,'Bed fully on measured ground');
  if(raisedIn===0)ok(level.topIn>level.lowIn+1&&Math.abs(level.topIn-(level.highIn-2))<1e-9,'On a slope the top rises to 2 in below the high side');
 }
 const off=polyBed('off',[{x:400,z:400},{x:460,z:400},{x:460,z:460},{x:400,z:460}],{raisedIn:12}),q=landscapeTakeoff([off],{...measured,landscapeObjects:[off]});
 ok(q.warnings.some(w=>/off measured ground/.test(w))&&q.items[0].soilTopIn===undefined,'A bed off the survey keeps soil pending');ok(landscapeQuoteSections([off],q).some(l=>l.id==='landscape-soil-pending-off'&&l.amountCents===null&&l.quantity===undefined),'Pending soil is a quote line with no invented quantity');
 // 3D: a level top at the soil top + finish; faces from the ground to the top; edging stands proud; a linked wall hides its run.
 const o=polyBed('v',steep,{raisedIn:12}),data={...measured,landscapeObjects:[o]},polys=landscapeBedAreas([o],data).get('v')!,top=raisedBedTop(data,o)!;
 near(top,raisedBedLevel(data,o)!.topIn,1e-9,'Viewer and model share the soil top');ok(landscapeSurfaceCells(data,polys,o).every(c=>c.plane.x===0&&c.plane.z===0&&c.plane.constant===top),'Raised cells lie on one level plane');
 const geo=landscapeBedGeometry(data,polys,3,o).getAttribute('position');let lo=Infinity,hi=-Infinity;for(let i=0;i<geo.count;i++){lo=Math.min(lo,geo.getY(i));hi=Math.max(hi,geo.getY(i));}near(lo*12,top+3.05,1e-3,'Bed top is level');near(hi*12,top+3.05,1e-3,'Bed top is level (max)');
 const faces=raisedBedFaces(data,o,polys),ys=faces.filter((_,i)=>i%3===1);ok(faces.length>0&&faces.length%9===0,'Soil faces are triangles');near(Math.max(...ys)*12,top+3,1e-4,'Faces reach the finish top');near(Math.min(...ys)*12,raisedBedLevel(data,o)!.lowIn,.05,'Faces reach down to the lowest ground');
 const band=raisedBedFaces(data,{...o,edge:{kind:'timber'}},polys);near(Math.max(...band.filter((_,i)=>i%3===1))*12,top+4,1e-4,'Timber edging stands 1 in proud');
 // Timber edging reads as stacked timbers: board UVs with a 6 in course counted down from the top, the grain along each
 // side, one board pick a side, and a 1.5 in top edge on the top course.
 {const {timberFaceGeometry}=await import('../src/features/deckcraft/components/viewer3d/raisedBedTimber');
  const g=timberFaceGeometry(band),p=g.getAttribute('position'),uv=g.getAttribute('uv'),pick=g.getAttribute('aVar'),runs=band.length/18,crown=top+4;
  ok(runs>0&&p.count===runs*12&&uv.count===p.count&&pick.count===p.count&&pick.itemSize===4,`Timber faces carry board UVs and a board pick, with a top edge on each of ${runs} runs`);
  let course=0,cap=0,grain=0,picks=0;
  for(let r=0;r<runs;r++){
   for(let k=0;k<6;k++){const i=r*12+k;course=Math.max(course,Math.abs(uv.getY(i)-(crown-p.getY(i)*12)/6));}
   for(let k=6;k<12;k++){const i=r*12+k;cap=Math.max(cap,Math.abs(p.getY(i)*12-crown),Math.min(Math.abs(uv.getY(i)-.25),Math.abs(uv.getY(i)-.75)));}
   cap=Math.max(cap,Math.abs(Math.hypot(p.getX(r*12+11)-p.getX(r*12+6),p.getZ(r*12+11)-p.getZ(r*12+6))*12-1.5));
   const a=r*12,b=a+1,len=Math.hypot(p.getX(b)-p.getX(a),p.getZ(b)-p.getZ(a))*12;grain=Math.max(grain,Math.abs(Math.abs(uv.getX(b)-uv.getX(a))-len/48));
   for(let k=1;k<12;k++)picks=Math.max(picks,Math.abs(pick.getX(a+k)-pick.getX(a)));
  }
  ok(course<1e-4,`A board course every 6 in down from the top (${course.toExponential(1)})`);ok(cap<1e-4,`The top edge is 1.5 in wide at the top, inside the top course (${cap.toExponential(1)})`);
  ok(grain<1e-4,`The grain runs along each side, 48 in a repeat (${grain.toExponential(1)})`);ok(picks===0,'One board pick a run');
  ok(Math.max(...Array.from({length:uv.count},(_,i)=>uv.getY(i)))>2,'At least three courses show on the low side');g.dispose();}
 const covered=raisedBedFaces(data,{...o,edge:{kind:'wall'}},polys,(x,z)=>x+z*.3<45);ok(covered.length<faces.length,'A linked wall run carries no soil face');
}

// 4. planTerraces on the steepest area of the Craighurst survey. --------------------------------------------------
{
 const fit=(s:SiteSurface,x:number,z:number,r:number)=>{const pts:{x:number;z:number;h:number}[]=[];for(let dx=-r;dx<=r;dx+=6)for(let dz=-r;dz<=r;dz+=6){const h=s.sample(x+dx,z+dz);if(h!==undefined)pts.push({x:dx,z:dz,h});}if(pts.length<20)return;const m=pts.reduce((a,p)=>({x:a.x+p.x/pts.length,z:a.z+p.z/pts.length,h:a.h+p.h/pts.length}),{x:0,z:0,h:0});let xx=0,xz=0,zz=0,xh=0,zh=0;for(const p of pts){const a=p.x-m.x,b=p.z-m.z,c=p.h-m.h;xx+=a*a;xz+=a*b;zz+=b*b;xh+=a*c;zh+=b*c;}const det=xx*zz-xz*xz,gx=(xh*zz-zh*xz)/det,gz=(zh*xx-xh*xz)/det,g=Math.hypot(gx,gz);return g?{x:-gx/g,z:-gz/g}:undefined;};
 let best:{fall:number;rect:LandscapePoint[];d:{x:number;z:number}}|undefined;
 for(const [L,W] of [[96,48],[96,36],[84,48],[72,48]])for(let x=surface.bounds.minX;x<=surface.bounds.maxX;x+=6)for(let z=surface.bounds.minZ;z<=surface.bounds.maxZ;z+=6){
  const d=fit(surface,x,z,30);if(!d)continue;const a={x:-d.z,z:d.x},rect=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([s,u])=>({x:x+d.x*s*L/2+a.x*u*W/2,z:z+d.z*s*L/2+a.z*u*W/2}));
  const e=surface.extrema([rect.map(p=>({x:p.x,y:p.z}))]);if(e.complete&&(!best||e.max-e.min>best.fall))best={fall:e.max-e.min,rect,d};}
 ok(best&&best.fall>12,`Found the steepest fully surveyed area (fall ${best?.fall.toFixed(1)} in)`);
 const t0=performance.now(),plans=([2,3] as const).map(tiers=>planTerraces(surface,best!.rect,{tiers,minWallIn:12,maxWallIn:24,downhill:{dx:best!.d.x,dz:best!.d.z}})),ms=performance.now()-t0,plan=plans.find(p=>p.ok)!;
 ok(plan,`2–3 level tiers fit the steepest area (${plans.map(p=>p.tiers+': '+(p.reason??'ok')).join(', ')})`);ok(ms<5000,`Planning is quick (${ms.toFixed(0)} ms)`);
 ok(plan.beds.length===plan.tiers&&plan.walls.length===plan.tiers,'One bed and one wall per tier');
 for(const w of plan.walls){ok(w.heightIn>=12-1e-9&&w.heightIn<=24+1e-9,`Wall ${w.tier+1} is ${w.heightIn} in (12–24)`);ok(w.path.length>=2&&w.lengthIn>0,'Wall path is a real centreline');}
 for(let i=1;i<plan.beds.length;i++)ok(plan.beds[i].soilTopIn<plan.beds[i-1].soilTopIn-1,'Each tier steps down');
 ok(plan.alignment>=.9,`Tiers follow the measured slope (alignment ${plan.alignment})`);
 const down=(p:LandscapePoint)=>p.x*best!.d.x+p.z*best!.d.z,mean=(ps:LandscapePoint[])=>ps.reduce((n,p)=>n+down(p),0)/ps.length;
 for(let i=1;i<plan.beds.length;i++)ok(mean(plan.beds[i].outline)>mean(plan.beds[i-1].outline),'Lower tiers lie further downhill');
 for(const w of plan.walls)ok(Math.max(...w.path.map(down))>=Math.max(...plan.beds[w.tier].outline.map(down))-1,'Each wall runs along its tier’s downhill edge');
 // The move engine's beds reproduce the plan through the model, level tiers included.
 const beds=plan.beds.map(b=>polyBed('tier-'+b.tier,b.outline,{raisedIn:b.raisedIn,edge:{kind:'wall'}})),data={...measured,landscapeObjects:beds};
 ok(validateLandscapeObjects(beds),'Planned tiers are valid bed objects');
 plan.beds.forEach((b,i)=>{near(raisedBedLevel(data,beds[i])!.topIn,b.soilTopIn,.01,`Tier ${i+1} soil top reproduced by the model`);ok(b.raisedIn>=0&&b.raisedIn<=36,'raisedIn within 0–36');});
 for(const w of plan.walls){const g=Math.min(...w.path.map(p=>sampleSiteHeight(measured,p.x,p.z)!));ok(w.topIn-g<=w.heightIn+1e-6,'Wall height covers its path vertices');}
 // Feasibility on planes and off the survey.
 const square=[{x:0,z:0},{x:120,z:0},{x:120,z:120},{x:0,z:120}],plane=(pct:number)=>planeGround({x:0,z:pct/100,constant:0});
 ok(planTerraces(plane(1),square,{tiers:2,downhill:{dx:0,dz:-1}}).reason==='too-flat','A gentle slope is too flat for terraces');
 ok(planTerraces(plane(80),square,{tiers:2,downhill:{dx:0,dz:-1}}).reason==='too-steep','A steep bank is too steep for low walls');
 ok(planTerraces(plane(25),square,{tiers:2,downhill:{dx:0,dz:1}}).reason==='wrong-direction','Downhill must follow the measured fall');
 ok(planTerraces(plane(0),square,{tiers:2,downhill:{dx:0,dz:-1}}).reason==='too-flat','Level ground needs no terraces');
 const mid=planTerraces(plane(25),square,{tiers:2,downhill:{dx:0,dz:-1}});ok(mid.ok&&mid.walls.every(w=>w.heightIn>=12&&w.heightIn<=24),'A 25 % plane takes 2 tiers');
 ok(planTerraces(surface,[{x:400,z:400},{x:500,z:400},{x:500,z:500},{x:400,z:500}],{tiers:2,downhill:{dx:1,dz:0}}).reason==='unmeasured','Terraces need measured ground');
 ok(planTerraces(surface,square.slice(0,2),{tiers:2,downhill:{dx:1,dz:0}}).reason==='invalid','Rejects a degenerate area');
}

// 5. Designs without raised beds are exactly as before. -----------------------------------------------------------
{
 const plain=polyBed('plain',steep),shrub={...newLandscapeObject('rounded-shrub','s'),xIn:20,zIn:66},data={...measured,landscapeObjects:[plain,shrub]},polys=landscapeBedAreas([plain],data).get('plain')!;
 assert.deepEqual(landscapeSurfaceCells(data,polys,plain),landscapeSurfaceCells(data,polys));checks++;
 const q=landscapeTakeoff([plain,shrub],data),json=JSON.stringify(q);ok(!/soil|raised|wallL|unheld/.test(json),'A plain takeoff gains no raised fields');
 ok(!landscapeQuoteSections([plain,shrub],q).some(l=>/soil|raised|wall|hold/.test(l.id)),'A plain quote gains no raised lines');
 near(landscapePlacement(data,shrub).y*12,sampleSiteHeight(data,20,66)!,1e-9,'A plant in a plain bed stays on the ground');
 ok(raisedBedTop(data,plain)===undefined&&raisedBedFaces(data,plain,polys).length===0,'A plain bed draws no raised top or faces');
}
console.log(`RAISED BEDS OK — ${checks} checks: validation/persistence, soil-top rule, soil within 2 % of brute force, warnings, quote lines, 3D surfaces, terraces on Craighurst and plain designs unchanged.`);
