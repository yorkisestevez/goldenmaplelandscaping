import {test,expect,type Page,type Locator,type Route} from '@playwright/test';
import {readFileSync} from 'node:fs';
import type {DeckData} from '../src/features/deckcraft/types';
import type {DeckAgentApi} from '../src/features/deckcraft/designer/deckAgentController';
import type {DesignerAiRequest,DesignerAiResponse} from '../src/features/deckcraft/designer/siteDesignerAiContract';

/**
 * S5 "Design from my ground" on Craighurst extended: the real U-Level shots under the 12 × 5 ft deck plus SYNTHETIC
 * shots (SYN-*, labelled in the fixture's note) round it, so every design move has measured ground to land on. The
 * panel has to read the survey back in plain words, show 2–3 priced concepts, preview one in 3D without writing it,
 * apply one as a single change that one Undo gives back, and treat the AI designer as optional.
 *
 * The AI designer's endpoint is mocked exactly as server/aiTurnService.ts answers (no model is ever called): GET is the
 * status (200 {available, reason | remainingTurnsToday}; 200 {available:false, reason:'not_configured'} when no AI is
 * set up); POST validates a turn and answers 202 {ok, status:'pending', job, pollMs, remainingTurnsToday}, or refuses it
 * (429 rate_limited, 503 cap_reached or not_configured, each {ok:false, status:'error', error:{code, message}}); GET
 * ?job= is 200 {ok, status:'pending', pollMs} until the job is done, then 200 {ok, status:'done', response:{…, meta}}.
 */
const KEY='golden-maple.deck-studio.deck-only.v1',DESIGN=readFileSync('e2e/fixtures/craighurst-extended.json','utf8');
const AI='**/.netlify/functions/deck-designer-ai**';
const read=(page:Page)=>page.evaluate(()=>(window as unknown as {deckcraft:DeckAgentApi}).deckcraft.read());
const design=async(page:Page)=>(await read(page)).design as unknown as DeckData;
const ready=async(page:Page)=>expect.poll(()=>page.evaluate(()=>(window as unknown as {deckcraft?:DeckAgentApi}).deckcraft?.read().ready??false)).toBe(true);
/** What a concept can change: features, plantings and beds, the stair's landing, the deck. */
const yard=(d:DeckData)=>JSON.stringify({yardFeatures:d.yardFeatures??[],landscapeObjects:d.landscapeObjects??[],stairTargets:d.stairTargets??[],height:d.height,stairOffset:d.stairOffset});
const pieces=(d:DeckData)=>(d.yardFeatures??[]).length+(d.landscapeObjects??[]).length;
const undo=(page:Page)=>page.evaluate(async()=>{const api=(window as unknown as {deckcraft:DeckAgentApi}).deckcraft;return api.execute({id:`undo-${Date.now()}`,expectedRevision:api.read().revision,commands:[{type:'history.undo'}]});});
const json=(route:Route,status:number,body:unknown)=>route.fulfill({status,contentType:'application/json; charset=utf-8',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});

// The server's own refusal bodies (server/aiTurnService.ts MESSAGES).
const REFUSED={
 not_configured:{status:503,body:{ok:false,status:'error',error:{code:'not_configured',message:'The AI is not switched on here. The engine’s concepts and measured edits still work.'}}},
 cap_reached:{status:503,body:{ok:false,status:'error',error:{code:'cap_reached',message:'The AI has reached this month’s budget. The engine’s concepts and measured edits still work.'}}},
 rate_limited:{status:429,body:{ok:false,status:'error',error:{code:'rate_limited',message:'You have used today’s AI turns. They reset tomorrow; the engine’s concepts still work.'},remainingTurnsToday:0}},
} as const;
type Refusal=keyof typeof REFUSED;
/**
 * The designer endpoint as a job: each POST is answered by `turn` (its response, or a refusal), 202 with a job id, and
 * each job reports pending `pendingPolls` times (pollMs 2250, as the server asks for) before it is done. Returns what
 * the browser sent.
 */
