import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.setContent('<html><body><canvas id="proof"></canvas></body></html>');
 const source=`
import * as THREE from 'three';
import {poolMaterial} from './src/features/deckcraft/components/viewer3d/Pool3D';
import {applyHardscapeFinish} from './src/features/deckcraft/components/viewer3d/hardscapeFinish';
import {applyWallDaylight} from './src/features/deckcraft/components/viewer3d/wallDaylight';
import {soilFaceMaterial} from './src/features/deckcraft/components/viewer3d/lawnSurface';
import {createFixtureLighting,litMaterial} from './src/features/deckcraft/components/viewer3d/fixtureLighting';
import {chooseRenderQuality} from './src/features/deckcraft/components/viewer3d/renderQuality';
import {Chain} from './src/features/deckcraft/components/viewer3d/renderPipeline';
(async()=>{
 const gl=new THREE.WebGLRenderer({canvas:document.querySelector('#proof'),antialias:false}),shaderErrors=[];
 gl.debug.onShaderError=(ctx,program,vertex,fragment)=>shaderErrors.push([ctx.getProgramInfoLog(program),ctx.getShaderInfoLog(vertex),ctx.getShaderInfoLog(fragment)].join('\\n'));
 gl.setSize(256,192);gl.toneMapping=THREE.NeutralToneMapping;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,256/192,.1,200);camera.position.set(8,7,10);camera.lookAt(0,0,0);
 const faces=Array.from({length:6},()=>{const c=document.createElement('canvas');c.width=c.height=4;const ctx=c.getContext('2d');ctx.fillStyle='#d7e9f4';ctx.fillRect(0,0,4,4);return c;});
 const sky=new THREE.CubeTexture(faces);sky.needsUpdate=true;scene.environment=sky;
 scene.add(new THREE.HemisphereLight('#ffffff','#777777',1),new THREE.DirectionalLight('#ffffff',3));
 const fixture=createFixtureLighting(),materials=[poolMaterial({role:'water',color:'#91cddd'}),poolMaterial({role:'coping',color:'#b6ad99'}),applyWallDaylight(applyHardscapeFinish(new THREE.MeshStandardMaterial({color:'#b8b6b1'}))),soilFaceMaterial()];
 for(const [index,material] of materials.entries()){
  litMaterial(material,fixture);const g=new THREE.BoxGeometry(24,2,24),count=g.getAttribute('position').count;
  g.setAttribute('poolDepth',new THREE.Float32BufferAttribute(Array.from({length:count},(_,i)=>36+(i%2)*36),1));g.setAttribute('color',new THREE.Float32BufferAttribute(Array.from({length:count*3},()=>1),3));
  const mesh=new THREE.Mesh(g,material);mesh.scale.setScalar(1/12);mesh.position.x=(index-1.5)*2.3;scene.add(mesh);
 }
 await gl.compileAsync(scene,camera);gl.render(scene,camera);
 const outputs=[];
 for(const narrow of [false,true,'software']){
  const q=chooseRenderQuality({renderer:narrow==='software'?'SwiftShader':'Hardware',maxTextureSize:gl.capabilities.maxTextureSize,maxSamples:gl.capabilities.maxSamples},narrow===true),before=gl.info.memory.textures;
  const chain=new Chain(gl,scene,camera,q.msaaSamples,q);chain.setSize(256,192,1);chain.render(gl,scene,camera,false);chain.render(gl,scene,camera,true);
  const allocated=gl.info.memory.textures;chain.dispose();outputs.push({tier:q.tier,samples:chain.beauty.samples,ao:[chain.gtao.width,chain.gtao.height],aoSamples:chain.gtao.gtaoMaterial.defines.SAMPLES,denoiseSamples:chain.gtao.pdMaterial.defines.SAMPLES,bloom:[chain.bloom.resolution.x,chain.bloom.resolution.y],texturesBefore:before,texturesAllocated:allocated,texturesAfter:gl.info.memory.textures});
 }
 window.__terrainProof={shaderErrors,outputs,programs:gl.info.programs.length,webgl:gl.getContext().getParameter(gl.getContext().VERSION)};
 scene.traverse(o=>{if(o.geometry)o.geometry.dispose();});materials.forEach(m=>m.dispose());fixture.dispose();sky.dispose();gl.dispose();
})().catch(error=>window.__terrainProof={error:String(error)});
`;
 const bundle=buildSync({stdin:{contents:source,resolveDir:process.cwd(),sourcefile:'terrain-gpu-proof.ts'},bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',loader:{'.json':'json'}}).outputFiles[0].text;
 await page.addScriptTag({content:bundle});await page.waitForFunction('window.__terrainProof',{},{timeout:60000});
 const proof=await page.evaluate(()=> (window as unknown as {__terrainProof:any}).__terrainProof);
 assert.equal(proof.error,undefined);assert.deepEqual(proof.shaderErrors,[]);assert.deepEqual(errors,[]);assert.equal(proof.outputs.length,3);
 for(const output of proof.outputs){const index=['high','balanced','constrained'].indexOf(output.tier);assert.equal(output.aoSamples,[16,12,8][index]);assert.equal(output.denoiseSamples,[16,12,8][index]);assert.deepEqual(output.bloom,[[256,192],[192,144],[128,96]][index]);assert.ok(output.texturesAllocated>output.texturesBefore);assert.ok(output.texturesAfter<=output.texturesBefore,`Leaked ${output.tier} texture targets: ${JSON.stringify(output)}`);}
 console.log(JSON.stringify({checks:21,actualWebGLShaderCompilation:proof},null,2));
}finally{await browser.close();}
