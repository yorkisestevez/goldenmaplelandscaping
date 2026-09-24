import type {HouseCladding,HouseOpening} from '../../types';
import type {Box} from '../../deckTakeoff';

/**
 * The pieces laid over a house wall for its cladding, in the facade frame: local x along the wall (−span/2 to
 * span/2), y up from grade, +z out from the wall face. Openings and stretches hidden inside another house block
 * are left clear. Pure, with no three.js, so the check can hold it to its golden.
 *
 * The six original claddings (Brick, Siding, Stone, Stucco, Board & batten, Vertical siding) run the studio's
 * original loops, moved here verbatim from HouseFacade.tsx: scripts/deck-house-finishes-golden.json holds their
 * output from before the move. The newer claddings are generic types, not manufacturer products.
 */
export type OpeningShape=HouseOpening&{x:number;y:number;w:number;h:number};

/** Above this many pieces on one wall a newer cladding is drawn as a plain wall instead (the editor says so). */
export const SKIN_PIECE_CAP=20000;

/** Course height on gable triangles by cladding; none for stucco and vertical boards. */
export const GABLE_COURSE:Record<HouseCladding,number>={Brick:2.625,Siding:7,Stone:8,Stucco:0,'Board & batten':0,'Vertical siding':0,
  'Fibre-cement lap':7,'Cedar shakes':7,Ledgestone:3,Fieldstone:9,'Norman brick':8/3,'Roman brick':2,'Horizontal metal':12};

/** Openings as the facade places them: centre x along the wall, centre y above grade. */
export const openingShapes=(span:number,openings:HouseOpening[]):OpeningShape[]=>openings.map(o=>({...o,x:-span/2+span*o.offsetPct/100,y:o.bottomIn+o.heightIn/2,w:o.widthIn,h:o.heightIn}));

// ---- The original claddings (verbatim) ----

/** Removes [l, r] stretches from a list of [a, b] stretches. */
const cut=(spans:[number,number][],l:number,r:number):[number,number][]=>spans.flatMap(([a,b])=>(r<=a||l>=b?[[a,b]]:[...(l>a?[[a,l]]:[]),...(r<b?[[r,b]]:[])]) as [number,number][]);
/** Deterministic 0..1 noise so stone courses look the same on every render. */
const noise=(i:number,j:number)=>Math.abs(Math.sin(i*127.1+j*311.7)*43758.5453)%1;

/**
 * Procedural cladding for the studio's second group of finishes (brick and lap siding keep their own code below):
 * - Stone: courses of 5–9 in with stones 9–22 in long, laid over a darker mortar wall.
 * - Stucco: a plain wall in the cladding colour (nothing added).
 * - Board & batten: 2½ in battens every 16 in over the wall.
 * - Vertical siding: 5⅝ in boards on a 6 in module with a shadow groove between them.
 * Openings and stretches hidden inside another house block are left clear.
 */
function claddingSkin(cladding:HouseCladding,span:number,height:number,shapes:OpeningShape[],hidden:[number,number][]):Box[]{
 const boxes:Box[]=[];
 if(cladding==='Stone'){
  let row=0;
  for(let bottom=0;bottom<height;row++){
   const course=5+Math.round(noise(row,1)*4),h=Math.min(course-.4,height-bottom),y=bottom+h/2;
   let segments:[number,number][]=[[-span/2,span/2]];for(const [l,r] of hidden)segments=cut(segments,l,r);
   for(const o of shapes)if(bottom+h>o.y-o.h/2&&bottom<o.y+o.h/2)segments=cut(segments,o.x-o.w/2,o.x+o.w/2);
   for(const [a,b] of segments){let x=a,i=0;while(x<b-.5){const len=Math.min(b-x,9+noise(row,i++)*13);boxes.push({x:x+len/2,y,z:.5,w:Math.max(.5,len-.4),h,d:1});x+=len;}}
   bottom+=course;
  }
  return boxes;
 }
 const [pitch,width,z,d]=cladding==='Board & batten'?[16,2.5,.6,1.2]:cladding==='Vertical siding'?[6,5.625,.3,.6]:[0,0,0,0];
 if(!pitch)return boxes;
 for(let x=-span/2+pitch/2;x<span/2;x+=pitch){
  if(hidden.some(([l,r])=>x>l&&x<r))continue;
  let runs:[number,number][]=[[0,height]];
  for(const o of shapes)if(x+width/2>o.x-o.w/2&&x-width/2<o.x+o.w/2)runs=cut(runs,o.y-o.h/2,o.y+o.h/2);
  for(const [lo,hi] of runs)if(hi-lo>.5)boxes.push({x,y:(lo+hi)/2,z,w:width,h:hi-lo,d});
 }
 return boxes;
}

