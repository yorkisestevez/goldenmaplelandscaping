/**
 * Plant library v2. CC0 Poly Haven photographs become alpha-tested (MASK) meshes.
 * The shipped shrub_02 scan is a few twigs; hedges and shrubs are rebuilt as
 * filled summer volumes. One selected source plant is kept per downloaded model.
 * LODs are fewer cards or a coarser mesh. LOD2 is a crossed-card impostor that
 * still fills the silhouette. No prices are written.
 */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import sharp from 'sharp';

const OUT=resolve('public/deckcraft/landscape');
const SRC='/tmp/plant-src';
const rng=(seed)=>{let a=seed>>>0;return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};};

function parseGlb(path){
 const b=readFileSync(path),jsonLen=b.readUInt32LE(12),json=JSON.parse(b.subarray(20,20+jsonLen).toString()),bin=b.subarray(28+jsonLen);
 return {json,bin};
}
function imageBytes(json,bin,source){
 const img=json.images[source],v=json.bufferViews[img.bufferView];
 return Buffer.from(bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength));
}

function readAccessor(g,bin,index){
 const a=g.accessors[index],bv=g.bufferViews[a.bufferView],start=(bv.byteOffset||0)+(a.byteOffset||0),comps={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
 const size={5126:4,5123:2,5125:4,5121:1,5122:2}[a.componentType],stride=bv.byteStride||size*comps;
 const out=new Array(a.count);
 for(let i=0;i<a.count;i++){
  const view=new DataView(bin.buffer,bin.byteOffset+start+i*stride,size*comps),row=[];
  for(let c=0;c<comps;c++){
   const o=c*size;let v=a.componentType===5126?view.getFloat32(o,true):a.componentType===5123?view.getUint16(o,true):a.componentType===5125?view.getUint32(o,true):a.componentType===5121?view.getUint8(o):view.getInt16(o,true);
   if(a.normalized)v=a.componentType===5122?Math.max(v/32767,-1):a.componentType===5123?v/65535:a.componentType===5121?v/255:v;
   row.push(v);
  }
  out[i]=row;
 }
 return out;
}

function loadNode(dir,id,nodeIndex){
 const g=JSON.parse(readFileSync(`${dir}/${id}/${id}_1k.gltf`,'utf8'));
 const bin=readFileSync(`${dir}/${id}/${g.buffers[0].uri}`);
 const node=g.nodes[nodeIndex],mesh=g.meshes[node.mesh],prim=mesh.primitives[0];
 const t=node.translation||[0,0,0];
 const pos=readAccessor(g,bin,prim.attributes.POSITION).map(p=>[p[0]+t[0],p[1]+t[1],p[2]+t[2]]);
 const uv=readAccessor(g,bin,prim.attributes.TEXCOORD_0);
 const nrm=prim.attributes.NORMAL!==undefined?readAccessor(g,bin,prim.attributes.NORMAL):pos.map(()=>[0,1,0]);
 const idx=readAccessor(g,bin,prim.indices).map(v=>v[0]);
 return {pos,uv,nrm,idx,triangles:idx.length/3};
}

function packMesh(pos,uv,nrm,idx){
 return {positions:pos.flat(),uvs:uv.flat(),normals:nrm.flat(),indices:idx};
}
function boundsOf(pos){
 const b={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
 for(const p of pos)for(let k=0;k<3;k++){b.min[k]=Math.min(b.min[k],p[k]);b.max[k]=Math.max(b.max[k],p[k]);}
 return b;
}
function decimate(mesh,cell){
 const {pos,uv,nrm,idx}=mesh,map=new Map(),verts=[];
 const vid=i=>{const p=pos[i],k=`${Math.round(p[0]/cell)}:${Math.round(p[1]/cell)}:${Math.round(p[2]/cell)}`;
  if(map.has(k)){const id=map.get(k),v=verts[id];v.u+=uv[i][0];v.v+=uv[i][1];v.nx+=nrm[i][0];v.ny+=nrm[i][1];v.nz+=nrm[i][2];v.n++;return id;}
  const id=verts.length;map.set(k,id);verts.push({x:p[0],y:p[1],z:p[2],u:uv[i][0],v:uv[i][1],nx:nrm[i][0],ny:nrm[i][1],nz:nrm[i][2],n:1});return id;};
 const indices=[];
 for(let t=0;t<idx.length;t+=3){const a=vid(idx[t]),b=vid(idx[t+1]),c=vid(idx[t+2]);if(a!==b&&b!==c&&a!==c)indices.push(a,b,c);}
 const positions=[],uvs=[],normals=[];
 for(const v of verts){const n=Math.hypot(v.nx,v.ny,v.nz)||1;positions.push(v.x,v.y,v.z);uvs.push(v.u/v.n,v.v/v.n);normals.push(v.nx/n,v.ny/n,v.nz/n);}
 return {positions,uvs,normals,indices,triangles:indices.length/3};
}

async function spritesFromPng(buffer,limit=8){
 const {data,info}=await sharp(buffer).ensureAlpha().resize(160,160,{fit:'fill'}).raw().toBuffer({resolveWithObject:true});
 const w=info.width,h=info.height,seen=new Uint8Array(w*h),boxes=[];
 const alpha=i=>data[i*4+3];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const s=y*w+x;if(seen[s]||alpha(s)<48)continue;
  let minX=x,maxX=x,minY=y,maxY=y,n=0,stack=[s];seen[s]=1;
  while(stack.length){const p=stack.pop(),px=p%w,py=(p/w)|0;n++;minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=px+dx,ny=py+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const q=ny*w+nx;if(!seen[q]&&alpha(q)>=48){seen[q]=1;stack.push(q);}}}
  const bw=maxX-minX+1,bh=maxY-minY+1;if(n>40&&bw>4&&bh>4&&bw<w*.85&&bh<h*.85)boxes.push({minX,minY,maxX,maxY,n});
 }
 boxes.sort((a,b)=>b.n-a.n);
 const picked=boxes.slice(0,limit).map(b=>({u0:b.minX/w,u1:(b.maxX+1)/w,v1:1-b.minY/h,v0:1-(b.maxY+1)/h}));
 if(picked.length>=limit)return picked;
 const grid=[],cells=6;
 for(let gy=0;gy<cells;gy++)for(let gx=0;gx<cells;gx++){
  let n=0,opaque=0;const x0=gx/cells,y0=gy/cells;
  for(let y=Math.floor(y0*h);y<Math.floor((gy+1)/cells*h);y++)for(let x=Math.floor(x0*w);x<Math.floor((gx+1)/cells*w);x++){n++;if(alpha(y*w+x)>80)opaque++;}
  const cover=opaque/n;if(cover>0.08&&cover<0.72)grid.push({u0:x0,u1:(gx+1)/cells,v0:1-(gy+1)/cells,v1:1-y0,cover});
 }
 grid.sort((a,b)=>Math.abs(b.cover-0.28)-Math.abs(a.cover-0.28));
 return [...picked,...grid].slice(0,Math.max(limit,4));
}

