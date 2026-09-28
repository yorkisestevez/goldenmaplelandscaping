import {readFileSync} from 'node:fs';
import {DEFAULT_DECK,DECK_SETTINGS} from '../src/features/deckcraft/defaults';
import {calculateEstimate} from '../src/features/deckcraft/calculations';
import type {DeckData} from '../src/features/deckcraft/types';
import {legacyScenarios} from './deck-legacy-scenarios';

/**
 * The multi-level designs the level-junction check (check-deck-level-junction.ts) prices against its baseline,
 * deck-level-junction-baseline.json, captured from 41d3eba before the levels were made to meet.
 * - `same`: the join changes shape only (full-width steps, flush joins, joins that keep the old spacing) — the price
 *   must not move.
 * - `guard`: a normal-width stair between levels — the lower level's guard along the shared edge comes off, so only
 *   the railing and labour may move, and only down (owner decision 2026-09-25).
 */
export type JunctionExpect='same'|'guard';
export interface JunctionCase{design:DeckData;expect:JunctionExpect}

const showcases=JSON.parse(readFileSync(new URL('./deck-level-junction-designs.json',import.meta.url),'utf8')) as Record<string,Partial<DeckData>>;
const base=():DeckData=>structuredClone(DEFAULT_DECK);

export function junctionCases():Record<string,JunctionCase>{
  const cases:Record<string,JunctionCase>={};
  for(const [name,patch] of Object.entries(legacyScenarios()))if(name.endsWith('/freestanding-2lvl'))cases[`parity:${name}`]={design:{...base(),...patch},expect:'guard'};
  for(const [name,patch] of Object.entries(showcases))cases[`showcase:${name}`]={design:{...base(),...patch},expect:'same'};
  const d=base();
  Object.assign(cases,{
    'default two levels (36 → 12 in, 48 in stair)':{design:{...d,levels:2},expect:'guard'},
    'split level (one full-width riser)':{design:{...d,levels:2,level2Position:'Front',level2Offset:50,height2:d.height-7,width2:d.width,level2FullStep:true},expect:'same'},
    'one riser, 48 in stair':{design:{...d,levels:2,level2Position:'Front',height2:d.height-7},expect:'guard'},
    'full-width step, 2 risers':{design:{...d,levels:2,level2Position:'Front',height2:d.height-12,width2:d.width,level2FullStep:true},expect:'same'},
    'full-width step, 3 risers':{design:{...d,levels:2,level2Position:'Front',height2:d.height-20,width2:14,level2FullStep:true},expect:'same'},
    // Its own rails guard the step's ends, so the lower level's side guard beside the step comes off.
    'full-width step, 5 risers (guards on)':{design:{...d,levels:2,level2Position:'Front',height:48,height2:12,level2FullStep:true},expect:'guard'},
    'flush join (same height)':{design:{...d,levels:2,level2Position:'Front',height2:d.height},expect:'same'},
    'raised second level (12 → 36 in)':{design:{...d,height:12,levels:2,level2Position:'Front',height2:36,stairFlights:1},expect:'guard'},
    'right side, 24 in drop':{design:{...d,levels:2,level2Position:'Right',height2:12},expect:'guard'},
    'over 14 risers (140 → 24 in)':{design:{...d,height:140,levels:2,level2Position:'Front',height2:24,length2:14},expect:'same'},
    'three levels (default third)':{design:{...d,levels:3,level2Position:'Front',height2:24,level3:{widthFt:12,lengthFt:8,heightIn:8,parent:2,position:'Front',offsetPct:50}},expect:'guard'},
  } satisfies Record<string,JunctionCase>);
  return cases;
}

/** What the baseline records for a design: its price, every section's total and the quote list. */
export function junctionPrice(design:DeckData){
  const e=calculateEstimate(design,DECK_SETTINGS);
  return {subtotal:+e.subtotal.toFixed(2),total:+e.total.toFixed(2),sections:Object.fromEntries(e.sections.map(s=>[s.title,+s.total.toFixed(2)])),quoteRequired:[...e.quoteRequired].sort(),railingLf:+e.model.quantities.railingLf.toFixed(3)};
}

// `tsx scripts/deck-level-junction-cases.ts --write` captures the baseline (only at 41d3eba, before the change).
if(process.argv.includes('--write')){
  const {writeFileSync}=await import('node:fs');
  const out=Object.fromEntries(Object.entries(junctionCases()).map(([name,c])=>[name,junctionPrice(c.design)]));
  writeFileSync(new URL('./deck-level-junction-baseline.json',import.meta.url),JSON.stringify({capturedAt:'41d3eba',cases:out},null,1)+'\n');
  console.log(`Baseline written: ${Object.keys(out).length} designs.`);
}
