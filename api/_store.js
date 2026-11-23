// Datos guardados en Upstash Redis (hashes vx:<coleccion>). Sin Upstash usa memoria (solo pruebas).
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOK = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const mem = new Map();

async function cmd(a) {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: 'Bearer ' + TOK }, body: JSON.stringify(a) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
async function get(col, field, def) {
  const key = 'vx:' + col;
  if (!URL_) return mem.has(key + '|' + field) ? mem.get(key + '|' + field) : def;
  const v = await cmd(['HGET', key, field]);
  return v == null ? def : JSON.parse(v);
}
async function set(col, field, val) {
  const key = 'vx:' + col;
  if (!URL_) { mem.set(key + '|' + field, val); return; }
  await cmd(['HSET', key, field, JSON.stringify(val)]);
}
module.exports = { get, set, persistent: !!URL_ };
