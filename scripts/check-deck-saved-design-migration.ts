import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../src/features/deckcraft/lib/inlayGeometryRuntime';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {CURRENT_BUILD_RULES,usesCurrentBuildRules} from '../src/features/deckcraft/buildRules';
import {parseDesign,serializeDesign,validateDesign} from '../src/features/deckcraft/designPersistence';
import {calculateDeckReleaseEstimate,deckReleaseData,parseDeckReleaseDesign,serializeDeckReleaseDesign} from '../src/features/deckcraft/deckRelease';
import {decodeDesignLinkFile,designLinkJson} from '../src/features/deckcraft/designLink';
import {captureJobRevision,parseJobLibrary,parsePrivateProject,serializePrivateProject} from '../src/features/deckcraft/designer/jobRevisionLibrary';
import {ensureDesignExtensions,ensureLiveDesignExtensions} from '../src/features/deckcraft/designExtensions';
import {pictureFrameOverhang} from '../src/features/deckcraft/lib/finishedFootprint';
import {createDeckAgentController,type AgentResponse,type DeckAgentHostState} from '../src/features/deckcraft/designer/deckAgentController';
import type {DeckData} from '../src/features/deckcraft/types';

/**
 * Saved designs reopen at the price they were saved at. Production never wrote a takeoff-rules marker or (unless the
 * user set one) a picture-frame overhang, and a missing overhang meant 1.5 in. Every way a design comes back (a saved
 * file or autosave, a share link, a job-library revision) must therefore reopen an old save on the 'legacy' rules with
 * a 1.5 in overhang, keep both when it is saved again, and price it exactly as 9b2ee11 (= production) did. A new design
 * starts on the current rules and keeps them through the same round trips, and through the assistant's whole-design
 * replace, which rebuilds the design from the command alone and so passes through the same parser.
 *
 * The old saves are frozen in scripts/fixtures/deck-saved-designs-9b.json (written and priced by 9b2ee11); never
 * regenerate them from current code.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert.ok(value,message);checks++;};
const same=(a:number,b:number)=>Math.abs(a-b)<.005;
interface Saved {name:string;file:string;total:number;link?:string;linkTotal?:number;revision?:Record<string,unknown>;revisionTotal?:number}
const {designs}=JSON.parse(readFileSync(new URL('./fixtures/deck-saved-designs-9b.json',import.meta.url),'utf8')) as {designs:Saved[]};
const b64=(text:string)=>Buffer.from(text).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const configOf=(text:string)=>(JSON.parse(text) as {configuration:Record<string,unknown>}).configuration;
const fileOf=(configuration:Record<string,unknown>)=>JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration});
const total=(d:DeckData)=>calculateDeckReleaseEstimate(d).total;
/** Opens a saved file the way the studio does (useDeckDesign: extensions, release parse, live extensions). */
async function openFile(text:string){await ensureDesignExtensions(JSON.parse(text));const d=parseDeckReleaseDesign(text);await ensureLiveDesignExtensions(d);return d;}
async function openLink(json:string){const d=(await decodeDesignLinkFile('1j'+b64(json))).design;await ensureLiveDesignExtensions(d);return d;}
async function openRevision(data:unknown){
  const library=parseJobLibrary({format:'golden-maple-deck-jobs',version:1,jobs:[{id:'job-a',name:'Job A',revisions:[{id:'revision-a',name:'Revision A',savedAt:'2026-10-01T12:00:00.000Z',data}]}]});
  const d=library.jobs[0].revisions[0].data;await ensureLiveDesignExtensions(d);return d;
}

