import {expect,test,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {AgentCommand,AgentResponse} from '../src/features/deckcraft/designer/deckAgentController';

const STORAGE='golden-maple.deck-studio.deck-only.v1';
test.beforeEach(async({context})=>{
  // Local proof only: prevent scripts, pixels, fonts and telemetry from contacting ANY external host.
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(['127.0.0.1','localhost','[::1]'].includes(url.hostname))return route.fallback();
    const type=route.request().resourceType();
    return route.fulfill({status:200,contentType:type==='stylesheet'?'text/css':type==='script'?'text/javascript':'text/plain',body:''});
  });
});
async function open(page:Page){await page.goto('/deck-designer/');await expect.poll(()=>page.evaluate(()=>window.deckcraft?.read().ready??false)).toBe(true);}
async function execute(page:Page,commands:AgentCommand[],id=`browser-${Date.now()}-${Math.random()}`){return page.evaluate(({commands,id})=>window.deckcraft!.execute({id,commands}),{commands,id});}
const good=(r:AgentResponse)=>{expect(r.ok,JSON.stringify(r)).toBe(true);if('error' in r)throw new Error(r.error.message);return r;};

test('agent previews leave autosave untouched; validated batch is acknowledged and reverses with one undo',async({page})=>{
  await open(page);await expect.poll(()=>page.evaluate(key=>!!localStorage.getItem(key),STORAGE)).toBe(true);
  const before=await page.evaluate(key=>({snapshot:window.deckcraft!.read(),saved:localStorage.getItem(key)}),STORAGE);
  const preview=good(await page.evaluate(()=>window.deckcraft!.preview({id:'preview-only',commands:[{type:'design.patch',patch:{width:24,length:18,skirting:{style:'Horizontal boards',clearanceIn:2}}}]})));
  expect(preview.snapshot.pricing.total).toBeGreaterThan(before.snapshot.pricing.total);expect(preview.snapshot.quotes.some(q=>/skirting/i.test(q))).toBe(true);
  expect(await page.evaluate(key=>localStorage.getItem(key),STORAGE)).toBe(before.saved);
  expect((await page.evaluate(()=>window.deckcraft!.read())).design).toEqual(before.snapshot.design);
  const changed=good(await execute(page,[{type:'design.patch',patch:{width:20}},{type:'design.patch',patch:{length:18}}],'atomic-edit'));
  expect(changed.snapshot.design.width).toBe(20);expect(changed.snapshot.design.length).toBe(18);expect(changed.snapshot.history.canUndo).toBe(true);
  await expect(page.getByRole('heading',{level:2}).filter({hasText:/20 × 18/}).first()).toBeVisible();
  const repeated=good(await execute(page,[{type:'design.patch',patch:{width:20}},{type:'design.patch',patch:{length:18}}],'atomic-edit'));expect(repeated.replayed).toBe(true);
  const undo=good(await execute(page,[{type:'history.undo'}]));expect(undo.snapshot.design).toEqual(before.snapshot.design);
  good(await execute(page,[{type:'history.redo'}]));
  await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).configuration.width,STORAGE)).toBe(20);
  await page.reload();await expect.poll(()=>page.evaluate(()=>window.deckcraft?.read().ready??false)).toBe(true);expect((await page.evaluate(()=>window.deckcraft!.read())).design.width).toBe(20);
});

test('agent rejects stale, unknown and private inputs; review is manual and never submits',async({page})=>{
  const posts:string[]=[];await page.route('**/*',async route=>{if(route.request().method()==='POST'){posts.push(route.request().url());await route.fulfill({status:200,body:'ok'});}else await route.fallback();});
  await open(page);
  const result=await page.evaluate(async()=>{
    const api=window.deckcraft!,revision=api.read().revision;
    const answers=await Promise.all([api.execute({id:'concurrent-first',expectedRevision:revision,commands:[{type:'design.patch',patch:{width:22}}]}),api.execute({id:'concurrent-second',expectedRevision:revision,commands:[{type:'design.patch',patch:{width:23}}]})]);
    const invalid=await api.execute({id:'unsafe',commands:[{type:'design.patch',patch:{width:NaN,customerName:'Do not expose'}}]});
    const unknown=await api.execute({id:'send',commands:[{type:'action',action:'send'}]});
    return {answers,invalid,unknown,snapshot:api.read()};
  });
  expect(result.answers[0].ok).toBe(true);expect(result.answers[1]).toMatchObject({ok:false,error:{code:'stale_revision'}});expect(result.invalid.ok).toBe(false);expect(result.unknown.ok).toBe(false);
  expect(result.snapshot.design).not.toHaveProperty('customerName');expect(result.snapshot.design).not.toHaveProperty('materialMarkup');
  good(await execute(page,[{type:'action',action:'review.open'}],'review-once'));await expect(page.getByRole('dialog').first()).toBeVisible();
  const replay=good(await execute(page,[{type:'action',action:'review.open'}],'review-once'));expect(replay.replayed).toBe(true);expect(posts,posts.join('\n')).toHaveLength(0);
});

