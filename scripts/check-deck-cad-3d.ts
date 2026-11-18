import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {deckExportMeshes} from '../src/features/deckcraft/designExports';
import {exportDeckCollada,exportDeckCsv,exportDeckGlb} from '../src/features/deckcraft/cadExports';
import {connectorRowId,stockRowId,constructionStock} from '../src/features/deckcraft/schedule';
import {scheduleTables} from '../src/features/deckcraft/drawings/schedules';

for(const [name,patch] of [['default',{}],['wrap-around glass',{width:34,length:12,wrap:{left:{widthFt:8,runFt:10}},railingType:'Glass Panels'}]] as const){
  const data={...structuredClone(DEFAULT_DECK),...patch},estimate=calculateEstimate(data),meshes=deckExportMeshes(data,estimate.model);
  const dae=exportDeckCollada(data,estimate.model);
  assert(dae.startsWith('<?xml')&&dae.includes('<unit name="inch" meter="0.0254"/>')&&dae.includes('<up_axis>Y_UP</up_axis>'));
  assert.equal((dae.match(/<geometry id=/g)??[]).length,meshes.length,`${name}: one COLLADA geometry per model part`);
  assert.equal((dae.match(/<instance_geometry /g)??[]).length,meshes.length,`${name}: every geometry is placed in the scene`);
  assert(dae.includes('<library_materials>')&&dae.includes('semantic="NORMAL"')&&dae.includes('semantic="TEXCOORD"'),`${name}: COLLADA has materials, normals and UVs`);

  const glb=exportDeckGlb(data,estimate.model),view=new DataView(glb),bytes=new Uint8Array(glb);
  assert.equal(view.getUint32(0,true),0x46546c67);assert.equal(view.getUint32(4,true),2);assert.equal(view.getUint32(8,true),glb.byteLength);
  const jsonLength=view.getUint32(12,true);assert.equal(view.getUint32(16,true),0x4e4f534a);
  const json=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+jsonLength)).trim());
  const binAt=20+jsonLength;assert.equal(view.getUint32(binAt+4,true),0x004e4942);
  assert.equal(view.getUint32(binAt,true)+binAt+8,glb.byteLength);
  assert.equal(json.asset.version,'2.0');assert.equal(json.meshes.length,meshes.length);assert.equal(json.nodes.length,meshes.length);
  assert(json.materials.length>=6,`${name}: named material palette`);
  assert.equal(json.buffers[0].byteLength,json.bufferViews.reduce((sum:number,v:{byteLength:number})=>sum+v.byteLength,0));
  for(const [i,mesh] of meshes.entries()){
    const primitive=json.meshes[i].primitives[0],position=json.accessors[primitive.attributes.POSITION],indices=json.accessors[primitive.indices];
    assert.equal(position.count,indices.count);assert(position.count>0);
    assert.equal(json.accessors[primitive.attributes.NORMAL].count,position.count);
    assert.equal(json.accessors[primitive.attributes.TEXCOORD_0].count,position.count);
    assert(Number.isInteger(primitive.material)&&primitive.material<json.materials.length);
    assert(position.min.every((v:number,axis:number)=>Math.abs(v-Math.min(...mesh.vertices.map(p=>[p.x,p.y,p.z][axis]*.0254)))<1e-5));
    const positionView=json.bufferViews[position.bufferView];
    for(let vertex=0;vertex<position.count;vertex++)for(let axis=0;axis<3;axis++){
      const stored=view.getFloat32(binAt+8+positionView.byteOffset+vertex*12+axis*4,true);
      assert(stored>=position.min[axis]&&stored<=position.max[axis],`${name}: float32 position is inside its accessor bounds`);
    }
  }
  for(const kind of ['materials','cuts','connectors'] as const){
    const csv=exportDeckCsv(estimate,kind);
    assert(csv.endsWith('\r\n')&&csv.split('\r\n').length>2,`${name}: ${kind} CSV has rows`);
    assert(!/^"cost"|,"cost"|"rate"/i.test(csv.split('\r\n')[0]),`${name}: ${kind} CSV omits private costs`);
  }
  const tables=scheduleTables(data,estimate.model,{railingName:'Test guard'});
  const connections=tables.find(t=>t.title==='CONNECTIONS')!;
  assert.equal(new Set(estimate.connectorSchedule.map(r=>connectorRowId(r.name))).size,estimate.connectorSchedule.length,`${name}: connector IDs are unique`);
  for(const row of estimate.connectorSchedule){
    const id=connectorRowId(row.name);
    assert(connections.rows.some(r=>r[0]===`${row.name} [${id}]`&&r[1]===String(row.qty)),`${name}: S-6 and estimate reconcile ${id}`);
    assert(exportDeckCsv(estimate,'connectors').includes(`"${id}","S-6","${row.name}","${row.qty}"`),`${name}: connector CSV links to S-6 ${id}`);
  }
  const framing=constructionStock(estimate.model),lumber=tables.find(t=>t.title==='FRAMING LUMBER')!;
  assert.equal(new Set(framing.map(stockRowId)).size,framing.length,`${name}: framing IDs are unique`);
  for(const row of framing){
    const id=stockRowId(row);
    assert(lumber.rows.some(r=>r[0].includes(`[${id}]`)&&r[2]===String(row.orderedPieces)),`${name}: S-6 and stock plan reconcile ${id}`);
    assert(exportDeckCsv(estimate,'cuts').includes(`"${id}","S-6"`),`${name}: cut CSV links to S-6 ${id}`);
  }
}
console.log('Deck CAD exports: COLLADA, GLB and three quantity CSVs passed');