/** Brick (2⅝ in courses of 8 in bricks in running bond) and lap siding (7 in courses), the studio's first two claddings. */
function coursedSkin(brick:boolean,span:number,height:number,shapes:OpeningShape[],hidden:[number,number][]):Box[]{
 const boxes:Box[]=[],pitch=brick?2.625:7,partH=brick?2.25:6.8;let row=0;for(let bottom=0;bottom<height;bottom+=pitch,row++){
   const h=Math.min(partH,height-bottom),y=bottom+h/2;let segments:[number,number][]=[[-span/2,span/2]];
   for(const [l,r] of hidden)segments=segments.flatMap(([a,b])=>r<=a||l>=b?[[a,b]]:[...(l>a?[[a,l]]:[]),...(r<b?[[r,b]]:[])] as [number,number][]);
   for(const o of shapes)if(bottom+h>o.y-o.h/2&&bottom<o.y+o.h/2)segments=segments.flatMap(([a,b])=>o.x+o.w/2<=a||o.x-o.w/2>=b?[[a,b]]:[...(o.x-o.w/2>a?[[a,o.x-o.w/2]]:[]),...(o.x+o.w/2<b?[[o.x+o.w/2,b]]:[])] as [number,number][]);
   for(const [a,b] of segments){if(!brick){if(b>a)boxes.push({x:(a+b)/2,y,z:.3,w:b-a,h,d:.6});continue;}
     const start=-span/2-(row%2)*4;for(let x=start+Math.floor((a-start)/8)*8;x<b;x+=8){const lo=Math.max(a,x+.1875),hi=Math.min(b,x+7.8125);if(hi>lo)boxes.push({x:(lo+hi)/2,y,z:.38,w:hi-lo,h,d:.76});}
   }
  }return boxes;
}

// ---- The newer claddings ----

/** The stretches of the wall outside other house blocks, where courses are laid. */
function wallSegments(span:number,hidden:[number,number][]){
 let segments:[number,number][]=[[-span/2,span/2]];
 for(const [l,r] of hidden)segments=cut(segments,l,r);
 return segments;
}
/**
 * Pieces cut round the openings, as a mason or a siding crew does: a piece an opening crosses keeps the parts
 * beside, above and below it (so no course is left bare over a door or window), and slivers under ¼ in are dropped.
 */
function cutRound(pieces:Box[],shapes:OpeningShape[]):Box[]{
 let out=pieces;
 for(const o of shapes){
  const l=o.x-o.w/2,r=o.x+o.w/2,lo=o.y-o.h/2,hi=o.y+o.h/2,next:Box[]=[];
  for(const b of out){
   const x0=b.x-b.w/2,x1=b.x+b.w/2,y0=b.y-b.h/2,y1=b.y+b.h/2;
   if(x1<=l||x0>=r||y1<=lo||y0>=hi){next.push(b);continue;}
   const part=(a:number,z:number,p:number,q:number)=>{if(z-a>=.25&&q-p>=.25)next.push({...b,x:(a+z)/2,w:z-a,y:(p+q)/2,h:q-p});};
   part(x0,Math.min(x1,l),y0,y1);part(Math.max(x0,r),x1,y0,y1);
   part(Math.max(x0,l),Math.min(x1,r),y0,Math.min(y1,lo));part(Math.max(x0,l),Math.min(x1,r),Math.max(y0,hi),y1);
  }
  out=next;
 }
 return out;
}
/** Courses stacked from grade; each course's top is capped at the wall height, and a sliver under ½ in at the top
 * of the wall is left bare (the trim covers it). */
function eachCourse(height:number,course:(row:number)=>number,lay:(row:number,bottom:number,top:number)=>void){
 for(let row=0,bottom=0;bottom<height-.5;row++){const c=course(row);lay(row,bottom,Math.min(bottom+c,height));bottom+=c;}
}
/** Horizontal boards or panels of a fixed length, their butt joints staggered course to course. */
function lapBoards(span:number,height:number,shapes:OpeningShape[],hidden:[number,number][],{course,face,length,joint,z,d}:{course:number;face:number;length:number;joint:number;z:number;d:number}):Box[]{
 const boxes:Box[]=[];
 eachCourse(height,()=>course,(row,bottom,top)=>{
  const h=Math.min(face,top-bottom),y=bottom+h/2,start=-span/2-noise(row,7)*length;
  for(const [a,b] of wallSegments(span,hidden))for(let x=start+Math.floor((a-start)/length)*length;x<b;x+=length){const lo=Math.max(a,x+joint/2),hi=Math.min(b,x+length-joint/2);if(hi-lo>.25)boxes.push({x:(lo+hi)/2,y,z,w:hi-lo,h,d});}
 });
 return cutRound(boxes,shapes);
}
/** Bricks of any size in running bond (half-lap), with the joint as the gap between them. */
function brickBond(span:number,height:number,shapes:OpeningShape[],hidden:[number,number][],{course,brick,length,joint}:{course:number;brick:number;length:number;joint:number}):Box[]{
 const boxes:Box[]=[],module=length+joint;
 eachCourse(height,()=>course,(row,bottom,top)=>{
  const h=Math.min(brick,top-bottom),y=bottom+h/2,start=-span/2-(row%2)*module/2;
  for(const [a,b] of wallSegments(span,hidden))for(let x=start+Math.floor((a-start)/module)*module;x<b;x+=module){const lo=Math.max(a,x+joint/2),hi=Math.min(b,x+module-joint/2);if(hi>lo)boxes.push({x:(lo+hi)/2,y,z:.38,w:hi-lo,h,d:.76});}
 });
 return cutRound(boxes,shapes);
}
/** Pieces of random length along each course (stones, shakes): [min, min + spread] long, `gap` apart. */
function randomRuns(span:number,height:number,shapes:OpeningShape[],hidden:[number,number][],{course,min,spread,gap,piece}:{course:(row:number)=>number;min:number;spread:number;gap:number;piece:(row:number,i:number,bottom:number,top:number,x:number,w:number)=>Box}):Box[]{
 const boxes:Box[]=[];
 eachCourse(height,course,(row,bottom,top)=>{
  for(const [a,b] of wallSegments(span,hidden)){let x=a,i=0;while(x<b-.5){const len=Math.min(b-x,min+noise(row*3+1,i)*spread);if(len-gap>.3)boxes.push(piece(row,i,bottom,top,x+len/2,len-gap));x+=len;i++;}}
 });
 return cutRound(boxes,shapes);
}

