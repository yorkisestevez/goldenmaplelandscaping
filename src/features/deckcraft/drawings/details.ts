import type {DeckData} from '../types';
import type {DeckTakeoff} from '../deckTakeoff';
import type {ZoneReference} from '../zoneFraming';
import {getHouseContact} from '../houseContact';
import {getHardwareLayout} from '../hardwareLayout';
import {catalogueAccessoryLayout} from '../catalogueAccessories';
import {stringerCutProfile} from '../components/viewer3d/stringerProfile';
import {ACTUAL_DEPTH_IN,type JoistSize} from '../structure/spanTables';
import {DETAIL_SCALES,SCALES,SHEET,type DrawItem,type LayerId,type Pt,drawnExtents,feetInches,fitScale} from './drawingTypes';
import {translate} from './elevations';
import {type Part,connectionParts,ledgerFlashing} from './pricedParts';

/**
 * Sheet S-5: typical construction details, each drawn from this design's own members and counts: the ledger (or a
 * freestanding deck's house side), a beam on its post, the footing, a guard post, the stair stringer, and the decking
 * with its fastening. Connectors are schematic; every callout names the part as the connector schedule prices it
 * (schedule.ts), with this design's count and whether it is priced or a supplier quote.
 */
export interface DetailInput{
  data:DeckData;model:DeckTakeoff;
  /** The framing zone the typical section is cut through (its beam, mount, rows and cantilever). */
  reference:ZoneReference;
  /** How far the guard posts sit inside the front edge (from the typical section). */
  guardInset:number;
  pier:{diameter:number;priced:boolean;sized?:boolean};
  materialName:string;railingName:string;
  /** The design's hardware layout, computed once for the whole set. */
  hardware:ReturnType<typeof getHardwareLayout>;
}
interface Detail{title:string;items:DrawItem[]}
interface Ctx extends DetailInput{size:JoistSize;jd:number;crossBoards:boolean;fascia:boolean;parts:Map<string,Part>;postBase:number;hasPost:boolean;depth:number}

const TXT=.07;

/** A drawing pen in detail coordinates: u across, v up (the sheet's y is −v). */
function pen(){
  const items:DrawItem[]=[],P=(u:number,v:number):Pt=>({x:u,y:-v});
  const line=(layer:LayerId,u0:number,v0:number,u1:number,v1:number)=>{items.push({kind:'line',layer,a:P(u0,v0),b:P(u1,v1)});};
  const poly=(layer:LayerId,pts:[number,number][],closed=false)=>{items.push({kind:'poly',layer,closed,points:pts.map(([u,v])=>P(u,v))});};
  /** A rectangle; a member cut by the detail also gets the lumber-section cross. */
  const rect=(layer:LayerId,u0:number,v0:number,u1:number,v1:number,cut=false)=>{poly(layer,[[u0,v0],[u1,v0],[u1,v1],[u0,v1]],true);if(cut){line(layer,u0,v0,u1,v1);line(layer,u0,v1,u1,v0);}};
  const text=(u:number,v:number,t:string,anchor:'start'|'middle'|'end'='start',height=TXT)=>{items.push({kind:'text',layer:'A-ANNO-TEXT',at:P(u,v),text:t,height,anchor});};
  const dim=(u0:number,v0:number,u1:number,v1:number,offset:number,t:string)=>{items.push({kind:'dim',layer:'A-ANNO-DIMS',a:P(u0,v0),b:P(u1,v1),offset,text:t});};
  const circle=(layer:LayerId,u:number,v:number,r:number)=>{items.push({kind:'circle',layer,c:P(u,v),r});};
  /** A break line across a member from (u0, v0) to (u1, v1), its zigzag at the middle. */
  const brk=(layer:LayerId,u0:number,v0:number,u1:number,v1:number)=>{
    const len=Math.hypot(u1-u0,v1-v0),t=[(u1-u0)/len,(v1-v0)/len],n=[-t[1],t[0]],m=[(u0+u1)/2,(v0+v1)/2];
    const at=(s:number,h:number):[number,number]=>[m[0]+t[0]*s+n[0]*h,m[1]+t[1]*s+n[1]*h];
    poly(layer,[[u0,v0],at(-1.5,0),at(-.6,2),at(.6,-2),at(1.5,0),[u1,v1]]);
  };
  /** Labels in a column at u = x, top to bottom in the order of their targets, each with a leader. */
  const callouts=(list:[number,number,string][],x:number,anchor:'start'|'end',top:number,bottom:number)=>{
    const sorted=[...list].sort((p,q)=>q[1]-p[1]),n=sorted.length,step=n>1?Math.min(9,Math.max(5,(top-bottom)/(n-1))):0;
    sorted.forEach(([u,v,label],i)=>{const y=top-i*step;line('A-ANNO-TEXT',u,v,x,y);text(x+(anchor==='start'?1:-1),y-.4,label,anchor);});
  };
  return {items,line,poly,rect,text,dim,circle,brk,callouts};
}
type Pen=ReturnType<typeof pen>;

