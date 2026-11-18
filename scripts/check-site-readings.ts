import '../src/features/deckcraft/siteModelRuntime';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {deflateRawSync,crc32} from 'node:zlib';
import {csvRows} from '../src/features/deckcraft/siteCsv';
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
import {readReadingFiles,isULevel,parseULevel,suggestRole,readingColumns,guessMapping,parseColumnReadings,importReadings,presetFromMapping,saveReadingPreset,loadReadingPresets,mappingFromPreset,type TextFile} from '../src/features/deckcraft/siteReadingFiles';
import {validateSiteModel} from '../src/features/deckcraft/siteModel';
import type {SiteModel,SitePoint} from '../src/features/deckcraft/siteModel';
import {createSiteSurface} from '../src/features/deckcraft/siteSurfaceEngine';
import {parseLength,guessDecimal,markedUnit,signedHeight,levelRun,heightOfInstrument,rodForTarget,cutFill,fitPlacement,applyTransform,proposeWallFit,uniqueIds,mergeSitePoints,tieOffset,tieDatum,hull,hullWidth,checkReadings,isBare,type FitPair,type Shot} from '../src/features/deckcraft/siteReadings';

let checks=0;const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;},near=(a:number|undefined,b:number,m:string,tolerance=1e-9)=>ok(a!==undefined&&Math.abs(a-b)<=tolerance,`${m}: ${a} vs ${b}`),throwsLike=(f:()=>unknown,pattern:RegExp,m:string)=>{assert.throws(f,pattern,m);checks++;};

// Units and number formats: the original text is kept, the value is inches.
for(const [raw,unit,inches,detected,decimal] of [
 [`6' 3 5/8"`,'in',75.625,'ft-in'],[`6'-3 5/8"`,'in',75.625,'ft-in'],[`6'3"`,'in',75,'ft-in'],[`5 ft 3 in`,'in',63,'ft-in'],[`2'`,'in',24,'ft'],[`6.25'`,'in',75,'ft'],[`6.25 ft`,'in',75,'ft'],
 [`-18.5"`,'in',-18.5,'in'],[`+2"`,'in',2,'in'],[`3/4"`,'in',.75,'in'],[`−3/4″`,'in',-.75,'in'],[`75 5/8 in`,'in',75.625,'in'],[`-23.54`,'in',-23.54,'in'],
 [`2.35`,'ft',28.2,'ft'],[`1905 mm`,'in',75,'mm'],[`190.5 cm`,'in',75,'cm'],[`1.905 m`,'in',75,'m'],[`-1,5`,'in',-1.5,'in',','],[`190,5 cm`,'in',75,'cm',','],
 [`2.3 below`,'in',-2.3,'in'],[`above 4"`,'in',4,'in'],[`1' 2" down`,'in',-14,'ft-in'],[`5′ 6″`,'in',66,'ft-in'],[`6''`,'in',6,'in'],[`  -0  `,'in',0,'in'],
] as [string,'in'|'ft',number,string,(','|'.')?][]){const p=parseLength(raw,unit,decimal);near(p.inches,inches,`parse ${raw}`,1e-9);ok(p.unit===detected,`unit of ${raw}: ${p.unit}`);ok(p.raw===raw,`raw kept for ${raw}`);ok(!Object.is(p.inches,-0),`no negative zero for ${raw}`);}
for(const [raw,why,decimal] of [[``,/empty/],[`abc`,/not a length/],[`1,5`,/comma/],[`1.5`,/decimal point/,','],[`6' 13"`,/under 12/],[`-2 below`,/both a sign/],[`3/0"`,/zero denominator/],[`1/2/3`,/not a length/],[`5 yd`,/not a length/]] as [string,RegExp,(','|'.')?][])throwsLike(()=>parseLength(raw,'in',decimal),why,`reject ${raw||'(empty)'}`);
ok(guessDecimal(['1,5','2,25'])===','&&guessDecimal(['1.5','2,25'])==='.'&&guessDecimal(['15','22'])==='.','decimal comma only when no value shows a point');
ok(markedUnit(['156.4"','10.6"'])==='in'&&markedUnit([`2' 3"`,`4'`])==='ft-in'&&markedUnit(['12.5','3'])===undefined&&markedUnit(['30 cm','1.5 cm'])==='cm','unit marks detected; bare numbers stay unknown');
ok(signedHeight(-23.54,'height-up')===-23.54&&signedHeight(23.54,'height-down')===-23.54&&signedHeight(101,'elevation')===101,'reading kinds give +up heights');

// Rod and level: BM 100.00 + BS 4.50 -> HI 104.50; target 103.00 -> rod 1.50.
near(heightOfInstrument(100,4.5),104.5,'HI = BM + BS');near(rodForTarget(104.5,103),1.5,'rod for target = HI - target');
near(cutFill(1.5,1),.5,'grade rod 1.50 over ground rod 1.00 is 0.50 cut');near(cutFill(1.5,2),-.5,'grade rod 1.50 over ground rod 2.00 is 0.50 fill');
const run=levelRun({id:'BM',elevationIn:100},[{id:'BM',sight:'bs',rodIn:4.5},{id:'A',sight:'fs',rodIn:1.5},{id:'TP1',sight:'fs',rodIn:2},{id:'TP1',sight:'bs',rodIn:3},{id:'B',sight:'fs',rodIn:1.25},{id:'BM',sight:'fs',rodIn:5.49}]);
near(run.points.find(p=>p.id==='A')?.elevationIn,103,'foresight elevation = HI - FS');near(run.points.find(p=>p.id==='TP1')?.elevationIn,102.5,'turning point elevation');near(run.rows[4].hiIn,105.5,'new HI after the turning point',1e-9);near(run.points.find(p=>p.id==='B')?.elevationIn,104.25,'shot after the turning point');
ok(run.misclosures.length===1&&run.misclosures[0].id==='BM',`closing on the benchmark reports misclosure`);near(run.misclosures[0].errorIn,.01,'misclosure value',1e-9);ok(run.points.filter(p=>p.id==='BM').length===1&&run.points[0].elevationIn===100,'benchmark is never overwritten');
throwsLike(()=>levelRun({id:'BM',elevationIn:0},[{id:'A',sight:'fs',rodIn:1}]),/backsight before/,'foresight before any backsight');
throwsLike(()=>levelRun({id:'BM',elevationIn:0},[{id:'X',sight:'bs',rodIn:1}]),/not known/,'backsight on an unknown point');
throwsLike(()=>levelRun({id:'BM',elevationIn:0},[{id:'BM',sight:'bs',rodIn:-1}]),/zero or more/,'negative rod reading');

