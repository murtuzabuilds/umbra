import { test } from 'node:test';
import assert from 'node:assert/strict';
import { numbersIn, grounded, writeIncident, writeBrief } from '../src/writer.js';
import { handle, parseWriting, grounded as workerGrounded } from '../worker/worker.js';
import * as U from '../src/index.js';

const env = { GEMINI_API_KEY: 'test-g', GROQ_API_KEY: 'test-q', PROVIDER: 'groq' };
const req = (body, ip = '2.2.2.2') => new Request('https://umbra.example.workers.dev/write', { method: 'POST', headers: { origin: 'https://murtuzabuilds.com', 'cf-connecting-ip': ip, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const groq = text => async () => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });
const facts = { person: 'Ana Ruiz', team: 'Claims', tool: 'Chatly', times: 12, data: ['email address'], score: 74 };
const template = { analyst: 'Ana Ruiz (Claims) used Chatly 12 times between Sep 3 and Sep 9.', employee: 'Hi Ana, try Aster.' };

test('numbers are read the way a person reads them', () => {
  assert.deepEqual(numbersIn('1,284 calls, $825, 90% and 12.0'), ['1284', '825', '90', '12']);
  assert.deepEqual(numbersIn('twelve times, twice'), ['12', '2']);
});

test('writing with a number that is not in the facts is caught', () => {
  assert.equal(grounded('Ana used Chatly 12 times on Sep 3.', facts, template).ok, true);
  const bad = grounded('Ana used Chatly 40 times and exposed 5 records.', facts, template);
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.stray, ['40', '5']);
  assert.equal(grounded('Ana used it fifteen times.', facts, template).ok, false); // number words count too
  assert.deepEqual(workerGrounded('Ana used Chatly 40 times.', facts, template), grounded('Ana used Chatly 40 times.', facts, template)); // the Worker and the browser agree
});

test('the Worker refuses an invented number, and passes a faithful summary', async () => {
  const ok = await handle(req({ kind: 'incident', facts, template }), env, groq('{"analyst":"Ana Ruiz used Chatly 12 times with personal data. Point Claims to Aster.","employee":"Hi Ana, please use Aster next time."}'));
  assert.equal(ok.status, 200);
  assert.match((await ok.json()).analyst, /12 times/);
  const made = await handle(req({ kind: 'incident', facts, template }, '2.2.2.3'), env, groq('{"analyst":"Ana used Chatly 37 times.","employee":"Hi Ana."}'));
  assert.equal(made.status, 422);
  assert.deepEqual((await made.json()).stray, ['37']);
  assert.equal((await handle(req({ kind: 'poem', facts, template }, '2.2.2.4'), env)).status, 400);
  assert.equal((await handle(req({ kind: 'brief', facts: { x: 'y'.repeat(7000) } }, '2.2.2.5'), env)).status, 400);
  assert.equal(parseWriting('brief', 'not json', facts, template).error, 'unreadable');
  assert.equal(parseWriting('incident', '{"analyst":"<b>Hi</b>","employee":"ok"}', facts, template).analyst, 'bHi/b');
});

test('the browser falls back to the template when the model is off, down or makes a number up', async () => {
  const off = await writeIncident(facts, template, { url: '' });
  assert.equal(off.source, 'template'); assert.equal(off.analyst, template.analyst); assert.match(off.note, /paused/);
  const down = await writeIncident(facts, template, { fetchImpl: async () => new Response('x', { status: 502 }) });
  assert.equal(down.source, 'template');
  const liar = await writeIncident(facts, template, { fetchImpl: async () => new Response(JSON.stringify({ analyst: 'Ana used Chatly 99 times.', employee: 'Hi Ana.', model: 'm' }), { status: 200 }) });
  assert.equal(liar.source, 'template'); assert.match(liar.note, /number that is not in the facts/);
  const good = await writeIncident(facts, template, { fetchImpl: async () => new Response(JSON.stringify({ analyst: 'Ana used Chatly 12 times.', employee: 'Hi Ana, use Aster.', model: 'openai/gpt-oss-120b' }), { status: 200 }) });
  assert.equal(good.source, 'model'); assert.equal(good.model, 'openai/gpt-oss-120b');
  const brief = await writeBrief({ exposures: 22 }, { body: '22 still reached vendors.' }, { fetchImpl: async () => new Response(JSON.stringify({ paras: ['22 sensitive interactions still reached vendors.'], model: 'm' }), { status: 200 }) });
  assert.equal(brief.source, 'model'); assert.equal(brief.paras.length, 1);
});

test('every real incident template passes its own number check', () => {
  const r = U.run();
  for (const i of r.triage.incidents) {
    const n = U.narrate(i);
    assert.equal(grounded(n.analyst + ' ' + n.employee, n).ok, true, i.id);
  }
});

test('a summary must keep what happened to the data', async () => {
  const { keepsOutcome } = await import('../src/writer.js');
  const masked = 'Sensitive details were masked in all 24 calls before they reached Deepwell API, but the service still sends work to a model API that is not approved.';
  assert.equal(keepsOutcome('The service sent email addresses to an unapproved API 24 times.', masked), false); // the masking was dropped
  assert.equal(keepsOutcome('Email addresses were masked in all 24 calls, but the API is not approved.', masked), true);
  assert.equal(keepsOutcome('Personal data was exposed to Deepwell API, though masked.', masked), false); // a leak that did not happen
  assert.equal(keepsOutcome('All 3 interactions reached Chatly with client names.', 'All 3 interactions reached Chatly with client names.'), true);
  assert.equal(keepsOutcome('Chatly was used 3 times.', 'All 3 interactions reached Chatly with client names.'), false);
  assert.equal(keepsOutcome('Anything at all.', ''), true);
  const r = U.run();
  for (const i of r.triage.incidents) { const n = U.narrate(i); assert.equal(keepsOutcome(n.analyst, n.outcome), true, i.id); } // Umbra's own templates always pass
});

test('a note that calls a masked message blocked is rejected (seen in a live run)', async () => {
  const { contradictsOutcome } = await import('../src/writer.js');
  const masked = 'All 6 interactions were stopped by policy (masked).';
  assert.equal(contradictsOutcome('Lena, Umbra blocked the 6 requests you made; nothing further is needed.', masked), true);
  assert.equal(contradictsOutcome('Lena, Umbra masked your details in all 6 requests.', masked), false);
  assert.equal(contradictsOutcome('Both attempts were blocked.', 'Both interactions were stopped by policy (blocked).'), false);
  const live = await writeIncident({ whatHappened: masked, times: 6, people: 5 }, { analyst: 'x', employee: 'y' },
    { fetchImpl: async () => new Response(JSON.stringify({ analyst: '5 people used Chatly 6 times. All 6 interactions were stopped by policy.', employee: 'Lena, Umbra blocked the 6 requests you made.', model: 'm' }), { status: 200 }) });
  assert.equal(live.source, 'template'); assert.match(live.note, /did not keep what happened/);
});
