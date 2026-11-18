import type {EstimateResult} from './calculations';
import {deckExportMeshes,type ExportMesh} from './designExports';
import type {DeckTakeoff} from './deckTakeoff';
import type {DeckData} from './types';
import {connectorRowId,stockRowId} from './schedule';

const inchToMetre=.0254;
const finite=(n:number)=>{if(!Number.isFinite(n))throw new Error('The model contains an invalid coordinate.');return n;};
const num=(n:number)=>Number(finite(n).toFixed(6)).toString();
const xml=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));

type Surface={positions:number[];normals:number[];uvs:number[];indices:number[]};
/** Separate corners preserve the flat faces of framing, hardware and extruded boards. */
function surface(mesh:ExportMesh,unit:number):Surface{
  const positions:number[]=[],normals:number[]=[],uvs:number[]=[],indices:number[]=[];
  for(const face of mesh.faces){
    if(face.length<3||face.some(index=>!Number.isInteger(index)||index<0||index>=mesh.vertices.length))throw new Error(`Invalid face in ${mesh.name}.`);
    for(let i=1;i<face.length-1;i++){
      const points=[mesh.vertices[face[0]],mesh.vertices[face[i]],mesh.vertices[face[i+1]]];
      const a=points[0],b=points[1],c=points[2],u={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},v={x:c.x-a.x,y:c.y-a.y,z:c.z-a.z};
      const cross={x:u.y*v.z-u.z*v.y,y:u.z*v.x-u.x*v.z,z:u.x*v.y-u.y*v.x},length=Math.hypot(cross.x,cross.y,cross.z);
      if(length<1e-9)continue;
      const normal=[cross.x/length,cross.y/length,cross.z/length],dominant=normal.map(Math.abs).indexOf(Math.max(...normal));
      for(const p of points){
        positions.push(finite(p.x*unit),finite(p.y*unit),finite(p.z*unit));
        normals.push(...normal);
        // Planar UVs in metres; one texture repeat represents one metre of surface.
        uvs.push(...(dominant===0?[p.z*inchToMetre,p.y*inchToMetre]:dominant===1?[p.x*inchToMetre,p.z*inchToMetre]:[p.x*inchToMetre,p.y*inchToMetre]));
        indices.push(indices.length);
      }
    }
  }
  if(!indices.length)throw new Error(`No drawable faces in ${mesh.name}.`);
  return {positions,normals,uvs,indices};
}

const MATERIALS=[
  {name:'Deck finish',color:[.62,.43,.25,1]},
  {name:'Framing timber',color:[.69,.56,.38,1]},
  {name:'Concrete',color:[.58,.59,.57,1]},
  {name:'Coated metal',color:[.24,.28,.30,1]},
  {name:'Glass',color:[.69,.82,.85,.42]},
  {name:'House',color:[.75,.71,.65,1]},
  {name:'Site',color:[.42,.50,.36,1]},
  {name:'Other',color:[.60,.56,.48,1]},
] as const;
function materialIndex(name:string):number{
  if(name.startsWith('house_'))return 5;
  if(name.startsWith('yard_'))return 6;
  if(name.includes('glass_panel')||name.startsWith('privacy_panel'))return 4;
  if(name.includes('concrete_pier')||name.includes('deck_block'))return 2;
  if(/hanger|bolt|clip|screw|flashing|post_base|shoe|spigot|bracket|pile_|extra_metal|aluminum_pergola|light_/.test(name))return 3;
  if(/board|tread|riser|skirting_face|cladding|fascia/.test(name))return 0;
  if(/joist|beam|blocking|rim|post|stringer|rail|baluster|wood|backing/.test(name))return 1;
  return 7;
}

type ExportMaterial={name:string;color:readonly number[];roughness?:number;poolRole?:string;planning?:boolean};
/** Optional pool materials preserve legacy palette/order for every no-pool file. */
function modelMaterials(meshes:ExportMesh[]){const materials:ExportMaterial[]=[...MATERIALS],index=new Map<string,number>(),indices=meshes.map(mesh=>{const p=mesh as ExportMesh&{poolId?:string;role?:string;color?:string;planning?:boolean};if(!p.poolId)return materialIndex(mesh.name);const key=[p.role,p.color,p.planning].join('/'),old=index.get(key);if(old!==undefined)return old;const hex=p.color?.replace('#',''),color=hex&&/^[0-9a-f]{6}$/i.test(hex)?[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255):[.55,.75,.8],water=p.role==='water',id=materials.push({name:`Pool ${p.role}${p.planning?' (planning proxy)':''}`,color:[...color,water?.58:1],roughness:water?.075:p.role==='floor'||p.role==='wall'?.27:.86,poolRole:p.role,planning:p.planning})-1;index.set(key,id);return id;});return {materials,indices};}