// Registration: a known rotation, translation, mirror and scale are recovered.
const angle=30*Math.PI/180,known={cos:Math.cos(angle),sin:Math.sin(angle),scale:1,mirror:false,tx:10,tz:-5},src=[{x:0,z:0},{x:100,z:0},{x:40,z:80}];
const fit=fitPlacement(src.map((s,i)=>({id:`s${i}`,source:s,target:applyTransform(known,s)})));near(fit.rotationDeg,30,'rotation recovered',1e-9);near(fit.transform.tx,10,'move x recovered',1e-9);near(fit.transform.tz,-5,'move z recovered',1e-9);near(fit.maxIn,0,'exact fit has no residual',1e-9);near(fit.measuredScale,1,'real distances measure 1:1',1e-12);
const flipped={...known,mirror:true},mirrorPairs=src.map(s=>({source:s,target:applyTransform(flipped,s)}));near(fitPlacement(mirrorPairs,{mirror:true}).maxIn,0,'mirrored set fits once mirrored',1e-9);ok(fitPlacement(mirrorPairs).maxIn>10,'a mirrored set does not fit unmirrored');
const scaled={...known,scale:1.25},scaledPairs=src.map(s=>({source:s,target:applyTransform(scaled,s)}));near(fitPlacement(scaledPairs,{scale:'solve'}).transform.scale,1.25,'scale solved',1e-12);const fixed=fitPlacement(scaledPairs);ok(fixed.transform.scale===1&&Math.abs(fixed.measuredScale-1.25)<1e-12&&fixed.maxIn>1,'fixed scale stays 1:1 and reports the 1.25 mismatch');
throwsLike(()=>fitPlacement([{source:{x:0,z:0},target:{x:0,z:0}}]),/at least two/,'one pair is not enough');throwsLike(()=>fitPlacement([{source:{x:1,z:1},target:{x:0,z:0}},{source:{x:1,z:1},target:{x:5,z:0}}]),/shots are on top/,'coincident shots');throwsLike(()=>fitPlacement([{source:{x:0,z:0},target:{x:3,z:3}},{source:{x:5,z:0},target:{x:3,z:3}}]),/plan points are on top/,'coincident plan points');

// The real U-Level export (e2e/fixtures/ulevel-sample.zip).
const zip=unzipSync(readFileSync('e2e/fixtures/ulevel-sample.zip')),file=(re:RegExp)=>strFromU8(zip[Object.keys(zip).find(k=>re.test(k))!]);
const rows=file(/^Points_.*\.csv$/).trim().split(/\r?\n/).slice(1).map(l=>l.split(',').map(s=>s.trim())),lengths=file(/^Lengths_.*\.csv$/).trim().split(/\r?\n/).slice(1).map(l=>l.split(','));
ok(rows.length===12&&rows[3][0]==='P1_4'&&rows[3].slice(1,4).join()===rows[0].slice(1,4).join(),'fixture: P1_4 repeats P1_1 to close the house path');
const shots:(Shot&{h:number})[]=rows.filter((_,i)=>i!==3).map(r=>({id:r[0],x:parseLength(r[1],'in').inches,z:parseLength(r[2],'in').inches,h:signedHeight(parseLength(r[3],'in').inches,'height-up')}));
const house=shots.filter(s=>s.id.startsWith('P1_')),yard=shots.filter(s=>s.id.startsWith('P2_'));ok(house.length===3&&yard.length===8,'fixture: 3 house-outline shots and 8 yard shots');
ok(markedUnit(lengths.map(l=>l[1]))==='in','fixture: the Lengths file says inches');
lengths.forEach((l,i)=>{const a=house[i],b=house[(i+1)%3],run=Math.hypot(b.x-a.x,b.z-a.z);near(run,parseLength(l[1],'in').inches,`fixture: ${l[0]} length recomputed from the points`,.05);near((b.h-a.h)/run*100,parseFloat(l[2]),`fixture: ${l[0]} slope recomputed`,.05);});
const corner={x:-24,z:0},proposal=proposeWallFit(house,yard,corner)!;
ok(proposal&&proposal.wall.map(s=>s.id).join()==='P1_1,P1_2','fixture: the long recorded run P1-P2 is the wall, never the closing line P3-P1');
ok(proposal.pairs[0].id==='P1_2'&&proposal.wrongSide===0,`fixture: all yard shots on one side put P1_2 (phone P2) at the back-left corner`);
ok(proposeWallFit(house,[],corner)?.pairs[0].id==='P1_2','fixture: without yard shots the outline itself marks the inside');
const placed=fitPlacement(proposal.pairs),at=(s:Shot)=>applyTransform(placed.transform,s);near(placed.maxIn,0,'fixture: two pairs with real distances fit exactly',1e-9);
near(at(house[1]).x,-24,'fixture: P1_2 lands on the corner x',1e-9);near(at(house[1]).z,0,'fixture: P1_2 lands on the corner z',1e-9);near(at(house[0]).z,0,'fixture: P1_1 lands on the back wall line',1e-9);ok(at(house[0]).x>at(house[1]).x,'fixture: the wall runs to the right from the corner');
ok(yard.every(s=>at(s).z>40),'fixture: every yard shot lands in the yard (more than 40 in out)');ok(at(house[2]).z<0,'fixture: P1_3 turns the corner into the house side');
near(Math.hypot(at(yard[0]).x-at(yard[4]).x,at(yard[0]).z-at(yard[4]).z),Math.hypot(yard[0].x-yard[4].x,yard[0].z-yard[4].z),'fixture: placement keeps recorded distances',1e-9);
const ids=uniqueIds(shots.map((_,i)=>`P${i+1}`)),relative:SitePoint[]=shots.map((s,i)=>{const p=at(s);return {id:ids[i],xIn:p.x,zIn:p.z,elevationIn:s.h};});
const terrain={widthFt:60,depthFt:60,elevationIn:0,slopePct:0},cornerHeight=createSiteSurface(validateSiteModel({version:1,points:relative,grading:[]}),terrain).sample(0,0,'existing');
ok(cornerHeight!==undefined&&cornerHeight<-23.5&&cornerHeight>-41.5,`fixture: ground under the deck's back-left corner is measured (${cornerHeight?.toFixed(2)} in below the sill)`);
const tie=tieDatum({kind:'door-sill'},cornerHeight);near(tie.sillIn,-cornerHeight!,'fixture: sill height above grade = minus the corner reading',1e-12);ok(tie.warnings.length===0,'fixture: a clean tie has no warnings');
const site:SiteModel=validateSiteModel({version:1,points:relative.map(p=>({...p,elevationIn:p.elevationIn+tie.offsetIn})),grading:[]});
near(createSiteSurface(site,terrain).sample(0,0,'existing'),0,'fixture: after the tie the corner ground reads 0.00 (the project datum)',1e-9);ok(site.points.map(p=>p.id).join()==='P1,P2,P3,P4,P5,P6,P7,P8,P9,P10,P11','fixture: phone names P1-P11 survive validation');
const fixtureCheck=checkReadings({ground:site.points,heights:shots.map(s=>s.h),zero:'door-sill',footprint:[{x:0,z:60},{x:-12,z:60},{x:-12,z:70},{x:0,z:70}]});ok(!fixtureCheck.errors.length&&!fixtureCheck.warnings.length,`fixture: no errors or warnings (${[...fixtureCheck.errors,...fixtureCheck.warnings].join(' ')})`);
ok(checkReadings({ground:site.points,heights:shots.map(s=>-s.h),zero:'door-sill'}).warnings.some(w=>/above your door sill/.test(w)),'fixture: a flipped sign is flagged');
ok(checkReadings({ground:site.points,footprint:[{x:2000,z:2000},{x:2100,z:2000},{x:2100,z:2100},{x:2000,z:2100}]}).warnings.some(w=>/4 of 4 deck corners/.test(w)),'fixture: a deck outside the shots is flagged as coverage pending');

