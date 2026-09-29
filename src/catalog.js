// The AI service catalog Umbra classifies traffic against.
// Every vendor here is fictional. Attributes model what a real catalog tracks:
// whether the service trains on customer inputs, how long it keeps them,
// which attestations it holds and where it processes data.

export const CATEGORIES = {
  chat: 'General assistant',
  code: 'Coding assistant',
  meeting: 'Meeting and voice',
  image: 'Image and design',
  writing: 'Writing and docs',
  search: 'AI search',
  agent: 'Agent platform',
  api: 'Model API',
};

export const SERVICES = [
  { id: 'aster', name: 'Aster Enterprise', vendor: 'Aster Labs', category: 'chat', domains: ['app.aster.ai', 'api.aster.ai'], trainsOnInputs: false, retentionDays: 0, attestations: ['SOC 2', 'ISO 42001'], region: 'US/EU', tier: 'enterprise' },
  { id: 'aster-free', name: 'Aster Free', vendor: 'Aster Labs', category: 'chat', domains: ['free.aster.ai'], trainsOnInputs: true, retentionDays: 30, attestations: [], region: 'US', tier: 'consumer' },
  { id: 'chatly', name: 'Chatly', vendor: 'Chatly Inc.', category: 'chat', domains: ['chatly.io', 'api.chatly.io'], trainsOnInputs: true, retentionDays: 365, attestations: [], region: 'Unknown', tier: 'consumer' },
  { id: 'orion-code', name: 'Orion Code', vendor: 'Orion Systems', category: 'code', domains: ['orioncode.dev'], trainsOnInputs: false, retentionDays: 0, attestations: ['SOC 2'], region: 'US', tier: 'enterprise' },
  { id: 'hexpilot', name: 'HexPilot', vendor: 'Hex Tools', category: 'code', domains: ['hexpilot.app'], trainsOnInputs: true, retentionDays: 90, attestations: [], region: 'Unknown', tier: 'consumer' },
  { id: 'murmur', name: 'Murmur Notes', vendor: 'Murmur', category: 'meeting', domains: ['murmur.fm', 'bot.murmur.fm'], trainsOnInputs: true, retentionDays: 180, attestations: ['SOC 2'], region: 'US', tier: 'prosumer' },
  { id: 'vela-meet', name: 'Vela Meeting AI', vendor: 'Vela', category: 'meeting', domains: ['vela.ai'], trainsOnInputs: false, retentionDays: 30, attestations: ['SOC 2', 'ISO 27001'], region: 'EU', tier: 'enterprise' },
  { id: 'lumen-draw', name: 'Lumen Draw', vendor: 'Lumen Studio', category: 'image', domains: ['lumendraw.art'], trainsOnInputs: true, retentionDays: 365, attestations: [], region: 'Unknown', tier: 'consumer' },
  { id: 'quill', name: 'Quill Write', vendor: 'Quill', category: 'writing', domains: ['quillwrite.com'], trainsOnInputs: false, retentionDays: 30, attestations: ['SOC 2'], region: 'US', tier: 'prosumer' },
  { id: 'parse-pdf', name: 'ParsePDF AI', vendor: 'Parse Co.', category: 'writing', domains: ['parsepdf.ai'], trainsOnInputs: true, retentionDays: 365, attestations: [], region: 'Unknown', tier: 'consumer' },
  { id: 'sonar', name: 'Sonar Search', vendor: 'Sonar', category: 'search', domains: ['sonar.search'], trainsOnInputs: false, retentionDays: 7, attestations: ['SOC 2'], region: 'US', tier: 'prosumer' },
  { id: 'relay', name: 'Relay Agents', vendor: 'Relay', category: 'agent', domains: ['relay.run', 'mcp.relay.run'], trainsOnInputs: false, retentionDays: 30, attestations: ['SOC 2'], region: 'US', tier: 'enterprise' },
  { id: 'loopwork', name: 'Loopwork', vendor: 'Loopwork', category: 'agent', domains: ['loopwork.ai'], trainsOnInputs: true, retentionDays: 90, attestations: [], region: 'Unknown', tier: 'consumer' },
  { id: 'nova-api', name: 'Nova Model API', vendor: 'Nova Compute', category: 'api', domains: ['api.novacompute.ai'], trainsOnInputs: false, retentionDays: 0, attestations: ['SOC 2', 'ISO 42001'], region: 'US/EU', tier: 'enterprise' },
  { id: 'deepwell', name: 'Deepwell API', vendor: 'Deepwell', category: 'api', domains: ['api.deepwell.cn'], trainsOnInputs: true, retentionDays: 365, attestations: [], region: 'Outside allowed regions', tier: 'consumer' },
];

const byDomain = new Map(SERVICES.flatMap(s => s.domains.map(d => [d, s])));

/** Match a hostname (or subdomain of it) to a catalog service. */
export function identify(host) {
  const h = String(host || '').toLowerCase();
  if (byDomain.has(h)) return byDomain.get(h);
  for (const [d, s] of byDomain) if (h.endsWith('.' + d)) return s;
  return null;
}

/**
 * Inherent risk of a service, 0 to 100, from facts a buyer can verify.
 * No model in the loop: the same service always scores the same.
 */
export function serviceRisk(s) {
  if (!s) return 70; // unknown AI endpoint: treat as high until classified
  let r = 20;
  if (s.trainsOnInputs) r += 30;
  if (s.retentionDays > 90) r += 15; else if (s.retentionDays > 0) r += 5;
  if (!s.attestations.length) r += 20;
  if (/Unknown|Outside/.test(s.region)) r += 15;
  if (s.tier === 'consumer') r += 10;
  if (s.attestations.includes('ISO 42001')) r -= 10;
  return Math.max(0, Math.min(100, r));
}

export const riskBand = r => (r >= 70 ? 'critical' : r >= 50 ? 'high' : r >= 30 ? 'medium' : 'low');
