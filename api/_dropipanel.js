// Servidor del panel Dropi multi-cuenta. Cada peticion lleva ?c=N; AsyncLocalStorage
// hace que S() devuelva la cuenta activa (cache y ajustes quedan separados por cuenta).
const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');
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
  let r = await call({ 'dropi-integration-key': token }); // cabecera oficial de la API de integraciones
  if (r.status === 401 || r.status === 403) r = await call({ Authorization: 'Bearer ' + token });
  if (!r.ok) {
    let msg = ''; try { const j = await r.json(); msg = String(j.message || j.error || j.msg || '').slice(0, 300); } catch (e) { /* sin cuerpo */ }
    throw Object.assign(new Error('Dropi respondió ' + r.status + (msg ? ': ' + msg : '')), { code: 502, status: r.status });
  }
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
    const pp = (pr[p.prod] ||= { nombre: p.prod, prov: p.prov, pid: (o.orderdetails || []).length === 1 ? (o.orderdetails[0].product?.id ?? null) : null, total: 0, unidades: 0, entregados: 0, devoluciones: 0, utilidad: 0 });
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
    const x = (m[p.tel.slice(-10)] ||= { tel: p.tel, cliente: p.cliente, total: 0, entregados: 0, devoluciones: 0, cancelados: 0 });
    x.total++; if (p.grupo === 'entregado') x.entregados++; if (p.grupo === 'devolucion') x.devoluciones++; if (p.grupo === 'cancelado') x.cancelados++;
  }
  const risk = (x) => (x.devoluciones + x.cancelados >= 2 || (x.total >= 2 && x.devoluciones >= x.entregados) ? 'alto' : x.devoluciones + x.cancelados === 1 ? 'medio' : 'bajo');
  if (tel) { const x = m[String(tel).replace(/\D/g, '').slice(-10)]; return x ? { ...x, riesgo: risk(x) } : null; }
  return Object.values(m).filter((x) => x.devoluciones + x.cancelados > 0 || x.total > 1).map((x) => ({ ...x, riesgo: risk(x) }))
    .sort((a, b) => b.devoluciones + b.cancelados - (a.devoluciones + a.cancelados)).slice(0, 100);
}

// Producto de Dropi -> forma que usa el panel (catalogo, favoritos y pedidos)
function mapProd(p) {
  const gallery = p.gallery && p.gallery[0]; const u = String((gallery && (gallery.urlS3 || gallery.url)) || p.img || '');
  const cat = p.categories && p.categories[0]; const stock = p.stock != null ? num(p.stock) : (p.warehouse_product || []).reduce((a, w) => a + num(w.stock), 0);
  const vars = (p.variations || []).map((v) => {
    const at = (v.attributes || v.attribute_values || []).map((x) => ({ n: String(x.name || (x.attribute && x.attribute.name) || '').slice(0, 30), v: String(x.value ?? '').slice(0, 40) })).filter((x) => x.v);
    return { id: v.id, label: at.map((x) => (x.n ? x.n + ': ' : '') + x.v).join(' · ') || String(v.label || v.sku || ('Variación ' + v.id)).slice(0, 60),
      color: (at.find((x) => /color|colour|estilo|modelo|dise/i.test(x.n)) || at[0] || {}).v || '', stock: v.stock == null ? null : num(v.stock), suggested: num(v.suggested_price), cost: num(v.sale_price) };
  });
  return { id: p.id, name: String(p.name || '').slice(0, 120), img: /^https:\/\//.test(u) ? u.slice(0, 300) : '', price: num(p.sale_price), cost: num(p.sale_price), suggested: num(p.suggested_price ?? p.sale_price),
    type: String(p.type || (vars.length ? 'VARIABLE' : 'SIMPLE')).toUpperCase(), categoria: String((cat && (cat.name || cat)) || '').slice(0, 40), stock,
    created: String(p.created_at || '').slice(0, 10), supplier_id: p.supplier_id ?? null,
    prov: String((p.user && (p.user.name || p.user.store_name)) || p.supplier_name || (p.supplier_id ? 'Proveedor ' + p.supplier_id : '')).slice(0, 60), variations: vars };
}

