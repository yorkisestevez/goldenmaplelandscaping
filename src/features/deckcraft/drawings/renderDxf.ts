import {LAYERS,type DrawItem,type DrawingSet,type LayerId,type Pt} from './drawingTypes';

/**
 * The permit plans as one layered 2D DXF (AutoCAD R12 / AC1009, the most widely read revision): model space at full
 * size in inches, house at the top as on the sheets (DXF y = −plan y). Every sheet's geometry goes in once, on its
 * layer, so a contractor can turn the foundation, framing and guard layers on and off. Footings and posts are block
 * inserts; dimensions are drawn out as lines and text on A-ANNO-DIMS; text heights follow the framing sheet's scale.
 */
const f=(n:number)=>(Math.abs(n)<1e-9?0:Math.round(n*1e6)/1e6).toString();
const code=(c:number,v:string|number)=>`${c}\n${typeof v==='number'?f(v):v}\n`;
const at=(p:Pt,c=10)=>code(c,p.x)+code(c+10,-p.y)+code(c+20,0);

function entity(item:DrawItem,textScale:number):string{
  switch(item.kind){
    case 'line':return code(0,'LINE')+code(8,item.layer)+at(item.a)+at(item.b,11);
    case 'poly':return code(0,'POLYLINE')+code(8,item.layer)+code(66,1)+code(70,item.closed?1:0)+at({x:0,y:0})
      +item.points.map(p=>code(0,'VERTEX')+code(8,item.layer)+at(p)).join('')+code(0,'SEQEND')+code(8,item.layer);
    case 'circle':return code(0,'CIRCLE')+code(8,item.layer)+at(item.c)+code(40,item.r);
    case 'symbol':return code(0,'INSERT')+code(8,item.layer)+code(2,item.name)+at(item.at)+code(41,item.size)+code(42,item.size)+code(43,1);
    case 'text':{const h=item.height*textScale,align=item.anchor==='start'?0:item.anchor==='middle'?1:2;
      return code(0,'TEXT')+code(8,item.layer)+at(item.at)+code(40,h)+code(1,item.text)+code(50,-(item.rotate??0))+(align?code(72,align)+at(item.at,11):'');}
    case 'dim':{
      const {a,b}=item,len=Math.hypot(b.x-a.x,b.y-a.y),n={x:-(b.y-a.y)/len,y:(b.x-a.x)/len},pa={x:a.x+n.x*item.offset,y:a.y+n.y*item.offset},pb={x:b.x+n.x*item.offset,y:b.y+n.y*item.offset};
      let angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;if(angle>=90)angle-=180;if(angle<-90)angle+=180;
      const mid={x:(pa.x+pb.x)/2+n.x*Math.sign(item.offset||1)*.06*textScale,y:(pa.y+pb.y)/2+n.y*Math.sign(item.offset||1)*.06*textScale};
      return [entity({kind:'line',layer:'A-ANNO-DIMS',a,b:pa},textScale),entity({kind:'line',layer:'A-ANNO-DIMS',a:b,b:pb},textScale),entity({kind:'line',layer:'A-ANNO-DIMS',a:pa,b:pb},textScale),
        entity({kind:'text',layer:'A-ANNO-DIMS',at:mid,text:item.text,height:.075,anchor:'middle',rotate:angle},textScale)].join('');
    }
  }
}

/** A unit symbol (1 in across), scaled by each insert to its real size. */
function block(name:string,body:string){return code(0,'BLOCK')+code(8,'0')+code(2,name)+code(70,0)+at({x:0,y:0})+code(3,name)+body+code(0,'ENDBLK')+code(8,'0');}
const square=(fill:boolean)=>code(0,'POLYLINE')+code(8,'0')+code(66,1)+code(70,1)+at({x:0,y:0})+[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([x,y])=>code(0,'VERTEX')+code(8,'0')+at({x,y})).join('')+code(0,'SEQEND')+code(8,'0')
  +(fill?code(0,'LINE')+code(8,'0')+at({x:-.5,y:-.5})+at({x:.5,y:.5},11)+code(0,'LINE')+code(8,'0')+at({x:-.5,y:.5})+at({x:.5,y:-.5},11):'');