async function mockDesigner(page:Page,{remaining=10,pendingPolls=0,turn}:{remaining?:number;pendingPolls?:number;turn:(req:DesignerAiRequest,n:number)=>DesignerAiResponse|Refusal}){
 const seen={posts:[] as DesignerAiRequest[],polls:0},jobs=new Map<string,{response:DesignerAiResponse;pending:number;left:number}>();
 let left=remaining;
 await page.route(AI,async route=>{
  const req=route.request(),url=new URL(req.url());
  if(req.method()==='POST'){
   const body=JSON.parse(req.postData()||'{}') as DesignerAiRequest;seen.posts.push(body);
   const answer=turn(body,seen.posts.length);
   if(typeof answer==='string'){const r=REFUSED[answer];return json(route,r.status,r.body);}
   left=Math.max(0,left-1);
   const id=`7c9e6679-7425-40de-944b-${String(seen.posts.length).padStart(12,'0')}`;jobs.set(id,{response:answer,pending:pendingPolls,left});
   return json(route,202,{ok:true,status:'pending',job:id,pollMs:1500,remainingTurnsToday:left});
  }
  const id=url.searchParams.get('job');
  if(id!==null){
   seen.polls++;const job=jobs.get(id);
   if(!job)return json(route,404,{ok:false,status:'error',error:{code:'not_found',message:'That AI request was not found.'}});
   if(job.pending-->0)return json(route,200,{ok:true,status:'pending',pollMs:2250});
   return json(route,200,{ok:true,status:'done',response:{...job.response,meta:{model:'claude-opus-5-5',costUsd:.31,remainingTurnsToday:job.left}}});
  }
  return json(route,200,{available:true,remainingTurnsToday:left});
 });
 return seen;
}

test.beforeEach(async({page,context})=>{
 await context.addInitScript('window.__name=(target,value)=>target;');
 await context.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[KEY,DESIGN] as const);
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())&&['GET','HEAD'].includes(r.request().method())?r.continue():r.fulfill({body:''}));
 // No cloud AI by default: the function answers as a site with no AI configured does (deck-designer-ai.ts).
 await context.route(AI,r=>r.request().method()==='GET'&&!new URL(r.request().url()).searchParams.has('job')?json(r,200,{available:false,reason:'not_configured'}):json(r,REFUSED.not_configured.status,REFUSED.not_configured.body));
 await page.goto('/deck-designer/');await ready(page);
 expect((await design(page)).siteModel?.points.length).toBeGreaterThan(40);
});

async function showProjectControls(page:Page){const show=page.getByRole('button',{name:'Show project controls',exact:true});if(await show.isVisible())await show.click();}
/** Backyard → "Design from my ground" → the panel. */
async function openSiteDesigner(page:Page){
 await showProjectControls(page);
 const nav=page.getByRole('navigation',{name:'Design tasks'}),open=nav.getByRole('button',{name:'Backyard',exact:true});
 if(!await open.isVisible())await nav.locator('details').filter({has:page.locator('button[aria-label="Backyard"]')}).locator('summary').click();
 await open.click();
 const entry=page.locator('.dd-yard-editor').getByRole('button',{name:'Design from my ground',exact:true});
 await entry.scrollIntoViewIfNeeded();await entry.click();await expect(entry).toHaveAttribute('aria-expanded','true');
 const panel=page.getByRole('region',{name:'Design from my ground',exact:true});
 await expect(panel).toBeVisible();await panel.scrollIntoViewIfNeeded();
 return panel;
}
async function showConcepts(panel:Locator){
 await panel.getByRole('button',{name:'Show concepts',exact:true}).click();
 await expect(panel).toHaveAttribute('data-state','done',{timeout:120_000});
}
const conceptCards=(panel:Locator)=>panel.getByRole('list',{name:'Concepts for your measured ground',exact:true}).locator(':scope > .dd-site-concept');
/** The option-delta words; quoted work counted by item, never per wall ("plus 3 items by quote"), never "$0". */
const PRICE=/^(?:[+−]\$[\d,]+(?: plus \d+ items? by quote)?|no change|\d+ items? by quote)(?: · \d+ fewer to quote)?$/;
const aiRegion=(panel:Locator)=>panel.getByRole('region',{name:'AI designer',exact:true});
async function ask(panel:Locator,words:string){
 const ai=aiRegion(panel);
 await ai.getByRole('textbox',{name:'Your words for the AI designer'}).fill(words);
 await ai.getByRole('button',{name:'Ask the AI designer',exact:true}).click();
}

