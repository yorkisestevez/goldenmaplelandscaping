/**
 * Natural stone boulder library. Five CC0 Poly Haven rock scans become three-LOD GLBs that DeckCraft colours by stone
 * type: the base colour map is turned into a grey luminance map with a linear mean of 0.5, so an instance colour of
 * twice the stone's own colour reproduces that colour on average (Landscape3D boulderTint). Geometry is simplified with
 * meshoptimizer and stored with meshopt compression and quantization, the same tools that built natural-boulder.
 * Each shape's fill share (closed scan volume over its bounding box) is measured here, so the takeoff can estimate a
 * weight from the planned envelope. natural-boulder and manifest.json are left untouched; this writes its own manifest.
 *
 * Usage: node scripts/build-boulder-library.mjs [sourceCacheDir]
 * Downloads the 1k glTF sets through the public Poly Haven API into the cache (default: <tmp>/deckcraft-boulder-src).
 */
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import sharp from 'sharp';
import {NodeIO} from '@gltf-transform/core';
import {EXTMeshoptCompression,KHRMeshQuantization} from '@gltf-transform/extensions';
import {meshopt,prune,simplify,transformPrimitive,weld} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptSimplifier} from 'meshoptimizer';

const OUT=resolve('public/deckcraft/landscape');
const SRC=resolve(process.argv[2]??join(tmpdir(),'deckcraft-boulder-src'));
/** Triangle and texture budgets match natural-boulder's three levels. */
const LODS=[{triangles:10370,textureLimit:512},{triangles:3240,textureLimit:256},{triangles:810,textureLimit:128}];
const SHAPES=[
 {id:'boulder-fieldstone-round',sourceId:'namaqualand_boulder_06',note:'Rounded loaf-shaped boulder; reads as glacial fieldstone.'},
 {id:'boulder-fieldstone-dome',sourceId:'namaqualand_boulder_04',note:'Broad weathered dome; lichen in the source photo becomes darker grey patches.'},
 {id:'boulder-quarried-block',sourceId:'namaqualand_boulder_03',note:'Blocky flat-topped stone, the same scan as natural-boulder, rebuilt for stone colouring.'},
 {id:'boulder-quarried-fractured',sourceId:'boulder_01',note:'Jagged fractured faces; reads as blasted or quarried rock.'},
 {id:'boulder-bench',sourceId:'namaqualand_boulder_05',note:'Low slab with a flat top at seat height.'},
];

const sha256=(bytes)=>createHash('sha256').update(bytes).digest('hex');
async function fetchBytes(url){const response=await fetch(url);if(!response.ok)throw Error(`${url}: HTTP ${response.status}`);return Buffer.from(await response.arrayBuffer());}

/** Downloads (once) the 1k glTF, its bin and textures, keeping Poly Haven's relative layout. */
async function download(sourceId){
 const response=await fetch(`https://api.polyhaven.com/files/${sourceId}`);if(!response.ok)throw Error(`${sourceId}: Poly Haven API HTTP ${response.status}`);
 const files=await response.json(),set=files.gltf?.['1k']?.gltf;
 if(!set)throw Error(`${sourceId}: no 1k glTF on Poly Haven`);
 const dir=join(SRC,sourceId),gltfPath=join(dir,`${sourceId}_1k.gltf`);mkdirSync(dir,{recursive:true});
 const records=[];
 for(const [rel,file] of [[`${sourceId}_1k.gltf`,set],...Object.entries(set.include??{})]){
  const path=join(dir,rel);mkdirSync(dirname(path),{recursive:true});
  if(!existsSync(path))writeFileSync(path,await fetchBytes(file.url));
  const bytes=readFileSync(path);
  if(createHash('md5').update(bytes).digest('hex')!==file.md5)throw Error(`${rel}: MD5 does not match Poly Haven's record`);
  records.push({url:file.url,sha256:sha256(bytes),bytes:bytes.length});
 }
 return {gltfPath,descriptor:records[0],records};
}

