import type {DeckData} from './types';
import type {DeckTakeoff,V3} from './deckTakeoff';
import {boardOutline} from './lib/polygonCuts';
import {getHouseContact} from './houseContact';
import {distanceToSegment} from './lib/wrapGeometry';
export type Fastener={x:number;y:number;z:number;axis:'up'|'front'};
const key=(p:V3)=>[p.x,p.y,p.z].map(n=>n.toFixed(2)).join(':');
const unique=(points:V3[])=>[...new Map(points.map(p=>[key(p),p])).values()];
function intersection(a:V3,b:V3,c:V3,d:V3){
  const ux=b.x-a.x,uz=b.z-a.z,vx=d.x-c.x,vz=d.z-c.z,det=ux*vz-uz*vx;
  if(Math.abs(det)<1e-7)return null;
  const t=((c.x-a.x)*vz-(c.z-a.z)*vx)/det,s=((c.x-a.x)*uz-(c.z-a.z)*ux)/det;
  return t>=-.001&&t<=1.001&&s>=-.001&&s<=1.001?{x:a.x+t*ux,y:a.y,z:a.z+t*uz}:null;
}
export function getHardwareLayout(data:DeckData,model:DeckTakeoff){
  const hidden=data.fasteningSystem==='Hidden'||data.deckingMaterial.startsWith('deck_');
  // Internal stock joins bear on beams; they do not receive end hangers.
  // Jack joists on a wrap-around hip, and each hip at its house corner, take skewed hangers instead.
  const skewedHangers:(V3&{yaw:number})[]=[];
  const hangers=model.levels.flatMap(l=>{
    const ends=l.joists.flatMap(j=>{
      const yaw=Math.atan2(j.b.x-j.a.x,j.b.z-j.a.z);
      return [...(j.spliceStart?[]:[{...j.a,yaw}]),...(j.spliceEnd?[]:[{...j.b,yaw:yaw+Math.PI}])].filter(p=>!l.joists.some(other=>other!==j&&[other.a,other.b].some(q=>Math.hypot(p.x-q.x,p.z-q.z)<.1)));
    });
    const hips=l.hips??[];if(!hips.length)return ends;
    const straight:typeof ends=[];
    for(const p of ends)(hips.some(h=>distanceToSegment({x:p.x-l.offset.x,y:p.z-l.offset.z},h.a,h.b)<2)?skewedHangers:straight).push(p);
    for(const h of hips)skewedHangers.push({x:h.a.x+l.offset.x,y:l.top-1-(l.joists[0]?.depth??9.25)/2,z:h.a.y+l.offset.z,yaw:Math.atan2(h.b.x-h.a.x,h.b.y-h.a.y)});
    return straight;
  });
  const screws:Fastener[]=[],seen=new Set<string>();
  const add=(p:Fastener)=>{const k=key(p);if(!seen.has(k)){seen.add(k);screws.push(p);}};
  for(const l of model.levels)for(const b of l.boards){
    const angle=b.angleDeg*Math.PI/180,dx=Math.cos(angle),dz=Math.sin(angle),cx=b.cx+l.offset.x,cz=b.cy+l.offset.z;
    const polygon=boardOutline(b,data.boardWidth).map(p=>({x:p.x+l.offset.x,z:p.y+l.offset.z}));
    const addAt=(p:V3)=>{
      // Find the actual cut edges across this board at the bearing position.
      const hits:number[]=[];for(let i=0;i<polygon.length;i++){
        const a=polygon[i],q=polygon[(i+1)%polygon.length],ax=(a.x-p.x)*dx+(a.z-p.z)*dz,bx=(q.x-p.x)*dx+(q.z-p.z)*dz;
        if((ax<=0&&bx>0)||(bx<=0&&ax>0)){const t=-ax/(bx-ax);hits.push(-(a.x+(q.x-a.x)*t-p.x)*dz+(a.z+(q.z-a.z)*t-p.z)*dx);}
      }
      hits.sort((a,b)=>a-b);for(let i=0;i+1<hits.length;i+=2){const lo=hits[i],hi=hits[i+1];if(hi-lo<.35)continue;
        for(const shift of hidden?[hi+model.gap/2]:[lo+(hi-lo)*.2,hi-(hi-lo)*.2])add({x:p.x-dz*shift,y:l.top+(hidden?-.45:.015),z:p.z+dx*shift,axis:'up'});
      }
    };
    const a={x:cx-dx*(b.length/2-.25),y:l.top,z:cz-dz*(b.length/2-.25)},end={x:cx+dx*(b.length/2-.25),y:l.top,z:cz+dz*(b.length/2-.25)};
    for(const j of [...l.joists,...l.blocking,...l.beams.filter(b=>b.role==='hip')]){
      const p=intersection(a,end,j.a,j.b);
      if(p)addAt(p);
      // Boards running along a framing member (breaker/inlay) need fixings too.
      if(!p){const len=Math.hypot(j.b.x-j.a.x,j.b.z-j.a.z);if(!len)continue;
        const off=Math.abs((cx-j.a.x)*(j.b.z-j.a.z)-(cz-j.a.z)*(j.b.x-j.a.x))/len;
        if(off>data.boardWidth/2-.2)continue;
        const cross=Math.abs(dx*(j.b.z-j.a.z)-dz*(j.b.x-j.a.x))/len;if(cross>.001)continue;
        for(let t=-b.length/2+.5;t<b.length/2;t+=12){const x=cx+dx*t,z=cz+dz*t,proj=((x-j.a.x)*(j.b.x-j.a.x)+(z-j.a.z)*(j.b.z-j.a.z))/(len*len);if(proj>=0&&proj<=1)addAt({x,y:l.top,z});}
      }
    }
  }
  const ledgerBolts:Fastener[]=[];
  // One staggered bolt per foot along every ledger contact, 1.6 in into the deck from the wall.
  let bolt=0;
  for(const c of getHouseContact(data,model.levels[0].footprint).contacts){
    const count=Math.ceil(c.lengthIn/12-1e-9),ux=(c.b.x-c.a.x)/c.lengthIn,uy=(c.b.y-c.a.y)/c.lengthIn;
    for(let i=0;i<count;i++,bolt++){const t=(i+.5)*c.lengthIn/count;ledgerBolts.push({x:c.a.x+ux*t+c.inward.x*1.6,y:data.height-(bolt%2?8:4),z:c.a.y+uy*t+c.inward.y*1.6,axis:'front'});}
  }
  // One tie per joist crossing of a (multi-ply) beam; wing joists in a wrap run along x.
  const beamTies=unique(model.levels.flatMap(l=>l.joists.flatMap(j=>{
    const k=l.hips?.length&&Math.abs(j.b.z-j.a.z)<1e-6&&Math.abs(j.b.x-j.a.x)>1e-6?'x':'z';
    const hits=l.beams.filter(b=>b.role!=='hip').flatMap(b=>{const p=intersection(j.a,j.b,b.a,b.b);return p?[{...p,y:j.a.y-j.depth/2}]:[];}).sort((a,b)=>a[k]-b[k]);
    const groups:V3[][]=[];for(const p of hits){const last=groups[groups.length-1];if(last&&Math.abs(last[0][k]-p[k])<6)last.push(p);else groups.push([p]);}
    return groups.map(g=>({...g[0],[k]:g.reduce((n,p)=>n+p[k],0)/g.length}));
  })));
  const baseHeight=data.foundation==='Deck Blocks'?6.5:4.5;
  const postCaps=model.levels.flatMap(l=>l.supports.filter(p=>p.y>baseHeight).map(p=>({...p})));
  const blockingAngles=unique(model.levels.flatMap(l=>l.blocking.flatMap(b=>[b.a,b.b])));
  const stringerConnectors=model.stringers.map(s=>({...s.a}));
  const railBolts=model.railing.posts.flatMap(p=>[-1,1].flatMap(x=>[-1,1].map(z=>({x:p.x+x*1.85,y:p.y+.4,z:p.z+z*1.85}))));
  const spliceBolts:V3[]=[];
  for(const l of model.levels)for(const members of [l.joists,l.beams]){const ends=new Map<string,{p:V3;count:number}>();for(const m of members)for(const p of [m.a,m.b]){const k=key(p),e=ends.get(k);if(e)e.count++;else ends.set(k,{p,count:1});}for(const {p,count} of ends.values())if(count>1)for(const shift of [-2,2])spliceBolts.push({...p,y:p.y+shift});}
  return {hangers,...(skewedHangers.length?{skewedHangers}:{}),screws,ledgerBolts,hidden,beamTies,postCaps,blockingAngles,stringerConnectors,railBolts,spliceBolts,postAnchors:model.quantities.footings,railBrackets:model.quantities.railingSections*4,railCaps:model.quantities.railingPosts};
}
