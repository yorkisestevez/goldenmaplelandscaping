import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {YardFeature} from '../src/features/deckcraft/types';
import {HARDSCAPE_PRODUCTS,hardscapeBody,hardscapeProblem,rectangularUnit} from '../src/features/deckcraft/hardscapeCatalogue';
import {hardscapeProfile,hardscapeStockPolygons,shapedBond} from '../src/features/deckcraft/hardscapeShapes';
import {hardscapeBlanks} from '../src/features/deckcraft/hardscapeLayout';
import {buildYardModel,yardClip,yardArea,yardSignedArea} from '../src/features/deckcraft/yardModel';
import {parseDesign,serializeDesign} from '../src/features/deckcraft/designPersistence';
let checks=0,profiles=0,bonds=0;const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;};
const base:YardFeature={id:'shape',kind:'patio',name:'Shaped stone',enabled:true,xFt:60,zFt:60,widthFt:8,depthFt:8,heightIn:3,rotationDeg:0,productId:'',color:'#aaa69b'};
for(const product of HARDSCAPE_PRODUCTS)for(const finish of product.finishes)for(const unit of finish.units.filter(u=>hardscapeBody(u.role))){
 const profile=hardscapeProfile(product.id,unit);if(!profile)continue;profiles++;
 const contours=hardscapeStockPolygons(product.id,unit,0,0,0),xs=contours[0].map(p=>p.x),ys=contours[0].map(p=>p.y);
 ok(Math.abs(Math.max(...xs)-Math.min(...xs)-unit.lengthMm/25.4)<1e-6,'Original length retained');ok(Math.abs(Math.max(...ys)-Math.min(...ys)-unit.widthMm/25.4)<1e-6,'Original width retained');
 ok(yardArea(contours)>0&&yardArea(contours)<unit.widthMm*unit.lengthMm/304.8**2,'Shaped solid area differs from rectangular envelope');
 const bond=shapedBond(product.id,unit),color=finish.colors.find(c=>!unit.colorIds||unit.colorIds.includes(c.id));if(!color)continue;
 for(const jointMm of [0,3,12])for(const angleDeg of [0,37,90]){
  const f={...base,productId:product.id,hardscape:{finishId:finish.id,colorId:color.id,unitId:unit.id,patternId:bond?.id??'running-bond',jointMm,angleDeg}},data={...structuredClone(DEFAULT_DECK),houseVisible:false,yardFeatures:[f]};
  assert.equal(hardscapeProblem(f),'');checks++;
  const model=buildYardModel(data),stones=model.boxes.filter(b=>b.role==='paver'),polys=stones.map(b=>b.polygon!),area=yardArea(polys),union=yardArea(yardClip(polys));
  ok(stones.length>0,'Shaped stock renders');ok(Math.abs(area-union)<Math.max(.0001,stones.length*1e-7),`${product.id} ${unit.id} ${jointMm} ${angleDeg}: no overlap (${area-union})`);
  ok(!stones.some(b=>b.illustrative),'Source-backed outline has no envelope placeholder');assert.deepEqual(parseDesign(serializeDesign(data)).yardFeatures,[f]);checks++;
  assert.equal(model.features[0].stockSchedule!.reduce((n,u)=>n+u.pieces,0),model.quantities.paverPieces);checks++;
  ok(model.quantities.paverPieces<=stones.length,'Fragments do not multiply the physical stock count');
  // Order area counts each stock's coverage face (its outline, openings included), not its rectangular envelope.
  {const face=Math.max(...contours.map(p=>Math.abs(yardSignedArea(p))))/144;ok(Math.abs((model.features[0].quantities.paverStockAreaSqft??0)-model.quantities.paverPieces*face)<1e-6,`${product.id} ${unit.id}: order area is pieces x outline face (${face.toFixed(4)} sq ft), not the envelope`);if(product.id==='techo-diamond-paver')ok(Math.abs(face-unit.widthMm*unit.lengthMm/2/92903.04)<1e-9,'A Diamond rhombus orders half its rectangular envelope');}
  assert.equal(stones.filter(b=>b.renderContours).length,model.quantities.paverPieces);checks++;
  assert.equal(stones.filter(b=>!b.renderDuplicate).length,model.quantities.paverPieces);checks++;
 }
 if(bond)bonds++;
 if(!rectangularUnit(unit)){const f={...base,productId:product.id,hardscape:{finishId:finish.id,colorId:color.id,unitId:unit.id,patternId:'herringbone',jointMm:0,angleDeg:0}},data={...structuredClone(DEFAULT_DECK),houseVisible:false,yardFeatures:[f]};assert.deepEqual(parseDesign(serializeDesign(data)).yardFeatures,[f]);checks++;ok(buildYardModel(data).features[0].warnings.some(w=>w.includes('Legacy')),'Old envelope layout restores exactly with explicit legacy notice');}
 if(product.id==='techo-aquastorm-paver'){
  ok(contours.length>1,'Aquastorm retains the internal opening');const hole=contours[1];ok(yardArea(yardClip([hole],contours,'intersection'))<1e-6,'Concrete does not cover the opening');
 }
}
// A requested joint is the real perpendicular gap between facing edges for every shape-specific bond,
// measured from each interior stone edge's midpoint to the nearest neighbouring stone.
{
 type Pt={x:number;y:number};const segDist=(p:Pt,a:Pt,b:Pt)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
 const measured=new Set<string>();
 for(const product of HARDSCAPE_PRODUCTS)for(const finish of product.finishes)for(const unit of finish.units.filter(u=>hardscapeBody(u.role))){
  const profile=hardscapeProfile(product.id,unit),bond=shapedBond(product.id,unit),color=finish.colors.find(c=>!unit.colorIds||unit.colorIds.includes(c.id));if(!profile||!bond||!color||measured.has(product.id+unit.id))continue;measured.add(product.id+unit.id);
  for(const jointMm of [3,12])for(const angleDeg of [0,37]){
   const f={...base,xFt:0,zFt:0,widthFt:6,depthFt:6,productId:product.id,hardscape:{finishId:finish.id,colorId:color.id,unitId:unit.id,patternId:bond.id,angleDeg,jointMm}},stones=hardscapeBlanks(f).map(b=>hardscapeStockPolygons(product.id,unit,b.cx,b.cy,b.angle)[0]),gaps:number[]=[];
   for(const [i,st] of stones.entries()){const c={x:st.reduce((n,p)=>n+p.x,0)/st.length,y:st.reduce((n,p)=>n+p.y,0)/st.length};if(Math.hypot(c.x,c.y)>18)continue;for(let k=0;k<st.length;k++){const a=st[k],b=st[(k+1)%st.length];if(Math.hypot(b.x-a.x,b.y-a.y)<.3)continue;const m={x:(a.x+b.x)/2,y:(a.y+b.y)/2};let best=Infinity;for(const [n,o] of stones.entries())if(n!==i)for(let q=0;q<o.length;q++)best=Math.min(best,segDist(m,o[q],o[(q+1)%o.length]));gaps.push(best*25.4);}}
   ok(gaps.length>=8&&gaps.every(g=>Math.abs(g-jointMm)<.01),`${product.id} ${unit.id} ${bond.id} at ${angleDeg} degrees: every interior joint is the requested ${jointMm} mm (${Math.min(...gaps).toFixed(3)}..${Math.max(...gaps).toFixed(3)})`);
  }
 }
 ok(measured.size>=8,'Joint widths measured on every shape-specific bond');
}
// Clipper stores coordinates to 1e-5 in (0.00025 mm), so lengths are compared to 0.002 mm.
// Rotated rhombus stock (Techo Diamond, published 313 x 181 x 100 mm). Recipes are injected into the real
// finish because the outline comes from the product profile; a synthetic product would not be a rhombus.
{
 const product=HARDSCAPE_PRODUCTS.find(p=>p.id==='techo-diamond-paver')!,finish=product.finishes[0],unit=finish.units.find(u=>hardscapeBody(u.role))!,color=finish.colors[0];
 const L=unit.lengthMm,W=unit.widthMm,side=Math.hypot(L/2,W/2),area=L*W/2,acute=2*Math.atan2(W/2,L/2)*180/Math.PI;
 const half=acute/2;ok(L===313&&W===181&&Math.abs(side-180.783)<1e-3&&Math.abs(acute-60.0795)<1e-3,`Published Diamond envelope is the ${acute.toFixed(4)} degree rhombus 313 x 181 mm`);
 const env=(deg:number)=>{const a=deg*Math.PI/180,c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a));return {w:c*L+s*W,h:s*L+c*W};};
 // Recipe x/y is the upper-left of the rotated RECTANGULAR envelope (hardscapeLayout stockBounds), so a centre maps to an anchor.
 const cell=(cx:number,cy:number,rotationDeg:number)=>{const e=env(rotationDeg);return {unitId:unit.id,xMm:cx-e.w/2,yMm:cy-e.h/2,rotationDeg};};
 const withRecipe=<T,>(id:string,layout:{widthMm:number;depthMm:number;repeatBasisMm:[[number,number],[number,number]];cells:ReturnType<typeof cell>[]},run:()=>T)=>{const pattern={id,name:id,sourceUrl:'https://example.invalid/qa',layout:{...layout,jointMm:0}};finish.patterns.push(pattern);try{return run();}finally{finish.patterns.splice(finish.patterns.indexOf(pattern),1);}};
 const feature=(id:string,angleDeg:number,sizeFt=12):YardFeature=>({...base,widthFt:sizeFt,depthFt:sizeFt,productId:product.id,hardscape:{finishId:finish.id,colorId:color.id,unitId:unit.id,patternId:id,angleDeg,jointMm:0}});
 const paverBoxes=(f:YardFeature)=>buildYardModel({...structuredClone(DEFAULT_DECK),houseVisible:false,yardFeatures:[f]}).boxes.filter(b=>b.role==='paver');
 // Convex fragments partition each stone (overlap/coverage); the stone's full clipped outline is on its first fragment.
 const stonesOf=(f:YardFeature)=>paverBoxes(f).map(b=>b.polygon!),outlinesOf=(f:YardFeature)=>paverBoxes(f).flatMap(b=>b.renderContours??[]);
 const sq=(mm2:number)=>mm2/92903.04;
 // 1. Per-stone geometry at arbitrary cell rotations combined with the user's laying angle.
 for(const cellDeg of [0,half,60,90,120,360-half,359.999])for(const userDeg of [0,37,359])withRecipe('qa-rhombus-single',{widthMm:1000,depthMm:1000,repeatBasisMm:[[1000,0],[0,1000]],cells:[cell(500,500,cellDeg)]},()=>{
  const whole=outlinesOf(feature('qa-rhombus-single',userDeg,8)).filter(p=>Math.abs(yardArea([p])-sq(area))<1e-6);ok(whole.length>0,`Whole rhombi present at cell ${cellDeg} / user ${userDeg}`);
  for(const p of whole){const v=p.filter((q,i)=>{const a=p[(i+p.length-1)%p.length],b=p[(i+1)%p.length];return Math.abs((q.x-a.x)*(b.y-q.y)-(q.y-a.y)*(b.x-q.x))>1e-6;});ok(v.length===4,'A whole stone is a four-vertex rhombus');
   for(let i=0;i<4;i++)ok(Math.abs(Math.hypot(v[(i+1)%4].x-v[i].x,v[(i+1)%4].y-v[i].y)*25.4-side)<2e-3,'Each side keeps 180.783 mm (Clipper keeps coordinates to 1e-5 in)');
   const d1=Math.hypot(v[2].x-v[0].x,v[2].y-v[0].y)*25.4,d2=Math.hypot(v[3].x-v[1].x,v[3].y-v[1].y)*25.4,[lo,hi]=[Math.min(d1,d2),Math.max(d1,d2)];ok(Math.abs(hi-313)<2e-3&&Math.abs(lo-181)<2e-3,`Diagonals remain 313 and 181 mm (${hi.toFixed(5)}, ${lo.toFixed(5)})`);
   const [a,b]=d1>d2?[v[0],v[2]]:[v[1],v[3]],dir=Math.atan2(b.y-a.y,b.x-a.x),want=(cellDeg+userDeg)*Math.PI/180;ok(Math.abs(Math.sin(dir-want))<1e-6,`Long diagonal follows cell ${cellDeg} + user ${userDeg} degrees`);}
 });
 // 2. Three-orientation rhombille (cubic) set out on an exact 60 degree lattice from the published 181 mm dimension.
 const s181=181,basis:[[number,number],[number,number]]=[[s181*Math.sqrt(3),0],[s181*Math.sqrt(3)/2,1.5*s181]];
 const cube=(k:number)=>[cell(0,k*s181/2,0),cell(k*s181/2*Math.cos(Math.PI*7/6),k*s181/2*Math.sin(Math.PI*7/6),120),cell(k*s181/2*Math.cos(-Math.PI/6),k*s181/2*Math.sin(-Math.PI/6),60)];
 const tiled=(id:string,b:typeof basis,cells:ReturnType<typeof cell>[],userDeg:number)=>withRecipe(id,{widthMm:b[0][0],depthMm:b[1][1],repeatBasisMm:b,cells},()=>{const polys=stonesOf(feature(id,userDeg));return {overlap:yardArea(polys)-yardArea(yardClip(polys)),covered:yardArea(yardClip(polys)),polys};});
 const expectedFill=3*area/(basis[0][0]*basis[1][1]);ok(Math.abs(expectedFill-0.9984)<2e-4,'Published stones leave about 0.16% nominal clearance in the exact 60 degree set-out');
 for(const userDeg of [0,37,359]){const t=tiled('qa-rhombille',basis,cube(1),userDeg),inside=yardArea(yardClip(t.polys,[[{x:720-72,y:720-72},{x:720+72,y:720-72},{x:720+72,y:720+72},{x:720-72,y:720+72}]],'intersection'));
  ok(t.overlap<1e-4,`Rhombille at ${userDeg} degrees has no overlap (${t.overlap})`);ok(Math.abs(inside/(144*144/144)-expectedFill)<3e-3,`Interior coverage matches the documented clearance at ${userDeg} degrees (${inside/144})`);}
 // 3. Negative controls: each wrong construction must be detected by the same measurements.
 const tight:[[number,number],[number,number]]=[[313,0],[156.5,1.5*313/Math.sqrt(3)]];ok(tiled('qa-rhombille-313',tight,cube(313/Math.sqrt(3)/s181),0).overlap>1e-3,'A lattice built from 313 mm would overlap the published 181 mm stone');
 const rhombusBox=(cx:number,cy:number,deg:number)=>{const a=deg*Math.PI/180,pts=[[L/2,0],[0,W/2],[-L/2,0],[0,-W/2]].map(([x,y])=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)]),w=Math.max(...pts.map(p=>p[0]))-Math.min(...pts.map(p=>p[0])),h=Math.max(...pts.map(p=>p[1]))-Math.min(...pts.map(p=>p[1]));return {unitId:unit.id,xMm:cx-w/2,yMm:cy-h/2,rotationDeg:deg};};
 const wrongAnchors=[rhombusBox(0,s181/2,0),rhombusBox(s181/2*Math.cos(Math.PI*7/6),s181/2*Math.sin(Math.PI*7/6),120),rhombusBox(s181/2*Math.cos(-Math.PI/6),s181/2*Math.sin(-Math.PI/6),60)];
 ok(tiled('qa-rhombille-bad-anchor',basis,wrongAnchors,0).overlap>1e-3,'Anchoring rotated cells by the rhombus box instead of the rectangle envelope is detected');
 console.log(`Rotated rhombus: side ${side.toFixed(3)} mm, acute ${acute.toFixed(4)} deg, cubic set-out fill ${(expectedFill*100).toFixed(3)}%.`);
}
ok(profiles>=14,'All documented profile records exercised');ok(bonds>=8,'Shape-specific stock bonds exercised');console.log(`${checks} original shape checks passed across ${profiles} stock variants and ${bonds} shape-specific bonds.`);
