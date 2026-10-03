// THROWAWAY G0 spike (branch spike/photo-mode, never merged): path-traced "Photo mode" feasibility.
// Flattens the live R3F scene (instances expanded, merged per material) into three-gpu-pathtracer on a separate
// WebGLRenderer/canvas, measures every stage and returns PNG data URLs plus timings.
// @ts-nocheck -- spike code; three-mesh-bvh deep imports have no typings.
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {FullScreenQuad} from 'three/examples/jsm/postprocessing/Pass.js';
import {WebGLPathTracer,DenoiseMaterial,GradientEquirectTexture,PathTracingSceneGenerator} from 'three-gpu-pathtracer';
import {CubeToEquirectGenerator} from 'three-gpu-pathtracer/src/utils/CubeToEquirectGenerator.js';
import {MeshBVH,SAH} from 'three-mesh-bvh';
import {GenerateMeshBVHWorker} from 'three-mesh-bvh/src/workers/GenerateMeshBVHWorker.js';
import {WorkerBase} from 'three-mesh-bvh/src/workers/utils/WorkerBase.js';

export const SPIKE_VERSION='g0-1';

/** Our own worker entry (a one-line wrapper round three-mesh-bvh's worker script), so Vite sees the URL in app source. */
class OwnBVHWorker extends WorkerBase{
  constructor(){super(new Worker(new URL('./photoBvh.worker.ts',import.meta.url),{type:'module'}));this.name='OwnBVHWorker';}
  runTask(worker,geometry,options){return GenerateMeshBVHWorker.prototype.runTask.call(this,worker,geometry,options);}
}

const now=()=>performance.now();
const yieldNow=()=>new Promise<void>(r=>{const c=new MessageChannel();c.port1.onmessage=()=>r();c.port2.postMessage(0);});

const _m=new THREE.Matrix4(),_inst=new THREE.Matrix4(),_nm=new THREE.Matrix3(),_v=new THREE.Vector3(),_c=new THREE.Color(),_vc=new THREE.Color();

interface Bucket{material:THREE.Material;geoms:THREE.BufferGeometry[];source:string}

