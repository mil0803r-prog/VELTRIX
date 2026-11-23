// Servidor del panel Dropi multi-cuenta. Cada peticion lleva ?c=N; AsyncLocalStorage
// hace que S() devuelva la cuenta activa (cache y ajustes quedan separados por cuenta).
const { AsyncLocalStorage } = require('async_hooks');
const store = require('./_store');
const mock = require('./_mock');

const als = new AsyncLocalStorage();
const DEMO = () => process.env.VELTRIX_DEMO === '1';

// Datos por pais. Para otro pais: cambiar/agregar fila aqui + CTAS + variable en Vercel.
const MX = { pais: 'México', mon: 'MXN', sym: '$', dec: 2, wa: '52', base: 'https://api.dropi.mx' };
const META = { 1: { ...MX }, 2: { ...MX, pais: 'México 2' }, 3: { ...MX, pais: 'México 3' } };
// Conversion de pesos (MXN) a soles (PEN): valor editable desde el tablero; este es el inicial.
const DEF_PEN = () => Number(process.env.VELTRIX_MXN_PEN) || 0.2;
const tokenVar = (n) => (n === 1 ? 'DROPI_TOKEN' : 'DROPI_TOKEN_' + n);
const mk = (n) => ({
  n, tokenVar: tokenVar(n), meta: META[n],
  base: process.env['DROPI_API_BASE_' + n] || META[n].base,
  suf: n === 1 ? '' : String(n),
  cache: { ts: 0, data: null },
});
const CTAS = { 1: mk(1), 2: mk(2), 3: mk(3) };
const S = () => als.getStore();

const TTL = 120000, MAX_ORDERS = 4000, PAGE = 100;
const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

// ---------- Dropi ----------
async function dropi(path, opts = {}) {
  const s = S(), token = process.env[s.tokenVar];
  if (!token) throw Object.assign(new Error('Cuenta sin token (' + s.tokenVar + ')'), { code: 503 });
  const url = s.base + path;
  const call = (headers) => fetch(url, {
    method: opts.method || 'GET',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...headers },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let r = await call({ Authorization: 'Bearer ' + token });
  if (r.status === 401 || r.status === 403) r = await call({ 'dropi-integration-key': token });
  if (!r.ok) throw Object.assign(new Error('Dropi respondió ' + r.status), { code: 502 });
  return r.json();
}
const rows = (j) => (Array.isArray(j) ? j : j.objects || j.data || j.orders || []);

async function allOrders(fresh) {
  const s = S();
  if (!fresh && s.cache.data && Date.now() - s.cache.ts < TTL) return s.cache.data;
  let list = [];
  if (DEMO() && !process.env[s.tokenVar]) list = mock.orders(s.n);
  else {
    for (let start = 0; start < MAX_ORDERS; start += PAGE) {
      const page = rows(await dropi(`/integrations/orders/myorders?result_number=${PAGE}&start=${start}`));
      list = list.concat(page);
      if (page.length < PAGE) break;
    }
  }
  s.cache = { ts: Date.now(), data: list };
  return list;
}

// ---------- Clasificacion ----------
function groupOf(o) {
  const st = norm(o.status);
  if (/CANCEL|ANULAD|GUIA NO EXISTE/.test(st)) return 'cancelado';
  if (/DEVOL|DEVUELT|RECHAZ|REMITENTE|NO ENTREGADO|REZAGO|INDEMNIZ|SINIESTRO|INCAUTAD|RETENCION|\bDEV\b/.test(st)) return 'devolucion';
  if (/SOLUCIONAD|ENTREGADO A TRANSPORTADORA|ENTREGADA A CONEXIONES/.test(st)) return 'proceso';
  if (/NOVEDAD|INCIDENC|INTENTO|ORDEN PUBLICO|CIERRE DE VIAS|NO SE CUBRE|MAL ZONIFICADO|CLIMATOLOG|NO HAY QUIEN|FISICO NO|NO LLEGO|INVESTIGACION|STAND BY|ERROR/.test(st)) return 'novedad';
  if (/ENTREGAD[OA]|ENTREGA EXITOSA|ENTREGA VERIFICADA|^ENTREGA( DIGITALIZADA)?$|DESPACHO EFECTIVO|PRUEBA DE ENTREGA|CUMPLIDO/.test(st)) return 'entregado';
  return 'proceso';
}
const costOf = (o) => (o.orderdetails || []).reduce((a, d) =>
  a + num(d.quantity || 1) * num(d.supplier_price ?? d.product?.supplier_price ?? d.product?.sale_price), 0);
const supplierOf = (o) => { const d = (o.orderdetails || [])[0] || {}; return d.product?.user?.name || o.supplier_name || 'Sin proveedor'; };
const prodOf = (o) => (o.orderdetails || []).map((d) => d.product?.name || 'Producto').join(' + ') || 'Producto';
const telOf = (o) => String(o.phone || '').replace(/\D/g, '');
const day = (d) => String(d || '').slice(0, 10);
const lastMov = (o) => {
  let best = null;
  for (const k of Object.keys(o)) if (/_movements$/.test(k) && Array.isArray(o[k]))
    for (const m of o[k]) if (!best || String(m.created_at) > String(best.created_at)) best = m;
  return best ? String(best.description || best.status || '').slice(0, 120) : '';
};

const movs = (o) => Object.keys(o).filter((k) => /_movements$/.test(k) && Array.isArray(o[k]))
  .flatMap((k) => o[k]).map((m) => ({ fecha: String(m.created_at || '').slice(0, 16).replace('T', ' '), texto: String(m.description || m.status || '').slice(0, 160) }))
  .sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 30);