function scatter(form,count,sprites,seed){
 const random=rng(seed),positions=[],uvs=[],normals=[],colors=[],indices=[];
 const push=(center,right,up,rect,col)=>{
  const nrm=cross(right,up),len=Math.hypot(...nrm)||1,normal=nrm.map(v=>v/len);
  const corners=[[-1,-1],[1,-1],[1,1],[-1,1]];
  const base=positions.length/3;
  const uv=[[rect.u0,rect.v0],[rect.u1,rect.v0],[rect.u1,rect.v1],[rect.u0,rect.v1]];
  for(let i=0;i<4;i++){const [sx,sy]=corners[i];positions.push(center[0]+right[0]*sx+up[0]*sy,center[1]+right[1]*sx+up[1]*sy,center[2]+right[2]*sx+up[2]*sy);uvs.push(uv[i][0],uv[i][1]);normals.push(...normal);colors.push(...col);}
  indices.push(base,base+1,base+2,base,base+2,base+3);
 };
 let placed=0,guard=0;
 while(placed<count&&guard<count*80){
  guard++;
  let y=form==='hosta'?random()*.62:form==='pine'?0.18+random()*.82:random();
  const ang=random()*Math.PI*2;let rad=random();
  let r=0.48,plume=false;
  if(form==='column'){const lump=.74+.3*Math.sin(ang*3.1+y*5.5)+.14*Math.sin(ang*8-y*3);r=.4*lump*(1-.16*y*y);if(rad<.28&&random()<.72)continue;rad=Math.pow(rad,.62);}
  else if(form==='ball'){const dy=y-.48,lump=.86+.22*Math.sin(ang*4+y*3);r=Math.sqrt(Math.max(0,.22-dy*dy))*lump;if(rad<.3&&random()<.6)continue;rad=Math.pow(rad,.7);}
  else if(form==='mound'){const dy=(y-.28)/.66,lump=.82+.28*Math.sin(ang*3.4+1.7);r=(dy*dy>1?0:.52*Math.sqrt(1-dy*dy))*lump;if(rad<.25&&random()<.55)continue;rad=Math.pow(rad,.72);}
  else if(form==='pine'){r=.5*Math.pow(1-Math.max(0,y-.12)/.88,.72)*(.72+.22*Math.sin(ang*5+y*4));rad=Math.pow(rad,.75);}
  else if(form==='hosta')r=.5*(1-y*.45)*(.7+.3*random());
  else if(form==='reed'){plume=random()<.46;if(plume){y=.68+random()*.3;r=.22*(.35+random());}else{y=random()*.08;r=.2*(.25+random());}}
  if(rad>1||r<0.02)continue;
  const x=Math.cos(ang)*r*rad,z=Math.sin(ang)*r*rad;
  const rect=sprites[(random()*sprites.length)|0];
  const yaw=random()*Math.PI,tilt=form==='hosta'?.9+random()*.5:form==='reed'?(plume?.45+random()*.9:(random()-.5)*.35):(random()-.5)*.5;
  const size=form==='hosta'?.22+random()*.12:form==='column'||form==='ball'?.075+random()*.06:form==='pine'?.1+random()*.08:form==='reed'?(plume?.055+random()*.045:.012+random()*.008):.1+random()*.08;
  const tall=form==='reed'?(plume?.1+random()*.09:.58+random()*.26):form==='hosta'?size*.62:size*(form==='pine'?1.35:1.15);
  const tone=.88+random()*.24,warm=(random()-.5)*.16,col=[tone*(1+warm),tone*(1.04+warm*.25),tone*(.88-warm)];
  const c=Math.cos(yaw),s=Math.sin(yaw),ct=Math.cos(tilt),st=Math.sin(tilt);
  const right=[c*size,0,-s*size],right2=[s*size,0,c*size],up=[s*st*tall,ct*tall,c*st*tall];
  const center=[x,y,z];
  push(center,right,up,rect,col);push(center,right2,up,rect,col);
  placed++;
 }
 return {positions,uvs,normals,colors,indices,triangles:indices.length/3,cards:placed};
}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}

