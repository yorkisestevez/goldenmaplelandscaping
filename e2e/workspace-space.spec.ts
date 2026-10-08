import {test,expect,type Page} from '@playwright/test';
/** One layout read. Separate bounding-box calls race a 3D re-render and come back null. */
async function stack(page:Page){
 return page.evaluate(()=>{
  const box=(label:string)=>{const el=document.querySelector(`[aria-label="${label}"]`);if(!el)return null;const r=el.getBoundingClientRect();return r.height>0?{y:r.y,height:r.height}:null;};
  const toolbar=box('Landscape presentation controls'),picker=box('Pergola preview controls'),canvas=box('Interactive deck construction model');
  if(!toolbar||!picker||!canvas)return 'layout missing';
  if(toolbar.height>=180)return `toolbar ${toolbar.height}`;
  if(picker.height>=120)return `picker ${picker.height}`;
  if(canvas.height<280)return `canvas ${canvas.height}`;
  const above=Math.abs(picker.y-toolbar.y-toolbar.height),below=Math.abs(canvas.y-picker.y-picker.height);
  if(above>=16)return `gap above picker ${above}`;
  if(below>=16)return `gap below picker ${below}`;
  return 'compact';
 });
}
for(const viewport of [{width:1440,height:1000},{width:390,height:844}])test('3D toolbars remain compact at '+viewport.width,async({page,context})=>{
 await page.setViewportSize(viewport);
 await context.addInitScript('window.__name=(target,value)=>target;');
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())?r.continue():r.fulfill({body:''}));
 await page.goto('/deck-designer/');
 await page.getByRole('tab',{name:'3D',exact:true}).click();
 await expect(page.getByRole('region',{name:'Interactive deck construction model'}).locator('canvas')).toBeVisible();
 await expect(page.getByRole('region',{name:'Pergola preview controls'})).toBeVisible();
 await expect(page.locator('[data-autosave-state]')).toBeVisible();
 // The pergola picker is the toolbar between the presentation controls and the model. Neither gap may open up.
 await expect.poll(()=>stack(page)).toBe('compact');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await page.getByRole('button',{name:'Show project controls',exact:true}).click();
 await expect.poll(()=>stack(page)).toBe('compact');
});