/** Decking from u0 to u1 between v0 and v1: boards cut across when they cross the detail, else one run. */
function decking(k:Pen,c:Ctx,u0:number,u1:number,v0:number,v1:number){
  if(!c.crossBoards){k.rect('A-DECK-FNSH',u0,v0,u1,v1);return;}
  const pitch=c.data.boardWidth+c.model.gap;for(let u=u0;u<u1-.5;u+=pitch)k.rect('A-DECK-FNSH',u,v0,Math.min(u1,u+c.data.boardWidth),v1);
}
/** A joist seen beyond, from u0 to u1 with its far end broken. */
function joistBeyond(k:Pen,c:Ctx,u0:number,u1:number,top:number){
  k.poly('S-FRMG',[[u1,top],[u0,top],[u0,top-c.jd],[u1,top-c.jd]]);k.brk('S-FRMG',u1,top-c.jd-1,u1,top+1);
}

function ledgerDetail(c:Ctx):Detail{
  const k=pen(),{jd,size}=c,W=18,jt=-1,bolts=[jt-jd*.3,jt-jd*.7];
  k.line('A-HOUS',0,jt-jd-8,0,10);k.line('A-HOUS',-8,jt-jd-8,-8,10);k.brk('A-HOUS',-8,10,0,10);k.brk('A-HOUS',-8,jt-jd-8,0,jt-jd-8);
  k.rect('S-LEDG',0,jt-jd,1.5,jt,true);
  for(const v of bolts){k.line('S-LEDG',-5,v,2.3,v);k.line('S-LEDG',2.3,v-.7,2.3,v+.7);}
  k.poly('S-LEDG',[[.25,7],[.25,jt+.15],[2.3,jt+.15],[2.3,jt-1.4]]);
  joistBeyond(k,c,1.5,W,jt);
  k.rect('S-FRMG',1.5,jt-jd-.1,3.1,jt-jd+Math.min(6,jd-1.5));
  decking(k,c,.5,W,jt,0);
  k.callouts([[-4,5,'Existing wall: verify rim'],[W*.55,-.5,'Decking'],[1.2,jt+.15,ledgerFlashing(c.data).label],[W*.7,jt-jd*.35,`${size} joist`],[.75,jt-jd*.5,`${size} ledger`],[-2.5,bolts[1],'Ledger bolts, staggered'],[2.3,jt-jd+1.5,'Joist hanger']],W+4,'start',9,jt-jd-6);
  return {title:'LEDGER CONNECTION',items:k.items};
}

/** A freestanding deck at the house: its own beam and posts, nothing fastened to the wall. */
function houseSideDetail(c:Ctx):Detail{
  const k=pen(),{jd,size,reference:ref}=c,jt=-1,row=ref.beamRows[0],half=ref.beam.plies*.75,W=Math.max(row.z+12,18);
  const bt=ref.beamMount==='drop'?jt-jd:jt,bb=bt-ref.beamDepthIn;
  k.line('A-HOUS',0,bb-18,0,10);k.line('A-HOUS',-8,bb-18,-8,10);k.brk('A-HOUS',-8,10,0,10);k.brk('A-HOUS',-8,bb-18,0,bb-18);
  if(!ref.edgeBeams)k.rect('S-FRMG',0,jt-jd,1.5,jt,true);
  joistBeyond(k,c,ref.edgeBeams?row.z+half:1.5,W,jt);
  for(let i=0;i<ref.beam.plies;i++)k.rect('S-BEAM',row.z-half+i*1.5,bb,row.z-half+(i+1)*1.5,bt,true);
  if(c.hasPost){k.rect('S-POST',row.z-2.75,bb-14,row.z+2.75,bb);k.brk('S-POST',row.z-4,bb-14,row.z+4,bb-14);}
  decking(k,c,0,W,jt,0);
  k.callouts([[-4,5,'Not fastened to the house'],[W*.6,-.5,'Decking'],[W*.75,jt-jd*.5,`${size} joist`],[.75,jt-jd*.3,ref.edgeBeams?'Beam at the deck edge':`${size} rim joist`],[row.z+half,bb+ref.beamDepthIn/2,`${ref.beam.plies}-ply ${ref.beam.size} beam`],...(c.hasPost?[[row.z+2.75,bb-8,'6x6 post'] as [number,number,string]]:[])],W+4,'start',9,bb-12);
  return {title:'FREESTANDING AT THE HOUSE',items:k.items};
}

