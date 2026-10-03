import {loadAdvancedYardRuntime} from '../src/features/deckcraft/yardModel';
await loadAdvancedYardRuntime();
import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildYardModel} from '../src/features/deckcraft/yardModel';
import {groundEdgeGeometry} from '../src/features/deckcraft/components/viewer3d/lawnSurface';
import '../src/features/deckcraft/siteModelRuntime';
import '../src/features/deckcraft/siteSurfaceEngine';
import type {SiteGradingRegion,SiteModel} from '../src/features/deckcraft/siteModel';
const rect=(x:number,z:number,w:number,d:number)=>[{x,y:z},{x:x+w,y:z},{x:x+w,y:z+d},{x,y:z+d}];
const points=rect(0,0,120,120).map((p,i)=>({id:String(i),xIn:p.x,zIn:p.y,elevationIn:0}));
const grade=(id:string,x:number,z:number,w:number,d:number,h:number):SiteGradingRegion=>({id,name:id,boundary:rect(x,z,w,d),originXIn:0,originZIn:0,elevationIn:h,slopeXPct:0,slopeZPct:0});
let checks=0;
function verify(grading:SiteGradingRegion[],area:number,interior:boolean,kind:'existing'|'proposed'='proposed'){
 const siteModel:SiteModel={version:1,points,grading},yard=buildYardModel({...DEFAULT_DECK,siteModel}),before=JSON.stringify(yard),g=groundEdgeGeometry(yard,kind),p=g.getAttribute('position');let measuredArea=0;
 for(let i=0;i<p.count;i+=3){const ax=p.getX(i+1)-p.getX(i),ay=p.getY(i+1)-p.getY(i),az=p.getZ(i+1)-p.getZ(i),bx=p.getX(i+2)-p.getX(i),by=p.getY(i+2)-p.getY(i),bz=p.getZ(i+2)-p.getZ(i);measuredArea+=Math.hypot(ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx)/2;}
 assert.ok(Math.abs(measuredArea-area)<.002,`${measuredArea} expected ${area}`);checks++;
 if(interior)for(let i=0;i<p.count;i++){assert.ok(p.getX(i)>=20-.001&&p.getX(i)<=100+.001&&p.getZ(i)>=20-.001&&p.getZ(i)<=100+.001);checks++;}
 assert.equal(JSON.stringify(yard),before);checks++;g.dispose();
}
verify([grade('perimeter',0,0,120,120,12)],4*120*12,false);
verify([grade('internal',20,20,80,80,12)],4*80*12,true);
verify([grade('low',20,20,80,80,12),grade('high',60,20,40,80,18)],5280,true);
verify([grade('low',20,20,80,80,12),grade('same',60,20,40,80,12)],4*80*12,true);
verify([grade('internal',20,20,80,80,12)],0,true,'existing');
verify([],0,true);
verify([{...grade('crossing',20,20,80,80,0),originXIn:60,slopeXPct:100}],9600,true);
console.log(`SITE RENDERING OK — ${checks} checks; actual internal grade jumps, survey boundary and shared continuous edges; quantities unchanged.`);
