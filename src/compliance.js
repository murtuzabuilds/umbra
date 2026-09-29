// Continuous compliance: each Umbra control maps to the frameworks auditors ask about,
// and its status is computed from live product state, not from a questionnaire.
// Mappings are illustrative for a demo and should be validated with counsel and auditors.

export const FRAMEWORKS = {
  euai: 'EU AI Act',
  iso: 'ISO/IEC 42001',
  nist: 'NIST AI RMF',
  soc2: 'SOC 2',
};

export const CONTROLS = [
  { id: 'UC-01', name: 'AI system inventory', desc: 'Every AI service and agent in use is discovered, owned and risk-rated.',
    maps: { euai: 'Deployer duties (Art. 26); literacy (Art. 4)', iso: 'Clause 6.1, risk actions', nist: 'MAP', soc2: 'CC2.1' },
    metric: s => s.inventoryCoverage, target: 0.95 },
  { id: 'UC-02', name: 'Data leakage prevention', desc: 'Sensitive data is detected and blocked or redacted before it reaches AI tools.',
    maps: { euai: 'Data governance (Art. 10), for high-risk providers', iso: 'Clause 8, operation', nist: 'MANAGE', soc2: 'CC6.7' },
    metric: s => s.preventionRate, target: 0.98 },
  { id: 'UC-03', name: 'Decision logging', desc: 'Every AI interaction decision is logged with the rule and evidence behind it.',
    maps: { euai: 'Record-keeping (Art. 12)', iso: 'Clause 9.1, monitoring', nist: 'MEASURE', soc2: 'CC7.2' },
    metric: s => s.loggingCoverage, target: 1 },
  { id: 'UC-04', name: 'Agent mandates', desc: 'Every AI agent has an owner and a mandate, and calls outside it are flagged.',
    maps: { euai: 'Human oversight (Art. 14)', iso: 'Clause 8, operation', nist: 'GOVERN', soc2: 'CC6.1' },
    metric: s => s.agentCoverage, target: 1 },
  { id: 'UC-05', name: 'Transparency to people', desc: 'People are told when content or interactions are AI-generated.',
    maps: { euai: 'Transparency (Art. 50), in force Aug 2026', iso: 'Clause 7.4, communication', nist: 'GOVERN', soc2: 'CC2.3' },
    metric: s => s.transparency, target: 0.9 },
  { id: 'UC-06', name: 'AI literacy and coaching', desc: 'Staff get in-the-moment guidance when they use AI unsafely.',
    maps: { euai: 'AI literacy (Art. 4)', iso: 'Clause 7.2 and 7.3, competence and awareness', nist: 'GOVERN', soc2: 'CC1.4' },
    metric: s => s.coachingReach, target: 0.8 },
  { id: 'UC-07', name: 'Vendor risk for AI', desc: 'Approved AI vendors are assessed for training use, retention and attestations.',
    maps: { euai: 'Deployer duties (Art. 26)', iso: 'Clause 8, third parties', nist: 'MAP', soc2: 'CC9.2' },
    metric: s => s.vendorAssessed, target: 1 },
  { id: 'UC-08', name: 'Change control for policies', desc: 'Policy changes are simulated against real traffic before they are enforced.',
    maps: { euai: 'Risk management (Art. 9), for high-risk providers', iso: 'Clause 6.3, planning changes', nist: 'MANAGE', soc2: 'CC8.1' },
    metric: s => s.simulatedChanges, target: 1 },
];

export function status(value, target) {
  if (value >= target) return 'met';
  if (value >= target * 0.8) return 'partial';
  return 'gap';
}

export function readiness(state) {
  const rows = CONTROLS.map(c => {
    const v = Math.max(0, Math.min(1, c.metric(state)));
    return { ...c, value: v, status: status(v, c.target) };
  });
  const score = rows.reduce((a, r) => a + (r.status === 'met' ? 1 : r.status === 'partial' ? 0.5 : 0), 0) / rows.length;
  const byFramework = Object.fromEntries(Object.keys(FRAMEWORKS).map(k => [k, score]));
  return { rows, score, byFramework };
}

/** An evidence pack an auditor can read: controls, status, the numbers behind them, and sample decisions. */
export function evidencePack(state, readinessResult, samples = []) {
  const lines = [
    `# Umbra evidence pack: ${state.org}`,
    `Generated ${new Date(state.asOf).toISOString().slice(0, 10)} for the period of ${state.days} days.`,
    '',
    `Overall readiness: ${Math.round(readinessResult.score * 100)}%`,
    '',
    '| Control | Status | Measured | Target | EU AI Act | ISO/IEC 42001 | NIST AI RMF | SOC 2 |',
    '|---|---|---|---|---|---|---|---|',
    ...readinessResult.rows.map(r => `| ${r.id} ${r.name} | ${r.status} | ${Math.round(r.value * 100)}% | ${Math.round(r.target * 100)}% | ${r.maps.euai} | ${r.maps.iso} | ${r.maps.nist} | ${r.maps.soc2} |`),
    '',
    '## Sample decisions with rule traces',
    ...samples.map(s => `- ${s.eventId}: ${s.action} by ${s.rule}. ${s.findings.map(f => f.label).join(', ') || 'no sensitive data'}.`),
    '',
    'Mappings are illustrative and should be confirmed with your auditor and counsel.',
  ];
  return lines.join('\n');
}
