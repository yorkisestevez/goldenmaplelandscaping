/**
 * Owner cost editor: material markup, installation labour override, and priced line overrides.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {calculateDeckReleaseEstimate,deckReleaseData} from '../src/features/deckcraft/deckRelease';
import {parseOwnerMarkup,parseOwnerMoney,OWNER_COST_LIMITS} from '../src/features/deckcraft/designer/ownerCostLimits';
import {quoteCostFromCrewHours,DEFAULT_PERSON_HOUR_RATE} from '../src/features/deckcraft/designer/quoteLabourHours';

let n=0;
const ok=(v:unknown,s:string)=>{assert.ok(v,s);n++;};
const near=(a:number,b:number,s:string)=>ok(Math.abs(a-b)<1e-6,`${s} (${a} vs ${b})`);
const reject=(f:()=>unknown)=>{assert.throws(f);n++;};

near(parseOwnerMarkup('35'),35,'Default markup parses');
near(parseOwnerMarkup('40.5'),40.5,'One-decimal markup');
reject(()=>parseOwnerMarkup('-1'));
reject(()=>parseOwnerMarkup('501'));
near(parseOwnerMoney('1234.56','Labour'),1234.56,'Labour money');
reject(()=>parseOwnerMoney('0.001','Labour'));

const base=deckReleaseData(structuredClone(DEFAULT_DECK));
const book=calculateDeckReleaseEstimate(base);
ok(typeof book.bookLaborCost==='number'&&book.bookLaborCost>0,'Estimate exposes book labour');
near(book.sections.find(s=>s.title.startsWith('Labour'))!.items.find(i=>i.name==='Installation Labour')!.cost as number,book.bookLaborCost,'Book labour matches installation line when unset');

const marked=calculateDeckReleaseEstimate({...base,materialMarkup:50});
ok(marked.subtotal>book.subtotal,'Higher material markup raises the subtotal');

const labour=quoteCostFromCrewHours({crewMembers:3,hours:2,personHourRate:DEFAULT_PERSON_HOUR_RATE});
const owned=calculateDeckReleaseEstimate({...base,customLaborCost:labour.installationCost});
near(owned.sections.find(s=>s.title.startsWith('Labour'))!.items.find(i=>i.name==='Installation Labour')!.cost as number,labour.installationCost,'Owner labour replaces the installation line');
near(owned.bookLaborCost,book.bookLaborCost,'Book labour stays available beside the override');
ok(Math.abs(owned.subtotal-book.subtotal-(labour.installationCost-book.bookLaborCost))<1e-6,'Subtotal moves by the labour delta only');

const decking=book.sections.find(s=>s.title==='Decking')!.items.find(i=>i.cost!==null&&i.name!=='Decking delivery (supplier quote)')!;
const overridden=calculateDeckReleaseEstimate({...base,customOverrides:{[decking.name]:{cost:100}}});
near(overridden.sections.find(s=>s.title==='Decking')!.items.find(i=>i.name===decking.name)!.cost as number,100,'Material line override sticks');

const panel=readFileSync(new URL('../src/features/deckcraft/designer/OwnerCostEditor.tsx',import.meta.url),'utf8');
const page=readFileSync(new URL('../src/pages/DeckDesigner.tsx',import.meta.url),'utf8');
ok(panel.includes('Material markup')&&panel.includes('Your installation labour')&&panel.includes('Override priced material lines'),'Owner editor covers materials and labour');
ok(page.includes('OwnerCostEditor')&&page.includes('onOwnerCosts')&&page.includes('Edit your costs')||page.includes('setOwnerCostsOpen'),'Designer wires the owner cost editor');
ok(OWNER_COST_LIMITS.markupMax===500&&OWNER_COST_LIMITS.amountMax===1_000_000,'Owner cost limits match contractor preset bounds');

console.log(`DECK OWNER COSTS OK — ${n} checks.`);