// 1. The markers a reopened old save carries.
const framed=designs.find(d=>d.name==='frame/rows1-no-overhang')!,old=configOf(framed.file);
ok(!('buildRules' in old)&&!('pictureFrameOverhangIn' in old)&&old.pictureFrameRows===1,'The fixture is a production save: a one-row frame with no marker and no overhang key');
const reopened=parseDesign(framed.file);
ok(reopened.buildRules==='legacy'&&!usesCurrentBuildRules(reopened),'An old save reopens on the legacy takeoff rules, written explicitly');
ok(reopened.pictureFrameOverhangIn===1.5&&pictureFrameOverhang(reopened)===1.5,'An old framed save keeps the 1.5 in overhang it was priced with, written explicitly');
ok(reopened.pictureFrameRows===1,'An old save keeps its own border rows');
const spread={...structuredClone(DEFAULT_DECK),...reopened};
ok(spread.buildRules==='legacy'&&spread.pictureFrameOverhangIn===1.5,'A {...DEFAULT_DECK,...design} spread cannot move an old save onto the new rules or the flush overhang');
const flush=designs.find(d=>d.name==='frame/rows1-overhang0')!;
ok(parseDesign(flush.file).pictureFrameOverhangIn===0,'An overhang the user set is kept as saved');
const {pictureFrameRows:_rows,...noRows}=old;
ok(parseDesign(fileOf(noRows)).pictureFrameRows===0,'A file without border rows predates the one-row default and has no frame');
ok(parseDesign(fileOf({})).pictureFrameRows===0&&parseDesign(fileOf({})).buildRules==='legacy'&&parseDesign(fileOf({})).pictureFrameOverhangIn===1.5,'An empty configuration opens as a production default did: no frame, legacy rules, 1.5 in');
const slate=configOf(designs.find(d=>d.name==='legacy:border/1-dark-slate')!.file);delete slate.pictureFrameRows;
ok(parseDesign(fileOf(slate)).pictureFrameRows===1,'A Dark Slate border without saved rows still gets its border row');
const {buildRules:_marker,pictureFrameOverhangIn:_overhang,...bare}=structuredClone(DEFAULT_DECK);
const job=validateDesign(bare);
ok(job.buildRules==='legacy'&&job.pictureFrameOverhangIn===1.5,'validateDesign (job revisions, edits) gives a design without the keys the same legacy markers');
ok(validateDesign({...bare,buildRules:undefined}).buildRules==='legacy','An explicit undefined marker is the same as none');
const {pictureFrameRows:_bareRows,...bareNoBorder}=bare;
for(const [label,run] of [['validateDesign',(c:Record<string,unknown>)=>validateDesign(c)],['parseDesign',(c:Record<string,unknown>)=>parseDesign(fileOf(c))]] as const){
  const current=run({...bareNoBorder,buildRules:CURRENT_BUILD_RULES}),legacy=run({...bareNoBorder,buildRules:'legacy'});
  ok(current.buildRules===CURRENT_BUILD_RULES&&current.pictureFrameRows===DEFAULT_DECK.pictureFrameRows&&current.pictureFrameOverhangIn===DEFAULT_DECK.pictureFrameOverhangIn,`${label}: current-rules input that leaves out the border keys keeps the new-design defaults (one flush row)`);
  ok(legacy.pictureFrameRows===0&&legacy.pictureFrameOverhangIn===1.5,`${label}: legacy input that leaves them out gets the production defaults (no frame, 1.5 in)`);
}
for(const value of ['bogus','LEGACY',null,2026,true])for(const run of [()=>parseDesign(fileOf({...old,buildRules:value})),()=>validateDesign({...bare,buildRules:value})])assert.throws(run,/Unsupported buildRules/,`buildRules ${String(value)} is refused`),checks++;
ok(parseDesign(fileOf({...old,buildRules:'legacy'})).buildRules==='legacy'&&parseDesign(fileOf({...old,buildRules:CURRENT_BUILD_RULES})).buildRules===CURRENT_BUILD_RULES,'Both takeoff rules are accepted as saved');

// 2. A new design starts on the current rules and keeps them through a file, a link and a job revision.
const fresh=deckReleaseData(structuredClone(DEFAULT_DECK)),freshTotal=total(fresh),freshFile=configOf(serializeDesign(fresh));
ok(DEFAULT_DECK.buildRules===CURRENT_BUILD_RULES&&usesCurrentBuildRules(fresh),'A new design starts on the current takeoff rules');
ok(freshFile.buildRules===CURRENT_BUILD_RULES&&freshFile.pictureFrameOverhangIn===0&&freshFile.pictureFrameRows===1,'A new design file writes the current rules, a flush overhang and its one-row frame');
const freshBack=await openFile(serializeDeckReleaseDesign(fresh));
ok(freshBack.buildRules===CURRENT_BUILD_RULES&&freshBack.pictureFrameOverhangIn===0&&same(total(freshBack),freshTotal),'A new design file reopens on the current rules at the same price');
ok(serializeDeckReleaseDesign(freshBack)===serializeDeckReleaseDesign(fresh),'Saving a reopened new design writes the same file');
const freshLink=await openLink(designLinkJson(fresh));
ok(freshLink.buildRules===CURRENT_BUILD_RULES&&same(total(freshLink),freshTotal),'A new design share link reopens on the current rules at the same price');
const freshRevision=captureJobRevision(fresh,'New'),freshJob=await openRevision(JSON.parse(JSON.stringify(freshRevision.data)));
ok(freshRevision.data.buildRules===CURRENT_BUILD_RULES&&freshJob.buildRules===CURRENT_BUILD_RULES&&same(total(freshJob),freshTotal),'A new design job revision keeps the current rules at the same price');
ok(parsePrivateProject(serializePrivateProject(fresh)).buildRules===CURRENT_BUILD_RULES,'A new private project keeps the current rules');

