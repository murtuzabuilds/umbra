// Agents as first-class identities. Every agent has an owner, a mandate (what it may
// touch), and a place in the interaction graph. Umbra reads MCP gateway logs to see
// human-to-agent and agent-to-agent calls, and checks each one against its mandate.

export const AGENTS = [
  { id: 'ag-claims-intake', name: 'Claims Intake Agent', owner: 'Rosa Chen', platform: 'relay', registered: true,
    mandate: { tools: ['crm.read', 'claims.create', 'docs.parse'], data: ['PII'], callsAgents: ['ag-fraud-screen'], maxCallsPerHour: 400 } },
  { id: 'ag-fraud-screen', name: 'Fraud Screening Agent', owner: 'Dev Okoye', platform: 'relay', registered: true,
    mandate: { tools: ['claims.read', 'score.fraud'], data: ['PII', 'FIN'], callsAgents: [], maxCallsPerHour: 600 } },
  { id: 'ag-sales-assist', name: 'Broker Assist Agent', owner: 'Wren Hayes', platform: 'relay', registered: true,
    mandate: { tools: ['crm.read', 'quotes.draft', 'mail.draft'], data: ['PII'], callsAgents: ['ag-claims-intake'], maxCallsPerHour: 200 } },
  { id: 'ag-finance-close', name: 'Month-End Close Agent', owner: 'Omar Ito', platform: 'nova-api', registered: true,
    mandate: { tools: ['ledger.read', 'recon.run'], data: ['FIN'], callsAgents: [], maxCallsPerHour: 120 } },
  { id: 'ag-unknown-7f3', name: 'Unregistered agent 7f3', owner: null, platform: 'loopwork', registered: false,
    mandate: { tools: [], data: [], callsAgents: [], maxCallsPerHour: 0 } },
];

// A day of MCP gateway traffic (synthetic).
export const CALLS = [
  { id: 'c1', from: 'human:Rosa Chen', to: 'ag-claims-intake', tool: 'claims.create', data: ['PII'], count: 212 },
  { id: 'c2', from: 'ag-claims-intake', to: 'ag-fraud-screen', tool: 'score.fraud', data: ['PII'], count: 198 },
  { id: 'c3', from: 'ag-fraud-screen', to: 'tool', tool: 'score.fraud', data: ['PII', 'FIN'], count: 198 },
  { id: 'c4', from: 'human:Wren Hayes', to: 'ag-sales-assist', tool: 'quotes.draft', data: ['PII'], count: 64 },
  { id: 'c5', from: 'ag-sales-assist', to: 'ag-claims-intake', tool: 'claims.read', data: ['PII'], count: 18 },
  { id: 'c6', from: 'ag-sales-assist', to: 'tool', tool: 'mail.send', data: ['PII'], count: 9 },
  { id: 'c7', from: 'ag-sales-assist', to: 'ag-finance-close', tool: 'ledger.read', data: ['FIN'], count: 3 },
  { id: 'c8', from: 'human:Omar Ito', to: 'ag-finance-close', tool: 'recon.run', data: ['FIN'], count: 22 },
  { id: 'c9', from: 'human:Gabe Lopez', to: 'ag-unknown-7f3', tool: 'files.read.all', data: ['CONF', 'PII'], count: 41 },
  { id: 'c10', from: 'ag-unknown-7f3', to: 'tool', tool: 'web.post', data: ['CONF'], count: 41 },
  { id: 'c11', from: 'ag-claims-intake', to: 'tool', tool: 'docs.parse', data: ['PII', 'PHI'], count: 37 },
];

const byId = id => AGENTS.find(a => a.id === id);