export function buildPermitDxf(set:DrawingSet):string{
  // One copy of each item across the sheets (outlines and posts repeat from sheet to sheet).
  const seen=new Set<string>(),items:{item:DrawItem;scale:number}[]=[];
  for(const sheet of set.sheets)for(const item of sheet.items){const key=JSON.stringify(item);if(!seen.has(key)){seen.add(key);items.push({item,scale:sheet.ratio});}}
  const textScale=set.sheets.find(s=>s.id==='S-2')?.ratio??48;
  const pts=items.flatMap(({item})=>item.kind==='line'||item.kind==='dim'?[item.a,item.b]:item.kind==='poly'?item.points:item.kind==='circle'?[item.c]:[item.at]);
  const min={x:Math.min(...pts.map(p=>p.x)),y:Math.max(...pts.map(p=>p.y))},max={x:Math.max(...pts.map(p=>p.x)),y:Math.min(...pts.map(p=>p.y))};
  const used=[...new Set(items.map(i=>i.item.layer))] as LayerId[];
  const layerTable=code(0,'TABLE')+code(2,'LAYER')+code(70,used.length+1)+code(0,'LAYER')+code(2,'0')+code(70,0)+code(62,7)+code(6,'CONTINUOUS')
    +used.map(id=>code(0,'LAYER')+code(2,id)+code(70,0)+code(62,LAYERS[id].aci)+code(6,LAYERS[id].dash?'DASHED':'CONTINUOUS')).join('')+code(0,'ENDTAB');
  const ltypes=code(0,'TABLE')+code(2,'LTYPE')+code(70,2)
    +code(0,'LTYPE')+code(2,'CONTINUOUS')+code(70,0)+code(3,'Solid line')+code(72,65)+code(73,0)+code(40,0)
    +code(0,'LTYPE')+code(2,'DASHED')+code(70,0)+code(3,'Dashed __ __ __')+code(72,65)+code(73,2)+code(40,6)+code(49,4)+code(49,-2)+code(0,'ENDTAB');
  const style=code(0,'TABLE')+code(2,'STYLE')+code(70,1)+code(0,'STYLE')+code(2,'STANDARD')+code(70,0)+code(40,0)+code(41,1)+code(50,0)+code(71,0)+code(42,4)+code(3,'txt')+code(4,'')+code(0,'ENDTAB');
  const title=[`${set.firm.name} · ${set.project.title}`,`Permit plans · ${set.project.date} · price book ${set.project.priceBook}${set.reviewItems.length?` · DRAFT, ${set.reviewItems.length} review items open`:''}`,set.footer];
  const titleItems:DrawItem[]=title.map((text,i)=>({kind:'text',layer:'A-ANNO-TEXT',at:{x:min.x,y:min.y+(3+i*1.8)*.12*textScale},text,height:.12,anchor:'start'}));
  return code(999,`DeckCraft permit plans. Units: inches, full size. ${set.firm.name}.`)
    +code(0,'SECTION')+code(2,'HEADER')+code(9,'$ACADVER')+code(1,'AC1009')+code(9,'$INSBASE')+at({x:0,y:0})
    +code(9,'$EXTMIN')+at(min)+code(9,'$EXTMAX')+at(max)+code(0,'ENDSEC')
    +code(0,'SECTION')+code(2,'TABLES')+ltypes+layerTable+style+code(0,'ENDSEC')
    +code(0,'SECTION')+code(2,'BLOCKS')+block('FOOTING',code(0,'CIRCLE')+code(8,'0')+at({x:0,y:0})+code(40,.5))+block('BLOCK',square(false))+block('POST',square(true))+code(0,'ENDSEC')
    +code(0,'SECTION')+code(2,'ENTITIES')+items.map(({item})=>entity(item,textScale)).join('')+titleItems.map(i=>entity(i,textScale)).join('')+code(0,'ENDSEC')
    +code(0,'EOF');
}
