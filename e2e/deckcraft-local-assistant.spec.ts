import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {DeckAgentApi} from '../src/features/deckcraft/designer/deckAgentController';
test.skip(process.env.DECKCRAFT_LOCAL_AI!=='1','Explicit local Ollama integration; no mock or cloud fallback.');
const out=resolve(process.cwd(),'../../outputs/deckcraft-contractor-ready-review/real-browser');mkdirSync(out,{recursive:true});
for(const phone of [false,true])test.describe(phone?'phone real local AI':'desktop real local AI',()=>{
 test.use({viewport:phone?{width:390,height:844}:{width:1440,height:1000},hasTouch:phone,isMobile:phone});
 test(`${phone?'@phone ':''}vague text goes through installed model to priced Apply and Undo`,async({context,page})=>{
  await context.addInitScript(()=>{(window as any).__name=(target:unknown)=>target;});
  await context.addInitScript(configuration=>{localStorage.clear();localStorage.setItem('golden-maple.deck-studio.deck-only.v1',JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration}));},{...DEFAULT_DECK,customerName:'Synthetic private client',projectAddress:'Synthetic private address',scopeOfWork:'Synthetic private scope'});
  await context.route('**/*',route=>{const r=route.request(),local=new URL(r.url()).origin===new URL(process.env.PLAYWRIGHT_BASE_URL??`http://127.0.0.1:${process.env.E2E_PORT??4319}`).origin;return local&&(r.method()==='GET'||r.method()==='HEAD'||r.url().includes('/.netlify/functions/deck-assistant'))?route.continue():route.fulfill({status:403,body:'Blocked external QA request'});});
  const read=()=>page.evaluate(()=>(window as unknown as {deckcraft:DeckAgentApi}).deckcraft.read());
  await page.goto('/deck-designer/');await expect.poll(()=>page.evaluate(()=>(window as unknown as {deckcraft?:DeckAgentApi}).deckcraft?.read().ready??false)).toBe(true);const before=await read();
  await page.getByRole('button',{name:'Describe a change',exact:true}).click();const dialog=page.getByRole('region',{name:'Design assistant',exact:true});await expect(dialog.locator('[data-source="local-ai"]')).toContainText('qwen3:14b');
  await dialog.getByRole('textbox',{name:'What would you like to change?',exact:true}).fill('Give the main deck a little more width, keeping the depth the same.');
  const modelResponse=page.waitForResponse(r=>r.url().includes('/.netlify/functions/deck-assistant')&&r.request().method()==='POST');await dialog.getByRole('button',{name:'Preview edit',exact:true}).click();const raw=await modelResponse,response=await raw.json(),sent=raw.request().postDataJSON();expect(raw.status()).toBe(200);expect(response.model).toBe('qwen3:14b');expect(response.plan.kind).toBe('edit');
  const serialized=JSON.stringify(sent.context);for(const privateValue of ['Synthetic private client','Synthetic private address','Synthetic private scope','materialMarkup','customLaborCost','pricing'])expect(serialized).not.toContain(privateValue);
  await expect(dialog.getByRole('region',{name:'Instruction preview'})).toBeVisible();await expect(dialog.getByRole('region',{name:'Interpretation assumptions'})).toBeVisible();expect((await read()).design).toEqual(before.design);const total=Number(await dialog.locator('[data-exact-total]').nth(1).getAttribute('data-exact-total'));
  await page.screenshot({path:resolve(out,`${phone?'phone':'desktop'}-real-ai-preview.png`)});await dialog.getByRole('button',{name:'Apply reviewed edit',exact:true}).click();await expect(dialog.getByRole('region',{name:'Applied interpretation'})).toBeVisible();const after=await read();expect(after.design.width).toBeGreaterThan(before.design.width);expect(after.design.width).toBeLessThanOrEqual(before.design.width*1.5);expect(after.design.length).toBe(before.design.length);expect(after.pricing.total).toBe(total);expect(after.revision).toBeGreaterThan(before.revision);expect(after.history.canUndo).toBe(true);
  await dialog.getByRole('button',{name:'Close instruction assistant'}).click();await page.getByRole('button',{name:'Undo',exact:true}).click();const undone=await read();expect(undone.design).toEqual(before.design);expect(undone.pricing).toEqual(before.pricing);
  writeFileSync(resolve(out,`${phone?'phone':'desktop'}-real-ai-result.json`),JSON.stringify({actualLocalModel:true,mocked:false,model:response.model,prompt:sent.prompt,plan:response.plan,before:{width:before.design.width,length:before.design.length,price:before.pricing.total},after:{width:after.design.width,length:after.design.length,price:after.pricing.total},undoRestoresDesign:true,undoRestoresPricing:true},null,2)+'\n');
 });
});
