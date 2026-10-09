// The month replayed, day by day, from the same events and decisions the rest of Umbra uses.
// Nothing here is interpolated or invented: a service exists on a day only if an event shows it,
// and a contained interaction is one a rule actually blocked, redacted or held.

import { identify } from './catalog.js';

const DAY = 864e5;
export const CONTAINED = ['block', 'redact', 'require_approval'];

/** Key an event the same way the inventory does: catalog id, or the raw host if unknown. */
export const keyOf = e => identify(e.host)?.id || e.host;

export function timeline(events, decisions) {
  if (!events.length) return { days: [], services: {}, totals: [] };
  const start = Math.floor(events[0].ts / DAY) * DAY;
  const n = Math.floor(events[events.length - 1].ts / DAY) - start / DAY + 1;
  const days = Array.from({ length: n }, (_, i) => ({ i, ts: start + i * DAY, date: new Date(start + i * DAY).toISOString().slice(0, 10) }));
  const services = {};
  const perDay = days.map(() => ({ interactions: 0, contained: 0, sensitive: 0 }));
  events.forEach((e, idx) => {
    const d = Math.floor((e.ts - start) / DAY), k = keyOf(e), dec = decisions[idx];
    if (!services[k]) services[k] = { key: k, first: d, daily: new Array(n).fill(0), containedDaily: new Array(n).fill(0) };
    const s = services[k];
    s.first = Math.min(s.first, d);
    s.daily[d]++;
    perDay[d].interactions++;
    if (dec?.findings?.length) {
      perDay[d].sensitive++;
      if (CONTAINED.includes(dec.action)) { s.containedDaily[d]++; perDay[d].contained++; }
    }
  });
  for (const s of Object.values(services)) { let c = 0; s.cum = s.daily.map(v => (c += v)); }
  let ci = 0, cc = 0;
  const totals = days.map((day, i) => {
    ci += perDay[i].interactions; cc += perDay[i].contained;
    const seen = Object.values(services).filter(s => s.first <= i).length;
    return { ...day, seen, interactions: ci, contained: cc, containedToday: perDay[i].contained };
  });
  return { days, services, totals };
}

/** Everything the canvas needs for one day: which services exist, their cumulative size, and today's pulses. */
export function dayState(tl, i) {
  const d = Math.max(0, Math.min(tl.days.length - 1, Math.round(i)));
  const rows = Object.values(tl.services).filter(s => s.first <= d).map(s => ({ key: s.key, cum: s.cum[d], contained: s.containedDaily[d] }));
  return { day: d, ...tl.totals[d], rows };
}