/** COLLADA 1.4.1 geometry, Y up, with the source model's inch unit declared for CAD importers. */
export function exportDeckCollada(data:DeckData,model:DeckTakeoff):string{
  const meshes=deckExportMeshes(data,model),issued=new Date().toISOString(),palette=modelMaterials(meshes);
  const geometry=meshes.map((mesh,i)=>{
    const id=`deck-part-${i}`,s=surface(mesh,1),mat=`material-${palette.indices[i]}`;
    const source=(suffix:string,values:number[],params:string[])=>`<source id="${id}-${suffix}"><float_array id="${id}-${suffix}-array" count="${values.length}">${values.map(num).join(' ')}</float_array><technique_common><accessor source="#${id}-${suffix}-array" count="${values.length/params.length}" stride="${params.length}">${params.map(p=>`<param name="${p}" type="float"/>`).join('')}</accessor></technique_common></source>`;
    return `<geometry id="${id}" name="${xml(mesh.name)}"><mesh>${source('positions',s.positions,['X','Y','Z'])}${source('normals',s.normals,['X','Y','Z'])}${source('uvs',s.uvs,['S','T'])}<vertices id="${id}-vertices"><input semantic="POSITION" source="#${id}-positions"/></vertices><triangles material="${mat}" count="${s.indices.length/3}"><input semantic="VERTEX" source="#${id}-vertices" offset="0"/><input semantic="NORMAL" source="#${id}-normals" offset="1"/><input semantic="TEXCOORD" source="#${id}-uvs" offset="2" set="0"/><p>${s.indices.flatMap(index=>[index,index,index]).join(' ')}</p></triangles></mesh></geometry>`;
  }).join('');
  const effects=palette.materials.map((m,i)=>`<effect id="effect-${i}"><profile_COMMON><technique sid="common"><lambert><diffuse><color>${m.color.join(' ')}</color></diffuse>${m.poolRole==='water'?'<transparent opaque="A_ONE"><color>1 1 1 0.58</color></transparent><transparency><float>1</float></transparency>':''}</lambert></technique></profile_COMMON></effect>`).join('');
  const materials=palette.materials.map((m,i)=>`<material id="material-${i}" name="${xml(m.name)}"><instance_effect url="#effect-${i}"/></material>`).join('');
  const nodes=meshes.map((mesh,i)=>{const material=`material-${palette.indices[i]}`;return `<node id="deck-node-${i}" name="${xml(mesh.name)}"><instance_geometry url="#deck-part-${i}"><bind_material><technique_common><instance_material symbol="${material}" target="#${material}"/></technique_common></bind_material></instance_geometry></node>`;}).join('');
  return `<?xml version="1.0" encoding="utf-8"?><COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1"><asset><contributor><authoring_tool>DeckCraft</authoring_tool></contributor><created>${issued}</created><modified>${issued}</modified><unit name="inch" meter="0.0254"/><up_axis>Y_UP</up_axis></asset><library_effects>${effects}</library_effects><library_materials>${materials}</library_materials><library_geometries>${geometry}</library_geometries><library_visual_scenes><visual_scene id="DeckCraftScene">${nodes}</visual_scene></library_visual_scenes><scene><instance_visual_scene url="#DeckCraftScene"/></scene></COLLADA>`;
}

