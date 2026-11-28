/* Calculadora de precios (COD). Todo en la moneda en que se escriben los costos ("base"); la pantalla convierte para mostrar.
   Fórmulas (deducidas de la calculadora de referencia y verificadas con sus cifras):
   proveedor = costo unidad × unidades · flete por entregado = flete ÷ %entrega despacho (los que vuelven también cuestan flete)
   pauta por entregado = CPA ÷ %entrega final · precio = costos ÷ (1 − utilidad) · se publica redondeado hacia arriba a un número que termina en 9. */
(function (root) {
  const n = (v, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
  const fin9 = (p) => (p <= 0 ? 0 : Math.ceil((p - 9) / 10) * 10 + 9); // 288.83 -> 289 · 292.5 -> 299
  function costos(i, unidades) {
    const ed = Math.max(0.01, n(i.entregaDespacho, 70) / 100), ef = Math.max(0.01, n(i.entregaFinal, 70) / 100);
    const prov = n(i.costoUnidad) * unidades, flete = n(i.flete) / ed, cpa = n(i.cpa) / ef, adm = n(i.admin), ful = n(i.fulfillment);
    return { prov, flete, cpa, adm, ful, total: prov + flete + cpa + adm + ful };
  }
  function precio(c, u) { const rec = c.total / (1 - u); const pub = fin9(rec); return { rec, pub, ganas: pub - c.total, margen: pub ? (pub - c.total) / pub : 0 }; }
  function calcular(i) {
    const u = Math.min(0.95, Math.max(0, n(i.utilidad, 22) / 100)), q = Math.max(1, Math.round(n(i.unidades, 1)));
    const c = costos(i, q), p = precio(c, u), ef = Math.max(0.01, n(i.entregaFinal, 70) / 100);
    const maxQ = Math.min(6, Math.max(3, q)), escalera = [];
    for (let k = 1; k <= maxQ; k++) { const ck = costos(i, k), pk = precio(ck, u); escalera.push({ unidades: k, costo: ck.total, precio: pk.pub, ganas: pk.ganas, margen: pk.margen, actual: k === q }); }
    // Opción 1: tengo X pedidos al día
    const ped = n(i.pedidosDia, 0), e1 = Math.max(0, n(i.entrega1, n(i.entregaFinal, 70)) / 100), entDia = ped * e1;
    const o1 = { entregasDia: entDia, gananciaEntrega: p.ganas, gananciaDia: entDia * p.ganas, utilidad30: entDia * p.ganas * 30, ventaMes: entDia * 30 * p.pub, pautaDia: ped * n(i.cpa) };
    // Opción 2: quiero ganar G por día / semana / mes
    const mult = { dia: 30, semana: 30 / 7, mes: 1 }[i.periodo] || 1, gMes = n(i.objetivo) * mult, e2 = Math.max(0.01, n(i.entrega2, n(i.entregaFinal, 70)) / 100);
    const entMes = p.ganas > 0 ? gMes / p.ganas : 0, pedMes = entMes / e2;
    const o2 = { gananciaEntrega: p.ganas, entregasDia: entMes / 30, pedidosDia: pedMes / 30, pedidosMes: pedMes, entregasMes: entMes, ventaMes: entMes * p.pub, pautaDia: (pedMes / 30) * n(i.cpa), objetivoMes: gMes };
    return { u, q, costos: c, precioRec: p.rec, precioPub: p.pub, ganas: p.ganas, margen: p.margen, tachado: p.pub * 2, equilibrio: c.total, escalera, o1, o2, ef };
  }
  // Semáforo de rentabilidad según el % de utilidad deseada
  function semaforo(pct) {
    if (pct < 8) return { nivel: 'rojo', txt: 'Margen muy bajo: una devolución o un mal día de pauta te hace perder.' };
    if (pct < 14) return { nivel: 'naranja', txt: 'Margen justo: cuidado con devoluciones y con subir la pauta.' };
    if (pct < 20) return { nivel: 'amarillo', txt: 'Aceptable: sirve para vender, pero escala con cuidado.' };
    return { nivel: 'verde', txt: 'Óptimo: margen saludable para escalar.' };
  }
  const api = { calcular, semaforo, fin9 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.VXCalc = api;
})(typeof self !== 'undefined' ? self : this);
