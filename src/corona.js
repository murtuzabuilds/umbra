// Corona: the AI layer that governs AI.
//
// Principle: AI proposes, rules dispose. Corona reads, classifies, drafts and explains.
// It never makes the enforcement decision. Everything it produces is compiled into
// deterministic policy, simulated against real traffic, and approved by a person.
//
// Rule drafting calls a real model through the Worker in worker/ (see drafter.js); compilePolicy
// below is the rules-based fallback it uses when the model is off or unreachable. The other skills
// here (endpoint recognition, incident summaries) are local, deterministic stand-ins so the demo
// runs offline and free. In production each would be a model call held to the same output shape.

import { ACTIONS } from './policy.js';
import { CLASSES, labelWords } from './detect.js';

/* ------------------------------------------------------------------ */
/* 1. Plain-language policy authoring                                  */
/* ------------------------------------------------------------------ */

const CLASS_WORDS = [
  [/secret|credential|password|api key|token|keys?\b/i, 'SECRET'],
  [/health|medical|patient|phi|diagnos/i, 'PHI'],
  [/personal|pii|customer (?:details|data|info)|email|phone|ssn|social security/i, 'PII'],
  [/financ|card|bank|iban|payment/i, 'FIN'],
  [/code|source|ip\b|intellectual|codename|unreleased/i, 'IP'],
  [/confidential|privileged|board|internal/i, 'CONF'],
];
const ACTION_WORDS = [
  [/\b(block|never|stop|prevent|forbid|don'?t allow|must not)\b/i, 'block'],
  [/\b(approv|review|sign[- ]off|ask security)\b/i, 'require_approval'],
  [/\b(redact|mask|strip|remove|scrub|hide)\b/i, 'redact'],
  [/\b(warn|coach|nudge|remind|educate)\b/i, 'coach'],
  [/\b(allow|permit|let)\b/i, 'allow'],
];

/** Compile an English sentence into a policy rule, with the parts Corona was unsure about. */
export function compilePolicy(sentence, { id = 'P-NEW' } = {}) {
  const s = String(sentence || '');
  const when = {};
  const classes = CLASS_WORDS.filter(([re]) => re.test(s)).map(([, c]) => c);
  if (classes.length) when.classesAny = [...new Set(classes)];
  if (/\b(unapproved|unsanctioned|shadow|not approved|personal (?:accounts?|tools?)|free (?:tools?|versions?))\b/i.test(s)) when.sanctioned = false;
  if (/\b(train(?:s|ing)? on|learns? from)\b/i.test(s)) when.trainsOnInputs = true;
  if (/\b(unknown|unregistered|new) (?:model|endpoint|api)s?\b/i.test(s)) { when.unknownService = true; when.channelIn = ['api']; }
  if (/\b(connect|oauth|access to (?:mail|files|calendar))\b/i.test(s)) when.channelIn = ['oauth'];
  const team = s.match(/\b(?:for|in|on) (?:the )?(claims|underwriting|engineering|marketing|legal|finance|customer care|data science|hr|executive)\b/i);
  if (team) when.teamIn = [team[1].replace(/\b\w/g, c => c.toUpperCase()).replace('Hr', 'HR')];
  const cat = s.match(/\b(coding|meeting|image|writing|search|agent) (?:tools?|assistants?|apps?|platforms?)\b/i);
  if (cat) when.categoryIn = [{ coding: 'code', meeting: 'meeting', image: 'image', writing: 'writing', search: 'search', agent: 'agent' }[cat[1].toLowerCase()]];
  const action = (ACTION_WORDS.find(([re]) => re.test(s)) || [null, 'coach'])[1];
  const doubts = [];
  if (!Object.keys(when).length) doubts.push('No condition found, so this would apply to every AI interaction.');
  if (!ACTION_WORDS.some(([re]) => re.test(s))) doubts.push('No action word found. Defaulted to coach, the gentlest option.');
  if (action === 'block' && !when.classesAny && when.sanctioned === undefined) doubts.push('A block with no data or tool condition is very broad. Simulate before enforcing.');
  const name = s.length > 60 ? s.slice(0, 57).trim() + '...' : s;
  const rule = { id, name, enabled: true, when, action, message: messageFor(action, when) };
  return { rule, confidence: Math.max(0.35, 1 - doubts.length * 0.25), doubts, readable: describe(rule) };
}

export function messageFor(action, when) {
  const what = when.classesAny ? when.classesAny.map(c => CLASSES[c].toLowerCase()).join(' and ') : 'this';
  return {
    block: `Sending ${what} here is not allowed by company policy.`,
    require_approval: `This needs a quick review from security before it goes through.`,
    redact: `${what[0].toUpperCase() + what.slice(1)} was replaced with placeholders before sending.`,
    coach: `Heads up: there is a safer, approved way to do this.`,
    allow: 'Allowed.',
  }[action];
}

/** Turn a rule back into a sentence. Round-tripping is how a reviewer checks Corona understood. */
export function describe(rule) {
  const w = rule.when, parts = [];
  if (w.classesAny) parts.push(`the content contains ${w.classesAny.map(c => CLASSES[c].toLowerCase()).join(' or ')}`);
  if (w.sanctioned === false) parts.push('the tool is not approved');
  if (w.trainsOnInputs) parts.push('the tool trains on inputs');
  if (w.unknownService) parts.push('the endpoint is not in the catalog');
  if (w.channelIn) parts.push(`the channel is ${w.channelIn.join(' or ')}`);
  if (w.teamIn) parts.push(`the person is in ${w.teamIn.join(' or ')}`);
  if (w.categoryIn) parts.push(`the tool is a ${w.categoryIn.join(' or ')} tool`);
  if (w.injectionAny) parts.push('the content carries hidden instructions');
  const verb = { block: 'Block', require_approval: 'Require approval', redact: 'Redact', coach: 'Coach the person', allow: 'Allow' }[rule.action];
  return parts.length ? `${verb} when ${parts.join(' and ')}.` : `${verb} every AI interaction.`;
}

/* ------------------------------------------------------------------ */
/* 2. Discovering AI nobody registered                                 */
/* ------------------------------------------------------------------ */

const AI_PATHS = /\/v\d+\/(chat\/completions|completions|messages|embeddings|responses|generate)|\/api\/(generate|chat)|\/inference|\/predict/i;
const AI_HOST = /\b(ai|llm|gpt|model|inference|neural|infer|gpu|ml)\b|\.ai$/i;

/** Score whether an unknown endpoint is an AI service, from traffic shape alone. */
export function classifyEndpoint({ host = '', path = '', contentType = '', streaming = false, payloadKeys = [] }) {
  const signals = [];
  if (AI_PATHS.test(path)) signals.push(['Model API path', 0.45]);
  if (AI_HOST.test(host.replace(/\./g, ' '))) signals.push(['AI-style hostname', 0.2]);
  if (streaming || /event-stream/.test(contentType)) signals.push(['Token streaming response', 0.15]);
  const keys = payloadKeys.map(k => k.toLowerCase());
  if (keys.includes('messages') || keys.includes('prompt')) signals.push(['Prompt-shaped payload', 0.3]);
  if (keys.includes('model')) signals.push(['Names a model', 0.15]);
  if (keys.includes('temperature') || keys.includes('max_tokens')) signals.push(['Sampling parameters', 0.15]);
  const p = Math.min(0.99, signals.reduce((a, [, w]) => a + w, 0));
  return { host, isAI: p >= 0.5, probability: +p.toFixed(2), signals: signals.map(([s]) => s) };
}

/* ------------------------------------------------------------------ */
/* 3. Agent payload defence: prompt injection and exfiltration         */
/* ------------------------------------------------------------------ */

// The detector itself lives in detect.js, so a policy rule can act on it (see P-09).
export { injectionSignals } from './detect.js';

/* ------------------------------------------------------------------ */
/* 4. Narration: incidents explained to analysts and to employees      */
/* ------------------------------------------------------------------ */

const fmtDate = ts => new Date(ts).toISOString().slice(0, 10);

const ACTION_PAST = { block: 'blocked', redact: 'masked', require_approval: 'held for a person', coach: 'coached', allow: 'allowed' };
const listWords = xs => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;

/** What happened to the interactions in a case, in words that match its status. */
function outcomeFor(incident, where, what) {
  const n = incident.count, all = n === 1 ? 'The one interaction' : n === 2 ? 'Both interactions' : `All ${n} interactions`;
  if (incident.leaked) return `${incident.leaked === n ? all : `${incident.leaked} of ${n} interactions`} reached ${where} with ${what}.`;
  const acts = incident.actions;
  if (incident.kind === 'oauth') return acts.includes('require_approval')
    ? `${n === 1 ? 'The request is' : `All ${n} requests are`} held until a person reviews them.`
    : `The requests did not ask for mail, file or calendar access, so they went through with a note to the person.`;
  if (incident.kind === 'api') {
    if (acts.includes('block')) return `${n === 1 ? 'The one call was' : `All ${n} calls were`} blocked, so no data reached it.`;
    if (acts.includes('redact')) return `Sensitive details were masked in ${n === 1 ? 'the one call' : `all ${n} calls`} before they reached ${where}${incident.sanctioned ? ', an approved model API' : ', but the service still sends work to a model API that is not approved'}.`;
    return `None of the ${n} calls carried sensitive data, but each one went to ${where}, a model API that is not approved, so the case stays open.`;
  }
  if (acts.every(a => ['block', 'redact', 'require_approval'].includes(a))) return `${all} ${n === 1 ? 'was' : 'were'} stopped by policy (${listWords(acts.map(a => ACTION_PAST[a]))}).`;
  if (!incident.classes.length) return `None carried sensitive data. Each time, the person using it was coached toward an approved tool.`;
  return `${all} ${n === 1 ? 'was' : 'were'} handled by policy (${listWords(acts.map(a => ACTION_PAST[a]))}).`;
}

export function narrate(incident) {
  const who = incident.people > 1 ? `${incident.people} people, including ${incident.user.name} (${incident.user.team}),` : `${incident.user.name} (${incident.user.team})`;
  const first = incident.user.name.split(' ')[0];
  const where = incident.service?.name || incident.host;
  const labels = (incident.labels || []).map(labelWords);
  const classWords = incident.classes.map(c => CLASSES[c].toLowerCase());
  const what = labels.length ? listWords(labels) : classWords.length ? listWords(classWords) : 'no sensitive data';
  const involving = labels.length ? `${what} (${listWords(classWords)})` : what;
  const span = incident.first === incident.last ? `on ${fmtDate(incident.first)}` : `between ${fmtDate(incident.first)} and ${fmtDate(incident.last)}`;
  const service = String(incident.user.id).startsWith('svc-');
  const owners = `For the ${incident.user.team} team, owners of ${incident.user.name}: this service sends data to ${where}`;
  return {
    analyst: `${incident.kind === 'oauth' ? `${where} asked ${who} for access to company data ${incident.count} time${incident.count === 1 ? '' : 's'} ${span}.` : `${who} used ${where} ${incident.count} time${incident.count === 1 ? '' : 's'} ${span}, involving ${involving}.`} ${outcomeFor(incident, where, what)} ${incident.recommendation}`,
    employee: service
      ? (!incident.service
        ? `${owners}, which is not in the catalog. Register it or switch the call to an approved model API, and Umbra will stop blocking it.`
        : incident.sanctioned
        ? `${owners}, an approved model API. Sensitive details are masked before each call. Nothing to do unless the service should not be sending that data at all.`
        : `${owners}, which is in the catalog but not approved. Switch the call to ${incident.alternative || 'an approved model API'}, or ask for ${where} to be reviewed.`)
      : incident.kind === 'oauth'
      ? `Hi ${first}, ${where} asked to connect to your company account. ${incident.actions.includes('require_approval') ? 'Security is reviewing the request, so there is nothing for you to do.' : `It is not approved yet, so a reviewer will look at it. ${incident.alternative ? `${incident.alternative} is the approved option.` : ''}`}`.trim()
      : incident.leaked
      ? `Hi ${first}, some of what you shared with ${where} included ${what}. No trouble, it happens. Next time, ${incident.alternative ? `try ${incident.alternative}, which keeps data private` : 'use an approved tool'}. We have asked the vendor to delete it.`
      : !incident.classes.length
      ? `Hi ${first}, ${where} is not approved yet, so when you use it Umbra points you to ${incident.alternative || 'an approved tool'}. Nothing went wrong. Your use helps make the case for an approved tool.`
      : `Hi ${first}, Umbra quietly protected ${incident.count} of your AI requests this week. Nothing for you to do.`,
  };
}

export const CORONA_SKILLS = [
  { id: 'author', name: 'Policy author', does: 'Turns a sentence into policy code, flags what it is unsure of, and round-trips it back to English for review.' },
  { id: 'discover', name: 'AI discovery', does: 'Recognises AI endpoints that are not in the catalog, from traffic shape alone.' },
  { id: 'defend', name: 'Agent defence', does: 'Spots prompt injection and exfiltration attempts in agent-to-agent payloads.' },
  { id: 'narrate', name: 'Narrator', does: 'Explains every incident twice: precisely for the analyst, kindly for the employee.' },
];

export { ACTIONS };
