// Umbra to Outpost: the one handoff between the two products.
//
// Umbra decides what AI gets in: which agent may exist, who owns it, which approved model it runs on and what it may touch. Outpost runs it.
// When a person approves an agent here, Umbra writes a small, fixed-shape record that Outpost
// reads: localStorage `umbra.outpost.handoff` and a `#dock=` link in the URL.
// Everything below is pure so the shape can be tested without a browser.

export const HANDOFF_KEY = 'umbra.outpost.handoff';
export const HANDOFF_VERSION = 1;
export const MAX_AGENTS = 3;

/** Where Outpost lives. One constant; localhost points at a local copy for testing. */
export const OUTPOST_URL = 'https://murtuzabuilds.com/outpost/';
export const OUTPOST_LOCAL_URL = 'http://localhost:8821/index.html';

/** The only tool ids Outpost accepts, with the words Outpost shows for them. */
export const OUTPOST_TOOLS = {
  'claims.write': 'Sort and update claims',
  'fraud.flag': 'Flag suspicious claims',
  'payments.refund': 'Issue refunds',
  'payments.pay': 'Pay invoices',
  'email.send': 'Send customer emails',
  'crm.read': 'Read contact details',
  'crm.write': 'Update contact details',
  'crm.records': 'Read full customer records',
  'docs.write': 'Write documents',
  'calendar.write': 'Book calendar time',
  'ledger.write': 'Post to the ledger',
  'data.export': 'Send data outside the company',
  'accounts.close': 'Close accounts',
  'underwriting.models': 'Read underwriting models',
};

/** Permissions that are never ticked for you. Each says why, in plain words. */
export const RISKY = {
  'data.export': 'Sends company data to places outside the company. Off unless you are sure.',
  'payments.pay': 'Moves money out. Off by default, and the money limit applies.',
  'payments.refund': 'Moves money back to customers. Off by default, and the money limit applies.',
  'accounts.close': 'Cannot be undone. Off by default.',
  'ledger.write': 'Changes the books. Off by default.',
};
/** Default Outpost bot name for Agent 7f3. Never one of the crew names Outpost already uses. */
export const DEFAULT_BOT_NAME = 'Fern';
export const OUTPOST_CREW = ['Pip', 'Sable', 'Juno', 'Kite', 'Bolt', 'Moss', 'Dot', 'Rook'];

/** Data classes that keep a permission unticked when the agent was seen using it with them. */
export const SENSITIVE_SEEN = ['CONF'];
export const SEEN_WITH_CONF = 'It was seen with confidential data. Off unless you are sure.';

export const MONEY_TOOLS = ['payments.pay', 'payments.refund', 'ledger.write'];
/** Models an agent may run on to get in: approved services that serve models (catalog ids and the names Outpost shows). */
export const AGENT_MODELS = { aster: 'Aster Enterprise', 'vega-api': 'Vega Model API' };
export const DEFAULT_MODEL = 'aster';

/**
 * What Umbra watched agents do (MCP gateway tool names) mapped to Outpost permissions.
 * Tools with no honest equivalent map to null and are listed as not carried over.
 */
export const OBSERVED_TO_OUTPOST = {
  'claims.create': 'claims.write',
  'claims.read': 'claims.write',
  'score.fraud': 'fraud.flag',
  'crm.read': 'crm.read',
  'quotes.draft': 'docs.write',
  'mail.draft': 'email.send',
  'mail.send': 'email.send',
  'recon.run': 'ledger.write',
  'ledger.read': null,
  'docs.parse': null,
  'files.read.all': 'crm.records',
  'web.post': 'data.export',
  'calendar.write': 'calendar.write',
};

const CAPS = { model: 40, name: 16, job: 60, owner: 48, team: 32, umbraName: 60, rule: 120, rules: 6, limit: 1_000_000 };

const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

