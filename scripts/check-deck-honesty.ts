import assert from 'node:assert/strict';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import {CODE_REFERENCES} from '../src/features/deckcraft/drawings/codeReferences';
import {buildPermitSet} from '../src/features/deckcraft/drawings/permitSheets';
import {paperLayout} from '../src/features/deckcraft/drawings/paperLayout';

const banned=/\b(code[- ]compliant|permit[- ]ready|engineered|stamped|approved)\b/i;
const data={...structuredClone(DEFAULT_DECK),permitSite:{lotWidthFt:50,lotDepthFt:120,leftYardFt:10,rearYardFt:40,yardFaces:'S' as const}};
const estimate=calculateEstimate(data);
const set=buildPermitSet({data,model:estimate.model,reviewItems:[],materialName:'Test decking',railingName:'Test railing',date:'September 29, 2026',priceBook:'test'});
assert.equal(set.sheets[0].id,'G-0');
assert(CODE_REFERENCES.every(ref=>ref.sourceUrl.startsWith('https://')));
for(const ref of CODE_REFERENCES){
  const listed=set.sheets[0].items.some(item=>item.kind==='text'&&item.text.includes(ref.citation)&&
    (ref.status==='verified'||item.text.includes('(confirm)')));
  assert(listed,`G-0 must identify the status of ${ref.citation}`);
  if(ref.status!=='verified')assert(set.reviewItems.some(item=>item.includes(ref.citation)),`${ref.citation} must hold the set in DRAFT`);
}
for(const sheet of set.sheets){
  const text=[...sheet.items.flatMap(item=>item.kind==='text'||item.kind==='dim'?[item.text]:[]),...sheet.notes,set.footer,
    ...paperLayout(set,sheet,set.sheets.indexOf(sheet)).flatMap(item=>item.kind==='text'?[item.text]:[])];
  assert(text.every(line=>!banned.test(line)),`${sheet.id}: drawing text claims an unearned review outcome`);
}
assert(set.reviewItems.length>0,'Unverified references must stamp the set DRAFT');
console.log(`Deck drawing honesty: ${set.sheets.length} sheets, ${CODE_REFERENCES.length} references, DRAFT gate passed`);