test('Design from my ground reads the survey, shows priced concepts, previews one and applies it as one Undo step',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const panel=await openSiteDesigner(page),before=await design(page);
 // What the survey says, in plain sentences.
 await expect(panel.getByRole('list',{name:'What the survey says',exact:true}).locator('li').first()).toBeVisible({timeout:30_000});
 await showConcepts(panel);
 await expect(panel.locator('[data-baseline]')).toContainText(/^The design as it stands prices at \$[\d,]+ before HST/);
 const cards=conceptCards(panel);
 await expect.poll(()=>cards.count()).toBeGreaterThanOrEqual(2);
 expect(await cards.count()).toBeLessThanOrEqual(3);
 for(const card of await cards.all()){
  await expect(card).toContainText('Price effect before HST:');
  const effect=(await card.locator('.dd-sd-price').textContent())!.trim();
  expect(effect).toMatch(PRICE);
  expect(effect,'Never "$0" beside a quote').not.toMatch(/(?:^|[+−])\$0\b/);
  // Quoted work by item: a handful of items, each line still listed underneath.
  const quoted=card.locator('details.dd-sd-quotes');
  if(await quoted.count()){
   const items=Number(/^(\d+) items? still to quote$/.exec((await quoted.locator(':scope > summary').textContent())!.trim())?.[1]);
   expect(items).toBeGreaterThan(0);expect(items).toBeLessThanOrEqual(8);
   await quoted.locator(':scope > summary').click();
   await expect(quoted.getByRole('list',{name:'Items still to quote',exact:true}).locator(':scope > li')).toHaveCount(items);
   expect(effect).toMatch(new RegExp(`\\b${items} items? by quote`));
  }else await expect(card).toContainText('Adds nothing by quote.');
  // Scores as words, never raw numbers; nothing about trends while the trend table is a draft.
  const strengths=(await card.locator('.dd-sd-strengths').textContent())!.trim();
  expect(strengths).toMatch(/lowest cost|easiest to build|straightforward to build|a moderate build|a bigger build|within your budget|over your budget/i);
  expect(strengths).not.toMatch(/\b0?\.\d+\b|\btrend/i);
  await expect(card.getByRole('list',{name:'What it adds',exact:true}).locator('li').first()).toBeVisible();
  await expect(card.getByRole('button',{name:/^Apply: /})).toBeEnabled();
 }
 // A fire concept carries the Barrie fire rule.
 const fire=cards.filter({has:page.getByRole('listitem').filter({hasText:/^Fire room/})});
 if(await fire.count())await expect(fire.first().locator('.dd-sd-fire')).toContainText('Barrie');
 // Prefer a concept that adds features (an outdoor room or garden), so Apply visibly adds them.
 const adds=panel.getByRole('list',{name:'Concepts for your measured ground',exact:true}).locator(':scope > .dd-site-concept:not([data-goal="value"])');
 const card=await adds.count()?adds.first():cards.first(),addsFeatures=await adds.count()>0;
 const preview=card.getByRole('button',{name:/^Preview in 3D: /});
 if(await preview.count()){
  await preview.click();await expect(preview).toHaveAttribute('aria-pressed','true');
  await expect(panel.getByText(/^Showing “.+” in the 3D view\./)).toBeVisible({timeout:30_000});
  expect(yard(await design(page)),'A preview writes nothing').toEqual(yard(before));
 }
 await card.getByRole('button',{name:/^Apply: /}).click();
 await expect.poll(async()=>yard(await design(page))).not.toEqual(yard(before));
 const applied=await design(page);
 if(addsFeatures)expect(pieces(applied),'The concept’s features are in the design').toBeGreaterThan(pieces(before));
 // The panel resets for the new design, says what happened and points to the manual editors and the assistant.
 await expect(panel).toHaveAttribute('data-state','idle');
 await expect(panel.getByRole('status').filter({hasText:/^Applied: /})).toBeVisible();
 await expect(panel.getByText(/^Now make it yours:/)).toContainText('make the fire pit a gas table');
 // One Undo restores the whole concept.
 expect((await undo(page)).ok).toBe(true);
 await expect.poll(async()=>yard(await design(page))).toEqual(yard(before));
 expect(errors).toEqual([]);
});

