// Prueba del camino REAL (sin modo demo) contra un Dropi falso que imita la documentación oficial.
const http = require('http'), assert = require('assert');
const seen = { keys: new Set(), quotes: [] }; let noDetail = false;
const srv = http.createServer((req, res) => {
  let raw = ''; req.on('data', (c) => (raw += c)); req.on('end', () => {
    seen.keys.add(req.headers['dropi-integration-key'] || 'SIN-CABECERA');
    const send = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    const u = req.url.split('?')[0];
    if (u === '/integrations/distribution_companies') return send(200, { isSuccess: true, objects: [{ id: 6, name: 'VELOCES' }, { id: 11, name: 'TIUI' }, { id: 5, name: 'COORDINADORA' }] });
    if (u.startsWith('/integrations/products/v2/')) return noDetail ? send(404, { message: 'no existe' }) : send(200, { isSuccess: true, objects: { id: 100, warehouse_product: [{ warehouse: { city: { cod_dane: '14001000' } } }] } });
    if (u === '/integrations/orders/cotizaEnvioTransportadoraV2') {
      const b = JSON.parse(raw || '{}'); seen.quotes.push(b);
      if (!b.ciudad_remitente) return send(422, { isSuccess: false, message: 'ciudad_remitente es requerida' });
      return send(200, { isSuccess: true, status: 200, objects: [
        { distributionCompany: { id: 6, name: 'VELOCES' }, transportadora: 'VELOCES', transportadora_id: 6, objects: { precioEnvio: 99, trayecto: '', overload_was_applied: false } },
        { distributionCompany: { id: 11, name: 'TIUI' }, transportadora: 'TIUI', transportadora_id: 11, objects: { precioEnvio: 120, trayecto: 'NACIONAL' } }] });
    }
    if (u === '/integrations/orders/myorders' && req.method === 'GET') return send(200, { isSuccess: true, objects: [] });
    send(404, { message: 'ruta no simulada: ' + u });
  });
});
srv.listen(0, async () => {
  process.env.DROPI_TOKEN = 'tok'; process.env.DROPI_API_BASE_1 = 'http://127.0.0.1:' + srv.address().port; process.env.VELTRIX_PASSWORD = 'pw'; process.env.VELTRIX_SECRET = 's'; delete process.env.VELTRIX_DEMO;
  const auth = require('../api/_auth'), dropi = require('../api/dropi');
  const ck = { cookie: 'vx_s=' + auth.make(), 'content-type': 'application/json' };
  const call = (query, body) => new Promise((ok) => dropi({ headers: ck, method: body ? 'POST' : 'GET', query, body }, { setHeader() {}, status(c) { this.c = c; return this; }, json(b) { ok({ code: this.c, body: b }); } }));
  const Q = { city: { id: 1501, cod_dane: '14039000', zip_code: '44100' }, zip_code: '44100', cod: true, products: [{ id: 100, price: 200, quantity: 1 }] };
  try {
    let r = await call({ a: 'transportadoras', c: '1' }); assert.deepEqual(r.body.transportadoras.map((t) => t.id).sort((a, b) => a - b), [5, 6, 11], 'lista oficial de transportadoras');
    r = await call({ a: 'cotizar', c: '1' }, Q); assert.equal(r.code, 200);
    assert.deepEqual(r.body.carriers.map((c) => [c.id, c.name, c.cost, c.trayecto]), [[6, 'VELOCES', 99, ''], [11, 'TIUI', 120, 'NACIONAL']]);
    assert.equal(r.body.sender, '14001000', 'ciudad de origen detectada del detalle del producto');
    assert.deepEqual(seen.quotes[0].ciudad_remitente, { cod_dane: '14001000' }); assert.equal(seen.quotes[0].EnvioConCobro, true); assert.equal(seen.quotes[0].amount, 200);
    assert.ok(!seen.keys.has('SIN-CABECERA') && seen.keys.has('tok'), 'usa la cabecera dropi-integration-key');
    // origen manual indicado por el usuario
    r = await call({ a: 'cotizar', c: '1' }, { ...Q, sender_dane: '5001000' }); assert.equal(seen.quotes.at(-1).ciudad_remitente.cod_dane, '5001000');
    // sin detalle del producto y sin origen → Dropi rechaza: se muestran igual las transportadoras y el motivo
    noDetail = true; delete require.cache[require.resolve('../api/_dropipanel')];
    r = await call({ a: 'cotizar', c: '1' }, { ...Q, products: [{ id: 777, price: 200, quantity: 1 }] });
    assert.equal(r.code, 200); assert.equal(r.body.needsSender, true); assert.match(r.body.quoteError, /ciudad_remitente es requerida/);
    assert.deepEqual(r.body.carriers.map((c) => c.name).sort(), ['COORDINADORA', 'TIUI', 'VELOCES']); assert.ok(r.body.carriers.every((c) => c.cost === null && c.id > 0));
    console.log('OK real: lista oficial, cotización con ciudad de origen y respaldo cuando Dropi la rechaza');
  } catch (e) { console.error('FALLÓ real:', e.message); process.exitCode = 1; } finally { srv.close(); }
});
