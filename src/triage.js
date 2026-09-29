// SOC triage: thousands of raw decisions become a short queue of incidents a person can act on.
// Events are grouped by who, where and what. Anything already contained by policy is closed
// automatically with its evidence attached, so analysts only see residual risk.

const CLASS_WEIGHT = { SECRET: 45, PHI: 40, FIN: 28, PII: 22, IP: 26, CONF: 18 };
const DAY = 864e5;

export function severityBand(score) {
  return score >= 75 ? 'critical' : score >= 55 ? 'high' : score >= 35 ? 'medium' : 'low';
}

/** Residual exposure: did sensitive data actually reach an unapproved destination? */
function exposed(d) {
  if (['block', 'redact', 'require_approval'].includes(d.action)) return false;
  return d.findings.length > 0 && !d.sanctioned;
}

function recommend(key, ds) {
  const d = ds[0];
  if (d.classes.includes('SECRET')) return 'Rotate the credential and check the repo it came from. The send was blocked, but the secret is in circulation.';
  if (d.event.channel === 'oauth') return `Review the ${d.service?.name || d.event.host} connection request and its scopes, then approve or deny.`;
  if (d.event.channel === 'api') return 'Register or remove this model endpoint in the pricing service. Unknown endpoints get no data.';
  if (ds.some(exposed)) return `Sensitive data reached ${d.service?.name || d.event.host}. Ask the vendor for deletion and coach the user toward ${d.alternative?.name || 'an approved tool'}.`;
  if (d.action === 'coach') return `Repeated use of an unapproved tool. Evaluate ${d.service?.name} for approval, or promote ${d.alternative?.name || 'the approved option'} to this team.`;
  return 'Contained by policy. No action needed.';
}

function titleFor(kind, ds, leaked) {
  const d = ds[0], where = d.service?.name || d.event.host;
  const top = [...ds.flatMap(x => x.findings)].sort((a, b) => (CLASS_WEIGHT[b.class] || 0) - (CLASS_WEIGHT[a.class] || 0))[0];
  if (kind === 'secret') return `Credential sent toward ${where}`;
  if (kind === 'exposure') return `${top ? top.label : 'Sensitive data'} reached ${where}`;
  if (kind === 'oauth') return `${where} requests access to company data`;
  if (kind === 'api') return `Service calling ${d.service ? where : 'unregistered model endpoint ' + where}`;
  if (d.action === 'coach') return `Growing use of unapproved ${where}`;
  return `${top ? top.label : 'AI use'} ${d.action === 'block' ? 'blocked at' : d.action === 'redact' ? 'redacted for' : 'contained at'} ${where}`;
}

export function triage(decisions, events, { windowDays = 7 } = {}) {
  const evById = new Map(events.map(e => [e.id, e]));
  const rows = decisions.map(d => ({ ...d, event: evById.get(d.eventId) }))
    .filter(d => d.action !== 'allow' || d.findings.length);
  const groups = new Map();
  for (const d of rows) {
    const bucket = Math.floor(d.event.ts / (windowDays * DAY));
    const cls = [...d.classes].sort((a, b) => (CLASS_WEIGHT[b] || 0) - (CLASS_WEIGHT[a] || 0))[0] || 'NONE';
    const svc = d.service?.id || d.event.host;
    // Group by the decision a human would make: one per leaked person, one per secret,
    // one per app approval, one per unknown endpoint, and one per tool for everything contained.
    let key;
    if (d.classes.includes('SECRET')) key = ['secret', d.event.user.id, svc, bucket];
    else if (exposed(d)) key = ['exposure', d.event.user.id, svc, cls, bucket];
    else if (d.event.channel === 'oauth') key = ['oauth', svc];
    else if (d.event.channel === 'api') key = ['api', svc, d.action];
    else key = ['contained', svc, d.action, cls, bucket];
    key = key.join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(d);
  }
  const incidents = [...groups.entries()].map(([key, ds], i) => {
    const top = Math.max(0, ...ds.flatMap(d => d.classes.map(c => CLASS_WEIGHT[c] || 0)));
    const risk = ds[0].risk;
    const leaked = ds.filter(exposed).length;
    const kind = key.split('|')[0];
    const needsHuman = kind === 'secret' || kind === 'exposure' || kind === 'oauth' || kind === 'api' || (ds[0].action === 'coach' && new Set(ds.map(x => x.event.user.id)).size >= 8);
    // Residual risk: a blocked secret still needs rotating, but leaked data is worse than a stopped send.
    const score = Math.min(100, Math.round(top + risk * 0.35 + Math.log2(ds.length + 1) * 6 + (leaked ? 18 : 0) - (kind === 'secret' ? 14 : 0)));
    const d = ds[0];
    return {
      id: `INC-${String(i + 1).padStart(4, '0')}`,
      key,
      kind,
      title: titleFor(kind, ds, leaked),
      people: new Set(ds.map(x => x.event.user.id)).size,
      user: d.event.user,
      service: d.service,
      host: d.event.host,
      channel: d.event.channel,
      classes: [...new Set(ds.flatMap(x => x.classes))],
      count: ds.length,
      leaked,
      actions: [...new Set(ds.map(x => x.action))],
      first: Math.min(...ds.map(x => x.event.ts)),
      last: Math.max(...ds.map(x => x.event.ts)),
      score,
      severity: severityBand(score),
      status: needsHuman ? 'open' : 'contained',
      recommendation: recommend(key, ds),
      decisions: ds.map(x => x.eventId),
    };
  });
  incidents.sort((a, b) => (a.status === b.status ? b.score - a.score : a.status === 'open' ? -1 : 1));
  return {
    incidents,
    alerts: rows.length,
    open: incidents.filter(i => i.status === 'open').length,
    contained: incidents.filter(i => i.status === 'contained').length,
    reduction: rows.length ? 1 - incidents.filter(i => i.status === 'open').length / rows.length : 0,
  };
}
