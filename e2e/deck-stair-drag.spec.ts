import {test,expect,type Page} from '@playwright/test';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
const storage='golden-maple.deck-studio.deck-only.v1';
const read=(page:Page)=>page.evaluate(()=>(window as any).deckcraft.read().design);
async function dragTo(page:Page,side:number,cancel=false){
 const body=page.locator('[data-stair-drag]');await body.scrollIntoViewIfNeeded();
 const position=await body.evaluate((el,side)=>{
  const svg=(el as SVGPolygonElement).ownerSVGElement!,matrix=svg.getScreenCTM()!,points=(el as SVGPolygonElement).points;
  const start=new DOMPoint(Array.from(points).reduce((n,p)=>n+p.x,0)/points.numberOfItems,Array.from(points).reduce((n,p)=>n+p.y,0)/points.numberOfItems).matrixTransform(matrix);
  // Preserve the picked point's distance from the opening when dropping on the other side.
  const opening={x:(points.getItem(0).x+points.getItem(1).x)/2,y:(points.getItem(0).y+points.getItem(1).y)/2};
  const center={x:Array.from(points).reduce((n,p)=>n+p.x,0)/points.numberOfItems,y:Array.from(points).reduce((n,p)=>n+p.y,0)/points.numberOfItems};
  const target=new DOMPoint(side+center.x-opening.x,72+center.y-opening.y).matrixTransform(matrix);
  return {start:{x:start.x,y:start.y},target:{x:target.x,y:target.y}};
 },side);
 await page.mouse.move(position.start.x,position.start.y);await page.mouse.down();await page.mouse.move(position.target.x,position.target.y,{steps:10});
 await expect(page.locator('.dd-plan-readout')).toContainText('Release to place stairs');
 if(cancel)await page.keyboard.press('Escape');await page.mouse.up();
}
test('stairs drag across edges, undo atomically, cancel and survive reload',async({page,context})=>{
 await context.addInitScript('window.__name=(target,value)=>target;');
 await context.addInitScript(({storage,configuration})=>{if(!localStorage.getItem(storage))localStorage.setItem(storage,JSON.stringify({format:'golden-maple-deck-design',version:1,units:'inches-and-feet',configuration}));},{storage,configuration:{...DEFAULT_DECK,width:20,length:12,height:36,levels:1,stairFlights:1,stairPosition:'Front',stairOffset:50}});
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())?r.continue():r.fulfill({body:''}));
 await page.goto('/deck-designer/');await expect.poll(()=>page.evaluate(()=>(window as any).deckcraft?.read().ready??false)).toBe(true);
 await page.locator('[data-select-stairs]').last().click();await expect(page.getByRole('radio',{name:'Stairs',exact:true})).toHaveAttribute('aria-checked','true');await expect(page.getByRole('heading',{name:'Stairs & railings',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Deck shape & size',exact:true})).toHaveCount(0);const before=await read(page);
 await dragTo(page,240);await expect.poll(async()=>(await read(page)).stairPosition).toBe('Right');
 const right=await read(page);expect(right.stairOffset).toBeCloseTo(50,0);await expect(page.getByRole('button',{name:'Apply preview',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(()=>read(page)).toEqual(before);
 await page.getByRole('button',{name:'Redo',exact:true}).click();await expect.poll(()=>read(page)).toEqual(right);
 await dragTo(page,0,true);expect(await read(page)).toEqual(right);
 await dragTo(page,0);await expect.poll(async()=>(await read(page)).stairPosition).toBe('Left');const left=await read(page);
 await expect(page.getByText(/^Saved on this device at/)).toBeVisible();
 await page.reload();await expect.poll(()=>page.evaluate(()=>(window as any).deckcraft?.read().ready??false)).toBe(true);expect(await read(page)).toEqual(left);
});
