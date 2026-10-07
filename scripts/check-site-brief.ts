// S1 site brief (src/features/deckcraft/siteBrief.ts) on the real Craighurst survey (e2e/fixtures/craighurst-ground-fit.json:
// 11 shots over about 14.6 × 12.7 ft, −7.37 to +10.58 in, a hump at P4/P5, the low corner at P7/P8, sill +34.12 in) and on
// synthetic surveys: flat, a 15 % slope toward the house, and one that misses the door and the deck.
import '../src/features/deckcraft/siteModelRuntime';
import '../src/features/deckcraft/siteSurfaceEngine';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {ensureLiveDesignExtensions} from '../src/features/deckcraft/designExtensions';
import {parseDesign} from '../src/features/deckcraft/designPersistence';
import type {DeckData} from '../src/features/deckcraft/types';

let checks=0;const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;};
const FIXTURE=readFileSync(new URL('../e2e/fixtures/craighurst-ground-fit.json',import.meta.url),'utf8');
async function load(edit?:(c:any)=>void):Promise<DeckData>{const doc=JSON.parse(FIXTURE);edit?.(doc.configuration);await ensureLiveDesignExtensions(doc);return parseDesign(JSON.stringify(doc));}
const {siteBrief,loadSiteBriefRuntime,northDegFromYardFaces,SITE_BRIEF_BUDGET}=await import('../src/features/deckcraft/siteBrief');
await loadSiteBriefRuntime();
const bytes=(v:unknown)=>new TextEncoder().encode(JSON.stringify(v)).length,near=(v:number,want:number,tol:number)=>Math.abs(v-want)<=tol;
const grid=(f:(x:number,z:number)=>number)=>{const out=[];for(let x=-24;x<=168;x+=24)for(let z=0;z<=144;z+=24)out.push({id:`G${x}_${z}`,xIn:x,zIn:z,elevationIn:+f(x,z).toFixed(3)});return out;};

