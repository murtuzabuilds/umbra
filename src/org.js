// Kestrel Mutual: a fictional 2,400-person insurer used as the demo tenant.
// Everything here is synthetic. Emails use example.com, card and bank numbers are
// published test values, and the access key is the documented example key.

export const ORG = {
  name: 'Kestrel Mutual',
  employees: 2400,
  sanctioned: ['aster', 'orion-code', 'vela-meet', 'relay', 'nova-api'],
  dict: {
    customers: ['Brightline Logistics', 'Harbor & Vine', 'Okafor Holdings', 'Pinecrest Schools'],
    codenames: ['Halcyon', 'Tidewater'],
  },
  teams: ['Claims', 'Underwriting', 'Engineering', 'Marketing', 'Legal', 'Finance', 'Customer Care', 'Data Science', 'HR', 'Executive'],
};

const FIRST = ['Ava', 'Ben', 'Chloe', 'Dev', 'Elena', 'Farah', 'Gabe', 'Hana', 'Iris', 'Jonah', 'Kai', 'Lena', 'Mateo', 'Nia', 'Omar', 'Priya', 'Quinn', 'Rosa', 'Sam', 'Tomas', 'Uma', 'Vik', 'Wren', 'Yara', 'Zane'];
const LAST = ['Adler', 'Brooks', 'Chen', 'Diaz', 'Evans', 'Fischer', 'Gupta', 'Hayes', 'Ito', 'Jensen', 'Kowalski', 'Lopez', 'Moreau', 'Nakamura', 'Okoye', 'Patel'];

/**
 * The people who own Kestrel's approved agents (the Outpost crew), on the teams the crew table names.
 * users() makes sure each one exists on that team by swapping or renaming generated names only:
 * ids and teams never change, so the sample telemetry and every number built on it stay the same.
 */
export const AGENT_OWNERS = [
  ['Rosa Chen', 'Claims'], ['Dev Okoye', 'Claims'], ['Mateo Diaz', 'Claims'], ['Priya Patel', 'Finance'],
  ['Omar Ito', 'Finance'], ['Hana Lopez', 'Customer Care'], ['Wren Hayes', 'Underwriting'], ['Lena Fischer', 'Data Science'],
];
const KEEP = new Set([...AGENT_OWNERS.map(([n]) => n), 'Gabe Lopez']); // Gabe Lopez is the person seen using Agent 7f3

export function users(n = 64) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const f = FIRST[(i * 7) % FIRST.length], l = LAST[(i * 11) % LAST.length];
    out.push({ id: `u${String(i + 1).padStart(3, '0')}`, name: `${f} ${l}`, team: ORG.teams[i % ORG.teams.length] });
  }
  for (const [name, team] of AGENT_OWNERS) {
    if (out.some(u => u.name === name && u.team === team)) continue;
    const slot = out.find(u => u.team === team && !KEEP.has(u.name));
    if (!slot) continue;
    const elsewhere = out.find(u => u.name === name);
    if (elsewhere) elsewhere.name = slot.name;
    slot.name = name;
  }
  return out;
}
