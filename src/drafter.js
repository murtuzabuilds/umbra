// Corona's rule drafting, in the browser. If the drafter Worker is set up, a model drafts the rule and
// the Worker checks it against Umbra's rule language. If it is not set up, or does not answer in time,
// Umbra drafts with its own rules-based parser and says so. Either way a person reviews the draft and
// Umbra's fixed rules engine enforces it; the model never decides anything.
import { compilePolicy, messageFor, describe } from './corona.js';

/** Address of the drafter Worker. Empty means rules-based drafting only. */
export const DRAFTER_URL = 'https://umbra-drafter.murtuzabuilds.workers.dev';

export async function draftPolicy(sentence, { id = 'P-NEW', url = DRAFTER_URL, fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {}) {
  const s = String(sentence || '').trim();
  const fallback = (note) => ({ ...compilePolicy(s, { id }), source: 'rules', note });
  if (!url || !fetchImpl) return fallback('');
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetchImpl(url.replace(/\/$/, '') + '/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ say: s }), signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) return fallback('The model is unavailable right now, so Umbra drafted this with its rules-based parser.');
    const j = await res.json();
    const name = s.length > 60 ? s.slice(0, 57).trim() + '...' : s;
    if (!j.rule) return { rule: null, doubts: j.doubts || [], confidence: 0, readable: '', source: 'model', model: j.model, provider: j.provider, note: '' };
    const rule = { id, name, enabled: true, when: j.rule.when, action: j.rule.action, message: messageFor(j.rule.action, j.rule.when) };
    return { rule, doubts: j.doubts || [], confidence: Math.max(0.35, 1 - (j.doubts || []).length * 0.25), readable: describe(rule), source: 'model', model: j.model, provider: j.provider, note: '' };
  } catch {
    return fallback('The model did not answer in time, so Umbra drafted this with its rules-based parser.');
  }
}
