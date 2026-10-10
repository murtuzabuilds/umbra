import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as U from '../src/index.js';

const mem = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; };

test('the Models view lists the models agents run on, each with the agents that depend on it', () => {
  const rows = U.modelRows({ agents: U.AGENTS, calls: U.CALLS, org: U.ORG });
  const by = Object.fromEntries(rows.map(r => [r.id, r]));
  assert.deepEqual(by.aster.agents.map(a => a.name), ['Pip', 'Juno', 'Kite', 'Bolt', 'Dot']);
  assert.deepEqual(by['vega-api'].agents.map(a => a.name), ['Sable', 'Moss', 'Rook']);
  assert.equal(by.loopwork.status, 'high'); assert.equal(by.loopwork.pausable, false);
  assert.ok(by.deepwell && !by.deepwell.agents.length);
  for (const a of U.AGENTS) assert.ok(rows.some(r => r.id === a.model), `${a.name}'s model is listed`);
  assert.ok(rows.filter(r => r.pausable).every(r => U.ORG.sanctioned.includes(r.id)), 'only approved models can be paused');
});

test('pausing a model holds exactly its approved agents', () => {
  const paused = new Set(['vega-api']);
  const held = U.AGENTS.filter(a => U.heldBy(a, paused)).map(a => a.name);
  assert.deepEqual(held, ['Sable', 'Moss', 'Rook']);
});

test('the pause record Outpost reads carries catalog names, and junk never gets in', () => {
  const s = mem();
  const rec = U.writeModelPause(s, ['vega-api', 'vega-api', 'not-a-model']);
  assert.deepEqual(rec, { v: 1, paused: [{ id: 'vega-api', name: 'Vega Model API' }] });
  assert.deepEqual(U.readModelPause(s), ['vega-api']);
  U.writeModelPause(s, []); assert.equal(s.getItem(U.MODEL_PAUSE_KEY), null);
  s.setItem(U.MODEL_PAUSE_KEY, '{"v":1,"paused":[{"id":"<img>"}]}'); assert.deepEqual(U.readModelPause(s), []);
  s.setItem(U.MODEL_PAUSE_KEY, 'not json'); assert.deepEqual(U.readModelPause(s), []);
});

test('Outpost knows every model by the same name Umbra uses', () => {
  const crew = readFileSync(new URL('../../outpost/src/crew.js', import.meta.url), 'utf8');
  const used = [...crew.matchAll(/model: '([^']+)'/g)].map(m => m[1]);
  for (const n of used) assert.ok(U.SERVICES.some(s => s.name === n), `${n} is in Umbra's catalog`);
  for (const n of Object.values(U.handoff.AGENT_MODELS)) assert.ok(U.SERVICES.some(s => s.name === n));
}, { skip: (() => { try { readFileSync(new URL('../../outpost/src/crew.js', import.meta.url)); return false; } catch { return 'Outpost is not checked out next to Umbra'; } })() });

test('the drafting model figures shown in Umbra match the saved eval results', () => {
  const r = JSON.parse(readFileSync(new URL('../eval/results/groq.json', import.meta.url), 'utf8'));
  const E = U.DRAFTER_MODEL.eval;
  assert.equal(r.model, U.DRAFTER_MODEL.model);
  assert.deepEqual([E.total, E.pass, E.unsafe, E.baseline], [r.summary.total, r.summary.pass, r.summary.unsafe, r.baseline.pass]);
  assert.equal(r.ran.slice(0, 10), E.ran);
});