/** Bakes one mesh (every instance of an InstancedMesh) into world-space, indexed, non-interleaved geometry. */
function bakeMesh(mesh:THREE.Mesh,material:THREE.Material,group:{start:number;count:number}|null,wantColor:boolean){
  const src=mesh.geometry as THREE.BufferGeometry;
  const pos=src.getAttribute('position');if(!pos||pos.count===0)return null;
  let nrm=src.getAttribute('normal');
  if(!nrm){const g=src.clone();g.computeVertexNormals();nrm=g.getAttribute('normal');}
  const uv=src.getAttribute('uv'),col=src.getAttribute('color');
  const inst=(mesh as any).isInstancedMesh?mesh as THREE.InstancedMesh:null;
  const count=inst?inst.count:1;if(count<=0)return null;
  const V=pos.count;
  const start=group?group.start:0,end=group?Math.min(start+group.count,src.index?src.index.count:V):(src.index?src.index.count:V);
  const idxLen=end-start;if(idxLen<3)return null;
  const P=new Float32Array(count*V*3),N=new Float32Array(count*V*3),U=new Float32Array(count*V*2),C=wantColor?new Float32Array(count*V*4):null,I=new Uint32Array(count*idxLen);
  const useVertexColor=!!col&&(material as any).vertexColors;
  for(let k=0;k<count;k++){
    if(inst){inst.getMatrixAt(k,_inst);_m.multiplyMatrices(mesh.matrixWorld,_inst);}else _m.copy(mesh.matrixWorld);
    _nm.getNormalMatrix(_m);
    const flip=_m.determinant()<0;
    if(C){if(inst?.instanceColor)inst.getColorAt(k,_c);else _c.setRGB(1,1,1);}
    const vo=k*V;
    for(let v=0;v<V;v++){
      _v.fromBufferAttribute(pos,v).applyMatrix4(_m);P[(vo+v)*3]=_v.x;P[(vo+v)*3+1]=_v.y;P[(vo+v)*3+2]=_v.z;
      _v.fromBufferAttribute(nrm,v).applyMatrix3(_nm).normalize();N[(vo+v)*3]=_v.x;N[(vo+v)*3+1]=_v.y;N[(vo+v)*3+2]=_v.z;
      if(uv){U[(vo+v)*2]=uv.getX(v);U[(vo+v)*2+1]=uv.getY(v);}
      if(C){const o4=(vo+v)*4;if(useVertexColor){_vc.fromBufferAttribute(col,v);C[o4]=_c.r*_vc.r;C[o4+1]=_c.g*_vc.g;C[o4+2]=_c.b*_vc.b;}else{C[o4]=_c.r;C[o4+1]=_c.g;C[o4+2]=_c.b;}C[o4+3]=1;}
    }
    const io=k*idxLen,index=src.index;
    for(let t=0;t<idxLen;t+=3){
      const a=index?index.getX(start+t):start+t,b=index?index.getX(start+t+1):start+t+1,c=index?index.getX(start+t+2):start+t+2;
      I[io+t]=vo+a;I[io+t+1]=vo+(flip?c:b);I[io+t+2]=vo+(flip?b:c);
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('normal',new THREE.BufferAttribute(N,3));g.setAttribute('uv',new THREE.BufferAttribute(U,2));
  // RGBA on purpose: three-gpu-pathtracer 0.0.24's mergeGeometries drops itemSize-3 colours (its 3->4 branch writes the wrong way) -> black.
  if(C)g.setAttribute('color',new THREE.BufferAttribute(C,4));
  g.setIndex(new THREE.BufferAttribute(I,1));
  return g;
}

function underFixtures(o:THREE.Object3D){for(let p:THREE.Object3D|null=o;p;p=p.parent)if(p.name==='selected-in-lite-products')return true;return false;}

/** The path tracer packs every texture into one RepeatWrapping array, so MirroredRepeat (board strips) turns into hard
 * seams. Bake the mirror: a 2x wide texture (image + flipped copy) at half the repeat is the same pattern under Repeat. */
const mirrorCache=new Map<THREE.Texture,THREE.Texture>();
function unmirror(t:THREE.Texture|null,report:any){
  if(!t||(t.wrapS!==THREE.MirroredRepeatWrapping&&t.wrapT!==THREE.MirroredRepeatWrapping))return t;
  const hit=mirrorCache.get(t);if(hit)return hit;
  const img:any=t.image;if(!img?.width)return t;
  const mx=t.wrapS===THREE.MirroredRepeatWrapping,my=t.wrapT===THREE.MirroredRepeatWrapping;
  const c=document.createElement('canvas');c.width=img.width*(mx?2:1);c.height=img.height*(my?2:1);const x=c.getContext('2d')!;
  for(let i=0;i<(mx?2:1);i++)for(let j=0;j<(my?2:1);j++){x.save();x.translate(i?c.width:0,j?c.height:0);x.scale(i?-1:1,j?-1:1);x.drawImage(img,0,0);x.restore();}
  const d=new THREE.CanvasTexture(c);d.colorSpace=t.colorSpace;d.wrapS=THREE.RepeatWrapping;d.wrapT=my?THREE.RepeatWrapping:t.wrapT;
  d.repeat.set(t.repeat.x*(mx?.5:1),t.repeat.y*(my?.5:1));d.offset.set(t.offset.x*(mx?.5:1),t.offset.y*(my?.5:1));d.rotation=t.rotation;d.center.copy(t.center);d.flipY=t.flipY;d.needsUpdate=true;
  mirrorCache.set(t,d);report.unmirrored++;return d;
}

/** Photo copy of a live material: bump dropped (the path tracer has no bump), vertex colours for baked instance colours. */
function convertMaterial(m:THREE.Material,vc:boolean,fixture:boolean,report:any,fixMirror=false){
  const c:any=m.clone();
  if(fixMirror)for(const k of ['map','roughnessMap','normalMap','metalnessMap','emissiveMap','alphaMap'])if(c[k])c[k]=unmirror(c[k],report);
  if(c.bumpMap&&!c.normalMap){c.bumpMap=null;report.bumpDropped++;}
  if(vc)c.vertexColors=true;
  // Fixture housings/lenses must not block their own light (the live lights sit inside the housings).
  if(fixture)c.castShadow=false;
  if(c.transmission>0)report.transmissive.push({name:m.name||m.type,transmission:c.transmission,opacity:c.opacity,transparent:c.transparent});
  if(c.emissive&&c.emissiveIntensity>0&&(c.emissive.r+c.emissive.g+c.emissive.b)>0)report.emissive.push({type:m.type,emissive:'#'+c.emissive.getHexString(),intensity:c.emissiveIntensity});
  return c;
}

export function buildPhotoScene(live:THREE.Scene,opts:{expandInstances?:boolean;fixMirror?:boolean}={}){
  const t0=now();
  live.updateMatrixWorld(true);
  const buckets=new Map<string,Bucket>();
  const report:any={meshes:0,instancedMeshes:0,instances:0,skipped:[],bumpDropped:0,transmissive:[],emissive:[],multiMaterial:0,uv1:0,interleaved:0,materials:0,unmirrored:0};
  const matCache=new Map<string,THREE.Material>();
  const photo=new THREE.Scene();
  const passthrough:THREE.Object3D[]=[];
  live.traverseVisible(o=>{
    const mesh=o as THREE.Mesh;
    if(!(mesh as any).isMesh)return;
    if((mesh as any).isInstancedMesh&&opts.expandInstances===false){passthrough.push(mesh);return;}
    const geom=mesh.geometry as THREE.BufferGeometry;
    if(geom.getAttribute('position')?.isInterleavedBufferAttribute){report.interleaved++;}
    if(geom.getAttribute('uv1'))report.uv1++;
    const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    const groups=Array.isArray(mesh.material)?(geom.groups.length?geom.groups:[{start:0,count:Infinity,materialIndex:0}]):[null];
    if(Array.isArray(mesh.material))report.multiMaterial++;
    report.meshes++;
    if((mesh as any).isInstancedMesh){report.instancedMeshes++;report.instances+=(mesh as THREE.InstancedMesh).count;}
    const fixture=underFixtures(mesh);
    for(const g of groups){
      const mat=g?mats[g.materialIndex??0]:mats[0];
      if(!mat||mat.visible===false||(mat as any).colorWrite===false||((mat as any).transparent&&mat.opacity===0)){report.skipped.push(mesh.name||mesh.type);continue;}
      const vc=!!(mesh as any).instanceColor||(!!geom.getAttribute('color')&&(mat as any).vertexColors);
      const key=`${mat.uuid}|${vc?'vc':''}|${fixture?'fx':''}`;
      let photoMat=matCache.get(key);if(!photoMat){photoMat=convertMaterial(mat,vc,fixture,report,opts.fixMirror);matCache.set(key,photoMat);}
      const baked=bakeMesh(mesh,mat,g&&g.count!==Infinity?g:null,vc);if(!baked)continue;
      let b=buckets.get(key);if(!b){b={material:photoMat,geoms:[],source:mesh.name||mesh.parent?.name||mesh.type};buckets.set(key,b);}
      b.geoms.push(baked);
    }
  });
  let tris=0;
  for(const b of buckets.values()){
    const merged=b.geoms.length===1?b.geoms[0]:mergeGeometries(b.geoms,false);
    if(!merged){report.skipped.push('merge-failed:'+b.source);continue;}
    if(b.geoms.length>1)b.geoms.forEach(g=>g.dispose());
    tris+=merged.index!.count/3;
    const m=new THREE.Mesh(merged,b.material);m.name=b.source;photo.add(m);
  }
  for(const m of passthrough){const c=(m as THREE.InstancedMesh).clone();m.matrixWorld.decompose(c.position,c.quaternion,c.scale);photo.add(c);}
  report.materials=buckets.size;
  photo.updateMatrixWorld(true);
  return {photo,tris,report,buildMs:now()-t0};
}

/** Live lights copied with world transforms. Hemisphere lights are returned separately (the path tracer has none). */
function copyLights(live:THREE.Scene,photo:THREE.Scene,opts:{lightRadius:number}){
  const out:any={directional:0,spot:0,point:0,hemi:null as any};
  const p=new THREE.Vector3(),t=new THREE.Vector3();
  live.traverseVisible(o=>{
    const l=o as any;
    if(l.isHemisphereLight){out.hemi={sky:l.color.clone(),ground:l.groundColor.clone(),intensity:l.intensity};return;}
    if(l.isDirectionalLight){const d=new THREE.DirectionalLight(l.color.clone(),l.intensity);l.getWorldPosition(p);d.position.copy(p);l.target.updateMatrixWorld();d.target.position.setFromMatrixPosition(l.target.matrixWorld);photo.add(d,d.target);out.directional++;return;}
    if(l.isSpotLight){const s=new THREE.SpotLight(l.color.clone(),l.intensity,l.distance,l.angle,l.penumbra,l.decay);l.getWorldPosition(p);s.position.copy(p);l.target.updateMatrixWorld();s.target.position.setFromMatrixPosition(l.target.matrixWorld);(s as any).radius=opts.lightRadius;photo.add(s,s.target);out.spot++;return;}
    if(l.isPointLight){const q=new THREE.PointLight(l.color.clone(),l.intensity,l.distance,l.decay);l.getWorldPosition(p);q.position.copy(p);(q as any).radius=opts.lightRadius;photo.add(q);out.point++;return;}
  });
  return out;
}

/** Environment for the photo. 'live' reads the drei Lightformer cube (a GPU render target) back through the LIVE renderer
 * into a CPU float equirect and adds the hemisphere light as a sky/ground gradient (radiance = colour*intensity/pi). */
function buildEnvironment(live:THREE.Scene,liveGl:THREE.WebGLRenderer,hemi:any,mode:string){
  const t0=now();
  const W=512,H=256,data=new Float32Array(W*H*4);
  let source='none';
  const envIntensity=(live as any).environmentIntensity??1;
  if(mode==='live'&&live.environment&&(live.environment as any).isCubeTexture){
    const eq=new CubeToEquirectGenerator(liveGl).generate(live.environment,W,H);
    const half=eq.image.data as Uint16Array;
    for(let i=0;i<half.length;i++)data[i]=THREE.DataUtils.fromHalfFloat(half[i])*((i&3)===3?1:envIntensity);
    eq.dispose();source='live-cube→equirect';
  }else if(mode==='gradient'){
    source='gradient-only';
  }
  if(hemi){
    const k=hemi.intensity/Math.PI;
    for(let y=0;y<H;y++){const dirY=-Math.cos((y+.5)/H*Math.PI),w=.5*dirY+.5;
      const r=(hemi.ground.r+(hemi.sky.r-hemi.ground.r)*w)*k,g=(hemi.ground.g+(hemi.sky.g-hemi.ground.g)*w)*k,b=(hemi.ground.b+(hemi.sky.b-hemi.ground.b)*w)*k;
      for(let x=0;x<W;x++){const i=(y*W+x)*4;data[i]+=r;data[i+1]+=g;data[i+2]+=b;data[i+3]=1;}}
  }
  for(let i=3;i<data.length;i+=4)data[i]=1;
  const tex=new THREE.DataTexture(data,W,H,THREE.RGBAFormat,THREE.FloatType,THREE.EquirectangularReflectionMapping,THREE.RepeatWrapping,THREE.ClampToEdgeWrapping,THREE.LinearFilter,THREE.LinearFilter);
  tex.needsUpdate=true;
  let sum=0;for(let i=0;i<data.length;i+=4)sum+=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];
  return {tex,source,meanLum:sum/(W*H),ms:now()-t0};
}

function lumaStats(canvas:HTMLCanvasElement){
  const c=document.createElement('canvas');c.width=96;c.height=54;const x=c.getContext('2d')!;x.drawImage(canvas,0,0,96,54);
  const d=x.getImageData(0,0,96,54).data;let r=0,g=0,b=0,a=0;for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];a+=d[i+3];}const n=d.length/4;
  return {r:+(r/n).toFixed(1),g:+(g/n).toFixed(1),b:+(b/n).toFixed(1),a:+(a/n).toFixed(1)};
}

