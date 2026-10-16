import {test,expect,type Page} from '@playwright/test';
/** One layout read. Separate bounding-box calls race a 3D re-render and come back null. */
async function overlay(page:Page){
 return page.evaluate(()=>{
  const box=(label:string)=>{const el=document.querySelector(`[aria-label="${label}"]`);if(!el)return null;const r=el.getBoundingClientRect();return r.height>0?r:null;};
  const bar=box('3D view controls'),canvas=box('Interactive deck construction model');
  if(!bar||!canvas)return 'layout missing';
  if(canvas.height<280)return `canvas ${canvas.height}`;
  if(bar.height>=70)return `bar ${bar.height}`;
  const inset=bar.top-canvas.top;
  if(inset<0||inset>=16)return `bar ${inset}px from the top of the view`;
  if(bar.right>canvas.right+1)return 'bar wider than the view';
  return 'compact';
 });
}
for(const viewport of [{width:1440,height:1000},{width:390,height:844}])test('3D controls sit in one bar over the view at '+viewport.width,async({page,context})=>{
 await page.setViewportSize(viewport);
 await context.addInitScript('window.__name=(target,value)=>target;');
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())?r.continue():r.fulfill({body:''}));
 await page.goto('/deck-designer/');
 await page.getByRole('tab',{name:'3D',exact:true}).click();
 const view=page.getByRole('region',{name:'Interactive deck construction model'});
 await expect(view.locator('canvas')).toBeVisible();
 await expect(page.locator('[data-autosave-state]')).toBeVisible();
 // Camera, day and night, lights, selection and the realistic look share one bar over the top of the model.
 await expect.poll(()=>overlay(page)).toBe('compact');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 // The scroll wheel keeps scrolling the page until the view is clicked, and says so.
 const box=(await view.boundingBox())!;
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,200);
 await expect(page.getByText('Click the view first, or hold Ctrl, to zoom with the scroll wheel.')).toBeVisible();
 await page.mouse.down();await page.mouse.up();
 await expect(page.getByText('Click the view first, or hold Ctrl, to zoom with the scroll wheel.')).toHaveCount(0);
 await page.mouse.wheel(0,200);
 await expect(page.getByText('Click the view first, or hold Ctrl, to zoom with the scroll wheel.')).toHaveCount(0);
 // Surfaces, landscape cameras and the pergola picker are one click away under More, inside the screen.
 await page.getByRole('group',{name:'3D view controls'}).getByText('More',{exact:true}).click();
 const more=page.locator('.dd-3d-more-panel');
 await expect(more.getByLabel('Landscape camera',{exact:true})).toBeVisible();
 await expect(more.getByRole('region',{name:'Pergola preview controls'})).toBeVisible();
 expect(await more.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;})).toBe(true);
 await page.getByRole('button',{name:'Show project controls',exact:true}).click();
 await expect.poll(()=>overlay(page)).toBe('compact');
});
