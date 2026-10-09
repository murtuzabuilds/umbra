// Keeps Umbra in step with the shared story: crew, owners, the Agent 7f3 handoff, the status palette and the map placement.
import test from 'node:test';
import assert from 'node:assert/strict';
import { AGENTS, CALLS, FINDING_WORDS } from '../src/agents.js';
import { users, AGENT_OWNERS } from '../src/org.js';
import { suggestTools, DEFAULT_BOT_NAME, OUTPOST_CREW, buildAgent } from '../src/handoff.js';
import { STATUS, toolStatus, MAP_LEGEND } from '../src/status.js';
import { run, runDrill, DEFAULT_POLICIES, ORG, MATURITY } from '../src/index.js';
import '../brand/umbra-system.js';
const US = globalThis.umbraSystem;

const CREW = [
  ['Pip', 'Claims intake', 'Rosa Chen', 'Claims'],
  ['Sable', 'Fraud screening', 'Dev Okoye', 'Claims'],
  ['Juno', 'Refunds and billing', 'Priya Patel', 'Finance'],
  ['Kite', 'Customer replies', 'Hana Lopez', 'Customer Care'],
  ['Bolt', 'Broker assist', 'Wren Hayes', 'Underwriting'],
  ['Moss', 'Month-end close', 'Omar Ito', 'Finance'],
  ['Dot', 'Scheduling', 'Mateo Diaz', 'Claims'],
  ['Rook', 'Records and reports', 'Lena Fischer', 'Data Science'],
];
const a7f3 = AGENTS.find(a => a.id === 'ag-unknown-7f3');

test('the approved agents are exactly the Outpost crew, with the same job, owner and team', () => {
  const approved = AGENTS.filter(a => a.registered).map(a => [a.name, a.job, a.owner, a.team]);
  assert.deepEqual(approved, CREW);
  assert.deepEqual(OUTPOST_CREW, CREW.map(c => c[0]));
});

test('every crew owner exists in the org data, on that team, and names stay unique', () => {
  const people = users();
  for (const [, , owner, team] of CREW) assert.ok(people.some(p => p.name === owner && p.team === team), `${owner} on ${team}`);
  assert.deepEqual(AGENT_OWNERS.map(([n]) => n).sort(), CREW.map(c => c[2]).sort());
  assert.equal(new Set(people.map(p => p.name)).size, people.length);
  assert.ok(people.some(p => p.name === 'Gabe Lopez' && p.team === 'Marketing'), 'the person seen using Agent 7f3');
});

test('Agent 7f3 is an unowned Marketing agent that drafts customer emails', () => {
  assert.equal(a7f3.name, 'Agent 7f3');
  assert.equal(a7f3.registered, false);
  assert.equal(a7f3.team, 'Marketing');
  const seen = CALLS.filter(c => c.from === a7f3.id || c.to === a7f3.id);
  assert.deepEqual(seen.map(c => c.tool).sort(), ['crm.read', 'mail.draft', 'web.post']);
  assert.ok(seen.find(c => c.tool === 'web.post').data.includes('CONF'));
});

test('handoff defaults: email.send and crm.read ticked, data.export unticked with its reason', () => {
  const s = suggestTools(CALLS.filter(c => c.from === a7f3.id || c.to === a7f3.id));
  assert.deepEqual(s.defaults, ['email.send', 'crm.read']);
  const exp = s.suggested.find(x => x.tool === 'data.export');
  assert.equal(exp.ticked, false);
  assert.deepEqual(exp.from, ['web.post']);
  assert.match(exp.reason, /outside the company/);
  assert.match(exp.reason, /confidential/);
});

test('any permission seen with confidential data is unticked by default', () => {
  const s = suggestTools([{ tool: 'crm.read', data: ['PII'] }, { tool: 'mail.draft', data: ['CONF'] }]);
  assert.equal(s.suggested.find(x => x.tool === 'crm.read').ticked, true);
  const mail = s.suggested.find(x => x.tool === 'email.send');
  assert.equal(mail.ticked, false);
  assert.match(mail.reason, /confidential/);
  assert.deepEqual(s.defaults, ['crm.read']);
  assert.deepEqual(suggestTools(['mail.draft']).defaults, ['email.send'], 'plain tool names still work');
});

test('the default bot name is Fern and never clashes with the crew', () => {
  assert.equal(DEFAULT_BOT_NAME, 'Fern');
  assert.ok(!OUTPOST_CREW.includes(DEFAULT_BOT_NAME));
  assert.equal(buildAgent({ agent: a7f3, name: DEFAULT_BOT_NAME, owner: 'Gabe Lopez', tools: ['email.send', 'crm.read'] }).umbraName, 'Agent 7f3');
});

