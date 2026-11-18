/**
 * Split the DeckCraft e2e suite into CI shards by measured time, not by test count.
 *
 *   node scripts/e2e-shard.mjs 3 6 [playwright args]   run shard 3 of 6
 *   node scripts/e2e-shard.mjs --record <logs...>       rewrite e2e/shard-times.json from CI logs
 *
 * Playwright's --shard cuts the file-ordered list into equal counts, so the proposal, PDF and night-lighting
 * tests of deckcraft.spec.ts all landed on one runner: 26 of its 28 minutes while the others took 6-11.
 * This hands out the slowest tests first, each to the shard with the least time so far, then runs the shard
 * through --test-list. Times come from e2e/shard-times.json; a test missing from it counts as the median.
 *
 * --record reads the list-reporter output of a full CI run (one log per shard, from
 * `gh api repos/<owner>/<repo>/actions/jobs/<id>/logs`) and keeps the passing time of every test.
 */

import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const TIMES='e2e/shard-times.json';
const SEP=' › ';
const cli=createRequire(import.meta.url).resolve('@playwright/test/cli');

const [first,...rest]=process.argv.slice(2);
if(first==='--record')record(rest);
else run(Number(first),Number(rest[0]),rest.slice(1));

function record(logs){
  if(!logs.length)throw new Error('--record needs the CI shard logs');
  // `✓  12 [desktop] › e2e/file.spec.ts:10:1 › describe › title (retry #1) (5.0s)`
  const line=/✓\s+\d+\s+\[([^\]]+)\] › e2e\/(\S+?):\d+:\d+ › (.*?)(?: \(retry #\d+\))? \(([\d.]+)(ms|s|m)\)\s*$/;
  const unit={ms:.001,s:1,m:60};
  const times={};
  for(const log of logs)for(const text of readFileSync(log,'utf8').split('\n')){
    const m=line.exec(text);
    if(m)times[[m[1],m[2],m[3].trim()].join(SEP)]=Math.round(Number(m[4])*unit[m[5]]*10)/10;
  }
  const sorted=Object.fromEntries(Object.entries(times).sort(([a],[b])=>a<b?-1:1));
  writeFileSync(TIMES,JSON.stringify(sorted,null,1)+'\n');
  console.log(`${Object.keys(sorted).length} test times written to ${TIMES}`);
}

function run(current,total,args){
  if(!(total>=1&&current>=1&&current<=total))throw new Error('usage: e2e-shard.mjs <current> <total> [playwright args]');
  const tests=listTests();
  const times=JSON.parse(readFileSync(TIMES,'utf8'));
  const known=Object.values(times).sort((a,b)=>a-b);
  const median=known.length?known[known.length>>1]:1;
  const weighted=tests.map(key=>({key,time:times[key]??median})).sort((a,b)=>b.time-a.time||(a.key<b.key?-1:1));
  const shards=Array.from({length:total},()=>({time:0,keys:[]}));
  for(const test of weighted){
    const lightest=shards.reduce((min,shard)=>shard.time<min.time?shard:min);
    lightest.time+=test.time;lightest.keys.push(test.key);
  }
  const mine=shards[current-1];
  const minutes=shards.map(shard=>(shard.time/60).toFixed(1)).join(', ');
  console.log(`Shard ${current}/${total}: ${mine.keys.length} of ${tests.length} tests, about ${(mine.time/60).toFixed(1)} min on CI (all shards: ${minutes}).`);
  const list=join(mkdtempSync(join(tmpdir(),'e2e-shard-')),'tests.txt');
  writeFileSync(list,mine.keys.map(key=>{const [project,...path]=key.split(SEP);return `[${project}]${SEP}${path.join(SEP)}`;}).join('\n')+'\n');
  const result=spawnSync(process.execPath,[cli,'test','--test-list',list,...args],{stdio:'inherit'});
  process.exit(result.status??1);
}

/** Every test as `project › file › describe › title`, from Playwright's own listing. */
function listTests(){
  const listed=spawnSync(process.execPath,[cli,'test','--list','--reporter=json'],{encoding:'utf8',maxBuffer:64<<20});
  if(listed.status!==0)throw new Error(`playwright --list failed:\n${listed.stderr}`);
  const keys=[];
  const walk=(suite,titles)=>{
    for(const spec of suite.specs??[])for(const test of spec.tests){
      const path=[...titles,spec.title];
      // --test-list splits each line on the separator and trims every part.
      if(path.some(title=>title.includes('›')||title!==title.trim()))throw new Error(`Cannot list this test by title: ${path.join(SEP)}`);
      keys.push([test.projectName,spec.file,...path].join(SEP));
    }
    for(const child of suite.suites??[])walk(child,[...titles,child.title]);
  };
  for(const file of JSON.parse(listed.stdout).suites)walk(file,[]);
  return keys;
}