// Datum tie-in rules.
throwsLike(()=>tieDatum({kind:'door-sill'},undefined),/back-left corner/,'sill tie needs ground at the deck corner');
throwsLike(()=>tieDatum({kind:'door-sill'},3),/above the door sill/,'ground above the sill is refused');
throwsLike(()=>tieDatum({kind:'door-sill'},-300),/units/,'a sill 25 ft up is refused');
ok(tieDatum({kind:'deck-corner'},-4).warnings.length===1&&tieDatum({kind:'deck-corner'},-.5).warnings.length===0&&tieDatum({kind:'deck-corner'},undefined).offsetIn===0,'zero on the deck corner warns only when the shots disagree');
ok(tieDatum({kind:'typed',zeroElevationIn:30}).offsetIn===30,'typed zero height is the offset');throwsLike(()=>tieDatum({kind:'typed',zeroElevationIn:NaN}),/number/,'typed zero must be a number');

// Names, merge and second setups.
ok(uniqueIds(['Ground','Ground','',' sill \u0007 ','x'.repeat(120),'Ground']).join('|')===`Ground|Ground (2)|Shot 3|sill|${'x'.repeat(92)}|Ground (3)`,'names are cleaned and made unique');
const pt=(id:string,xIn:number,zIn:number,elevationIn=0)=>({id,xIn,zIn,elevationIn}),old=[pt('A',0,0,1),pt('B',100,0,2),pt('C',0,100,3),pt('D',100,100,4)],incoming=[pt('A',0,0,9),pt('E',50,50,5),pt('F',100.4,100.3,6)];
const merged=mergeSitePoints(old,incoming,'merge');ok(merged.points.map(p=>p.id).join()==='A,B,C,E,F'&&merged.points[0].elevationIn===9,'merge updates by name, keeps the rest and adds new shots');ok(merged.updated.join()==='A'&&merged.added.join()==='E,F'&&merged.superseded.join()==='D','merge reports updated, added and the re-shot it superseded');
const appended=mergeSitePoints(old,[pt('A',30,30),pt('A',60,60)],'append');ok(appended.points.map(p=>p.id).join()==='A,B,C,D,A (2),A (3)'&&appended.renamed.length===2,'append renames clashing names');
const replaced=mergeSitePoints(old,incoming,'replace');ok(replaced.points.length===3&&replaced.removed.length===4,'replace keeps only the new shots');
validateSiteModel({version:1,points:merged.points,grading:[]});validateSiteModel({version:1,points:appended.points,grading:[]});checks+=2;
const tied=tieOffset([pt('A',0,0,10),pt('B',0,0,20)],[{id:'A',elevationIn:4},{id:'B',elevationIn:14.5},{id:'Z',elevationIn:0}])!;near(tied.offsetIn,5.75,'tie shots give the setup offset');near(tied.maxResidualIn,.25,'tie leftover error');ok(tieOffset([pt('A',0,0,1)],[{id:'Q',elevationIn:0}])===undefined,'no shared shot means no automatic offset');

// Too few, straight-line, narrow and unit-suspicious input.
const g=(xs:[number,number,number][])=>xs.map(([xIn,zIn,elevationIn])=>({xIn,zIn,elevationIn}));
ok(/at least 3/.test(checkReadings({ground:g([[0,0,0],[10,10,0]])}).errors[0]),'two shots are refused');
ok(/straight line/.test(checkReadings({ground:g([[0,0,0],[50,50,1],[100,100,2],[150,150,3]])}).errors[0]),'a straight line of shots is refused');
ok(/strip only 1\.0 ft/.test(checkReadings({ground:g([[0,0,0],[200,0,0],[100,12,0]])}).warnings[0]??''),'a 1 ft strip is warned');
ok(checkReadings({ground:g([[0,0,0],[600,0,400],[0,600,0]])}).warnings.some(w=>/more than 30 ft/.test(w)),'a 33 ft height range is warned');
ok(checkReadings({ground:g([[0,0,0],[10,0,0],[0,10,0]])}).warnings.some(w=>/feet or metres/.test(w)),'shots inside 10 in look like the wrong unit');
ok(checkReadings({ground:g([[0,0,0],[3000,0,0],[0,3000,0]])}).warnings.some(w=>/100 ft tube/.test(w)),'shots 250 ft apart look like the wrong unit');
ok(hull([{x:0,z:0},{x:10,z:0},{x:10,z:10},{x:0,z:10},{x:5,z:5}]).length===4&&Math.abs(hullWidth([{x:0,z:0},{x:10,z:0},{x:10,z:4},{x:0,z:4}])-4)<1e-12,'hull and width');

