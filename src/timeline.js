// The month replayed, day by day, from the same events and decisions the rest of Umbra uses.
// Nothing here is interpolated or invented: a service exists on a day only if an event shows it,
// and a contained interaction is one a rule actually blocked, masked or held, or one that only went to an approved tool.

import { identify } from './catalog.js';

const DAY = 864e5;
export const CONTAINED = ['block', 'redact', 'require_approval'];

/** A sensitive interaction a rule stopped: blocked, masked (redacted) or held for a person. */
export const isStopped = d => !!(d?.findings?.length && CONTAINED.includes(d.action));
/**
 * The one definition of "contained" used everywhere on screen: a sensitive interaction that a rule
 * stopped, or that only ever went to an approved tool. Everything else reached an unapproved vendor.
 */
export const isContained = d => !!(d?.findings?.length && (CONTAINED.includes(d.action) || d.sanctioned));

/** Counts behind every "contained" number: contained = stopped + onApproved; sensitive = contained + exposed. */
export function containment(decisions) {
  const c = { sensitive: 0, contained: 0, stopped: 0, blocked: 0, masked: 0, held: 0, onApproved: 0, exposed: 0 };
  for (const d of decisions) {
    if (!d?.findings?.length) continue;
    c.sensitive++;
    if (isStopped(d)) { c.stopped++; c.contained++; c[{ block: 'blocked', redact: 'masked', require_approval: 'held' }[d.action]]++; }
    else if (d.sanctioned) { c.onApproved++; c.contained++; }
    else c.exposed++;
  }
  return c;
}

/** Key an event the same way the inventory does: catalog id, or the raw host if unknown. */
export const keyOf = e => identify(e.host)?.id || e.host;

export function timeline(events, decisions) {
  if (!events.length) return { days: [], services: {}, totals: [] };
  const start = Math.floor(events[0].ts / DAY) * DAY;
  const n = Math.floor(events[events.length - 1].ts / DAY) - start / DAY + 1;
  const days = Array.from({ length: n }, (_, i) => ({ i, ts: start + i * DAY, date: new Date(start + i * DAY).toISOString().slice(0, 10) }));
  const services = {};
  const perDay = days.map(() => ({ interactions: 0, contained: 0, stopped: 0, onApproved: 0, sensitive: 0 }));
  events.forEach((e, idx) => {
    const d = Math.floor((e.ts - start) / DAY), k = keyOf(e), dec = decisions[idx];
    if (!services[k]) services[k] = { key: k, first: d, daily: new Array(n).fill(0), stoppedDaily: new Array(n).fill(0) };
    const s = services[k];
    s.first = Math.min(s.first, d);
    s.daily[d]++;
    perDay[d].interactions++;
    if (dec?.findings?.length) {
      perDay[d].sensitive++;
      if (isStopped(dec)) { s.stoppedDaily[d]++; perDay[d].stopped++; perDay[d].contained++; }
      else if (isContained(dec)) { perDay[d].onApproved++; perDay[d].contained++; }
    }
  });
  for (const s of Object.values(services)) { let c = 0; s.cum = s.daily.map(v => (c += v)); }
  let ci = 0, cc = 0, cs = 0, ca = 0;
  const totals = days.map((day, i) => {
    ci += perDay[i].interactions; cc += perDay[i].contained; cs += perDay[i].stopped; ca += perDay[i].onApproved;
    const seen = Object.values(services).filter(s => s.first <= i).length;
    return { ...day, seen, interactions: ci, contained: cc, stopped: cs, onApproved: ca, stoppedToday: perDay[i].stopped };
  });
  return { days, services, totals };
}

/** Everything the canvas needs for one day: which services exist, their cumulative size, and today's pulses. */
export function dayState(tl, i) {
  const d = Math.max(0, Math.min(tl.days.length - 1, Math.round(i)));
  const rows = Object.values(tl.services).filter(s => s.first <= d).map(s => ({ key: s.key, cum: s.cum[d], stopped: s.stoppedDaily[d] }));
  return { day: d, ...tl.totals[d], rows };
}