test('the AI designer’s pick comes back from a polled job, highlighted and priced, and applies as one change',async({page})=>{
 const EXPLANATION='Your yard falls away from the house, so the fire room sits on the flattest ground, closest to the door.';
 const HIGHLIGHTS=['Flattest ground for the fire room','Gas, so no burn permit'],QUESTION='Would you like the seat wall a little higher?';
 const seen=await mockDesigner(page,{remaining:10,pendingPolls:1,turn:req=>{
  const c=req.concepts.find(x=>x.goal==='entertaining')??req.concepts[0];
  return {kind:'choice',choice:{base:c.id,include:c.moves.map(m=>m.kind),params:{}},explanation:EXPLANATION,highlights:HIGHLIGHTS,questions:[QUESTION]};
 }});
 const panel=await openSiteDesigner(page),before=await design(page),ai=aiRegion(panel);
 await expect(ai.getByText('10 AI designer turns left today.')).toBeVisible({timeout:30_000});
 await ask(panel,'A fire pit for evenings with friends, under $40,000');
 const pick=ai.locator('.dd-site-concept[data-pick="ai"]');
 await expect(pick).toBeVisible({timeout:120_000});
 await expect(panel).toHaveAttribute('data-turn','done:designed');
 // One turn: a design request the server's validator takes, then the job polled until it was done.
 expect(seen.posts).toHaveLength(1);
 const sent=seen.posts[0];
 expect(sent).toMatchObject({version:1,mode:'design',prompt:'A fire pit for evenings with friends, under $40,000'});
 expect(sent.concepts.length).toBeGreaterThanOrEqual(2);expect(sent.conversation).toBeUndefined();
 expect(seen.polls).toBeGreaterThanOrEqual(2);
 await expect(pick.locator('.dd-sd-pick-label')).toHaveText('AI designer’s pick');
 await expect(pick).toContainText(EXPLANATION);
 for(const h of HIGHLIGHTS)await expect(pick.getByRole('list',{name:'Highlights'})).toContainText(h);
 await expect(pick.getByRole('list',{name:'Questions from the AI designer'})).toContainText(QUESTION);
 const effect=(await pick.locator('.dd-sd-price').textContent())!.trim();
 expect(effect).toMatch(PRICE);expect(effect).not.toMatch(/(?:^|[+−])\$0\b/);
 // The turns left come from the answer itself.
 await expect(ai.getByText('9 AI designer turns left today.')).toBeVisible();
 // The engine's own concepts came with the answer: they stand below without "Show concepts".
 await expect.poll(()=>conceptCards(panel).count()).toBeGreaterThanOrEqual(2);
 // The pick applies like any concept: one change, one Undo.
 await pick.getByRole('button',{name:/^Apply: /}).click();
 await expect.poll(async()=>yard(await design(page))).not.toEqual(yard(before));
 await expect(panel.getByRole('status').filter({hasText:/^Applied: /})).toBeVisible();
 expect((await undo(page)).ok).toBe(true);
 await expect.poll(async()=>yard(await design(page))).toEqual(yard(before));
});

test('the AI designer asks first, hears the answer, and when its choice does not check out the engine’s concept stands',async({page})=>{
 const QUESTION='A fire room for evenings, or beds for growing food?';
 const seen=await mockDesigner(page,{remaining:10,turn:(req,n)=>n===1
  ?{kind:'clarify',explanation:'Two directions fit your yard.',highlights:[],questions:[QUESTION]}
  // Then a choice the engine cannot build (a seat wall needs a fire room), on the design turn and again on the revision.
  :{kind:'choice',choice:{base:'slope',include:['seat-wall'],params:{}},explanation:'Just a seat wall.',highlights:[],questions:[]}});
 const panel=await openSiteDesigner(page),before=await design(page),ai=aiRegion(panel);
 await expect(ai.getByText('10 AI designer turns left today.')).toBeVisible({timeout:30_000});
 await ask(panel,'Something nice for the back yard');
 await expect(panel).toHaveAttribute('data-turn','done:clarify',{timeout:120_000});
 await expect(ai.getByRole('list',{name:'Questions from the AI designer'})).toContainText(QUESTION);
 await expect(ai.locator('.dd-site-concept')).toHaveCount(0);
 await expect(ai.getByText('9 AI designer turns left today.')).toBeVisible();
 // The answer goes back with the conversation so far.
 await ask(panel,'Just somewhere to sit, please');
 await expect(panel).toHaveAttribute('data-turn','done:fallback',{timeout:120_000});
 expect(seen.posts.map(p=>p.mode)).toEqual(['design','design','revise']);
 expect(seen.posts[1].conversation).toEqual([{role:'user',text:'Something nice for the back yard'},{role:'assistant',text:`Two directions fit your yard. ${QUESTION}`}]);
 expect(seen.posts[2].previous?.findings.some(f=>/needs the fire room/.test(f))).toBe(true);
 // The engine's own concept, labelled as the engine's (never the AI's pick), with a plain note; still applies.
 const fallback=ai.locator('.dd-site-concept[data-pick="fallback"]');
 await expect(fallback.locator('.dd-sd-pick-label')).toHaveText('The engine’s concept');
 await expect(fallback).toContainText(/engine’s own concept it started from/);
 await expect(ai.locator('.dd-site-concept[data-pick="ai"]')).toHaveCount(0);
 await expect(ai.getByText('7 AI designer turns left today.')).toBeVisible();
 await fallback.getByRole('button',{name:/^Apply: /}).click();
 await expect.poll(async()=>yard(await design(page))).not.toEqual(yard(before));
 expect((await undo(page)).ok).toBe(true);
 await expect.poll(async()=>yard(await design(page))).toEqual(yard(before));
});