function trunk(sides=8){
 const positions=[],uvs=[],normals=[],indices=[];
 for(let i=0;i<=sides;i++){
  const a=i/sides*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
  for(const [y,r] of [[0,0.045],[0.22,0.038],[1,0.012]]){positions.push(c*r,y,s*r);uvs.push(i/sides,y);normals.push(c,0,s);}
 }
 const row=3;
 for(let i=0;i<sides;i++)for(let k=0;k<row-1;k++){
  const a=i*row+k;indices.push(a,a+row,a+1,a+1,a+row,a+row+1);
 }
 return {positions,uvs,normals,indices,triangles:indices.length/3};
}

function align(n){return (n+3)&~3;}
function writeGlb(file,parts,images,materials){
 const binParts=[],bufferViews=[],accessors=[],meshes=[],nodes=[];
 let offset=0;
 const view=(data,target)=>{const byteOffset=offset,bytes=Buffer.from(data.buffer,data.byteOffset,data.byteLength);binParts.push(bytes);const padded=align(bytes.length);if(padded>bytes.length)binParts.push(Buffer.alloc(padded-bytes.length));bufferViews.push({buffer:0,byteOffset,byteLength:bytes.length,...(target?{target}:{})});offset+=padded;return bufferViews.length-1;};
 const acc=(viewIndex,componentType,type,count,min,max)=>{accessors.push({bufferView:viewIndex,componentType,count,type,...(min?{min,max}:{})});return accessors.length-1;};
 const meshNodes=[];
 parts.forEach((part,pi)=>{
  const pos=new Float32Array(part.positions),uv=new Float32Array(part.uvs),nrm=new Float32Array(part.normals);
  const big=part.indices.length>65535,idx=big?new Uint32Array(part.indices):new Uint16Array(part.indices);
  let pmin=[Infinity,Infinity,Infinity],pmax=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<pos.length;i+=3)for(let k=0;k<3;k++){pmin[k]=Math.min(pmin[k],pos[i+k]);pmax[k]=Math.max(pmax[k],pos[i+k]);}
  const attributes={POSITION:acc(view(pos,34962),5126,'VEC3',pos.length/3,pmin,pmax),NORMAL:acc(view(nrm,34962),5126,'VEC3',nrm.length/3),TEXCOORD_0:acc(view(uv,34962),5126,'VEC2',uv.length/2)};
  if(part.colors){const col=new Float32Array(part.colors);attributes.COLOR_0=acc(view(col,34962),5126,'VEC3',col.length/3);}
  const primitives=[{attributes,indices:acc(view(idx,34963),big?5125:5123,'SCALAR',idx.length),material:part.material??0,mode:4}];
  meshes.push({name:part.name||'foliage',primitives});nodes.push({name:part.name||'foliage',mesh:meshes.length-1});meshNodes.push(nodes.length-1);
 });
 const imageViews=images.map(img=>{const id=view(img);return id;});
 const gltfImages=imageViews.map((bufferView,i)=>({bufferView,mimeType:images[i].mime||'image/png'}));
 const textures=gltfImages.map((_,i)=>({source:i,sampler:0}));
 const json={asset:{version:'2.0',generator:'DeckCraft plant library v2'},scene:0,scenes:[{nodes:meshNodes}],nodes,meshes,materials,images:gltfImages,textures,samplers:[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}],buffers:[{byteLength:offset}],bufferViews,accessors};
 const jsonBuf=Buffer.from(JSON.stringify(json)),jsonPad=align(jsonBuf.length),bin=Buffer.concat(binParts),binPad=align(bin.length);
 const total=12+8+jsonPad+8+binPad,out=Buffer.alloc(total);
 out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(total,8);
 out.writeUInt32LE(jsonPad,12);out.writeUInt32LE(0x4E4F534A,16);out.fill(0x20,20,20+jsonPad);jsonBuf.copy(out,20);out.writeUInt32LE(binPad,20+jsonPad);out.writeUInt32LE(0x004E4942,24+jsonPad);bin.copy(out,28+jsonPad);
 writeFileSync(file,out);
 return {bytes:out.length,triangles:parts.reduce((n,p)=>n+p.indices.length/3,0),bounds:(()=>{let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const p of parts)for(let i=0;i<p.positions.length;i+=3)for(let k=0;k<3;k++){min[k]=Math.min(min[k],p.positions[i+k]);max[k]=Math.max(max[k],p.positions[i+k]);}return {min,max};})(),sha256:createHash('sha256').update(out).digest('hex')};
}

