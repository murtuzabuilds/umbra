import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftPolicy } from '../src/drafter.js';

const SAY = 'Block secrets from going to any AI tool.';

test('when the model service errors, Umbra drafts with its rules and says so', async () => {
  const d = await draftPolicy(SAY, { url: 'https://x.test', fetchImpl: async () => ({ ok: false, status: 503 }) });
  assert.equal(d.source, 'rules');
  assert.match(d.note, /unavailable/);
  assert.equal(d.rule.action, 'block');
});

test('when the model does not answer in time, Umbra drafts with its rules and says so', async () => {
  const hang = (u, o) => new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(new Error('aborted'))));
  const d = await draftPolicy(SAY, { url: 'https://x.test', fetchImpl: hang, timeoutMs: 30 });
  assert.equal(d.source, 'rules');
  assert.match(d.note, /in time/);
});

test('when the model raises a doubt instead of a rule, no rule is returned', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ rule: null, doubts: ['No condition.'], model: 'm' }) });
  const d = await draftPolicy('Hold everything.', { url: 'https://x.test', fetchImpl });
  assert.equal(d.rule, null);
  assert.equal(d.confidence, 0);
});