for(const [name,body,line] of [
 ['not configured',{available:false,reason:'not_configured'},/isn’t switched on for this site yet/],
 ['resting after the monthly cap',{available:false,reason:'cap_reached'},/resting until next month/],
 ['out of turns for today',{available:false,reason:'rate_limited'},/used today’s AI designer turns/],
] as const){
 test(`with the AI designer ${name}, the panel says why in one line and the concepts still work`,async({page})=>{
  await page.route(AI,r=>json(r,200,body));
  const panel=await openSiteDesigner(page),ai=aiRegion(panel);
  await expect(ai.locator('.dd-sd-ai-off')).toHaveText(line,{timeout:30_000});
  await expect(ai.getByRole('textbox')).toHaveCount(0);
  await expect(ai.getByRole('button',{name:'Ask the AI designer'})).toHaveCount(0);
  await showConcepts(panel);
  await expect.poll(()=>conceptCards(panel).count()).toBeGreaterThanOrEqual(1);
 });
}

for(const [code,line] of [['rate_limited',/used today’s AI designer turns/],['cap_reached',/resting until next month/],['not_configured',/isn’t switched on for this site yet/]] as const){
 test(`when the server refuses a turn (${code}), the AI designer goes off with its line and the engine’s concepts stand`,async({page})=>{
  const seen=await mockDesigner(page,{remaining:3,turn:()=>code});
  const panel=await openSiteDesigner(page),ai=aiRegion(panel);
  await expect(ai.getByText('3 AI designer turns left today.')).toBeVisible({timeout:30_000});
  await ask(panel,'A fire pit for evenings with friends');
  await expect(panel).toHaveAttribute('data-turn','done:engine-only',{timeout:120_000});
  expect(seen.posts).toHaveLength(1);expect(seen.polls).toBe(0);
  await expect(ai.locator('.dd-sd-ai-off')).toHaveText(line);
  await expect(ai.getByRole('textbox')).toHaveCount(0);
  await expect.poll(()=>conceptCards(panel).count()).toBeGreaterThanOrEqual(2);
 });
}

test('Elevations & build → Ground & grading opens the same panel',async({page})=>{
 await showProjectControls(page);
 const tasks=page.getByRole('group',{name:'Elevation tasks',exact:true});
 if(!await tasks.isVisible())await page.getByRole('button',{name:'Elevations & build',exact:true}).click();
 await tasks.getByRole('button',{name:'Ground & grading',exact:true}).click();
 const entry=page.locator('.dd-elevation-workspace').getByRole('button',{name:'Design from my ground',exact:true});
 await entry.scrollIntoViewIfNeeded();await entry.click();await expect(entry).toHaveAttribute('aria-expanded','true');
 const panel=page.getByRole('region',{name:'Design from my ground',exact:true});
 await expect(panel.getByRole('button',{name:'Show concepts',exact:true})).toBeEnabled();
});

test('@phone Design from my ground keeps every control at least 44 px and fits a 375 px screen',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 const panel=await openSiteDesigner(page);
 await showConcepts(panel);
 // Open each card's quote list too, so its own controls are measured.
 for(const summary of await panel.locator('details.dd-sd-quotes > summary').all()){await summary.scrollIntoViewIfNeeded();await summary.click();}
 for(const control of await panel.locator('button,select,summary,textarea,input[type=text],label.dd-sd-check').all()){
  if(!await control.isVisible())continue;await control.scrollIntoViewIfNeeded();const box=(await control.boundingBox())!;
  expect(box.height,await control.evaluate(e=>e.outerHTML.slice(0,100))).toBeGreaterThanOrEqual(44);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 expect(await panel.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
});
