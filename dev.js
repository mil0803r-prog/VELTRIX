// Servidor local de desarrollo: imita las rutas de Vercel. Uso: npm run dev
const http = require('http'), { URL } = require('url');
const routes = { '/api/dropi': require('./api/dropi'), '/api/login': require('./api/login'), '/api/page': require('./api/page') };
const rewrites = { '/': '/api/page?p=veltrix', '/pedidos-dropi': '/api/page?p=panel', '/theme.css': '/api/page?p=theme' };
http.createServer((req, res) => {
  let u = new URL(req.url, 'http://localhost');
  if (rewrites[u.pathname]) { const t = new URL(rewrites[u.pathname], 'http://localhost'); t.searchParams.forEach((v, k) => u.searchParams.set(k, v)); u = new URL(t.pathname + '?' + u.searchParams, 'http://localhost'); }
  const h = routes[u.pathname]; if (!h) { res.statusCode = 404; return res.end('404'); }
  let raw = ''; req.on('data', (c) => (raw += c)); req.on('end', () => {
    req.query = Object.fromEntries(u.searchParams);
    const ct = req.headers['content-type'] || '';
    req.body = /json/.test(ct) && raw ? JSON.parse(raw) : raw;
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
    Promise.resolve(h(req, res)).catch((e) => { res.statusCode = 500; res.end(String(e)); });
  });
}).listen(process.env.PORT || 3000, () => console.log('VELTRIX en http://localhost:' + (process.env.PORT || 3000)));
