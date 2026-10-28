import assert from 'node:assert/strict';
import {PLAN_TOOLS} from '../src/features/deckcraft/designer/constants';
import {SECTIONS} from '../src/features/deckcraft/designer/sections';
import {DECK_LABEL} from '../src/features/deckcraft/deckAnalytics';
import {ESTIMATOR_TABS,HOME_TABS,homeTabLabel,tabOfSection,tabOfTool,type HomeTab} from '../src/features/deckcraft/designer/homeTabs';

/**
 * The homeowner's four tabs (Draw · Materials · Extras · Price & send) replace the ribbon's categories and the task rail,
 * so each must still reach everything those did: every section in exactly one tab's panel, every homeowner plan tool in
 * exactly one tab, and an analytics label inside DeckCraft's closed vocabulary. The cost estimator's studio, which leaves
 * out Price & send, must reach every section too.
 */
let checks=0;const ok=(value:unknown,message:string)=>{assert(value,message);checks++;};

ok(HOME_TABS.map(t=>t.name).join(' · ')==='Draw · Materials · Extras · Price & send','The four tabs, in order');
ok(ESTIMATOR_TABS.map(t=>t.name).join(' · ')==='Draw · Materials · Extras','The estimator studio leaves out Price & send');
for(const [where,tabs] of [['page',HOME_TABS],['estimator',ESTIMATOR_TABS]] as [string,readonly HomeTab[]][]){
  for(const section of SECTIONS){
    const owners=tabs.filter(t=>t.sections.includes(section.id));
    ok(owners.length===1,`${where}: ${section.name} is in exactly one tab (found ${owners.map(t=>t.name).join(', ')||'none'})`);
    ok(tabOfSection(section.id,tabs)===owners[0],`${where}: tabOfSection finds ${section.name}`);
  }
  // Select parts is a Designer Mode tool; locating a warning can still pick it, and no tab owns it.
  for(const [tool,label] of PLAN_TOOLS.filter(([tool])=>tool!=='components')){
    const owners=tabs.filter(t=>t.tools.includes(tool));
    ok(owners.length===1,`${where}: ${label} is on exactly one tab (found ${owners.map(t=>t.name).join(', ')||'none'})`);
    ok(tabOfTool(tool,tabs)===owners[0],`${where}: tabOfTool finds ${label}`);
  }
  ok(tabOfTool('components',tabs)===null,`${where}: Select parts belongs to no homeowner tab`);
}
ok(HOME_TABS.find(t=>t.id==='draw')?.view==='plan','Draw opens the plan');
ok(HOME_TABS.find(t=>t.id==='materials')?.view==='3d','Materials opens the 3D view, so a colour shows on the deck');
for(const tab of HOME_TABS)ok(DECK_LABEL.test(homeTabLabel(tab.id)),`${tab.name} reports ${homeTabLabel(tab.id)} inside the closed vocabulary`);

console.log(`DECK HOME TABS OK — ${checks} checks.`);
