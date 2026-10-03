const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.argv[2]||path.resolve(__dirname,'..'), sourceRoot=process.argv[3]||root;
const requireRepo=require('node:module').createRequire(path.join(root,'package.json'));
const ts=requireRepo('typescript'),THREE=requireRepo('three');
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.log('FAIL '+name+': '+e.message);}}
function fixture(selection={partIds:[],boards:[],hardscape:{id:'green',kind:'landscape'}},enabled=true){
 const window=new EventTarget(),document=new EventTarget(),canvas=new EventTarget();document.hidden=false;canvas.dataset={};canvas.style={};
 const effects=[],refs=[],controls={enabled};let cancels=0,finishes=0,drafts=0,captured=false;
 const React={useRef:v=>{const r={current:v};refs.push(r);return r;},useEffect:fn=>effects.push(fn),useFrame:()=>{}};
 const target={modes:['move'],x:0,y:0,z:0,width:120,depth:120,points:[],ids:['green']};
 const mocks={'react':React,'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},'@react-three/fiber':{useFrame:()=>{},useThree:()=>({controls,camera:{position:new THREE.Vector3(0,20,20)},gl:{domElement:canvas},invalidate:()=>{}})},three:THREE,'../../designer/sceneEditCommands':{sceneEditTarget:()=>target},'../../designer/sceneSnapping':{sceneSnapGeometry:()=>[],snapScenePoint:p=>p}};
 const source=fs.readFileSync(path.join(sourceRoot,'src/features/deckcraft/components/viewer3d/SceneEditHandles.tsx'),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const module={exports:{}};vm.runInNewContext(js,{exports:module.exports,module,require:id=>mocks[id]||{},window,document,setTimeout:fn=>fn(),clearTimeout});
 const tree=module.exports.default({data:{},model:{},selection,interaction:{mode:'move',snapIn:0,onDraft:()=>drafts++,onCancel:()=>cancels++,onFinish:()=>finishes++}});
 const cleanups=effects.map(fn=>fn());cancels=0;let firstStart=true;
 const handle=tree?.props.children[0];
 function emit(where,type,id=1){const e=new Event(type);e.pointerId=id;where.dispatchEvent(e);}
 function event(id=1){return {pointerId:id,button:0,stopPropagation(){},point:new THREE.Vector3(),ray:new THREE.Ray(new THREE.Vector3(0,10,0),new THREE.Vector3(0,-1,0)),target:{setPointerCapture(){captured=true;},releasePointerCapture(){captured=false;emit(canvas,'lostpointercapture',id);}}};}
 return {window,document,canvas,controls,handle,emit,event,start(id=1){emit(window,'pointerdown',id);handle.props.onPointerDown(event(id));if(firstStart){cancels=0;firstStart=false;}},finish(id=1){handle.props.onPointerUp(event(id));},cleanup(){cleanups.forEach(f=>f?.());},state:()=>({cancels,finishes,drafts,captured})};
}
test('normal owner release preserves review and prior disabled camera',()=>{const f=fixture(undefined,false);f.start();f.finish();assert.equal(f.state().finishes,1);assert.equal(f.state().cancels,0);assert.equal(f.controls.enabled,false);assert.equal(f.state().captured,false);f.cleanup();});
test('another pointer cannot finish owner gesture',()=>{const f=fixture();f.start();f.finish(2);assert.equal(f.state().finishes,0);assert.equal(f.controls.enabled,false);f.cleanup();});
test('lost capture cancels exactly once and restores orbit',()=>{const f=fixture();f.start();f.emit(f.canvas,'lostpointercapture');assert.equal(f.state().cancels,1);assert.equal(f.controls.enabled,true);f.finish();assert.equal(f.state().finishes,0);f.cleanup();});
test('hidden page cancels and restores orbit',()=>{const f=fixture();f.start();f.document.hidden=true;f.emit(f.document,'visibilitychange');assert.equal(f.state().cancels,1);assert.equal(f.controls.enabled,true);f.cleanup();});
test('second pointer cannot restart a handle while both remain down',()=>{const f=fixture();f.start();f.start(2);assert.equal(f.state().cancels,1);assert.equal(f.controls.enabled,true);assert.equal(f.state().captured,false);f.cleanup();});
for(const reason of ['pointercancel','blur','webglcontextlost'])test(reason+' cancels and restores orbit',()=>{const f=fixture();f.start();f.emit(reason==='webglcontextlost'?f.canvas:f.window,reason);assert.equal(f.state().cancels,1);assert.equal(f.controls.enabled,true);f.cleanup();});
test('object-list-only selection renders handles',()=>{const f=fixture({partIds:[],boards:[],objectIds:['green']});assert.ok(f.handle);f.cleanup();});
test('unmount releases capture and restores orbit',()=>{const f=fixture();f.start();f.cleanup();assert.equal(f.state().cancels,1);assert.equal(f.controls.enabled,true);assert.equal(f.state().captured,false);});
console.log(JSON.stringify({passed,failed}));process.exitCode=failed?1:0;
