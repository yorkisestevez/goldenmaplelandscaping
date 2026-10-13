import {usesPhysicalElevations} from '../elevationDatum';
import type {DeckData} from '../types';
import type {DeckTakeoff} from '../deckTakeoff';
import type {ZoneReference} from '../zoneFraming';
import {catalogueAccessoryLayout} from '../catalogueAccessories';
import {getHardwareLayout} from '../hardwareLayout';
import {ACTUAL_DEPTH_IN,DESIGN,type JoistSize} from '../structure/spanTables';
import {type DrawItem,type LayerId,type Pt,feetInches} from './drawingTypes';
import {sampleSiteHeight} from '../siteSurface';
import {buildElevationProfile} from '../elevationProfiles';
import {foundationSolids} from '../foundationSolids';
import {translate} from './elevations';
import {ledgerFlashing,pierOf} from './pricedParts';

/**
 * Sheet S-4: a typical section through the main deck's deepest framing zone, cut between two joists and looking
 * toward the deck's right-hand end (the house on the left). It is drawn from that zone's framing (structure/framing.ts):
 * the ledger or house-side beam, the joist beyond, every beam row cut through its plies, the posts and footings under
 * them, the blocking rows, the rim, the decking and the guard. Sizes and counts are the design's own, as priced.
 */
export interface TypicalSection{
  items:DrawItem[];
  reference:ZoneReference;
  /** Zone depth from its back edge to its front edge, inches. */
  depthIn:number;attached:boolean;
  /** Where section 1 is cut, in plan (for its mark on S-2). */
  mark:{x:number;y0:number;y1:number};
  /** The pier diameter drawn, whether the price book names a 16 in allowance, and whether structural review sized it. */
  pier:{diameter:number;priced:boolean;sized?:boolean};
  /** How far the guard posts' centre line sits inside the front edge, inches. */
  guardInset:number;
}

const TEXT=.08;

