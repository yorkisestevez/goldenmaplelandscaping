import {readFileSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {buildYardModel,yardArea,yardClip} from '../src/features/deckcraft/yardModel';
import {yardShapeProblem} from '../src/features/deckcraft/yardShapeEditing';
import {HARDSCAPE_PRODUCTS,hardscapeBody,rectangularUnit} from '../src/features/deckcraft/hardscapeCatalogue';
import type {DeckData,YardFeature} from '../src/features/deckcraft/types';
const initial=JSON.parse(readFileSync('../hardscape-initial.json','utf8'));
const base:DeckData={...initial.state.design,terrainConfig:{widthFt:140,depthFt:140,elevationIn:0,slopePct:0}};
function paving(id:string,color?:string){const p=HARDSCAPE_PRODUCTS.find(p=>p.id===id)!;if(!p)throw Error(id);const finish=p.finishes[0],unit=finish.units.find(u=>hardscapeBody(u.role)&&(p.category==='wall'||rectangularUnit(u)))!,c=finish.colors.find(c=>c.id===color)??finish.colors[0];return {productId:p.id,color:c.hex??'#aaa69b',hardscape:{finishId:finish.id,colorId:c.id,unitId:unit.id,patternId:'running-bond',angleDeg:0,jointMm:p.category==='wall'?0:3}};}
const catalogue=HARDSCAPE_PRODUCTS.filter(p=>p.category!=='wall'&&p.finishes.some(f=>f.units.some(u=>hardscapeBody(u.role)&&rectangularUnit(u))));
const mainProduct=catalogue.find(p=>/blu.*slate|blu.*smooth/.test(p.id))??catalogue.find(p=>/blu/.test(p.id))!;
console.log('Paving',mainProduct.id);
const finish=paving(mainProduct.id),dark=paving(mainProduct.id,'onyx-black');
function patio(id:string,x:number,z:number,w:number,d:number,h=0,extra={}){return {id,kind:'patio',name:id,enabled:true,xFt:x,zFt:z,widthFt:w,depthFt:d,heightIn:h,rotationDeg:0,...finish,...extra} as YardFeature;}
function wall(id:string,points:number[][],h=30,extra={}){const run=points.slice(1).reduce((n,p,i)=>n+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0);return {id,kind:'retaining-wall',name:id,enabled:true,xFt:0,zFt:0,widthFt:run,depthFt:1,heightIn:h,rotationDeg:0,productId:'segmental-concrete',color:'#8a8882',wallPath:points.map(([x,z])=>({x:x*12,y:z*12})),...extra} as YardFeature;}
const arc=(cx:number,cz:number,r:number,n:number,a:number,b:number)=>Array.from({length:n},(_,i)=>{const t=(a+(b-a)*i/(n-1))*Math.PI/180;return [cx+r*Math.cos(t),cz+r*Math.sin(t)];});
const wallFinish=paving('techo-raffinato-wall','greyed-nickel');
const wallStock=HARDSCAPE_PRODUCTS.find(p=>p.id==='techo-raffinato-wall')!.finishes[0].units.find(u=>u.id===wallFinish.hardscape.unitId)!;
const supplierWall={...wallFinish,depthFt:wallStock.lengthMm/304.8,hardscape:{...wallFinish.hardscape,capUnitId:'cap:techo-raffinato-cap:hd2-smooth:greyed-nickel:raffinato-812-356-60'}};
const scenarios:{name:string;features:YardFeature[]}[]=[
 {name:'sculpted-courtyard',features:[
  wall('curved-garden-wall',arc(-9,35,12,17,110,250),30,supplierWall),
  wall('rear-angular-wall',[[-12,51],[16,51],[25,45]],42,supplierWall),
  patio('main-courtyard',8,32,38,28,0,{outline:[[-228,-168],[156,-168],[228,-96],[228,96],[156,168],[-156,168],[-228,96]].map(([x,y])=>({x,y})),hardscape:{...finish.hardscape,angleDeg:45},inlays:[{id:'diamond',name:'Charcoal diamond',shape:'diamond',xIn:0,yIn:0,widthIn:96,depthIn:96,rotationDeg:0,...dark},{id:'band',name:'Accent band',shape:'band',xIn:0,yIn:115,widthIn:216,depthIn:18,rotationDeg:0,...dark}]})
 ]},
 {name:'three-terraces',features:[
  wall('lower-return',[[-17,20],[-17,35],[-3,35]],18),
  wall('middle-return',[[0,26],[0,43],[14,43]],36),
  wall('upper-return',[[17,32],[17,50],[32,50]],54),
  patio('lower-terrace',-9,26,12,13,0),patio('middle-terrace',8,34,12,12,18),patio('upper-terrace',25,41,12,12,36)
 ]},
 {name:'max-64-point-patio',features:[patio('64-point-ellipse',8,42,60,52,0,{outline:Array.from({length:64},(_,i)=>({x:360*Math.cos(i*2*Math.PI/64),y:312*Math.sin(i*2*Math.PI/64)})),hardscape:{...finish.hardscape,angleDeg:37}})]},
 {name:'max-80-foot-wall',features:[wall('80-foot-sweep',arc(8,45,25,64,180,180+80/25*180/Math.PI),72)]},
 {name:'acute-return',features:[wall('hairpin',[[-20,30],[0,30],[-18,33]],36)]},
 {name:'paver-budget',features:[patio('oversize-budget',8,45,60,60,0,paving('techo-squadra-paver'))]},
 {name:'overlap-and-support',features:[wall('house-collision',[[0,-2],[14,-2]],24),patio('deck-underlay',8,6,20,20)]}
];
const results=scenarios.map(s=>{const start=performance.now(),model=buildYardModel({...base,yardFeatures:s.features});return {name:s.name,ms:Math.round(performance.now()-start),quantities:model.quantities,budget:model.paverBudget,features:model.features.map(f=>{const first=f.boxes.find(b=>b.role==='wall-block');const course=first?f.boxes.filter(b=>b.role==='wall-block'&&Math.abs(b.y-first.y)<.001):[];const coverage=yardClip(course.map(b=>b.polygon!));return {id:f.config.id,excluded:f.excluded,shapeProblem:yardShapeProblem(f.config.kind as 'patio'|'retaining-wall',f.config.outline??f.config.wallPath??[]),boxes:f.boxes.length,quantities:f.quantities,wallGapSqft:first?yardArea(yardClip(f.footprints,coverage,'difference')):0,warnings:f.warnings};}),warnings:model.warnings};});
writeFileSync('../hardscape-scenarios.json',JSON.stringify({base,scenarios},null,2));
writeFileSync('../hardscape-stress-before.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results.map(r=>({name:r.name,ms:r.ms,quantities:r.quantities,features:r.features.map(f=>({id:f.id,excluded:f.excluded,boxes:f.boxes,gap:f.wallGapSqft})),budget:r.budget})),null,2));
