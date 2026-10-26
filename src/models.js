// Models: the layer under the agents. Umbra decides which AI models agents may run on, sees which agents
// depend on each one, and lets a person pause a model. Pausing a model stops every agent that runs on it,
// here and in Outpost, until a person resumes it. Umbra writes one small record that Outpost reads:
//   localStorage `umbra.models.paused`  ->  { v: 1, paused: [{ id, name }, ...] }
// Everything below is pure so it can be tested without a browser.
import { SERVICES, serviceRisk, CATEGORIES } from './catalog.js';
import { toolStatus } from './status.js';

export const MODEL_PAUSE_KEY = 'umbra.models.paused';
export const MODEL_PAUSE_VERSION = 1;

/** Services that serve models at Kestrel Mutual: the ones agents run on, and the model APIs. */
export function modelServices(agents) {
  const ids = new Set([...agents.map(a => a.model).filter(Boolean), ...SERVICES.filter(s => s.category === 'api').map(s => s.id)]);
  return SERVICES.filter(s => ids.has(s.id));
}

/** One row per model: its facts, its status, the agents that depend on it, and whether it is paused. */
export function modelRows({ agents, calls = [], org, paused = new Set() }) {
  return modelServices(agents).map(s => {
    const sanctioned = org.sanctioned.includes(s.id), risk = serviceRisk(s);
    const on = agents.filter(a => a.model === s.id);
    const ids = new Set(on.map(a => a.id));
    const hops = calls.filter(c => ids.has(c.from) || ids.has(c.to));
    return {
      id: s.id, name: s.name, vendor: s.vendor, kind: CATEGORIES[s.category], sanctioned, risk,
      status: toolStatus({ sanctioned, service: s, risk }),
      trainsOnInputs: s.trainsOnInputs, retentionDays: s.retentionDays, region: s.region, attestations: s.attestations,
      agents: on.map(a => ({ id: a.id, name: a.name, job: a.job, registered: a.registered })),
      data: [...new Set(hops.flatMap(c => c.data))],   /* data seen in its agents' calls (one day of gateway logs) */
      callsPerDay: hops.reduce((n, c) => n + c.count, 0),
      paused: paused.has(s.id),
      /* only an approved model can be paused or resumed here: agents may only get in on approved models */
      pausable: sanctioned,
    };
  }).sort((a, b) => (b.sanctioned - a.sanctioned) || b.agents.length - a.agents.length || a.risk - b.risk);
}

/** Which agents are stopped because a model they run on is paused. */
export const heldBy = (agent, paused) => !!agent.registered && paused.has(agent.model);

/** The record Outpost reads. Only known catalog ids get in, at most eight. */
export function modelPauseRecord(ids) {
  const paused = [...new Set(ids)].map(id => SERVICES.find(s => s.id === id)).filter(Boolean).slice(0, 8).map(s => ({ id: s.id, name: s.name }));
  return { v: MODEL_PAUSE_VERSION, paused };
}
export function writeModelPause(storage, ids) {
  const rec = modelPauseRecord(ids);
  try { if (!rec.paused.length) storage?.removeItem(MODEL_PAUSE_KEY); else storage?.setItem(MODEL_PAUSE_KEY, JSON.stringify(rec)); } catch { /* storage can be blocked */ }
  return rec;
}
/** Ids of the models paused on this device, checked against the catalog. Anything malformed reads as none. */
export function readModelPause(storage) {
  let o = null; try { o = JSON.parse(storage?.getItem(MODEL_PAUSE_KEY) || 'null'); } catch { return []; }
  if (!o || o.v !== MODEL_PAUSE_VERSION || !Array.isArray(o.paused)) return [];
  return [...new Set(o.paused.map(m => m && m.id).filter(id => SERVICES.some(s => s.id === id)))];
}

/**
 * The one real model in Umbra: it drafts rule text in Policies and nothing else. These figures are real,
 * not sample data: they come from eval/results/groq.json (51 policy sentences with an answer key), and a
 * test checks they still match that file.
 */
export const DRAFTER_MODEL = {
  provider: 'Groq', model: 'openai/gpt-oss-120b',
  eval: { total: 51, pass: 46, unsafe: 0, baseline: 28, ran: '2026-10-26' },
};