const MASK=(name)=>({name,alphaMode:'MASK',alphaCutoff:0.4,doubleSided:true,pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:0.62}});
const OPAQUE=(name)=>({name,doubleSided:true,pbrMetallicRoughness:{baseColorFactor:[0.42,0.3,0.2,1],metallicFactor:0,roughnessFactor:0.9}});

async function pngSize(buffer,size){
 const img=sharp(buffer).ensureAlpha().resize(size,size,{fit:'fill'});
 return img.png({compressionLevel:9,palette:false}).toBuffer();
}

async function occupancy(mesh,file){
 const w=180,h=220,px=Buffer.alloc(w*h*3,245);
 let minY=Infinity,maxY=-Infinity;for(let i=1;i<mesh.positions.length;i+=3){minY=Math.min(minY,mesh.positions[i]);maxY=Math.max(maxY,mesh.positions[i]);}if(!Number.isFinite(maxY))maxY=1;
 for(let i=0;i<mesh.indices.length;i+=3){
  const c=[0,0,0];
  for(const k of [0,1,2]){const v=mesh.indices[i+k];c[0]+=mesh.positions[v*3];c[1]+=mesh.positions[v*3+1];c[2]+=mesh.positions[v*3+2];}
  const x=Math.max(0,Math.min(w-1,((c[0]/3+0.6)/1.2)*w)),y=Math.max(0,Math.min(h-1,h-1-((c[1]/3-minY)/(maxY-minY+0.001))*(h-8)-4));
  const o=(y|0)*w+(x|0);px[o*3]=40;px[o*3+1]=110;px[o*3+2]=50;
 }
 await sharp(px,{raw:{width:w,height:h,channels:3}}).png().toFile(file);
}