function inPeriod(list, d) {
  if (!d || d === 'all') return list;
  const from = Date.now() - Number(d) * 864e5;
  return list.filter((o) => new Date(o.created_at).getTime() >= from);
}

const ageDays = (d) => { const t = new Date(d).getTime(); return Number.isFinite(t) ? Math.max(0, Math.floor((Date.now() - t) / 864e5)) : 0; };
const SIN_DESPACHAR = /PENDIENTE|GENERAD|GENERANDO|INVENTARIO|BODEGA DROPI|RECIBIDO|PREPAR|ALISTAD|SIN DESPACH/;

function slim(o) {
  const g = groupOf(o), total = num(o.total_order), ship = num(o.shipping_amount), cost = costOf(o);
  return {
    id: o.id, fecha: day(o.created_at), estado: o.status, grupo: g,
    cliente: [o.name, o.surname].filter(Boolean).join(' '), tel: telOf(o),
    ciudad: o.city || '', depto: o.state || '', transp: o.distribution_company?.name || 'Sin transportadora',
    guia: o.shipping_guide || '', total, flete: ship, costo: cost,
    utilidad: g === 'cancelado' ? 0 : total - cost - ship, prod: prodOf(o), mov: lastMov(o),
    prov: supplierOf(o), dir: String(o.dir || o.address || o.direction || '').slice(0, 160),
    dias: g === 'proceso' || g === 'novedad' ? ageDays(o.created_at) : null,
    ofi: (g === 'proceso' || g === 'novedad') && norm(o.status).includes('OFICINA'), diasOfi: ageDays(o.updated_at || o.created_at),
    sinDespachar: g === 'proceso' && SIN_DESPACHAR.test(norm(o.status)),
  };
}

