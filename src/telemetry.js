// Synthetic, seeded telemetry: 30 days of AI activity at Kestrel Mutual.
// Real deployments read the same shapes from four places Umbra connects to without
// installing anything on laptops first: web proxy / DNS logs, identity-provider app
// grants (OAuth), a browser extension for prompt content, and an MCP gateway for agents.

import { ORG, users } from './org.js';
import { SERVICES } from './catalog.js';

export function rng(seed = 42) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const S = id => SERVICES.find(s => s.id === id);

// Prompt templates by team. {tokens} are filled with synthetic sensitive values.
const PROMPTS = {
  Claims: [
    'Summarise this claim for the adjuster: policyholder {email}, phone {phone}, water damage on 12 March.',
    'Draft a denial letter. Claimant SSN {ssn}, policy KM-44120, reason: pre-existing damage.',
    'Rewrite this note to sound kinder to the customer.',
    'Patient notes attached, MRN {mrn}, diagnosis code S82.201 after the fall. Estimate the payout.',
  ],
  Underwriting: [
    'Score this commercial risk for {customer}. Revenue 48M, fleet of 212 trucks.',
    'Compare these two loss runs and flag anything unusual.',
    'Explain the difference between occurrence and claims-made coverage.',
  ],
  Engineering: [
    'Why does this fail?\nimport { pay } from "./ledger";\nfunction settle(id) {\n  return pay(id, AKIAIOSFODNN7EXAMPLE);\n}',
    'Refactor this:\ndef rate(policy):\n    base = policy.premium\n    return base * 1.07\n',
    'Write a regex that validates a policy number like KM-44120.',
    'Our deploy key is {apikey}, why is the pipeline returning 401?',
  ],
  Marketing: [
    'Write three subject lines for the {codename} launch email. Internal only until May.',
    'Make this product page friendlier for young drivers.',
    'Generate a hero image of a family in front of a house at sunset.',
  ],
  Legal: [
    'Privileged and confidential: summarise our exposure in the {customer} dispute.',
    'Explain the notice period in this clause in plain English.',
  ],
  Finance: [
    'Reconcile these refunds: card {card}, amount 1,240.00, and IBAN {iban} for the vendor.',
    'Build a variance summary for Q3 from the table below.',
    'Board deck draft: Q3 combined ratio fell to 94.1, do not distribute.',
  ],
  'Customer Care': [
    'Reply to this complaint from {email} about a late payout, keep it under 120 words.',
    'Translate this message to Spanish for the customer.',
  ],
  'Data Science': [
    'SELECT policy_id, premium\nFROM policies\nWHERE state = "WI"\nhelp me add a churn feature',
    'Explain SHAP values like I am a claims manager.',
  ],
  HR: [
    'Summarise this performance review for {email} and suggest a raise band.',
    'Write a job post for a senior underwriter.',
  ],
  Executive: [
    'Turn these notes into a board memo on {codename}. Confidential.',
    'What questions will the board ask about our AI strategy?',
  ],
};

// Everyday requests with nothing sensitive in them. Most AI use looks like this.
const EVERYDAY = [
  'Rewrite this paragraph so it is clearer and shorter.',
  'Give me five ideas for our team offsite agenda.',
  'Explain what this spreadsheet formula does: =XLOOKUP(A2,B:B,C:C)',
  'Summarise this public article about climate risk in property insurance.',
  'Draft an out-of-office message for next week.',
  'Turn these bullet points into a friendly team update.',
  'What is a good way to structure a one-hour workshop?',
  'Make this email sound more confident.',
  'Explain reinsurance to a new hire in three sentences.',
  'Suggest a clearer title for this slide.',
];

// Which tools each team reaches for, with weights. Unapproved tools are common: that is the point.
const TOOLS = {
  Claims: [['aster', 5], ['chatly', 4], ['aster-free', 3], ['parse-pdf', 2]],
  Underwriting: [['aster', 6], ['chatly', 2], ['sonar', 2]],
  Engineering: [['orion-code', 6], ['hexpilot', 4], ['chatly', 2]],
  Marketing: [['quill', 5], ['aster', 3], ['chatly', 2]],
  Legal: [['aster', 5], ['parse-pdf', 3], ['aster-free', 1]],
  Finance: [['aster', 4], ['chatly', 3], ['aster-free', 2]],
  'Customer Care': [['aster', 4], ['quill', 3], ['chatly', 3]],
  'Data Science': [['orion-code', 3], ['hexpilot', 2], ['nova-api', 2], ['aster', 2]],
  HR: [['aster', 3], ['chatly', 3], ['quill', 2]],
  Executive: [['aster', 3], ['aster-free', 3], ['murmur', 2]],
};

