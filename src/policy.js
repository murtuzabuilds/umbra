// Policy as code. Rules are plain data; evaluation is pure and deterministic.
// Same event + same policy set = same decision, with a trace showing every check.
// No model sits on the enforcement path, which is what makes a decision auditable.

import { identify, serviceRisk, SERVICES } from './catalog.js';
import { detect, redact, classesOf } from './detect.js';

export const ACTIONS = ['allow', 'coach', 'redact', 'require_approval', 'block'];
const RANK = Object.fromEntries(ACTIONS.map((a, i) => [a, i]));

/** Condition checkers: each returns [ok, actual] so the trace can show what was seen. */
const CHECKS = {
  sanctioned: (want, c) => [c.sanctioned === want, c.sanctioned],
  unknownService: (want, c) => [(!c.service) === want, !c.service],
  trainsOnInputs: (want, c) => [!!c.service?.trainsOnInputs === want, !!c.service?.trainsOnInputs],
  riskAtLeast: (n, c) => [c.risk >= n, c.risk],
  classesAny: (list, c) => [list.some(x => c.classes.includes(x)), c.classes.join(', ') || 'none'],
  channelIn: (list, c) => [list.includes(c.event.channel), c.event.channel],
  teamIn: (list, c) => [list.includes(c.event.user?.team), c.event.user?.team],
  teamNotIn: (list, c) => [!list.includes(c.event.user?.team), c.event.user?.team],
  categoryIn: (list, c) => [list.includes(c.service?.category), c.service?.category || 'unknown'],
  scopesAny: (list, c) => [list.some(s => (c.event.scopes || []).includes(s)), (c.event.scopes || []).join(', ') || 'none'],
  findingsAtLeast: (n, c) => [c.findings.length >= n, c.findings.length],
};

export function context(event, org) {
  const service = event.service || identify(event.host);
  const findings = event.text ? detect(event.text, org.dict) : [];
  return {
    event,
    service,
    sanctioned: !!service && org.sanctioned.includes(service.id),
    risk: serviceRisk(service),
    findings,
    classes: classesOf(findings),
  };
}

/** A sanctioned alternative in the same category: the "paved road" we steer people to. */
export function alternativeFor(service, org) {
  if (!service) return SERVICES.find(s => org.sanctioned.includes(s.id) && s.category === 'chat') || null;
  return SERVICES.find(s => org.sanctioned.includes(s.id) && s.category === service.category && s.id !== service.id) || null;
}

export function evaluate(event, policies, org) {
  const c = context(event, org);
  const trace = [];
  let action = 'allow', decidedBy = null;
  for (const p of policies) {
    if (!p.enabled) { trace.push({ rule: p.id, name: p.name, matched: false, skipped: true, checks: [] }); continue; }
    const checks = Object.entries(p.when).map(([k, v]) => {
      const [ok, actual] = CHECKS[k] ? CHECKS[k](v, c) : [false, 'unknown condition'];
      return { condition: k, expected: v, actual, ok };
    });
    const matched = checks.every(x => x.ok);
    trace.push({ rule: p.id, name: p.name, matched, action: p.action, checks });
    if (matched && RANK[p.action] > RANK[action]) { action = p.action; decidedBy = p; }
    else if (matched && !decidedBy) decidedBy = p;
  }
  const alternative = ['coach', 'block', 'redact'].includes(action) && !c.sanctioned ? alternativeFor(c.service, org) : null;
  return {
    eventId: event.id,
    action,
    rule: decidedBy?.id || 'default.allow',
    message: decidedBy?.message || 'No policy applies. Allowed.',
    service: c.service,
    sanctioned: c.sanctioned,
    risk: c.risk,
    findings: c.findings,
    classes: c.classes,
    redacted: action === 'redact' && event.text ? redact(event.text, c.findings) : null,
    alternative,
    trace,
  };
}

/** Human-readable explanation of a decision, for employees and auditors alike. */
export function explain(d) {
  const lines = [`Decision: ${d.action.replace('_', ' ')} (rule ${d.rule}).`];
  lines.push(`Service: ${d.service ? `${d.service.name}, ${d.sanctioned ? 'approved' : 'not approved'}, risk ${d.risk}` : `unrecognised AI endpoint, risk ${d.risk}`}.`);
  if (d.findings.length) lines.push(`Found: ${d.findings.map(f => f.label.toLowerCase()).join(', ')}.`);
  if (d.alternative) lines.push(`Approved alternative: ${d.alternative.name}.`);
  return lines.join(' ');
}

// The default policy set Kestrel Mutual starts from. Ordered for readability, not priority:
// the strictest matching action always wins.
export const DEFAULT_POLICIES = [
  { id: 'P-01', name: 'Secrets never leave', enabled: true, when: { classesAny: ['SECRET'] }, action: 'block',
    message: 'This contains a credential. Credentials never go to AI tools. Rotate it if it was already shared.' },
  { id: 'P-02', name: 'Health data only to approved tools', enabled: true, when: { classesAny: ['PHI'], sanctioned: false }, action: 'block',
    message: 'Health information can only go to approved, contracted AI tools.' },
  { id: 'P-03', name: 'Redact personal and financial data', enabled: true, when: { classesAny: ['PII', 'FIN'] }, action: 'redact',
    message: 'Personal and financial details were replaced with placeholders before sending.' },
  { id: 'P-04', name: 'No code to tools that train on it', enabled: true, when: { classesAny: ['IP'], trainsOnInputs: true }, action: 'block',
    message: 'This tool trains on what you send it. Use the approved coding assistant for source code.' },
  { id: 'P-05', name: 'Coach on unapproved tools', enabled: true, when: { sanctioned: false }, action: 'coach',
    message: 'This AI tool is not approved yet. You can keep going, or use the approved option.' },
  { id: 'P-06', name: 'Approve risky app connections', enabled: true, when: { channelIn: ['oauth'], scopesAny: ['mail.read', 'files.read.all', 'calendar.write'], sanctioned: false }, action: 'require_approval',
    message: 'This app wants access to company mail or files. Security will review it within a day.' },
  { id: 'P-07', name: 'Block unknown model endpoints', enabled: true, when: { unknownService: true, channelIn: ['api'] }, action: 'block',
    message: 'This model endpoint is not in the catalog. Register it before sending data.' },
  { id: 'P-08', name: 'Confidential files need approved tools', enabled: false, when: { classesAny: ['CONF'], sanctioned: false }, action: 'block',
    message: 'Confidential material stays in approved tools.' },
];