test('agent edits all three boundaries, creates private-free share links and downloads actual files',async({page})=>{
  await open(page);good(await execute(page,[{type:'design.patch',patch:{levels:3}}]));
  const initial=await page.evaluate(()=>window.deckcraft!.read());
  const points=[{x:-12,y:0},{x:180,y:0},{x:192,y:84},{x:96,y:144},{x:-12,y:108}];
  for(const level of [1,2,3] as const){
    const r=good(await execute(page,[{type:'boundary.set',level,points},{type:'boundary.add',level,index:0},{type:'boundary.move',level,target:'point',index:1,dxIn:0,dyIn:6}]));
    expect(r.snapshot.boundaries.find(b=>b.level===level)!.points).toHaveLength(6);
  }
  const after=await page.evaluate(()=>window.deckcraft!.read());expect(after.boundaries[1].offset).toEqual(initial.boundaries[1].offset);expect(after.boundaries[2].offset).toEqual(initial.boundaries[2].offset);
  expect(after.pricing.total).toBeCloseTo(after.pricing.subtotal+after.pricing.hst,6);expect(after.quotes.some(q=>/custom.*outline|bespoke/i.test(q))).toBe(true);
  const share=good(await execute(page,[{type:'action',action:'share.create'}]));expect(share.result!.url).toContain('/deck-designer#d=');
  const [json]=await Promise.all([page.waitForEvent('download'),execute(page,[{type:'action',action:'save.json'}])]);const file=JSON.parse(readFileSync((await json.path())!,'utf8'));expect(file.configuration.deckOutlines.main).toHaveLength(6);
  const [obj]=await Promise.all([page.waitForEvent('download'),execute(page,[{type:'action',action:'export.obj'}])]);expect(readFileSync((await obj.path())!,'utf8')).toMatch(/\nv /);
  const shared=await page.context().newPage();await shared.goto(share.result!.url);await expect.poll(()=>shared.evaluate(()=>window.deckcraft?.read().ready??false)).toBe(true);expect((await shared.evaluate(()=>window.deckcraft!.read())).design.deckOutlines).toEqual(after.design.deckOutlines);await shared.close();
});

test('semantic Agent tools controls preview before apply and restore keyboard focus',async({page})=>{
  await open(page);const launcher=page.getByRole('button',{name:'Agents',exact:true});await launcher.click();
  const dialog=page.getByRole('dialog',{name:'Work with your agent'});await expect(dialog).toBeVisible();await expect(dialog).toContainText('Agent interface ready');
  if(process.env.DECK_AGENT_PROOF==='1')await page.screenshot({path:resolve('../../outputs/DeckCraft-agent-tools-desktop.png')});
  await expect(dialog.getByLabel('Structured agent command')).toBeHidden();await dialog.getByText('Advanced · structured commands',{exact:true}).click();
  const before=await page.evaluate(()=>window.deckcraft!.read());const value=JSON.stringify({id:'semantic-ui',expectedRevision:before.revision,commands:[{type:'design.patch',patch:{width:20}}]});
  await dialog.getByLabel('Structured agent command').fill(value);await dialog.getByRole('button',{name:'Preview command',exact:true}).click();await expect(dialog.getByLabel('Agent command result')).toContainText('"ok": true');expect((await page.evaluate(()=>window.deckcraft!.read())).design.width).toBe(before.design.width);
  await dialog.getByRole('button',{name:'Apply command',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.deckcraft!.read().design.width)).toBe(20);
  await page.keyboard.press('Escape');await expect(dialog).toBeHidden();await expect(launcher).toBeFocused();
});

test('agent tools fit phone and keep the regular editor available @phone',async({page})=>{
  await open(page);await page.getByRole('button',{name:'Agents',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Work with your agent'});await expect(dialog).toBeVisible();
  const fits=await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&el.scrollWidth<=el.clientWidth;});expect(fits).toBe(true);
  if(process.env.DECK_AGENT_PROOF==='1')await page.screenshot({path:resolve('../../outputs/DeckCraft-agent-tools-phone.png')});
  await dialog.getByRole('button',{name:'Close agent tools'}).click();await expect(dialog).toBeHidden();await expect(page.getByRole('button',{name:'Main deck point 1',exact:true})).toBeVisible();
});