export function typicalSection(data:DeckData,model:DeckTakeoff,names:{materialName:string;railingName:string},origin:Pt,hardware=getHardwareLayout(data,model)):TypicalSection{
  const physical=usesPhysicalElevations(data),main=model.levels[0],outline=main.footprint.outline,back=Math.min(...outline.map(p=>p.y));
  const framed:{origin:Pt;w:number;reference:ZoneReference}[]=main.zones?.length?main.zones.map(f=>({origin:f.zone.origin,w:f.zone.size.w,reference:f.reference}))
    :[{origin:{x:Math.min(...outline.map(p=>p.x)),y:back>1e-6?back:0},w:main.footprint.bounds.w,reference:main.reference}];
  const reach=(f:typeof framed[number])=>f.reference.beamRows.at(-1)!.z+f.reference.edgeReachIn;
  const zone=framed.reduce((p,q)=>reach(q)>reach(p)+1e-6?q:p),ref=zone.reference;
  const rows=ref.beamRows,d=rows.at(-1)!.z+ref.edgeReachIn,attached=!rows.some(r=>r.kind==='house');
  const size=data.framingSize as JoistSize,jd=ACTUAL_DEPTH_IN[size]??9.25,top=main.top,joistTop=top-DESIGN.deckingThicknessIn;
  const plies=ref.beam.plies,half=plies*.75,beamBottom=ref.beamBottomIn,beamTop=beamBottom+ref.beamDepthIn;
  const blocks=data.foundation==='Deck Blocks',helical=data.foundation==='Helical Piles',postBase=blocks?6.5:4.5,depth=blocks?0:data.foundationDepthIn??48;
  const {priced:pricedPier,diameter:pier,sized:pierSized}=pierOf(data,model);
  const spacing=data.pattern==='Diagonal'||data.pattern==='Herringbone'?12:data.joistSpacing;
  const fascia=catalogueAccessoryLayout(data,model).fascia.length>0;
  const items:DrawItem[]=[];
  // The cut, in plan: between two joists a third of the way across the zone, clear of the labels centred on S-2.
  // The level's own joists (build-ups at breakers and borders included), in the zone's x.
  const built=[...new Set(main.joists.filter(j=>Math.abs(j.a.x-j.b.x)<1e-6).map(j=>Math.round((j.a.x-main.offset.x-zone.origin.x)*100)/100))].filter(x=>x>-1e-6&&x<zone.w+1e-6).sort((p,q)=>p-q);
  const xs=built.length>1?built:ref.joistXsIn,mid=zone.w*.35;let cut=xs.length>1?(xs[0]+xs[1])/2:mid;
  for(let i=0;i+1<xs.length;i++){const c=(xs[i]+xs[i+1])/2;if(Math.abs(c-mid)<Math.abs(cut-mid))cut=c;}
  const x=main.offset.x+zone.origin.x+cut,y=main.offset.z+zone.origin.y;
  // These are actual supports near the cut, projected into the section. Reuse
  // the same datum for geometry, dimensions and leaders.
  const rowDatums=new Map(rows.map(r=>[r,model.foundationSupports.filter(f=>f.levelIndex===0&&Math.abs(f.z-(y+r.z))<6).sort((a,b)=>Math.abs(a.x-x)-Math.abs(b.x-x))[0]]));

  // Section coordinates: u from the zone's back edge toward the yard, v up from grade; the sheet's y is −v.
  const P=(u:number,v:number):Pt=>({x:u,y:-v});
  const line=(layer:LayerId,u0:number,v0:number,u1:number,v1:number)=>items.push({kind:'line',layer,a:P(u0,v0),b:P(u1,v1)});
  /** A rectangle; a member cut by the section also gets the lumber-section cross. */
  const rect=(layer:LayerId,u0:number,v0:number,u1:number,v1:number,cut=false)=>{
    items.push({kind:'poly',closed:true,layer,points:[P(u0,v0),P(u1,v0),P(u1,v1),P(u0,v1)]});
    if(cut){line(layer,u0,v0,u1,v1);line(layer,u0,v1,u1,v0);}
  };
  const text=(u:number,v:number,t:string,anchor:'start'|'middle'|'end'='start',height=TEXT,rotate?:number)=>items.push({kind:'text',layer:'A-ANNO-TEXT',at:P(u,v),text:t,height,anchor,...(rotate?{rotate}:{})});

  // Grade and the house wall.
  const house=data.houseVisible!==false;
  if(physical){const profile=buildElevationProfile(data,{id:'typical-section',name:'Section 1',segments:[{a:{x,y:y-30},b:{x,y:y+d+60}}]});for(const [key,layer] of [['existingIn','C-EXST'],['proposedIn','C-PGRD']] as const){let prev:typeof profile.points[number]|undefined;for(const p of profile.points){if(p[key]===null){prev=undefined;continue;}if(prev&&prev[key]!==null)line(layer,prev.stationIn-30,prev[key]!,p.stationIn-30,p[key]!);prev=p;}}text(d+54,-4.5,'EG / PG · DATUM 0.00','end');}
  else {line('C-TOPO',house?-30:-24,0,d+60,0);text(d+54,-4.5,'GRADE','end');}
  if(house){
    rect('A-HOUS',-12,0,0,top+48);
    text(-6,top/2+24,'EXISTING HOUSE WALL','middle',TEXT,-90);
  }
  // House side: a ledger with its flashing, bolt and hanger; or a freestanding deck's own beam.
  const rim=!ref.edgeBeams,uStart=attached?1.5:ref.edgeBeams?rows[0].z+half:1.5,uEnd=ref.edgeBeams?rows.at(-1)!.z-half:d-1.5;
  if(attached){
    rect('S-LEDG',0,joistTop-jd,1.5,joistTop,true);
    items.push({kind:'poly',closed:false,layer:'S-LEDG',points:[P(0,joistTop+3),P(0,joistTop+.2),P(2,joistTop+.2),P(2,joistTop-1)]});
    line('S-LEDG',-4,top-4,2.25,top-4);line('S-LEDG',2.25,top-4.6,2.25,top-3.4);
    rect('S-FRMG',1.5,joistTop-jd-.1,3.1,joistTop-jd+Math.min(6,jd-1));
  }else if(rim)rect('S-FRMG',0,joistTop-jd,1.5,joistTop,true);
  if(rim)rect('S-FRMG',d-1.5,joistTop-jd,d,joistTop,true);
  if(fascia)rect('A-DECK-FNSH',d,joistTop-jd,d+.625,joistTop);
  // The joist beyond: continuous over drop beams, or hung between flush beams.
  const bearings=ref.beamMount==='flush'?rows.map(r=>r.z).filter(z=>z-half>uStart&&z+half<uEnd):[];
  let from=uStart;for(const z of bearings){rect('S-FRMG',from,joistTop-jd,z-half,joistTop);from=z+half;}
  rect('S-FRMG',from,joistTop-jd,uEnd,joistTop);
  for(const z of ref.blockingZsIn)if(z>uStart+.75&&z<uEnd-.75)rect('S-BLKG',z-.75,joistTop-jd,z+.75,joistTop,true);
  // Each beam row: its plies cut, the post under it, and the footing under that.
  for(const r of rows){
    for(let i=0;i<plies;i++)rect('S-BEAM',r.z-half+i*1.5,beamBottom,r.z-half+(i+1)*1.5,beamTop,true);
    if(physical){const datum=rowDatums.get(r);if(datum){const solids=foundationSolids(datum);for(const box of solids.boxes)rect(box.part==='deck-block'?'S-FTNG':'S-POST',r.z-box.d/2,box.y-box.h/2,r.z+box.d/2,box.y+box.h/2);for(const c of solids.cylinders)rect('S-FTNG',r.z-c.radius,c.bottom,r.z+c.radius,c.top);text(r.z,datum.bottomElevationIn===null?beamBottom-8:datum.bottomElevationIn-8,datum.status==='coverage-pending'?'FOUNDATION PENDING':`Support at X=${datum.x.toFixed(1)} projected${datum.status==='clearance-pending'?' · CLEARANCE PENDING':''}`,'middle',.055);}else text(r.z,beamBottom-8,'SUPPORT LOCATION PENDING','middle',.055);}
    else {
    if(beamBottom>postBase+.5){rect('S-POST',r.z-2.75,postBase,r.z+2.75,beamBottom);rect('S-POST',r.z-3.5,postBase-.45,r.z+3.5,postBase-.05);}
    if(blocks)rect('S-FTNG',r.z-6,0,r.z+6,6);
    else if(helical){rect('S-FTNG',r.z-1.4,-depth,r.z+1.4,2);rect('S-FTNG',r.z-6,-depth+4,r.z+6,-depth+4.3);rect('S-POST',r.z-.5,2,r.z+.5,postBase-.45);}
    else{rect('S-FTNG',r.z-pier/2,-depth,r.z+pier/2,2);rect('S-POST',r.z-.5,2,r.z+.5,postBase-.45);}
    }
  }
  // Decking: boards crossing the cut show as sections; boards running with it as one band.
  const field=main.boards.find(b=>!b.role)??main.boards[0],cos=Math.abs(Math.cos((field?.angleDeg??0)*Math.PI/180));
  if(cos>.5){const w=data.boardWidth/cos,pitch=(data.boardWidth+model.gap)/cos;for(let u=0;u<d-.5;u+=pitch)rect('A-DECK-FNSH',u,joistTop,Math.min(d,u+w),top);}
  else rect('A-DECK-FNSH',0,joistTop,d,top);
  // The guard at the front edge, where the design runs it.
  const railed=data.railingType!=='None',h=model.railing.height;
  const frontZ=main.offset.z+zone.origin.y+d,runZ=model.railing.rails.filter(r=>Math.abs(r.a.z-r.b.z)<1e-6).map(r=>r.a.z).filter(z=>z<=frontZ+1e-6&&frontZ-z<=12).sort((p,q)=>q-p)[0];
  const g=d-(runZ===undefined?1.75:frontZ-runZ);
  if(railed){
    if(model.railing.frameless){rect('A-RAIL',g-.25,top+1,g+.25,top+h);rect('A-RAIL',g-1.5,top,g+1.5,top+4);}
    else{
      rect('A-RAIL',g-1.75,top,g+1.75,top+h);rect('A-RAIL',g-1,top+h-2.5,g+1,top+h);rect('A-RAIL',g-1,top+2.25,g+1,top+3.75);
      if(data.railingType==='Glass Panels')rect('A-RAIL',g-.25,top+4,g+.25,top+h-4);
      else if(data.railingType!=='Cable')rect('A-RAIL',g-.375,top+4,g+.375,top+h-3);
    }
  }

  // Dimensions: out from the house to each beam row and the front edge, under the grade; heights at the front.
  const under=(physical?Math.max(depth,...[...rowDatums.values()].flatMap(f=>f?.bottomElevationIn==null?[]:[-f.bottomElevationIn])):depth)+18,chain=[0,...rows.map(r=>r.z),d];
  for(let i=0;i+1<chain.length;i++)if(chain[i+1]-chain[i]>=3)items.push({kind:'dim',layer:'A-ANNO-DIMS',a:P(chain[i],-under),b:P(chain[i+1],-under),offset:0,text:feetInches(chain[i+1]-chain[i])});
  items.push({kind:'dim',layer:'A-ANNO-DIMS',a:P(0,-under),b:P(d,-under),offset:16,text:`${feetInches(d)} framed depth`});
  const frontGrade=physical?sampleSiteHeight(data,x,y+d):0;
  if(frontGrade!==undefined)items.push({kind:'dim',layer:'A-ANNO-DIMS',a:P(d,frontGrade),b:P(d,top),offset:30,text:physical?`${feetInches(top-frontGrade)} local clearance`:feetInches(top)});
  else text(d+20,top,`Deck datum ${feetInches(top)}; ground clearance pending`);
  if(railed)items.push({kind:'dim',layer:'A-ANNO-DIMS',a:P(d,top),b:P(d,top+h),offset:30,text:`${feetInches(h)} guard`});
  if(depth&&!physical)items.push({kind:'dim',layer:'A-ANNO-DIMS',a:P(rows[0].z-(helical?1.4:pier/2),0),b:P(rows[0].z-(helical?1.4:pier/2),-depth),offset:12,text:feetInches(depth)});
  if(depth&&physical){const datum=rowDatums.get(rows[0]);if(datum?.gradeElevationIn!=null&&datum.bottomElevationIn!==null)items.push({kind:'dim',layer:'A-ANNO-DIMS',a:P(rows[0].z-(helical?1.4:6),datum.gradeElevationIn),b:P(rows[0].z-(helical?1.4:6),datum.bottomElevationIn),offset:12,text:`${feetInches(datum.gradeElevationIn-datum.bottomElevationIn)} below support local grade`});}

  // Callouts, in a column on each side, leaders to the members they name (top to bottom, so leaders do not cross).
  const last=rows.at(-1)!,bolts=hardware.ledgerBolts.length,hangers=hardware.hangers.length+(hardware.skewedHangers?.length??0);
  const allowance=pricedPier?16:12;
  const footing=blocks?'Deck block on compacted, undisturbed soil':helical?`Helical pile to ${feetInches(depth)} below grade`
    :pierSized?`${pier} in concrete pier sized for tributary load, ${feetInches(depth)} below grade; ${allowance} in price-book allowance`
    :pricedPier?`16 in concrete pier, ${feetInches(depth)} below grade`:`Concrete pier, ${feetInches(depth)} below grade`;
  const datum=rowDatums.get(last),localSolids=datum?foundationSolids(datum):undefined;
  const post=localSolids?.boxes.find(b=>b.part==='post'),base=localSolids?.boxes.find(b=>b.part==='deck-block'),shaft=localSolids?.cylinders.find(c=>c.part==='pile-shaft'||c.part==='concrete-pier');
  const physicalPosts:[Pt,string][]=post?[[P(last.z+post.d/2,post.y),`6x6 post, ${feetInches(post.h)} cut length on local post base`]]:[];
  const physicalFooting:[Pt,string]=base?[P(last.z+base.d/2,base.y),'Deck block on local proposed grade; bearing pending']
    :shaft?[P(last.z+shaft.radius,(shaft.bottom+shaft.top)/2),helical?`Helical pile, ${feetInches(datum!.depthIn)} below local grade; design pending`:pierSized?`${Math.round(shaft.radius*2)} in concrete pier sized for tributary load, ${feetInches(datum!.depthIn)} below local grade; ${pricedPier?16:12} in price-book allowance`:`12 in schematic concrete pier, ${feetInches(datum!.depthIn)} below local grade; diameter / bearing pending${pricedPier?' (16 in allowance basis)':''}`]
    :[P(last.z+half,beamBottom),'Foundation datum / ground coverage pending; no footing modeled'];
  const right:[Pt,string][]=[
    ...(railed?[[P(g,top+h*.6),`Guard, ${h} in high`] as [Pt,string]]:[]),
    [P(Math.min(d*.7,uEnd-12),top-.5),`${names.materialName} decking`],
    ...(rim?[[P(d-.75,joistTop-jd*.7),`${size} rim joist${fascia?' and fascia':''}`] as [Pt,string]]:[]),
    [P((rows.at(-2)?.z??uStart)/2+last.z/2,joistTop-jd*.35),`${size} joists @ ${spacing}" o.c.`],
    [P(last.z+half,beamBottom+ref.beamDepthIn/2),`${plies}-ply ${ref.beam.size} beam${ref.beamMount==='drop'?'':', flush'}`],
    ...(physical?physicalPosts:beamBottom>postBase+.5?[[P(last.z+2.75,(postBase+beamBottom)/2),'6x6 post on a post base'] as [Pt,string]]:[]),
    physical?physicalFooting:[P(last.z+(blocks?6:helical?1.4:pier/2),blocks?3:-depth/2),footing],
  ];
  const leftSide:[Pt,string][]=attached?[
    [P(.75,joistTop-jd*.3),`${size} ledger, ${bolts} bolts (as priced)`],
    [P(1.2,joistTop+.2),ledgerFlashing(data).label],
    [P(2.3,joistTop-jd+2),`${hangers} joist hangers (as priced)`],
  ]:[[P(rows[0].z-half,beamBottom+ref.beamDepthIn/2),'House-side beam; deck not fastened to house']];
  if(ref.blockingZsIn.some(z=>z>uStart+.75&&z<uEnd-.75)){const z=ref.blockingZsIn.find(z=>z>uStart+.75&&z<uEnd-.75)!;(z<d/3?leftSide:right).push([P(z,joistTop-jd/2),`${size} blocking, rows as on S-2`]);}
  const column=(list:[Pt,string][],x:number,anchor:'start'|'end')=>{
    list.sort((p,q)=>p[0].y-q[0].y);
    const topY=-(top+(railed?h:0)+6),span=Math.max(list.length*14,depth+top+(railed?h:0)+12),step=list.length>1?span/(list.length-1):0;
    list.forEach(([target,label],i)=>{const y=topY+i*Math.min(step,24);items.push({kind:'line',layer:'A-ANNO-TEXT',a:target,b:{x,y}});text(x+(anchor==='start'?2:-2),-y+1,label,anchor);});
  };
  column(right,d+56,'start');column(leftSide,house?-24:-16,'end');
  text(d/2,-(under+44),physical?'SECTION 1 · DATUM SECTION; SUPPORTS PROJECTED':'SECTION 1 · TYPICAL SECTION (cut on S-2)','middle',.14);

  const b=items.flatMap(i=>i.kind==='line'||i.kind==='dim'?[i.a,i.b]:i.kind==='poly'?i.points:i.kind==='circle'?[i.c]:[i.at]);
  const minX=Math.min(...b.map(p=>p.x)),minY=Math.min(...b.map(p=>p.y));
  return {items:translate(items,origin.x-minX,origin.y-minY),reference:ref,depthIn:d,attached,mark:{x,y0:y-36,y1:y+d+44},pier:pierSized?{diameter:pier,priced:pricedPier,sized:true}:physical?{diameter:12,priced:false}:{diameter:pier,priced:pricedPier},guardInset:d-g};
}
