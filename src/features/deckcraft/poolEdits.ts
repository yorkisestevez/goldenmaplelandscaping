import './poolTypesRuntime';
import type {DeckData} from './types';
import type {AgentCommand} from './designer/deckAgentController';
import {validatePoolFeature,poolValidationProblem,type PoolFeature} from './poolTypes';
import {createPlanningPool,planningPoolAssembly} from './poolAssembly';
import {poolShapeSignature,poolLocalBounds,poolWorldPoint} from './poolGeometry';
import {sampleSiteHeight} from './siteSurface';
import {patioTopPlane} from './yardElevationGeometry';
import {yardShapeCurveWorldPoints} from './yardShapeGeometry';
import {bulgeForRadius} from './circularArcs';
import {isObjectLocked,assertUniqueObjectIds} from './editorOrganization';
const valid=(p:PoolFeature)=>{if(!validatePoolFeature(p))throw Error(poolValidationProblem(p));return p;};
type Command=Extract<AgentCommand,{type:`pool.${string}`}>;
const inside=(p:{x:number;y:number},polygon:{x:number;y:number}[])=>{let yes=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;};
/** All pool pointer, numeric, touch and assistant operations use this one validation path. */
export function applyPoolCommand(data:DeckData,c:Command):Pick<DeckData,'pools'>{
 const pools=data.pools??[];assertUniqueObjectIds(data);
 if(c.type==='pool.create'){
  if(pools.length>=10)throw Error('This design supports up to 10 pools.');
  if([...(data.yardFeatures??[]),...(data.landscapeObjects??[]),...pools].some(f=>f.id===c.id)||['deck','house','site'].includes(c.id))throw Error('Choose a unique pool identifier.');
  const patio=c.patioId?data.yardFeatures?.find(f=>f.id===c.patioId&&f.kind==='patio'&&f.enabled):undefined;
  if(c.patioId&&!patio)throw Error('Choose an included patio or proposed ground.');
  const xIn=c.xIn??(patio?patio.xFt*12:data.width*6),zIn=c.zIn??(patio?patio.zFt*12:data.length*12+240);
  if(![xIn,zIn].every(Number.isFinite))throw Error('Enter finite pool centre coordinates.');
  let finish=c.copingTopElevationIn;
  if(finish===undefined&&patio){if(!inside({x:xIn,y:zIn},yardShapeCurveWorldPoints(patio)))throw Error('Pool placement point is outside the chosen patio. Enter an explicit coping elevation or choose ground.');const plane=patioTopPlane(patio,sampleSiteHeight(data,patio.xFt*12,patio.zFt*12)??NaN);finish=plane.x*xIn+plane.z*zIn+plane.constant;}
  if(finish===undefined)finish=sampleSiteHeight(data,xIn,zIn)??undefined;
  if(finish===undefined||!Number.isFinite(finish))throw Error('This placement lacks surveyed ground coverage. Enter the fixed coping elevation explicitly.');
  return {pools:[...pools,valid(createPlanningPool({id:c.id,type:c.poolType,shape:c.shape,xIn,zIn,copingTopElevationIn:finish}))]};
 }
 const old=pools.find(p=>p.id===c.id);if(!old)throw Error('Choose a current pool.');
 if(isObjectLocked(data.editorOrganization,old.id))throw Error(`${old.name} is locked. Unlock its object or layer first.`);
 if(c.type==='pool.delete')return {pools:pools.filter(p=>p.id!==c.id)};
 let next:PoolFeature=old;
 if(c.type==='pool.move')next={...old,xIn:old.xIn+c.dxIn,zIn:old.zIn+c.dzIn};
 else if(c.type==='pool.rotate')next={...old,rotationDeg:c.rotationDeg};
 else if(c.type==='pool.edit'){next={...old,...c.patch};if(c.patch.type&&c.patch.type!==old.type)next.assembly=planningPoolAssembly(c.patch.type);}
 else if(c.type==='pool.shape'){const bounds=poolLocalBounds({outline:c.outline,curves:c.curves}),oldBounds=poolLocalBounds(old),ratio=bounds.lengthIn/oldBounds.lengthIn;next={...old,outline:c.outline,curves:c.curves,depthProfile:old.depthProfile.map(p=>({...p,stationIn:p.stationIn*ratio}))};}
 else if(c.type==='pool.depth')next={...old,depthProfile:c.profile};
 else if(c.type==='pool.radius'){const a=old.outline[c.index],b=old.outline[(c.index+1)%old.outline.length];if(!a||!b)throw Error('Choose an existing pool edge.');const curve={edge:c.index,bulgeIn:bulgeForRadius(a,b,c.radiusIn,c.side??Math.sign(old.curves?.find(s=>s.edge===c.index)?.bulgeIn??-1))};next={...old,curves:[...(old.curves??[]).filter(s=>s.edge!==c.index),curve]};const ratio=poolLocalBounds(next).lengthIn/poolLocalBounds(old).lengthIn;next.depthProfile=old.depthProfile.map(p=>({...p,stationIn:p.stationIn*ratio}));}
 else throw Error('Choose a supported pool operation.');
 if(next.product&&(next.type!==old.type||next.product.shapeSignature!==poolShapeSignature(next))){const {product:_,...unmatched}=next;next=unmatched;}
 next=valid(next);return {pools:pools.map(p=>p.id===next.id?next:p)};
}
export function poolPointCommand(p:PoolFeature,index:number,dxIn:number,dzIn:number):Command{
 const a=p.rotationDeg*Math.PI/180,dx=Math.cos(a)*dxIn+Math.sin(a)*dzIn,dz=-Math.sin(a)*dxIn+Math.cos(a)*dzIn;
 const outline=p.outline.map((q,i)=>i===index?{x:q.x+dx,y:q.y+dz}:q);
 // Retain authoritative radius when one endpoint moves; reject impossible chord changes.
 const curves=p.curves?.map(c=>{if(c.edge!==index&&(c.edge+1)%p.outline.length!==index)return c;const before=p.outline[c.edge],end=p.outline[(c.edge+1)%p.outline.length],half=Math.hypot(end.x-before.x,end.y-before.y)/2,r=(half*half+c.bulgeIn*c.bulgeIn)/(2*Math.abs(c.bulgeIn));const a=outline[c.edge],b=outline[(c.edge+1)%outline.length],newHalf=Math.hypot(b.x-a.x,b.y-a.y)/2,minor=bulgeForRadius(a,b,r,Math.sign(c.bulgeIn));return {...c,bulgeIn:Math.abs(c.bulgeIn)>half?Math.sign(c.bulgeIn)*(r+Math.sqrt(Math.max(0,r*r-newHalf*newHalf))):minor};});
 return {type:'pool.shape',id:p.id,outline,...(curves?{curves}:{})};
}
export const poolControlWorld=(p:PoolFeature)=>p.outline.map(q=>poolWorldPoint(p,q));