const FILL = {
  email: r => `${['j.reyes', 'm.okafor', 'lena.b', 'tpatel', 'sam.w'][Math.floor(r() * 5)]}@example.com`,
  phone: r => `(608) 555-01${String(Math.floor(r() * 90) + 10)}`,
  ssn: () => '123-45-6789',
  mrn: r => `MRN ${4000000 + Math.floor(r() * 99999)}`,
  card: () => '4111 1111 1111 1111',
  iban: () => 'GB82 WEST 1234 5698 7654 32',
  apikey: () => 'sk-live-9fQ2mZr81kTq0PzX4bVwe7Lc',
  customer: r => ORG.dict.customers[Math.floor(r() * ORG.dict.customers.length)],
  codename: r => ORG.dict.codenames[Math.floor(r() * ORG.dict.codenames.length)],
};

const pick = (r, weighted) => {
  const total = weighted.reduce((a, [, w]) => a + w, 0);
  let x = r() * total;
  for (const [v, w] of weighted) if ((x -= w) < 0) return v;
  return weighted[0][0];
};

const OAUTH = [
  { host: 'murmur.fm', scopes: ['calendar.read', 'meetings.join', 'mail.read'] },
  { host: 'loopwork.ai', scopes: ['files.read.all', 'mail.read', 'calendar.write'] },
  { host: 'quillwrite.com', scopes: ['files.read'] },
  { host: 'relay.run', scopes: ['files.read', 'tickets.write'] },
];

/** Generate `days` of events ending at `end`. Deterministic for a given seed. */
export function generate({ days = 30, end = Date.UTC(2026, 8, 28), seed = 7, perDay = 46 } = {}) {
  const r = rng(seed), people = users(), events = [];
  let n = 0;
  for (let d = days - 1; d >= 0; d--) {
    const dayStart = end - d * 864e5;
    const count = perDay + Math.floor(r() * 14) - 7 + Math.floor((days - d) / 6); // usage grows over the month
    for (let i = 0; i < count; i++) {
      const u = people[Math.floor(r() * people.length)];
      const ts = dayStart + Math.floor((8 + r() * 10) * 36e5);
      const roll = r();
      if (roll < 0.72) {
        const pool = r() < 0.62 ? EVERYDAY : PROMPTS[u.team];
        const tpl = pool[Math.floor(r() * pool.length)];
        const svc = /image/.test(tpl) ? S(r() < 0.8 ? 'lumen-draw' : 'aster') : S(pick(r, TOOLS[u.team]));
        const text = tpl.replace(/\{(\w+)\}/g, (_, k) => FILL[k](r));
        events.push({ id: `e${++n}`, ts, source: 'browser', channel: 'prompt', user: u, host: svc.domains[0], text });
      } else if (roll < 0.9) {
        const svc = S(pick(r, TOOLS[u.team]));
        events.push({ id: `e${++n}`, ts, source: 'proxy', channel: 'web', user: u, host: svc.domains[0], bytesUp: Math.floor(2e3 + r() * 4e5) });
      } else if (roll < 0.95) {
        const g = OAUTH[Math.floor(r() * OAUTH.length)];
        events.push({ id: `e${++n}`, ts, source: 'idp', channel: 'oauth', user: u, host: g.host, scopes: g.scopes });
      } else {
        const host = r() < 0.5 ? 'api.deepwell.cn' : r() < 0.5 ? 'inference.gpu-rent.xyz' : 'api.novacompute.ai';
        const text = r() < 0.5 ? 'batch score: policyholder j.reyes@example.com, premium 1840' : 'classify claim notes for fraud signals';
        events.push({ id: `e${++n}`, ts, source: 'egress', channel: 'api', user: { id: 'svc-pricing', name: 'pricing-service', team: 'Data Science' }, host, text });
      }
    }
  }
  return events.sort((a, b) => a.ts - b.ts);
}
