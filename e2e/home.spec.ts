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

/**
 * The adaptive part. A visitor whose interest is known gets the owner-approved hero for that service, their kind of
 * project first, and the estimate panel pre-set. `?gm_intent=` forces a segment so each one can be checked directly.
 */
const HEADLINE={default:/The backyard\s*you’ve always\s*pictured\./,decks:/The deck\s*you’ll live on\s*all summer\./,walls:/A sloped\s*yard, made\s*usable\./,driveways:/A driveway\s*worth pulling\s*into\./,patios:/The patio your\s*evenings have\s*been missing\./};

test('a forced interest reshapes the hero, the work order and the estimate panel',async({page})=>{
 const problems:string[]=[];
 page.on('pageerror',e=>problems.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')problems.push(m.text());});
 await page.goto('/?gm_intent=decks');
 await expect(page.locator('h1')).toHaveCount(1);
 await expect(page.locator('h1')).toHaveText(HEADLINE.decks);
 await expect(page.locator('[data-hero="img"]')).toHaveAttribute('src',/deck-and-garden-walkway/);
 await expect(page.locator('#selected-work h3').first()).toHaveText('Backyard deck and garden walkway');
 await expect(page.locator('[data-home-block="instant-estimate"]').getByLabel('Project type')).toHaveValue('deck');
 // Still the approved variant after React has taken over, and hydration raised nothing.
 await page.locator('[data-home-block="final-cta"]').scrollIntoViewIfNeeded();
 await expect(page.locator('h1')).toHaveText(HEADLINE.decks);
 expect(problems.filter(p=>/hydrat|Minified React error/i.test(p))).toEqual([]);
});

test('the interest is on screen before any script bundle runs',async({page,context})=>{
 await context.route(/\/assets\/.*\.js$/,r=>r.abort());
 await page.goto('/?gm_intent=walls',{waitUntil:'domcontentloaded'});
 await expect(page.locator('h1')).toHaveText(HEADLINE.walls);
 await expect(page.locator('[data-hero="img"]')).toHaveAttribute('src',/sloped-backyard-patio-steps/);
});

test('a search term selects the matching hero',async({page})=>{
 await page.goto('/?utm_source=google&utm_term=interlocking+driveway+barrie');
 await expect(page.locator('h1')).toHaveText(HEADLINE.driveways);
});

test('an unknown interest and a visitor with no history get the default page',async({page})=>{
 await page.goto('/?gm_intent=pools');
 await expect(page.locator('h1')).toHaveText(HEADLINE.default);
 await expect(page.locator('[data-hero="img"]')).toHaveAttribute('src',/backyard-hero-depth/);
});

test('reading patio pages, then opening the homepage, shows the patio hero',async({page})=>{
 // Each page view lands on the session trail shortly after load; wait for it as a reader would by staying on the page.
 const viewed=(path:string)=>page.waitForFunction(p=>(sessionStorage.getItem('gm_session_behavior')??'').includes(p),path);
 await page.goto('/services/interlocking-barrie/');
 await viewed('/services/interlocking-barrie');
 await page.goto('/patios-barrie/');
 await viewed('/patios-barrie');
 await page.getByRole('link',{name:/Golden Maple/}).first().click();
 await expect(page).toHaveURL(/:\d+\/$/);
 await expect(page.locator('h1')).toHaveText(HEADLINE.patios);
});

const DAY_MS=24*60*60*1000;
/**
 * Store a segment as if an earlier visit had left it. The app re-scores the visitor once it has started up and rewrites
 * its storage then, so the seed goes in only after that has happened; otherwise the start-up would overwrite it.
 */
async function seedSegment(page:import('@playwright/test').Page,segment:string,expiresInMs:number){
 await page.waitForFunction(()=>localStorage.getItem('gm_intent_profile')!==null);
 await page.evaluate(value=>{localStorage.removeItem('gm_intent_profile');localStorage.setItem('gm_intent_segment',value);},segment+'|'+(Date.now()+expiresInMs));
}

test('a stored interest paints on a hard load, and an expired one does not',async({page})=>{
 await seedSegment(page,'decks',DAY_MS);
 await page.goto('/');
 await expect(page.locator('h1')).toHaveText(HEADLINE.decks);
 await seedSegment(page,'decks',-DAY_MS);
 await page.goto('/');
 await expect(page.locator('h1')).toHaveText(HEADLINE.default);
 await page.locator('[data-home-block="final-cta"]').scrollIntoViewIfNeeded();
 await expect(page.locator('h1')).toHaveText(HEADLINE.default);
});

test('the search term a visitor just arrived on beats an older stored interest',async({page})=>{
 await seedSegment(page,'patios',DAY_MS);
 await page.goto('/?utm_source=google&utm_term=composite+deck+builder');
 await expect(page.locator('h1')).toHaveText(HEADLINE.decks);
 await page.locator('[data-home-block="final-cta"]').scrollIntoViewIfNeeded();
 await expect(page.locator('h1')).toHaveText(HEADLINE.decks);
});

test('a parameter that is not a segment leaves the default hero whole, whatever is stored',async({page})=>{
 await seedSegment(page,'walls',DAY_MS);
 for(const value of ['constructor','__proto__','pools','']){
  await page.goto('/?gm_intent='+value);
  await expect(page.locator('h1')).toHaveText(HEADLINE.default);
  await expect(page.locator('[data-hero="eyebrow"]')).toHaveText(/Residential landscape construction/);
 }
});

test('the debug view explains the choice',async({page})=>{
 await page.goto('/?gm_intent=walls&gm_debug=1');
 await expect(page.locator('[data-debug="showing"]')).toHaveText('walls');
 await expect(page.locator('[data-debug="scored"]')).toHaveText('default');
});

test('swapping the hero for a known interest does not shift the layout @phone',async({page})=>{
 await page.addInitScript(()=>{
  (window as unknown as {__cls:number}).__cls=0;
  new PerformanceObserver(list=>{for(const entry of list.getEntries()){const shift=entry as unknown as {value:number;hadRecentInput:boolean};if(!shift.hadRecentInput)(window as unknown as {__cls:number}).__cls+=shift.value;}}).observe({type:'layout-shift',buffered:true});
 });
 await page.goto('/?gm_intent=patios');
 await expect(page.locator('h1')).toHaveText(HEADLINE.patios);
 await page.waitForLoadState('networkidle');
 expect(await page.evaluate(()=>(window as unknown as {__cls:number}).__cls)).toBeLessThan(0.1);
});
