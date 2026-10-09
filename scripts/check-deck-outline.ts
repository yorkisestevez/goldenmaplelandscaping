import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {calculateDeckReleaseEstimate,deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {buildDeckTakeoff} from '../src/features/deckcraft/deckTakeoff';
import {getHouseContact} from '../src/features/deckcraft/houseContact';
import {memberLength,unsupportedJoistEnds} from '../src/features/deckcraft/constructionDetails';
import {parseDesign,serializeDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {decodeDesignLink,designLinkFromHash,encodeDesignLink} from '../src/features/deckcraft/designLink';
import {describeDesign,shapeWords} from '../src/features/deckcraft/designFacts';
import {designFeatures} from '../src/features/deckcraft/deckAnalytics';
import {getFootprint} from '../src/features/deckcraft/lib/deckGeometry';
import {isChamferEdgeId} from '../src/features/deckcraft/lib/cornerChamfers';
import {edgeNameOf} from '../src/features/deckcraft/lib/wrapGeometry';
import {activeCustomFront,customLabourFactor,customOutline,customShapeWords,frontFromOutline,normalizeFront,outlineFeatures,outlineProblems,type OutlinePoint} from '../src/features/deckcraft/lib/customOutline';
import {addStep,angleCorner,frontEdges,moveEdge,OUTLINE_PRESETS,outlinePreset,removeStep,squareCorner} from '../src/features/deckcraft/lib/outlineEdits';
import {chooseShape} from '../src/features/deckcraft/designer/deckShapeActions';
import type {DeckData} from '../src/features/deckcraft/types';
import {designerSource} from './deck-designer-source';

/**
 * Custom outlines (shape 'Custom'): a straight back along the house and a front of square and 45° edges on a
 * 6 in grid. The rules refuse anything else; every preset and a wide spread of drawn outlines frame with no
 * loose joist end or oversize member; each existing shape drawn as an outline prices exactly as it does now;
 * the editor's moves never leave the rules; and the outline is saved, shared, described and priced.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};
const read=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const base=():DeckData=>structuredClone(DEFAULT_DECK);
const custom=(front:OutlinePoint[],patch:Partial<DeckData>={}):DeckData=>deckReleaseData({...base(),...patch,shape:'Custom',customFront:front});
const pt=(x:number,y:number)=>({x,y});
const T=[pt(20,8),pt(15,8),pt(15,14),pt(5,14),pt(5,8),pt(0,8)];

// 1. The rules: a clean front passes; anything else is refused in plain words.
{
  ok(outlineProblems(T).length===0&&outlineProblems([pt(16,12),pt(0,12)]).length===0,'A T-shape and a rectangle follow the rules');
  const refused:[unknown,RegExp,string][]=[
    [undefined,/at least two points/,'nothing'],[[pt(10,10)],/at least two points/,'one point'],[{x:1},/at least two points/,'not a list'],
    [[pt(10,'x' as unknown as number),pt(0,10)],/needs a number/,'a text coordinate'],[[pt(10,Infinity),pt(0,10)],/needs a number/,'an infinite coordinate'],
    [[pt(10.25,10),pt(0,10)],/6 in grid/,'off the grid'],[[pt(70,10),pt(0,10)],/4 to 60 ft wide/,'too wide'],[[pt(3,10),pt(0,10)],/4 to 60 ft wide/,'too narrow'],
    [[pt(10,10),pt(2,10)],/ends on the left side/,'not reaching the left side'],[[pt(10,2),pt(0,2)],/3 to 40 ft out/,'too shallow'],[[pt(10,45),pt(0,45)],/3 to 40 ft out/,'too deep'],
    [[pt(10,10),pt(4,10),pt(6,12),pt(0,12)],/back toward the right/,'turning back to the right'],[[pt(10,10),pt(5,12),pt(0,12)],/neither square nor at 45°/,'an odd angle'],
    [[pt(10,10),pt(9,10),pt(9,12),pt(0,12)],/shorter than 2 ft across/,'a short edge'],[[pt(10,10),pt(5,10),pt(5,10.5),pt(0,10.5)],/Step \d is shorter than 1 ft/,'a short step'],
    [[pt(10,3),pt(0,3)],/at least 4 ft out/,'nowhere 4 ft deep'],[Array.from({length:30},(_,i)=>pt(60-i*2,i%2?6:8)),/up to 24 front points|neither square/,'too many points'],
  ];
  for(const [front,why,what] of refused){const p=outlineProblems(front);ok(p.some(s=>why.test(s)),`${what} is refused (${p.join(' | ')||'accepted'})`);}
  // Points in a line, repeats and zero-area spikes are tidied away, never added to.
  ok(JSON.stringify(normalizeFront([pt(20,8),pt(20,8),pt(17,8),pt(15,8),pt(15,14),pt(5,14),pt(5,8),pt(0,8)]))===JSON.stringify(T),'Repeats and points in a line are dropped');
  ok(JSON.stringify(normalizeFront([pt(10,12),pt(10,9),pt(0,9)]))===JSON.stringify([pt(10,9),pt(0,9)]),'A spike up the right side is dropped');
  ok(JSON.stringify(normalizeFront([pt(10,9),pt(6,9),pt(6,12),pt(6,10),pt(0,10)]))===JSON.stringify([pt(10,9),pt(6,9),pt(6,10),pt(0,10)]),'A spike in a step is dropped');
}

// 2. The design: saved, reopened and shared exactly; it sets the width and depth and is one level; a stored
// outline on another shape is kept but not built.
{
  const d=custom(T,{levels:2,width:40,length:40});
  ok(d.width===20&&d.length===14&&d.levels===1,'A custom outline sets the width and depth and is one level');
  const saved=parseDesign(serializeDesign(d));
  ok(saved.shape==='Custom'&&JSON.stringify(saved.customFront)===JSON.stringify(T)&&saved.width===20&&saved.length===14,'Save and reopen keep the outline');
  ok((()=>{try{validateDesign({...d,customFront:[pt(10,10),pt(5,12),pt(0,12)]});return false;}catch(e){return /Invalid custom outline: Front edge 1 is neither square nor at 45°/.test(String(e));}})(),'A broken outline is refused on load, with the reason');
  const off=deckReleaseData({...d,shape:'Rectangle',width:16,length:12});
  ok(off.customFront&&activeCustomFront(off)===null&&getFootprint(off,1).outline.length===4&&JSON.stringify(calculateDeckReleaseEstimate(off).sections)===JSON.stringify(calculateDeckReleaseEstimate({...base(),width:16,length:12}).sections),'An outline stored on another shape is kept but not built');
  ok(activeCustomFront({shape:'Custom',width:18,length:10})?.length===2,'A custom deck with no outline is its width × depth rectangle');
  const link=await encodeDesignLink(d,'https://example.test'),opened=await decodeDesignLink(designLinkFromHash(new URL(link).hash)!);
  ok(JSON.stringify(opened.customFront)===JSON.stringify(T)&&opened.shape==='Custom'&&calculateDeckReleaseEstimate(opened).total===calculateDeckReleaseEstimate(d).total,'A share link reopens the outline at the same price');
}

// 3. The footprint: straight back, every edge named, 45° edges share the angled-corner id rules.
{
  const bay=outlinePreset('bay',24,16)!,fp=getFootprint(custom(bay),1);
  ok(fp.outline[0].x===0&&fp.outline[0].y===0&&fp.outline[1].y===0&&fp.outline[1].x===24*12,'The back runs straight along the house, the full width');
  ok(fp.edgeIds?.length===fp.outline.length&&fp.edgeIds[0]==='custom-back'&&fp.edgeIds.at(-1)==='custom-left','Every edge is named');
  ok(fp.edgeIds!.filter(isChamferEdgeId).join()==='custom-angled-1,custom-angled-2','A custom 45° edge is an angled edge (framing, hangers, one-flight stairs)');
  ok(edgeNameOf('custom-angled-2')==='45° edge 2'&&edgeNameOf('custom-step-1')==='Step 1'&&edgeNameOf('custom-front-3')==='Front edge 3'&&edgeNameOf('custom-right')==='Right side','Custom edges read plainly');
  ok(JSON.stringify(customOutline(T,1).edgeIds)==='["custom-back","custom-right","custom-front-1","custom-step-1","custom-front-2","custom-step-2","custom-front-3","custom-left"]','A T-shape names its front edges and steps in order');
}

// 4. Framing: every preset, at several sizes, heights, both attachments and every pattern, bears every joist.
{
  let designs=0;
  for(const p of OUTLINE_PRESETS)for(const [w,l] of [[16,12],[24,16],[36,20]])for(const height of [12,48])for(const deckType of ['Attached','Freestanding'] as const)for(const pattern of ['Straight','Diagonal','Picture Frame','Herringbone'] as const){
    const front=outlinePreset(p.id,w,l);ok(front,`${p.id} fits a ${w} × ${l} ft deck`);if(!front)continue;
    const d=custom(front,{height,deckType,pattern,pictureFrameRows:pattern==='Picture Frame'?1:0}),tag=`${p.id} ${w}x${l}@${height} ${deckType} ${pattern}`;
    const e=calculateDeckReleaseEstimate(d),m=e.model,main=m.levels[0];
    ok(unsupportedJoistEnds(main,getHouseContact(d,main.footprint)).length===0,`${tag}: every joist end bears on a ledger or beam`);
    ok([...main.joists,...main.beams].every(mm=>memberLength(mm)<=192.01)&&[...main.joists,...main.beams,...main.blocking].every(mm=>memberLength(mm)>=.05),`${tag}: no member over 16 ft or of no length`);
    ok(!m.issues.some(i=>i.includes('ripped narrower')),`${tag}: no thin decking rip`);
    ok(Number.isFinite(e.total)&&e.total>0&&Math.abs(m.quantities.area-Math.abs(customOutline(front,1).outline.reduce((a,q,i,o)=>a+q.x*o[(i+1)%o.length].y-o[(i+1)%o.length].x*q.y,0))/2)<.5,`${tag}: priced, on the outline's own area`);
    designs++;
  }
  ok(designs===OUTLINE_PRESETS.length*3*2*2*4,`${designs} preset designs framed`);
  // Outlines drawn freely: steps, V-notches, 45° steps and inside 45° corners.
  const drawn=[[pt(30,12),pt(27,15),pt(27,12),pt(14,12),pt(11,15),pt(4,15),pt(4,13),pt(0,13)],[pt(16,12),pt(9,12),pt(6,9),pt(6,11),pt(0,11)],[pt(20,6),pt(17,9),pt(12,9),pt(12,14),pt(6,14),pt(3,11),pt(0,11)],[pt(24,10),pt(20,10),pt(16,14),pt(12,10),pt(8,14),pt(4,10),pt(0,10)]];
  for(const front of drawn){ok(outlineProblems(front).length===0,`${JSON.stringify(front)} follows the rules`);
    for(const deckType of ['Attached','Freestanding'] as const){const d=custom(front,{deckType,height:36}),m=buildDeckTakeoff(d),main=m.levels[0];
      ok(unsupportedJoistEnds(main,getHouseContact(d,main.footprint)).length===0&&[...main.joists,...main.beams,...main.blocking].every(mm=>memberLength(mm)>=.05&&memberLength(mm)<=192.01),`${JSON.stringify(front)} ${deckType}: framing bears and fits`);}}
  const strips=buildDeckTakeoff(custom(T)).issues;
  ok(strips.some(i=>/^Custom outline: the deck is framed in 3 strips/.test(i)),'A stepped outline notes its framing strips for review');
  ok(buildDeckTakeoff(custom(outlinePreset('bay',24,16)!)).issues.some(i=>i.startsWith('45° edges: ')&&i.includes('Have the angled framing reviewed')),'45° edges are noted for review in their own words');
}

// 5. Every existing shape drawn as a custom outline builds and prices exactly as it does now.
for(const [name,patch] of [['rectangle',{}],['L-shape',{shape:'L-Shape',cutoutWidth:6,cutoutLength:4}],['multi-corner',{shape:'Multi-corner',cutoutWidth:6,cutoutLength:4,cutoutWidth2:4,cutoutLength2:3}],['one angled corner',{cornerChamfers:{frontRightFt:4}}],['two angled corners',{cornerChamfers:{frontLeftFt:4,frontRightFt:3}}]] as [string,Partial<DeckData>][])
  for(const pattern of ['Straight','Diagonal','Herringbone','Picture Frame'] as const){
    const d=deckReleaseData({...base(),width:20,length:14,...patch,pattern,pictureFrameRows:pattern==='Picture Frame'?1:0}),front=frontFromOutline(getFootprint(d,1).outline);
    ok(front,`${name}: traced as an outline`);
    const drawnAs=deckReleaseData({...d,shape:'Custom',customFront:front!,cornerChamfers:undefined}),a=calculateDeckReleaseEstimate(d),b=calculateDeckReleaseEstimate(drawnAs);
    ok(a.total===b.total&&a.model.quantities.area===b.model.quantities.area,`${name}, ${pattern}: the same price drawn as an outline (${a.total.toFixed(2)} / ${b.total.toFixed(2)})`);
  }

// 6. Labour reuses the existing shape factors by how much fitting the outline takes.
{
  const cases:[OutlinePoint[],number,number,string][]=[[[pt(16,12),pt(0,12)],0,1,'rectangle'],[outlinePreset('l-right',18,12)!,1,1.10,'L'],[outlinePreset('angled',18,12)!,2,1.25,'two 45° corners'],[T,2,1.25,'T'],[outlinePreset('u',18,12)!,2,1.25,'U'],[outlinePreset('bay',24,16)!,4,1.50,'bay (two inside corners and two 45° edges)'],[[pt(24,10),pt(20,10),pt(16,14),pt(12,10),pt(8,14),pt(4,10),pt(0,10)],7,1.50,'zig-zag']];
  for(const [front,features,factor,name] of cases)ok(outlineFeatures(front)===features&&customLabourFactor(front)===factor,`${name}: ${features} feature(s), labour ×${factor} (got ${outlineFeatures(front)}, ×${customLabourFactor(front)})`);
  ok(customLabourFactor(null)===1,'Not a custom outline: no factor');
}

// 7. The editor's moves: each keeps to the rules, or is refused and changes nothing.
{
  // Edges: 0 right side, 1 front, 2 step, 3 bump-out front, 4 step, 5 front, 6 left side.
  const out=moveEdge(T,3,.5)!;ok(out&&out[2].y===14.5&&out[3].y===14.5&&out[1].y===8,'Moving the bump-out front out 6 in moves only that edge');
  ok(moveEdge(T,0,2)?.[0].x===22&&moveEdge(T,0,2)?.[1].x===15,'Moving the right side widens the deck');
  ok(moveEdge(T,T.length,1)===null,'The left side stays on the house corner');
  ok(moveEdge(T,2,6)===null,'A step moved past the right side is refused');
  ok(moveEdge(T,1,-6)===null,'A move that pulls the deck under 3 ft out is refused');
  ok(moveEdge(T,2,4.5)===null,'A move that leaves a front edge under 2 ft is refused');
  const stepped=addStep([pt(16,12),pt(0,12)],1)!;ok(stepped&&stepped.length===4&&outlineProblems(stepped).length===0&&Math.abs(stepped[1].x-8)<1e-9,'Adding a step splits an across edge at its middle');
  const cut=angleCorner(T,0)!;ok(cut&&cut[0].x===20&&cut[0].y===6&&cut[1].x===18&&cut[1].y===8,'Angling the front-right corner cuts it at 45°, 2 ft each way');
  const inside=angleCorner(T,1)!;ok(inside&&outlineProblems(inside).length===0&&inside.length===T.length+1,'An inside corner can be angled too');
  ok(JSON.stringify(squareCorner(cut,1))===JSON.stringify(T),'Squaring the corner puts it back');
  ok(JSON.stringify(removeStep(T,2))==='[{"x":20,"y":8},{"x":0,"y":8}]'&&removeStep(T,3)===null,'Removing a step fills it in; an across edge is not a step');
  ok(frontEdges(T).length===T.length+1&&frontEdges(T)[0].kind==='side'&&frontEdges(T).at(-1)!.kind==='side','The editor lists both sides and every front edge');
  // Random edits on every preset never leave the rules.
  let seed=11;const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;};
  let tried=0,kept=0;
  for(const p of OUTLINE_PRESETS){let front=outlinePreset(p.id,24,16)!;
    for(let i=0;i<60;i++){const e=Math.floor(rnd()*front.length),k=rnd();tried++;
      const next=k<.5?moveEdge(front,e,(rnd()<.5?-1:1)*(rnd()<.5?.5:1)):k<.65?addStep(front,e):k<.8?angleCorner(front,Math.min(e,front.length-1)):k<.9?squareCorner(front,e):removeStep(front,e);
      if(next){ok(outlineProblems(next).length===0,`${p.id}: edit ${i} keeps to the rules`);front=next;kept++;}}}
  ok(kept>100,`${kept} of ${tried} random edits applied, every one within the rules`);
}

// 8. Stairs: any exposed edge by name; a 45° edge takes one straight flight; a stair across the deck is flagged.
{
  const d=custom(T,{stairEdgeId:'custom-front-2',stairFlights:1,height:36});
  ok(validateDesign(d).stairEdgeId==='custom-front-2'&&buildDeckTakeoff(d).flights.length===1,'A stair can open on the bump-out front by name');
  const narrowU=[pt(20,14),pt(12,14),pt(12,6),pt(8,6),pt(8,14),pt(0,14)];
  ok(buildDeckTakeoff(custom(narrowU,{stairEdgeId:'custom-step-1',stairFlights:1,height:60})).issues.some(i=>i.startsWith('A stair runs over the deck')),'A stair from inside a narrow U into its other arm is flagged');
  ok(!buildDeckTakeoff(custom(narrowU,{stairEdgeId:'custom-front-2',stairFlights:1,height:60})).issues.some(i=>i.startsWith('A stair runs over the deck')),'A stair out of the U is not');
  const angled=custom(outlinePreset('bay',24,16)!,{stairEdgeId:'custom-angled-1',stairFlights:1,stairType:'Landing',height:36});
  ok(buildDeckTakeoff(angled).issues.some(i=>i.includes('one straight flight')),'A landing stair on a 45° edge falls back to the stair side, as on an angled corner');
}

// 9. Words, the proposal and analytics.
{
  const d=custom(outlinePreset('bay',24,16)!),e=calculateDeckReleaseEstimate(d),words=describeDesign(d,e);
  ok(customShapeWords(activeCustomFront(d)!)==='Custom outline: 8 corners, 2 at 45°, 24 × 16 ft overall'&&shapeWords(d,false)==='Custom outline','The shape reads plainly');
  ok(words.facts.includes('Custom outline: 8 corners, 2 at 45°, 24 × 16 ft overall')&&words.proposalFacts[0].startsWith('24 × 16 ft custom-outline deck'),'The design facts and proposal name the outline');
  ok(designFeatures(d).includes('deck_shape_custom'),'Analytics reports a custom outline');
}

// 10. The designer: the shape menu offers it, the editor loads on demand, width, depth and levels follow the outline.
{
  const page=designerSource(),step=read('src/features/deckcraft/designer/steps/DimensionsStep.tsx'),editor=read('src/features/deckcraft/designer/OutlineEditor.tsx'),actions=read('src/features/deckcraft/designer/deckShapeActions.ts');
  ok(step.includes("['Custom','Custom outline']")&&step.includes("const OutlineEditor=lazy(()=>import('../OutlineEditor'));"),'The shape menu offers a custom outline, and its editor loads only when chosen');
  ok(actions.includes('savedBoundary(points)')&&actions.includes("shape:'Custom'")&&step.includes('update(chooseShape(data,e.target.value as DeckShape))'),'Choosing Custom / Draw my own seeds a free outline from the deck as drawn, one level');
  const drawn=deckReleaseData({...base(),levels:2}),picked=chooseShape(drawn,'Custom'),kept=chooseShape({...drawn,deckOutlines:{main:[{x:0,y:0},{x:20,y:0},{x:20,y:14},{x:0,y:14}]}},'Custom');
  const lShape=deckReleaseData({...base(),shape:'L-Shape',width:24,length:16,cutoutWidth:8,cutoutLength:6}),drawnOwn=chooseShape(lShape,'Custom');
  ok(picked.levels===1&&!!picked.deckOutlines?.main&&picked.customFront===undefined&&kept.deckOutlines===undefined&&kept.shape==='Custom','The shape action seeds a free outline from the deck as drawn, or keeps an existing free outline');
  ok(!!drawnOwn.deckOutlines?.main&&drawnOwn.deckOutlines.main.length>=6&&!drawnOwn.wrap,'Draw my own keeps an L-shape as editable free points instead of collapsing to a rectangle');
  ok(JSON.stringify(chooseShape(drawn,'L-Shape'))==='{"shape":"L-Shape"}','Any other shape changes only the shape');
  ok(step.includes('hint="Set by the outline"')&&step.includes("disabled={custom}")&&step.includes('{!custom&&levelsSection}'),'Width, depth and levels follow the outline');
  // R5: the drawing moved to the plan (its Draw outline tool); the Deck section lists every edge as a button, and the keys
  // live in outlineEditMath.ts, shared with the plan.
  const editMath=read('src/features/deckcraft/designer/outlineEditMath.ts');
  ok(/const onKey=\(i:number\)=>\(e:KeyboardEvent\)=>\{/.test(editor)&&editMath.includes('ArrowUp:-step,ArrowDown:step')&&editor.includes('onKeyDown={onKey(i)}>{name}</button>'),'Every edge can be selected and moved from the keyboard');
  ok(page.includes("(data.shape==='Custom'&&!isChamferEdgeId(e.id))"),'The stair picker offers every exposed edge of an outline');
}

console.log(`DECK OUTLINE OK — rules, saving and sharing, ${OUTLINE_PRESETS.length} presets framed in ${OUTLINE_PRESETS.length*48} designs, existing shapes priced identically, labour, editor moves, stairs, words and wiring; ${checks} checks.`);
