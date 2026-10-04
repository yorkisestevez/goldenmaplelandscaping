import {test,expect,type Page} from '@playwright/test';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
const read=(p:Page)=>p.evaluate(()=>(window as any).deckcraft.read().design);
test('stair width and depth pulls plus added points persist and undo',async({page,context})=>{
 await context.addInitScript('window.__name=(target,value)=>target;');await context.addInitScript(configuration=>{const k='golden-maple.deck-studio.deck-only.v1';if(!localStorage.getItem(k))localStorage.setItem(k,JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration}));},{...DEFAULT_DECK,width:20,length:12,height:36,levels:1,stairFlights:1,stairWidth:48,stairOffset:50});
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())?r.continue():r.fulfill({body:''}));
 await page.goto('/deck-designer/');await expect.poll(()=>page.evaluate(()=>(window as any).deckcraft?.read().ready??false)).toBe(true);await page.getByRole('radio',{name:'Stairs',exact:true}).click();
 async function pull(name:string,dx:number,dy:number,cancel=false){const h=page.getByRole('button',{name,exact:true});await h.scrollIntoViewIfNeeded();const r=(await h.boundingBox())!,scale=await h.evaluate(e=>{const m=(e as SVGCircleElement).getScreenCTM()!;return Math.hypot(m.a,m.b);});await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2+dx*scale,r.y+r.height/2+dy*scale,{steps:8});await expect(page.getByText('Release to save stair size.',{exact:true})).toBeVisible();if(cancel)await page.keyboard.press('Escape');await page.mouse.up();}
 const original=await read(page);await pull('Stair point 2',24,0);await expect.poll(async()=>(await read(page)).stairWidth).toBe(72);const wider=await read(page);
 await page.getByRole('button',{name:'Undo',exact:true}).click();expect(await read(page)).toEqual(original);await page.getByRole('button',{name:'Redo',exact:true}).click();expect(await read(page)).toEqual(wider);
 await pull('Stair run depth',0,16,true);expect(await read(page)).toEqual(wider);
 await pull('Stair run depth',0,16);await expect.poll(async()=>(await read(page)).stairTreadDepthIn).toBeGreaterThan(11);
 await page.getByRole('button',{name:'Add stair point at end',exact:true}).click();await expect.poll(async()=>(await read(page)).stairPath?.points.length).toBe(3);await expect(page.getByRole('button',{name:'Stair point 3',exact:true})).toBeVisible();
 const shaped=await read(page);await page.getByRole('button',{name:'Remove last stair point',exact:true}).click();await expect.poll(async()=>(await read(page)).stairPath?.points.length).toBe(2);await page.getByRole('button',{name:'Undo',exact:true}).click();expect(await read(page)).toEqual(shaped);
 await expect(page.getByText(/^Saved on this device at/)).toBeVisible();await page.reload();await expect.poll(()=>page.evaluate(()=>(window as any).deckcraft?.read().ready??false)).toBe(true);expect(await read(page)).toEqual(shaped);
});