/** Linear-light grey with mean 0.5, so instance colour × 2 gives the stone colour on average. */
async function luminanceMap(jpeg,size){
 // Normalise at the final size: resizing averages sRGB values, which would darken small levels after the fact.
 const {data,info}=await sharp(jpeg).removeAlpha().resize(size,size,{kernel:'lanczos3'}).raw().toBuffer({resolveWithObject:true});
 const toLinear=(v)=>{const c=v/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;},toSrgb=(c)=>Math.round(255*(c<=.0031308?c*12.92:1.055*c**(1/2.4)-.055));
 const lum=new Float32Array(info.width*info.height);let sum=0;
 for(let i=0;i<lum.length;i++){lum[i]=.2126*toLinear(data[i*3])+.7152*toLinear(data[i*3+1])+.0722*toLinear(data[i*3+2]);sum+=lum[i];}
 // Bright texels clip at 1, so solve for the scale whose clipped mean is 0.5 (a plain mean ratio lands 2–6 % dark).
 const clippedMean=(k)=>{let t=0;for(let i=0;i<lum.length;i++)t+=Math.min(1,lum[i]*k);return t/lum.length;};
 let low=.5/(sum/lum.length),high=low*4;for(let step=0;step<40;step++){const mid=(low+high)/2;if(clippedMean(mid)<.5)low=mid;else high=mid;}
 const scale=(low+high)/2,out=Buffer.alloc(lum.length*3);
 for(let i=0;i<lum.length;i++){const v=toSrgb(Math.min(1,lum[i]*scale));out[i*3]=out[i*3+1]=out[i*3+2]=v;}
 return sharp(out,{raw:{width:info.width,height:info.height,channels:3}}).jpeg({quality:88,mozjpeg:true}).toBuffer();
}
const resized=(jpeg,size)=>sharp(jpeg).resize(size,size,{kernel:'lanczos3'}).jpeg({quality:88,mozjpeg:true}).toBuffer();

const triangleCount=(document)=>document.getRoot().listMeshes().reduce((n,m)=>n+m.listPrimitives().reduce((s,p)=>s+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0),0);

/** Scan volume over bounding-box volume, from the welded LOD0 surface (signed volume about the base centre, so an
 * open underside adds nothing). */
function fillShare(document){
 const prim=document.getRoot().listMeshes()[0].listPrimitives()[0],pos=prim.getAttribute('POSITION'),idx=prim.getIndices();
 const min=pos.getMinNormalized([]),max=pos.getMaxNormalized([]),o=[(min[0]+max[0])/2,min[1],(min[2]+max[2])/2],a=[],b=[],c=[];
 let volume=0;
 for(let i=0;i<idx.getCount();i+=3){
  pos.getElement(idx.getScalar(i),a);pos.getElement(idx.getScalar(i+1),b);pos.getElement(idx.getScalar(i+2),c);
  for(const v of [a,b,c])for(let k=0;k<3;k++)v[k]-=o[k];
  volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
 }
 return Math.abs(volume)/((max[0]-min[0])*(max[1]-min[1])*(max[2]-min[2]));
}

/** Area-weighted smooth normals, shared by every vertex at one position so UV seams do not show as creases. */
function smoothNormals(document,prim){
 const pos=prim.getAttribute('POSITION'),idx=prim.getIndices(),count=pos.getCount(),sums=new Map(),keys=new Array(count),a=[],b=[],c=[];
 for(let i=0;i<count;i++){pos.getElement(i,a);keys[i]=a.map(v=>v.toFixed(6)).join(',');if(!sums.has(keys[i]))sums.set(keys[i],[0,0,0]);}
 for(let i=0;i<idx.getCount();i+=3){
  const ia=idx.getScalar(i),ib=idx.getScalar(i+1),ic=idx.getScalar(i+2);pos.getElement(ia,a);pos.getElement(ib,b);pos.getElement(ic,c);
  const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]],n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  for(const vi of [ia,ib,ic]){const s=sums.get(keys[vi]);for(let k=0;k<3;k++)s[k]+=n[k];}
 }
 const out=new Float32Array(count*3);
 for(let i=0;i<count;i++){const s=sums.get(keys[i]),len=Math.hypot(...s)||1;for(let k=0;k<3;k++)out[i*3+k]=s[k]/len;}
 prim.setAttribute('NORMAL',document.createAccessor().setType('VEC3').setArray(out).setBuffer(pos.getBuffer()));
}

