import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readSupplierRateBook,parseSupplierRateCsv,previewSupplierRateImport,applySupplierRateImport,saveSupplierRateBook,priceSupplierScope,findSupplierRate,validateSupplierRates} from '../src/features/deckcraft/supplierRateBook';
import {closeProjectStorage,readProjectValue,writeProjectValues} from '../src/features/deckcraft/projectStorage';
import {supplierScopeUnit} from '../src/features/deckcraft/designer/SupplierScopePicker';
const require=createRequire(new URL('../src/features/deckcraft/supplierRateBook.ts',import.meta.url));require('fake-indexeddb/auto');
let checks=0;const ok=(value:unknown)=>{assert.ok(value);checks++;},equal=(a:unknown,b:unknown)=>{assert.deepEqual(a,b);checks++;},bad=(action:()=>unknown)=>{assert.throws(action);checks++;},fails=async(action:()=>Promise<unknown>)=>{await assert.rejects(action);checks++;};
const HEADER='SKU,manufacturer,unit,packQuantity,price,currency,effectiveDate,delivery,labour,equipment';
const csv=`${HEADER}\nWALL-1,"Manufacturer, Inc",ea,12,120,CAD,2026-09-30,25,2,1\nGRID-1,Manufacturer B,sqft,100,50,CAD,2026-09-30,0,0.2,0.1`;
async function main(){
 const rows=parseSupplierRateCsv(csv);equal(rows.length,2);equal(rows[0].manufacturer,'Manufacturer, Inc');equal(parseSupplierRateCsv('\uFEFF'+csv.replaceAll('\n','\r\n')),rows);
 equal(priceSupplierScope(rows[0],13,'ea'),{currency:'CAD',taxIncluded:false,packs:2,orderedQuantity:24,installedQuantity:13,supplyCost:240,deliveryCost:25,labourCost:26,equipmentCost:13,installationCost:39,totalBeforeHst:304,effectiveDate:'2026-09-30'});
 equal(priceSupplierScope(rows[0],13,'ea',{includeDelivery:false}).totalBeforeHst,279);equal(priceSupplierScope(rows[0],0,'ea').totalBeforeHst,0);equal(priceSupplierScope(rows[0],12,'ea').packs,1);equal(priceSupplierScope(rows[0],12.001,'ea').packs,2);equal(priceSupplierScope({...rows[0],packQuantity:2.4},14.4,'ea').packs,6);
 equal(supplierScopeUnit('stock units'),'ea');equal(supplierScopeUnit('sq ft installed'),'sqft');equal(supplierScopeUnit('linear ft cap bond'),'lf');equal(supplierScopeUnit('ft'),'lf');equal(priceSupplierScope({...rows[0],unit:'lf',packQuantity:10,price:50},13,supplierScopeUnit('ft')!).supplyCost,100);equal(supplierScopeUnit('cu yd compacted'),null);equal(supplierScopeUnit('scope'),null);
 bad(()=>priceSupplierScope(rows[0],13,'sqft'));bad(()=>priceSupplierScope(rows[0],-1,'ea'));bad(()=>priceSupplierScope(rows[0],Infinity,'ea'));
 for(const source of [csv.replace(',CAD,',',USD,'),csv.replace(',12,120,',',0,120,'),csv.replace(',120,',',-120,'),csv.replace(',120,',',120.123,'),csv.replace('2026-09-30','2026-02-30'),csv.replace(',25,2,1',',,2,1'),csv.replace(',ea,',',unknown,'),csv+'\n'+csv.split('\n')[1],csv.replace('price,currency','price,price'),csv.replace('"Manufacturer, Inc"','"Unclosed'),csv.replace(',120,',',=SUM(1),')])bad(()=>parseSupplierRateCsv(source));
 bad(()=>validateSupplierRates([{...rows[0],extra:true}]));bad(()=>validateSupplierRates([{...rows[0],price:NaN}]));
 const initial=await readSupplierRateBook();equal(initial.rates,[]);const preview=previewSupplierRateImport(csv,initial);equal({adds:preview.additions,replaces:preview.replacements,total:preview.total},{adds:2,replaces:0,total:2});equal((await readSupplierRateBook()).revision,0);
 const applied=await applySupplierRateImport(preview);equal(applied.revision,1);equal((await readSupplierRateBook()).rates,rows);equal(findSupplierRate(applied,'manufacturer b','grid-1'),rows[1]);equal(findSupplierRate(applied,'unknown','missing'),undefined);
 await fails(()=>applySupplierRateImport(preview));equal((await readSupplierRateBook()).revision,1);
 const replace=previewSupplierRateImport(HEADER+'\nWALL-1,"Manufacturer, Inc",ea,12,140,CAD,2026-09-30,25,2,1',applied);equal([replace.additions,replace.replacements,replace.total],[0,1,2]);const replaced=await applySupplierRateImport(replace);equal(findSupplierRate(replaced,'Manufacturer, Inc','WALL-1')?.price,140);
 await fails(()=>saveSupplierRateBook(rows,1));equal((await readSupplierRateBook()).revision,2);
 const oldPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('Quota exceeded','QuotaExceededError');};await fails(()=>saveSupplierRateBook([],2));IDBObjectStore.prototype.put=oldPut;equal((await readSupplierRateBook()).rates,replaced.rates);
 await writeProjectValues([{store:'privateRates',key:'supplier-ratebook',value:{version:99,rates:[]}}]);await fails(()=>readSupplierRateBook());await fails(()=>saveSupplierRateBook([],2));equal(await readProjectValue('privateRates','supplier-ratebook'),{version:99,rates:[]});
 ok(checks>40);closeProjectStorage();process.stdout.write(`Supplier ratebook checks passed: ${checks}\n`);
}
main().catch(error=>{closeProjectStorage();console.error(error);process.exitCode=1;});
