import {LAYERS,SHEET,type DrawItem,type DrawingSet,type LayerId,type Pt,type Sheet,sheetTransform} from './drawingTypes';

/**
 * A sheet laid out on paper (inches, y down): the border and title block, the plan drawn to scale, the legend, notes,
 * draft stamp and footer. The SVG preview and the PDF both paint exactly this list, so they cannot drift apart.
 */
export type PaperPrim=
  |{kind:'line';a:Pt;b:Pt;weight:number;dash:readonly number[]|null;grey?:boolean}
  |{kind:'circle';c:Pt;r:number;weight:number;fill?:boolean}
  |{kind:'rect';x:number;y:number;w:number;h:number;weight:number;fill?:boolean}
  /** `rotate`: degrees clockwise as the sheet is read (y down). */
  |{kind:'text';at:Pt;text:string;size:number;anchor:'start'|'middle'|'end';rotate?:number;bold?:boolean};

/** Helvetica's average advance is about half its size; wrapping to that keeps notes inside the title block. */
export function wrap(text:string,width:number,size:number):string[]{
  const max=Math.max(8,Math.floor(width/(size*.52))),lines:string[]=[];let line='';
  for(const word of text.split(/\s+/)){if(!line)line=word;else if((line+' '+word).length<=max)line+=' '+word;else{lines.push(line);line=word;}}
  if(line)lines.push(line);return lines;
}

function drawItem(item:DrawItem,to:(p:Pt)=>Pt,ratio:number):PaperPrim[]{
  const layer=LAYERS[item.layer],w=layer.weight,dash=layer.dash;
  switch(item.kind){
    case 'line':return [{kind:'line',a:to(item.a),b:to(item.b),weight:w,dash}];
    case 'poly':{const pts=item.points.map(to),out:PaperPrim[]=[];for(let i=0;i+1<pts.length;i++)out.push({kind:'line',a:pts[i],b:pts[i+1],weight:w,dash});if(item.closed&&pts.length>2)out.push({kind:'line',a:pts.at(-1)!,b:pts[0],weight:w,dash});return out;}
    case 'circle':return [{kind:'circle',c:to(item.c),r:item.r/ratio,weight:w}];
    case 'symbol':{const c=to(item.at),s=item.size/ratio;
      return item.name==='FOOTING'?[{kind:'circle',c,r:s/2,weight:w}]:[{kind:'rect',x:c.x-s/2,y:c.y-s/2,w:s,h:s,weight:w,fill:item.name==='POST'}];}
    case 'text':return [{kind:'text',at:to(item.at),text:item.text,size:item.height,anchor:item.anchor,rotate:item.rotate}];
    case 'dim':{
      const a=to(item.a),b=to(item.b),len=Math.hypot(b.x-a.x,b.y-a.y);if(len<1e-6)return [];
      const n={x:-(b.y-a.y)/len,y:(b.x-a.x)/len},off=item.offset/ratio,pa={x:a.x+n.x*off,y:a.y+n.y*off},pb={x:b.x+n.x*off,y:b.y+n.y*off};
      const ext=(p:Pt,q:Pt):PaperPrim=>({kind:'line',a:{x:p.x+n.x*Math.sign(off)*.04,y:p.y+n.y*Math.sign(off)*.04},b:{x:q.x+n.x*Math.sign(off)*.06,y:q.y+n.y*Math.sign(off)*.06},weight:.004,dash:null,grey:true});
      const u={x:(b.x-a.x)/len,y:(b.y-a.y)/len},tick=(p:Pt):PaperPrim=>({kind:'line',a:{x:p.x-(u.x+n.x)*.04,y:p.y-(u.y+n.y)*.04},b:{x:p.x+(u.x+n.x)*.04,y:p.y+(u.y+n.y)*.04},weight:.01,dash:null});
      // Text runs along the dimension, turned so it reads left to right or bottom to top.
      let angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;if(angle>=90)angle-=180;if(angle<-90)angle+=180;
      const mid={x:(pa.x+pb.x)/2+n.x*Math.sign(off||1)*.05,y:(pa.y+pb.y)/2+n.y*Math.sign(off||1)*.05};
      return [ext(a,pa),ext(b,pb),{kind:'line',a:pa,b:pb,weight:w,dash:null},tick(pa),tick(pb),{kind:'text',at:mid,text:item.text,size:.075,anchor:'middle',rotate:angle}];
    }
  }
}

