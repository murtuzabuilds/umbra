// Runs today's rule-based drafter over the test set. No model, no network, no key.
import { readFileSync } from 'node:fs';
import { compilePolicy } from '../src/corona.js';
import { scoreCase, summarize } from './score.js';
const { cases } = JSON.parse(readFileSync(new URL('./policies.json', import.meta.url)));
const results = cases.map(c => scoreCase(c, compilePolicy(c.say)));
const s = summarize(cases, results);
console.log(`Rule-based drafter: ${s.pass}/${s.total} (${s.pct}%), unsafe ${s.unsafe}, right rule but still doubted ${s.overflag}`);
for (const [t, v] of Object.entries(s.tiers)) console.log(`  ${t.padEnd(26)} ${v.pass}/${v.n}`);
if (process.argv.includes('-v')) cases.forEach((c, i) => { if (!results[i].pass) console.log(`  x ${c.n}. ${c.say}\n      ${results[i].why}`); });