// ---------- Calculos ----------
function build(list) {
  const k = { total: list.length, ventas: 0, ventasEntregadas: 0, entregados: 0, devueltos: 0, cancelados: 0, novedad: 0, proceso: 0, utilidad: 0, perdidaDev: 0, valorDevuelto: 0, porCobrar: 0, utilEnCurso: 0, fletes: 0, fleteEntregados: 0, nFlete: 0 };
  const tr = {}, zn = {}, dias = {}, pr = {};
  let diasSum = 0, diasN = 0, diasMax = 0; const est = {};
  for (const o of list) {
    const p = slim(o), g = p.grupo;
    if (g !== 'cancelado') { k.ventas += p.total; k.fletes += p.flete; k.nFlete++; }
    if (g === 'entregado') { k.entregados++; k.utilidad += p.utilidad; k.ventasEntregadas += p.total; k.fleteEntregados += p.flete; }
    else if (g === 'devolucion') { k.devueltos++; k.perdidaDev += p.flete; k.valorDevuelto += p.total; }
    else if (g === 'cancelado') k.cancelados++;
    else if (g === 'novedad') { k.novedad++; k.porCobrar += p.total; k.utilEnCurso += p.utilidad; }
    else { k.proceso++; k.porCobrar += p.total; k.utilEnCurso += p.utilidad; }
    const e = (est[p.estado || 'SIN ESTADO'] ||= { estado: p.estado || 'SIN ESTADO', grupo: g, n: 0 }); e.n++;
    let d = null;
    if (g === 'entregado' && o.updated_at) { d = (new Date(o.updated_at) - new Date(o.created_at)) / 864e5; if (d >= 0) { diasSum += d; diasN++; if (d > diasMax) diasMax = d; } }
    const t = (tr[p.transp] ||= { nombre: p.transp, total: 0, entregados: 0, devoluciones: 0, cancelados: 0, proceso: 0, novedad: 0, recaudo: 0, fletes: 0, nf: 0, utilidad: 0, dias: 0, diasN: 0 });
    if (g !== 'cancelado') { t.fletes += p.flete; t.nf++; }
    if (g === 'cancelado') t.cancelados++; else if (g === 'proceso') t.proceso++; else if (g === 'novedad') t.novedad++;
    if (g === 'entregado') t.recaudo += p.total;
    t.total++; t.utilidad += g === 'entregado' ? p.utilidad : 0;
    if (g === 'entregado') { t.entregados++; if (d != null && d >= 0) { t.dias += d; t.diasN++; } }
    if (g === 'devolucion') t.devoluciones++;
    const z = (zn[p.depto || 'Sin dato'] ||= { nombre: p.depto || 'Sin dato', total: 0, entregados: 0, devoluciones: 0, fletes: 0, nf: 0, utilidad: 0, dias: 0, diasN: 0 });
    if (g !== 'cancelado') { z.fletes += p.flete; z.nf++; }
    if (g === 'entregado') { z.utilidad += p.utilidad; if (d != null && d >= 0) { z.dias += d; z.diasN++; } }
    z.total++; if (g === 'entregado') z.entregados++; if (g === 'devolucion') z.devoluciones++;
    const dd = (dias[p.fecha] ||= { fecha: p.fecha, pedidos: 0, ventas: 0, recaudo: 0, entregados: 0, utilidad: 0 });
    if (g === 'entregado') { dd.utilidad += p.utilidad; dd.recaudo += p.total; }
    dd.pedidos++; if (g !== 'cancelado') dd.ventas += p.total; if (g === 'entregado') dd.entregados++;
    const pp = (pr[p.prod] ||= { nombre: p.prod, prov: p.prov, total: 0, unidades: 0, entregados: 0, devoluciones: 0, utilidad: 0 });
    pp.unidades += (o.orderdetails || []).reduce((a, x) => a + num(x.quantity || 1), 0) || 1;
    pp.total++; if (g === 'entregado') { pp.entregados++; pp.utilidad += p.utilidad; } if (g === 'devolucion') pp.devoluciones++;
  }
  const eff = (a, b) => (a + b ? Math.round((a / (a + b)) * 1000) / 10 : 0);
  k.efectividad = eff(k.entregados, k.devueltos);
  k.utilEsperada = Math.round(k.utilEnCurso * (k.efectividad / 100));
  k.diasPromedio = diasN ? Math.round((diasSum / diasN) * 10) / 10 : 0;
  k.diasMax = Math.ceil(diasMax);
  k.fletePromedio = k.nFlete ? k.fletes / k.nFlete : 0;
  const fin = (x) => ({ ...x, efectividad: eff(x.entregados, x.devoluciones) });
  return {
    kpis: k,
    transportadoras: Object.values(tr).map((t) => ({ ...fin(t), dias: t.diasN ? Math.round((t.dias / t.diasN) * 10) / 10 : 0, fleteProm: t.nf ? t.fletes / t.nf : 0 })).sort((a, b) => b.total - a.total),
    zonas: Object.values(zn).map((z) => ({ ...fin(z), dias: z.diasN ? Math.round((z.dias / z.diasN) * 10) / 10 : null, fleteProm: z.nf ? z.fletes / z.nf : 0 })).sort((a, b) => b.total - a.total),
    estados: Object.values(est).sort((a, b) => b.n - a.n),
    tendencia: Object.values(dias).sort((a, b) => a.fecha.localeCompare(b.fecha)),
    productos: Object.values(pr).map(fin).sort((a, b) => b.unidades - a.unidades).slice(0, 60),
  };
}

