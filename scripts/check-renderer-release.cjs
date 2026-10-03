// A closed 3D view must not stay reachable. three.js registers a 'dispose' listener on every texture, geometry and
// material a renderer draws, and DeckCraft reuses those across views (cached models, swatch stand-ins, three's own DFG
// lookup texture), so each closed view used to keep its renderer, canvas and WebGL context. releaseDrawnResources
// disposes what the renderer drew as it goes; the swatch worker's listeners are module functions, not hook closures.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.argv[2]||path.resolve(__dirname,'..');
const requireRepo=require('node:module').createRequire(path.join(root,'package.json'));
const ts=requireRepo('typescript'),THREE=requireRepo('three');
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.log('FAIL '+name+': '+e.message);}}
const viewer=path.join(root,'src/features/deckcraft/components/viewer3d');
const pipelineSource=fs.readFileSync(path.join(viewer,'renderPipeline.tsx'),'utf8');

function loadPipeline(){
 const out=ts.transpileModule(pipelineSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const Stub=class{};
 const mocks={'react':{useEffect(){},useLayoutEffect(){},useRef:v=>({current:v})},'@react-three/fiber':{useFrame(){},useThree(){}},three:THREE,
  'three/examples/jsm/postprocessing/GTAOPass.js':{GTAOPass:Stub},'three/examples/jsm/postprocessing/UnrealBloomPass.js':{UnrealBloomPass:Stub},'three/examples/jsm/postprocessing/OutputPass.js':{OutputPass:Stub},
  './sceneLook':{SCENE_LOOK:{ao:{},bloom:{}},sceneQuality:()=>({})},'./SceneRenderQuality':{useRenderQuality:()=>({})},'./shadowCache':{fitSun(){},shadowKey(){return 0;}},'./windowReflections':{renderWindowReflections(){}}};
 const module={exports:{}};
 vm.runInNewContext(out,{module,exports:module.exports,require:id=>{if(id in mocks)return mocks[id];throw new Error('unmocked import '+id);},WeakRef,WeakSet,console},{filename:'renderPipeline.tsx'});
 return module.exports;
}
const {releaseDrawnResources}=loadPipeline();

/** Stands in for a WebGLRenderer: like three, it holds each resource it draws through a 'dispose' listener. */
function fakeRenderer(){
 const held=new Set();
 const hold=resource=>{if(!resource||held.has(resource))return;held.add(resource);const onDispose=()=>{resource.removeEventListener('dispose',onDispose);held.delete(resource);};resource.addEventListener('dispose',onDispose);};
 const properties={get(object){if(object&&object.isTexture)hold(object);return {};}};
 const gl={properties,held,
  // Like three's prefiltering of scene.environment: held without passing through properties.get.
  render(scene){hold(scene.environment);for(const object of scene.children)this.renderBufferDirect(null,scene,object.geometry,object.material,object,null);},
  renderBufferDirect(camera,scene,geometry,material){hold(geometry);hold(material);if(material.map)properties.get(material.map);if(material.normalMap)properties.get(material.normalMap);}};
 return gl;
}
function scene(...meshes){const s=new THREE.Scene();for(const m of meshes)s.add(m);return s;}
const listeners=resource=>resource._listeners?.dispose?.length??0;

test('a renderer releases every geometry, material and texture it drew',()=>{
 const gl=fakeRenderer(),release=releaseDrawnResources(gl);
 const map=new THREE.Texture(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({map}));
 gl.render(scene(mesh));
 assert.equal(gl.held.size,3);
 release();
 assert.equal(gl.held.size,0);
 assert.equal(listeners(map)+listeners(mesh.geometry)+listeners(mesh.material),0);
});
test('a stand-in drawn only in the first frame is still released',()=>{
 const gl=fakeRenderer(),release=releaseDrawnResources(gl);
 const flat=new THREE.Texture(),swatch=new THREE.Texture(),material=new THREE.MeshStandardMaterial({normalMap:flat}),mesh=new THREE.Mesh(new THREE.PlaneGeometry(),material);
 gl.render(scene(mesh));
 material.normalMap=swatch;gl.render(scene(mesh));
 release();
 assert.equal(listeners(flat),0);assert.equal(listeners(swatch),0);
});
test('the scene environment is released though it never passes properties.get',()=>{
 const gl=fakeRenderer(),release=releaseDrawnResources(gl),s=scene();
 s.environment=new THREE.Texture();gl.render(s);
 assert.equal(listeners(s.environment),1);
 release();
 assert.equal(listeners(s.environment),0);
});
test('render-target textures stay with their targets',()=>{
 const gl=fakeRenderer(),release=releaseDrawnResources(gl),target=new THREE.WebGLRenderTarget(1,1);
 let disposed=0;target.texture.addEventListener('dispose',()=>disposed++);
 gl.properties.get(target.texture);
 release();
 assert.equal(disposed,0);assert.ok(gl.held.has(target.texture));
});
test('a resource shared by successive views keeps no listener from a closed one',()=>{
 const shared=new THREE.MeshStandardMaterial({map:new THREE.Texture()}),geometry=new THREE.BoxGeometry();
 for(let view=0;view<3;view++){const gl=fakeRenderer(),release=releaseDrawnResources(gl);gl.render(scene(new THREE.Mesh(geometry,shared)));release();}
 assert.equal(listeners(shared)+listeners(shared.map)+listeners(geometry),0);
});
test('releasing restores the renderer\'s own methods',()=>{
 const gl=fakeRenderer(),own={get:gl.properties.get,render:gl.render,draw:gl.renderBufferDirect},release=releaseDrawnResources(gl);
 assert.notEqual(gl.render,own.render);
 release();
 assert.equal(gl.properties.get,own.get);assert.equal(gl.render,own.render);assert.equal(gl.renderBufferDirect,own.draw);
});
test('the release starts before the first frame (layout effect, once per renderer)',()=>{
 assert.match(pipelineSource,/useLayoutEffect\(\(\)=>releaseDrawnResources\(gl\),\[gl\]\)/);
});
test('the swatch worker listens through module functions, not hook closures',()=>{
 const swatch=fs.readFileSync(path.join(viewer,'useSwatchTexture.ts'),'utf8');
 assert.match(swatch,/^function onWorkerMessage\(/m);assert.match(swatch,/^function onWorkerError\(/m);
 assert.match(swatch,/addEventListener\('message', onWorkerMessage\)/);assert.match(swatch,/addEventListener\('error', onWorkerError\)/);
 assert.doesNotMatch(swatch,/addEventListener\('(message|error)', *\(/);
});
console.log(JSON.stringify({passed,failed}));
process.exit(failed?1:0);
