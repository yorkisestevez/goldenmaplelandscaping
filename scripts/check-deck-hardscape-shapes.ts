import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {YardFeature} from '../src/features/deckcraft/types';
import {HARDSCAPE_PRODUCTS,hardscapeBody,hardscapeProblem,rectangularUnit} from '../src/features/deckcraft/hardscapeCatalogue';
import {hardscapeProfile,hardscapeStockPolygons,shapedBond} from '../src/features/deckcraft/hardscapeShapes';
import {buildYardModel,yardClip,yardArea} from '../src/features/deckcraft/yardModel';
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
  assert.equal(stones.filter(b=>b.renderContours).length,model.quantities.paverPieces);checks++;
  assert.equal(stones.filter(b=>!b.renderDuplicate).length,model.quantities.paverPieces);checks++;
 }
 if(bond)bonds++;
 if(!rectangularUnit(unit)){const f={...base,productId:product.id,hardscape:{finishId:finish.id,colorId:color.id,unitId:unit.id,patternId:'herringbone',jointMm:0,angleDeg:0}},data={...structuredClone(DEFAULT_DECK),houseVisible:false,yardFeatures:[f]};assert.deepEqual(parseDesign(serializeDesign(data)).yardFeatures,[f]);checks++;ok(buildYardModel(data).features[0].warnings.some(w=>w.includes('Legacy')),'Old envelope layout restores exactly with explicit legacy notice');}
 if(product.id==='techo-aquastorm-paver'){
  ok(contours.length>1,'Aquastorm retains the internal opening');const hole=contours[1];ok(yardArea(yardClip([hole],contours,'intersection'))<1e-6,'Concrete does not cover the opening');
 }
}
ok(profiles>=14,'All documented profile records exercised');ok(bonds>=8,'Shape-specific stock bonds exercised');console.log(`${checks} original shape checks passed across ${profiles} stock variants and ${bonds} shape-specific bonds.`);
