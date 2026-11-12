import {test,expect} from '@playwright/test';
import compositions from '../src/data/homeCompositions.json' with {type:'json'};

/**
 * The homepage is a hero plus the blocks listed in src/data/homeCompositions.json. These checks pin what a
 * visitor with no history (and every crawler) gets: the owner's headline as the only h1, the default
 * composition in order, and an estimate panel that opens the estimator already filled in.
 */
test.beforeEach(async({page,context})=>{
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())?r.continue():r.abort());
 await page.goto('/');
});

test('the owner headline is the only h1',async({page})=>{
 await expect(page.locator('h1')).toHaveCount(1);
 await expect(page.locator('h1')).toHaveText(/The backyard\s*you’ve always\s*pictured\./);
});

test('blocks render in the default composition order',async({page})=>{
 const ids=await page.locator('[data-home-block]').evaluateAll(els=>els.map(el=>(el as HTMLElement).dataset.homeBlock));
 expect(ids).toEqual(compositions.default.blocks);
});

test('the estimate panel opens the estimator with type, size and town',async({page})=>{
 const panel=page.locator('[data-home-block="instant-estimate"]');
 await panel.getByLabel('Project type').selectOption('wall');
 await panel.getByLabel('Size').selectOption('large');
 await panel.getByLabel('Town').selectOption('innisfil');
 await panel.getByRole('button',{name:'See my range'}).click();
 await expect(page).toHaveURL(/\/cost-estimator\/?\?type=wall&sqft=1000&city=innisfil$/);
});