test('pausing Agent 7f3 is a real state: its calls stop counting and the drill is refused', () => {
  const agents = AGENTS.map(a => a.id === a7f3.id ? { ...a, paused: true } : a);
  const base = run(), paused = run({ agents });
  assert.equal(base.agents.findings.filter(f => f.code === 'shadow_agent').length, 3);
  assert.equal(paused.agents.findings.filter(f => f.code === 'shadow_agent').length, 0);
  assert.equal(paused.metrics.pausedAgents, 1);
  assert.equal(paused.metrics.shadowAgents, 1, 'still has no owner');
  assert.equal(paused.maturity.level, 3);
  const d = runDrill(DEFAULT_POLICIES, ORG, agents).find(r => r.id === 'agent-exfil');
  assert.equal(d.held, true); assert.equal(d.rule, 'paused');
});

test('finding codes have plain words, maturity level 4 is Agents owned', () => {
  for (const k of ['shadow_agent', 'unapproved_delegation', 'out_of_scope_tool', 'data_class_exceeded']) assert.ok(FINDING_WORDS[k] && !/shadow|_/.test(FINDING_WORDS[k]));
  assert.equal(FINDING_WORDS.shadow_agent, 'no owner');
  assert.equal(MATURITY[4].name, 'Agents owned');
});

test('one status palette in the app and the shared map', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, v.color])), { approved: '#3BE8B0', unapproved: '#FFB347', high: '#FF5470', unowned: '#FF5470' });
  for (const k of Object.keys(STATUS)) { assert.equal(US.STATUS[k].hex, STATUS[k].color); assert.equal(US.STATUS[k].word, STATUS[k].word); }
  assert.equal(US.STATUS.unowned.dashed, true);
  assert.equal(toolStatus({ sanctioned: true, service: {}, risk: 90 }), 'approved');
  assert.equal(toolStatus({ sanctioned: false, service: {}, risk: 25 }), 'unapproved');
  assert.equal(toolStatus({ sanctioned: false, service: null, risk: 10 }), 'high');
  assert.match(MAP_LEGEND, /Green approved, amber unapproved, red high risk/);
});

test('the map places each status honestly between the right rings', () => {
  assert.deepEqual(US.RINGS, ['approvals', 'tool calling', 'API limits', 'rules', 'data boundaries', 'audit trail']);
  const around = g => US.ringsAround(US.place(g));
  assert.deepEqual(around('approved'), US.RINGS, 'approved: inside all six rings');
  assert.deepEqual(around('unapproved'), ['rules', 'data boundaries', 'audit trail'], 'unapproved: between API limits and rules');
  assert.deepEqual(around('high'), ['data boundaries', 'audit trail'], 'high risk: between rules and data boundaries');
  assert.deepEqual(around('unowned'), ['data boundaries', 'audit trail'], 'unowned agents share the high-risk band: nobody has set their limits');
  for (const g of ['approved', 'unapproved', 'high']) for (const t of [0, 0.5, 1]) assert.equal(US.bandOf(US.place(g, t)), g);
  // radius grows outward and stays inside the declared extent
  const rs = [-1, -0.5, 0, 2.5, 4.5, 5.6, 6].map(US.radiusOf);
  for (let i = 1; i < rs.length; i++) assert.ok(rs[i] > rs[i - 1]);
  assert.equal(US.radiusOf(6), US.EXTENT);
  // legacy numeric statuses still map
  assert.deepEqual([2, 1, 0].map(US.statusOf), ['approved', 'unapproved', 'high']);
});

test('the default map shows all 15 sample services and Agent 7f3, with their real status', () => {
  const R = run();
  const P = US.DEFAULT_PLANETS;
  assert.equal(P.filter(p => p.g !== 'unowned').length, R.inventory.length);
  for (const r of R.inventory) { const p = P.find(q => q.n === (r.service?.name || r.host)); assert.ok(p, r.key); assert.equal(p.g, toolStatus(r)); }
  assert.deepEqual(P.filter(p => p.g === 'unowned').map(p => p.n), ['Agent 7f3']);
});

test('every agent runs on a model; the crew on approved ones, and the handoff carries the model', async () => {
  const { AGENTS } = await import('../src/agents.js');
  const { sanctioned } = (await import('../src/org.js')).ORG;
  const H = await import('../src/handoff.js');
  for (const a of AGENTS) assert.ok(a.model, `${a.name} has a model`);
  for (const a of AGENTS.filter(x => x.registered)) assert.ok(H.AGENT_MODELS[a.model], `${a.name} runs on an approved model`);
  assert.ok(!H.AGENT_MODELS[AGENTS.find(a => a.id === 'ag-unknown-7f3').model], 'Agent 7f3 was seen on an unapproved model');
  const rec = H.buildAgent({ agent: { id: 'ag-unknown-7f3', name: 'Agent 7f3' }, name: 'Fern', owner: 'Gabe Lopez', tools: ['email.send'] });
  assert.equal(rec.model, 'Aster Enterprise');
  assert.ok(rec.rules.some(r => /Runs only on Aster Enterprise/.test(r)));
  assert.equal(H.buildAgent({ agent: { id: 'x', name: 'X' }, owner: 'A', tools: [], model: 'loopwork' }).model, 'Aster Enterprise', 'an unapproved model is never sent');
  if (sanctioned) for (const k of Object.keys(H.AGENT_MODELS)) assert.ok(sanctioned.includes(k));
});
