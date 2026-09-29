// Deterministic detectors for sensitive data in prompts, files and agent payloads.
// Every finding carries the rule that produced it, so a decision can be explained
// to an auditor line by line. Validators (Luhn, mod-97, SSN ranges) cut false positives.

export const CLASSES = {
  PII: 'Personal data',
  FIN: 'Financial data',
  SECRET: 'Credential or secret',
  PHI: 'Health data',
  IP: 'Intellectual property',
  CONF: 'Confidential business data',
};

const luhn = digits => {
  let sum = 0, alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = +digits[i];
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
};

const ibanOk = raw => {
  const s = raw.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
  const moved = s.slice(4) + s.slice(0, 4);
  const num = moved.replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (const ch of num) rem = (rem * 10 + +ch) % 97;
  return rem === 1;
};

const ssnOk = m => {
  const [a, g, s] = m.split('-');
  return a !== '000' && a !== '666' && a[0] !== '9' && g !== '00' && s !== '0000';
};

// type, class, regex, optional validator, label
const PATTERNS = [
  ['email', 'PII', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, null, 'Email address'],
  ['phone', 'PII', /(?<!\d)(?:\+1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}(?!\d)/g, null, 'Phone number'],
  ['ssn', 'PII', /\b\d{3}-\d{2}-\d{4}\b/g, ssnOk, 'US Social Security number'],
  ['card', 'FIN', /\b(?:\d[ -]?){13,19}\b/g, m => luhn(m.replace(/\D/g, '')) && m.replace(/\D/g, '').length >= 13, 'Payment card number'],
  ['iban', 'FIN', /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,3})?\b/g, ibanOk, 'Bank account (IBAN)'],
  ['aws_key', 'SECRET', /\bAKIA[0-9A-Z]{16}\b/g, null, 'Cloud access key'],
  ['api_key', 'SECRET', /\b(?:sk|pk|rk)[-_](?:live|test|proj)?[-_]?[A-Za-z0-9]{20,}\b/g, null, 'API secret key'],
  ['gh_token', 'SECRET', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g, null, 'Code host token'],
  ['jwt', 'SECRET', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, null, 'Session token (JWT)'],
  ['private_key', 'SECRET', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, null, 'Private key'],
  ['mrn', 'PHI', /\bMRN[:# ]*\d{6,10}\b/gi, null, 'Medical record number'],
  ['icd10', 'PHI', /\b(?:diagnos(?:is|ed)|ICD-10)[^.\n]{0,40}\b[A-TV-Z]\d{2}(?:\.\d{1,4})?\b/gi, null, 'Diagnosis code'],
];

const CODE_HINTS = /(\bfunction\s+\w+\s*\(|\bdef\s+\w+\(|\bclass\s+\w+[:({]|\bimport\s+[\w{]|=>\s*{|\bSELECT\s+.+\s+FROM\b|#include\s*<)/i;
const CONF_MARKERS = /\b(confidential|internal only|do not distribute|attorney[- ]client|privileged|under nda|board (?:deck|materials))\b/i;

/**
 * Find sensitive data. `dict` lets an organization add its own terms:
 * customer names, project codenames, unreleased product names.
 */
export function detect(text, dict = {}) {
  const t = String(text || '');
  const out = [];
  for (const [type, cls, re, ok, label] of PATTERNS) {
    for (const m of t.matchAll(re)) {
      const v = m[0];
      if (ok && !ok(v)) continue;
      out.push({ type, class: cls, label, value: v, start: m.index, end: m.index + v.length, rule: `detect.${type}` });
    }
  }
  const words = [
    ...(dict.customers || []).map(w => [w, 'customer', 'CONF', 'Customer name']),
    ...(dict.codenames || []).map(w => [w, 'codename', 'IP', 'Unreleased project codename']),
  ];
  for (const [w, type, cls, label] of words) {
    const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    for (const m of t.matchAll(re)) out.push({ type, class: cls, label, value: m[0], start: m.index, end: m.index + m[0].length, rule: `dict.${type}` });
  }
  const conf = t.match(CONF_MARKERS);
  if (conf) out.push({ type: 'marker', class: 'CONF', label: 'Confidentiality marker', value: conf[0], start: conf.index, end: conf.index + conf[0].length, rule: 'detect.marker' });
  if (CODE_HINTS.test(t) && t.split('\n').length >= 3) {
    out.push({ type: 'source_code', class: 'IP', label: 'Source code', value: '(code block)', start: 0, end: 0, rule: 'detect.source_code' });
  }
  // A span can match several patterns (a card inside an IBAN, an email inside a URL). Keep the first, longest.
  out.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept = [];
  for (const f of out) {
    if (f.end > f.start && kept.some(k => k.end > k.start && f.start < k.end && f.end > k.start)) continue;
    kept.push(f);
  }
  return kept;
}

/** Replace findings with stable, numbered placeholders so the prompt keeps its meaning. */
export function redact(text, findings) {
  const t = String(text || '');
  const spans = findings.filter(f => f.end > f.start).sort((a, b) => a.start - b.start);
  const counters = {}, seen = new Map();
  let out = '', i = 0;
  for (const f of spans) {
    out += t.slice(i, f.start);
    const key = f.type + '|' + f.value.toLowerCase();
    if (!seen.has(key)) { counters[f.type] = (counters[f.type] || 0) + 1; seen.set(key, `[${f.type.toUpperCase()}_${counters[f.type]}]`); }
    out += seen.get(key);
    i = f.end;
  }
  return out + t.slice(i);
}

export const classesOf = findings => [...new Set(findings.map(f => f.class))];
