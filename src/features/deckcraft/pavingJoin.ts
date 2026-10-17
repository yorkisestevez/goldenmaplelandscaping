import type {PlanPoint} from './lib/deckGeometry';
import type {YardFeature} from './types';
import type {SitePlane} from './siteSurface';
import {yardClip,type YardBox} from './yardModel';
import {pavingDirection,pavingLook,pavingTouches,plainPatio} from './pavingLook';
import {tiltStockPoint,untiltStockPoint} from './yardElevationGeometry';

/**
 * Patios drawn at different times that meet are one paved surface on site: the crew carries the first patio's bond
 * straight across, so the joints line up and a paver that crosses the line between them is one whole paver, not two
 * cut pieces. A later patio joins the first patio it touches (overlapping it, or along at least 6 in of its edge) when
 * both are plain paving with the same stock, colour, bond and bond direction (pavingLook.ts), on the same finished
 * plane. It is then laid on that patio's grid (its origin, rotation and row/column numbering), and a paver both patios
 * share keeps one id, one look and one outline. Each patio still owns the paving inside its own footprint, so areas,
 * pricing and per-patio quantities are unchanged. Patios at different levels, or in different paving, stay separate.
 */
const LEVEL_TOLERANCE_IN=.05;
type Unit={box:YardBox;contours:PlanPoint[][]};
export interface PavingField{root:YardFeature;plane:SitePlane;footprints:PlanPoint[][];units:Map<string,Unit>}
const samePlane=(a:SitePlane,b:SitePlane)=>Math.abs(a.x-b.x)<1e-9&&Math.abs(a.z-b.z)<1e-9&&Math.abs(a.constant-b.constant)<LEVEL_TOLERANCE_IN;
const sameDirection=(a:YardFeature,b:YardFeature)=>{const d=Math.abs(pavingDirection(a)-pavingDirection(b));return Math.min(d,360-d)<1e-6;};
/** The paved surface a plain patio belongs to: the first earlier field whose look, direction and plane match and which
 * its outline touches, or a new field it is the root of (`field.root===f`). Fields are kept in laying order. */
export function joinPavingField(fields:PavingField[],f:YardFeature,plane:SitePlane,outline:PlanPoint[][],footprints:PlanPoint[][]):PavingField|undefined{
 if(!plainPatio(f)||!footprints.length)return undefined;
 const look=pavingLook(f);
 const field=fields.find(g=>pavingLook(g.root)===look&&sameDirection(g.root,f)&&samePlane(g.plane,plane)&&pavingTouches(outline,g.footprints));
 if(field){field.footprints=yardClip([...field.footprints,...footprints]);return field;}
 const own:PavingField={root:f,plane,footprints,units:new Map()};fields.push(own);
 return own;
}
/** The root's flat (untilted) plan frame: a point's position along and across its rows. */
export function rootFrame(field:PavingField,sloped:boolean){
 const r=field.root,x=r.xFt*12,z=r.zFt*12,a=r.rotationDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),origin={x,y:z};
 const tilt=(p:PlanPoint)=>sloped?tiltStockPoint(p,field.plane,origin):p,untilt=(p:PlanPoint)=>sloped?untiltStockPoint(p,field.plane,origin):p;
 const local=(p:PlanPoint)=>{const q=untilt(p),dx=q.x-x,dz=q.y-z;return {x:c*dx+s*dz,y:-s*dx+c*dz};};
 return {x,z,angle:a,c,s,origin,tilt,local};
}
const mod=(n:number,m:number)=>((n%m)+m)%m;
/** The root's running-bond rows over `bounds` (root-local inches): the same rows and columns, numbered the same, as
 * the root lays from its own corner (-rw/2, -rd/2), extended in both directions. */
export function rowGrid(rows:{depth:number;lengths:number[]}[],gap:number,rw:number,rd:number,bounds:{u0:number;u1:number;v0:number;v1:number}){
 const out:{row:number;col:number;u:number;v:number;length:number;depth:number}[]=[];let row=0,v=-rd/2;
 while(v>bounds.v0){row--;v-=rows[mod(row,rows.length)].depth+gap;}
 for(;v<bounds.v1-.001;row++){const r=rows[mod(row,rows.length)];let col=0,u=-rw/2-(mod(row,2)?(r.lengths[0]+gap)/2:0);
  while(u>bounds.u0){col--;u-=r.lengths[mod(col,r.lengths.length)]+gap;}
  for(;u<bounds.u1-.001;col++){const length=r.lengths[mod(col,r.lengths.length)];out.push({row,col,u,v,length,depth:r.depth});u+=length+gap;}
  v+=r.depth+gap;
 }
 return out;
}
/** Records one paver laid by a field member: `boxes` are its fragments (the first is the one drawn) and `contours` the
 * paver as cut to that member's paving. A paver an earlier member already laid is drawn once, from the earlier
 * fragment, as the union of every member's part of it; the later fragments stay in their patio's quantities only. */
export function sharePaver(field:PavingField,unitId:string,boxes:YardBox[],contours:PlanPoint[][]){
 if(!boxes.length)return;
 const unit=field.units.get(unitId);
 if(!unit){field.units.set(unitId,{box:boxes[0],contours});return;}
 unit.contours=yardClip([...unit.contours,...contours]);unit.box.renderContours=unit.contours;
 for(const b of boxes)b.renderDuplicate=true;
}