// (a) Craighurst.
const data=await load(),before=JSON.stringify(data),brief=siteBrief(data)!,again=siteBrief(structuredClone(data));
ok(brief,'Craighurst: a brief');
ok(JSON.stringify(brief)===JSON.stringify(again)&&JSON.stringify(brief)===JSON.stringify(siteBrief(data)),'Deterministic: the same brief every time, from a copy too');
ok(JSON.stringify(data)===before,'Input design unchanged');
ok(bytes(brief)<=2048&&SITE_BRIEF_BUDGET===2048,`JSON within 2 KB (${bytes(brief)} bytes)`);
ok(brief.units==='in'&&brief.datum.length>10,'Units and datum stated');
const c=brief.coverage;
ok(near(c.widthFt,14.6,.1)&&near(c.depthFt,12.7,.1)&&c.areaSqft>100&&c.areaSqft<c.widthFt*c.depthFt,`Coverage ${c.widthFt} × ${c.depthFt} ft, ${c.areaSqft} sq ft`);
ok(near(brief.elevation.minIn,-7.37,.05)&&near(brief.elevation.maxIn,10.58,.05)&&near(brief.elevation.rangeIn,17.95,.1)&&brief.elevation.lowAt.label==='P7'&&brief.elevation.highAt.label==='P1','Elevation −7.37 (P7) to +10.58 (P1)');
const p=brief.plane;
ok(near(p.slopePct,8.9,.6),`Plane slope ${p.slopePct} % (8.9 ± 0.6)`);
ok(near(p.risePctX,8.6,.6)&&near(p.risePctZ,-2,.6),`Rises ${p.risePctX} % to the right, ${p.risePctZ} % away from the house`);
ok(p.fallsToward.startsWith('toward the left')&&p.downhill.dx<-.9&&p.downhill.dz>0,`Falls ${p.fallsToward}`);
ok(p.fitRmsIn>0&&p.fitRmsIn<6,`Fit RMS ${p.fitRmsIn} in`);
const zoneArea=brief.zones.reduce((n,z)=>n+z.areaSqft,0);
ok(zoneArea>=.95*c.areaSqft,`Zones cover ${(zoneArea/c.areaSqft*100).toFixed(1)} % of the survey (≥ 95 %)`);
ok(brief.zones.every(z=>z.areaSqft>=6&&z.polygon.length>=3&&z.polygon.length<=12&&['flat','gentle','moderate','steep'].includes(z.kind))&&new Set(brief.zones.map(z=>z.id)).size===brief.zones.length,'Zones: ≥ 6 sq ft, 3–12 point outlines, known kinds, unique ids');
const order=['flat','gentle','moderate','steep'];
ok(brief.zones.every((z,i)=>!i||order.indexOf(z.kind)>=order.indexOf(brief.zones[i-1].kind)),'Zones listed flattest first');
ok(brief.zones.every(z=>z.slopePct<=({flat:2,gentle:5,moderate:10,steep:1000} as const)[z.kind]+1e-9&&z.slopePct>({flat:-1,gentle:2,moderate:5,steep:10} as const)[z.kind]),'Each zone\'s slope matches its kind');
const hump=brief.features.humps[0],low=brief.features.lowSpots[0];
ok(hump&&['P4','P5'].includes(hump.label)&&hump.x>=36&&hump.x<=58&&hump.z>=45&&hump.z<=56&&hump.prominenceIn>=2,`Hump near P4/P5 (${JSON.stringify(hump)})`);
ok(low&&['P7','P8'].includes(low.label)&&low.prominenceIn>=2,`Low spot near P7/P8 (${JSON.stringify(low)})`);
ok(brief.features.humps.every(f=>!['P7','P8'].includes(f.label))&&brief.features.lowSpots.every(f=>!['P4','P5'].includes(f.label)),'No hump in the low corner, no low spot on the hump');
const h=brief.house;
ok(h.sillIn===34.12,`Sill ${h.sillIn}`);
ok(h.doorAt?.x===42&&h.doorAt.z===0&&h.groundAtDoorIn!==null&&near(h.sillAboveGroundIn!,h.sillIn!-h.groundAtDoorIn,.051)&&h.deckTopIn===30,`Door at x ${h.doorAt?.x}: ground ${h.groundAtDoorIn} in, ${h.sillAboveGroundIn} in below the sill; deck top ${h.deckTopIn}`);
ok(h.stairs.length===1&&h.stairs[0].flightId==='grade-0'&&h.stairs[0].landing?.featureId==='landing'&&h.stairs[0].landing.finishedIn===5&&h.stairs[0].groundAtFootIn!==null,`Stair lands on the stone landing at +5 (${JSON.stringify(h.stairs[0])})`);
ok(brief.coverageWarnings.some(w=>/left/.test(w)&&/right/.test(w)&&/[Ee]xtend/.test(w)),`Survey too short left and right of the deck (${brief.coverageWarnings.join(' ')})`);
ok(brief.designWarnings.length>=1&&brief.designWarnings.every(w=>w.length<=90&&/ground|survey|grad|clearance/i.test(w)),`Ground-related design warnings, trimmed (${brief.designWarnings.join(' | ')})`);
ok(brief.orientation===null&&!brief.lines.some(l=>/\bsun\b/.test(l)),'No sun claim without northDeg');
ok(brief.lines.length>=4&&brief.lines.length<=8&&brief.lines.every(l=>/^[A-Z].{20,140}\.$/.test(l)),`${brief.lines.length} plain lines`);
ok(/rises about \d+ in from left to right/.test(brief.lines[0])&&brief.lines.some(l=>/door/.test(l)&&/34\.1 in sill/.test(l))&&brief.lines.some(l=>/P7/.test(l)),'Lines: the slope, the door and the low spot');
const south=siteBrief(data,{northDeg:northDegFromYardFaces('S')})!,north=siteBrief(data,{northDeg:0})!,east=siteBrief(data,{northDeg:90})!;
ok(south.orientation?.yardFaces==='south'&&south.orientation.sunSide==='away from the house'&&north.orientation?.sunSide==='toward the house'&&east.orientation?.sunSide.startsWith('toward the left'),`Sun: south-facing yard ${south.orientation?.sunSide}; north-facing ${north.orientation?.sunSide}; east-facing ${east.orientation?.sunSide}`);
ok(bytes(south)<=2048&&south.lines.some(l=>/midday sun/.test(l))||bytes(south)<=2048,`With orientation still within 2 KB (${bytes(south)} bytes)`);
ok(siteBrief(data,{gridIn:12})!.zones.reduce((n,z)=>n+z.areaSqft,0)>=.95*c.areaSqft,'A 12 in grid still covers the survey');

