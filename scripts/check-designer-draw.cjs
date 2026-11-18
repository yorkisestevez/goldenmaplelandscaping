// Designer drawing tool: the real ShapeDrawTool (bundled with its real geometry by esbuild) driven through its own
// pointer, keyboard and form handlers under a minimal hooks runtime. Plan coordinates equal screen coordinates here.
const path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=process.argv[2]||path.resolve(__dirname,'..');
const requireRepo=require('node:module').createRequire(path.join(root,'package.json'));
const esbuild=requireRepo('esbuild');
const source=esbuild.buildSync({entryPoints:[path.join(root,'src/features/deckcraft/designer/ShapeDrawTool.tsx')],bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',external:['react','react-dom','react/jsx-runtime'],loader:{'.css':'empty'},logLevel:'silent'}).outputFiles[0].text;
const tools=esbuild.buildSync({entryPoints:[path.join(root,'src/features/deckcraft/shapeTools.ts')],bundle:true,write:false,format:'cjs',platform:'node',logLevel:'silent'}).outputFiles[0].text;
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.log('FAIL '+name+': '+e.message+(process.env.TRACE?'\n'+String(e.stack).split('\n').slice(0,12).join('\n'):''));}}

function mount(props){
 const hooks=[],listeners=new Map(),window={addEventListener:(t,f)=>listeners.set(f,t),removeEventListener:(t,f)=>listeners.delete(f)};
 let idx=0,tree=null,cleanups=[],effects=[],batching=0,dirty=false;
 const act=fn=>{batching++;try{return fn();}finally{batching--;if(!batching&&dirty){dirty=false;render();}}};
 const React={useState(init){const i=idx++;if(!(i in hooks))hooks[i]=typeof init==='function'?init():init;return [hooks[i],v=>{hooks[i]=typeof v==='function'?v(hooks[i]):v;if(batching)dirty=true;else render();}];},useRef(v){const i=idx++;if(!(i in hooks))hooks[i]={current:v};return hooks[i];},useEffect(fn){effects.push(fn);},useCallback:fn=>fn,useMemo:fn=>fn()};
 const jsx=(type,props)=>({type,props:props??{}}),Fragment=Symbol('Fragment');
 const svgElement={getScreenCTM:()=>({a:1,b:0,c:0,d:1,e:0,f:0,inverse(){return this;}})};
 class DOMPoint{constructor(x,y){this.x=x;this.y=y;}matrixTransform(m){return {x:m.a*this.x+m.c*this.y+m.e,y:m.b*this.x+m.d*this.y+m.f};}}
 const mods={react:React,'react/jsx-runtime':{jsx,jsxs:jsx,Fragment},'react-dom':{createPortal:node=>node}};
 const module={exports:{}};vm.runInNewContext(source,{module,exports:module.exports,require:id=>{if(id in mods)return mods[id];return require(id);},window,DOMPoint,console,setTimeout,Math,Number,Error,Array,Object,JSON},{filename:'ShapeDrawTool.js'});
 const Component=module.exports.default;
 function render(){idx=0;effects=[];tree=Component(props);for(const c of cleanups)if(typeof c==='function')c();cleanups=effects.map(f=>f());const s=find(e=>e.type==='svg');if(s?.props.ref)s.props.ref.current=svgElement;}
 // No default parameter on the recursion: an element without children must not restart the search at the root.
 function search(pred,node){if(!node||typeof node!=='object')return null;if(Array.isArray(node)){for(const n of node){const r=search(pred,n);if(r)return r;}return null;}if(node.type&&pred(node))return node;return search(pred,node.props?.children);}
 const find=pred=>search(pred,tree);
 const text=n=>!n?'':typeof n==='string'||typeof n==='number'?String(n):Array.isArray(n)?n.map(text).join(''):text(n.props?.children);
 render();
 const ev=(x,y,extra={})=>({button:0,pointerId:1,clientX:x,clientY:y,shiftKey:false,preventDefault(){},stopPropagation(){},currentTarget:{setPointerCapture(){},focus(){}},...extra});
 return {
  click(x,y,extra){act(()=>find(e=>e.type==='svg').props.onPointerDown(ev(x,y,extra)));act(()=>find(e=>e.type==='svg').props.onPointerUp(ev(x,y,extra)));},
  move(x,y,extra){act(()=>find(e=>e.type==='svg').props.onPointerMove(ev(x,y,extra)));},
  key(k){act(()=>{for(const [f,t] of [...listeners])if(t==='keydown')f({key:k,target:{tagName:'DIV'},preventDefault(){}});});},
  button(label){const b=find(e=>e.type==='button'&&text(e).includes(label));assert.ok(b,`button ${label}`);act(()=>b.props.onClick());},
  input(label,value){const i=find(e=>e.props['aria-label']===label);assert.ok(i,`input ${label}`);act(()=>i.props.onChange({target:{value,checked:value}}));},
  submit(){act(()=>find(e=>e.type==='form').props.onSubmit({preventDefault(){}}));},
  notice(){const n=find(e=>e.props.className==='dd-shape-draw-notice');return n?text(n):'';},
  readout(){const n=find(e=>e.props.className==='dd-shape-draw-readout');return n?text(n):'';},
  points(){let n=0;(function walk(node){if(!node||typeof node!=='object')return;if(Array.isArray(node))return node.forEach(walk);if(node.props?.className==='dd-shape-draw-point')n++;walk(node.props?.children);})(tree);return n;},
 };
}
const geo={exports:{}};vm.runInNewContext(tools,{module:geo,exports:geo.exports,require,console,Math},{filename:'shapeTools.js'});
const {pathArea,tangentArcBulge,threePointBulge,pathProblem}=geo.exports;
const near=(a,b,t,w)=>assert.ok(Math.abs(a-b)<=t,`${w}: ${a} vs ${b}`);
const frame={x:-100,y:-100,w:800,h:800,viewBox:'-100 -100 800 800'};
function session(mode,closed=true,snapPoints=[]){const out={finished:null,cancelled:false};out.ui=mount({frame,mode,closed,label:'Test shape',snapPoints,panelHost:null,onFinish:r=>{out.finished=r;},onCancel:()=>{out.cancelled=true;}});return out;}