function beamDetail(c:Ctx):Detail{
  const k=pen(),{jd,size,reference:ref}=c,plies=ref.beam.plies,half=plies*.75,bd=ref.beamDepthIn,W=14,drop=ref.beamMount==='drop',bt=0,bb=-bd;
  for(let i=0;i<plies;i++)k.rect('S-BEAM',-half+i*1.5,bb,-half+(i+1)*1.5,bt,true);
  const list:[number,number,string][]=[[half,bb+bd/2,`${plies}-ply ${ref.beam.size} beam${drop?'':', flush'}`]];
  if(drop){
    k.line('S-FRMG',-W,bt,W,bt);k.line('S-FRMG',-W,bt+jd,W,bt+jd);k.brk('S-FRMG',-W,bt-1,-W,bt+jd+1);k.brk('S-FRMG',W,bt-1,W,bt+jd+1);
    k.poly('S-FRMG',[[half+.15,bt-2.5],[half+.15,bt+.15],[half+2.5,bt+.15]]);
    decking(k,c,-W,W,bt+jd,bt+jd+1);
    list.push([half+2,bt+.15,'Joist-to-beam tie'],[W*.6,bt+jd/2,`${size} joist`],[W*.4,bt+jd+.5,'Decking']);
  }else{
    for(const s of [1,-1]){joistBeyond(k,c,s*half,s*W,bt);k.rect('S-FRMG',s*half,bt-jd-.1,s*(half+1.6),bt-jd+Math.min(6,jd-1.5));}
    decking(k,c,-W,W,bt,bt+1);
    list.push([half+1.6,bt-jd+2,'Joist hanger'],[W*.6,bt-jd/2,`${size} joist`],[W*.4,bt+.5,'Decking']);
  }
  if(c.hasPost){
    k.rect('S-POST',-2.75,bb-16,2.75,bb);k.brk('S-POST',-4,bb-16,4,bb-16);
    for(const s of [1,-1])k.poly('S-POST',[[s*2.95,bb-4],[s*2.95,bb],[s*(half+.1),bb],[s*(half+.1),bb+3]]);
    list.push([2.95,bb-2,'Post-to-beam cap'],[2.75,bb-10,'6x6 post']);
  }
  k.callouts(list,W+4,'start',bt+jd+8,bb-12);
  return {title:c.hasPost?'BEAM ON POST':'BEAM ON FOOTING',items:k.items};
}