async function buildLod(io,gltfPath,lod,textures){
 const document=await io.read(gltfPath),root=document.getRoot(),nodes=root.listNodes().filter(n=>n.getMesh());
 if(nodes.length!==1||nodes[0].getMesh().listPrimitives().length!==1)throw Error(`${gltfPath}: expected one mesh node with one primitive`);
 const node=nodes[0],prim=node.getMesh().listPrimitives()[0];
 // Scan normals split many vertices (boulder_01 is split at nearly every vertex), which blocks simplification; smooth
 // normals are rebuilt from the simplified surface and the normal map carries the detail.
 for(const attribute of ['COLOR_0','NORMAL'])if(prim.getAttribute(attribute))prim.setAttribute(attribute,null);
 transformPrimitive(prim,node.getWorldMatrix());node.setMatrix([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
 for(const n of root.listNodes())if(n!==node&&!n.getMesh())n.setMatrix([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
 const min=prim.getAttribute('POSITION').getMinNormalized([]),max=prim.getAttribute('POSITION').getMaxNormalized([]);
 transformPrimitive(prim,[1,0,0,0,0,1,0,0,0,0,1,0,-(min[0]+max[0])/2,-min[1],-(min[2]+max[2])/2,1]);
 await document.transform(weld());
 const source=triangleCount(document);
 if(source>lod.triangles*1.1){
  let low=0,high=1,best=null;
  for(let step=0;step<14;step++){
   const ratio=(low+high)/2,trial=await io.readBinary(await io.writeBinary(document));
   await trial.transform(simplify({simplifier:MeshoptSimplifier,ratio,error:1}));const tris=triangleCount(trial);
   if(!best||Math.abs(tris-lod.triangles)<Math.abs(best.tris-lod.triangles))best={ratio,tris};
   if(Math.abs(tris-lod.triangles)<=lod.triangles*.03)break;if(tris>lod.triangles)high=ratio;else low=ratio;
  }
  await document.transform(simplify({simplifier:MeshoptSimplifier,ratio:best.ratio,error:1}));
 }
 smoothNormals(document,prim);
 const fill=fillShare(document),material=prim.getMaterial();
 material.setMetallicFactor(0).setDoubleSided(true).setEmissiveTexture(null).setOcclusionTexture(null);
 const set=(texture,bytes)=>texture.setImage(bytes).setMimeType('image/jpeg').setURI('');
 set(material.getBaseColorTexture(),await luminanceMap(textures.diff,lod.textureLimit));
 set(material.getNormalTexture(),await resized(textures.nor,lod.textureLimit));
 set(material.getMetallicRoughnessTexture(),await resized(textures.arm,lod.textureLimit));
 await document.transform(prune(),meshopt({encoder:MeshoptEncoder,level:'medium'}));
 const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
 for(const m of root.listMeshes())for(const p of m.listPrimitives()){const pos=p.getAttribute('POSITION'),mn=pos.getMinNormalized([]),mx=pos.getMaxNormalized([]),scale=node.getScale(),offset=node.getTranslation();for(let k=0;k<3;k++){bounds.min[k]=Math.min(bounds.min[k],mn[k]*scale[k]+offset[k]);bounds.max[k]=Math.max(bounds.max[k],mx[k]*scale[k]+offset[k]);}}
 return {glb:await io.writeBinary(document),triangles:triangleCount(document),bounds,fill};
}

await MeshoptEncoder.ready;await MeshoptSimplifier.ready;
const io=new NodeIO().registerExtensions([EXTMeshoptCompression,KHRMeshQuantization]).registerDependencies({'meshopt.encoder':MeshoptEncoder});
const manifest={created:new Date().toISOString().slice(0,10),license:'CC0-1.0',note:'Natural stone boulder shapes. Base colour maps are grey luminance (linear mean 0.5) for stone-type tinting. fillShare is scan volume over bounding-box volume, measured on LOD0.',assets:[],originalDownloads:[]};
for(const shape of SHAPES){
 const {gltfPath,descriptor,records}=await download(shape.sourceId),dir=dirname(gltfPath),texture=(suffix)=>readFileSync(join(dir,'textures',`${shape.sourceId}_${suffix}_1k.jpg`));
 const textures={diff:texture('diff'),nor:texture('nor_gl'),arm:texture('arm')},lods=[];let fill;
 for(const [level,lod] of LODS.entries()){
  const built=await buildLod(io,gltfPath,lod,textures),uri=`${shape.id}-lod${level}.glb`;
  writeFileSync(join(OUT,uri),built.glb);if(level===0)fill=built.fill;
  lods.push({uri,bytes:built.glb.length,sha256:sha256(built.glb),triangles:built.triangles,bounds:built.bounds,textureLimit:lod.textureLimit});
  console.log(shape.id,'lod'+level,built.triangles,'tris',built.glb.length,'bytes','fill',built.fill.toFixed(3));
 }
 const size=lods[0].bounds.max.map((v,k)=>v-lods[0].bounds.min[k]);
 manifest.assets.push({id:shape.id,sourceId:shape.sourceId,sourceURL:`https://polyhaven.com/a/${shape.sourceId}`,license:'CC0-1.0',licenseURL:'https://polyhaven.com/license',selectedSourceNode:0,lods,fillShare:Number(fill.toFixed(4)),sizeM:size.map(v=>Number(v.toFixed(3))),genericVisualProxy:true,sourceDescriptor:descriptor,note:shape.note});
 manifest.originalDownloads.push(...records.map(r=>({sourceId:shape.sourceId,...r})));
}
writeFileSync(join(OUT,'boulder-library-manifest.json'),JSON.stringify(manifest,null,1)+'\n');
console.log(JSON.stringify(manifest.assets.map(a=>({id:a.id,triangles:a.lods.map(l=>l.triangles),bytes:a.lods.reduce((n,l)=>n+l.bytes,0),fillShare:a.fillShare,sizeM:a.sizeM}))));
