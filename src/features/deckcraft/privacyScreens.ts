import type {DeckData} from './types';
import type {Box,DeckTakeoff,V3} from './deckTakeoff';

export type PrivacyScreenFinish='Black'|'White';
export interface PrivacyScreenSelection {id:string;productId:string;levelIndex:number;edgeIndex:number;offsetPct:number;count:number;finish:PrivacyScreenFinish;enabled:boolean}
export interface PrivacyScreenProduct {id:string;manufacturer:string;name:string;pattern:'horizontal'|'perforated'|'solid';widthIn:number;heightIn:number;thicknessIn:number;postWidthIn:number;postHeightIn:number;finishes:PrivacyScreenFinish[];sourceUrl:string;price:null}
/** Schematic patterns are deliberately not represented as manufacturer CAD. */
export const PRIVACY_SCREEN_PRODUCTS:PrivacyScreenProduct[]=[
 {id:'hideaway-horizon',manufacturer:'HIDEAWAY',name:'Horizon',pattern:'horizontal',widthIn:36,heightIn:68,thicknessIn:.1,postWidthIn:3,postHeightIn:73,finishes:['Black','White'],sourceUrl:'https://hideawayscreens.ca/products/pre-order-privacy-screen-horizon',price:null},
 {id:'hideaway-breeze',manufacturer:'HIDEAWAY',name:'Breeze',pattern:'perforated',widthIn:36,heightIn:68,thicknessIn:.1,postWidthIn:3,postHeightIn:73,finishes:['Black','White'],sourceUrl:'https://hideawayscreens.ca/products/privacy-screen-breeze',price:null},
 {id:'hideaway-solid',manufacturer:'HIDEAWAY',name:'Solid',pattern:'solid',widthIn:36,heightIn:68,thicknessIn:.1,postWidthIn:3,postHeightIn:73,finishes:['Black'],sourceUrl:'https://hideawayscreens.ca/products/privacy-screen-solid',price:null},
];
export const PRIVACY_SCREEN_REVIEW='Independent privacy screen mounting only—not a railing or guard replacement. Wind loads, post anchorage, blocking, framing capacity, guard/climbability interaction and local permit requirements need project-specific review. No structural mounting approval is implied.';
export const PRIVACY_SCREEN_SOURCES={brackets:'https://hideawayscreens.ca/products/mounting-brackets-pack-of-2',measurement:'https://cdn.shopify.com/s/files/1/0060/5919/6489/files/Hideaway_Measurement_Manual.pdf?v=1678987646',hoft:'https://www.hoftsolutions.com/sites/default/files/product/instructionshoft2020_72in_3.pdf'};
export interface PrivacyScreenEdge {levelIndex:number;edgeIndex:number;label:string;a:V3;b:V3;lengthIn:number;inward:{x:number;z:number};available:[number,number][]}
export interface ScreenBox extends Box {rowId:string;finish:PrivacyScreenFinish;role:'panel'|'post'|'bracket';productId:string}
export interface PrivacyScreenPanel extends ScreenBox {role:'panel';pattern:PrivacyScreenProduct['pattern']}
export interface PrivacyScreenSchedule {rowId:string;productId:string;description:string;quantity:number;unit:'panel'|'post'|'pack'|'set';unitPrice:null;status:'quote-required';sourceUrl:string}
const INSET=12,CLEARANCE=12;
const cut=(spans:[number,number][],lo:number,hi:number):[number,number][]=>spans.flatMap(([a,b])=>hi<=a||lo>=b?[[a,b]]:[...(lo>a?[[a,lo]]:[]),...(hi<b?[[hi,b]]:[])] as [number,number][]);
const inside=(p:{x:number;z:number},outline:{x:number;y:number}[],offset:V3)=>{let yes=false;for(let i=0,j=outline.length-1;i<outline.length;j=i++){const a=outline[i],b=outline[j],x=p.x-offset.x,z=p.z-offset.z;if((a.y>z)!==(b.y>z)&&x<(b.x-a.x)*(z-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;};

/** Real polygon edges and real flight ends; independent of guard visibility/removal. */
export function privacyScreenEdges(data:DeckData,model:DeckTakeoff):PrivacyScreenEdge[]{
 const result:PrivacyScreenEdge[]=[];
 model.levels.forEach((level,levelIndex)=>{
  if(level.kind==='winder')return;
  const fp=level.footprint,area=fp.outline.reduce((n,a,i)=>{const b=fp.outline[(i+1)%fp.outline.length];return n+a.x*b.y-b.x*a.y;},0),sign=area>=0?1:-1;
  fp.outline.forEach((p,i)=>{
   const q=fp.outline[(i+1)%fp.outline.length],dx=q.x-p.x,dz=q.y-p.y,len=Math.hypot(dx,dz);
   // Curved tessellation is not an installable straight stock-panel edge.
   if(len<42||Math.abs(dx)>.01&&Math.abs(dz)>.01)return;
   if(levelIndex===0&&(data.deckType==='Attached'||data.deckType==='Add-on')&&Math.abs(p.y)<.01&&Math.abs(q.y)<.01)return;
   const ux=dx/len,uz=dz/len,a={x:p.x+level.offset.x,y:level.top,z:p.y+level.offset.z},b={x:q.x+level.offset.x,y:level.top,z:q.y+level.offset.z},inward={x:-uz*sign,z:ux*sign};
   let available:[number,number][]=[[CLEARANCE,len-CLEARANCE]];
   const exclude=(c:V3,width:number)=>{if(Math.abs(c.y-level.top)>.1)return;const cross=(c.x-a.x)*uz-(c.z-a.z)*ux;if(Math.abs(cross)>3)return;const t=(c.x-a.x)*ux+(c.z-a.z)*uz;available=cut(available,t-width/2-CLEARANCE,t+width/2+CLEARANCE);};
   for(const f of model.flights){exclude(f.start,f.width);exclude(f.end,f.width);}
   for(const c of model.connections){const source=model.levels[c.from],o=c.opening,center={x:source.offset.x+o.origin.x+o.along.x*o.width/2,y:source.top,z:source.offset.z+o.origin.y+o.along.y*o.width/2};exclude(center,o.width);exclude({x:center.x+o.outward.x*c.run,y:model.levels[c.to].top,z:center.z+o.outward.y*c.run},o.width);}
   const side=Math.abs(dz)<.01?(inward.z>0?'Back':'Front'):(inward.x>0?'Left':'Right');
   result.push({levelIndex,edgeIndex:i,label:`${level.kind==='landing'?'Landing':levelIndex===0?'Main deck':'Second section'} · ${side} edge ${i+1}`,a,b,lengthIn:len,inward,available});
  });
 });
 return result;
}

/** Fixed stock sizes; an entire row must fit at its selected position or none is drawn. */
export function privacyScreenLayout(data:DeckData,model:DeckTakeoff){
 const edges=privacyScreenEdges(data,model),panels:PrivacyScreenPanel[]=[],posts:ScreenBox[]=[],brackets:ScreenBox[]=[],schedule:PrivacyScreenSchedule[]=[],warnings:string[]=[],rows:{id:string;selected:number;drawn:number;warning?:string}[]=[];
 const occupied:Box[]=[];let selectedCount=0;
 for(const row of data.privacyScreens??[]){
  if(!row.enabled){rows.push({id:row.id,selected:0,drawn:0});continue;}
  const count=Number.isInteger(row.count)&&row.count>0&&row.count<=12?row.count:0;selectedCount+=count;
  const state={id:row.id,selected:count,drawn:0,warning:''};rows.push(state);
  const fail=(why:string)=>{state.warning=`Screen row ${row.id}: ${why}`;warnings.push(state.warning);};
  const product=PRIVACY_SCREEN_PRODUCTS.find(p=>p.id===row.productId),edge=edges.find(e=>e.levelIndex===row.levelIndex&&e.edgeIndex===row.edgeIndex);
  if(!product||!edge||!count||!Number.isFinite(row.offsetPct)||row.offsetPct<0||row.offsetPct>100||!product.finishes.includes(row.finish)){fail('selection or straight edge is no longer valid. Review this row; nothing is drawn.');continue;}
  const span=count*product.widthIn+(count+1)*product.postWidthIn,room=edge.lengthIn-2*CLEARANCE-span;
  if(room<0){fail(`${count} stock panels plus posts need ${span.toFixed(0)} in of clear run; reduce panels or choose a longer edge.`);continue;}
  const start=CLEARANCE+room*row.offsetPct/100,end=start+span;
  if(!edge.available.some(([a,b])=>start>=a-.01&&end<=b+.01)){fail('this position crosses a stair, landing access or section connection. Move the row or reduce its panel count.');continue;}
  const ux=(edge.b.x-edge.a.x)/edge.lengthIn,uz=(edge.b.z-edge.a.z)/edge.lengthIn,angle=-Math.atan2(uz,ux),level=model.levels[edge.levelIndex];
  const point=(t:number,y:number):V3=>({x:edge.a.x+ux*t+edge.inward.x*INSET,y,z:edge.a.z+uz*t+edge.inward.z*INSET});
  const envelope:Box={...point((start+end)/2,level.top+product.postHeightIn/2),w:Math.abs(ux)*span+Math.abs(uz)*product.postWidthIn,h:product.postHeightIn,d:Math.abs(uz)*span+Math.abs(ux)*product.postWidthIn};
  if(!Array.from({length:Math.ceil(span/3)+1},(_,i)=>start+span*i/Math.ceil(span/3)).every(t=>[-3,3].every(n=>inside({...point(t,level.top),x:point(t,level.top).x+edge.inward.x*n,z:point(t,level.top).z+edge.inward.z*n},level.footprint.outline,level.offset)))){fail('the inward mounting strip leaves the deck footprint. Choose a different edge.');continue;}
  if(occupied.some(b=>Math.abs(b.x-envelope.x)<(b.w+envelope.w)/2+3&&Math.abs(b.z-envelope.z)<(b.d+envelope.d)/2+3&&Math.abs(b.y-envelope.y)<(b.h+envelope.h)/2)){fail('this row overlaps another screen row. Move it before adding panels.');continue;}
  occupied.push(envelope);state.drawn=count;
  const common={rowId:row.id,finish:row.finish,productId:product.id,angle};
  for(let i=0;i<=count;i++)posts.push({...point(start+product.postWidthIn/2+i*(product.widthIn+product.postWidthIn),level.top+product.postHeightIn/2),...common,w:product.postWidthIn,h:product.postHeightIn,d:product.postWidthIn,role:'post'});
  for(let i=0;i<count;i++){
   const x=start+product.postWidthIn+i*(product.widthIn+product.postWidthIn),y=level.top+4+product.heightIn/2;
   panels.push({...point(x+product.widthIn/2,y),...common,w:product.widthIn,h:product.heightIn,d:product.thicknessIn,role:'panel',pattern:product.pattern});
   for(const t of [x+.5,x+product.widthIn-.5])brackets.push({...point(t,y),...common,w:1,h:68,d:1,role:'bracket'});
  }
  const add=(description:string,quantity:number,unit:PrivacyScreenSchedule['unit'],sourceUrl:string)=>schedule.push({rowId:row.id,productId:product.id,description,quantity,unit,unitPrice:null,status:'quote-required',sourceUrl});
  add(`${product.manufacturer} ${product.name} 36 × 68 in · ${row.finish}`,count,'panel',product.sourceUrl);
  add('HIDEAWAY 3 × 3 × 73 in posts, including caps and base skirts',count+1,'post',product.sourceUrl);
  add('HIDEAWAY mounting brackets · 2-pack with assembly hardware',count,'pack',PRIVACY_SCREEN_SOURCES.brackets);
  add('Post-specific anchorage and structural blocking · quantities/detail to be reviewed',count+1,'set',PRIVACY_SCREEN_SOURCES.measurement);
 }
 if(selectedCount){warnings.push(PRIVACY_SCREEN_REVIEW,'Panel patterns and bracket/post envelopes are schematic. The 12 in inward setback and access clearance are preview allowances, not manufacturer-approved mounting dimensions. Confirm clearances, shop drawings, finish availability and an Ontario supplier quote.');}
 return {edges,panels,posts,brackets,boxes:[...panels,...posts,...brackets] as ScreenBox[],rows,schedule,warnings,selectedCount,drawnCount:panels.length,unplacedCount:selectedCount-panels.length,quoteRequired:selectedCount>0};
}