function footingDetail(c:Ctx):Detail{
  const k=pen(),{data,postBase,depth}=c,blocks=data.foundation==='Deck Blocks',helical=data.foundation==='Helical Piles',list:[number,number,string][]=[];
  if(c.hasPost){
    k.rect('S-POST',-2.75,postBase,2.75,postBase+10);k.brk('S-POST',-4,postBase+10,4,postBase+10);
    k.rect('S-POST',-3.5,postBase-.45,3.5,postBase-.05);
    list.push([2.75,postBase+7,'6x6 post'],[3.5,postBase-.25,'Post anchor']);
  }
  k.line('C-TOPO',-14,0,14,0);k.text(-14,1,'GRADE');
  if(blocks){k.rect('S-FTNG',-6,0,6,6);list.push([6,3,'Deck block'],[-6,.2,'Compacted, undisturbed soil']);}
  else{
    // A tributary pier wider than 12 in is labelled at its size and drawn at 12 in, so the detail stays at a detail scale.
    const r=helical?1.4:c.pier.sized?Math.min(c.pier.diameter/2,6):c.pier.diameter/2,compress=depth>30,bottom=compress?-25:-depth;
    if(c.hasPost)k.rect('S-POST',-.5,2,.5,postBase-.45);
    if(compress){
      // Drawn with a break: the pier's top and its foot, the depth dimensioned true across the break.
      k.poly('S-FTNG',[[-r,-12],[-r,2],[r,2],[r,-12]]);k.poly('S-FTNG',[[-r,-17],[-r,bottom],[r,bottom],[r,-17]]);
      k.brk('S-FTNG',-r-2,-12,r+2,-12);k.brk('S-FTNG',-r-2,-17,r+2,-17);
    }else k.rect('S-FTNG',-r,bottom,r,2);
    if(helical)k.rect('S-FTNG',-6,bottom+4,6,bottom+4.3);
    k.dim(-r-4,0,-r-4,bottom,8,`${feetInches(depth)} below grade`);
    list.push(helical?[1.4,-6,'Helical pile']:[r,-6,c.pier.sized?`${c.pier.diameter} in concrete pier`:c.pier.priced?'16 in concrete pier':'Concrete pier (12 in shown)'],[-r,bottom+2,'Undisturbed soil below frost'],...(compress?[[r+2,-14.5,'Depth drawn with a break'] as [number,number,string]]:[]));
  }
  k.callouts(list,14,'start',postBase+12,blocks?-2:-22);
  return {title:'FOOTING',items:k.items};
}

function guardDetail(c:Ctx):Detail{
  const k=pen(),{jd,size,data,model}=c,h=model.railing.height,jt=-1,W=12,g=-c.guardInset,list:[number,number,string][]=[];
  k.rect('S-FRMG',-1.5,jt-jd,0,jt,true);joistBeyond(k,c,-1.5,-W,jt);
  if(c.fascia)k.rect('A-DECK-FNSH',0,jt-jd,.625,jt);
  decking(k,c,-W,c.fascia?1.25:.75,jt,0);
  list.push([-.75,jt-jd*.6,`${size} rim joist${c.fascia?' and fascia':''}`]);
  const frameless=model.railing.frameless;
  if(frameless){
    // Where the glass starts follows the mount (framelessGlass.ts): top shoe 0.5 in up, fascia shoe 4.75 in down, spigots 2 in up.
    if(frameless.mount==='Fascia-mount base shoe'){k.rect('A-RAIL',c.fascia?.625:0,-7.5,(c.fascia?.625:0)+2.5,-.5);k.rect('A-RAIL',(c.fascia?.625:0)+1,-4.75,(c.fascia?.625:0)+1.5,h);list.push([(c.fascia?.625:0)+2.5,-4,'Fascia-mount base shoe']);}
    else if(frameless.mount==='Spigots'){k.rect('A-RAIL',g-1,0,g+1,8);k.rect('A-RAIL',g-.25,2,g+.25,h);list.push([g+1,5,'Spigot']);}
    else{k.rect('A-RAIL',g-1.5,0,g+1.5,4);k.rect('A-RAIL',g-.25,.5,g+.25,h);list.push([g+1.5,2,'Top-mount base shoe']);}
    list.push([g+.25,h*.6,'Glass panel']);
  }else{
    k.rect('A-RAIL',g-1.75,.4,g+1.75,h);k.rect('A-RAIL',g-2.6,0,g+2.6,.4);
    for(const s of [-1,1])k.line('A-RAIL',g+s*1.85,.4,g+s*1.85,-3.5);
    k.rect('A-RAIL',g-1,h-2.5,g+1,h);k.rect('A-RAIL',g-1,2.25,g+1,3.75);
    if(data.railingType==='Glass Panels')k.rect('A-RAIL',g-.25,4,g+.25,h-4);
    else if(data.railingType==='Cable')for(let i=1;i<=9;i++)k.circle('A-RAIL',g,3+(h-6)*i/10,.25);
    list.push([g+1.75,h*.7,'Railing post'],[g+2.6,.2,'Base plate'],[g+1.85,-2.5,'Post anchors'],[g+1,h-1.25,'Top rail'],[g+1,3,'Bottom rail']);
  }
  k.dim(g+8,0,g+8,h,4,`${feetInches(h)} guard`);
  k.callouts(list,g+16,'start',h+2,jt-jd-2);
  return {title:frameless?'GLASS GUARD':'GUARD POST',items:k.items};
}