test('polygon: four clicks and Enter make a closed straight outline',()=>{const s=session('polygon');for(const [x,y] of [[0,0],[120,0],[120,96],[0,96]])s.ui.click(x,y);s.ui.key('Enter');assert.ok(s.finished);const p=s.finished.path;assert.equal(p.closed,true);assert.equal(p.points.length,4);assert.ok(p.edges.every(e=>e.kind==='line'));near(pathArea(p),11520,1e-9,'area');});
test('clicking the first point closes the outline',()=>{const s=session('polygon');for(const [x,y] of [[0,0],[120,0],[120,96],[2,1]])s.ui.click(x,y);assert.ok(s.finished,'closed by snapping onto the first point');assert.equal(s.finished.path.points.length,3);});
test('Backspace removes the last point; Escape cancels',()=>{const s=session('polygon');s.ui.click(0,0);s.ui.click(120,0);assert.equal(s.ui.points(),2);s.ui.key('Backspace');assert.equal(s.ui.points(),1);s.ui.key('Escape');assert.equal(s.cancelled,true);assert.equal(s.finished,null);});
test('tangent arc continues the previous edge exactly',()=>{const s=session('polygon',false);s.ui.click(0,0);s.ui.click(120,0);s.ui.key('t');s.ui.click(240,120);s.ui.key('Enter');const e=s.finished.path.edges[1];assert.equal(e.kind,'arc');near(e.bulgeIn,tangentArcBulge({x:1,y:0},{x:120,y:0},{x:240,y:120}),1e-9,'bulge');});
test('3-point arc: middle, then end',()=>{const s=session('polygon',false);s.ui.click(0,0);s.ui.key('a');s.ui.click(60,-40);assert.match(s.ui.notice(),/middle set/);s.ui.click(120,0);s.ui.key('Enter');const e=s.finished.path.edges[0];near(e.bulgeIn,threePointBulge({x:0,y:0},{x:60,y:-40},{x:120,y:0}),1e-9,'bulge');});
test('3-point arc preview at its middle stays straight; committing it still rejects',()=>{const s=session('polygon',false);s.ui.click(0,0);s.ui.key('a');s.ui.click(60,-40);for(const delta of [0,5e-7]){s.ui.move(60+delta,-40,{shiftKey:true});assert.doesNotMatch(s.ui.readout(),/Pick the arc|straight line/);assert.match(s.ui.readout(),/ at /);assert.match(s.ui.notice(),/middle set/);}s.ui.click(60,-40,{shiftKey:true});assert.match(s.ui.notice(),/Pick the arc|straight line/);assert.equal(s.finished,null);s.ui.click(120,0);s.ui.key('Enter');assert.equal(s.finished.path.edges[0].kind,'arc');});
test('typed length and direction place an exact point',()=>{const s=session('polygon',false);s.ui.click(0,0);s.ui.input('Typed edge length',"10' 6\"");s.ui.input('Typed edge direction in degrees','90');s.ui.submit();s.ui.key('Enter');const p=s.finished.path.points[1];near(p.x,0,1e-9,'x');near(p.y,126,1e-9,'y');});
test('15° direction snap with a 1 in grid, and Shift for a free point',()=>{const s=session('polygon',false);s.ui.click(0,0);s.ui.click(100.4,3);s.ui.click(200,4.2,{shiftKey:true});s.ui.key('Enter');const [,a,b]=s.finished.path.points;near(a.x,100,1e-9,'snapped x');near(a.y,0,1e-9,'snapped y');near(b.x,200,1e-9,'free x');near(b.y,4.2,1e-9,'free y');});
test('points snap onto existing corners',()=>{const s=session('polygon',false,[{x:500,y:500}]);s.ui.click(0,0);s.ui.click(505,504);s.ui.key('Enter');const p=s.finished.path.points[1];assert.deepEqual([p.x,p.y],[500,500]);});
test('grid snap without direction snap',()=>{const s=session('polygon',false);s.ui.input('Snap grid','12');s.ui.input('Snap to 15° directions',false);const box=s.ui;box.click(13,25);box.click(130,37);box.key('Enter');const [a,b]=s.finished.path.points;assert.deepEqual([a.x,a.y,b.x,b.y],[12,24,132,36]);});
test('rectangle and circle take two clicks',()=>{const r=session('rectangle');r.ui.click(0,0);r.ui.move(60,40);assert.match(r.ui.readout(),/5′ 0″ × 3′ 4″/);r.ui.click(120,96);near(pathArea(r.finished.path),11520,1e-9,'rectangle');const c=session('circle');c.ui.click(0,0);c.ui.click(60,0);near(pathArea(c.finished.path),Math.PI*3600,1e-6,'circle');});
test('walkway: open centreline with its width and ends',()=>{const s=session('path',false);s.ui.click(0,0);s.ui.click(240,0);s.ui.input('Walkway width',"5'");s.ui.input('Walkway ends','round');s.ui.key('Enter');assert.equal(s.finished.path.closed,false);assert.equal(s.finished.widthIn,60);assert.equal(s.finished.ends,'round');});
test('an open path needs two points, and a crossing outline is refused',()=>{const w=session('polygon',false);w.ui.click(0,0);w.ui.key('Enter');assert.equal(w.finished,null);assert.match(w.ui.notice(),/at least two points/);
 const x=session('polygon');x.ui.input('Snap grid','0');for(const [px,py] of [[0,0],[120,120],[120,0],[0,120]])x.ui.click(px,py,{shiftKey:true});x.ui.key('Enter');assert.equal(x.finished,null);assert.match(x.ui.notice(),/crosses itself/);});
test('every finished shape is a valid path',()=>{const s=session('polygon');for(const [x,y] of [[0,0],[240,0]])s.ui.click(x,y);s.ui.key('t');s.ui.click(240,120);s.ui.key('l');s.ui.click(0,120);s.ui.key('Enter');assert.equal(pathProblem(s.finished.path),'');});
console.log(JSON.stringify({passed,failed}));
process.exit(failed?1:0);
