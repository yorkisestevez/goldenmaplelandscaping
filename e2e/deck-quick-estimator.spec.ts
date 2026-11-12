import {test,expect,type Page,type BrowserContext,type Request} from '@playwright/test';

/**
 * The cost estimator's deck: the light deck estimator (src/features/deck-estimator), which replaced the embedded 3D
 * designer on 2026-11-11 because the designer made the page slow. It prices with the designer's own engine (pinned to
 * the cent by scripts/check-deck-site-price.ts); these tests pin what a visitor sees: the form and its live price, the
 * hand-offs into a full backyard and back, the deck-only lead form, and that none of the 3D designer's code loads.
 */
// The /deck-designer route module and the 3D designer's own chunks (three.js, the viewer, the plan editor, its shell).
const DESIGNER_CODE=/\/assets\/(DeckDesigner|three|[A-Za-z]*3D|Viewer|PreviewPanel|PlanEditingWorkspace|PlanToolPicker|NextShell|ArchitectShortcuts|EasyEditTools)[-.][^/]*\.js$/;

async function local(context:BrowserContext){
 await context.addInitScript('window.__name=(target,value)=>target;');
 await context.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())&&r.request().method()==='GET'?r.continue():r.fulfill({status:200,body:''}));
}
const form=(page:Page)=>page.locator('[data-deck-estimator]');
const priceCard=(page:Page)=>page.getByRole('region',{name:'Your deck price'});
const total=async(page:Page)=>Number(((await priceCard(page).locator('dl dd').last().textContent())??'').replace(/[^\d.]/g,''));
const group=(page:Page,name:RegExp)=>page.getByRole('group',{name});

test('a deck link opens the deck estimator at that size, priced, without the 3D designer',async({page,context})=>{
 await local(context);
 const errors:string[]=[],scripts:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',(r:Request)=>{if(r.resourceType()==='script')scripts.push(new URL(r.url()).pathname);});
 await page.goto('/cost-estimator?type=deck&sqft=300');
 await expect(page).toHaveURL(/\/cost-estimator\/?\?(sqft=300&studio=deck|studio=deck&sqft=300)$/);
 await expect(form(page)).toHaveAttribute('data-deck-estimator','ready');
 await expect(page.getByRole('heading',{level:1})).toHaveText('Price your deck');
 await expect(page.getByLabel('Width, along the house')).toHaveValue('20');
 await expect(page.getByLabel('Depth, out from the house')).toHaveValue('15');
 await expect(priceCard(page)).toContainText('300 sq ft rectangle deck, 20 × 15 ft, 36 in above grade');
 await expect(priceCard(page)).toContainText('HST (13%)');
 expect(await total(page)).toBeGreaterThan(0);
 expect(scripts.filter(s=>DESIGNER_CODE.test(s)),'no 3D designer code loads').toEqual([]);
 // Back returns to the estimator, with the deck still chosen.
 await page.getByRole('button',{name:'Project types'}).click();
 await expect(page.getByRole('button',{name:'Composite Deck',pressed:true})).toBeVisible();
 expect(errors).toEqual([]);
});

test('every answer reprices the deck, and no railing is offered only on a low deck',async({page,context})=>{
 await local(context);
 await page.goto('/cost-estimator?type=deck&sqft=300');
 await expect(form(page)).toHaveAttribute('data-deck-estimator','ready');
 const start=await total(page);
 const noRailing=group(page,/^Railing/).getByRole('radio',{name:'No railing'});
 await expect(noRailing).toBeDisabled();
 await group(page,/^Railing/).getByText('Glass panels',{exact:true}).click();
 await expect.poll(()=>total(page)).toBeGreaterThan(start);
 await group(page,/^Height above the ground/).getByText('Low',{exact:true}).click();
 await expect(noRailing).toBeEnabled();
 await noRailing.check({force:true});
 const low=await total(page);
 // Raising the deck again puts a railing back: a guard is required above 600 mm.
 await group(page,/^Height above the ground/).getByText('Walkout',{exact:true}).click();
 await expect(group(page,/^Railing/).getByRole('radio',{name:'Aluminum'})).toBeChecked();
 await expect.poll(()=>total(page)).toBeGreaterThan(low);
 await page.getByLabel('Width, along the house').fill('24');await page.getByLabel('Width, along the house').press('Enter');
 await expect(priceCard(page)).toContainText('24 × 15 ft');
 await page.getByRole('button',{name:'Increase depth'}).click();
 await expect(priceCard(page)).toContainText('24 × 16 ft');
});