const manifest=JSON.parse(readFileSync(OUT+'/manifest.json','utf8'));
const reports=[];

async function emitScatter(id,sourceId,sourceURL,form,sprites,texture,counts,seed){
 const lods=[];
 for(let lod=0;lod<3;lod++){
  const mesh=scatter(form,counts[lod],sprites,seed+lod*17);
  mesh.name=lod===2?'impostor':'foliage';
  const parts=[mesh];
  const materials=[MASK(id)];
  if(form==='pine'&&lod<2){const t=trunk();t.name='trunk';t.material=1;parts.push(t);materials.push(OPAQUE('bark'));}
  const limit=[256,128,64][lod];
  const png=await pngSize(texture,limit);
  const file=`${id}-lod${lod}.glb`;
  const built=writeGlb(`${OUT}/${file}`,parts,[png],materials);
  await occupancy(mesh,`/tmp/plant-prev/${id}-lod${lod}.png`);
  lods.push({uri:file,bytes:built.bytes,sha256:built.sha256,triangles:built.triangles,bounds:built.bounds,textureLimit:limit,foliage:[{cards:mesh.cards,triangles:mesh.triangles,alphaMode:'MASK',alphaCutoff:0.4,impostor:lod===2}]});
  console.log(id,'lod'+lod,built.triangles,'tris',built.bytes,'bytes',mesh.cards,'cards');
 }
 reports.push({id,triangles:lods.map(l=>l.triangles)});
 const entry={id,sourceId,sourceURL,license:'CC0-1.0',licenseURL:'https://polyhaven.com/license',lods,genericVisualProxy:true,library:'plant-v2',note:'Alpha-tested photographed cards. Not a nursery SKU.'};
 const at=manifest.assets.findIndex(a=>a.id===id);
 if(at>=0)manifest.assets[at]=entry;else manifest.assets.push(entry);
}

async function emitImported(id,sourceId,sourceURL,nodeIndex,pngPath,limits){
 const loaded=loadNode(SRC,sourceId,nodeIndex);
 const alphaStats=await sharp(readFileSync(pngPath)).ensureAlpha().extractChannel('alpha').stats();
 const masked=alphaStats.channels[0].min<30&&alphaStats.channels[0].max>240;
 const size=boundsOf(loaded.pos),diag=Math.hypot(size.max[0]-size.min[0],size.max[1]-size.min[1],size.max[2]-size.min[2]);
 const cells=[diag/180,diag/70,diag/28];
 const lods=[];
 for(let lod=0;lod<3;lod++){
  const mesh=lod===0&&loaded.triangles<14000?packMesh(loaded.pos,loaded.uv,loaded.nrm,loaded.idx):decimate(loaded,cells[lod]);
  mesh.name=lod===2?'impostor':'foliage';
  const limit=limits[lod];
  const png=await pngSize(readFileSync(pngPath),limit);
  const file=`${id}-lod${lod}.glb`;
  const built=writeGlb(`${OUT}/${file}`,[mesh],[png],[masked?MASK(id):OPAQUE(id)]);
  await occupancy(mesh,`/tmp/plant-prev/${id}-lod${lod}.png`);
  lods.push({uri:file,bytes:built.bytes,sha256:built.sha256,triangles:built.triangles,bounds:built.bounds,textureLimit:limit,foliage:[{triangles:mesh.triangles??mesh.indices.length/3,alphaMode:masked?'MASK':'OPAQUE',alphaCutoff:masked?0.4:0,impostor:lod===2,selectedSourceNode:nodeIndex}]});
  console.log(id,'lod'+lod,built.triangles,'tris',built.bytes);
 }
 reports.push({id,triangles:lods.map(l=>l.triangles)});
 const entry={id,sourceId,sourceURL,license:'CC0-1.0',licenseURL:'https://polyhaven.com/license',selectedSourceNode:nodeIndex,lods,genericVisualProxy:true,library:'plant-v2',note:masked?'One photographed source plant. Source blend was converted to alpha-test so foliage does not sort.':'One photographed source plant. Solid geometry stays opaque; no transparent blending.'};
 const at=manifest.assets.findIndex(a=>a.id===id);
 if(at>=0)manifest.assets[at]=entry;else manifest.assets.push(entry);
}