let running=false;
export async function renderPhoto(o:{gl:THREE.WebGLRenderer;scene:THREE.Scene;camera:THREE.PerspectiveCamera;width?:number;height?:number;samples?:number;bounces?:number;tiles?:[number,number];
  background?:'live'|'transparent';env?:'live'|'gradient';bvh?:'main'|'lib-worker'|'own-worker';denoise?:boolean;timeCapMs?:number;expandInstances?:boolean;lightRadius?:number;
  filterGlossyFactor?:number;compareBvh?:boolean;sampleClamp?:number;fixMirror?:boolean;toneMappingProbe?:boolean;log?:(s:string)=>void}){
  if(running)throw new Error('photo already running');running=true;
  const log=o.log??(()=>{});
  const W=o.width??1920,H=o.height??1080,target=o.samples??256;
  const stats:any={W,H,targetSamples:target,version:SPIKE_VERSION,contextLost:false,errors:[]};
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();stats.contextLost=true;},false);
  const liveCanvas=o.gl.domElement;const onLiveLost=()=>{stats.liveContextLost=true;};liveCanvas.addEventListener('webglcontextlost',onLiveLost);
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,preserveDrawingBuffer:true,antialias:false,powerPreference:'high-performance'});
  let pt:any,worker:any,photo:THREE.Scene|null=null,envTex:any=null;
  try{
    renderer.setPixelRatio(1);renderer.setSize(W,H,false);
    renderer.toneMapping=o.gl.toneMapping;renderer.toneMappingExposure=o.gl.toneMappingExposure;renderer.outputColorSpace=o.gl.outputColorSpace;
    stats.toneMapping=renderer.toneMapping;stats.maxTextureSize=renderer.capabilities.maxTextureSize;
    const glx=renderer.getContext();const dbg=glx.getExtension('WEBGL_debug_renderer_info');stats.gpu=dbg?glx.getParameter(dbg.UNMASKED_RENDERER_WEBGL):'?';
    stats.floatBlend=!!glx.getExtension('EXT_float_blend');stats.parallelCompile=!!glx.getExtension('KHR_parallel_shader_compile');

    // 1. Scene: expand instances, merge per material.
    const built=buildPhotoScene(o.scene,{expandInstances:o.expandInstances,fixMirror:o.fixMirror});
    photo=built.photo;stats.tris=built.tris;stats.sceneBuildMs=+built.buildMs.toFixed(1);stats.scene=built.report;stats.photoMeshes=photo.children.length;
    log(`scene ${built.tris} tris in ${built.buildMs.toFixed(0)} ms`);
    const lights=copyLights(o.scene,photo,{lightRadius:o.lightRadius??.04});stats.lights={directional:lights.directional,spot:lights.spot,point:lights.point,hemi:!!lights.hemi};
    const env=buildEnvironment(o.scene,o.gl,lights.hemi,o.env??'live');envTex=env.tex;stats.env={source:env.source,meanLum:+env.meanLum.toFixed(4),ms:+env.ms.toFixed(1),liveEnvIsCube:!!(o.scene.environment as any)?.isCubeTexture,liveEnvIsRenderTarget:!!(o.scene.environment as any)?.isRenderTargetTexture,liveEnvIntensity:(o.scene as any).environmentIntensity};
    photo.environment=env.tex;(photo as any).environmentIntensity=1;
    const bg=o.scene.background as any;
    photo.background=o.background==='transparent'?null:(bg?.isColor?bg.clone():null);

    const cam=(o.camera as THREE.PerspectiveCamera).clone();cam.aspect=W/H;cam.updateProjectionMatrix();cam.updateMatrixWorld();

    // 2. Path tracer + BVH.
    pt=new WebGLPathTracer(renderer);
    pt.tiles.set(...(o.tiles??(W>2000?[3,3]:[2,2])));
    pt.bounces=o.bounces??6;pt.transmissiveBounces=10;pt.filterGlossyFactor=o.filterGlossyFactor??.5;
    pt.renderDelay=0;pt.fadeDuration=0;pt.minSamples=1;pt.rasterizeScene=false;pt.renderToCanvas=false;pt.dynamicLowRes=false;
    // Optional per-sample radiance clamp (biased, kills fireflies): the library has no option for it, so patch the shader.
    if(o.sampleClamp){const mat=pt._pathTracer.material,marker='gl_FragColor.a *= opacity;';const n=mat.fragmentShader.split(marker).length-1;stats.clampPatchSites=n;
      if(n===1){mat.fragmentShader=mat.fragmentShader.replace(marker,`gl_FragColor.rgb = min( gl_FragColor.rgb, vec3( ${o.sampleClamp.toFixed(3)} ) ); ${marker}`);mat.needsUpdate=true;}}
    const mode=o.bvh??'main';stats.bvhMode=mode;
    const t1=now();
    if(mode==='main'){pt.setScene(photo,cam);}
    else{worker=mode==='lib-worker'?new GenerateMeshBVHWorker():new OwnBVHWorker();pt.setBVHWorker(worker);
      await Promise.race([pt.setSceneAsync(photo,cam),new Promise((_,rej)=>setTimeout(()=>rej(new Error(`${mode} timed out after 60 s`)),60000))]);}
    stats.setSceneMs=+(now()-t1).toFixed(1);
    log(`setScene(${mode}) ${stats.setSceneMs} ms`);
    // BVH alone, for the record: main thread vs the library worker on a copy of the generator's merged geometry.
    if(o.compareBvh){
      const g0=pt._generator.geometry,copy=()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',g0.getAttribute('position').clone());if(g0.index)g.setIndex(g0.index.clone());return g;};
      const bo={strategy:SAH,maxLeafTris:1,indirect:true};
      let t=now();new MeshBVH(copy(),bo);stats.bvhMainMs=+(now()-t).toFixed(1);
      for(const kind of ['lib-worker','own-worker']){
        try{const w=kind==='lib-worker'?new GenerateMeshBVHWorker():new OwnBVHWorker();t=now();
          await Promise.race([w.generate(copy(),bo),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout 30 s')),30000))]);
          stats[kind==='lib-worker'?'bvhLibWorkerMs':'bvhOwnWorkerMs']=+(now()-t).toFixed(1);w.dispose();}
        catch(e){stats[kind==='lib-worker'?'bvhLibWorkerMs':'bvhOwnWorkerMs']='FAILED: '+String(e?.message||e);}
      }
      stats.generatorTris=(g0.index?g0.index.count:g0.getAttribute('position').count)/3;
    }

    // 3. Shader compile (async, KHR_parallel_shader_compile) until the first sample lands.
    const t2=now();
    let guard=0;
    while((pt.isCompiling||pt.samples===0)&&guard++<200000){pt.renderSample();if(pt.isCompiling)await new Promise(r=>setTimeout(r,5));else await yieldNow();if(now()-t2>180000)throw new Error('compile > 180 s');}
    const one=new Float32Array(4);renderer.readRenderTargetPixels(pt.target,0,0,1,1,one);
    stats.compileAndFirstSampleMs=+(now()-t2).toFixed(1);
    log(`compile+first sample ${stats.compileAndFirstSampleMs} ms`);

    // 4. Accumulate: batches of tiles up to ~12 ms of CPU issue, then a 1-px read to sync with the GPU.
    const t3=now(),s0=pt.samples,cap=o.timeCapMs??600000;let batches=0,maxBatchMs=0;
    while(pt.samples<target&&now()-t3<cap){
      const b0=now();
      do{pt.renderSample();}while(now()-b0<12&&pt.samples<target);
      renderer.readRenderTargetPixels(pt.target,0,0,1,1,one);
      maxBatchMs=Math.max(maxBatchMs,now()-b0);batches++;
      if(stats.contextLost)throw new Error('photo context lost');
      await yieldNow();
    }
    const accMs=now()-t3;
    stats.samples=pt.samples;stats.accumulateMs=+accMs.toFixed(0);stats.samplesPerSec=+((pt.samples-s0)/(accMs/1000)).toFixed(2);stats.maxBatchMs=+maxBatchMs.toFixed(1);stats.batches=batches;
    stats.nanOrNegative=Number.isNaN(one[0])||one[0]<0;
    log(`${pt.samples} samples in ${(accMs/1000).toFixed(1)} s = ${stats.samplesPerSec}/s`);

    // 5. Output: the library's own display quad (honours renderer.toneMapping via TONE_MAPPING define).
    pt.pausePathTracing=true;pt.renderToCanvas=true;pt.renderSample();
    const png=canvas.toDataURL('image/png');stats.rawLuma=lumaStats(canvas);
    let toneProbe:any=null;
    if(o.toneMappingProbe){const keep=renderer.toneMapping;renderer.toneMapping=THREE.NoToneMapping;pt._quad.material.needsUpdate=true;pt.renderSample();toneProbe={none:lumaStats(canvas)};
      renderer.toneMapping=THREE.ACESFilmicToneMapping;pt._quad.material.needsUpdate=true;pt.renderSample();toneProbe.aces=lumaStats(canvas);
      renderer.toneMapping=keep;pt._quad.material.needsUpdate=true;pt.renderSample();toneProbe.neutral=lumaStats(canvas);stats.toneProbe=toneProbe;}

    // 6. Denoise with the library's DenoiseMaterial (smart de-noise, BrutPitt) straight from the float target.
    let denoised:string|null=null;
    if(o.denoise!==false){
      const t4=now();
      const quad=new FullScreenQuad(new DenoiseMaterial({map:pt.target.texture,blending:THREE.NoBlending,premultipliedAlpha:renderer.getContextAttributes()!.premultipliedAlpha}));
      (quad.material as any).sigma=W>2000?3.5:2.5;(quad.material as any).threshold=.1;(quad.material as any).kSigma=1;
      renderer.setRenderTarget(null);renderer.autoClear=true;renderer.clear();quad.render(renderer);
      renderer.readRenderTargetPixels(pt.target,0,0,1,1,one);
      denoised=canvas.toDataURL('image/png');stats.denoiseMs=+(now()-t4).toFixed(1);stats.denoisedLuma=lumaStats(canvas);
      quad.dispose();(quad.material as any).dispose();
    }
    stats.rendererInfo={geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,programs:renderer.info.programs?.length};
    stats.photoTextures=pt._materials?(pt._pathTracer.material.textures.image?.depth??'?'):'?';
    stats.textureArraySize=`${pt.textureSize.x}x${pt.textureSize.y}`;
    return {png,denoised,stats};
  }catch(e:any){stats.errors.push(String(e?.stack||e));return {png:null,denoised:null,stats};}
  finally{
    running=false;
    liveCanvas.removeEventListener('webglcontextlost',onLiveLost);
    try{worker?.dispose?.();}catch{}
    try{pt?.dispose();}catch{}
    photo?.traverse(o=>{const m=o as any;if(m.isMesh){m.geometry.dispose();m.material.dispose?.();}});
    envTex?.dispose();
    renderer.dispose();renderer.forceContextLoss();
  }
}

/** README says instancing is unsupported: check what the generator does with an InstancedMesh of 3 spread instances. */
export function testInstancedCollapse(){
  const box=new THREE.BoxGeometry(1,1,1),mesh=new THREE.InstancedMesh(box,new THREE.MeshStandardMaterial(),3);
  [-10,0,10].forEach((x,i)=>{mesh.setMatrixAt(i,new THREE.Matrix4().makeTranslation(x,0,0));});
  const s=new THREE.Scene();s.add(mesh);s.updateMatrixWorld(true);
  const gen=new PathTracingSceneGenerator(s);const r=gen.generate();
  const g=r.geometry;g.computeBoundingBox();
  return {sourceTris:box.index!.count/3,instances:3,generatedTris:(g.index?g.index.count:g.getAttribute('position').count)/3,bboxX:[+g.boundingBox!.min.x.toFixed(2),+g.boundingBox!.max.x.toFixed(2)],expectedIfExpanded:[-10.5,10.5]};
}
