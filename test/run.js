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
  assert.ok(r.body.estados.length && r.body.zonas[0].utilidad !== undefined && r.body.kpis.diasMax >= 0 && r.body.kpis.fletes > 0 && r.body.kpis.fletePromedio > 0 && r.body.transportadoras[0].fleteProm > 0 && r.body.zonas[0].fleteProm > 0 && r.body.productos[0].unidades > 0, 'datos del resumen');
  const J = { ...ck, 'content-type': 'application/json' };
  r = await call(dropi, { headers: J, method: 'POST', query: { a: 'favs', c: '1' }, body: { op: 'add', item: { name: 'Prod X', prov: 'Prov Y', wa: '52 55 1234 5678' } } });
  assert.equal(r.body.dir['Prov Y'], '525512345678'); assert.equal(r.body.items[0].name, 'Prod X');
  r = await call(dropi, { headers: J, method: 'POST', query: { a: 'pagos', c: '1' }, body: { ids: [1, 2], pagado: true } }); assert.ok(r.body.pagados['1']);
  r = await call(dropi, { headers: J, method: 'POST', query: { a: 'pagos', c: '1' }, body: { ids: [1], pagado: false } }); assert.ok(!r.body.pagados['1'] && r.body.pagados['2']);
  r = await call(dropi, { headers: J, method: 'POST', query: { a: 'gest', c: '1' }, body: { id: 9, estado: 'seguimiento', fecha: '2026-12-01' } }); assert.equal(r.body.notas['9'].fecha, '2026-12-01');
  r = await call(dropi, { headers: J, method: 'POST', query: { a: 'colores', c: '1' }, body: { estado: 'Mi Estado Ñ', cls: 'e-inv' } }); assert.equal(r.body.colores['MI ESTADO N'], 'e-inv');
  r = await call(dropi, { headers: J, method: 'POST', query: { a: 'colores', c: '1' }, body: { estado: 'Mi Estado Ñ', cls: 'auto' } }); assert.ok(!r.body.colores['MI ESTADO N']);
  const ped = (await call(dropi, { headers: ck, query: { a: 'data', c: '1', d: 'all' } })).body;
  assert.ok(ped.estados.some((e) => e.estado === 'EN RUTA'), 'mock con EN RUTA');
  const base = { name: 'Ana', surname: 'Pérez', phone: '+52 55 1234 5678', dir: 'Calle 1 #2, Col. Centro', state: 'Jalisco', city: 'Guadalajara', zip_code: '44100', rate_type: 'CON RECAUDO', products: [{ id: 100, name: 'X', price: 250, quantity: 2 }] };
  const POST = (b, c = '2') => call(dropi, { headers: J, method: 'POST', query: { a: 'crear', c }, body: b });
  for (const [mal, texto] of [[{ name: '' }, /nombre/], [{ phone: '123' }, /Teléfono/], [{ zip_code: '123' }, /postal/], [{ rate_type: 'X' }, /pago/], [{ products: [] }, /producto/i], [{ products: [{ id: 1, price: -1, quantity: 1 }] }, /Precio/], [{ products: [{ id: 1, price: 1, quantity: 0 }] }, /Cantidad/], [{ client_email: 'no' }, /Correo/]]) {
    r = await POST({ ...base, ...mal }); assert.equal(r.code, 400); assert.match(r.body.error, texto);
  }
  r = await POST(base); assert.equal(r.code, 200); assert.ok(r.body.ok && /^DEMO-/.test(r.body.orden.id) && r.body.orden.total === 500 && r.body.orden.demo);
  assert.ok(!JSON.stringify(r.body).includes('Ana') && !JSON.stringify(r.body).includes('Guadalajara'), 'sin datos del cliente en el historial');
  r = await POST(base); assert.equal(r.code, 409); assert.ok(r.body.duplicado);
  r = await POST({ ...base, forzar: true }); assert.equal(r.code, 200);
  r = await POST({ ...base, products: [{ id: 101, price: 10, quantity: 1 }] }); assert.equal(r.code, 200);
  r = await call(dropi, { headers: ck, query: { a: 'crear', c: '2' } }); assert.equal(r.body.ordenes.length, 3); assert.ok(!('hash' in r.body.ordenes[0]));
  r = await call(dropi, { headers: ck, query: { a: 'crear', c: '3' } }); assert.equal(r.body.ordenes.length, 0, 'historial separado por cuenta');
  r = await call(dropi, { headers: ck, query: { a: 'productos', c: '1', q: 'faja' } }); assert.equal(r.code, 200); assert.ok(r.body.productos[0].variations.length === 6 && r.body.productos[0].suggested > 0);
  r = await call(dropi, { headers: ck, query: { a: 'productos', c: '1', id: '103' } }); assert.equal(r.body.productos.length, 1); assert.equal(r.body.productos[0].id, 103);
  r = await call(dropi, { headers: ck, query: { a: 'productos', c: '1', id: '99999' } }); assert.equal(r.body.productos.length, 0);
  r = await call(dropi, { headers: ck, query: { a: 'productos', c: '1', id: 'abc' } }); assert.equal(r.code, 400);
  r = await call(dropi, { headers: J, method: 'POST', query: { a: 'favs', c: '1' }, body: { op: 'add', item: { name: 'Fav con ID', prov: 'P', id: '103' } } }); assert.equal(r.body.items[0].id, 103);
  r = await call(dropi, { headers: J, method: 'POST', query: { a: 'favs', c: '1' }, body: { op: 'add', item: { name: 'Fav malo', prov: 'P', id: 'xx' } } }); assert.equal(r.code, 400);
  r = await call(dropi, { headers: J, method: 'POST', query: { a: 'favs', c: '1' }, body: { op: 'prov', name: 'Fav con ID', prov: 'Otro' } }); assert.equal(r.body.items[0].id, 103, 'editar proveedor conserva el ID');
  r = await call(dropi, { headers: ck, query: { a: 'productos', c: '1', id: '100' } });
  const v0 = r.body.productos[0].variations; assert.equal(v0.length, 6); assert.equal(v0[0].label, 'Color: Dorado'); assert.equal(v0[0].color, 'Dorado'); assert.equal(v0[1].stock, 0); assert.ok(v0[0].suggested > 0);
  assert.ok(/^https:/.test(r.body.productos[0].img), 'imagen https');
  r = await call(dropi, { headers: ck, query: { a: 'transportadoras', c: '1' } }); assert.ok(r.body.transportadoras.length >= 2 && r.body.transportadoras.every((t) => t.id >= 1 && t.name && t.n >= 0));
  const { buildOrderPayload, parseQuote } = require('../api/_dropipanel');
  const pl = buildOrderPayload({ rate_type: 'CON RECAUDO', total: 520.4, state: 'Jalisco', city: 'Guadalajara', name: 'A', surname: 'B', dir: 'C', phone: '5512345678', zip_code: '44100', client_email: '', colonia: 'X', notes: '', shop_order_id: '', distribution_company_id: 6,
    products: [{ id: 1, price: 260.2, quantity: 2 }, { id: 2, price: 10, quantity: 1, variation_id: 77 }] });
  assert.equal(pl.payment_method_id, 1); assert.equal(pl.type, 'FINAL_ORDER'); assert.equal(pl.total_order, 520); assert.ok(/^VX-\d+$/.test(pl.shop_order_id));
  assert.deepEqual(pl.distributionCompany, { id: 6 }); assert.ok(!('distribution_company_id' in pl) && !('client_email' in pl) && !('notes' in pl)); assert.equal(pl.products[0].variation_id, null); assert.equal(pl.products[1].variation_id, 77); assert.equal(pl.calculate_costs_and_shiping, true);
  assert.deepEqual(parseQuote({ objects: [{ distribution_company: { id: 6, name: 'Veloces' }, shipping_cost: 99 }, { name: 'Tiui', id: 11, price: '120.5' }, { name: 'X', error: 'sin cobertura' }] }).map((c) => [c.id, c.name, c.cost, !!c.error]), [[6, 'Veloces', 99, false], [11, 'Tiui', 120.5, false], [null, 'X', null, true]]);
  r = await call(dropi, { headers: ck, query: { a: 'geo', c: '1', t: 'deps' } }); assert.equal(r.body.departamentos.length, 32);
  r = await call(dropi, { headers: ck, query: { a: 'geo', c: '1', t: 'ciudades', dep: '15' } }); assert.ok(r.body.ciudades.some((c) => c.name === 'Guadalajara') && r.body.ciudades[0].id > 0);
  r = await call(dropi, { headers: ck, query: { a: 'geo', c: '1', t: 'ciudades', dep: 'x' } }); assert.equal(r.code, 400);
  const Q = (b) => call(dropi, { headers: J, method: 'POST', query: { a: 'cotizar', c: '1' }, body: b });
  const prodsQ = [{ id: 100, price: 200, quantity: 1 }];
  r = await Q({ city: { id: 1501 }, zip_code: '44100', cod: true, products: prodsQ }); assert.equal(r.code, 200); assert.equal(r.body.carriers.length, 6); assert.ok(r.body.carriers.every((c) => c.cost > 0 || c.error));
  const cs = r.body.carriers[0].cost; r = await Q({ city: { id: 1501 }, zip_code: '44100', cod: false, products: prodsQ }); assert.ok(r.body.carriers[0].cost < cs, 'sin recaudo es más barato');
  r = await Q({ city: { id: 0 }, zip_code: '44100', products: prodsQ }); assert.equal(r.code, 400); r = await Q({ city: { id: 5 }, zip_code: '4', products: prodsQ }); assert.equal(r.code, 400); r = await Q({ city: { id: 5 }, zip_code: '44100', products: [] }); assert.equal(r.code, 400);
  r = await call(dropi, { headers: ck, query: { a: 'huella', c: '1', tel: '5555555555' } }); assert.equal(r.code, 200);
  r = await call(dropi, { headers: ck, query: { a: 'favoritos', c: '1' } }); assert.equal(r.code, 200); const fv = r.body.favoritos;
  assert.ok(fv.length >= 3 && fv.every((p) => p.d7.length === 7 && p.d30.length === 30 && /^https:/.test(p.img) && p.categoria && p.prov && p.stock >= 0), 'tarjetas de favoritos completas');
  assert.equal(fv[0].type, 'VARIABLE'); assert.ok(fv.some((p) => p.d30.some((d) => d.n > 0)), 'ventas propias por producto');
  // forma real de la respuesta del cotizador de Dropi (documentación oficial) y la del conector
  const real = parseQuote({ isSuccess: true, objects: [{ distributionCompany: { id: 1, name: 'SERVIENTREGA' }, transportadora: 'SERVIENTREGA', transportadora_id: 1, objects: { precioEnvio: 12050, trayecto: '' } }, { distributionCompany: { id: 2, name: 'ENVIA' }, transportadora: 'ENVIA', transportadora_id: 2, objects: { precioEnvio: 12800, trayecto: 'NACIONAL' } }] });
  assert.deepEqual(real.map((c) => [c.id, c.name, c.cost, c.trayecto]), [[1, 'SERVIENTREGA', 12050, ''], [2, 'ENVIA', 12800, 'NACIONAL']]);
  const mcp = parseQuote({ carriers: [{ carrier: 'VELOCES', shipping_cost: 16450, trajectory: '', error: null }, { carrier: 'TCC', shipping_cost: null, error: 'La transportadora no está disponible para este envío.' }] });
  assert.deepEqual(mcp.map((c) => [c.id, c.name, c.cost, !!c.error]), [[null, 'VELOCES', 16450, false], [null, 'TCC', null, true]]);
  r = await call(dropi, { headers: ck, query: { a: 'transportadoras', c: '1' } }); assert.ok(r.body.transportadoras.length >= 5 && r.body.transportadoras.every((t) => t.id > 0 && t.name), 'lista de transportadoras con ID aunque no haya pedidos');
  console.log('OK: todas las pruebas pasaron');
})().catch((e) => { console.error('FALLÓ:', e.message); process.exit(1); });
