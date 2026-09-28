import {test,expect,type Page} from '@playwright/test';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import type {DeckAgentApi} from '../src/features/deckcraft/designer/deckAgentController';
const read=(page:Page)=>page.evaluate(()=>(window as unknown as {deckcraft:DeckAgentApi}).deckcraft.read());
test('right-click applies a drawn area and breaker as one undoable edit each',async({page,context})=>{
 await context.addInitScript('window.__name=(target,value)=>target;');
 await context.addInitScript(configuration=>localStorage.setItem('golden-maple.deck-studio.deck-only.v1',JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration})),{...DEFAULT_DECK,deckType:'Freestanding',houseVisible:false,stairFlights:0,railingType:'None',width:20,length:12,deckingMaterial:'tt_prime_plus'});
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())?r.continue():r.fulfill({status:200,body:''}));
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/deck-designer/');await expect.poll(async()=>{try{return (await read(page)).ready;}catch{return false;}}).toBe(true);
 await page.getByRole('radio',{name:'Board layout',exact:true}).click();
 for(const mode of ['Select area','Add breaker']){
  const before=await read(page);await page.getByRole('button',{name:mode,exact:true}).click();
  const canvas=page.getByRole('group',{name:'Board layout selection canvas',exact:true});await canvas.scrollIntoViewIfNeeded();
  const [a,b]=await canvas.evaluate(el=>{const m=(el as SVGSVGElement).getScreenCTM()!;return [{x:40,y:30},{x:100,y:110}].map(p=>{const q=new DOMPoint(p.x,p.y).matrixTransform(m);return {x:q.x,y:q.y};});});
  await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:6});await page.mouse.up();
  expect((await read(page)).design).toEqual(before.design);
  await page.mouse.click(b.x,b.y,{button:'right'});
  const key=mode==='Select area'?'regions':'breakers';await expect.poll(async()=>(await read(page)).design.boardLayout?.[key].length??0).toBe(1);
  const current=await read(page);expect(current.history.canUndo).toBe(true);
  await page.getByRole('region',{name:'Save and restore design',exact:true}).getByRole('button',{name:'Undo',exact:true}).click();
  await expect.poll(async()=>JSON.stringify((await read(page)).design)).toBe(JSON.stringify(before.design));
 }
 expect(errors).toEqual([]);
});
