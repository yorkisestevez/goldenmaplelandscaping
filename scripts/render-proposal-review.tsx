import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {jsPDF} from 'jspdf';
import sharp from 'sharp';
import {DEFAULT_DECK} from '../src/features/deckcraft/defaults';
import {deckReleaseData,calculateDeckReleaseEstimate} from '../src/features/deckcraft/deckRelease';
import {describeDesign} from '../src/features/deckcraft/designFacts';
import {ProposalSheet} from '../src/features/deckcraft/ProposalSheet';
import ConstructionPlan from '../src/features/deckcraft/ConstructionPlan';
import {buildProposalPdf} from '../src/features/deckcraft/proposalPdf';
import {proposalFinishes} from '../src/features/deckcraft/proposalModel';
import {PROPOSAL_CASES} from './deck-proposal-cases';
const output=new URL('../../../outputs/',import.meta.url),assets=new URL('deckcraft-proposal-review/',output);
mkdirSync(assets,{recursive:true});
const data=deckReleaseData(structuredClone(DEFAULT_DECK)),estimate=calculateDeckReleaseEstimate(data),facts=describeDesign(data,estimate).proposalFacts,date='September 26, 2026';
const shot=JSON.parse(readFileSync(new URL('../../proposal-scene.json',import.meta.url),'utf8'));
const logo='data:image/png;base64,'+readFileSync(new URL('../public/logo-mark.png',import.meta.url)).toString('base64');
const swatches:Record<string,string>={};
for(const tile of proposalFinishes(data,estimate.model))if(tile.swatch){
  const image=new URL('../src/features/deckcraft/assets/swatches/'+tile.swatch,import.meta.url);
  try{swatches[tile.swatch]='data:image/jpeg;base64,'+(await sharp(readFileSync(image)).resize(320,320).jpeg().toBuffer()).toString('base64');}catch{}
}
const plan=async(variant:'site'|'contractor')=>{
  const markup=renderToStaticMarkup(createElement(ConstructionPlan,{model:estimate.model,data,variant}));
  let svg=markup.match(/<svg[\s\S]*<\/svg>/)?.[0];if(!svg)throw Error('Plan missing');
  if(variant==='site')svg=svg.replace(/<rect class="dd-plan-grid"[^>]*(?:\/>|><\/rect>)/g,'');
  return 'data:image/png;base64,'+(await sharp(Buffer.from(svg)).resize({width:1600}).png().toBuffer()).toString('base64');
};
const sitePlan=await plan('site'),constructionPlan=await plan('contractor');
const inputs={data,estimate,facts,reviewItems:estimate.flags,date,shots:[shot],logo,sitePlan,plan:constructionPlan,swatches};
writeFileSync(new URL('DeckCraft-editorial-proposal.pdf',output),Buffer.from(buildProposalPdf(jsPDF,inputs)));
const css=readFileSync(new URL('../src/features/deckcraft/proposal.css',import.meta.url),'utf8');
for(const mode of ['image','no-image']){
 const props={data,estimate,facts,reviewItems:estimate.flags,date,image:mode==='image'?shot.src:null,swatchSrc:(file:string)=>swatches[file]??''};
 const sheet=renderToStaticMarkup(createElement(ProposalSheet,props)).replaceAll('src="/logo-mark.png"',`src="${logo}"`);
 const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DeckCraft editorial proposal - local review</title><style>body{margin:0;background:#0c120e;font-family:Arial,sans-serif}*{box-sizing:border-box}:root{--dc-body:Arial,sans-serif;--dc-sheet:#fbfbf8;--font-display:Georgia,serif}${css}</style></head><body><main class="dd-proposal-root">${sheet}</main></body></html>`;
 writeFileSync(new URL(mode==='image'?'proposal-preview.html':'proposal-no-image.html',assets),html);
}
console.log(JSON.stringify({pdf:'DeckCraft-editorial-proposal.pdf',total:estimate.total,quoteItems:estimate.sections.flatMap(s=>s.items).filter(i=>i.cost===null).length}));
const qa=new URL('../../proposal-qa/',import.meta.url);mkdirSync(qa,{recursive:true});
for(const [name,make] of Object.entries(PROPOSAL_CASES)){
 const design=make(),priced=calculateDeckReleaseEstimate(design),summary=describeDesign(design,priced).proposalFacts;
 const sheet=renderToStaticMarkup(createElement(ProposalSheet,{data:design,estimate:priced,facts:summary,reviewItems:priced.flags,date,image:null})).replaceAll('src="/logo-mark.png"',`src="${logo}"`);
 writeFileSync(new URL(`${name}.html`,qa),`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:Arial,sans-serif}*{box-sizing:border-box}:root{--dc-body:Arial,sans-serif;--dc-sheet:#fbfbf8;--font-display:Georgia,serif}${css}</style></head><body><main class="dd-proposal-root">${sheet}</main></body></html>`);
 if(name==='showcase')writeFileSync(new URL('showcase.pdf',qa),Buffer.from(buildProposalPdf(jsPDF,{data:design,estimate:priced,facts:summary,reviewItems:priced.flags,date,logo})));
}
