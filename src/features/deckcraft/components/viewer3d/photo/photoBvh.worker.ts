// THROWAWAY G0 spike: our own BVH worker, a copy of three-mesh-bvh 0.8.3's generateMeshBVH.worker.js. A bare side-effect
// import of that script is tree-shaken away (the package declares "sideEffects": false), so the body lives here, and the
// `new Worker(new URL('./photoBvh.worker.ts', import.meta.url))` sits in app source where Vite handles it in dev and prod.
// @ts-nocheck
import {BufferGeometry,BufferAttribute} from 'three';
import {MeshBVH} from 'three-mesh-bvh';

self.onmessage=({data})=>{
  let prevTime=performance.now();
  function onProgressCallback(progress){
    progress=Math.min(progress,1);
    const currTime=performance.now();
    if(currTime-prevTime>=10&&progress!==1.0){postMessage({error:null,serialized:null,position:null,progress});prevTime=currTime;}
  }
  const {index,position,options}=data;
  try{
    const geometry=new BufferGeometry();
    geometry.setAttribute('position',new BufferAttribute(position,3,false));
    if(index)geometry.setIndex(new BufferAttribute(index,1,false));
    if(options.includedProgressCallback)options.onProgress=onProgressCallback;
    if(options.groups)for(const group of options.groups)geometry.addGroup(group.start,group.count,group.materialIndex);
    const bvh=new MeshBVH(geometry,options);
    const serialized=MeshBVH.serialize(bvh,{copyIndexBuffer:false});
    let toTransfer=[position.buffer,...serialized.roots];
    if(serialized.index)toTransfer.push(serialized.index.buffer);
    toTransfer=toTransfer.filter(v=>(typeof SharedArrayBuffer==='undefined')||!(v instanceof SharedArrayBuffer));
    if(bvh._indirectBuffer)toTransfer.push(serialized.indirectBuffer.buffer);
    postMessage({error:null,serialized,position,progress:1},toTransfer);
  }catch(error){
    postMessage({error,serialized:null,position:null,progress:1});
  }
};
