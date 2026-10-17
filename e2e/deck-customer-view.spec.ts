import {test,expect} from '@playwright/test';

/**
 * The customer view (?view=customer), opened straight from its link. The page is prerendered without the query, so the
 * view's flag comes after hydration (React does not patch a differing attribute while hydrating): before October 16 it
 * never came, and the contractor's details (skirting ventilation and access notes, pergola products and costs, live
 * costs) showed to the customer.
 */
test('a direct customer-view link hides the contractor details',async({page,context})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript('window.__name=(target,value)=>target;');
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())?r.continue():r.fulfill({body:''}));
 await page.goto('/deck-designer/?view=customer');
 await expect.poll(()=>page.evaluate(()=>(window as any).deckcraft?.read().ready??false)).toBe(true);
 await expect(page.locator('.deck-designer')).toHaveAttribute('data-customer','true');
 await page.getByRole('button',{name:'Show project controls',exact:true}).click();
 const nav=page.getByRole('navigation',{name:'Design tasks'});
 await nav.locator('summary').filter({hasText:/^Build & landscape$/}).click();await nav.getByRole('button',{name:'Privacy, skirting & extras',exact:true}).click();
 const advanced=page.locator('#dd-section-extras-body .dd-advanced');
 await expect(advanced.first()).toBeAttached();
 for(const details of await advanced.all())await expect(details).toBeHidden();
 expect(errors).toEqual([]);
});

test('the designer without the customer view keeps the contractor details',async({page,context})=>{
 await context.addInitScript('window.__name=(target,value)=>target;');
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())?r.continue():r.fulfill({body:''}));
 await page.goto('/deck-designer/');
 await expect.poll(()=>page.evaluate(()=>(window as any).deckcraft?.read().ready??false)).toBe(true);
 await expect(page.locator('.deck-designer')).not.toHaveAttribute('data-customer');
 await page.getByRole('button',{name:'Show project controls',exact:true}).click();
 const nav=page.getByRole('navigation',{name:'Design tasks'});
 await nav.locator('summary').filter({hasText:/^Build & landscape$/}).click();await nav.getByRole('button',{name:'Privacy, skirting & extras',exact:true}).click();
 await expect(page.locator('#dd-section-extras-body .dd-advanced').first()).toBeVisible();
});
