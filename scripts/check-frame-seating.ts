import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {legacyBaseDeck} from './deck-legacy-scenarios';
import {buildDeckTakeoff,guardRuns} from '../src/features/deckcraft/deckTakeoff';
import {deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {getHouseConfig} from '../src/features/deckcraft/houseSettings';
import {getStairBoards} from '../src/features/deckcraft/stairBoards';
import {polygonCut,signedArea} from '../src/features/deckcraft/lib/polygonCuts';
import {RAILING_COSTS,type DeckData} from '../src/features/deckcraft/types';
let checks=0;
for(const stairType of ['Straight','Landing','Winder'] as const)for(const rows of [0,1,2] as const)for(const stairPosition of ['Front','Left','Right'] as const){
 const d={...structuredClone(DEFAULT_DECK),deckType:'Freestanding' as const,levels:1,height:72,stairFlights:1,stairPosition,stairType,pictureFrameRows:rows,pattern:'Straight' as const,railingType:'Aluminum' as const};const m=buildDeckTakeoff(d),level=m.levels[0],outline=(level.deckingFootprint??level.footprint).outline;
 for(const p of m.railing.posts.filter(p=>Math.abs(p.y-level.top)<.001)){const plate=[{x:p.x-2.5,y:p.z-2.5},{x:p.x+2.5,y:p.z-2.5},{x:p.x+2.5,y:p.z+2.5},{x:p.x-2.5,y:p.z+2.5}];assert(polygonCut([plate],[outline],true).reduce((n,p)=>n+Math.abs(signedArea(p)),0)<.001,'Whole deck post plate sits on finished decking');checks++;}
 const boards=getStairBoards(d,m);assert(boards.length);assert.equal(boards.some(b=>b.role==='border'),rows>0);checks++;
 for(const b of boards){assert(b.w<=m.stockLength+.001&&b.d<=d.boardWidth+.001,'Every trim and field piece respects stock dimensions');assert(b.polygon?.length);checks++;}
 for(let i=0;i<boards.length;i++)for(let j=i+1;j<boards.length;j++){const a=boards[i],b=boards[j];if(Math.abs(a.y-b.y)>.001)continue;assert(polygonCut([a.polygon!],[b.polygon!]).reduce((n,p)=>n+Math.abs(signedArea(p)),0)<.001,'Trim and field boards do not overlap');checks++;}
}
// Every shape, new designs: each deck post plate sits wholly on the finished boards, each level guard is drawn parallel
// to its priced edge line at the mounting inset (no skewed run and no extra post at an inside corner), and no drawn
// post-to-post span exceeds the railing's maximum. A design saved before the 2026-10 rules keeps the railing drawing it
// was quoted with: every guard drawn on its priced deck-edge line, and no separate guardLines in the model.
const near=(a:number,b:number,e=1e-6)=>Math.abs(a-b)<e;
// Custom outline points are in feet. A U has a run between two inside corners.
const U=[{x:0,y:0},{x:24,y:0},{x:24,y:16},{x:16,y:16},{x:16,y:8},{x:8,y:8},{x:8,y:16},{x:0,y:16}];
const shapes:[string,Partial<DeckData>][]=[
 ['rectangle',{}],['attached',{deckType:'Attached'}],['L-shape',{shape:'L-Shape',cutoutWidth:6,cutoutLength:4}],['multi-corner',{shape:'Multi-corner'}],['curved',{shape:'Curved'}],
 ['chamfered',{width:20,length:14,cornerChamfers:{frontLeftFt:4,frontRightFt:6}}],['custom U',{shape:'Custom',deckOutlines:{main:U}}],
 ['wrap-around',{deckType:'Attached',width:22,houseConfig:{...getHouseConfig({...structuredClone(DEFAULT_DECK),width:20}),widthFt:26,depthFt:22},wrap:{left:{widthFt:8,runFt:10}}}],
];
let shapeCases=0;
for(const [shape,patch] of shapes)for(const rows of [0,1] as const)for(const railingType of ['Aluminum','Glass Panels'] as const)for(const stairType of ['Straight','Landing'] as const)for(const buildRules of ['2026-10','legacy'] as const){
 if(buildRules==='legacy'&&rows)continue;
 const d=deckReleaseData({...structuredClone(DEFAULT_DECK),deckType:'Freestanding',levels:1,height:72,stairFlights:1,stairType,pictureFrameRows:rows,pattern:'Straight',railingType,buildRules,...patch}),m=buildDeckTakeoff(d),level=m.levels[0],outline=(level.deckingFootprint??level.footprint).outline,tag=`${shape} rows ${rows} ${railingType} ${stairType} ${buildRules}`;
 if(patch.deckOutlines)assert.equal(level.footprint.outline.length,U.length,tag+': the custom outline is built');const deckPosts=m.railing.posts.filter(p=>Math.abs(p.y-level.top)<.001);assert(deckPosts.length,`${tag}: the deck has guard posts`);
 assert.equal(m.railing.guardLines===undefined,buildRules==='legacy',`${tag}: guardLines are a 2026-10 model field only`);
 if(buildRules==='2026-10')for(const p of deckPosts){const plate=[{x:p.x-2.5,y:p.z-2.5},{x:p.x+2.5,y:p.z-2.5},{x:p.x+2.5,y:p.z+2.5},{x:p.x-2.5,y:p.z+2.5}];assert(polygonCut([plate],[outline],true).reduce((n,p)=>n+Math.abs(signedArea(p)),0)<.001,`${tag}: whole deck post plate sits on finished decking`);checks++;}
 const lines=guardRuns(m),drawn=m.railing.rails.filter((_,i)=>i%2===0),maxSpan=RAILING_COSTS[railingType].spacing*12;assert.equal(drawn.length,lines.length,`${tag}: one drawn run for each priced guard line`);
 for(const [i,g] of lines.entries()){
  const r={a:{...drawn[i].a,y:drawn[i].a.y-3},b:{...drawn[i].b,y:drawn[i].b.y-3}},len=Math.hypot(r.b.x-r.a.x,r.b.y-r.a.y,r.b.z-r.a.z);
  if(buildRules==='legacy'){assert(near(r.a.x,g.a.x)&&near(r.a.y,g.a.y)&&near(r.a.z,g.a.z)&&near(r.b.x,g.b.x)&&near(r.b.y,g.b.y)&&near(r.b.z,g.b.z),`${tag}: the guard is drawn on its priced line, as quoted`);checks++;}
  else if(near(g.a.y,level.top)&&near(g.b.y,level.top)){
   const gl=Math.hypot(g.b.x-g.a.x,g.b.z-g.a.z),ux=(g.b.x-g.a.x)/gl,uz=(g.b.z-g.a.z)/gl,off=(p:{x:number;z:number})=>(p.x-g.a.x)*uz-(p.z-g.a.z)*ux;
   assert(near(off(r.a),off(r.b),1e-6),`${tag}: the drawn guard runs parallel to its priced edge line`);
   assert(Math.abs(off(r.a))>.01&&Math.abs(off(r.a))<=3.6+.01,`${tag}: the drawn guard sits at the mounting inset, inside the priced edge line (${off(r.a).toFixed(2)} in)`);checks++;
  }
  // Posts along the drawn run: one at each end, and (new designs) no span longer than the railing's maximum.
  const t=(p:{x:number;y:number;z:number})=>((p.x-r.a.x)*(r.b.x-r.a.x)+(p.y-r.a.y)*(r.b.y-r.a.y)+(p.z-r.a.z)*(r.b.z-r.a.z))/(len*len);
  const on=m.railing.posts.filter(p=>{const k=t(p);return k>-1e-6&&k<1+1e-6&&Math.hypot(r.a.x+(r.b.x-r.a.x)*k-p.x,r.a.y+(r.b.y-r.a.y)*k-p.y,r.a.z+(r.b.z-r.a.z)*k-p.z)<.01;}).map(t).sort((a,b)=>a-b);
  assert(on.length>=2&&near(on[0],0)&&near(on.at(-1)!,1),`${tag}: a post at each end of every drawn run`);checks++;
  if(buildRules==='2026-10')for(let k=1;k<on.length;k++){assert((on[k]-on[k-1])*len<=maxSpan+1e-6,`${tag}: no drawn span exceeds the maximum (${((on[k]-on[k-1])*len).toFixed(2)} in)`);checks++;}
 }
 shapeCases++;
}
// A stair beside a deck corner or the house (new designs): a guard stub shorter than one post plate between the corner
// and the stair folds onto the corner post, the stair top joins it, and a stair top with no guard post to join seats on
// the boards. So every deck post plate, stair tops included, sits on the finished decking and no two plates overlap.
const plateOff=(p:{x:number;z:number},outline:{x:number;y:number}[])=>polygonCut([[{x:p.x-2.5,y:p.z-2.5},{x:p.x+2.5,y:p.z-2.5},{x:p.x+2.5,y:p.z+2.5},{x:p.x-2.5,y:p.z+2.5}]],[outline],true).reduce((n,p)=>n+Math.abs(signedArea(p)),0);
let cornerCases=0;
// A stub left between two disabled sections, both its ends within a plate of a corner, stops at that corner's post;
// one shorter than a plate in the middle of an edge is one post.
const stub=(a:number,b:number)=>({railSections:[{id:'s1',level:1 as const,edgeId:'edge:192,0:192,144',startPct:0,endPct:a,enabled:false},{id:'s2',level:1 as const,edgeId:'edge:192,0:192,144',startPct:b,endPct:100,enabled:false}]});
for(const deckType of ['Attached','Freestanding'] as const)for(const stairPosition of ['Front','Left','Right'] as const)for(const rows of [0,1] as const)for(const [stairOffset,sections] of [0,1,2,3,4,96,97,98,99,100].map(n=>[n,{}] as const).concat([[50,stub(1,3)],[50,stub(.5,2)],[50,stub(40,42)]])){
 const d=deckReleaseData({...structuredClone(DEFAULT_DECK),deckType,stairPosition,stairOffset,stairFlights:1,pictureFrameRows:rows,railingType:'Aluminum',...sections}),m=buildDeckTakeoff(d),level=m.levels[0],outline=(level.deckingFootprint??level.footprint).outline,tag=`stair ${deckType} ${stairPosition} ${stairOffset}% rows ${rows}${'railSections' in sections?' with a short stub':''}`;
 const deckPosts=m.railing.posts.filter(p=>Math.abs(p.y-level.top)<.001);assert(deckPosts.length>2,`${tag}: the deck has guard posts`);
 for(const p of deckPosts){assert(plateOff(p,outline)<.001,`${tag}: whole deck post plate sits on finished decking (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`);checks++;}
 for(const [i,p] of deckPosts.entries())for(const q of deckPosts.slice(i+1)){assert(!(Math.abs(p.x-q.x)<5-1e-6&&Math.abs(p.z-q.z)<5-1e-6),`${tag}: no two deck post plates overlap (${p.x.toFixed(2)}, ${p.z.toFixed(2)} and ${q.x.toFixed(2)}, ${q.z.toFixed(2)})`);checks++;}
 cornerCases++;
}
// A design saved before the 2026-10 rules keeps the railing and the price it was quoted with, including where two posts
// would seat onto one point of the boards under the new rules (a narrow tab, a stub left by a disabled section, a stair
// top a hair off the deck end post). Post counts, totals and the whole railing model (sha256 of its JSON: posts, rails,
// balusters, glass, cable) are 9b2ee11's, recorded by running these fixtures there.
const tab=[{x:0,y:0},{x:16,y:0},{x:16,y:12},{x:8.5,y:12},{x:8.5,y:12.5},{x:8,y:12.5},{x:8,y:12},{x:0,y:12}];
const legacyFixtures:[string,Partial<DeckData>,number,number,string][]=[
 ['6 in custom tab',{deckType:'Freestanding',length:12.5,shape:'Custom',stairFlights:0,stairPosition:'Right',deckOutlines:{main:tab},projectKind:'deck'},14,39625.177,'dc8033e361dfcaa9'],
 ['edge section disabled 1-99%',{deckType:'Freestanding',railSections:[{id:'s1',level:1,edgeId:'edge:192,0:192,144',startPct:1,endPct:99,enabled:false}],projectKind:'deck'},13,31704.452,'6d91627acd4bc0de'],
 ['15.5 ft wide, stair at 22.5%',{deckType:'Freestanding',width:15.5,stairOffset:22.5,projectKind:'deck'},14,33667.995,'235be723f652f4a2'],
 ['framed landing stair, cable',{pictureFrameRows:1,stairType:'Landing',railingType:'Cable',projectKind:'deck'},22,59214.353,'3c9f5638a9a3f2b8'],
 ['wood picket, 2 levels',{levels:2,railingType:'Wood Picket',projectKind:'deck'},20,48907.257,'fb2c21e29e5d5945'],
];
for(const [name,patch,posts,total,railing] of legacyFixtures){
 const d={...legacyBaseDeck(),...patch} as DeckData,m=buildDeckTakeoff(d);
 assert.equal(d.buildRules,undefined,`legacy ${name}: an old save has no build rules`);
 assert.equal(m.quantities.railingPosts,posts,`legacy ${name}: keeps 9b2ee11's ${posts} posts`);
 assert(Math.abs(calculateEstimate(d,DECK_SETTINGS).total-total)<.001,`legacy ${name}: keeps 9b2ee11's total $${total}`);
 assert.equal(createHash('sha256').update(JSON.stringify(m.railing)).digest('hex').slice(0,16),railing,`legacy ${name}: draws 9b2ee11's railing exactly`);checks++;
 // The same design under the 2026-10 rules seats its posts on the boards: the fixture really exercises the gate.
 assert.notEqual(createHash('sha256').update(JSON.stringify(buildDeckTakeoff({...d,buildRules:'2026-10'}).railing)).digest('hex').slice(0,16),railing,`legacy ${name}: the new rules draw this railing differently`);checks++;
}
console.log('Picture frame and railing seating: '+checks+' checks passed ('+shapeCases+' shape designs, '+cornerCases+' stairs beside a corner, '+legacyFixtures.length+' legacy fixtures)');
