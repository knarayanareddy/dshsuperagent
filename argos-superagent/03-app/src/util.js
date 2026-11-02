import { createHash } from 'node:crypto';

/** Stable id derived from inputs; equal inputs produce equal ids. */
const KEY_CACHE = new Map();
export function key(...parts) {
  const input = parts.map(p => String(p)).join('|');
  if (!KEY_CACHE.has(input)) KEY_CACHE.set(input, createHash('sha256').update(input).digest('hex').slice(0, 18));
  return KEY_CACHE.get(input);
}

export function sha256(value) {
  const text = typeof value === 'string' ? value : canonical(value);
  return createHash('sha256').update(text).digest('hex');
}

/** Deterministic stringify with sorted keys, so policy hashes are stable. */
export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
}

export function clone(value) {
  if (value === null || typeof value !== 'object') return value;
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch (_) { /* fall through */ }
  }
  return JSON.parse(JSON.stringify(value));
}

const ISO_CACHE = new Map();

export function wordCount(text) {
  return String(text ?? '').trim().split(/\s+/).filter(Boolean).length;
}

export function truncate(text, chars = 220) {
  const s = String(text ?? '');
  return s.length <= chars ? { text: s, chars: s.length, truncated: false } : { text: s.slice(0, chars) + '…', chars: s.length, truncated: true };
}

export function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

export function round(n, digits = 4) { const f = 10 ** digits; return Math.round(n * f) / f; }

export function p(values, q) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const idx = (s.length - 1) * q;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

/** mulberry32 — deterministic, no Math.random anywhere in engine logic. */
export function seeded(seed) {
  let a = (typeof seed === 'number' ? seed : hashToInt(String(seed))) >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashToInt(s) {
  return parseInt(createHash('sha256').update(s).digest('hex').slice(0, 8), 16);
}

export function gaussian(rng, mean = 0, sd = 1) {
  const u = Math.max(rng(), 1e-12), v = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function isoFromTick(tick, base = Date.UTC(2026, 10, 2, 9, 0, 0)) {
  const cacheKey = `${base}:${tick}`;
  if (!ISO_CACHE.has(cacheKey)) ISO_CACHE.set(cacheKey, new Date(base + tick * 1000).toISOString());
  return ISO_CACHE.get(cacheKey);
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
