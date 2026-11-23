// Datos simulados (solo con VELTRIX_DEMO=1). Mismo formato que devuelve Dropi.
function rng(seed) { let s = seed; return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296); }
const MX = { deptos: ['CDMX', 'Jalisco', 'Nuevo León', 'Estado de México', 'Puebla', 'Veracruz'], carr: ['Estafeta', 'Paquetexpress', 'Redpack', 'J&T Express'], dev: ['DEVOLUCION', 'DEVOLUCION EN TRANSITO', 'RECHAZADO'] };
const PRODS = ['Faja reductora', 'Corrector de postura', 'Masajeador cervical', 'Lámpara solar', 'Set de cuchillos', 'Cepillo alisador', 'Reloj inteligente', 'Organizador de cables'];
const SUPS = ['Proveedor Norte', 'LogiStock', 'Mayorista Sur', 'DropHub'];

function orders(n) {
  const k = MX, mult = 4; // pesos mexicanos
  const R = rng(n * 977 + 13), out = [], now = Date.now();
  for (let i = 0; i < 260; i++) {
    const r = R(), age = Math.floor(R() * 90);
    const created = new Date(now - age * 864e5 - R() * 864e5);
    let status;
    if (age < 3) status = r < 0.5 ? 'PENDIENTE' : 'EN TRANSITO';
    else if (r < 0.58) status = 'ENTREGADO';
    else if (r < 0.72) status = k.dev[Math.floor(R() * k.dev.length)];
    else if (r < 0.80) status = 'CANCELADO';
    else if (r < 0.88) status = 'NOVEDAD';
    else status = r < 0.92 ? 'EN OFICINA' : r < 0.96 ? (R() < 0.5 ? 'EN RUTA' : 'EN TRANSITO') : r < 0.98 ? 'EN INVENTARIO' : 'GUIA GENERADA';
    const p = Math.floor(R() * PRODS.length), qty = 1 + Math.floor(R() * 2);
    const price = Math.round((120 + R() * 180) * mult), cost = Math.round(price * (0.35 + R() * 0.2));
    const ship = Math.round((28 + R() * 20) * mult);
    out.push({
      id: 10000 * n + i, status, created_at: created.toISOString(),
      updated_at: status === 'EN OFICINA' ? new Date(now - Math.floor(R() * 9) * 864e5).toISOString() : new Date(created.getTime() + (2 + R() * 6) * 864e5).toISOString(),
      address: 'Calle ' + (1 + Math.floor(R() * 80)) + ' #' + (10 + Math.floor(R() * 90)) + '-' + (1 + Math.floor(R() * 60)) + ', Col. Centro',
      total_order: price * qty + ship, shipping_amount: ship,
      name: 'Cliente', surname: String(i), phone: '52' + String(10000000 + Math.floor(R() * 60) * 91731 % 89999999).padStart(10, '5'),
      state: k.deptos[Math.floor(R() * k.deptos.length)], city: 'Ciudad ' + (1 + Math.floor(R() * 9)),
      distribution_company: { name: k.carr[Math.floor(R() * k.carr.length)] },
      shipping_guide: 'G' + (500000 + i * 7),
      orderdetails: [{ quantity: qty, supplier_price: cost, product: { id: 100 + p, name: PRODS[p], user: { name: SUPS[p % SUPS.length] } } }],
      guia_movements: status === 'NOVEDAD' ? [{ description: 'Cliente no responde', created_at: created.toISOString() }] : [],
    });
  }
  return out;
}
function products(q) {
  return PRODS.filter((x) => !q || x.toLowerCase().includes(String(q).toLowerCase()))
    .map((nm, i) => ({ id: 100 + i, name: nm, sale_price: 90 + i * 15, suggested_price: 150 + i * 20, sku: 'SKU' + i, img: '',
      variations: i % 3 === 0 ? [{ id: 1000 + i, sku: 'Talla M' }, { id: 2000 + i, sku: 'Talla G' }] : [] }));
}
module.exports = { orders, products };
