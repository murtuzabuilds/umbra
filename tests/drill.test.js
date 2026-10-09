import test from 'node:test';
import assert from 'node:assert/strict';
import { runDrill, DRILL_CASES, wouldCatch, DEFAULT_POLICIES, ORG, AGENTS, evaluate, timeline, dayState, run, describe } from '../src/index.js';

const byId = (rs, id) => rs.find(r => r.id === id);

test('drill: each case gets the outcome the console shows, from the real engine', () => {
  const rs = runDrill(DEFAULT_POLICIES, ORG, AGENTS);
  assert.equal(rs.length, DRILL_CASES.length);
  const a = byId(rs, 'agent-exfil');
  assert.equal(a.action, 'block'); assert.equal(a.rule, 'P-07'); assert.equal(a.held, true); assert.equal(a.gap, null);
  assert.ok(a.agentIssues.includes('shadow_agent'));
  const b = byId(rs, 'injection');
  assert.equal(b.action, 'allow'); assert.equal(b.held, false);
  assert.deepEqual(b.signals, ['Instruction override', 'Exfiltration request']);
  assert.deepEqual(b.gap, { rule: 'P-09', name: 'Hold messages with hidden instructions', action: 'require_approval' });
  const c = byId(rs, 'conf-paste');
  assert.equal(c.action, 'coach'); assert.equal(c.rule, 'P-05'); assert.equal(c.held, false);
  assert.equal(c.gap.rule, 'P-08'); assert.equal(c.gap.action, 'block');
});

test('drill: turning on the suggested rules closes the gaps', () => {
  const on = DEFAULT_POLICIES.map(p => ['P-08', 'P-09'].includes(p.id) ? { ...p, enabled: true } : p);
  const rs = runDrill(on, ORG, AGENTS);
  assert.ok(rs.every(r => r.held));
  assert.equal(byId(rs, 'injection').action, 'require_approval');
  assert.equal(byId(rs, 'conf-paste').rule, 'P-08');
});

test('drill: the decisions match a direct evaluate() call', () => {
  for (const r of runDrill(DEFAULT_POLICIES, ORG, AGENTS)) assert.equal(evaluate(r.event, DEFAULT_POLICIES, ORG).action, r.action);
  assert.equal(wouldCatch({ id: 'z', ts: 0, channel: 'prompt', host: 'app.aster.ai', user: { id: 'u', team: 'Claims' }, text: 'hello' }, DEFAULT_POLICIES, ORG), null);
});

test('P-09 is off by default and reads back in plain words', () => {
  const p = DEFAULT_POLICIES.find(x => x.id === 'P-09');
  assert.equal(p.enabled, false);
  assert.match(describe(p), /hidden instructions/);
  const R = run();
  assert.equal(R.metrics.alerts, 888, 'a switched-off rule changes no decision');
});

test('timeline: the replay ends exactly on today, and only uses real days', () => {
  const R = run();
  const tl = timeline(R.events, R.decisions);
  assert.equal(tl.days.length, 30);
  const last = tl.totals.at(-1);
  assert.equal(last.interactions, R.events.length);
  assert.equal(last.seen, R.inventory.length);
  assert.equal(last.contained, R.decisions.filter(d => d.findings.length && ['block', 'redact', 'require_approval'].includes(d.action)).length);
  for (const r of R.inventory) assert.equal(tl.services[r.key].cum.at(-1), r.events);
  // cumulative numbers never go down, and nothing is seen before its first event
  for (let i = 1; i < 30; i++) { assert.ok(tl.totals[i].interactions >= tl.totals[i - 1].interactions); assert.ok(tl.totals[i].seen >= tl.totals[i - 1].seen); }
  const d0 = dayState(tl, 0);
  assert.ok(d0.rows.every(row => tl.services[row.key].first === 0));
  assert.equal(dayState(tl, 99).day, 29);
  assert.equal(d0.rows.reduce((a, r) => a + r.contained, 0), tl.totals[0].containedToday);
});
