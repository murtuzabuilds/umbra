// Policy time machine: replay past traffic against a draft policy set before enforcing it.
// Security teams avoid new rules because they fear breaking the business. Showing the exact
// blast radius of a change, in people and teams, is what gets rules shipped.

import { evaluate } from './policy.js';

export function simulate(events, current, draft, org) {
  const changes = [];
  const byAction = {};
  for (const e of events) {
    const a = evaluate(e, current, org), b = evaluate(e, draft, org);
    byAction[b.action] = (byAction[b.action] || 0) + 1;
    if (a.action !== b.action) changes.push({ eventId: e.id, user: e.user, from: a.action, to: b.action, rule: b.rule, ts: e.ts });
  }
  const people = new Set(changes.map(c => c.user.id));
  const teams = {};
  for (const c of changes) teams[c.user.team] = (teams[c.user.team] || 0) + 1;
  const transitions = {};
  for (const c of changes) { const k = `${c.from} → ${c.to}`; transitions[k] = (transitions[k] || 0) + 1; }
  const stricter = changes.filter(c => rank(c.to) > rank(c.from)).length;
  return {
    events: events.length,
    changed: changes.length,
    stricter,
    looser: changes.length - stricter,
    people: people.size,
    teams: Object.entries(teams).sort((a, b) => b[1] - a[1]),
    transitions: Object.entries(transitions).sort((a, b) => b[1] - a[1]),
    byAction,
    sample: changes.slice(0, 8),
  };
}

const ORDER = ['allow', 'coach', 'redact', 'require_approval', 'block'];
const rank = a => ORDER.indexOf(a);
