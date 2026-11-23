// Sesion por cookie firmada (HMAC). Sin VELTRIX_PASSWORD nadie entra.
const crypto = require('crypto');
const secret = () => process.env.VELTRIX_SECRET || process.env.VELTRIX_PASSWORD || '';
const sign = (v) => crypto.createHmac('sha256', secret()).update(v).digest('hex');
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();

function make() { const ts = String(Date.now()); return ts + '.' + sign(ts); }

function valid(req) {
  const m = /(?:^|;\s*)vx_s=([^;]+)/.exec(req.headers.cookie || '');
  if (!m || !secret()) return false;
  const [ts, sig] = m[1].split('.');
  if (!ts || !sig || Date.now() - Number(ts) > 7 * 864e5) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(ts));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function checkPass(p) {
  const w = process.env.VELTRIX_PASSWORD || '';
  return !!w && crypto.timingSafeEqual(sha(p), sha(w));
}

const tries = new Map(); // freno basico por IP (por instancia)
function throttled(req) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  const now = Date.now(); const t = (tries.get(ip) || []).filter((x) => now - x < 600000);
  tries.set(ip, t);
  return { blocked: t.length >= 8, hit: () => t.push(now) };
}

const cookie = (v, age) =>
  `vx_s=${v}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;

module.exports = { make, valid, checkPass, throttled, cookie };