// Phase B: reading the files the apps send.
const fixtureBytes=readFileSync('e2e/fixtures/ulevel-sample.zip'),files=readReadingFiles('ulevel_10-05-26_14-18.zip',fixtureBytes);
ok(files.map(f=>f.name).join()==='Lengths_10-05-26_14-18.csv,Points_10-05-26_14-18.csv','zip: only the CSV entries are inflated (no DXF, no plot image)');ok(isULevel(files),'zip: recognised as a U-Level export');
const u=parseULevel(files);
ok(u.shots.length===11&&u.shots.map(s=>s.label).join()==='P1,P2,P3,P4,P5,P6,P7,P8,P9,P10,P11','U-Level: the closing repeat is dropped and shots are named P1-P11 like the phone');
ok(u.shots.map(s=>s.rawId).join()===rows.filter((_,i)=>i!==3).map(r=>r[0]).join(),'U-Level: file IDs are kept as rawId');
ok(u.unit==='in'&&u.unitSource==='lengths'&&u.warnings.length===0,`U-Level: the Lengths file confirms inches with no warnings (${u.unitSource}; ${u.warnings.join(' ')})`);
ok(u.lengthChecks.length===3&&u.lengthChecks.every(c=>c.ok),'U-Level: all three recorded lengths and slopes agree with the points');
ok(u.lines.length===1&&u.lines[0].closed&&u.lines[0].label==='House line 1'&&u.lines[0].shotIds.join()==='P1,P2,P3','U-Level: the closed red line is the house line P1-P3');
ok(u.shots.slice(3).every(s=>s.line===undefined)&&u.shots.every(s=>s.role==='ground'),'U-Level: P4-P11 are loose elevation points; every shot is ground');
const p10=u.shots[9];ok(p10.rawId==='P2_7'&&p10.heightIn===-28.14&&p10.raw.height==='-28.14'&&p10.x===-30.52&&p10.z===120.81,'U-Level: P10 matches the plot label (-28.1") and keeps its original text');
const lineShots=u.shots.filter(s=>s.line!==undefined).map(s=>({id:s.id,x:s.x!,z:s.z!})),loose=u.shots.filter(s=>s.line===undefined).map(s=>({x:s.x!,z:s.z!}));
ok(proposeWallFit(lineShots,loose,{x:0,z:0})?.pairs.map(p=>p.id).join()==='P2,P1','U-Level: the house line proposes P2 on the corner, wall running to P1');
const pointsText=files[1].text,lengthsText=files[0].text,asFiles=(points:string,lengths?:string):TextFile[]=>[{name:'Points_x.csv',text:points},...(lengths===undefined?[]:[{name:'Lengths_x.csv',text:lengths}])];
const scaleValues=(text:string,f:(v:number)=>string)=>text.replace(/(-?\d+\.\d+)/g,m=>f(Number(m)));
{const alone=parseULevel(asFiles(pointsText));ok(alone.unitSource==='assumed'&&alone.warnings.some(w=>/inches are assumed/.test(w))&&alone.lines[0]?.closed,'Points CSV alone: inches assumed with a warning; the closed line is still found');}
{const cm=parseULevel(asFiles(scaleValues(pointsText,v=>(v*2.54).toFixed(3)),'Length:\nP1-P2,397.3cm,-6.8%\nP2-P3,26.9cm,-39.4%\nP3-P1,410.2cm,9.1%'));ok(cm.unit==='cm'&&cm.unitSource==='lengths'&&cm.lengthChecks.every(c=>c.ok),`cm display: unit found from the lengths (${cm.unit}, ${cm.warnings.join(' ')})`);near(cm.shots[9].heightIn,-28.14,'cm display: heights come back in inches',1e-3);near(cm.shots[0].x!,-4.29,'cm display: positions come back in inches',1e-3);}
{const ftin=parseULevel(asFiles(pointsText,`Length:\nP1-P2,13' 0 3/8",-6.8%\nP2-P3,0' 10 5/8",-39.4%\nP3-P1,13' 5 1/2",9.1%`));ok(ftin.unit==='in'&&ftin.unitSource==='lengths'&&ftin.lengthChecks.every(c=>c.ok),'ft-in lengths still prove the points are inches');}
{const ft=parseULevel(asFiles(scaleValues(pointsText,v=>(v/12).toFixed(5)),"Length:\nP1-P2,13.03',-6.8%\nP2-P3,0.88',-39.4%\nP3-P1,13.46',9.1%"));ok(ft.unit==='ft'&&ft.lengthChecks.every(c=>c.ok),'decimal-feet display: unit found from the lengths');near(ft.shots[0].heightIn,-23.54,'decimal feet: heights in inches',1e-3);}
{const semi=parseULevel(asFiles(pointsText.replace(/, /g,'; ').replace(/(\d)\.(\d)/g,'$1,$2'),lengthsText.replace(/,/g,';').replace(/(\d)\.(\d)/g,'$1,$2')));ok(semi.shots.length===11&&semi.shots[0].x===-4.29&&semi.unitSource==='lengths'&&semi.lengthChecks.every(c=>c.ok),'semicolons and decimal commas read the same shots');}
{const commented=parseULevel(asFiles(pointsText.replace('P2_1, -72.28, 72.46, -23.86,  ','P2_1, -72.28, 72.46, -23.86, back sill, by "door"').replace('P2_2, -95.76, 71.56, -28.10,  ','P2_2, -95.76, 71.56, -28.10, "TOW, north"').replace('P2_3, -128.25, 90.83, -35.70,  ','P2_3, -128.25, 90.83, -35.70, low spot'),lengthsText));
 ok(commented.shots[3].comment==='back sill, by "door"'&&commented.shots[3].id==='P4 (back sill, by "door")'&&commented.shots[3].role==='reference','comments keep commas and quotes; a sill shot becomes a reference');ok(commented.shots[4].comment==='TOW, north'&&commented.shots[4].role==='reference'&&commented.shots[5].role==='ground'&&commented.shots[5].id==='P6 (low spot)','quoted comments unwrap; top of wall is a reference, "low spot" stays ground');}
for(const [text,why] of [['ground by the foundation','ground'],['top of foundation','reference'],['TP2','reference'],['benchmark','reference'],['back door','reference'],['door mat edge','ground'],['FFE','reference']] as const)ok(suggestRole(text)===why,`role for "${text}" is ${why}`);
{const enc=(text:string)=>{const b=Buffer.from('﻿'+text.replace(/\n/g,'\r\n'),'utf16le');return readReadingFiles('Points.csv',new Uint8Array(b));},u16=enc(pointsText);ok(u16.length===1&&isULevel(u16)&&parseULevel(u16).shots.length===11,'UTF-16 with BOM and CRLF reads the same');
 const bom=readReadingFiles('Points_x.csv',new Uint8Array(Buffer.from('﻿'+pointsText.replace(/\n/g,'\r\n'))));ok(parseULevel(bom).shots[10].heightIn===-27.44,'UTF-8 BOM and CRLF read the same');}
{const zipped=zipSync({'job/Points_a.csv':strToU8(pointsText),'job/Lengths_a.csv':strToU8(lengthsText),'__MACOSX/job/._Points_a.csv':strToU8('junk'),'job/.hidden.csv':strToU8('x'),'job/Plot.jpg':new Uint8Array([255,216,255,0])}),got=readReadingFiles('job.zip',zipped);ok(got.map(f=>f.name).join()==='Lengths_a.csv,Points_a.csv','folders, __MACOSX and hidden files inside the zip are ignored');}
throwsLike(()=>readReadingFiles('x.zip',zipSync(Object.fromEntries(Array.from({length:70},(_,i)=>[`f${i}.txt`,strToU8('a')])))),/more than 64 files/,'zip with too many entries');
throwsLike(()=>readReadingFiles('x.zip',zipSync({'Plot.jpg':new Uint8Array([255,216,255])})),/no CSV/,'zip without CSV');
throwsLike(()=>readReadingFiles('x.zip',fixtureBytes.subarray(0,4000)),/damaged/,'truncated zip');
throwsLike(()=>readReadingFiles('levels.xlsx',zipSync({'a.xml':strToU8('x')})),/Excel/,'Excel workbook explained');
throwsLike(()=>readReadingFiles('photo.png',new Uint8Array([137,80,78,71,0,0,0,0])),/not a text/,'binary file refused');throwsLike(()=>readReadingFiles('a.csv',new Uint8Array()),/empty/,'empty file refused');
throwsLike(()=>readReadingFiles('big.csv',new Uint8Array(5_000_001).fill(49)),/smaller than 5 MB/,'text over 5 MB refused');
{const off=parseULevel(asFiles(pointsText,'Length:\nP1-P2,250.0",-6.8%'));ok(off.warnings.some(w=>/do not match/.test(w)),'lengths that match no unit are flagged');}
{const twice=parseULevel(asFiles(pointsText.replace('P2_2, -95.76, 71.56','P2_2, -72.28, 72.46'),lengthsText));ok(twice.warnings.some(w=>/P4 and P5 were recorded at the same spot/.test(w)),'two shots at one spot are flagged');}
throwsLike(()=>parseULevel(asFiles(pointsText.replace('P2_3, -128.25, 90.83, -35.70,  ','P2_3, -128.25'),lengthsText)),/row 8: expected P, X, Y and Z/,'a short row names its row');
throwsLike(()=>parseULevel(asFiles(pointsText.replace('-35.70','abc'),lengthsText)),/row 8: Z "abc"/,'an unreadable height names its row and text');
throwsLike(()=>parseULevel([{name:'other.csv',text:'a,b\n1,2'}]),/No U-Level Points/,'non-U-Level file');
{const two=parseULevel(asFiles(pointsText.trimEnd()+'\nP3_1, 40, 40, -30, \nP3_2, 60, 40, -31, \nP3_3, 60, 60, -32, \nP3_4, 40, 40, -30, \nP4_1, 80, 80, -33, \nP4_2, 90, 80, -34, ','Length:\nP1-P2,156.4",-6.8%\nP12-P13,20.0",-5.0%\nP15-P16,10.0",-10.0%'));
 ok(two.lines.length===3&&two.lines[0].closed&&two.lines[1].closed&&!two.lines[2].closed&&two.lines[2].shotIds.join()==='P15,P16','several lines: closed outlines and an open measured line are told apart');ok(two.shots.length===16,'several lines: both closing repeats dropped');}

