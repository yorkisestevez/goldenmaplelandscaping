import {usesPhysicalElevations} from '../elevationDatum';
import type {DeckData} from '../types';
import type {DeckTakeoff,Member} from '../deckTakeoff';
import {getHouseContact} from '../houseContact';
import {getHouseConfig} from '../houseSettings';
import {wallLabel} from '../houseFootprint';
import {getHardwareLayout} from '../hardwareLayout';
import {connectorSchedule,constructionStock,connectorRowId,stockRowId} from '../schedule';
import {SHEET,type DrawItem,type Pt,feetInches} from './drawingTypes';
import {ledgerFlashing,partStatus,pierOf} from './pricedParts';

/**
 * S-6 schedules: the footings and posts, beams, joists, house ledger, stairs, guard, connections and framing lumber, as
 * tables. Every row is counted from the takeoff members and the connector schedule the estimate prices, so each table
 * adds up to the estimate's own quantities, and each connection says how the estimate carries it.
 */
export interface ScheduleTable{title:string;head:string[];rows:string[][];
  /** Columns aligned to the right (quantities and lengths). */
  right:number[]}

const levelName=(l:DeckTakeoff['levels'][number],i:number)=>i===0?'Main deck':l.kind==='landing'?'Landing':l.kind==='winder'?'Winder':`Level ${(l.index??i)+1}`;
/** Nominal lumber size for a member depth. */
const nominal=(depthIn:number)=>depthIn<6.5?'2x6':depthIn<8.5?'2x8':depthIn<10.5?'2x10':'2x12';
const len=(m:Member)=>Math.hypot(m.b.x-m.a.x,m.b.z-m.a.z);
const feet=(lf:number)=>`${Math.round(lf)} ft`;
const STATUS_WORDS={priced:'Priced','supplier quote':'Supplier quote','confirm in the railing kit':'Confirm in the railing kit','confirm in the footing allowance':'Confirm in the footing allowance'} as const;

/** A beam line: its plies side by side and its pieces end to end, or a winder's edge piece by piece, with the posts under
 * it. `longestSpanIn` is the longest distance between neighbouring posts along it. */
export interface BeamLine{level:number;kind:'along'|'across'|'angled'|'hip'|'winder';plies:number;pieces:number;size:string;lengthIn:number;posts:number;longestSpanIn:number}

/** Beam members grouped into lines: straight beams by the line they run on (plies within 4 in of it), split where the
 * line has a gap; a winder's edge pieces by the chain they form end to end. */
