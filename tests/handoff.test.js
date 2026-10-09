import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OUTPOST_TOOLS, OUTPOST_URL, OUTPOST_LOCAL_URL, HANDOFF_KEY, MAX_AGENTS, RISKY,
  buildAgent, cleanTools, suggestTools, mergeHandoff, parseHandoff, encodeDock, decodeDock,
  outpostBase, outpostLink, writeHandoff, slug,
} from '../src/handoff.js';
import { AGENTS, CALLS } from '../src/agents.js';

const FIXED = ['claims.write', 'fraud.flag', 'payments.refund', 'payments.pay', 'email.send', 'crm.read', 'crm.write', 'crm.records', 'docs.write', 'calendar.write', 'ledger.write', 'data.export', 'accounts.close', 'underwriting.models'];
const shadow = AGENTS.find(a => !a.registered);
const observed = CALLS.filter(c => c.to === shadow.id || c.from === shadow.id).map(c => c.tool);
const make = (over = {}) => buildAgent({ agent: shadow, name: 'Fern', job: 'Drafts emails to customers', owner: 'Gabe Lopez', team: 'Marketing', tools: ['crm.records'], limit: 0, approvedAt: new Date('2026-09-28T12:00:00Z'), ...over });

test('the Outpost tool list is exactly the fixed contract list', () => {
  assert.deepEqual(Object.keys(OUTPOST_TOOLS), FIXED);
  for (const t of Object.keys(RISKY)) assert.ok(FIXED.includes(t));
});

test('tools are whitelisted, deduplicated and kept in contract order', () => {
  assert.deepEqual(cleanTools(['data.export', 'web.post', 'crm.read', 'crm.read', 'rm -rf', 42, null]), ['crm.read', 'data.export']);
  assert.deepEqual(cleanTools('crm.read'), []);
  const a = make({ tools: ['files.read.all', 'crm.records', 'shell.exec', 'email.send'] });
  assert.deepEqual(a.tools, ['email.send', 'crm.records']);
  assert.ok(a.tools.every(t => FIXED.includes(t)));
});

test('defaults come from what the agent was seen doing, risky ones unticked', () => {
  const s = suggestTools(observed);
  assert.deepEqual([...observed].sort(), ['crm.read', 'mail.draft', 'web.post']);
  assert.deepEqual(s.defaults, ['email.send', 'crm.read']);
  const exp = s.suggested.find(x => x.tool === 'data.export');
  assert.equal(exp.ticked, false);
  assert.equal(exp.risky, true);
  assert.match(exp.reason, /outside the company/);
  assert.deepEqual(suggestTools(['docs.parse', 'ledger.read']).unmapped, ['docs.parse', 'ledger.read']);
});

test('an agent record has the exact contract shape', () => {
  const a = make();
  assert.deepEqual(Object.keys(a), ['id', 'name', 'job', 'owner', 'team', 'tools', 'limit', 'approvedAt', 'source', 'umbraName', 'rules']);
  assert.equal(a.id, 'umb-unknown-7f3');
  assert.match(a.id, /^umb-[a-z0-9-]+$/);
  assert.equal(a.source, 'umbra');
  assert.equal(a.umbraName, shadow.name);
  assert.equal(a.approvedAt, '2026-09-28T12:00:00.000Z');
  assert.ok(a.rules.length >= 2 && a.rules.every(r => typeof r === 'string'));
  assert.ok(a.rules.some(r => /Gabe Lopez/.test(r)));
});

test('sizes are capped: strings, rules, limit and number of agents', () => {
  const long = 'x'.repeat(500);
  const a = make({ name: long, job: long, owner: long, team: long, limit: 9e12, rules: Array(20).fill(long) });
  assert.ok(a.name.length <= 16 && a.job.length <= 60 && a.owner.length <= 48 && a.team.length <= 32);
  assert.ok(a.rules.length <= 6 && a.rules.every(r => r.length <= 120));
  assert.equal(a.limit, 1_000_000);
  assert.equal(make({ limit: -50 }).limit, 0);
  assert.equal(make({ limit: 'abc' }).limit, 0);
  assert.equal(make({ limit: 250.6 }).limit, 251);
  let h = { v: 1, agents: [] };
  for (let i = 0; i < 6; i++) h = mergeHandoff(h, { ...make(), id: `umb-a${i}` });
  assert.equal(h.agents.length, MAX_AGENTS);
  assert.deepEqual(h.agents.map(x => x.id), ['umb-a3', 'umb-a4', 'umb-a5']);
  // three full-size agents still make a short link
  const big = { v: 1, agents: [0, 1, 2].map(i => ({ ...make({ name: long, job: long, owner: long, team: long, tools: FIXED, rules: Array(9).fill(long) }), id: `umb-${i}` })) };
  assert.ok(encodeDock(big).length < 6000);
});

test('same id replaces, newest goes last', () => {
  const h1 = mergeHandoff(null, { ...make(), id: 'umb-a' });
  const h2 = mergeHandoff(h1, { ...make(), id: 'umb-b' });
  const h3 = mergeHandoff(h2, { ...make({ name: 'Moss' }), id: 'umb-a' });
  assert.deepEqual(h3.agents.map(a => a.id), ['umb-b', 'umb-a']);
  assert.equal(h3.agents[1].name, 'Moss');
  assert.equal(h3.v, 1);
});

test('junk in storage is tolerated', () => {
  assert.deepEqual(parseHandoff('not json'), { v: 1, agents: [] });
  assert.deepEqual(parseHandoff('{"v":2,"agents":[{"id":"x"}]}'), { v: 1, agents: [] });
  assert.deepEqual(parseHandoff('{"v":1,"agents":[null,{"id":"x"},{"name":"no id"}]}').agents, [{ id: 'x' }]);
});

test('base64url round trip, URL-safe, no padding, unicode kept', () => {
  const h = mergeHandoff(null, make({ job: 'Lire les dossiers, café ☕ et 🛰' }));
  const s = encodeDock(h);
  assert.match(s, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeDock(s), h);
  for (let n = 0; n < 8; n++) { const o = { v: 1, agents: [], pad: 'y'.repeat(n) }; assert.deepEqual(decodeDock(encodeDock(o)), o); }
});

test('Outpost link: one constant, localhost for testing', () => {
  assert.equal(OUTPOST_URL, 'https://murtuzabuilds.github.io/outpost/');
  assert.equal(outpostBase('localhost'), OUTPOST_LOCAL_URL);
  assert.equal(outpostBase('127.0.0.1'), 'http://localhost:8821/index.html');
  assert.equal(outpostBase('murtuzabuilds.github.io'), OUTPOST_URL);
  const h = mergeHandoff(null, make());
  const url = outpostLink(h, 'murtuzabuilds.github.io');
  assert.ok(url.startsWith('https://murtuzabuilds.github.io/outpost/#dock='));
  assert.deepEqual(decodeDock(url.split('#dock=')[1]), h);
});

test('writeHandoff writes the fixed key and survives a broken storage', () => {
  const mem = new Map(), store = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  writeHandoff(store, { ...make(), id: 'umb-a' });
  const out = writeHandoff(store, { ...make(), id: 'umb-b' });
  assert.deepEqual(JSON.parse(mem.get(HANDOFF_KEY)), out);
  assert.equal(out.agents.length, 2);
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(writeHandoff(broken, make()).agents.length, 1);
  assert.equal(slug('  Unregistered agent 7f3 '), 'unregistered-agent-7f3');
});
