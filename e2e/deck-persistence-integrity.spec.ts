import {test,expect,type Page} from '@playwright/test';
import type {DeckAgentApi,AgentCommand} from '../src/features/deckcraft/designer/deckAgentController';
const read=(page:Page)=>page.evaluate(()=>(window as unknown as {deckcraft:DeckAgentApi}).deckcraft.read());
const ready=async(page:Page)=>expect.poll(()=>page.evaluate(()=>(window as unknown as {deckcraft?:DeckAgentApi}).deckcraft?.read().ready??false)).toBe(true);
let request=0;
async function execute(page:Page,commands:AgentCommand[]){const result=await page.evaluate(({commands,id})=>{const api=(window as unknown as {deckcraft:DeckAgentApi}).deckcraft;return api.execute({id,expectedRevision:api.read().revision,commands});},{commands,id:'integrity-'+ ++request});expect(result.ok,JSON.stringify(result)).toBe(true);return read(page);}
const saved=async(page:Page)=>expect(page.locator('[data-autosave-state="saved"]')).toHaveCount(1);
test.beforeEach(async({context})=>{await context.addInitScript('window.__name=(target,value)=>target;');await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())&&['GET','HEAD'].includes(r.request().method())?r.continue():r.fulfill({body:''}));});
test('preview is nonmutating; independent edits undo, redo and reload from committed storage',async({page})=>{
 await page.goto('/deck-designer/');await ready(page);await saved(page);const original=await read(page);
 const preview=await page.evaluate(()=>{const api=(window as unknown as {deckcraft:DeckAgentApi}).deckcraft;return api.preview({id:'integrity-preview',expectedRevision:api.read().revision,commands:[{type:'design.patch',patch:{width:23}}]});});expect(preview.ok).toBe(true);expect((await read(page)).design).toEqual(original.design);expect((await read(page)).history).toEqual(original.history);
 const first=await execute(page,[{type:'design.patch',patch:{width:23}}]);const second=await execute(page,[{type:'design.patch',patch:{length:17}}]);
 expect((await execute(page,[{type:'history.undo'}])).design).toEqual(first.design);expect((await execute(page,[{type:'history.undo'}])).design).toEqual(original.design);
 await execute(page,[{type:'history.redo'}]);expect((await execute(page,[{type:'history.redo'}])).design).toEqual(second.design);await saved(page);
 await page.reload();await ready(page);expect((await read(page)).design).toEqual(second.design);expect((await read(page)).history.canUndo).toBe(false);
 const stale=await page.evaluate(revision=>{const api=(window as unknown as {deckcraft:DeckAgentApi}).deckcraft;return api.execute({id:'integrity-stale',expectedRevision:revision-1,commands:[{type:'design.patch',patch:{width:9}}]});},(await read(page)).revision);expect(stale.ok).toBe(false);expect((await read(page)).design).toEqual(second.design);
});
test('a competing tab cannot overwrite the committed design or report Saved',async({page,context})=>{
 await page.goto('/deck-designer/');await ready(page);await saved(page);const other=await context.newPage();await other.goto('/deck-designer/');await ready(other);await saved(other);
 const committed=await execute(page,[{type:'design.patch',patch:{width:27}}]);await saved(page);
 await execute(other,[{type:'design.patch',patch:{width:19}}]);await expect(other.locator('[data-autosave-state="error"]')).toHaveCount(1);await expect(other.getByText(/This project changed in another tab/)).toHaveCount(1);
 await page.reload();await ready(page);expect((await read(page)).design).toEqual(committed.design);
 await other.reload();await ready(other);expect((await read(other)).design).toEqual(committed.design);
});

test('unreadable legacy bytes remain protected through edits and reload',async({page,context})=>{
 const key='golden-maple.deck-studio.deck-only.v1',raw='{ broken design \n keep these exact bytes Équipe';
 await context.addInitScript(({key,raw})=>{if(localStorage.getItem(key)===null)localStorage.setItem(key,raw);},{key,raw});
 await page.goto('/deck-designer/');await ready(page);await expect(page.locator('.dd-save-state')).toContainText('Auto-save paused');
 await execute(page,[{type:'design.patch',patch:{width:29}}]);await page.waitForTimeout(650);expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(raw);
 expect(await page.evaluate(()=>new Promise(resolve=>{const open=indexedDB.open('golden-maple.deckcraft-projects.v1');open.onsuccess=()=>{const db=open.result,tx=db.transaction('projects'),request=tx.objectStore('projects').get('current');request.onsuccess=()=>resolve(request.result??null);tx.oncomplete=()=>db.close();};}))).toBeNull();
 await page.reload();await ready(page);await expect(page.locator('.dd-save-state')).toContainText('Auto-save paused');expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(raw);
});