// Generic columns (Moasure-style) and rod-and-level files.
{const text='Point Label,x,y,z,Notes\nA,0,0,0,\nB,10,0,-0.5,\nC,0,8,-1.25,patio edge',header=readingColumns({name:'m.csv',text}).header,guess=guessMapping(header);ok(guess.name===0&&guess.x===1&&guess.y===2&&guess.height===3&&guess.comment===4&&guess.sight===undefined,'column names are guessed');
 const m=parseColumnReadings({name:'m.csv',text},{...guess,height:guess.height!,unit:'ft',decimal:'.',kind:'height-up',yAxis:'up'});ok(m.shots.length===3&&m.shots[2].z===-96&&m.shots[1].x===120&&m.shots[2].heightIn===-15&&m.shots[2].comment==='patio edge','map-style Y becomes DeckCraft z, feet become inches');
 ok(importReadings([{name:'m.csv',text}],{...guess,height:guess.height!,unit:'ft',decimal:'.',kind:'height-down',yAxis:'down'}).shots[1].heightIn===6,'height-down flips the sign');
 throwsLike(()=>importReadings([{name:'m.csv',text}]),/Choose which columns/,'a non-U-Level file needs a mapping');
 throwsLike(()=>parseColumnReadings({name:'m.csv',text},{height:3,x:1,unit:'ft',decimal:'.',kind:'height-up',yAxis:'down'}),/both X and Y/,'X without Y refused');throwsLike(()=>parseColumnReadings({name:'m.csv',text},{height:3,x:3,y:2,unit:'ft',decimal:'.',kind:'height-up',yAxis:'down'}),/different column/,'one column used twice refused');throwsLike(()=>parseColumnReadings({name:'m.csv',text},{height:9,unit:'ft',decimal:'.',kind:'height-up',yAxis:'down'}),/not in the file/,'missing column refused');
 const noXY=parseColumnReadings({name:'m.csv',text},{name:0,height:3,unit:'in',decimal:'.',kind:'elevation',yAxis:'down'});ok(noXY.shots.every(s=>s.x===undefined&&s.z===undefined)&&noXY.shots[2].heightIn===-1.25,'heights without positions wait for tap-to-place');}
{const rod='Point,Sight,Rod\nBM,BS,4.50\nA,FS,1.50\nTP1,FS,2.00\nTP1,BS,3.00\nB,FS,1.25\nBM,FS,5.49',map={name:0,sight:1,height:2,unit:'ft' as const,decimal:'.' as const,kind:'rod' as const,yAxis:'down' as const,benchmarkIn:1200};
 const r=parseColumnReadings({name:'rod.csv',text:rod},map),h=(id:string)=>r.shots.find(s=>s.id===id)?.heightIn;near(h('A'),1236,'rod: A = BM 100.00 ft + BS 4.50 - FS 1.50, in inches',1e-9);near(h('B'),1251,'rod: B after the turning point (104.25 ft)',1e-9);
 ok(r.shots.length===4&&r.shots.find(s=>s.id==='TP1')?.role==='reference'&&r.shots.find(s=>s.id==='BM')?.role==='reference'&&r.shots.find(s=>s.id==='A')?.role==='ground','rod: one shot per point; benchmark and turning point are references');ok(r.warnings.some(w=>/closes on BM \+0\.12 in/.test(w)),`rod: misclosure reported (${r.warnings.join(' ')})`);
 throwsLike(()=>parseColumnReadings({name:'rod.csv',text:rod},{...map,name:undefined}),/point name column/,'rod needs names');throwsLike(()=>parseColumnReadings({name:'rod.csv',text:rod.replace('A,FS','A,XX')},map),/not BS or FS/,'unknown sight refused');throwsLike(()=>parseColumnReadings({name:'rod.csv',text:'Point,Sight,Rod\nA,FS,1'},map),/start with a backsight/,'rod run starts with a backsight');}
{const store=new Map<string,string>(),storage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>{store.set(k,v);}},header=['Point Label','x','y','z','Notes'];
 const preset=presetFromMapping(' Moasure job ',header,{name:0,x:1,y:2,height:3,comment:4,unit:'ft',decimal:'.',kind:'height-up',yAxis:'up'});ok(saveReadingPreset(preset,storage)&&loadReadingPresets(storage)[0].name==='Moasure job','presets save by name');
 const moved=mappingFromPreset(['Notes','z','Point Label','y','x'],loadReadingPresets(storage)[0])!;ok(moved.height===1&&moved.name===2&&moved.x===4&&moved.y===3&&moved.comment===0&&moved.yAxis==='up','presets follow header names when columns move');ok(mappingFromPreset(['a','b'],preset)===undefined,'a preset without its height column does not apply');
 store.set('deckcraft-reading-presets-v1',JSON.stringify([{name:'bad',columns:{},unit:'toString',decimal:'.',kind:'height-up',yAxis:'down'},preset]));ok(loadReadingPresets(storage).length===1,'malformed presets are ignored');store.set('deckcraft-reading-presets-v1','{not json');ok(loadReadingPresets(storage).length===0,'unreadable storage gives no presets');
 const broken={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}};ok(loadReadingPresets(broken).length===0&&saveReadingPreset(preset,broken)===false,'blocked browser storage never throws');throwsLike(()=>saveReadingPreset({...preset,name:' '},storage),/Name the preset/,'unnamed preset refused');}

// Regressions for the defects the adversarial review confirmed (2026-10-05).
const quick=(f:()=>unknown,ms:number,m:string)=>{const t=performance.now();try{f();}catch{/* only the time matters */}const took=performance.now()-t;ok(took<ms,`${m} (${took.toFixed(0)} ms)`);};
{const dc=parseULevel(asFiles(pointsText.replace(/(\d)\.(\d)/g,'$1,$2'),lengthsText.replace(/(\d)\.(\d)/g,'$1,$2')));ok(dc.shots.length===11&&dc.shots[0].x===-4.29&&dc.shots[2].heightIn===-38.29&&dc.shots[0].comment===''&&dc.unitSource==='lengths'&&dc.lengthChecks.length===3&&dc.lengthChecks.every(c=>c.ok),'decimal commas between the app\'s ", " separators read correctly');
 throwsLike(()=>parseULevel(asFiles(pointsText.replace(/, /g,',').replace(/(\d)\.(\d)/g,'$1,$2'))),/commas both between columns and as the decimal mark/,'tight commas plus decimal commas are refused, not misread');}
