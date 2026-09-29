// Umbra engine: one call turns raw telemetry into the whole governed picture.

import { ORG, users } from './org.js';
import { SERVICES, identify, serviceRisk, riskBand } from './catalog.js';
import { evaluate, DEFAULT_POLICIES } from './policy.js';
import { triage } from './triage.js';
import { readiness, evidencePack } from './compliance.js';
import { AGENTS, CALLS, agentFindings, graph, chainDepth, blastRadius } from './agents.js';
import { demandMap } from './demand.js';
import { generate } from './telemetry.js';

export * from './catalog.js';
export * from './detect.js';
export * from './policy.js';
export * from './triage.js';
export * from './compliance.js';
export * from './agents.js';
export * from './corona.js';
export * from './demand.js';
export * from './simulate.js';
export * from './telemetry.js';
export { ORG } from './org.js';

/** Inventory: every AI destination seen, with who uses it and how risky it is. */
export function inventory(events, decisions, org = ORG) {
  const map = new Map();
  events.forEach((e, i) => {
    const s = identify(e.host);
    const key = s?.id || e.host;
    if (!map.has(key)) map.set(key, { key, service: s, host: e.host, sanctioned: !!s && org.sanctioned.includes(s.id), risk: serviceRisk(s), users: new Set(), teams: new Set(), events: 0, sources: new Set(), sensitive: 0 });
    const row = map.get(key);
    row.events++; row.users.add(e.user.id); row.teams.add(e.user.team); row.sources.add(e.source);
    if (decisions[i].findings.length) row.sensitive++;
  });
  return [...map.values()].map(r => ({ ...r, users: r.users.size, teams: [...r.teams], sources: [...r.sources], band: riskBand(r.risk) }))
    .sort((a, b) => b.events - a.events);
}

/**
 * AI governance maturity, for the board. Five levels, from not knowing what AI is in use
 * to governing agents by mandate. It turns a security posture into a transformation roadmap.
 */
export const MATURITY = [
  { level: 0, name: 'Dark', means: 'No inventory. Nobody knows which AI tools or agents are in use.' },
  { level: 1, name: 'Aware', means: 'AI use is discovered and inventoried, but not governed.' },
  { level: 2, name: 'Guided', means: 'Sensitive data is protected and people are coached toward approved tools.' },
  { level: 3, name: 'Governed', means: 'Policies are enforced, simulated before change, and evidenced for audit.' },
  { level: 4, name: 'Autonomous-ready', means: 'Every agent has an owner and a mandate. The company can safely let AI act.' },
];

export function maturityOf(m) {
  if (m.totality < 0.5) return MATURITY[0];
  if (m.preventionRate < 0.9) return MATURITY[1];
  if (m.readiness < 0.75) return MATURITY[2];
  if (m.agentCoverage < 1) return MATURITY[3];
  return MATURITY[4];
}

export function run({ events = generate(), policies = DEFAULT_POLICIES, org = ORG, calls = CALLS, agents = AGENTS } = {}) {
  const decisions = events.map(e => evaluate(e, policies, org));
  const inv = inventory(events, decisions, org);
  const tri = triage(decisions, events);
  const agentIssues = agentFindings(calls);
  const g = graph(calls);

  const aiEvents = events.length;
  const recognised = decisions.filter(d => d.service).length;
  const sensitive = decisions.filter(d => d.findings.length);
  const prevented = sensitive.filter(d => ['block', 'redact', 'require_approval'].includes(d.action) || d.sanctioned);
  const onPaved = decisions.filter(d => d.sanctioned).length;
  const coached = new Set(decisions.filter(d => d.action === 'coach').map((d, i) => d.eventId));
  const coachedUsers = new Set(events.filter(e => coached.has(e.id)).map(e => e.user.id));
  const shadowUsers = new Set(events.filter((e, i) => !decisions[i].sanctioned).map(e => e.user.id));

  const metrics = {
    events: aiEvents,
    services: inv.length,
    shadowServices: inv.filter(r => !r.sanctioned).length,
    totality: recognised / aiEvents,
    pavedRoad: onPaved / aiEvents,
    sensitive: sensitive.length,
    preventionRate: sensitive.length ? prevented.length / sensitive.length : 1,
    exposures: sensitive.length - prevented.length,
    blocked: decisions.filter(d => d.action === 'block').length,
    redacted: decisions.filter(d => d.action === 'redact').length,
    coached: coached.size,
    agents: agents.length,
    shadowAgents: agents.filter(a => !a.registered).length,
    agentCoverage: agents.filter(a => a.registered).length / agents.length,
    agentViolations: agentIssues.length,
    chainDepth: chainDepth(calls),
    alerts: tri.alerts,
    openIncidents: tri.open,
    noiseReduction: tri.reduction,
  };

  const state = {
    org: org.name, asOf: events[events.length - 1]?.ts || Date.now(), days: 30,
    inventoryCoverage: metrics.totality,
    preventionRate: metrics.preventionRate,
    loggingCoverage: 1,
    agentCoverage: metrics.agentCoverage,
    transparency: 0.86,
    coachingReach: shadowUsers.size ? coachedUsers.size / shadowUsers.size : 1,
    vendorAssessed: org.sanctioned.length / org.sanctioned.length,
    simulatedChanges: 1,
  };
  const ready = readiness(state);
  metrics.readiness = ready.score;
  const maturity = maturityOf(metrics);

  return {
    org, events, decisions, policies, inventory: inv, triage: tri, readiness: ready, state,
    evidence: evidencePack(state, ready, decisions.filter(d => d.action !== 'allow').slice(0, 6)),
    agents: { list: agents, calls, graph: g, findings: agentIssues, blast: agents.map(a => blastRadius(a.id, agents)) },
    demand: demandMap(events, decisions, { scale: org.employees / users().length }),
    metrics, maturity,
  };
}

/**
 * AI bill of materials, CycloneDX-style. Software got SBOMs after supply-chain attacks;
 * AI needs the same: which models, services and agents a company depends on, and how risky each is.
 */
export function aibom(result) {
  const components = [
    ...result.inventory.map(r => ({
      type: r.service?.category === 'api' ? 'machine-learning-model' : 'service',
      name: r.service?.name || r.host,
      supplier: { name: r.service?.vendor || 'unknown' },
      'umbra:kind': 'service',
      'umbra:approved': r.sanctioned,
      'umbra:risk': r.risk,
      'umbra:trainsOnInputs': r.service ? r.service.trainsOnInputs : null,
      'umbra:attestations': r.service?.attestations || [],
      'umbra:users': r.users,
    })),
    ...result.agents.list.map(a => ({
      type: 'application', name: a.name, 'umbra:kind': 'agent', 'umbra:owner': a.owner, 'umbra:registered': a.registered,
      'umbra:mandate': a.mandate, 'umbra:blastRadius': result.agents.blast.find(b => b.agent === a.id)?.score ?? null,
    })),
  ];
  return { bomFormat: 'CycloneDX', specVersion: '1.6', metadata: { component: { name: result.org.name }, tools: [{ name: 'Umbra' }] }, components };
}
