// Corona: the AI layer that governs AI.
//
// Principle: AI proposes, rules dispose. Corona reads, classifies, drafts and explains.
// It never makes the enforcement decision. Everything it produces is compiled into
// deterministic policy, simulated against real traffic, and approved by a person.
//
// This prototype ships Corona's four skills as local, deterministic stand-ins so it runs
// offline and free. In production each one is a model call constrained to the same output
// schema, and the schema is what keeps the model honest.

import { ACTIONS } from './policy.js';
import { CLASSES } from './detect.js';

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

function messageFor(action, when) {
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

const INJECTION = [
  [/ignore (?:all |any )?(?:previous|prior|above) (?:instructions|rules)/i, 'Instruction override'],
  [/you are now|act as (?:the )?(?:system|admin|developer)/i, 'Role hijack'],
  [/(?:reveal|print|show) (?:your )?(?:system prompt|instructions|hidden)/i, 'Prompt extraction'],
  [/(?:send|post|upload|forward) (?:it|this|the (?:data|file|results?)) to (?:https?:\/\/|\S+@)/i, 'Exfiltration request'],
  [/!\[[^\]]*\]\(https?:\/\/[^)]*\?(?:q|d|data)=/i, 'Image-link data exfiltration'],
  [/[​-‏⁠﻿]/, 'Hidden characters'],
];

export function injectionSignals(text) {
  return INJECTION.filter(([re]) => re.test(String(text || ''))).map(([, label]) => label);
}

/* ------------------------------------------------------------------ */
/* 4. Narration: incidents explained to analysts and to employees      */
/* ------------------------------------------------------------------ */

const fmtDate = ts => new Date(ts).toISOString().slice(0, 10);

export function narrate(incident) {
  const who = `${incident.user.name} (${incident.user.team})`;
  const where = incident.service?.name || incident.host;
  const what = incident.classes.length ? incident.classes.map(c => CLASSES[c].toLowerCase()).join(', ') : 'no sensitive data';
  const span = incident.first === incident.last ? `on ${fmtDate(incident.first)}` : `between ${fmtDate(incident.first)} and ${fmtDate(incident.last)}`;
  const outcome = incident.leaked
    ? `${incident.leaked} of ${incident.count} interactions reached ${where} with ${what}.`
    : `All ${incident.count} interactions were contained by policy (${incident.actions.join(', ')}).`;
  const service = String(incident.user.id).startsWith('svc-');
  return {
    analyst: `${who} used ${where} ${incident.count} times ${span}, involving ${what}. ${outcome} ${incident.recommendation}`,
    employee: service
      ? `For the ${incident.user.team} team, owners of ${incident.user.name}: this service sends data to ${where}, which is not a registered model endpoint. Register it in the catalog or switch the call to an approved model API, and Umbra will stop intervening.`
      : incident.leaked
      ? `Hi ${incident.user.name.split(' ')[0]}, some of what you shared with ${where} included ${what}. No trouble, it happens. Next time, ${incident.service ? 'try the approved tool, which keeps data private' : 'use an approved tool'}. We have asked the vendor to delete it.`
      : `Hi ${incident.user.name.split(' ')[0]}, Umbra quietly protected ${incident.count} of your AI requests this week. Nothing for you to do.`,
  };
}

export const CORONA_SKILLS = [
  { id: 'author', name: 'Policy author', does: 'Turns a sentence into policy code, flags what it is unsure of, and round-trips it back to English for review.' },
  { id: 'discover', name: 'Shadow discovery', does: 'Recognises AI endpoints nobody registered, from traffic shape alone.' },
  { id: 'defend', name: 'Agent defence', does: 'Spots prompt injection and exfiltration attempts in agent-to-agent payloads.' },
  { id: 'narrate', name: 'Narrator', does: 'Explains every incident twice: precisely for the analyst, kindly for the employee.' },
];

export { ACTIONS };
