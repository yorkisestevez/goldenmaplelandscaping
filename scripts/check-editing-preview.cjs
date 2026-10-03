// Execute the real hook with controlled React lifecycles and a delayed controller.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.argv[2]||path.resolve(__dirname,'..'),req=require('node:module').createRequire(path.join(root,'package.json')),ts=req('typescript');
let passed=0,failed=0;
async function test(name,fn){try{await fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.log('FAIL '+name+': '+e.message);}}
function fixture(){
 const window=new EventTarget(),document=new EventTarget();document.hidden=false;
 const slots=[],effects=[],pendingEffects=[];let cursor=0,resolvePreview,executions=0,disposed=0,data={width:12},geometry=[];
 const snapshot={revision:'r1',design:{width:14},yardQuantities:{},pricing:{subtotal:0},quotes:[]};
 const api={read:()=>snapshot,preview:()=>new Promise(r=>resolvePreview=r),execute:async()=>{executions++;return {ok:true};},dispose:()=>disposed++};
 const React={useRef(v){const i=cursor++;return slots[i]??(slots[i]={current:v});},useState(v){const i=cursor++;if(!(i in slots))slots[i]=v;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},useEffect(fn,deps){const i=cursor++;if(!effects[i]||deps.some((v,j)=>v!==effects[i].deps[j]))pendingEffects.push(()=>{effects[i]?.cleanup?.();effects[i]={deps,cleanup:fn()};});}};
 const module={exports:{}},source=fs.readFileSync(path.join(root,'src/features/deckcraft/designer/useHardscapePreview.ts'),'utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:module.exports,module,require:id=>id==='react'?React:{createDeckAgentController:()=>api},window,document,crypto:{randomUUID:()=>String(Math.random())},CustomEvent:class extends Event{constructor(t,o){super(t);this.detail=o.detail;}},setTimeout,clearTimeout});
 const render=()=>{cursor=0;const flow=module.exports.useHardscapePreview(data,()=>{},v=>geometry.push(v));pendingEffects.splice(0).forEach(fn=>fn());return flow;};
 const unmount=()=>effects.forEach(e=>e?.cleanup?.());
 const emit=(type)=>{const e=new Event(type);if(type==='keydown')e.key='Escape';if(type==='visibilitychange'){document.hidden=true;document.dispatchEvent(e);}else window.dispatchEvent(e);};
 return {render,unmount,emit,resolve:()=>resolvePreview({ok:true,snapshot}),change:()=>{data={width:13};render();},state:()=>({executions,disposed,geometry})};
}
async function begin(f){const promise=f.render().preview([{type:'design.patch',patch:{width:14}}]);for(let i=0;i<5;i++)await Promise.resolve();return {promise};}
(async()=>{
 for(const reason of ['keydown','blur','visibilitychange','pointercancel','webglcontextlost'])await test(reason+' invalidates delayed preview',async()=>{const f=fixture(),{promise}=await begin(f);f.emit(reason);f.resolve();await promise;const flow=f.render();assert.equal(flow.candidate,null);assert.equal(flow.busy,false);assert.equal(f.state().geometry.at(-1),null);assert.equal(f.state().executions,0);f.unmount();});
 await test('design revision invalidates delayed preview',async()=>{const f=fixture(),{promise}=await begin(f);f.change();f.resolve();await promise;assert.equal(f.render().candidate,null);f.unmount();});
 await test('unmount cannot resurrect delayed geometry',async()=>{const f=fixture(),{promise}=await begin(f);f.unmount();f.resolve();await promise;assert.equal(f.state().geometry.at(-1),null);assert.equal(f.state().disposed,1);});
 await test('normal preview survives then applies once',async()=>{const f=fixture(),{promise}=await begin(f);f.resolve();await promise;const flow=f.render();assert.ok(flow.candidate);await flow.commit();assert.equal(f.state().executions,1);assert.equal(f.render().candidate,null);f.unmount();});
 await test('cancel after review causes no write',async()=>{const f=fixture(),{promise}=await begin(f);f.resolve();await promise;f.render().cancel();assert.equal(f.render().candidate,null);assert.equal(f.state().executions,0);f.unmount();});
 await test('pending review exposes an enabled cancel control',async()=>{let cancelled=false;const module={exports:{}},source=fs.readFileSync(path.join(root,'src/features/deckcraft/designer/EditReview.tsx'),'utf8'),jsx=(type,props)=>({type,props});vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:module.exports,module,require:id=>id==='react/jsx-runtime'?{jsx,jsxs:jsx}:{landscapeTakeoff:()=>({})}});const tree=module.exports.default({flow:{busy:true,candidate:null,cancel:()=>cancelled=true},data:{}}),nodes=[];function walk(n){if(Array.isArray(n))n.forEach(walk);else if(n?.props){nodes.push(n);walk(n.props.children);}}walk(tree);const button=nodes.find(n=>n.type==='button'&&n.props.children==='Cancel preview');assert.ok(button);assert.ok(!button.props.disabled);button.props.onClick();assert.equal(cancelled,true);});
 console.log(JSON.stringify({passed,failed}));process.exitCode=failed?1:0;
})();
