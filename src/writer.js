// Corona's writing, in the browser: incident summaries and the weekly brief.
// Umbra builds the facts and a plain template from its own data. A model rewrites them into clearer prose
// through the same Worker that drafts rules. Every number the model writes must appear in the facts;
// if one does not, or the model is paused or slow, Umbra shows its template and says so.
// The model only writes words. It never changes a decision, a count or an action.
import { DRAFTER_URL } from './drafter.js';

const WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, twenty: 20, thirty: 30, hundred: 100, thousand: 1000, once: 1, twice: 2 };

/** Every number in a text, as plain digits: "1,284" and "$1,284" give 1284, "twelve" gives 12, "90%" gives 90. */
export function numbersIn(text) {
  const s = String(text || '').toLowerCase();
  const out = (s.match(/\d[\d,]*(?:\.\d+)?/g) || []).map(n => n.replace(/,/g, '').replace(/\.0+$/, ''));
  for (const w of s.match(/[a-z]+/g) || []) if (w in WORDS) out.push(String(WORDS[w]));
  return out;
}

/** True when every number in the writing also appears in the sources. Returns the stray numbers otherwise. */
export function grounded(writing, ...sources) {
  const known = new Set(sources.flatMap(x => numbersIn(typeof x === 'string' ? x : JSON.stringify(x))));
  known.add('1'); // "one person", "a single tool": too common to police
  const stray = [...new Set(numbersIn(writing).filter(n => !known.has(n)))];
  return { ok: stray.length === 0, stray };
}

/**
 * The summary must keep what happened to the data. A number check cannot see "masked" turn into "sent",
 * so the outcome Umbra recorded has to be named in the analyst's summary, in its own words or close ones.
 */
const OUTCOME_WORDS = [ // first match wins: "masked before they reached" is a masking, not a leak
  [/\bmasked\b/, /\b(mask|masked|redact|redacted|replaced|placeholder|scrubbed)\b/],
  [/\bblocked\b/, /\b(block|blocked|stopped|prevented|refused)\b/],
  [/\bheld\b/, /\b(held|hold|holding|awaiting|pending|waiting|review)\b/],
  [/\bstopped by policy\b/, /\b(stopped|blocked|masked|redacted|held|policy|prevented)\b/],
  [/\bcoached\b|\bwith a note\b/, /\b(coach|coached|nudge|nudged|note|pointed|steered|guided|approved (?:tool|option|alternative))\b/],
  [/\binteractions? reached\b/, /\b(reach|reached|exposed|went to|sent to|received|shared with|left)\b/],
];
export function keepsOutcome(writing, outcome) {
  const o = String(outcome || '').toLowerCase(), w = String(writing || '').toLowerCase();
  const rule = OUTCOME_WORDS.find(([k]) => k.test(o));
  if (!rule) return true;
  const leak = /\binteractions? reached\b/.test(o) || /\bthe one interaction reached\b/.test(o);
  if (!leak && /\b(exposed|leaked)\b/.test(w)) return false; // never claim a leak that did not happen
  return rule[1].test(w);
}
/** Neither text may name a different outcome: a masked message must not be called blocked, and the other way round. */
export function contradictsOutcome(writing, outcome) {
  const o = String(outcome || '').toLowerCase(), w = String(writing || '').toLowerCase();
  const masked = /\bmasked\b/.test(o), blocked = /\bblocked\b/.test(o);
  if (masked && !blocked && /\bblock(ed|s)?\b/.test(w)) return true;
  if (blocked && !masked && /\b(masked|redacted)\b/.test(w)) return true;
  return false;
}

const clip = (s, n) => String(s || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

async function ask(kind, facts, template, { url = DRAFTER_URL, fetchImpl = globalThis.fetch, timeoutMs = 9000 } = {}) {
  if (!url || !fetchImpl) return { error: 'off' };
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetchImpl(url.replace(/\/$/, '') + '/write', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, facts, template }), signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) return { error: 'unavailable' };
    return await res.json();
  } catch { return { error: 'timeout' }; }
}
const NOTES = {
  off: 'Umbra\'s model is paused, so this is Umbra\'s own template.',
  unavailable: 'The model is unavailable right now, so this is Umbra\'s own template.',
  timeout: 'The model did not answer in time, so this is Umbra\'s own template.',
  ungrounded: 'The model wrote a number that is not in the facts, so Umbra rejected it and shows its own template.',
  outcome: 'The model\'s summary did not keep what happened to the data, so Umbra rejected it and shows its own template.',
};

/** Summary of one incident for the analyst, and a note for the person involved. */
export async function writeIncident(facts, template, opts) {
  const fall = why => ({ ...template, source: 'template', note: NOTES[why] || NOTES.unavailable });
  const j = await ask('incident', facts, template, opts);
  if (j.error || !j.analyst || !j.employee) return fall(j.error || 'unavailable');
  const analyst = clip(j.analyst, 600), employee = clip(j.employee, 400);
  if (!grounded(analyst + ' ' + employee, facts, template).ok) return fall('ungrounded');
  if (!keepsOutcome(analyst, facts.whatHappened) || contradictsOutcome(analyst + ' ' + employee, facts.whatHappened)) return fall('outcome');
  return { analyst, employee, source: 'model', model: j.model, note: '' };
}

/** The weekly brief: up to five short paragraphs. The headline and the buttons stay Umbra's own. */
export async function writeBrief(facts, template, opts) {
  const fall = why => ({ paras: null, source: 'template', note: NOTES[why] || NOTES.unavailable });
  const j = await ask('brief', facts, template, opts);
  if (j.error || !Array.isArray(j.paras) || !j.paras.length) return fall(j.error || 'unavailable');
  const paras = j.paras.slice(0, 5).map(p => clip(p, 420)).filter(Boolean);
  if (!paras.length || !grounded(paras.join(' '), facts, template).ok) return fall('ungrounded');
  return { paras, source: 'model', model: j.model, note: '' };
}
