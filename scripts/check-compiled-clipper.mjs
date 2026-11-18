// Isolated experiment: never changes Vite config or the actual build artifacts.
import {readFileSync,readdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {minify} from 'terser';
import assert from 'node:assert/strict';
const file=readdirSync('build/client/assets').find(n=>/^geometry-clipping-.*\.js$/.test(n));
const source=readFileSync(`build/client/assets/${file}`,'utf8');
const library=readFileSync('node_modules/clipper-lib/clipper.js','utf8');
const publicMethods=new Set(['AddPath','AddPaths','Area','Clear','Execute','GetBounds2','PointInPolygon','PointOnPolygon','Reset','SlopesEqual']);
const privateMethods=[...new Set([...library.matchAll(/ClipperLib\.(?:Clipper|ClipperBase|ClipperOffset)\.prototype\.(\w+)\s*=/g)].map(m=>m[1]))].filter(m=>!publicMethods.has(m));
const privateEdges=['Bot','Curr','Top','Delta','Dx','WindDelta','WindCnt','WindCnt2','OutIdx','PolyTyp','NextInLML','NextInAEL','PrevInAEL','NextInSEL','PrevInSEL','Idx','FirstLeft','Pts','BottomPt','OutPt1','OutPt2','OffPt','LeftBound','RightBound','Edge1','Edge2'];
const propertyPattern=new RegExp(`^(?:m_.*|${[...privateMethods,...privateEdges].join('|')})$`);
const baseline=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const result=await minify(source,{module:true,compress:{passes:3},mangle:{properties:{regex:propertyPattern}}});
const candidate=await import(`data:text/javascript;base64,${Buffer.from(result.code).toString('base64')}`);
let checks=0;
const equal=(a,b)=>{assert.equal(JSON.stringify(a),JSON.stringify(b));checks++;};
equal(Object.keys(baseline.C).sort(),Object.keys(candidate.C).sort());
for(const klass of ['Clipper','ClipperBase','ClipperOffset'])for(const method of publicMethods)equal(typeof baseline.C[klass].prototype[method],typeof candidate.C[klass].prototype[method]);
function run(C,subject,clip,operation,tree=false){
 const c=new C.Clipper();c.PreserveCollinear=true;
 c.AddPaths(subject,C.PolyType.ptSubject,true);c.AddPaths(clip,C.PolyType.ptClip,true);
 const out=tree?new C.PolyTree():new C.Paths();
 c.Execute(operation,out,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero);
 if(!tree)return out;
 return C.JS.PolyTreeToExPolygons(out);
}
for(let i=0;i<64;i++){
 const scale=[1,100000,10000000,100000000][i%4],dx=(i-32)*1e4;
 const path=p=>p.map(([X,Y])=>({X:Math.round((X+dx)*scale),Y:Math.round(Y*scale)}));
 const outer=path([[0,0],[100+i,0],[100+i,80],[40,80],[40,35],[0,35]]);
 const hole=path([[50,10],[50,25],[75,25],[75,10]]);
 const clip=path([[-10,20],[60+i,5],[120,60],[25,100]]);
 for(const operation of [0,1,2,3])for(const tree of [false,true])equal(run(baseline.C,[outer,hole],[clip],operation,tree),run(candidate.C,[outer,hole],[clip],operation,tree));
 for(const join of [0,1,2])for(const delta of [-4,3]){
  const offset=C=>{const c=new C.ClipperOffset(2,.25*scale);c.AddPaths([outer,hole],join,C.EndType.etClosedPolygon);const out=new C.Paths();c.Execute(out,delta*scale);return out;};
  equal(offset(baseline.C),offset(candidate.C));
 }
 const line=path([[0,0],[35,10],[65,0],[110,35]]);
 for(const end of [2,3,4]){
  const offset=C=>{const c=new C.ClipperOffset(2,.25*scale);c.AddPath(line,C.JoinType.jtRound,end);const out=new C.Paths();c.Execute(out,2*scale);return out;};
  equal(offset(baseline.C),offset(candidate.C));
 }
}
console.log(JSON.stringify({checks,privateMethodCount:privateMethods.length,baselineGzipKB:gzipSync(source).length/1024,candidateGzipKB:gzipSync(result.code).length/1024,savingKB:(gzipSync(source).length-gzipSync(result.code).length)/1024}));