function proveedores(list) {
  const m = {};
  for (const o of list) {
    const s = slim(o), n = supplierOf(o);
    const x = (m[n] ||= { nombre: n, total: 0, entregados: 0, devoluciones: 0, ventas: 0, costo: 0 });
    x.total++; if (s.grupo !== 'cancelado') { x.ventas += s.total; x.costo += s.costo; }
    if (s.grupo === 'entregado') x.entregados++; if (s.grupo === 'devolucion') x.devoluciones++;
  }
  return Object.values(m).map((x) => ({ ...x, efectividad: x.entregados + x.devoluciones ? Math.round((x.entregados / (x.entregados + x.devoluciones)) * 1000) / 10 : 0 }))
    .sort((a, b) => b.total - a.total);
}

function huella(list, tel) {
  const m = {};
  for (const o of list) {
    const p = slim(o); if (!p.tel) continue;
    const x = (m[p.tel] ||= { tel: p.tel, cliente: p.cliente, total: 0, entregados: 0, devoluciones: 0, cancelados: 0 });
    x.total++; if (p.grupo === 'entregado') x.entregados++; if (p.grupo === 'devolucion') x.devoluciones++; if (p.grupo === 'cancelado') x.cancelados++;
  }
  const risk = (x) => (x.devoluciones + x.cancelados >= 2 || (x.total >= 2 && x.devoluciones >= x.entregados) ? 'alto' : x.devoluciones + x.cancelados === 1 ? 'medio' : 'bajo');
  if (tel) { const x = m[String(tel).replace(/\D/g, '')]; return x ? { ...x, riesgo: risk(x) } : null; }
  return Object.values(m).filter((x) => x.devoluciones + x.cancelados > 0 || x.total > 1).map((x) => ({ ...x, riesgo: risk(x) }))
    .sort((a, b) => b.devoluciones + b.cancelados - (a.devoluciones + a.cancelados)).slice(0, 100);
}

// ---------- Ajustes guardados ----------
const key = (name) => name + S().suf;
const json = (res, code, body) => { res.status(code).json(body); };