throwsLike(()=>parseColumnReadings({name:'a.csv',text:'Point,X,Y,Z\nA,1,5,2,0,-3,25\nB,10,0,0,5,-2,75\nC,0,8,6,0,-1,5'},{name:0,x:1,y:2,height:3,unit:'ft',decimal:',',kind:'height-up',yAxis:'down'}),/Row 2 has 7 values but the header has 4/,'unquoted decimal commas in a comma file are refused');
throwsLike(()=>parseColumnReadings({name:'a.csv',text:'Point,X,Y,Height,Notes\nA,0,0,-12,\nB,120,0,-14,\nC,0,96,5,-16,stake'},{name:0,x:1,y:2,height:3,comment:4,unit:'in',decimal:'.',kind:'height-up',yAxis:'down'}),/Row 4 has 6 values/,'a stray separator in one row is refused');
{const tape=parseColumnReadings({name:'tape.csv',text:'Point,Tape down\nA,14 1/2\nB,2 below\nC,1 above\nD,-1'},{name:0,height:1,unit:'in',decimal:'.',kind:'height-down',yAxis:'down'}).shots.map(s=>s.heightIn);ok(tape.join()==='-14.5,-2,1,1','height-down flips plain values but keeps above/below words as written');}
{const marks=parseColumnReadings({name:'m.csv',text:'Point,Height\nA,-18.5"\nB,-20 1/4"\nC,-1\' 9"\nD,"6\' 3"""'},{name:0,height:1,unit:'in',decimal:'.',kind:'height-up',yAxis:'down'}).shots.map(s=>s.heightIn);ok(marks.join()==='-18.5,-20.25,-21,75','unquoted inch marks read as inches; quoted fields still unescape');
 ok(parseColumnReadings({name:'t.tsv',text:"Point\tHeight\nA\t6' 3\"\nB\t5' 11 1/2\""},{name:0,height:1,unit:'in',decimal:'.',kind:'height-up',yAxis:'down'}).shots.map(s=>s.heightIn).join()==='75,71.5','TSV with ft-in marks');throwsLike(()=>csvRows('a,b\n"x"y,1'),/text follows a closing quote/,'text after a closing quote is still refused');throwsLike(()=>csvRows('a,b\n"x,1'),/unclosed quoted field/,'an unclosed quote is still refused');}
ok(parseColumnReadings({name:'mac.csv',text:'Point,X,Y,Z\rA,0,0,-12\rB,120,0,-14\rC,0,96,-16\r'},{name:0,x:1,y:2,height:3,unit:'in',decimal:'.',kind:'height-up',yAxis:'down'}).shots.map(s=>s.id).join()==='A,B,C','CR-only line endings (Excel for Mac) read as rows');
{const cp1252=(s:string)=>new Uint8Array([...s].map(c=>({'’':0x92,'”':0x94} as Record<string,number>)[c]??c.charCodeAt(0)));const win=readReadingFiles('releves.csv',cp1252('Point,Height,Note\nA,-12.5,côté nord\nB,6’ 3”,près du mur'));
 ok(win[0].text.includes('côté nord'),'Windows-1252 text decodes accents');const winShots=parseColumnReadings(win[0],{name:0,height:1,comment:2,unit:'in',decimal:'.',kind:'height-up',yAxis:'down'}).shots;ok(winShots[1].heightIn===75&&winShots[1].comment==='près du mur','Windows-1252 smart-quote ft-in reads as 75 in');}
near(parseLength('-3.55271E-15','in').inches,0,'Excel exponent near zero',1e-12);near(parseLength('1.2E-05','in').inches,.000012,'Excel small exponent',1e-15);near(parseLength('1.5e3 mm','in').inches,1500/25.4,'exponent with a unit',1e-9);ok(markedUnit(['1.2E-05','-3.5e2'])===undefined,'exponents count as bare numbers');throwsLike(()=>parseLength('1e','in'),/not a length/,'a dangling exponent is refused');
for(const [raw,inches] of [['3½"',3.5],[`6' 3½"`,75.5],['-1¼',-1.25],['5 ⅜ in',5.375],['¾"',.75]] as [string,number][])near(parseLength(raw,'in').inches,inches,`phone fraction ${raw}`,1e-12);
{const step=pointsText.split(/\r?\n/).map((l,i)=>i===0||!l.trim()?l:l.replace(/(-?\d+\.\d+)/g,m=>(Number(m)*1.0822/12).toFixed(2))).join('\n'),ft=parseULevel(asFiles(step,"Length:\nP1-P2,14.1',-6.8%\nP2-P3,1.0',-38.8%\nP3-P1,14.6',9.1%"));ok(ft.unit==='ft'&&ft.unitSource==='lengths',`one coarsely rounded length no longer vetoes feet (${ft.unit}/${ft.unitSource}; ${ft.warnings.join(' ')})`);}
{const old='P, X, Y, Z, Comment\nP1_1, 0.00, 0.00, -10.00,  \nP1_2, 100.00, 0.00, -12.00,  \nP1_3, 0.00, 100.00, -14.00,  \nP1_4, 100.00, 100.00, -16.00,  \nP1_5, 50.00, 50.00, -13.00,  ',pair=[{name:'Points_10-04-26_09-00.csv',text:old},{name:'Points_10-05-26_14-18.csv',text:pointsText},{name:'Lengths_10-05-26_14-18.csv',text:lengthsText}];
 const newer=parseULevel(pair);ok(newer.fileName==='Points_10-05-26_14-18.csv'&&newer.lengthChecks.length===3&&newer.lengthChecks.every(c=>c.ok),'with two exports the later one is read with its own Lengths');const older=parseULevel(pair.filter((_,i)=>i!==1));ok(older.lines.length===0&&older.lengthChecks.length===0,'a Lengths file from another export is never paired');}
{const marked=parseULevel(asFiles(`P, X, Y, Z, Comment\nP2_1, -6' 0 4/16", 6' 0 7/16", 0, Back Porch Step\nP2_2, -7' 11 12/16", 5' 11 9/16", -2' 4 2/16", \nP2_3, -10' 8 4/16", 7' 6 13/16", -2' 11 11/16", `));ok(marked.unitSource==='marks'&&marked.unit==='ft-in'&&marked.warnings.length===0&&marked.shots[1].heightIn===-28.125,`a bare zero in a marked export is not "unit-less" (${marked.unitSource}; ${marked.warnings.join(' ')})`);}
ok(tieDatum({kind:'typed',zeroElevationIn:36},-32.5).warnings.length===1&&tieDatum({kind:'typed',zeroElevationIn:32.5},-32.5).warnings.length===0,'a typed zero that disagrees with the measured corner is flagged');throwsLike(()=>tieDatum({kind:'typed',zeroElevationIn:150000}),/Check the units/,'a typed zero beyond the site limits is refused');
{const ground=g([[-60,.3,-31],[60,.3,-33],[200,.3,-35],[200,180,-44],[-60,180,-40],[70,100,-38]]);ok(checkReadings({ground,footprint:[{x:0,z:0},{x:144,z:0},{x:144,z:120},{x:0,z:120}]}).warnings.some(w=>/2 of 4 deck corners/.test(w)),'corners a hair outside the shots are not counted as covered');ok(createSiteSurface(validateSiteModel({version:1,points:ground.map((p,i)=>({id:`g${i}`,...p})),grading:[]}),terrain).sample(0,0,'existing')===undefined,'the surface engine agrees there is no ground there');}
{const name=Buffer.from('Points_a.csv'),bomb=(data:Buffer,method:0|8,declared:number)=>{const lh=Buffer.alloc(30),cd=Buffer.alloc(46),eocd=Buffer.alloc(22);lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(20,4);lh.writeUInt16LE(method,8);lh.writeUInt32LE(data.length,18);lh.writeUInt32LE(declared,22);lh.writeUInt16LE(name.length,26);cd.writeUInt32LE(0x02014b50,0);cd.writeUInt16LE(20,4);cd.writeUInt16LE(20,6);cd.writeUInt16LE(method,10);cd.writeUInt32LE(data.length,20);cd.writeUInt32LE(declared,24);cd.writeUInt16LE(name.length,28);eocd.writeUInt32LE(0x06054b50,0);eocd.writeUInt16LE(1,8);eocd.writeUInt16LE(1,10);eocd.writeUInt32LE(46+name.length,12);eocd.writeUInt32LE(30+name.length+data.length,16);return new Uint8Array(Buffer.concat([lh,name,data,cd,name,eocd]));};
 const deflated=bomb(deflateRawSync(Buffer.alloc(64*1024*1024),{level:9}),8,1000);quick(()=>readReadingFiles('b.zip',deflated),1500,'a 64 MB deflate bomb declaring 1000 bytes stops fast');throwsLike(()=>readReadingFiles('b.zip',deflated),/damaged/,'the bomb is reported as damaged');
 throwsLike(()=>readReadingFiles('s.zip',bomb(Buffer.alloc(4_000_000,65),0,1000)),/damaged/,'a stored entry that understates its size is refused');
 throwsLike(()=>readReadingFiles('n.zip',zipSync({'Points_a.csv':new Uint8Array(2048).map((_,i)=>(i*37)&255)})),/in the zip is not a text file/,'binary inside a zip is refused as not text');}