// (b) No survey: no brief.
ok(siteBrief({...data,siteModel:undefined})===null,'Legacy design without a survey: null');

// (c) Flat survey: one flat zone, no humps or low spots, level words.
const flat=siteBrief(await load(d=>{d.siteModel={version:1,points:grid(()=>0),grading:[]};}))!;
ok(flat.zones.length===1&&flat.zones[0].kind==='flat'&&flat.zones[0].slopePct===0,`Flat survey: one flat zone (${flat.zones.map(z=>`${z.kind} ${z.areaSqft}`).join(', ')})`);
ok(flat.plane.slopePct===0&&/level/.test(flat.plane.fallsToward)&&!flat.features.humps.length&&!flat.features.lowSpots.length&&/close to level/.test(flat.lines[0]),'Flat survey: level, no humps or low spots');

// (d) 15 % slope rising away from the house: one steep zone, water toward the house.
const steep=siteBrief(await load(d=>{d.siteModel={version:1,points:grid((x,z)=>.15*z),grading:[]};}))!;
ok(steep.zones.length===1&&steep.zones[0].kind==='steep'&&near(steep.zones[0].slopePct,15,.05),`15 % slope: a steep zone (${steep.zones.map(z=>`${z.kind} ${z.slopePct} %`).join(', ')})`);
ok(near(steep.plane.slopePct,15,.05)&&steep.plane.fallsToward==='toward the house'&&steep.lines.some(l=>/toward the house/.test(l)),`15 % slope: falls ${steep.plane.fallsToward}, and a line says so`);

// (e) A survey that misses the door and the deck: unknown, never guessed.
const away=siteBrief(await load(d=>{for(const q of d.siteModel.points)q.xIn+=400;}))!;
ok(away.house.groundAtDoorIn===null&&away.house.sillAboveGroundIn===null&&away.house.stairs.every(s=>s.groundAtFootIn===null),'Survey away from the house: door and stair ground unknown (null)');
ok(away.coverageWarnings.some(w=>/door/.test(w))&&away.coverageWarnings.some(w=>/deck/.test(w)),`Survey away from the house: says where to measure (${away.coverageWarnings.join(' ')})`);

// (f) Lazy: nothing imports the brief statically (type-only imports are erased).
const files:string[]=[];const walk=(dir:string)=>{for(const n of readdirSync(dir)){const f=join(dir,n);if(statSync(f).isDirectory())walk(f);else if(/\.(ts|tsx)$/.test(n))files.push(f);}};walk(new URL('../src',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
const eager=files.filter(f=>/^\s*import\s+(?!type\b)[^;]*?from\s*['"][^'"]*\/siteBrief['"]/m.test(readFileSync(f,'utf8')));
ok(!eager.length,`siteBrief is only ever imported dynamically (${eager.join(', ')||'no static imports'})`);

console.log(`Site brief: ${checks} checks passed; Craighurst ${bytes(brief)} bytes, ${p.slopePct} % falling ${p.fallsToward}, ${brief.zones.length} zones (${brief.zones.map(z=>`${z.kind} ${z.areaSqft}`).join(', ')}), hump ${hump.label} +${hump.prominenceIn} in, low spot ${low.label} −${low.prominenceIn} in, ${brief.lines.length} lines.`);