export function beamLines(model:DeckTakeoff):BeamLine[]{
  const lines:BeamLine[]=[];
  model.levels.forEach((l,level)=>{
    const push=(kind:BeamLine['kind'],members:Member[],plies:number,lengthIn:number,at:number[])=>{
      at.sort((p,q)=>p-q);
      lines.push({level,kind,plies,pieces:members.length,size:nominal(members[0].depth),lengthIn,posts:at.length,longestSpanIn:at.slice(1).reduce((n,x,i)=>Math.max(n,x-at[i]),0)});
    };
    // Straight beams: direction in [0, pi), the line's offset c and the distance t along it.
    const straight=l.beams.filter(m=>m.role!=='winder-edge').map(m=>{
      let a=Math.atan2(m.b.z-m.a.z,m.b.x-m.a.x);if(a<0)a+=Math.PI;if(a>Math.PI-1e-3)a-=Math.PI;
      const c=-Math.sin(a)*m.a.x+Math.cos(a)*m.a.z,t0=Math.cos(a)*m.a.x+Math.sin(a)*m.a.z,t1=Math.cos(a)*m.b.x+Math.sin(a)*m.b.z;
      return {m,a,c,lo:Math.min(t0,t1),hi:Math.max(t0,t1)};
    });
    const groups:(typeof straight)[]=[];
    for(const s of straight){const g=groups.find(g=>Math.abs(g[0].a-s.a)<.02&&Math.abs(g[0].c-s.c)<4&&(g[0].m.role==='hip')===(s.m.role==='hip'));if(g)g.push(s);else groups.push([s]);}
    for(const g of groups){
      const {a}=g[0],c=g.reduce((n,s)=>n+s.c,0)/g.length,runs:(typeof straight)[]=[];
      for(const s of [...g].sort((p,q)=>p.lo-q.lo)){const run=runs.at(-1);if(run&&s.lo<=Math.max(...run.map(r=>r.hi))+1)run.push(s);else runs.push([s]);}
      for(const run of runs){
        const lo=Math.min(...run.map(r=>r.lo)),hi=Math.max(...run.map(r=>r.hi));
        const at=l.supports.flatMap(p=>{const t=Math.cos(a)*p.x+Math.sin(a)*p.z;return Math.abs(-Math.sin(a)*p.x+Math.cos(a)*p.z-c)<6&&t>=lo-6&&t<=hi+6?[t]:[];});
        const kind=run[0].m.role==='hip'?'hip':a<1e-3?'along':Math.abs(a-Math.PI/2)<1e-3?'across':'angled';
        push(kind,run.map(r=>r.m),new Set(run.map(r=>Math.round(r.c*4))).size,hi-lo,at);
      }
    }
    // Winder edges: chains of pieces meeting end to end, measured along the chain.
    const left=l.beams.filter(m=>m.role==='winder-edge'),near=(p:{x:number;z:number},q:{x:number;z:number})=>Math.hypot(p.x-q.x,p.z-q.z)<.5;
    while(left.length){
      const chain=[left.shift()!];
      for(let grown=true;grown;){grown=false;for(let i=0;i<left.length;i++){const m=left[i];
        if(near(m.a,chain.at(-1)!.b)){chain.push(m);left.splice(i,1);grown=true;break;}
        if(near(m.b,chain[0].a)){chain.unshift(m);left.splice(i,1);grown=true;break;}}}
      let run=0;const at:number[]=[];
      for(const m of chain){const dx=m.b.x-m.a.x,dz=m.b.z-m.a.z,ml=Math.hypot(dx,dz);
        for(const p of l.supports){const t=((p.x-m.a.x)*dx+(p.z-m.a.z)*dz)/ml;if(t>=-6&&t<=ml+6&&Math.abs((p.x-m.a.x)*dz-(p.z-m.a.z)*dx)/ml<6&&!at.some(x=>Math.abs(x-(run+t))<1))at.push(run+Math.max(0,Math.min(ml,t)));}
        run+=ml;}
      push('winder',chain,1,run,at);
    }
  });
  return lines;
}