const aligned=(n:number)=>(n+3)&~3;
/** Binary glTF 2.0; model inches become metres, so standard viewers display the right size. */
export function exportDeckGlb(data:DeckData,model:DeckTakeoff):ArrayBuffer{
  const meshes=deckExportMeshes(data,model),chunks:Uint8Array[]=[],bufferViews:{buffer:number;byteOffset:number;byteLength:number;target:number}[]=[],accessors:object[]=[],meshDefs:object[]=[],nodes:object[]=[];
  const palette=modelMaterials(meshes);let byteLength=0;
  const append=(bytes:Uint8Array,target:number)=>{const offset=byteLength;chunks.push(bytes);bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.byteLength,target});byteLength+=bytes.byteLength;return bufferViews.length-1;};
  for(const [meshIndex,mesh] of meshes.entries()){
    const s=surface(mesh,inchToMetre),positions=new Float32Array(s.positions),normals=new Float32Array(s.normals),uvs=new Float32Array(s.uvs),indices=new Uint32Array(s.indices),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<positions.length;i++){const axis=i%3;min[axis]=Math.min(min[axis],positions[i]);max[axis]=Math.max(max[axis],positions[i]);}
    const positionView=append(new Uint8Array(positions.buffer),34962),normalView=append(new Uint8Array(normals.buffer),34962),uvView=append(new Uint8Array(uvs.buffer),34962),indexView=append(new Uint8Array(indices.buffer),34963);
    const positionAccessor=accessors.push({bufferView:positionView,componentType:5126,count:positions.length/3,type:'VEC3',min,max})-1;
    const normalAccessor=accessors.push({bufferView:normalView,componentType:5126,count:normals.length/3,type:'VEC3'})-1;
    const uvAccessor=accessors.push({bufferView:uvView,componentType:5126,count:uvs.length/2,type:'VEC2'})-1;
    const indexAccessor=accessors.push({bufferView:indexView,componentType:5125,count:indices.length,type:'SCALAR'})-1;
    meshDefs.push({name:mesh.name,primitives:[{attributes:{POSITION:positionAccessor,NORMAL:normalAccessor,TEXCOORD_0:uvAccessor},indices:indexAccessor,material:palette.indices[meshIndex],mode:4}]});
    nodes.push({name:mesh.name,mesh:meshDefs.length-1});
  }
  const materials=palette.materials.map(m=>({name:m.name,pbrMetallicRoughness:{baseColorFactor:m.color,metallicFactor:m.name==='Coated metal'?.65:0,roughnessFactor:m.roughness??(m.name==='Glass'?.2:.85)},...(m.color[3]<1?{alphaMode:'BLEND' as const,doubleSided:true}:{}),...(m.poolRole?{extras:{poolRole:m.poolRole,planning:m.planning},doubleSided:true}:{})}));
  const gltf={asset:{version:'2.0',generator:'DeckCraft'},scene:0,scenes:[{nodes:nodes.map((_,i)=>i)}],nodes,meshes:meshDefs,materials,buffers:[{byteLength}],bufferViews,accessors};
  const encoded=new TextEncoder().encode(JSON.stringify(gltf)),jsonLength=aligned(encoded.length),binLength=aligned(byteLength);
  const result=new ArrayBuffer(12+8+jsonLength+8+binLength),view=new DataView(result),out=new Uint8Array(result);
  view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,result.byteLength,true);
  view.setUint32(12,jsonLength,true);view.setUint32(16,0x4e4f534a,true);out.fill(0x20,20,20+jsonLength);out.set(encoded,20);
  const binStart=20+jsonLength;view.setUint32(binStart,binLength,true);view.setUint32(binStart+4,0x004e4942,true);
  let offset=binStart+8;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.byteLength;}
  return result;
}

export type DeckCsvKind='materials'|'cuts'|'connectors';
const cell=(value:unknown)=>{let text=String(value??'');if(/^[=+\-@\t\r]/.test(text))text=`'${text}`;return `"${text.replaceAll('"','""')}"`;};
const csv=(rows:unknown[][])=>rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
/** Quantity-only CSVs: rates read as allowance, confirmed (a recorded quote) or quote required, and private costs are never exported. */
export function exportDeckCsv(estimate:EstimateResult,kind:DeckCsvKind):string{
  if(kind==='materials')return csv([['estimate item ID','section','item','specification','quantity','unit','status','drawing schedule row'],...estimate.sections.flatMap((section,sectionIndex)=>section.items.flatMap((item,itemIndex)=>Number(item.qty)>0?[[`M-${sectionIndex+1}-${itemIndex+1}`,section.title,item.name,item.spec,item.qty,item.unit,item.quoteResolved?'confirmed':item.cost===null?'quote required':'allowance',estimate.connectorSchedule.some(row=>row.name===item.name)?connectorRowId(item.name):'']]:[]))]);
  if(kind==='connectors')return csv([['schedule row ID','drawing sheet','connector','quantity','unit','status','selection basis'],...estimate.connectorSchedule.map(row=>[connectorRowId(row.name),'S-6',row.name,row.qty,row.unit,row.quoteResolved?'confirmed':row.rate===null?'quote required':'allowance',row.basis])]);
  return csv([['schedule row ID','drawing sheet','section','item','stock length (in)','stock piece','cut lengths (in)','ordered pieces','status'],...estimate.stockSchedule.flatMap(row=>[
    // Mixed listed lengths: each stock piece is bought at its own length (binLengthsIn), as priced.
    ...row.cutsIn.map((cuts,i)=>[stockRowId(row),row.name==='Framing lumber'?'S-6':'',row.section,row.name,row.binLengthsIn?.[i]??row.stockLengthIn,i+1,cuts.map(num).join(' + '),row.orderedPieces,'planned']),
    ...row.unresolvedIn.map(length=>[stockRowId(row),row.name==='Framing lumber'?'S-6':'',row.section,row.name,row.stockLengthIn,'',num(length),row.orderedPieces,'stock length to confirm']),
  ])]);
}