async function names() {
  const saved = await store.get('settings', 'nombres', {});
  return [1, 2, 3].map((n) => ({
    n, nombre: saved[n] || META[n].pais, pais: META[n].pais, mon: META[n].mon, sym: META[n].sym, dec: META[n].dec, wa: META[n].wa,
    base: CTAS[n].base.replace(/^https?:\/\//, ''), conectada: !!process.env[tokenVar(n)] || DEMO(),
  }));
}

async function route(req, res, q) {
  const t0 = Date.now();
  const a = q.a || 'data', body = req.body && typeof req.body === 'object' ? req.body : {};
  try {
    if (a === 'cuentas') {
      if (req.method === 'POST' && body.n) { // renombrar cuenta
        const saved = await store.get('settings', 'nombres', {});
        saved[Number(body.n)] = String(body.nombre || '').slice(0, 40); await store.set('settings', 'nombres', saved);
      }
      return json(res, 200, { cuentas: await names(), pen: await store.get('settings', 'fxpen', DEF_PEN()) });
    }
    if (a === 'fx') { // tasa MXN -> PEN (soles por 1 peso mexicano)
      if (req.method === 'POST') {
        const r = Number(body.rate);
        if (!(r > 0.001 && r < 100)) return json(res, 400, { error: 'Tasa inválida' });
        await store.set('settings', 'fxpen', r);
      }
      return json(res, 200, { pen: await store.get('settings', 'fxpen', DEF_PEN()) });
    }
    if (a === 'retiros') {
      const cur = await store.get('settings', key('retiros'), []);
      if (req.method === 'POST') {
        const monto = num(body.monto), com = num(body.comision);
        if (monto <= 0) return json(res, 400, { error: 'Monto inválido' });
        cur.unshift({ id: Date.now(), banco: String(body.banco || '').slice(0, 60), monto, comision: com, neta: monto - com, fecha: day(body.fecha) || day(new Date().toISOString()) });
        await store.set('settings', key('retiros'), cur.slice(0, 500));
      } else if (req.method === 'DELETE') {
        const rest = cur.filter((r) => String(r.id) !== String(q.id));
        await store.set('settings', key('retiros'), rest); return json(res, 200, { retiros: rest });
      }
      return json(res, 200, { retiros: req.method === 'POST' ? await store.get('settings', key('retiros'), []) : cur, auto: false });
    }
    if (a === 'registro') { // registro diario global
      const cur = await store.get('settings', 'registro', {});
      if (req.method === 'POST') {
        const f = day(body.fecha); if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return json(res, 400, { error: 'Fecha inválida' });
        cur[f] = { gasto: num(body.gasto), ventas: num(body.ventas), nota: String(body.nota || '').slice(0, 300) };
        await store.set('settings', 'registro', cur);
      } else if (req.method === 'DELETE') { delete cur[q.f]; await store.set('settings', 'registro', cur); }
      return json(res, 200, { registro: cur });
    }
    if (a === 'favs') { // favoritos por proveedor, WhatsApp de cada proveedor y mensaje base
      const st = await store.get('settings', key('favs2'), {});
      st.items ||= []; st.hide ||= []; st.dir ||= {}; st.msg ||= '';
      if (req.method === 'POST') {
        const nm = (x) => String(x || '').slice(0, 120).trim(), digits = (x) => String(x || '').replace(/\D/g, '');
        const setWa = (prov, wa) => { const w = digits(wa); if (!prov) return; if (!w) delete st.dir[prov]; else if (w.length >= 8 && w.length <= 15) st.dir[prov] = w; };
        if (body.op === 'add') {
          const it = body.item || {}, name = nm(it.name), prov = nm(it.prov);
          if (!name) return json(res, 400, { error: 'Falta el producto' });
          st.items = st.items.filter((x) => x.name.toLowerCase() !== name.toLowerCase()); st.items.unshift({ name, prov });
          st.hide = st.hide.filter((h) => h.toLowerCase() !== name.toLowerCase()); setWa(prov, it.wa);
        } else if (body.op === 'prov') {
          const name = nm(body.name), prov = nm(body.prov); if (!name) return json(res, 400, { error: 'Falta el producto' });
          st.items = st.items.filter((x) => x.name !== name); st.items.unshift({ name, prov }); setWa(prov, body.wa);
        } else if (body.op === 'wa') setWa(nm(body.prov), body.wa);
        else if (body.op === 'del') { const name = nm(body.name); st.items = st.items.filter((x) => x.name !== name); if (!st.hide.includes(name)) st.hide.push(name); st.hide = st.hide.slice(-500); }
        else if (body.op === 'msg') st.msg = String(body.msg || '').slice(0, 300);
        st.items = st.items.slice(0, 300);
        await store.set('settings', key('favs2'), st);
      }
      return json(res, 200, st);
    }
    if (a === 'colores') { // color personalizado por estado (por cuenta)
      const cur = await store.get('settings', key('colores'), {});
      if (req.method === 'POST') {
        const k = norm(body.estado).slice(0, 80);
        if (!k) return json(res, 400, { error: 'Falta el estado' });
        if (['e-ok', 'e-ruta', 'e-pend', 'e-inv', 'e-ofi', 'e-nov', 'e-devt', 'e-dev', 'e-can'].includes(body.cls)) cur[k] = body.cls; else delete cur[k];
        await store.set('settings', key('colores'), cur);
      }
      return json(res, 200, { colores: cur });
    }
    if (a === 'pagos') { // entregados marcados como ya pagados (manual)
      const pg = await store.get('settings', key('pagos'), {});
      if (req.method === 'POST') {
        for (const id of (Array.isArray(body.ids) ? body.ids : []).slice(0, 500)) { if (body.pagado) pg[String(id)] = Date.now(); else delete pg[String(id)]; }
        await store.set('settings', key('pagos'), pg);
      }
      return json(res, 200, { pagados: pg });
    }
    if (a === 'rastreo') {
      const term = String(q.q || '').trim().toLowerCase();
      if (term.length < 3) return json(res, 400, { error: 'Escriba al menos 3 caracteres' });
      const hit = (await allOrders()).filter((o) => [o.id, o.shipping_guide, o.phone, o.name, o.surname].join(' ').toLowerCase().includes(term)).slice(0, 20);
      return json(res, 200, { resultados: hit.map((o) => ({ ...slim(o), movs: movs(o) })) });
    }

    if (a === 'oficina') { // pedidos en la oficina de la transportadora (sin filtro de periodo)
      const all = await allOrders(q.fresh === '1');
      const items = all.map(slim).filter((p) => p.ofi).sort((x, y) => y.diasOfi - x.diasOfi).slice(0, 500);
      return json(res, 200, { items, notas: await store.get('settings', key('gest'), {}), ms: Date.now() - t0, cache: new Date(S().cache.ts).toISOString() });
    }
    if (a === 'alertas') { // pedidos sin despachar por proveedor (sin filtro de periodo)
      const items = (await allOrders()).map(slim).filter((p) => p.sinDespachar)
        .map((p) => ({ id: p.id, prov: p.prov, dias: p.dias, estado: p.estado, cliente: p.cliente, guia: p.guia, transp: p.transp, prod: p.prod }))
        .sort((x, y) => y.dias - x.dias).slice(0, 500);
      return json(res, 200, { items });
    }

    // Todo lo demas parte de los pedidos
    const list = inPeriod(await allOrders(q.fresh === '1'), q.d || '30');
    const meta = S().meta;
    if (a === 'data') {
      const b = build(list);
      return json(res, 200, { cuenta: S().n, mon: meta.mon, ...b, pedidos: list.map(slim).sort((x, y) => y.fecha.localeCompare(x.fecha)).slice(0, 500), cache: new Date(S().cache.ts).toISOString(), ms: Date.now() - t0 });
    }
    if (a === 'prov') return json(res, 200, { proveedores: proveedores(list) });
    if (a === 'huella') return json(res, 200, q.tel ? { perfil: huella(list, q.tel) } : { clientes: huella(list) });
    if (a === 'gest') {
      let notas = await store.get('settings', key('gest'), {});
      if (req.method === 'POST') {
        if (!body.id) return json(res, 400, { error: 'Falta id' });
        notas[String(body.id)] = { estado: String(body.estado || 'pendiente').slice(0, 20), nota: String(body.nota || '').slice(0, 300), fecha: /^\d{4}-\d{2}-\d{2}$/.test(body.fecha || '') ? body.fecha : '', ts: Date.now() };
        await store.set('settings', key('gest'), notas);
      }
      const items = list.map(slim).filter((p) => p.grupo === 'novedad' || p.grupo === 'devolucion').sort((x, y) => y.fecha.localeCompare(x.fecha)).slice(0, 300);
      return json(res, 200, { items, notas });
    }
    return json(res, 404, { error: 'Acción desconocida' });
  } catch (e) {
    return json(res, e.code || 500, { error: e.message || 'Error' });
  }
}

async function handle(req, res) {
  const q = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  const c = { 1: 1, 2: 2, 3: 3 }[Number(q.c)] || 1;
  return als.run(CTAS[c], () => route(req, res, q));
}

module.exports = { handle, build, groupOf, CTAS, META };