export function scheduleTables(data:DeckData,model:DeckTakeoff,names:{railingName:string},hardware=getHardwareLayout(data,model)):ScheduleTable[]{
  const physical=usesPhysicalElevations(data),tables:ScheduleTable[]=[],blocks=data.foundation==='Deck Blocks',helical=data.foundation==='Helical Piles',saddle=blocks?6.5:4.5;
  const pier=pierOf(data,model),depth=blocks?0:data.foundationDepthIn??48;
  const spacing=data.pattern==='Diagonal'||data.pattern==='Herringbone'?12:data.joistSpacing;

  // Footings and posts, by level and height to the beam.
  const footing=blocks?'Deck block':helical?'Helical pile':pier.sized?`${pier.diameter} in pier (${pier.priced?16:12} in priced)`:physical?'Concrete pier (12 in schematic; diameter pending)':pier.priced?'16 in concrete pier':'Concrete pier (12 in shown)';
  const footRows:string[][]=[];
  model.levels.forEach((l,i)=>{
    // A post stands where the beam clears the footing's saddle, as the takeoff counts it (on the exact height).
    const byHeight=new Map<string,{y:number;post:boolean;n:number}>();
    for(const s of l.supports){const y=Math.round(s.y*2)/2,post=s.y>saddle,k=`${post}|${y}`,g=byHeight.get(k)??{y,post,n:0};g.n++;byHeight.set(k,g);}
    for(const g of [...byHeight.values()].sort((p,q)=>q.y-p.y||Number(q.post)-Number(p.post)))footRows.push([levelName(l,i),footing,blocks?'On grade':feetInches(depth),g.post?'6x6':'None, beam on footing',feetInches(g.y),String(g.n)]);
  });
  if(physical){footRows.length=0;for(const f of model.foundationSupports){footRows.push([`Level ${f.levelIndex+1} · support ${f.supportIndex+1}`,footing,f.bottomElevationIn===null?'Pending':feetInches(f.depthIn),f.postHeightIn===null?'Pending':f.postHeightIn>0?'6x6':'None',f.gradeElevationIn===null?'Pending':feetInches(f.bearingElevationIn-f.gradeElevationIn),'1']);}}
  tables.push({title:'FOOTINGS AND POSTS',head:['Where','Footing','Below grade','Post','Grade to beam','Qty'],rows:footRows,right:[2,4,5]});
  if(physical)tables.push({title:'FOUNDATION ELEVATIONS · PROJECT DATUM',head:['Support','Ground (in)','Bottom (in)','Post base (in)','Post length (in)','Status'],rows:model.foundationSupports.map(f=>[`${f.levelIndex+1}/${f.supportIndex+1}`,...[f.gradeElevationIn,f.bottomElevationIn,f.postBaseElevationIn,f.postHeightIn].map(v=>v===null?'Pending':v.toFixed(2)),f.status]),right:[1,2,3,4]});

  // Beams, line by line.
  const beams=beamLines(model);
  tables.push({title:'BEAMS',head:['Where','Beam','Runs','Length','Posts','Longest span'],right:[3,4,5],
    rows:beams.map(b=>[levelName(model.levels[b.level],b.level),`${b.plies}-ply ${b.size}${b.kind==='hip'||b.kind==='winder'?'':`, ${model.levels[b.level].reference.beamMount}`}`,{along:'Along the house',across:'Out from the house',angled:'Angled',hip:'Hip',winder:'Winder edge'}[b.kind],feetInches(b.lengthIn),String(b.posts),b.posts>1&&b.kind!=='winder'?feetInches(b.longestSpanIn):'-'])});

  // Joists, per level. A winder is framed piece by piece, so it has no single clear span or cantilever.
  tables.push({title:'JOISTS',head:['Where','Joists','Spacing','Qty','Longest','Clear span','Cantilever','Blocking'],right:[3,4,5,6,7],
    rows:model.levels.filter(l=>l.joists.length).map(l=>{const i=model.levels.indexOf(l),r=l.reference;
      const winder=l.kind==='winder';
      return [levelName(l,i),nominal(l.joists[0].depth),`${spacing}" o.c.`,String(l.joists.length),feetInches(Math.max(...l.joists.map(len))),winder?'-':feetInches(r.joistSpanIn),winder?'-':r.cantileverIn>0?feetInches(r.cantileverIn):'None',String(l.blocking.length)];})});

  // The house ledger, wall by wall, with the bolts along each.
  const contacts=data.houseVisible===false?[]:getHouseContact(data,model.levels[0].footprint).contacts;
  if(contacts.length){
    const house=getHouseConfig(data),flashing=ledgerFlashing(data).label.replace(/^Flashing \((.)(.*)\)$/,(_all,first:string,rest:string)=>first.toUpperCase()+rest);
    const boltsOn=(c:typeof contacts[number])=>hardware.ledgerBolts.filter(b=>{const ux=(c.b.x-c.a.x)/c.lengthIn,uy=(c.b.y-c.a.y)/c.lengthIn,t=(b.x-c.a.x)*ux+(b.z-c.a.y)*uy,off=Math.abs((b.x-c.a.x)*uy-(b.z-c.a.y)*ux);return off<3&&t>=-1&&t<=c.lengthIn+1;}).length;
    tables.push({title:'HOUSE CONNECTION',head:['Wall','Attachment','Length','Bolts','Flashing'],right:[2,3],
      rows:contacts.map(c=>[wallLabel({front:'main-front',left:'main-left',right:'main-right',far:'main-back'}[c.wall]??c.wall,house),c.kind==='ledger'?`${data.framingSize} ledger`:'Outside joist bolted to wall',feetInches(c.lengthIn),String(boltsOn(c)),flashing])});
  }

  // Stairs, flight by flight.
  const flights=(model.flights??[]) as {id:string;kind:string;risers:number;rise:number;run:number;width:number;stringerOffsets:number[]}[];
  if(flights.length)tables.push({title:'STAIRS',head:['Flight','Risers','Rise','Run','Width','Stringers','Spacing'],right:[1,2,3,4,5],
    rows:flights.map(f=>[`${f.kind==='connection'?'Between levels':'To grade'}${/-upper$/.test(f.id)?', upper':/-lower$/.test(f.id)?', lower':/-winders$/.test(f.id)?', winders':''}`,String(f.risers),`${f.rise.toFixed(2)}"`,`${f.run.toFixed(2)}"`,feetInches(f.width),...(f.stringerOffsets.length?[String(f.stringerOffsets.length),`${model.stairSupport.spacingIn}" o.c.`]:['On the winder framing','-'])])});

  // The guard.
  if(data.railingType!=='None'&&model.quantities.railingLf>0){
    const anchors=connectorSchedule(data,model,hardware).find(r=>r.name==='Railing post anchors/bolts');
    tables.push({title:'GUARD',head:['Guard','Height','Length','Stairs','Posts','Post anchorage'],right:[1,2,3,4],
      rows:[[names.railingName,`${model.railing.height}"`,feet(model.quantities.railingLf),feet(model.quantities.stairRailingLf),String(model.railing.posts.length),model.railing.frameless?'Glass hardware, see S-5':anchors?STATUS_WORDS[partStatus(data,anchors)]:'-']]});
  }

  // Every connection part, with how the estimate carries it.
  tables.push({title:'CONNECTIONS',head:['Part','Qty','Unit','In the estimate'],right:[1],
    rows:connectorSchedule(data,model,hardware).map(r=>[`${r.name} [${connectorRowId(r.name)}]`,String(r.qty),r.unit,STATUS_WORDS[partStatus(data,r)]])});

  // Framing lumber as ordered.
  tables.push({title:'FRAMING LUMBER',head:['Lumber','Stock','Pieces','Installed','Ordered'],right:[1,2,3,4],
    rows:constructionStock(model).map(r=>{const [w,d]=r.section.split(' × ').map(parseFloat);return [`${w===1.5?nominal(d):r.section} framing [${stockRowId(r)}]`,feetInches(r.stockLengthIn),String(r.orderedPieces),feet(r.installedLf),feet(r.orderedLf)];})});
  return tables;
}

