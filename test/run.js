// Pruebas con datos simulados: node test/run.js
process.env.VELTRIX_DEMO = '1'; process.env.VELTRIX_PASSWORD = 'pw'; process.env.VELTRIX_SECRET = 's';
const assert = require('assert'), auth = require('../api/_auth'), panel = require('../api/_dropipanel'), dropi = require('../api/dropi');
const call = (h, req) => new Promise((ok) => {
  const res = { h: {}, setHeader(k, v) { this.h[k] = v; return this; }, status(c) { this.code = c; return this; }, json(b) { ok({ code: this.code, body: b }); }, end() { ok({ code: this.code }); } };
  h({ headers: {}, method: 'GET', query: {}, ...req }, res);
});
const ck = { cookie: 'vx_s=' + auth.make() };
(async () => {
  let r = await call(dropi, { query: { a: 'data' } }); assert.equal(r.code, 401, 'sin sesión → 401');
  r = await call(dropi, { headers: { cookie: 'vx_s=1.abc' }, query: { a: 'data' } }); assert.equal(r.code, 401, 'cookie falsa → 401');
  assert.ok(auth.checkPass('pw') && !auth.checkPass('x'));
  for (const c of [1, 2, 3]) {
    r = await call(dropi, { headers: ck, query: { a: 'data', c: String(c), d: 'all' } });
    assert.equal(r.code, 200); const k = r.body.kpis;
    assert.equal(k.entregados + k.devueltos + k.cancelados + k.novedad + k.proceso, k.total, 'grupos suman el total (cuenta ' + c + ')');
    assert.ok(k.efectividad >= 0 && k.efectividad <= 100); assert.ok(r.body.transportadoras.length > 0);
  }
  for (const a of ['prov', 'huella', 'gest', 'cuentas', 'retiros', 'registro']) { r = await call(dropi, { headers: ck, query: { a, c: '1' } }); assert.equal(r.code, 200, a); }
  r = await call(dropi, { headers: { ...ck, 'content-type': 'application/json' }, method: 'POST', query: { a: 'retiros', c: '1' }, body: { banco: 'X', monto: 100, comision: 5 } });
  assert.equal(r.body.retiros[0].neta, 95); // separado por cuenta
  r = await call(dropi, { headers: ck, query: { a: 'retiros', c: '2' } }); assert.equal(r.body.retiros.length, 0, 'retiros separados por cuenta');
  r = await call(dropi, { headers: { ...ck, 'content-type': 'application/json' }, method: 'POST', query: { a: 'retiros', c: '1' }, body: { monto: -1 } }); assert.equal(r.code, 400);
  r = await call(dropi, { headers: ck, query: { a: 'nada', c: '1' } }); assert.equal(r.code, 404);
  for (const a of ['oficina', 'alertas', 'pagos', 'favs']) { r = await call(dropi, { headers: ck, query: { a, c: '1' } }); assert.equal(r.code, 200, a); }
  r = await call(dropi, { headers: ck, query: { a: 'data', c: '1', d: 'all' } });
  assert.ok(r.body.estados.length && r.body.zonas[0].utilidad !== undefined && r.body.kpis.diasMax >= 0 && r.body.productos[0].unidades > 0, 'datos del resumen');
  const J = { ...ck, 'content-type': 'application/json' };
  r = await call(dropi, { headers: J, method: 'POST', query: { a: 'favs', c: '1' }, body: { op: 'add', item: { name: 'Prod X', prov: 'Prov Y', wa: '52 55 1234 5678' } } });
  assert.equal(r.body.dir['Prov Y'], '525512345678'); assert.equal(r.body.items[0].name, 'Prod X');
  r = await call(dropi, { headers: J, method: 'POST', query: { a: 'pagos', c: '1' }, body: { ids: [1, 2], pagado: true } }); assert.ok(r.body.pagados['1']);
  r = await call(dropi, { headers: J, method: 'POST', query: { a: 'pagos', c: '1' }, body: { ids: [1], pagado: false } }); assert.ok(!r.body.pagados['1'] && r.body.pagados['2']);
  r = await call(dropi, { headers: J, method: 'POST', query: { a: 'gest', c: '1' }, body: { id: 9, estado: 'seguimiento', fecha: '2026-12-01' } }); assert.equal(r.body.notas['9'].fecha, '2026-12-01');
  console.log('OK: todas las pruebas pasaron');
})().catch((e) => { console.error('FALLÓ:', e.message); process.exit(1); });