test('a deck on its own goes out as a written estimate with the link that reopens it',async({page,context})=>{
 await local(context);
 let sent='';
 await page.route(/\/$/,r=>{if(r.request().method()!=='POST')return r.continue();sent=r.request().postData()??'';return r.fulfill({status:200,body:''});});
 await page.goto('/cost-estimator?type=deck&sqft=300');
 await expect(form(page)).toHaveAttribute('data-deck-estimator','ready');
 await group(page,/^Decking/).getByText('TimberTech PRO Reserve',{exact:true}).click();
 await group(page,/^Stairs/).getByText('Two sets',{exact:true}).click();
 const shown=await total(page);
 await page.getByRole('button',{name:'Email me this estimate'}).click();
 const send=page.locator('#deck-estimate-send');
 await send.getByPlaceholder(/name/i).first().fill('Pat Example');
 await send.getByPlaceholder(/email/i).first().fill('pat@example.ca');
 await send.locator('form').evaluate(f=>(f as HTMLFormElement).requestSubmit());
 await expect.poll(()=>sent).toContain('form-name=cost-estimator');
 const fields=new URLSearchParams(sent);
 expect(fields.get('project_type')).toBe('deck');
 expect(Number(fields.get('precise_total'))).toBeCloseTo(shown,2);
 expect(fields.get('deck_summary')).toContain('TimberTech PRO Reserve');
 const link=fields.get('deck_design_link')??'';
 expect(link).toMatch(/\/cost-estimator\?type=deck#d=1[zj]/);
 // The link reopens the same deck at the same price.
 const again=await context.newPage();
 await again.goto(link.replace(/^https?:\/\/[^/]+/,''));
 await expect(again.locator('[data-deck-estimator]')).toHaveAttribute('data-deck-estimator','ready');
 await expect(again.getByRole('group',{name:/^Decking/}).getByRole('radio',{name:/TimberTech PRO Reserve/})).toBeChecked();
 await expect(again.getByRole('group',{name:/^Stairs/}).getByRole('radio',{name:'Two sets'})).toBeChecked();
 expect(await total(again)).toBe(shown);
});

test('a full backyard prices its deck with the deck estimator and keeps the deck the visitor set',async({page,context})=>{
 await local(context);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/cost-estimator?type=full');
 const live=page.getByRole('complementary',{name:'Live estimate'});
 await expect(live).toContainText('$');
 await page.getByRole('button',{name:'Composite Deck',pressed:false}).click();
 const card=page.locator('[data-estimator-deck="starter"]');
 await expect(card).toContainText('20 × 15 ft');
 await expect(live).toContainText('Deck (starter)');
 const starter=Number(((await card.locator('.tabular-nums').textContent())??'').replace(/[^\d]/g,''));
 await page.getByRole('button',{name:/Set your deck/}).click();
 await expect(page).toHaveURL(/studio=full/);
 await expect(form(page)).toHaveAttribute('data-deck-estimator','ready');
 await expect(page.getByLabel('Width, along the house')).toHaveValue('20');
 // The starter deck on the card is the deck estimator's price for the same deck (the card rounds to $100).
 const subtotal=Number(((await priceCard(page).locator('dl dd').first().textContent())??'').replace(/[^\d.]/g,''));
 expect(starter).toBe(Math.round(subtotal/100)*100);
 await group(page,/^Railing/).getByText('Cable',{exact:true}).click();
 await page.getByRole('button',{name:'Use this deck in my estimate'}).click();
 await expect(page.locator('[data-estimator-deck="design"]')).toContainText('Your deck');
 await expect(page.locator('[data-estimator-deck="design"]')).toContainText('Cable');
 await expect(live).toContainText('Deck (as you set it)');
 // A backyard that is only a deck is the deck estimator's whole estimate, and it opens on the visitor's deck.
 for(const name of ['Patio / Interlock','Retaining Wall','Landscape Lighting'])await page.getByRole('button',{name,exact:true,pressed:true}).click();
 await page.getByRole('button',{name:'Continue →'}).first().click();
 await expect(page).toHaveURL(/studio=deck/);
 await expect(form(page)).toHaveAttribute('data-deck-estimator','ready');
 await expect(group(page,/^Railing/).getByRole('radio',{name:'Cable'})).toBeChecked();
 expect(errors).toEqual([]);
});

test('on a phone the price stays in sight and the page never scrolls sideways @phone',async({page,context})=>{
 await local(context);
 await page.goto('/cost-estimator?type=deck&sqft=300');
 await expect(form(page)).toHaveAttribute('data-deck-estimator','ready');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
 await page.getByRole('group',{name:/^Extras/}).scrollIntoViewIfNeeded();
 await expect(page.getByRole('button',{name:'Email it to me'})).toBeInViewport();
 await expect(page.getByText('Your deck, with HST')).toBeInViewport();
});
