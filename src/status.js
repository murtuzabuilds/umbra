// One status vocabulary and one palette, used by every surface: the Overview canvas, the AI map,
// the 30-day trend chart, the drill and every legend. brand/umbra-system.js carries the same values
// (a test checks they match).

export const STATUS = {
  approved: { word: 'approved', color: '#3BE8B0', name: 'aurora' },
  unapproved: { word: 'unapproved', color: '#FFB347', name: 'flare' },
  high: { word: 'high risk', color: '#FF5470', name: 'ember' },
  unowned: { word: 'unowned', color: '#FF5470', name: 'ember', dashed: true },
};

/** Risk score at or above which an unapproved tool counts as high risk. */
export const HIGH_RISK = 70;

/** Status of an inventory row or a decision: approved, unapproved or high risk (unknown endpoints are high risk). */
export function toolStatus({ sanctioned, service, risk }) {
  if (sanctioned) return 'approved';
  return !service || risk >= HIGH_RISK ? 'high' : 'unapproved';
}

/** The legend line wherever the central map appears. */
export const MAP_TITLE = 'Umbra at the centre';
export const MAP_SUBTITLE = 'Every AI tool at Kestrel Mutual. Each ring around a tool is a control that applies to it.';
export const MAP_LEGEND = 'Centre: Umbra. Each dot: an AI tool Kestrel Mutual staff use. Green approved, amber unapproved, red high risk. Each ring around a tool is a control that applies to it.';
