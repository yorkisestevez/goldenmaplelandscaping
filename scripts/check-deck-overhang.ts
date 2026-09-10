import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {finishedFasciaOffset} from '../src/features/deckcraft/lib/finishedFootprint';
import {boardOutline} from '../src/features/deckcraft/lib/polygonCuts';
let count=0;
for(const deckType of ['Attached','Freestanding'] as const)for(const pictureFrameRows of [1,2] as const)for(const catalogueAccessories of [[],['tt_fascia']])for(const shape of ['Rectangle','L-Shape','Multi-corner','Curved'] as const)for(const pictureFrameOverhangIn of [0,.5,1,1.5]){
 const d={...structuredClone(DEFAULT_DECK),deckType,pictureFrameRows,pictureFrameOverhangIn,catalogueAccessories,shape,width:18,length:12,cutoutWidth:5,cutoutLength:4,cutoutWidth2:3,cutoutLength2:2};
 const m=buildDeckTakeoff(d),l=m.levels[0],outline=l.deckingFootprint!.outline,struct=l.footprint.outline,outer=finishedFasciaOffset(d)+pictureFrameOverhangIn;
 for(let i=0;i<struct.length;i++){const a=struct[i],b=struct[(i+1)%struct.length],p=outline[i],q=outline[(i+1)%outline.length],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),expected=deckType==='Attached'&&a.y===0&&b.y===0?0:outer;
  for(const v of [p,q])assert(Math.abs(((v.x-a.x)*dy-(v.y-a.y)*dx)/len-expected)<1e-5,`Every finished edge follows the selected ${pictureFrameOverhangIn} in overhang beyond the actual rim/fascia outer face`);
 }
 const verts=l.boards.filter(b=>b.role==='border').flatMap(b=>boardOutline(b,d.boardWidth));
 assert(verts.length>0);assert(Math.abs(Math.min(...verts.map(p=>p.x))+outer)<.2,'Actual cut boards reach expanded edge');
 if(deckType==='Attached')assert(Math.min(...verts.map(p=>p.y))>=-1e-5,'Ledger boards do not pass through house');
 assert.equal(l.footprint.bounds.w,18*12,'Input structural width stays unchanged');
 count++;
}
console.log(`DECK OVERHANG OK — ${count} fascia, shape, attachment and border-row cases.`);
