import {MANUFACTURER_ACCESSORIES} from './manufacturerCatalog';
import type {DeckData} from './types';
import type {DeckTakeoff,Box,Member} from './deckTakeoff';
import {getHardwareLayout} from './hardwareLayout';

/** Installed accessory extents and quantities; branded supplier prices stay unknown. */
export function catalogueAccessoryLayout(data:DeckData,model:DeckTakeoff){
  const selected=MANUFACTURER_ACCESSORIES.filter(p=>data.catalogueAccessories?.includes(p.id)&&p.previewSupported);
  const fascia:Member[]=[],tape:Box[]=[],flashing:Box[]=[],rows:{id:string;name:string;qty:number;unit:string;spec:string}[]=[];
  const has=(kind:string)=>selected.some(p=>p.kind===kind);
  const attached=data.deckType==='Attached'||data.deckType==='Add-on';
  if(has('fascia'))for(const l of model.levels)for(const r of l.rim??[]){
    if(attached&&l.index===0&&Math.abs(r.a.z)<.01&&Math.abs(r.b.z)<.01)continue;
    const length=Math.hypot(r.b.x-r.a.x,r.b.z-r.a.z),nx=(r.b.z-r.a.z)/length,nz=-(r.b.x-r.a.x)/length;
    fascia.push({...r,a:{x:r.a.x+nx*1.15,y:r.a.y,z:r.a.z+nz*1.15},b:{x:r.b.x+nx*1.15,y:r.b.y,z:r.b.z+nz*1.15},width:.75,role:'catalogue-fascia'});
  }
  if(has('joist-tape'))for(const l of model.levels)for(const j of l.joists){
    const length=Math.hypot(j.b.x-j.a.x,j.b.z-j.a.z);tape.push({x:(j.a.x+j.b.x)/2,y:j.a.y+j.depth/2+.02,z:(j.a.z+j.b.z)/2,w:1.625,h:.025,d:length,angle:Math.atan2(j.b.x-j.a.x,j.b.z-j.a.z)});
  }
  if(has('flashing')&&attached){const w=data.width*12;flashing.push({x:w/2,y:data.height-1.08,z:1.6,w,h:.025,d:4},{x:w/2,y:data.height+.4,z:-.42,w,h:3,d:.025});}
  for(const p of selected){
    let qty=0,unit='lf';
    if(p.kind==='fascia')qty=fascia.reduce((n,m)=>n+Math.hypot(m.b.x-m.a.x,m.b.z-m.a.z)/12,0);
    if(p.kind==='joist-tape')qty=tape.reduce((n,b)=>n+b.d/12,0);
    if(p.kind==='flashing')qty=attached?data.width:0;
    if(p.kind==='fastener'){unit='positions';qty=/fascia/.test(p.id)?Math.ceil(model.levels.reduce((n,l)=>n+(l.rim??[]).reduce((s,r)=>s+Math.hypot(r.b.x-r.a.x,r.b.z-r.a.z),0),0)/12)*2:getHardwareLayout(data,model).screws.length;}
    rows.push({id:p.id,name:p.name,qty:Math.ceil(qty*10)/10,unit,spec:`${p.notes} Quantity follows modeled installed extents; pack sizes and supplier rate require confirmation.`});
  }
  return {fascia,tape,flashing,rows};
}