// Paper sizes, inches.
const CELL=.11,TITLE=.14,ROW=.23,PAD=.08,TITLE_GAP=.32,TABLE_GAP=.36,COLUMN_GAP=.38;
const textWidth=(t:string,h:number)=>t.length*h*.52;

/** A table's size on paper and its column widths. */
function measure(t:ScheduleTable){
  const cols=t.head.map((h,c)=>Math.max(textWidth(h,CELL),...t.rows.map(r=>textWidth(r[c]??'',CELL)))+2*PAD);
  return {cols,w:Math.max(cols.reduce((n,c)=>n+c,0),textWidth(t.title,TITLE)),h:TITLE_GAP+ROW*(t.rows.length+1)};
}

/**
 * The tables laid out in columns down the drawing area (paper inches times `ratio` in plan space), each drawn as ruled
 * rows with its title above. Returns the items at `origin`.
 */
export function scheduleItems(tables:ScheduleTable[],origin:Pt,ratio:number):DrawItem[]{
  const items:DrawItem[]=[],maxH=SHEET.area.h-.7,p=(x:number,y:number):Pt=>({x:origin.x+x*ratio,y:origin.y+y*ratio});
  let x=0,y=0,colW=0;
  const line=(x0:number,y0:number,x1:number,y1:number)=>items.push({kind:'line',layer:'A-ANNO-TEXT',a:p(x0,y0),b:p(x1,y1)});
  const text=(at:[number,number],t:string,h:number,anchor:'start'|'end')=>items.push({kind:'text',layer:'A-ANNO-TEXT',at:p(...at),text:t,height:h,anchor});
  for(const t of tables){
    const {cols,w,h}=measure(t);
    if(y>0&&y+h>maxH){x+=colW+COLUMN_GAP;y=0;colW=0;}
    text([x,y+TITLE],t.title,TITLE,'start');
    const top=y+TITLE_GAP,width=cols.reduce((n,c)=>n+c,0);
    [t.head,...t.rows].forEach((row,r)=>{
      let cx=x;
      row.forEach((cell,c)=>{const right=t.right.includes(c);text([right?cx+cols[c]-PAD:cx+PAD,top+ROW*r+ROW*.68],cell,CELL,right?'end':'start');cx+=cols[c];});
    });
    // Every row ruled, the columns separated.
    for(let r=0;r<=t.rows.length+1;r++)line(x,top+ROW*r,x+width,top+ROW*r);
    let cx=x;for(let c=0;c<=cols.length;c++){line(cx,top,cx,top+ROW*(t.rows.length+1));cx+=cols[c]??0;}
    y+=h+TABLE_GAP;colW=Math.max(colW,w);
  }
  return items;
}
