import {SITE_SCALES,SHEET,type DrawItem,type Sheet,drawnExtents} from './drawingTypes';

/** Only panel positions and paper annotations change. Every physical profile line
 * retains its original chainage and elevation deltas at one uniform sheet scale. */
export function profileSheets(site:DrawItem[],pool:DrawItem[],notes:string[]):Sheet[]{
 const blocks:DrawItem[][]=[];
 for(const source of [site,pool]){
  let block:DrawItem[]|undefined;
  for(const item of source){
   const title=item.kind==='text'&&(/\/A-2 .*true-scale height \/ chainage/.test(item.text)||/ · (longitudinal|across) · /.test(item.text));
   if(title){block=[item];blocks.push(block);}
   else if(block&&(item.kind!=='text'||/^(Start |End |Coping )/.test(item.text)))block.push(item);
  }
 }
 if(!blocks.length)return [];
 const gap=.18,pad=.08,header=.14,font=.1;
 const wrap=(text:string,width:number,size:number)=>{
  const max=Math.max(8,Math.floor(width/(size*.52))),lines:string[]=[];let line='';
  for(const word of text.split(/\s+/).flatMap(w=>w.match(new RegExp('.{1,'+max+'}','g'))??[])){if(line&&(line+' '+word).length>max){lines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)lines.push(line);return lines;
 };
 const extents=blocks.map(b=>drawnExtents(b.filter(i=>i.kind!=='text'),1,0));
 const required=48*Math.ceil(Math.max(2400,...extents.map(e=>Math.max((e.maxX-e.minX)/(SHEET.area.w-.6),(e.maxY-e.minY)/(SHEET.area.h-2))))/48);
 const candidates=[...SITE_SCALES,...(required>2400?[{ratio:required,label:`1" = ${required/12}'-0"`}]:[])];
 for(const paginate of [false,true])for(const scale of paginate?candidates.filter(s=>s.ratio>=128):candidates.filter(s=>s.ratio<=128))for(const columns of [2,3,1]){
  const unit=(SHEET.area.w-.4-(columns-1)*gap)/columns,pages:Sheet[]=[];let items:DrawItem[]=[],x=0,y=0,rowHeight=0,failed=false;
  const finish=()=>{
   const id:Sheet['id']=pages.length===0?'A-2':`A-2.${pages.length+1}`;
   const pageItems=items.map(i=>i.kind==='text'?{...i,text:i.text.replace(/^(\d+)\/A-2(?= )/,`$1/${id}`)}:i);
   pages.push({id,title:pages.length?'Site elevation profiles continued':'Site elevation profiles',ratio:scale.ratio,scaleLabel:scale.label,items:pageItems,extents:drawnExtents(pageItems,scale.ratio,.2),notes,legend:['C-EXST','C-PGRD','C-FNSH','C-FORM']});items=[];
  };
  for(const block of blocks){
   const geometry=block.filter(i=>i.kind!=='text');if(!geometry.length)continue;
   const extent=drawnExtents(geometry,scale.ratio,0),gw=(extent.maxX-extent.minX)/scale.ratio,gh=(extent.maxY-extent.minY)/scale.ratio;
   const span=Math.max(1,Math.ceil((gw+2*pad+gap)/(unit+gap))),width=span*unit+(span-1)*gap;
   if(span>columns){failed=true;break;}
   if(x+width>SHEET.area.w-.4+1e-8){y+=rowHeight+gap;x=0;rowHeight=0;}
   const title=(block[0] as Extract<DrawItem,{kind:'text'}>).text.replace(' · true-scale height / chainage','').replace(/ · Project (?:elevation )?datum.*$/,'');
   const headings=wrap(title,width-2*pad,.11),labels=block.filter((i):i is Extract<DrawItem,{kind:'text'}>=>i.kind==='text').slice(1).flatMap(i=>wrap(i.text,width-2*pad,font));
   const graphOffset=pad+headings.length*header+.07,height=graphOffset+gh+.12+labels.length*.13+pad;
   if(height>SHEET.area.h-.4){failed=true;break;}
   if(y+height>SHEET.area.h-.4){if(!paginate){failed=true;break;}finish();x=0;y=0;rowHeight=0;}
   const graphY=y+graphOffset,footerY=graphY+gh+.12;
   const text=(value:string,px:number,py:number,size:number):DrawItem=>({kind:'text',at:{x:px*scale.ratio,y:py*scale.ratio},text:value,height:size,anchor:'start',layer:'A-ANNO-TEXT'});
   headings.forEach((s,i)=>items.push(text(s,x+pad,y+pad+(i+1)*header,.11)));
   for(const item of geometry){const move=(p:{x:number;y:number})=>({x:p.x-extent.minX+(x+pad)*scale.ratio,y:p.y-extent.minY+graphY*scale.ratio});
    if(item.kind==='line')items.push({...item,a:move(item.a),b:move(item.b)});
    else if(item.kind==='poly')items.push({...item,points:item.points.map(move)});
    else if(item.kind==='circle')items.push({...item,c:move(item.c)});
    else if(item.kind==='dim')items.push({...item,a:move(item.a),b:move(item.b)});
    else if(item.kind==='symbol')items.push({...item,at:move(item.at)});
   }
   labels.forEach((s,i)=>items.push(text(s,x+pad,footerY+i*.13,font)));
   rowHeight=Math.max(rowHeight,height);x+=width+gap;
  }
  if(failed)continue;
  finish();
  if(pages.every(p=>(p.extents.maxX-p.extents.minX)/scale.ratio<=SHEET.area.w+1e-8&&(p.extents.maxY-p.extents.minY)/scale.ratio<=SHEET.area.h+1e-8))return pages;
 }
 throw new Error('A profile exceeds the supported sheet scale range.');
}

/** A-0 section-start callouts must name the actual continuation sheet. */
export function profilePlanReferences(items:DrawItem[],sheets:Sheet[]):DrawItem[]{
 const pages=new Map<string,string>();
 for(const page of sheets)for(const item of page.items)if(item.kind==='text'){const match=item.text.match(/^(\d+)\/A-2(?:\.\d+)? /);if(match)pages.set(match[1],page.id);}
 return items.map(item=>{if(item.kind!=='text')return item;const match=item.text.match(/^(\d+)\/A-2 section start$/),page=match&&pages.get(match[1]);return page?{...item,text:`${match![1]}/${page} section start`}:item;});
}
