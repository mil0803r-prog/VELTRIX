// Prueba del camino REAL (sin modo demo) contra un Dropi falso que imita la documentación oficial.
const http = require('http'), assert = require('assert');
const seen = { keys: new Set(), quotes: [], bycity: [], orders: [] }; let noDetail = false;
const srv = http.createServer((req, res) => {
  let raw = ''; req.on('data', (c) => (raw += c)); req.on('end', () => {
    seen.keys.add(req.headers['dropi-integration-key'] || 'SIN-CABECERA');
    const send = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    const u = req.url.split('?')[0];
    if (u === '/integrations/distribution_companies') return send(200, { isSuccess: true, objects: [{ id: 6, name: 'VELOCES' }, { id: 11, name: 'TIUI' }, { id: 5, name: 'COORDI' }, { id: 1, name: 'SERVIENTREGA' }] });
    if (u.startsWith('/integrations/products/v2/')) return noDetail ? send(404, { message: 'no existe' }) : send(200, { isSuccess: true, objects: { id: 100, warehouse_product: [{ warehouse: { city: { cod_dane: '14001000' } } }] } });
    if (u === '/integrations/orders/cotizaEnvioTransportadoraV2') {
      const b = JSON.parse(raw || '{}'); seen.quotes.push(b);
      if (!b.ciudad_remitente) return send(422, { isSuccess: false, message: 'ciudad_remitente es requerida' });
      return send(200, { isSuccess: true, status: 200, objects: [
        { distributionCompany: { id: 6, name: 'VELOCES' }, transportadora: 'VELOCES', transportadora_id: 6, objects: { precioEnvio: 99, trayecto: '', overload_was_applied: false } },
        { distributionCompany: { id: 11, name: 'TIUI' }, transportadora: 'TIUI', transportadora_id: 11, objects: { precioEnvio: 120, trayecto: 'NACIONAL' } }] });
    }
    if (u === '/integrations/department') return send(200, { isSuccess: true, objects: [{ id: 15, country_id: 2, name: 'JALISCO', department_code: '14' }, { id: 3, country_id: 2, name: 'CIUDAD DE MEXICO', department_code: '09' }, { id: 7, country_id: 2, name: 'AGUASCALIENTES', department_code: '01' }] });
    if (u === '/integrations/trajectory/bycity') {
      const b = JSON.parse(raw || '{}'); seen.bycity.push(b);
      if (b.department_id === 99) return send(500, { message: 'error interno' });
      const C = (id, name, extra) => ({ id, name, cod_dane: '1' + id, ...extra });
      if (b.department_id === 21) return send(200, { isSuccess: true, objects: { cities: [C(5, 'LEON'), C(6, 'IRAPUATO')] } }); // objects es un objeto con la lista adentro
      if (b.department_id === 22) return send(200, { isSuccess: true, objects: { 7: C(7, 'TOLUCA'), 8: C(8, 'METEPEC') } }); // mapa por id
      if (b.department_id === 23) return send(200, { isSuccess: true, objects: [{ id: 100, city: C(31, 'PUEBLA'), distribution_company: { id: 6 } }, { id: 101, city: C(31, 'PUEBLA'), distribution_company: { id: 11 } }, { id: 102, city_id: 32, city: 'CHOLULA', department_id: 23 }] }); // por transportadora, repetidas
      if (b.department_id === 24) return send(200, { isSuccess: true, objects: 'ok', status: 200 }); // forma desconocida
      return send(200, { isSuccess: true, objects: [{ id: 1, department_id: 15, name: 'ZAPOPAN', cod_dane: '14120' }, { id: 2, department_id: 15, name: 'GUADALAJARA', cod_dane: '14039' }, { id: 9, department_id: 3, name: 'COYOACAN', cod_dane: '09003' }] });
    }
    if (u === '/integrations/orders/myorders' && req.method === 'POST') { seen.orders.push(JSON.parse(raw || '{}')); return send(200, { isSuccess: true, objects: { id: 555 } }); }
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
    let r = await call({ a: 'transportadoras', c: '1' }); assert.deepEqual(r.body.transportadoras.map((t) => t.name), ['Veloces', 'Tiui', 'Ampm', 'Afimex', 'Coordi', 'Quality-post'], 'siempre las 6 de México, en orden'); assert.deepEqual(r.body.transportadoras.map((t) => t.id), [6, 11, null, null, 5, null], 'con ID las que Dropi informa; la de Colombia se ignora');
    r = await call({ a: 'cotizar', c: '1' }, Q); assert.equal(r.code, 200);
    assert.deepEqual(r.body.carriers.map((c) => [c.id, c.name, c.cost, c.trayecto]), [[6, 'Veloces', 99, ''], [11, 'Tiui', 120, 'NACIONAL']]);
    assert.equal(r.body.sender, '14001000', 'ciudad de origen detectada del detalle del producto');
    assert.deepEqual(seen.quotes[0].ciudad_remitente, { cod_dane: '14001000' }); assert.equal(seen.quotes[0].EnvioConCobro, true); assert.equal(seen.quotes[0].amount, 200);
    assert.ok(!seen.keys.has('SIN-CABECERA') && seen.keys.has('tok'), 'usa la cabecera dropi-integration-key');
    // origen manual indicado por el usuario
    r = await call({ a: 'cotizar', c: '1' }, { ...Q, sender_dane: '5001000' }); assert.equal(seen.quotes.at(-1).ciudad_remitente.cod_dane, '5001000');
    // sin detalle del producto y sin origen → Dropi rechaza: se muestran igual las transportadoras y el motivo
    noDetail = true; delete require.cache[require.resolve('../api/_dropipanel')];
    r = await call({ a: 'cotizar', c: '1' }, { ...Q, products: [{ id: 777, price: 200, quantity: 1 }] });
    assert.equal(r.code, 200); assert.equal(r.body.needsSender, true); assert.match(r.body.quoteError, /ciudad_remitente es requerida/);
    assert.deepEqual(r.body.carriers.map((c) => c.name), ['Veloces', 'Tiui', 'Ampm', 'Afimex', 'Coordi', 'Quality-post']); assert.ok(r.body.carriers.every((c) => c.cost === null));
    // estado -> municipios conectados
    r = await call({ a: 'geo', c: '1', t: 'deps' }); assert.deepEqual(r.body.departamentos.map((d) => d.name), ['AGUASCALIENTES', 'CIUDAD DE MEXICO', 'JALISCO'], 'estados ordenados con su ID de Dropi');
    r = await call({ a: 'geo', c: '1', t: 'ciudades', dep: '15', rate: 'CON RECAUDO' });
    assert.deepEqual(r.body.ciudades.map((c) => c.name), ['GUADALAJARA', 'ZAPOPAN'], 'solo municipios de Jalisco (excluye el de otro estado), ordenados');
    assert.deepEqual(seen.bycity[0], { rate_type: 'CON RECAUDO', department_id: 15 });
    r = await call({ a: 'geo', c: '1', t: 'ciudades', dep: '15', rate: 'SIN RECAUDO' }); assert.equal(seen.bycity[1].rate_type, 'SIN RECAUDO');
    r = await call({ a: 'geo', c: '1', t: 'ciudades', dep: '99' }); assert.equal(r.code, 502); assert.match(r.body.error, /500/, 'el error de Dropi llega al panel');
    // elegir transportadora por nombre: se resuelve su ID; si no se conoce o no es de México, se rechaza con un mensaje claro
    const base = { name: 'Ana', surname: 'Pérez', phone: '5512345678', dir: 'Calle 1 #2', state: 'JALISCO', city: 'GUADALAJARA', zip_code: '44100', rate_type: 'CON RECAUDO', products: [{ id: 100, price: 200, quantity: 1 }] };
    const C = (extra) => call({ a: 'crear', c: '1' }, { ...base, ...extra, phone: String(Math.random()).slice(2, 12) });
    r = await C({ carrier_name: 'Tiui' }); assert.equal(r.code, 200, JSON.stringify(r.body)); assert.deepEqual(seen.orders.at(-1).distributionCompany, { id: 11 }, 'ID resuelto por nombre');
    assert.equal(seen.orders.at(-1).payment_method_id, 1); assert.equal(seen.orders.at(-1).type, 'FINAL_ORDER');
    r = await C({ carrier_name: 'Ampm' }); assert.equal(r.code, 400); assert.match(r.body.error, /ID de la transportadora Ampm/);
    r = await C({ carrier_name: 'SERVIENTREGA' }); assert.equal(r.code, 400, 'una transportadora que no es de México se rechaza');
    r = await C({ distribution_company_id: 6 }); assert.equal(r.code, 200); assert.deepEqual(seen.orders.at(-1).distributionCompany, { id: 6 });
    r = await C({}); assert.equal(r.code, 200); assert.ok(!('distributionCompany' in seen.orders.at(-1)), 'sin transportadora = Dropi elige');
    // formas distintas de la respuesta de municipios (error real visto: 'raw.map is not a function')
    const names = async (dep) => (await call({ a: 'geo', c: '1', t: 'ciudades', dep: String(dep) })).body;
    assert.deepEqual((await names(21)).ciudades.map((c) => c.name), ['IRAPUATO', 'LEON'], 'objects = {cities:[..]}');
    assert.deepEqual((await names(22)).ciudades.map((c) => c.name), ['METEPEC', 'TOLUCA'], 'objects = mapa por id');
    assert.deepEqual((await names(23)).ciudades.map((c) => [c.id, c.name]), [[32, 'CHOLULA'], [31, 'PUEBLA']], 'ciudad anidada, sin repetir por transportadora');
    r = await call({ a: 'geo', c: '1', t: 'ciudades', dep: '24' }); assert.equal(r.code, 502); assert.match(r.body.error, /claves de la respuesta: isSuccess, objects, status/, 'si no reconoce la forma, dice qué campos llegaron');
    console.log('OK real: lista oficial, cotización con ciudad de origen y respaldo cuando Dropi la rechaza');
  } catch (e) { console.error('FALLÓ real:', e.message); process.exitCode = 1; } finally { srv.close(); }
});
