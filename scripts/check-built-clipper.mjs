// Tests the actual vendor output produced by the scoped build transform.
// The unmodified installed library is the independent reference.
import {readFileSync,readdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const file=readdirSync('build/client/assets').find(n=>/^geometry-clipping-.*\.js$/.test(n));
const source=readFileSync(`build/client/assets/${file}`,'utf8');
const baseline={C:(await import('clipper-lib')).default};
const compiled=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const candidate={C:Object.values(compiled).find(value=>value&&typeof value==='object'&&typeof value.Clipper==='function')};
assert.ok(candidate.C,'Compiled worker chunk exports the public Clipper API');
const publicMethods=new Set(['AddPath','AddPaths','Area','Clear','Execute','GetBounds2','PointInPolygon','PointOnPolygon','Reset','SlopesEqual']);
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
console.log(JSON.stringify({checks,builtGzipKB:gzipSync(source).length/1024,reference:'unmodified clipper-lib 6.4.2',compiledOutputParity:true}));
