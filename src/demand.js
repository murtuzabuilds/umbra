// The Demand Map: shadow AI read as a signal, not only a threat.
//
// Every unapproved tool somebody reaches for marks a job the company has not equipped
// them for. Umbra clusters that activity by team and task, and turns it into a ranked
// AI transformation backlog: where to deploy an approved tool next, and why.

const INTENTS = [
  ['summarise', /summar|tl;?dr|recap|condense|board memo|turn these notes/i, 6],
  ['draft', /draft|write|rewrite|reply|letter|subject lines|job post|make this|bullet points|out-of-office/i, 9],
  ['code', /refactor|why does this fail|regex|function|def |pipeline|SELECT/i, 14],
  ['analyse', /compare|reconcile|variance|score|estimate|flag|questions will/i, 18],
  ['explain', /explain|what is/i, 6],
  ['ideate', /ideas|agenda|workshop|title for/i, 8],
  ['translate', /translate/i, 5],
  ['image', /image|hero|picture/i, 20],
];

/** Classify a prompt into a job-to-be-done. Minutes saved per use are planning assumptions. */
export function intentOf(text) {
  for (const [id, re, mins] of INTENTS) if (re.test(text || '')) return { id, minutes: mins };
  return { id: 'other', minutes: 5 };
}

export function demandMap(events, decisions, { scale = 1 } = {}) {
  const dById = new Map(decisions.map(d => [d.eventId, d]));
  const prompts = events.filter(e => e.channel === 'prompt');
  const half = (prompts[0]?.ts + prompts[prompts.length - 1]?.ts) / 2;
  const cells = new Map();
  for (const e of prompts) {
    const d = dById.get(e.id);
    const it = intentOf(e.text);
    const key = `${e.user.team}|${it.id}`;
    if (!cells.has(key)) cells.set(key, { team: e.user.team, intent: it.id, minutes: it.minutes, uses: 0, shadow: 0, users: new Set(), early: 0, late: 0, tools: new Map() });
    const c = cells.get(key);
    c.uses++; c.users.add(e.user.id);
    if (!d?.sanctioned) { c.shadow++; const n = d?.service?.name || e.host; c.tools.set(n, (c.tools.get(n) || 0) + 1); }
    if (e.ts < half) c.early++; else c.late++;
  }
  const rows = [...cells.values()].map(c => {
    const shadowShare = c.shadow / c.uses;
    const growth = c.early ? (c.late - c.early) / c.early : 1;
    const hoursPerMonth = (c.uses * c.minutes * scale) / 60; // projected from the sample to the whole company
    // Opportunity: real demand, poorly served, and growing.
    const opportunity = Math.round(Math.min(100, Math.sqrt(c.uses) * 6 * (0.4 + shadowShare) * (1 + Math.max(0, Math.min(growth, 1)) * 0.5)));
    const topShadow = [...c.tools.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    return {
      team: c.team, intent: c.intent, uses: c.uses, people: c.users.size,
      shadowShare: +shadowShare.toFixed(2), growth: +growth.toFixed(2), hoursPerMonth: Math.round(hoursPerMonth),
      topShadowTool: topShadow, opportunity,
      play: shadowShare > 0.4
        ? `Give ${c.team} an approved ${c.intent} workflow. ${Math.round(shadowShare * 100)}% of this work runs on ${topShadow || 'unapproved tools'} today.`
        : `${c.team} is mostly on approved tools for ${c.intent}. Scale what works.`,
    };
  });
  return rows.sort((a, b) => b.opportunity - a.opportunity);
}