quick(()=>parseULevel(asFiles(pointsText,'Length:\nP1-P2,'+'1,'.repeat(64000)+'x')),200,'a 128 KB Lengths row cannot stall the reader');
quick(()=>isULevel([{name:'a.tsv',text:'P\tX'+'\t'.repeat(160000)+'Y\tZ\tComment\tExtra\n1\t2\t3\t4'}]),200,'a 160k-tab header cannot stall U-Level detection');
quick(()=>parseULevel(asFiles('P, X, Y, Z, Comment\n'+Array.from({length:80000},(_,i)=>`P1_${i}, ${i}, ${i%7}, -1, `).join('\n'))),500,'an 80,000-row Points file is refused before parsing');throwsLike(()=>parseULevel(asFiles('P, X, Y, Z, Comment\n'+Array.from({length:4001},(_,i)=>`P2_${i}, ${i}, ${i%7}, -1, `).join('\n'))),/4001 rows/,'too many rows names the count');
{const store=new Map<string,string>(),storage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>{store.set(k,v);}},base=presetFromMapping('Job',['Point','Elevation'],{name:0,height:1,unit:'in',decimal:'.',kind:'height-up',yAxis:'down'});
 throwsLike(()=>saveReadingPreset({...base,name:'x'.repeat(61)},storage),/60 characters/,'a long preset name gets its own message');throwsLike(()=>saveReadingPreset({...base,columns:{height:'h'.repeat(101)}},storage),/longer than 100/,'a long header gets its own message');}
throwsLike(()=>mergeSitePoints(Array.from({length:2000},(_,i)=>pt(`o${i}`,i*10,0)),[pt('new',5,500)],'append'),/up to 2000/,'merging past the 2000-point site limit is refused with a clear message');

// Round-2 review regressions: zips as real tools write them, and the fixes to the fixes.
{const zipOf=(entries:{name:string;data:Uint8Array;deflate?:boolean;flags?:number}[],opts:{descriptor?:boolean;signature?:boolean;comment?:string;count?:number}={})=>{
  const {descriptor=true,signature=true,comment=''}=opts,locals:Buffer[]=[],central:Buffer[]=[];let offset=0;
  for(const e of entries){const name=Buffer.from(e.name),body=e.deflate?deflateRawSync(e.data):Buffer.from(e.data),crc=crc32(e.data),flags=(descriptor?8:0)|(e.flags??0),method=e.deflate?8:0,lh=Buffer.alloc(30),cd=Buffer.alloc(46);
   lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(20,4);lh.writeUInt16LE(flags,6);lh.writeUInt16LE(method,8);if(!descriptor){lh.writeUInt32LE(crc,14);lh.writeUInt32LE(body.length,18);lh.writeUInt32LE(e.data.length,22);}lh.writeUInt16LE(name.length,26);
   const dd=Buffer.alloc(descriptor?signature?16:12:0);if(descriptor){let o=0;if(signature){dd.writeUInt32LE(0x08074b50,0);o=4;}dd.writeUInt32LE(crc,o);dd.writeUInt32LE(body.length,o+4);dd.writeUInt32LE(e.data.length,o+8);}
   cd.writeUInt32LE(0x02014b50,0);cd.writeUInt16LE(20,4);cd.writeUInt16LE(20,6);cd.writeUInt16LE(flags,8);cd.writeUInt16LE(method,10);cd.writeUInt32LE(crc,16);cd.writeUInt32LE(body.length,20);cd.writeUInt32LE(e.data.length,24);cd.writeUInt16LE(name.length,28);cd.writeUInt32LE(offset,42);
   locals.push(lh,name,body,dd);central.push(cd,name);offset+=30+name.length+body.length+dd.length;}
  const dir=Buffer.concat(central),c=Buffer.from(comment,'latin1'),eocd=Buffer.alloc(22);eocd.writeUInt32LE(0x06054b50,0);eocd.writeUInt16LE(opts.count??entries.length,8);eocd.writeUInt16LE(opts.count??entries.length,10);eocd.writeUInt32LE(dir.length,12);eocd.writeUInt32LE(offset,16);eocd.writeUInt16LE(c.length,20);
  return new Uint8Array(Buffer.concat([...locals,dir,eocd,c]));};
 const photo=new Uint8Array(300_000).map((_,i)=>(i*7919+13)%251);photo.set([0x50,0x4b,3,4],120_001);photo.set([0x50,0x4b,1,2],150_003);photo.set([0x50,0x4b,7,8],200_005);
 const csvs=[{name:'job/Points_10-05-26_14-18.csv',data:strToU8(pointsText),deflate:true},{name:'job/Lengths_10-05-26_14-18.csv',data:strToU8(lengthsText),deflate:true}],same=(f:TextFile[])=>f.length===2&&f[1].text===pointsText&&f[0].text===lengthsText;
 ok(same(readReadingFiles('a.zip',zipOf([{name:'job/IMG_2041.jpg',data:photo},...csvs]))),'data-descriptor zip whose photo holds PK signatures reads both CSVs');
 ok(same(readReadingFiles('a.zip',zipOf([...csvs,{name:'job/IMG_2041.jpg',data:photo,deflate:true}],{signature:false}))),'descriptors without their signature read exactly');
 ok(same(readReadingFiles('a.zip',zipOf([{name:'job/IMG_2041.jpg',data:photo},...csvs],{descriptor:false,comment:'made by PK\u0005\u0006 tools'}))),'an archive comment that contains an end-record signature');
 ok(same(readReadingFiles('a.zip',zipOf([{name:'inner.zip',data:zipSync({'Points_evil.csv':strToU8('P, X, Y, Z, Comment\nP1_1, 0, 0, 999,  ')})},...csvs]))),'a zip stored inside the zip is never read as outer entries');
 ok(readReadingFiles('a.zip',zipOf([{name:'Points_a.csv',data:strToU8('old')},{name:'Points_a.csv',data:strToU8(pointsText)}])).map(f=>f.text).join()===pointsText,'a repeated name keeps the later copy');
 ok(readReadingFiles('a.zip',zipOf([{name:'./Points_a.csv',data:strToU8(pointsText)},{name:'./Lengths_a.csv',data:strToU8(lengthsText)}])).length===2,'"./" paths (tar -C folder .) are read, not taken as hidden');
 {const bad=zipOf([{name:'Points_a.csv',data:strToU8(pointsText)}],{descriptor:false}),at=30+'Points_a.csv'.length+60;bad[at]=bad[at]===0x37?0x38:0x37;throwsLike(()=>readReadingFiles('a.zip',bad),/damaged/,'a corrupted stored CSV fails its CRC check');}
 throwsLike(()=>readReadingFiles('a.zip',zipOf([{name:'Points_a.csv',data:strToU8(pointsText),flags:1}])),/encrypted/,'password-protected zips get their own message');
 throwsLike(()=>readReadingFiles('a.zip',zipOf([{name:'Points_a.csv',data:strToU8(pointsText)}],{count:0xffff})),/ZIP64/,'ZIP64 archives get their own message');
 throwsLike(()=>readReadingFiles('a.zip',zipOf([{name:'Points_a.csv',data:new Uint8Array(5_000_001).fill(97)}],{descriptor:false})),/larger than 5 MB/,'an entry over 5 MB says so');
 throwsLike(()=>readReadingFiles('a.zip',zipOf([0,1,2].map(i=>({name:`n${i}.txt`,data:new Uint8Array(4_000_000).fill(97)})),{descriptor:false})),/more than 10 MB of text/,'more than 10 MB of text says so');}
