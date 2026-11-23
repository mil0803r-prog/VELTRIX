// Datos simulados (solo con VELTRIX_DEMO=1). Mismo formato que devuelve Dropi.
function rng(seed) { let s = seed; return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296); }
const MX = { deptos: ['CDMX', 'Jalisco', 'Nuevo León', 'Estado de México', 'Puebla', 'Veracruz'], carr: ['Veloces', 'Tiui', 'Coordi', 'Ampm'], carrId: [6, 11, 5, 12], dev: ['DEVOLUCION', 'DEVOLUCION EN TRANSITO', 'RECHAZADO'] };
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
      distribution_company: (() => { const ci = Math.floor(R() * k.carr.length); return { id: k.carrId[ci], name: k.carr[ci] }; })(),
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
      gallery: [{ urlS3: 'https://example.com/p' + i + '.png' }], categories: [i % 2 ? 'Bisutería' : 'Moda'], stock: 599 - i * 37, created_at: '2026-11-1' + (i % 9) + 'T10:00:00Z', user: { name: ['IMPULSA', 'LogiStock', 'DropHub'][i % 3] }, type: i % 3 === 0 ? 'VARIABLE' : 'SIMPLE',
      variations: i % 3 === 0 ? [['Dorado', 40], ['Azul', 0], ['Rojo', 12], ['Negro', 99], ['Rosada', 5], ['Multicolor', 8]].map(([c, st], j) => ({ id: 1000 * (j + 1) + i, sku: 'SKU' + i + '-' + j, stock: st, sale_price: 90 + i * 15, suggested_price: 150 + i * 20 + j * 5, attributes: [{ name: 'Color', value: c }] })) : [] }));
}
const ESTADOS = ['Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas'];
const CIUDADES = { 'Jalisco': ['Guadalajara', 'Zapopan', 'Tlaquepaque', 'Tonalá', 'Tlajomulco de Zúñiga'], 'Ciudad de México': ['Coyoacán', 'Iztapalapa', 'Benito Juárez', 'Cuauhtémoc', 'Miguel Hidalgo', 'Tlalpan'], 'Nuevo León': ['Monterrey', 'San Nicolás de los Garza', 'Guadalupe', 'Apodaca', 'San Pedro Garza García'], 'Puebla': ['Puebla', 'Cholula', 'Atlixco'] };
const deps = () => ESTADOS.map((name, i) => ({ id: i + 1, name }));
const cities = (dep) => (CIUDADES[ESTADOS[dep - 1]] || ['Centro', 'Norte', 'Sur']).map((name, i) => ({ id: dep * 100 + i, department_id: dep, name, cod_dane: String(dep * 1000 + i), zip_code: '0' + String(1000 + i * 10) }));
const CARR = [[6, 'Veloces'], [11, 'Tiui'], [12, 'Ampm'], [13, 'Afimex'], [5, 'Coordi'], [14, 'Quality-post']]; // transportadoras de Dropi México
function quote(cod, cityId) {
  return CARR.map(([id, name], i) => (i === 5 && cityId % 2 === 0 ? { id, name, cost: null, error: 'Sin cobertura en esta zona' } : { id, name, cost: 80 + (cityId % 7) * 6 + i * 7 + (cod ? 15 : 0), error: null }));
}
module.exports = { orders, products, deps, cities, quote };
