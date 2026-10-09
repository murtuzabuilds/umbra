// Runs the model drafter over the test set through the deployed Worker, so the score reflects exactly
// what Umbra visitors get: same instructions, same checks. No key is needed here; the Worker holds it.
// Usage: node eval/run-model.js https://<worker>.workers.dev [gemini|groq]
import { readFileSync, writeFileSync } from 'node:fs';
import { compilePolicy } from '../src/corona.js';
import { scoreCase, summarize } from './score.js';
const [url, provider = 'gemini'] = process.argv.slice(2);
if (!url) { console.error('Give the Worker address.'); process.exit(1); }
const { cases } = JSON.parse(readFileSync(new URL('./policies.json', import.meta.url)));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rows = [];
for (const c of cases) {
  let draft = null, err = null, model = null;
  for (let attempt = 0; attempt < 3 && !draft; attempt++) {
    try {
      const r = await fetch(url.replace(/\/$/, '') + '/draft?provider=' + provider, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost' }, body: JSON.stringify({ say: c.say }) });
      const j = await r.json();
      if (r.status === 429) { await sleep(20000); continue; }
      if (!r.ok) { err = j.error || r.status; await sleep(3000); continue; }
      draft = { rule: j.rule, doubts: j.doubts || [] }; model = j.model;
    } catch (e) { err = String(e.message || e); await sleep(3000); }
  }
  const res = draft ? scoreCase(c, draft) : { pass: false, why: `no answer: ${err}` };
  rows.push({ n: c.n, tier: c.tier, say: c.say, draft, ...res, model });
  process.stdout.write(res.pass ? '.' : 'x');
  await sleep(3200); // stays under the Worker's 20 a minute
}
const s = summarize(cases, rows);
const base = summarize(cases, cases.map(c => scoreCase(c, compilePolicy(c.say))));
const model = rows.find(r => r.model)?.model || provider;
console.log(`\n${provider} (${model}): ${s.pass}/${s.total} (${s.pct}%), unsafe ${s.unsafe}, right rule but still doubted ${s.overflag}`);
console.log(`rules baseline: ${base.pass}/${base.total} (${base.pct}%)`);
for (const [t, v] of Object.entries(s.tiers)) console.log(`  ${t.padEnd(26)} model ${v.pass}/${v.n}   rules ${base.tiers[t].pass}/${base.tiers[t].n}`);
for (const r of rows.filter(r => !r.pass)) console.log(`  x ${r.n}. ${r.say}\n      ${r.why}`);
const out = { ran: new Date().toISOString(), provider, model, summary: s, baseline: base, rows };
writeFileSync(new URL(`./results/${provider}.json`, import.meta.url), JSON.stringify(out, null, 1));