export function paperLayout(set:DrawingSet,sheet:Sheet,index:number):PaperPrim[]{
  const out:PaperPrim[]=[],m=SHEET.margin,W=SHEET.w,H=SHEET.h,tx=W-m-SHEET.titleW,tw=SHEET.titleW;
  out.push({kind:'rect',x:m,y:m,w:W-2*m,h:H-2*m,weight:.03},{kind:'line',a:{x:tx,y:m},b:{x:tx,y:H-m},weight:.02,dash:null});
  // The plan, to scale, centred in the drawing area.
  const to=sheetTransform(sheet);
  for(const item of sheet.items)out.push(...drawItem(item,to,sheet.ratio));
  // Graphic scale bar under the plan: 0, 4 and 8 ft, or longer steps at a site plan's engineer's scale.
  const stepFt=[4,10,20,50,100,200].find(ft=>ft*12/sheet.ratio>=.25)!,barY=SHEET.area.y+SHEET.area.h+.3,step=stepFt*12/sheet.ratio;
  out.push({kind:'line',a:{x:SHEET.area.x,y:barY},b:{x:SHEET.area.x+2*step,y:barY},weight:.012,dash:null});
  for(const k of [0,1,2]){out.push({kind:'line',a:{x:SHEET.area.x+k*step,y:barY-.04},b:{x:SHEET.area.x+k*step,y:barY+.04},weight:.01,dash:null},{kind:'text',at:{x:SHEET.area.x+k*step,y:barY+.15},text:`${k*stepFt}'`,size:.07,anchor:'middle'});}
  out.push({kind:'text',at:{x:SHEET.area.x+2*step+.15,y:barY+.03},text:`${sheet.id} ${sheet.title.toUpperCase()} · SCALE ${sheet.scaleLabel}`,size:.1,anchor:'start',bold:true});

  // Title block, top to bottom.
  const x=tx+.15,w=tw-.3;let y=m+.35;
  const text=(t:string,size:number,bold=false)=>{for(const line of wrap(t,w,size)){out.push({kind:'text',at:{x,y},text:line,size,anchor:'start',bold});y+=size*1.35;}};
  const rule=()=>{y+=.04;out.push({kind:'line',a:{x:tx,y},b:{x:W-m,y},weight:.01,dash:null});y+=.2;};
  text(set.firm.name.toUpperCase(),.16,true);text(`${set.firm.phone} · ${set.firm.email}`,.085);text(set.firm.url,.085);rule();
  text('PROJECT',.07,true);text(set.project.title,.1);text(`Date ${set.project.date} · Price book ${set.project.priceBook}`,.08);rule();
  const draft=set.reviewItems.length>0;
  out.push({kind:'rect',x:tx+.15,y:y-.12,w:w,h:.34,weight:.02});
  out.push({kind:'text',at:{x:tx+tw/2,y:y+.1},text:draft?`DRAFT · ${set.reviewItems.length} REVIEW ITEM${set.reviewItems.length===1?'':'S'} OPEN`:'PLANNING DRAWING',size:.11,anchor:'middle',bold:true});
  y+=.42;rule();
  text('LEGEND',.07,true);
  for(const id of sheet.legend){const layer=LAYERS[id as LayerId];out.push({kind:'line',a:{x,y:y-.035},b:{x:x+.35,y:y-.035},weight:Math.max(layer.weight,.01),dash:layer.dash});out.push({kind:'text',at:{x:x+.45,y},text:layer.label,size:.075,anchor:'start'});y+=.14;}
  y+=.04;rule();
  text('NOTES',.07,true);
  sheet.notes.forEach((note,i)=>{const lines=wrap(note,w-.15,.072);lines.forEach((line,k)=>{out.push({kind:'text',at:{x:k?x+.15:x,y},text:k?line:`${i+1}. ${line}`,size:.072,anchor:'start'});y+=.1;});y+=.03;});
  // The footer and the sheet number sit at the bottom of the title block.
  const footer=wrap(set.footer,w,.065);let fy=H-m-.75-footer.length*.09;
  out.push({kind:'line',a:{x:tx,y:fy-.18},b:{x:W-m,y:fy-.18},weight:.01,dash:null});
  for(const line of footer){out.push({kind:'text',at:{x,y:fy},text:line,size:.065,anchor:'start'});fy+=.09;}
  out.push({kind:'line',a:{x:tx,y:H-m-.62},b:{x:W-m,y:H-m-.62},weight:.01,dash:null});
  out.push({kind:'text',at:{x,y:H-m-.3},text:sheet.id,size:.32,anchor:'start',bold:true});
  out.push({kind:'text',at:{x:W-m-.15,y:H-m-.38},text:sheet.title,size:.09,anchor:'end'});
  out.push({kind:'text',at:{x:W-m-.15,y:H-m-.22},text:`Sheet ${index+1} of ${set.sheets.length}`,size:.08,anchor:'end'});
  return out;
}