const NEWER:Partial<Record<HouseCladding,(span:number,height:number,shapes:OpeningShape[],hidden:[number,number][])=>Box[]>>={
 // 8¼ in fibre-cement planks at 7 in exposure, 12 ft long, with a thicker butt edge than vinyl siding.
 'Fibre-cement lap':(s,h,o,hd)=>lapBoards(s,h,o,hd,{course:7,face:6.85,length:144,joint:.25,z:.45,d:.9}),
 // 12 in horizontal metal panels, 20 ft long, over a darker reveal channel.
 'Horizontal metal':(s,h,o,hd)=>lapBoards(s,h,o,hd,{course:12,face:11.25,length:240,joint:.5,z:.35,d:.7}),
 // Norman brick: 11⅝ × 2¼ in faces, three courses to 8 in.
 'Norman brick':(s,h,o,hd)=>brickBond(s,h,o,hd,{course:8/3,brick:2.25,length:11.625,joint:.375}),
 // Roman brick: long and thin, 11⅝ × 1⅝ in faces on 2 in courses.
 'Roman brick':(s,h,o,hd)=>brickBond(s,h,o,hd,{course:2,brick:1.625,length:11.625,joint:.375}),
 // Cedar shakes at 7 in exposure, 3½–10 in wide, butts a little uneven, each standing slightly proud of its neighbours.
 'Cedar shakes':(s,h,o,hd)=>randomRuns(s,h,o,hd,{course:()=>7,min:3.5,spread:6.5,gap:.25,piece:(row,i,bottom,top,x,w)=>{const hh=Math.max(.3,Math.min(6.9-noise(i,row+11)*.5,top-bottom));return {x,y:bottom+hh/2,z:.4+noise(row,i+5)*.25,w,h:hh,d:.8};}}),
 // Ledgestone: thin stacked strips 1½–4 in high and 8–30 in long, dry-laid, their faces at varying depths.
 Ledgestone:(s,h,o,hd)=>randomRuns(s,h,o,hd,{course:row=>1.5+Math.round(noise(row,3)*10)/4,min:8,spread:22,gap:.15,piece:(row,i,bottom,top,x,w)=>{const hh=Math.max(.3,top-bottom-.12);return {x,y:bottom+hh/2,z:.6+noise(row+17,i)*.8,w,h:hh,d:1.2};}}),
 // Fieldstone: irregular stones in 7–12 in courses, each smaller than its course and set off-centre in a wide mortar bed.
 Fieldstone:(s,h,o,hd)=>randomRuns(s,h,o,hd,{course:row=>7+Math.round(noise(row,9)*5),min:9,spread:11,gap:.75,piece:(row,i,bottom,top,x,w)=>{const room=top-bottom,hh=Math.max(.3,Math.min(room-.6,room*(.72+noise(i,row+23)*.2))),lift=(room-hh)*noise(row+5,i+2);return {x,y:bottom+lift+hh/2,z:.7+noise(row,i+13)*.5,w,h:hh,d:1.4};}}),
};

/**
 * The cladding pieces on one wall. A newer cladding past SKIN_PIECE_CAP pieces comes back `simplified` with no
 * pieces, and the wall is drawn plain; the six original claddings are never capped, so they draw as they always have.
 */
export function wallSkin(cladding:HouseCladding,span:number,height:number,shapes:OpeningShape[],hidden:[number,number][]):{pieces:Box[];simplified:boolean}{
 if(cladding==='Brick'||cladding==='Siding')return {pieces:coursedSkin(cladding==='Brick',span,height,shapes,hidden),simplified:false};
 const make=NEWER[cladding];
 if(!make)return {pieces:claddingSkin(cladding,span,height,shapes,hidden),simplified:false};
 const pieces=make(span,height,shapes,hidden);
 return pieces.length>SKIN_PIECE_CAP?{pieces:[],simplified:true}:{pieces,simplified:false};
}