/** Keep the part of a closed outline with u ≤ limit. */
function clipLeft(pts:[number,number][],limit:number):[number,number][]{
  const out:[number,number][]=[];
  pts.forEach((p,i)=>{const q=pts[(i+1)%pts.length],pin=p[0]<=limit,qin=q[0]<=limit;
    if(pin)out.push(p);
    if(pin!==qin){const t=(limit-p[0])/(q[0]-p[0]);out.push([limit,p[1]+(q[1]-p[1])*t]);}
  });
  return out;
}

function stairDetail(c:Ctx):Detail|null{
  const {model,jd}=c,member=model.stringers.find(m=>m.stair);if(!member?.stair)return null;
  const k=pen(),s=member.stair,support=model.stairSupport,nosing=support.treadNosingIn,shown=Math.min(s.risers,3),clipped=s.risers>shown;
  const limit=clipped?(shown-1)*s.run+s.run*.55:Infinity,list:[number,number,string][]=[];
  k.rect('S-FRMG',-1.5,s.top-1-jd,0,s.top-1,true);joistBeyond(k,c,-1.5,-10,s.top-1);decking(k,c,-10,.75,s.top-1,s.top);
  const profile=stringerCutProfile(member,model).map(p=>[p.x,p.y] as [number,number]);
  const stringer=clipped?clipLeft(profile,limit):profile;
  k.poly('A-STRS',stringer,true);
  if(clipped){const vs=stringer.filter(p=>Math.abs(p[0]-limit)<1e-6).map(p=>p[1]);k.brk('A-STRS',limit,Math.min(...vs)-2,limit,Math.max(...vs)+2);}
  for(let i=1;i<s.risers&&(i-1)*s.run<limit;i++){
    k.rect('A-STRS',(i-1)*s.run,s.top-i*s.rise-1,Math.min(limit,i*s.run+nosing),s.top-i*s.rise);
    if(model.riserBoards.length&&i*s.run<limit)k.rect('A-STRS',i*s.run-support.riserThicknessIn,s.top-(i+1)*s.rise,i*s.run,s.top-i*s.rise-1);
  }
  k.rect('S-FRMG',0,s.top-s.rise-1-Math.min(member.depth,jd)+1.5,1.4,s.top-s.rise-2);
  if(!clipped)k.line(s.bottom<=.5?'C-TOPO':'A-DECK-FNSH',-4,s.bottom,(s.risers-1)*s.run+14,s.bottom);
  if(s.risers>1)k.dim(s.run+nosing+4,s.top-2*s.rise,s.run+nosing+4,s.top-s.rise,-4,`${s.rise.toFixed(2)}" rise`);
  k.dim(0,s.top-s.rise,s.run,s.top-s.rise,-5,`${s.run.toFixed(2)}" run`);
  const perFlight=model.flights.find(f=>f.stringerOffsets.length)?.stringerOffsets.length??0;
  list.push([s.run*.5,s.top-s.rise-.5,'Treads'],[1.4,s.top-s.rise-4,'Stringer connector'],
    [s.run*1.2,s.top-2*s.rise-3,`${perFlight?`${perFlight} stringers`:'Stringers'} @ ${support.spacingIn} in o.c.`]);
  if(model.riserBoards.length)list.push([2*s.run-support.riserThicknessIn,s.top-2.5*s.rise,'Closed risers']);
  k.callouts(list,(shown-1)*s.run+6,'start',s.top+4,s.top-shown*s.rise);
  k.text((shown-1)*s.run/2,s.top-shown*s.rise-10,`${s.risers} risers${clipped?'; top of flight shown':''}`,'middle');
  return {title:'STAIR STRINGER',items:k.items};
}