const leafGlb=parseGlb(OUT+'/deciduous-tree-lod0.glb');
const leafImg=leafGlb.json.images[leafGlb.json.textures[leafGlb.json.materials[1].pbrMetallicRoughness.baseColorTexture.index].source];
const leafPng=imageBytes(leafGlb.json,leafGlb.bin,leafGlb.json.textures[leafGlb.json.materials[1].pbrMetallicRoughness.baseColorTexture.index].source);
const needleGlb=parseGlb(OUT+'/conifer-tree-lod0.glb');
const needleSource=needleGlb.json.textures[needleGlb.json.materials[1].pbrMetallicRoughness.baseColorTexture.index].source;
const needlePng=imageBytes(needleGlb.json,needleGlb.bin,needleSource);
const needleSprites=[[0.18,0.035,0.39,0.32],[0.65,0.035,0.97,0.38],[0.49,0.2,0.62,0.38],[0.35,0.255,0.48,0.415],[0.17,0.405,0.635,0.81],[0.625,0.445,0.997,0.885]].map(([u0,v0,u1,v1])=>({u0,v0,u1,v1}));
const leafSprites=await spritesFromPng(leafPng,10);
console.log('leaf sprites',leafSprites.length,'needle sprites',needleSprites.length);
if(leafSprites.length<4)throw Error('Leaf atlas did not yield enough opaque sprites');

await emitScatter('rounded-shrub','tree_small_02','https://polyhaven.com/a/tree_small_02','mound',leafSprites,leafPng,[520,220,90],11);
await emitScatter('hedge-shrub','fir_tree_01','https://polyhaven.com/a/fir_tree_01','column',needleSprites,needlePng,[780,300,120],29);
await emitScatter('evergreen-shrub','fir_tree_01','https://polyhaven.com/a/fir_tree_01','ball',needleSprites,needlePng,[640,240,100],47);
await emitScatter('pine-tree','fir_tree_01','https://polyhaven.com/a/fir_tree_01','pine',needleSprites,needlePng,[700,260,100],71);
await emitScatter('hosta-clump','tree_small_02','https://polyhaven.com/a/tree_small_02','hosta',leafSprites.slice(0,4),leafPng,[48,22,10],91);
const grassGlb=parseGlb(OUT+'/grass-clump-lod0.glb');
const grassPng=imageBytes(grassGlb.json,grassGlb.bin,grassGlb.json.textures[grassGlb.json.materials[0].pbrMetallicRoughness.baseColorTexture.index].source);
const grassSprites=await spritesFromPng(grassPng,6);
if(grassSprites.length<2)throw Error('Grass atlas did not yield sprites');
await emitScatter('reed-grass','grass_medium_01','https://polyhaven.com/a/grass_medium_01','reed',grassSprites,grassPng,[220,80,32],101);

await emitImported('fern-clump','fern_02','https://polyhaven.com/a/fern_02',0,`${SRC}/fern_02_diff.png`,[512,256,128]);
await emitImported('perennial-bloom','periwinkle_plant','https://polyhaven.com/a/periwinkle_plant',5,`${SRC}/periwinkle_plant_diff.png`,[512,256,128]);
await emitImported('perennial-gold','celandine_01','https://polyhaven.com/a/celandine_01',2,`${SRC}/celandine_01_diff.png`,[512,256,128]);

manifest.created='2026-10-09';
manifest.library='plant-v2';
writeFileSync(OUT+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
writeFileSync('/tmp/plant-library-report.json',JSON.stringify(reports,null,2));
console.log(JSON.stringify(reports,null,2));
void leafImg;