/** Check one call against the caller's (or target's) mandate. Returns violations with reasons. */
export function checkCall(call) {
  const v = [];
  const caller = call.from.startsWith('human:') ? null : byId(call.from);
  const target = call.to === 'tool' ? null : byId(call.to);
  const actor = caller || target; // whose mandate governs this hop
  if (target && !target.registered) v.push({ code: 'shadow_agent', severity: 'critical', text: `${target.name} has no owner and no mandate, yet it received ${call.count} requests.` });
  if (caller && !caller.registered) v.push({ code: 'shadow_agent', severity: 'critical', text: `${caller.name} is acting with no owner and no mandate.` });
  if (caller && target && !caller.mandate.callsAgents.includes(target.id)) {
    v.push({ code: 'unapproved_delegation', severity: 'high', text: `${caller.name} called ${target.name}, which its mandate does not allow.` });
  }
  const scopeOwner = call.to === 'tool' ? caller : target;
  if (scopeOwner && scopeOwner.registered && !scopeOwner.mandate.tools.includes(call.tool)) {
    v.push({ code: 'out_of_scope_tool', severity: 'high', text: `${scopeOwner.name} used ${call.tool}, which is outside its mandate.` });
  }
  if (actor && actor.registered) {
    const extra = call.data.filter(d => !actor.mandate.data.includes(d));
    if (extra.length) v.push({ code: 'data_class_exceeded', severity: extra.includes('PHI') ? 'critical' : 'high', text: `${actor.name} handled ${extra.join(', ')} data, which its mandate does not cover.` });
  }
  return v;
}

/** Length of the longest delegation chain starting from a human. Deep chains hide accountability. */
export function chainDepth(calls = CALLS) {
  const edges = calls.filter(c => c.to !== 'tool');
  const next = from => edges.filter(e => e.from === from).map(e => e.to);
  const walk = (node, seen) => {
    const kids = next(node).filter(k => !seen.has(k));
    return kids.length ? 1 + Math.max(...kids.map(k => walk(k, new Set([...seen, k])))) : 0;
  };
  return Math.max(0, ...edges.filter(e => e.from.startsWith('human:')).map(e => walk(e.from, new Set([e.from]))));
}

export function graph(calls = CALLS) {
  const nodes = new Map();
  const add = (id, kind, label) => { if (!nodes.has(id)) nodes.set(id, { id, kind, label }); };
  const edges = calls.map(c => {
    add(c.from, c.from.startsWith('human:') ? 'human' : 'agent', c.from.replace('human:', ''));
    const toId = c.to === 'tool' ? `tool:${c.tool}` : c.to;
    add(toId, c.to === 'tool' ? 'tool' : 'agent', c.to === 'tool' ? c.tool : byId(c.to)?.name || c.to);
    const violations = checkCall(c);
    return { ...c, target: toId, violations };
  });
  for (const n of nodes.values()) if (n.kind === 'agent') { const a = byId(n.id); n.label = a?.name || n.id; n.registered = !!a?.registered; n.owner = a?.owner; }
  return { nodes: [...nodes.values()], edges };
}

export function agentFindings(calls = CALLS) {
  return calls.flatMap(c => checkCall(c).map(v => ({ ...v, call: c.id, from: c.from, to: c.to, tool: c.tool, count: c.count })));
}

/**
 * Blast radius: if this agent were compromised, which data classes and tools could an
 * attacker reach through it, following every agent it is allowed to call?
 * Uses mandates (what is permitted), not traffic (what happened), because that is the
 * exposure an attacker inherits.
 */
export function blastRadius(agentId, agents = AGENTS) {
  const seen = new Set(), data = new Set(), tools = new Set();
  const walk = id => {
    if (seen.has(id)) return;
    seen.add(id);
    const a = agents.find(x => x.id === id);
    if (!a) return;
    a.mandate.data.forEach(d => data.add(d));
    a.mandate.tools.forEach(t => tools.add(t));
    a.mandate.callsAgents.forEach(walk);
  };
  walk(agentId);
  const weights = { PHI: 30, SECRET: 30, FIN: 22, PII: 18, IP: 18, CONF: 12 };
  const score = Math.min(100, [...data].reduce((s, d) => s + (weights[d] || 5), 0) + tools.size * 4 + (seen.size - 1) * 8);
  return { agent: agentId, reaches: [...seen].filter(x => x !== agentId), data: [...data], tools: [...tools], score };
}
