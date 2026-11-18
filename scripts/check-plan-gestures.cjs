const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.argv[2]||path.resolve(__dirname,'..'),req=require('node:module').createRequire(path.join(root,'package.json')),ts=req('typescript');
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.log('FAIL '+name+': '+e.message);}}
function fixture(){
 const window=new EventTarget(),document=new EventTarget();document.hidden=false;const effects=[],refs=[];let previews=0,cancels=0,captured=false,geometry=null;
 const o={id:'green',kind:'bed',enabled:true,xIn:0,zIn:0,widthIn:120,depthIn:120,assetId:'putting-green',outline:{outer:{points:[{x:0,z:0},{x:100,z:0},{x:0,z:100}],segments:[{kind:'line'},{kind:'line'},{kind:'line'}]},holes:[]}},data={landscapeObjects:[o]};
 const React={useRef:v=>{const r={current:v};refs.push(r);return r;},useState:v=>[v,()=>{}],useEffect:fn=>effects.push(fn)};
 const jsx=(type,props)=>({type,props}),flow={busy:false,candidate:null,cancel:()=>{cancels++;geometry=null;},preview:()=>previews++};
 const mocks={'react':React,'react/jsx-runtime':{jsx,jsxs:jsx},'react-dom':{createPortal:v=>v},'../landscapeSurfaces':{LANDSCAPE_SURFACES:[],landscapeSurface:()=>({color:'green'})},'../landscapeModel':{landscapeBedAreas:()=>new Map()},'../landscapeEdits':{applyLandscapeEdit:()=>({landscapeObjects:[{...o,xIn:10}]})},'../landscapeOutline':{convertLandscapeOutline:v=>v,landscapeWorld:(o,p)=>p,landscapeOutlinePaths:()=>[]},'../editorOrganization':{isObjectLocked:()=>false,isObjectVisible:()=>true},'./useHardscapePreview':{useHardscapePreview:()=>flow}};
 const module={exports:{}},source=fs.readFileSync(path.join(root,'src/features/deckcraft/designer/LandscapePlanEditor.tsx'),'utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:module.exports,module,require:id=>mocks[id]||{},window,document,DOMPoint:class{constructor(x,y){this.x=x;this.y=y;}matrixTransform(){return this;}},setTimeout,clearTimeout});
 const tree=module.exports.default({data,frame:{viewBox:'0 0 100 100'},zoom:1,selection:{id:'green',kind:'landscape'},onSelect(){},onApply(){},onGeometry:v=>geometry=v,toolbar:{current:{}}});
 const nodes=[];function walk(n){if(Array.isArray(n))n.forEach(walk);else if(n?.props){nodes.push(n);walk(n.props.children);}}walk(tree);const svg=nodes.find(n=>n.type==='svg'),handle=nodes.find(n=>n.type==='circle');svg.props.ref.current={getScreenCTM:()=>({inverse:()=>({})})};
 const cleanups=effects.map(fn=>fn());cancels=0;
 function emit(type,id=1){const e=new Event(type);e.pointerId=id;if(type==='visibilitychange'){document.hidden=true;document.dispatchEvent(e);}else window.dispatchEvent(e);}
 const target={setPointerCapture(){captured=true;},releasePointerCapture(id){captured=false;svg.props.onLostPointerCapture?.({pointerId:id});}};
 const event=(id=1)=>({pointerId:id,button:0,clientX:10,clientY:10,currentTarget:target,stopPropagation(){},preventDefault(){}});
 return {start(){emit('pointerdown');handle.props.onPointerDown(event());cancels=0;},move(){svg.props.onPointerMove(event());},finish(id=1){svg.props.onPointerUp(event(id));},lost(){svg.props.onLostPointerCapture?.(event());},emit,cleanup:()=>cleanups.forEach(f=>f?.()),mode:()=>nodes.find(n=>n.type==='button'&&n.props.children==='Freehand').props.onClick(),state:()=>({previews,cancels,captured,geometry})};
}
test('normal plan release stages review and releases capture',()=>{const f=fixture();f.start();f.move();f.finish();assert.equal(f.state().previews,1);assert.equal(f.state().cancels,0);assert.equal(f.state().captured,false);f.cleanup();});
test('another pointer cannot end plan drag',()=>{const f=fixture();f.start();f.move();f.finish(2);assert.equal(f.state().previews,0);assert.equal(f.state().captured,true);f.cleanup();});
for(const reason of ['blur','visibilitychange','lost','mode','unmount'])test(reason+' cancels plan draft and releases capture',()=>{const f=fixture();f.start();f.move();if(reason==='lost')f.lost();else if(reason==='mode')f.mode();else if(reason==='unmount')f.cleanup();else f.emit(reason);assert.equal(f.state().captured,false);assert.equal(f.state().geometry,null);f.finish();assert.equal(f.state().previews,0);if(reason!=='unmount')f.cleanup();});
console.log(JSON.stringify({passed,failed}));process.exitCode=failed?1:0;