quick(()=>csvRows('x'+'"'.repeat(320000)),300,'a long run of literal quotes parses in linear time');quick(()=>csvRows('h\n'+`6' 3" `.repeat(60000)),300,'a long cell of inch marks parses in linear time');
ok(isBare('-2½')&&isBare('–3.5')&&isBare('1.2E-05')&&!isBare('5 mm')&&!isBare(`2' 3"`)&&!isBare('7"'),'bare-number test follows the parser');
near(parseULevel(asFiles('P, X, Y, Z, Comment\nP2_1, 0, 0, -2½, \nP2_2, 10, 0, -3, \nP2_3, 0, 10, –4, '),{unit:'ft'}).shots[0].heightIn,-30,'a phone fraction in a decimal-feet export is scaled like any bare number');
throwsLike(()=>parseULevel(asFiles('P, X, Y, Z, Comment\nP1_1,-4,29,-18,33,-23,54,\nP1_2,-147,58,44,39,-34,12,')),/commas both between columns/,'a spaced header over tight decimal-comma rows is refused');
throwsLike(()=>parseULevel(asFiles('P,X,Y,Z\nP1_1,-4,29,-18,-23\nP1_2,-147,44,-34,-12')),/commas both between columns/,'a decimal-comma row only one field too wide is refused');
ok(parseULevel(asFiles('P,X,Y,Z,Comment\nP2_1,-4.29,-18.33,-23.54,12,14\nP2_2,-147.58,44.39,-34.12,\nP2_3,-155.79,37.70,-38.29,')).shots[0].comment==='12,14','a decimal-point file keeps a comment that is a list of numbers');
ok(parseULevel(asFiles(`P,X,Y,Z,Comment\nP2_1,"-6' 0 4/16""","6' 0 7/16""",0,Back Porch Step\nP2_2,"-7' 11 12/16""","5' 11 9/16""","-2' 4 2/16""",\nP2_3,"-10' 8 4/16""","7' 6 13/16""","-2' 11 11/16""",`)).shots[1].heightIn===-28.125,'a marked export re-saved with spreadsheet quoting reads');
ok(parseULevel([{name:'Points_12-31-25_23-50.csv',text:pointsText},{name:'Points_01-02-26_08-00.csv',text:pointsText}]).fileName==='Points_01-02-26_08-00.csv','the newest export is read across New Year');
{const step=pointsText.split(/\r?\n/).map((l,i)=>i===0||!l.trim()?l:l.replace(/(-?\d+\.\d+)/g,m=>(Number(m)*1.0822/12).toFixed(2))).join('\n'),ft=parseULevel(asFiles(step,"Length:\nP1-P2,14.1',-6.8%\nP2-P3,1.0',-38.8%\nP3-P1,14.6',9.1%"));ok(ft.lengthChecks.every(c=>c.ok)&&!ft.warnings.length,`decimal-feet slopes are judged against the printed precision (${ft.warnings.join(' ')})`);}

// The whole path from the emailed zip to a valid measured site.
{const imported=importReadings(readReadingFiles('ulevel.zip',fixtureBytes)),house=imported.lines.find(l=>l.closed)!,inLine=new Set(house.shotIds),fitFromFile=fitPlacement(proposeWallFit(imported.shots.filter(s=>inLine.has(s.id)).map(s=>({id:s.id,x:s.x!,z:s.z!})),imported.shots.filter(s=>!inLine.has(s.id)).map(s=>({x:s.x!,z:s.z!})),{x:-24,z:0})!.pairs);
 const rel=imported.shots.map(s=>{const p=applyTransform(fitFromFile.transform,{x:s.x!,z:s.z!});return {id:s.id,xIn:p.x,zIn:p.z,elevationIn:s.heightIn};}),c=createSiteSurface(validateSiteModel({version:1,points:rel,grading:[]}),terrain).sample(0,0,'existing'),t=tieDatum({kind:'door-sill'},c);
 near(t.sillIn,tie.sillIn!,'zip to site: the same 32.50 in sill through the file reader',1e-9);const final=validateSiteModel({version:1,points:rel.map(p=>({...p,elevationIn:p.elevationIn+t.offsetIn})),grading:[]});ok(final.points.length===11,'zip to site: 11 valid measured points');}

console.log(`Site readings: ${checks} checks passed (U-Level fixture: ${shots.length} shots, sill ${tie.sillIn!.toFixed(2)} in above the ground at the deck corner).`);