// ---------- Subir pedidos a Dropi ----------
const ORDER_PATH = () => process.env.DROPI_ORDER_PATH || '/integrations/orders/myorders';
const QUOTE_PATH = () => process.env.DROPI_QUOTE_PATH || '/integrations/orders/cotizaEnvioTransportadoraV2';
// Cuerpo de "Nueva Orden" segun la documentacion oficial de Dropi (payment_method_id=1, type=FINAL_ORDER, total_order entero, shop_order_id obligatorio).
function buildOrderPayload(o) {
  const p = { calculate_costs_and_shiping: true, type: 'FINAL_ORDER', payment_method_id: 1, rate_type: o.rate_type, total_order: Math.round(o.total),
    state: o.state, city: o.city, name: o.name, surname: o.surname, dir: o.dir, phone: o.phone,
    shop_order_id: o.shop_order_id || 'VX-' + Date.now(), products: o.products.map((x) => ({ id: x.id, price: x.price, quantity: x.quantity, variation_id: x.variation_id ?? null })) };
  for (const k of ['client_email', 'dni', 'colonia', 'zip_code', 'notes', 'shop_order_number']) if (o[k] !== '' && o[k] != null) p[k] = o[k];
  if (o.distribution_company_id) p.distributionCompany = { id: o.distribution_company_id };
  return p;
}
function parseQuote(j) {
  let arr = Array.isArray(j) ? j : (j && (j.objects || j.data || j.carriers || j.options || j.result)) || [];
  if (arr && !Array.isArray(arr)) arr = Object.values(arr);
  return arr.filter((x) => x && typeof x === 'object').map((x) => {
    const dc = x.distributionCompany || x.distribution_company || x.carrier_data || {}, inner = x.objects && !Array.isArray(x.objects) && typeof x.objects === 'object' ? x.objects : {};
    const id = Number(x.transportadora_id ?? dc.id ?? x.distribution_company_id ?? x.distributionCompanyId ?? x.id), cost = inner.precioEnvio ?? x.precioEnvio ?? x.shipping_cost ?? x.shippingCost ?? x.price ?? x.precio ?? x.cost ?? x.valor ?? x.shipping_amount;
    const name = String(x.transportadora || dc.name || (typeof x.carrier === 'string' ? x.carrier : x.carrier && x.carrier.name) || x.name || '').slice(0, 60);
    return { id: Number.isInteger(id) && id > 0 ? id : null, name: name || 'Transportadora', cost: cost == null || cost === '' ? null : num(cost), trayecto: String(inner.trayecto ?? x.trajectory ?? '').slice(0, 30), error: x.error ? String(x.error).slice(0, 200) : null };
  });
}
// Lista de transportadoras: servicio oficial /distribution_companies + las que ya aparecen en sus pedidos
async function carriersList() {
  const s = S(); if (s.carCache && Date.now() - s.carCache.ts < 3600000) return s.carCache.data;
  const m = {};
  if (DEMO() && !process.env[s.tokenVar]) for (const c of mock.quote(false, 1)) m[c.id] = { id: c.id, name: c.name, n: 0 };
  {
    if (!(DEMO() && !process.env[s.tokenVar])) for (const path of ['/integrations/distribution_companies', '/api/distribution_companies']) {
      try { for (const c of rows(await dropi(path))) { const id = Number(c.id); if (id > 0 && c.name && !c.deleted_at) m[id] = { id, name: String(c.name).slice(0, 60), n: 0 }; } if (Object.keys(m).length) break; } catch (e) { /* prueba la siguiente ruta */ }
    }
    for (const o of await allOrders()) {
      const dc = o.distribution_company || {}, id = Number(dc.id ?? o.distribution_company_id);
      if (!Number.isInteger(id) || id < 1) continue;
      (m[id] ||= { id, name: String(dc.name || ('Transportadora ' + id)).slice(0, 60), n: 0 }).n++;
    }
  }
  const data = Object.values(m).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  s.carCache = { ts: Date.now(), data }; return data;
}
// Ciudad de origen (de donde sale el producto): la pide el cotizador. Se busca en el detalle del producto.
function findDane(o, d) {
  if (!o || typeof o !== 'object' || d > 6) return '';
  if ((typeof o.cod_dane === 'string' || typeof o.cod_dane === 'number') && String(o.cod_dane)) return String(o.cod_dane);
  for (const k of Object.keys(o)) if (/^(warehouse_product|warehouse|warehouses|city|objects|data)$/.test(k)) {
    const v = Array.isArray(o[k]) ? o[k].map((x) => findDane(x, d + 1)).find(Boolean) : findDane(o[k], d + 1); if (v) return v;
  }
  return '';
}
async function senderDane(pid) {
  const s = S(); s.sd ||= {}; if (pid in s.sd) return s.sd[pid];
  let d = ''; try { d = findDane(await dropi('/integrations/products/v2/' + Number(pid)), 0); } catch (e) { /* sin detalle */ }
  return (s.sd[pid] = d);
}
function validarPedido(b) {
  const t = (v, max) => String(v ?? '').trim().slice(0, max);
  let phone = String(b.phone || '').replace(/\D/g, '');
  if (S().meta.wa && phone.length === S().meta.wa.length + 10 && phone.startsWith(S().meta.wa)) phone = phone.slice(S().meta.wa.length);
  const o = { name: t(b.name, 60), surname: t(b.surname, 60), phone, dir: t(b.dir, 200), state: t(b.state, 60), city: t(b.city, 80), colonia: t(b.colonia, 80),
    zip_code: String(b.zip_code || '').replace(/\D/g, ''), client_email: t(b.client_email, 100), dni: t(b.dni, 30), notes: t(b.notes, 300),
    shop_order_id: t(b.shop_order_id, 60), shop_order_number: t(b.shop_order_number, 60), rate_type: b.rate_type };
  for (const [k, l] of [['name', 'el nombre'], ['surname', 'el apellido'], ['dir', 'la dirección'], ['state', 'el estado'], ['city', 'la ciudad o municipio']]) if (!o[k]) return { error: 'Falta ' + l };
  if (o.phone.length < 8 || o.phone.length > 15) return { error: 'Teléfono inválido (de 8 a 15 dígitos)' };
  if (S().meta.mon === 'MXN' && !/^\d{5}$/.test(o.zip_code)) return { error: 'El código postal debe tener 5 dígitos' };
  if (o.client_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(o.client_email)) return { error: 'Correo inválido' };
  if (!['CON RECAUDO', 'SIN RECAUDO'].includes(o.rate_type)) return { error: 'Elija el tipo de pago' };
  const dc = b.distribution_company_id;
  if (dc != null && dc !== '') { if (!Number.isInteger(Number(dc)) || Number(dc) < 1) return { error: 'Transportadora inválida' }; o.distribution_company_id = Number(dc); }
  if (!Array.isArray(b.products) || !b.products.length || b.products.length > 20) return { error: 'Agregue de 1 a 20 productos' };
  o.products = []; o.items = [];
  for (const p of b.products) {
    const id = Number(p.id), q = Number(p.quantity), pr = Number(p.price);
    if (!Number.isInteger(id) || id < 1) return { error: 'Producto inválido' };
    if (!Number.isInteger(q) || q < 1 || q > 50) return { error: 'Cantidad inválida (de 1 a 50)' };
    if (!(pr >= 0) || pr > 10000000) return { error: 'Precio inválido' };
    const it = { id, quantity: q, price: pr };
    if (p.variation_id != null && p.variation_id !== '') { const v = Number(p.variation_id); if (!Number.isInteger(v) || v < 1) return { error: 'Variación inválida' }; it.variation_id = v; }
    o.products.push(it); o.items.push({ n: t(p.name, 80) || ('Producto ' + id), q });
  }
  o.total = o.products.reduce((a, p) => a + p.price * p.quantity, 0);
  return { ok: o };
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
        const pidOf = (v) => { if (v == null || String(v).trim() === '') return null; const n = Number(v); return Number.isInteger(n) && n >= 1 && n < 1e12 ? n : false; };
        const setWa = (prov, wa) => { const w = digits(wa); if (!prov) return; if (!w) delete st.dir[prov]; else if (w.length >= 8 && w.length <= 15) st.dir[prov] = w; };
        if (body.op === 'add') {
          const it = body.item || {}, name = nm(it.name), prov = nm(it.prov), pid = pidOf(it.id);
          if (!name) return json(res, 400, { error: 'Falta el producto' });
          if (pid === false) return json(res, 400, { error: 'El ID del producto debe ser un número' });
          st.items = st.items.filter((x) => x.name.toLowerCase() !== name.toLowerCase()); st.items.unshift(pid ? { name, prov, id: pid } : { name, prov });
          st.hide = st.hide.filter((h) => h.toLowerCase() !== name.toLowerCase()); setWa(prov, it.wa);
        } else if (body.op === 'prov') {
          const name = nm(body.name), prov = nm(body.prov), pid = pidOf(body.id); if (!name) return json(res, 400, { error: 'Falta el producto' });
          if (pid === false) return json(res, 400, { error: 'El ID del producto debe ser un número' });
          const prev = st.items.find((x) => x.name === name); st.items = st.items.filter((x) => x.name !== name);
          const keep = pid === null ? (prev && prev.id) : pid; st.items.unshift(keep ? { name, prov, id: keep } : { name, prov }); setWa(prov, body.wa);
        } else if (body.op === 'wa') setWa(nm(body.prov), body.wa);
        else if (body.op === 'del') { const name = nm(body.name); st.items = st.items.filter((x) => x.name !== name); if (!st.hide.includes(name)) st.hide.push(name); st.hide = st.hide.slice(-500); }
        else if (body.op === 'msg') st.msg = String(body.msg || '').slice(0, 300);
        st.items = st.items.slice(0, 300);
        await store.set('settings', key('favs2'), st);
      }
      return json(res, 200, st);
    }
    if (a === 'productos') { // catalogo de Dropi para elegir productos al subir un pedido
      const qq = String(q.q || q.id || '').trim().slice(0, 80), byId = q.id != null && q.id !== '' ? Number(q.id) : null;
      if (byId !== null && !(Number.isInteger(byId) && byId >= 1)) return json(res, 400, { error: 'El ID del producto debe ser un número' });
      let raw = DEMO() && !process.env[S().tokenVar] ? mock.products(byId !== null ? '' : qq) : rows(await dropi('/integrations/products/index', { method: 'POST', body: { keywords: qq, pageSize: 20, startData: 0, no_count: true } }));
      if (byId !== null) raw = raw.filter((p) => Number(p.id) === byId);
      return json(res, 200, { productos: raw.slice(0, 20).map(mapProd) });
    }
    if (a === 'favoritos') { // solo los productos marcados como favoritos en Dropi, con ventas propias de 7 y 30 dias
      const demo = DEMO() && !process.env[S().tokenVar];
      const raw = demo ? mock.products('').slice(0, 6) : rows(await dropi('/integrations/products/index', { method: 'POST', body: { pageSize: 50, startData: 0, no_count: true, order_by: 'id', order_type: 'desc', favorite: true } }));
      const sold = {};
      for (const o of await allOrders()) {
        if (groupOf(o) === 'cancelado') continue;
        const t = new Date(o.created_at).getTime(); if (!Number.isFinite(t)) continue;
        for (const d of o.orderdetails || []) { const id = d.product && d.product.id; if (id != null) (sold[id] ||= []).push([t, num(d.quantity || 1)]); }
      }
      const series = (id, n) => {
        const end = new Date(); end.setHours(23, 59, 59, 999); const arr = [];
        for (let i = n - 1; i >= 0; i--) { const to = end.getTime() - i * 864e5, from = to - 864e5; arr.push({ f: new Date(to - 36e5).toISOString().slice(0, 10), n: (sold[id] || []).filter(([t]) => t > from && t <= to).reduce((x, [, c]) => x + c, 0) }); }
        return arr;
      };
      return json(res, 200, { favoritos: raw.slice(0, 50).map((p) => ({ ...mapProd(p), d7: series(p.id, 7), d30: series(p.id, 30) })), demo });
    }
    if (a === 'geo') { // departamentos y ciudades de Dropi (para cotizar)
      const demo = DEMO() && !process.env[S().tokenVar];
      if (q.t === 'deps') {
        const raw = demo ? mock.deps() : rows(await dropi('/integrations/department'));
        return json(res, 200, { departamentos: raw.map((d) => ({ id: d.id, name: String(d.name || d.department || '').slice(0, 60) })).filter((x) => x.name && x.id != null) });
      }
      if (q.t === 'ciudades') {
        const dep = Number(q.dep); if (!Number.isInteger(dep) || dep < 1) return json(res, 400, { error: 'Departamento inválido' });
        const rate = q.rate === 'SIN RECAUDO' ? 'SIN RECAUDO' : 'CON RECAUDO';
        const raw = demo ? mock.cities(dep) : rows(await dropi('/integrations/trajectory/bycity', { method: 'POST', body: { rate_type: rate, department_id: dep } }));
        return json(res, 200, { ciudades: raw.slice(0, 700).map((c0) => { const c = c0.city || c0; return { id: c.id, name: String(c.name || c.city_name || '').slice(0, 80), cod_dane: String(c.cod_dane ?? ''), zip_code: String(c.zip_code ?? '') }; }).filter((x) => x.name && x.id != null) });
      }
      return json(res, 400, { error: 'Consulta inválida' });
    }
    if (a === 'cotizar') { // cotizador de flete por transportadora
      if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });
      const cid = Number(body.city && body.city.id), zip = String(body.zip_code || '').replace(/\D/g, '');
      if (!Number.isInteger(cid) || cid < 1) return json(res, 400, { error: 'Elija la ciudad de destino' });
      if (S().meta.mon === 'MXN' && !/^\d{5}$/.test(zip)) return json(res, 400, { error: 'Código postal de 5 dígitos' });
      const prods = (Array.isArray(body.products) ? body.products : []).slice(0, 20).map((p) => ({ id: Number(p.id), quantity: Number(p.quantity), price: Number(p.price), variation_id: p.variation_id ? Number(p.variation_id) : null }));
      if (!prods.length || prods.some((p) => !(p.id >= 1) || !(p.quantity >= 1) || !(p.price >= 0))) return json(res, 400, { error: 'Productos inválidos' });
      const cod = !!body.cod, amount = Math.round(prods.reduce((x, p) => x + p.price * p.quantity, 0));
      if (DEMO() && !process.env[S().tokenVar]) return json(res, 200, { carriers: mock.quote(cod, cid), demo: true, sender: body.sender_dane || null });
      const carriers = await carriersList().catch(() => []);
      const sender = String(body.sender_dane || '').replace(/\D/g, '').slice(0, 12) || process.env.DROPI_SENDER_DANE || await senderDane(prods[0].id);
      const payload = { EnvioConCobro: cod, amount, ciudad_destino: { id: cid, cod_dane: String(body.city.cod_dane || ''), zip_code: String(body.city.zip_code || '') }, zip_code: zip,
        products: prods.map((p) => ({ id: p.id, type: p.variation_id ? 'VARIABLE' : 'SIMPLE', quantity: p.quantity, price: p.price, variation_id: p.variation_id })) };
      if (sender) payload.ciudad_remitente = { cod_dane: String(sender) };
      const byName = (nm) => { const k = norm(nm); const c = carriers.find((x) => norm(x.name) === k); return c ? c.id : null; };
      const fallback = (err) => json(res, 200, { carriers: carriers.map((c) => ({ id: c.id, name: c.name, cost: null, error: null })), quoteError: err, needsSender: !sender, sender: sender || null });
      let list;
      try { list = parseQuote(await dropi(QUOTE_PATH(), { method: 'POST', body: payload })); } catch (e) { return fallback(e.message); }
      if (!list.length) return fallback('Dropi no devolvió tarifas para este envío');
      for (const c of list) if (!c.id) c.id = byName(c.name);
      return json(res, 200, { carriers: list, sender: sender || null });
    }
    if (a === 'transportadoras') return json(res, 200, { transportadoras: await carriersList() });
    if (a === 'crear') { // subir un pedido a Dropi (real: le llega al cliente final)
      const hist = await store.get('settings', key('ordenes'), []);
      if (req.method === 'GET') return json(res, 200, { ordenes: hist.slice(0, 100).map(({ hash, ...x }) => x), demo: DEMO() && !process.env[S().tokenVar] });
      if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });
      const v = validarPedido(body); if (v.error) return json(res, 400, { error: v.error });
      const o = v.ok, demo = DEMO() && !process.env[S().tokenVar];
      const hash = crypto.createHash('sha256').update([o.phone, o.state, o.products.map((p) => p.id + ':' + (p.variation_id || 0) + ':' + p.quantity).join(',')].join('|')).digest('hex').slice(0, 24);
      const dup = hist.find((h) => h.hash === hash && Date.now() - h.ts < 180000);
      if (dup && !body.forzar) return json(res, 409, { error: 'Ya se envió un pedido igual hace menos de 3 minutos (mismo teléfono, estado y productos).', duplicado: true, id: dup.id });
      const entry = { id: null, ts: Date.now(), fecha: new Date().toISOString().slice(0, 16).replace('T', ' '), hash, estado: o.state, items: o.items, total: o.total, rate: o.rate_type, demo, status: 'enviando' };
      hist.unshift(entry); const save = () => store.set('settings', key('ordenes'), hist.slice(0, 200));
      await save(); // se registra ANTES de enviar: si falla la red, un reintento rapido se detecta como posible duplicado
      try {
        if (demo) entry.id = 'DEMO-' + Date.now().toString().slice(-6);
        else {
          const j = await dropi(ORDER_PATH(), { method: 'POST', body: buildOrderPayload(o) });
          if (j && (j.isSuccess === false || j.success === false)) throw Object.assign(new Error('Dropi rechazó el pedido: ' + String(j.message || 'sin detalle').slice(0, 300)), { code: 422, status: 422 });
          const d = (j && (j.objects || j.data)) || j || {};
          entry.id = String(d.id ?? d.order_id ?? j.id ?? '') || null;
        }
        entry.status = 'creado'; S().cache = { ts: 0, data: null }; await save();
        const { hash: _h, ...pub } = entry; return json(res, 200, { ok: true, orden: pub });
      } catch (e) {
        if (e.status && e.status < 500) { hist.splice(hist.indexOf(entry), 1); await save(); return json(res, e.code === 422 ? 422 : 502, { error: e.message, rechazado: true }); }
        entry.status = 'incierto'; await save();
        return json(res, 502, { error: (e.message || 'Error de red') + '. No se pudo confirmar si Dropi creó el pedido: revíselo en Resumen antes de reenviar.', incierto: true });
      }
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

module.exports = { handle, build, groupOf, CTAS, META, buildOrderPayload, parseQuote };
