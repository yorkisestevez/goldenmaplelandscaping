/**
 * Check one saved design against the design rules from the command line.
 *
 *   npx tsx scripts/jev-check-design.ts path/to/design.json --summary   prints what Jev would be shown; no call, $0
 *   npx tsx scripts/jev-check-design.ts path/to/design.json             one Jev call; needs JEV_API_KEY
 *
 * The second form is a metered call to TypeSafe (a fraction of a cent). Use it to tune the thresholds in
 * server/jevDesignCheck.ts against designs you know are good or bad. See docs/deckcraft/jev.md.
 */
import {readFileSync} from 'node:fs';
import {createJevClient,JevError} from '../server/jevClient';
import {summarizeDesign,DesignInputError} from '../server/jevDesignSummary';
import {checkDesignSummary} from '../server/jevDesignCheck';

const args=process.argv.slice(2),file=args.find(a=>!a.startsWith('--')),summaryOnly=args.includes('--summary');
if(!file){console.error('Usage: npx tsx scripts/jev-check-design.ts <design.json> [--summary]');process.exit(2);}
try{
 const summary=await summarizeDesign(JSON.parse(readFileSync(file,'utf8')));
 for(const line of summary.warnings)console.warn(`Note: ${line}`);
 if(summaryOnly){console.log(summary.text);process.exit(0);}
 const client=createJevClient();
 if(!client.configured()){console.error('Set JEV_API_KEY to call Jev, or add --summary to see the summary without a call.');process.exit(2);}
 const report=await checkDesignSummary(summary,client);
 for(const rule of report.rules)console.log(`${!rule.applies?'n/a ':rule.pass?'PASS':'FAIL'} ${rule.label}${rule.applies?` (${Math.round(rule.confidence*100)}% sure${rule.unsure?', needs a look':''}${rule.measured?`, measured ${rule.measured}`:''})`:''}${rule.note?` — ${rule.note}`:''}${rule.evidence.map(e=>`\n       ${e}`).join('')}`);
 console.log(`\n${report.pass?'All rules pass':`Failed: ${report.failed.join(', ')}`}${report.needsReview?' (some answers need a look)':''}. ${report.model}, ${report.usage.inputTokens} input tokens, $${report.costUsd.toFixed(6)}.`);
 process.exit(report.pass?0:1);
}catch(error){
 console.error(error instanceof DesignInputError||error instanceof JevError?error.message:error instanceof SyntaxError?'That file is not valid JSON.':error);
 process.exit(2);
}