// 3. The assistant's design.replace rebuilds the design from the command, so an omitted marker or border key must not
// move a design between rules: an identity replace keeps the rules, border and price of a new and of an old design.
// (deckAgentEdits.ts must carry the current design's buildRules into the candidate; see buildRules.ts.)
const pending:string[]=[];
async function replaced(start:DeckData,omit:string[]){
  let state:DeckAgentHostState={data:start,view:'plan',openSections:[],canUndo:false,canRedo:false,ready:true};
  const api=createDeckAgentController({getState:()=>state,commitDesign:next=>{state={...state,data:next};},undo(){},redo(){},runAction:async()=>({})} as unknown as Parameters<typeof createDeckAgentController>[0]);
  const design={...api.read().design} as Record<string,unknown>;for(const key of omit)delete design[key];
  const r:AgentResponse=await api.preview({id:`replace-${omit.join('-')||'all'}`,commands:[{type:'design.replace',design:design as never}]});api.dispose();return r;
}
const oldStart=await openFile(framed.file);
for(const [label,start,omit] of [
  ['new design, snapshot as read',fresh,[]],['new design, marker and border defaults left out',fresh,['buildRules','pictureFrameRows','pictureFrameOverhangIn']],
  ['old save, snapshot as read',oldStart,[]],['old save, marker left out',oldStart,['buildRules']],
] as [string,DeckData,string[]][]){
  const r=await replaced(start,omit);checks++;
  if('error' in r){pending.push(`${label}: refused (${r.error.code}: ${r.error.message})`);continue;}
  const d=r.snapshot.design,want=[start.buildRules,start.pictureFrameRows,start.pictureFrameOverhangIn],got=[d.buildRules,d.pictureFrameRows,d.pictureFrameOverhangIn];
  if(JSON.stringify(got)!==JSON.stringify(want)||!same(r.snapshot.pricing.total,total(start)))pending.push(`${label}: rules/rows/overhang ${JSON.stringify(got)} at ${r.snapshot.pricing.total.toFixed(2)}, expected ${JSON.stringify(want)} at ${total(start).toFixed(2)}`);
}

// 4. Every frozen old save reopens at its 9b2ee11 price by every route, and stays legacy when saved again.
const misses:string[]=[];
const price=(route:string,name:string,d:DeckData,expected:number)=>{if(!same(total(d),expected))misses.push(`${name} (${route}): ${total(d).toFixed(2)} vs 9b ${expected.toFixed(2)}`);checks++;};
let links=0,revisions=0;
for(const saved of designs){
  const cfg=configOf(saved.file),overhang=(cfg.pictureFrameOverhangIn as number|undefined)??1.5;
  ok(!('buildRules' in cfg),`${saved.name}: the frozen save has no takeoff-rules marker`);
  const d=await openFile(saved.file);
  ok(d.buildRules==='legacy'&&d.pictureFrameOverhangIn===overhang,`${saved.name}: reopens on legacy rules with the overhang it was priced with (${overhang} in)`);
  price('file',saved.name,d,saved.total);
  const again=serializeDeckReleaseDesign(d),cfgAgain=configOf(again);
  ok(cfgAgain.buildRules==='legacy'&&cfgAgain.pictureFrameOverhangIn===overhang,`${saved.name}: saving it again keeps the legacy marker and its overhang`);
  const back=await openFile(again);price('file re-saved',saved.name,back,saved.total);
  ok(serializeDeckReleaseDesign(back)===again,`${saved.name}: a second save is identical`);
  if(saved.link){links++;
    const l=await openLink(saved.link);
    ok(l.buildRules==='legacy'&&l.pictureFrameOverhangIn===overhang,`${saved.name}: an old share link reopens on legacy rules`);price('link',saved.name,l,saved.linkTotal!);
    const shared=JSON.parse(designLinkJson(l)) as {configuration:Record<string,unknown>};
    ok(shared.configuration.buildRules==='legacy','A link shared again from an old save keeps the legacy marker');
    price('link re-shared',saved.name,await openLink(JSON.stringify(shared)),saved.linkTotal!);
  }
  if(saved.revision){revisions++;
    ok(!('buildRules' in saved.revision)&&('pictureFrameOverhangIn' in saved.revision)===('pictureFrameOverhangIn' in cfg),`${saved.name}: the frozen revision has no marker, and an overhang only where the file has one`);
    const r=await openRevision(structuredClone(saved.revision));
    ok(r.buildRules==='legacy'&&r.pictureFrameOverhangIn===overhang,`${saved.name}: an old job revision reopens on legacy rules`);price('job revision',saved.name,r,saved.revisionTotal!);
    const kept=captureJobRevision(r,'Saved again');
    ok(kept.data.buildRules==='legacy','A job revision saved again from an old save keeps the legacy marker');
    price('job revision re-saved',saved.name,await openRevision(JSON.parse(JSON.stringify(kept.data))),saved.revisionTotal!);
    ok(parsePrivateProject(serializePrivateProject(r)).buildRules==='legacy','A private project saved from an old revision keeps the legacy marker');
  }
}
const failures=[...pending.map(p=>`assistant replace: ${p}`),...misses.map(m=>`9b price: ${m}`)];
assert.equal(failures.length,0,`An identity assistant replace must keep a design's rules and price, and old saves must reopen at their 9b2ee11 price:\n  ${failures.join('\n  ')}`);
ok(links>=5&&revisions>=5,'Links and job revisions are both exercised');
console.log(`SAVED-DESIGN MIGRATION OK — ${designs.length} frozen saves (${links} links, ${revisions} job revisions) reopen on legacy rules at their 9b2ee11 price; new designs keep '${CURRENT_BUILD_RULES}', also through an assistant replace; ${checks} checks.`);
