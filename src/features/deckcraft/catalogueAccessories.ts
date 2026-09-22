import {MANUFACTURER_ACCESSORIES} from './manufacturerCatalog';
import type {DeckData} from './types';
import type {DeckTakeoff,Box,Member} from './deckTakeoff';
import {getHardwareLayout} from './hardwareLayout';
import {getHouseContact} from './houseContact';

/** Installed accessory extents and quantities; branded supplier prices stay unknown. */
export function catalogueAccessoryLayout(data:DeckData,model:DeckTakeoff){
  const selected=MANUFACTURER_ACCESSORIES.filter(p=>data.catalogueAccessories?.includes(p.id)&&p.previewSupported);
  const fascia:Member[]=[],tape:Box[]=[],flashing:Box[]=[],rows:{id:string;name:string;qty:number;unit:string;spec:string}[]=[];
  const has=(kind:string)=>selected.some(p=>p.kind===kind);
  const contact=getHouseContact(data,model.levels[0].footprint);
  if(has('fascia'))for(const l of model.levels)for(const r of l.rim??[]){
    if(l.index===0&&contact.onContact({x:r.a.x,y:r.a.z},{x:r.b.x,y:r.b.z}))continue;
    const length=Math.hypot(r.b.x-r.a.x,r.b.z-r.a.z),nx=(r.b.z-r.a.z)/length,nz=-(r.b.x-r.a.x)/length;
    fascia.push({...r,a:{x:r.a.x+nx*1.15,y:r.a.y,z:r.a.z+nz*1.15},b:{x:r.b.x+nx*1.15,y:r.b.y,z:r.b.z+nz*1.15},width:.75,role:'catalogue-fascia'});
  }
  if(has('joist-tape'))for(const l of model.levels)for(const j of l.joists){
    const length=Math.hypot(j.b.x-j.a.x,j.b.z-j.a.z);tape.push({x:(j.a.x+j.b.x)/2,y:j.a.y+j.depth/2+.02,z:(j.a.z+j.b.z)/2,w:1.625,h:.025,d:length,angle:Math.atan2(j.b.x-j.a.x,j.b.z-j.a.z)});
  }
  // Flashing runs the full length of every ledger contact: a lap on the deck side and an upstand on the wall.
  if(has('flashing'))for(const c of contact.contacts){
    const mx=(c.a.x+c.b.x)/2,my=(c.a.y+c.b.y)/2,w=c.lengthIn,turn=Math.atan2(-(c.b.y-c.a.y),c.b.x-c.a.x),angle=Math.abs(turn)>1e-9?{angle:turn}:{};
    flashing.push({x:mx+c.inward.x*1.6,y:data.height-1.08,z:my+c.inward.y*1.6,w,h:.025,d:4,...angle},{x:mx-c.inward.x*.42,y:data.height+.4,z:my-c.inward.y*.42,w,h:3,d:.025,...angle});
  }
  for(const p of selected){
    let qty=0,unit='lf';
    if(p.kind==='fascia')qty=fascia.reduce((n,m)=>n+Math.hypot(m.b.x-m.a.x,m.b.z-m.a.z)/12,0);
    if(p.kind==='joist-tape')qty=tape.reduce((n,b)=>n+b.d/12,0);
    if(p.kind==='flashing')qty=contact.ledgerLf;
    if(p.kind==='fastener'){unit='positions';qty=/fascia/.test(p.id)?Math.ceil(model.levels.reduce((n,l)=>n+(l.rim??[]).reduce((s,r)=>s+Math.hypot(r.b.x-r.a.x,r.b.z-r.a.z),0),0)/12)*2:getHardwareLayout(data,model).screws.length;}
    rows.push({id:p.id,name:p.name,qty:Math.ceil(qty*10)/10,unit,spec:`${p.notes} Quantity follows modeled installed extents; pack sizes and supplier rate require confirmation.`});
  }
  return {fascia,tape,flashing,rows};
}