function deckingDetail(c:Ctx):Detail{
  const k=pen(),{jd,size,data,model}=c,spacing=data.pattern==='Diagonal'||data.pattern==='Herringbone'?12:data.joistSpacing,hidden=c.hardware.hidden;
  for(const u of [0,spacing,2*spacing])k.rect('S-FRMG',u-.75,-1-jd,u+.75,-1,true);
  k.line('A-DECK-FNSH',-4,-1,2*spacing+4,-1);k.line('A-DECK-FNSH',-4,0,2*spacing+4,0);k.brk('A-DECK-FNSH',-4,-1.8,-4,.8);k.brk('A-DECK-FNSH',2*spacing+4,-1.8,2*spacing+4,.8);
  for(const u of [0,spacing,2*spacing])if(hidden)k.rect('A-DECK-FNSH',u-.5,-1.35,u+.5,-.95);else k.line('A-DECK-FNSH',u+.3,.2,u+.3,-2.6);
  k.dim(0,-1-jd,spacing,-1-jd,6,`${spacing}" o.c.`);k.dim(spacing,-1-jd,2*spacing,-1-jd,6,`${spacing}" o.c.`);
  const gaps=model.gap===.1875?'3/16':model.gap===.25?'1/4':model.gap.toFixed(3);
  k.callouts([[spacing*1.5,-.5,`${data.boardWidth} in boards, ${gaps} in gaps`],[spacing+.3,-.9,hidden?'Hidden clip at each joist':'2 screws per joist'],[2*spacing-.75,-1-jd/2,`${size} joists`]],2*spacing+6,'start',4,-1-jd);
  return {title:'DECKING AND FASTENING',items:k.items};
}

/** The details, laid out three to a row with their titles, top-left at `origin`. */
export function detailItems(input:DetailInput,origin:Pt):{items:DrawItem[];titles:string[]}{
  const {data,model,reference:ref}=input,main=model.levels[0],size=data.framingSize as JoistSize;
  const field=main.boards.find(b=>!b.role)??main.boards[0],crossBoards=Math.abs(Math.cos((field?.angleDeg??0)*Math.PI/180))>.5;
  const postBase=data.foundation==='Deck Blocks'?6.5:4.5;
  const c:Ctx={...input,size,jd:ACTUAL_DEPTH_IN[size]??9.25,crossBoards,fascia:catalogueAccessoryLayout(data,model).fascia.length>0,parts:connectionParts(data,model,input.hardware),
    postBase,hasPost:ref.beamBottomIn>postBase+.5,depth:data.foundation==='Deck Blocks'?0:data.foundationDepthIn??48};
  const ledger=data.houseVisible!==false&&getHouseContact(data,main.footprint).contacts.some(x=>x.kind==='ledger');
  const details=[ledger?ledgerDetail(c):houseSideDetail(c),beamDetail(c),footingDetail(c),...(data.railingType==='None'?[]:[guardDetail(c)]),stairDetail(c),deckingDetail(c)].filter((d):d is Detail=>!!d);
  // Each detail sits in a cell as wide as the widest and as tall as its row's tallest, its title underneath.
  // A deeper beam can miss the last detail scale by a fraction of an inch; a slightly tighter row gap recovers it.
  // Designs that already fit keep the 22 in gap, so a saved drawing does not move.
  const boxes=details.map(d=>drawnExtents(d.items,DETAIL_SCALES[2].ratio,0));
  const place=(rowGap:number):DrawItem[]=>{
    const out:DrawItem[]=[],colW=[0,1,2].map(col=>Math.max(0,...boxes.filter((_,i)=>i%3===col).map(b=>b.maxX-b.minX))),colX=colW.map((_,col)=>colW.slice(0,col).reduce((n,w)=>n+w+8,0));
    let y=0;
    for(let row=0;row*3<details.length;row++){
      const idx=[0,1,2].map(i=>row*3+i).filter(i=>i<details.length),rowH=Math.max(...idx.map(i=>boxes[i].maxY-boxes[i].minY));
      idx.forEach((i,col)=>{
        const b=boxes[i],x=colX[col]+(colW[col]-(b.maxX-b.minX))/2;
        out.push(...translate(details[i].items,x-b.minX,y+rowH-(b.maxY-b.minY)-b.minY));
        out.push({kind:'text',layer:'A-ANNO-TEXT',at:{x:colX[col]+colW[col]/2,y:y+rowH+10},text:`${i+1}  ${details[i].title}`,height:.12,anchor:'middle'});
      });
      y+=rowH+rowGap;
    }
    return out;
  };
  const fits=(items:DrawItem[])=>{const e=drawnExtents(items,DETAIL_SCALES[2].ratio);return (e.maxX-e.minX)/DETAIL_SCALES[2].ratio<=SHEET.area.w&&(e.maxY-e.minY)/DETAIL_SCALES[2].ratio<=SHEET.area.h;};
  let out=place(22);
  if(!fits(out))out=place(18);
  const fit=fitScale(out,[...DETAIL_SCALES,...SCALES]);
  return {items:translate(out,origin.x-fit.extents.minX,origin.y-fit.extents.minY),titles:details.map(d=>d.title)};
}