export function slug(s) {
  return String(s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'agent';
}

/** Keep only tool ids Outpost knows, once each, in Outpost's own order. */
export function cleanTools(list) {
  const want = new Set((Array.isArray(list) ? list : []).map(String));
  return Object.keys(OUTPOST_TOOLS).filter(t => want.has(t));
}

/**
 * Default permissions from what the agent was observed doing.
 * `observed` is a list of gateway tool names, or of calls ({tool, data}) so the data seen can count.
 * Safe mapped tools are ticked. Risky ones, and any seen with confidential data, are offered but
 * left unticked, with the reason.
 */
export function suggestTools(observed = []) {
  const items = (Array.isArray(observed) ? observed : []).map(o => (o && typeof o === 'object') ? { tool: String(o.tool), data: Array.isArray(o.data) ? o.data.map(String) : [] } : { tool: String(o), data: [] });
  const mapped = [], unmapped = [];
  for (const { tool: t, data } of items) {
    const o = OBSERVED_TO_OUTPOST[t];
    if (!o) { if (!unmapped.includes(t)) unmapped.push(t); continue; }
    let m = mapped.find(x => x.tool === o);
    if (!m) mapped.push(m = { tool: o, from: [], data: [] });
    if (!m.from.includes(t)) m.from.push(t);
    for (const d of data) if (!m.data.includes(d)) m.data.push(d);
  }
  const suggested = mapped.map(m => {
    const conf = m.data.some(d => SENSITIVE_SEEN.includes(d));
    const reason = RISKY[m.tool] ? (conf ? `${RISKY[m.tool]} ${SEEN_WITH_CONF.split('.')[0]}.` : RISKY[m.tool]) : conf ? SEEN_WITH_CONF : null;
    return { tool: m.tool, from: m.from, label: OUTPOST_TOOLS[m.tool], risky: !!RISKY[m.tool] || conf, conf, reason, ticked: !RISKY[m.tool] && !conf };
  });
  return { suggested, defaults: cleanTools(suggested.filter(x => x.ticked).map(x => x.tool)), unmapped };
}

/** The short rules Outpost shows on the bot's badge, written from what the person set. */
export function rulesFor({ owner, tools, limit, withheld = [], model }) {
  const t = cleanTools(tools), out = [];
  out.push(`${clip(owner, CAPS.owner) || 'A named person'} owns it and answers for it`);
  if (model) out.push(`Runs only on ${clip(model, CAPS.model)}, an approved model`);
  out.push(t.length ? `May use only: ${t.map(x => OUTPOST_TOOLS[x].toLowerCase()).join(', ')}` : 'May use no tools until its owner adds one');
  const money = t.some(x => MONEY_TOOLS.includes(x));
  out.push(money ? (limit > 0 ? `Moves up to $${Number(limit).toLocaleString('en-US')} alone, more needs a person` : 'Every money move needs a person') : 'Moves no money');
  for (const w of cleanTools(withheld)) out.push(`Not allowed: ${OUTPOST_TOOLS[w].toLowerCase()}`);
  return out.slice(0, CAPS.rules).map(r => clip(r, CAPS.rule));
}

/** Build one AGENT record in the fixed contract shape, with every field clipped and checked. */
export function buildAgent({ agent, name, job, owner, team, tools, limit = 0, approvedAt = new Date(), withheld = [], rules, model = DEFAULT_MODEL } = {}) {
  const modelName = AGENT_MODELS[model] || AGENT_MODELS[DEFAULT_MODEL];
  const umbraName = clip(agent?.name, CAPS.umbraName) || 'Agent';
  const t = cleanTools(tools);
  const lim = Math.max(0, Math.min(CAPS.limit, Math.round(Number(limit) || 0)));
  const iso = approvedAt instanceof Date ? approvedAt.toISOString() : new Date(approvedAt).toISOString();
  return {
    id: `umb-${slug(agent?.id || umbraName).replace(/^ag-/, '')}`,
    name: clip(name, CAPS.name) || 'Bot',
    job: clip(job, CAPS.job) || 'Unassigned',
    owner: clip(owner, CAPS.owner),
    team: clip(team, CAPS.team),
    tools: t,
    limit: lim,
    approvedAt: iso,
    source: 'umbra',
    umbraName,
    model: modelName,
    rules: (Array.isArray(rules) ? rules : rulesFor({ owner, tools: t, limit: lim, withheld, model: modelName })).slice(0, CAPS.rules).map(r => clip(r, CAPS.rule)).filter(Boolean),
  };
}

/** Read whatever is stored, tolerating junk. Always returns a valid handoff object. */
export function parseHandoff(raw) {
  try {
    const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (o && o.v === HANDOFF_VERSION && Array.isArray(o.agents)) return { v: HANDOFF_VERSION, agents: o.agents.filter(a => a && typeof a.id === 'string').slice(-MAX_AGENTS) };
  } catch {}
  return { v: HANDOFF_VERSION, agents: [] };
}

/** Add an agent: same id replaces the old one, newest goes last, at most three kept. */
export function mergeHandoff(existing, agent, max = MAX_AGENTS) {
  const h = parseHandoff(existing);
  const agents = [...h.agents.filter(a => a.id !== agent.id), agent].slice(-max);
  return { v: HANDOFF_VERSION, agents };
}

const b64 = typeof btoa === 'function' ? btoa : s => Buffer.from(s, 'binary').toString('base64');
const unb64 = typeof atob === 'function' ? atob : s => Buffer.from(s, 'base64').toString('binary');

/** base64url of the UTF-8 JSON, no padding. */
export function encodeDock(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return b64(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeDock(s) {
  const t = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = unb64(t + '='.repeat((4 - (t.length % 4)) % 4));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
}

export function outpostBase(hostname = '') {
  return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(String(hostname)) ? OUTPOST_LOCAL_URL : OUTPOST_URL;
}

export function outpostLink(handoff, hostname = '') {
  return `${outpostBase(hostname)}#dock=${encodeDock(handoff)}`;
}

/** Write to a Storage-like object (localStorage in the browser). Returns the handoff written. */
export function writeHandoff(storage, agent) {
  let prev = null;
  try { prev = storage?.getItem(HANDOFF_KEY); } catch {}
  const next = mergeHandoff(prev, agent);
  try { storage?.setItem(HANDOFF_KEY, JSON.stringify(next)); } catch {}
  return next;
}

/** The handoff id Umbra gives an agent: `umb-` plus its own id without the `ag-` prefix. */
export const handoffIdFor = agentId => `umb-${slug(agentId).replace(/^ag-/, '')}`;

/**
 * What Umbra's own record of an agent becomes once a person approved it: owned, on an approved model,
 * and limited to the observed calls the granted Outpost permissions cover. Anything not granted stays
 * outside its limits and keeps being flagged.
 */
export function approvalPatch(agent, rec, calls = []) {
  const tools = cleanTools(rec?.tools);
  const granted = (Array.isArray(calls) ? calls : []).filter(c => c && (c.to === agent.id || c.from === agent.id) && tools.includes(OBSERVED_TO_OUTPOST[c.tool]));
  const model = Object.keys(AGENT_MODELS).find(k => k === rec?.model || AGENT_MODELS[k] === rec?.model) || DEFAULT_MODEL;
  return {
    registered: true, handPaused: false, model,
    owner: clip(rec?.owner, CAPS.owner), team: clip(rec?.team, CAPS.team) || agent.team, job: clip(rec?.job, CAPS.job) || agent.job,
    mandate: { tools: [...new Set(granted.map(c => c.tool))], data: [...new Set(granted.flatMap(c => Array.isArray(c.data) ? c.data : []))], callsAgents: [], maxCallsPerHour: Math.max(60, ...granted.map(c => Number(c.count) || 0)) },
  };
}

/**
 * After a reload: rebuild the approvals a person made from the stored handoff, so Umbra and Outpost agree.
 * Only records Umbra wrote, with an owner, for an agent that is unowned in the sample, count. Junk is skipped.
 * Returns [{ id, rec, patch }]: the agent id, the cleaned handoff record and the patch for the agent.
 */
export function restoreApprovals(raw, agents = [], calls = []) {
  const out = [];
  for (const r of parseHandoff(raw).agents) {
    try {
      if (r.source !== 'umbra' || !clip(r.owner, CAPS.owner)) continue;
      const a = (Array.isArray(agents) ? agents : []).find(x => x && !x.registered && handoffIdFor(x.id) === r.id);
      if (!a || out.some(o => o.id === a.id)) continue;
      const at = Date.parse(r.approvedAt), model = Object.keys(AGENT_MODELS).find(k => k === r.model || AGENT_MODELS[k] === r.model) || DEFAULT_MODEL;
      const rec = buildAgent({ agent: { id: a.id, name: a.name }, name: r.name, job: r.job, owner: r.owner, team: r.team, tools: r.tools, limit: r.limit,
        approvedAt: Number.isNaN(at) ? new Date() : new Date(at), model, rules: Array.isArray(r.rules) ? r.rules.filter(x => typeof x === 'string') : undefined });
      out.push({ id: a.id, rec, patch: approvalPatch(a, rec, calls) });
    } catch {}
  }
  return out;
}
