// Sirve las paginas de /private solo con sesion valida.
const fs = require('fs'), path = require('path');
const auth = require('./_auth');
const FILES = { veltrix: ['veltrix.html', 'text/html; charset=utf-8'], panel: ['panel-dropi.html', 'text/html; charset=utf-8'], theme: ['theme.css', 'text/css; charset=utf-8'] };

module.exports = (req, res) => {
  const q = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  const f = FILES[q.p];
  if (!f) return res.status(404).end('No encontrado');
  if (!auth.valid(req)) {
    if (q.p === 'theme') return res.status(401).end();
    res.setHeader('Location', '/api/login'); return res.status(302).end();
  }
  res.setHeader('Content-Type', f[1]); res.setHeader('Cache-Control', 'no-store');
  res.status(200).end(fs.readFileSync(path.join(process.cwd(), 'private', f[0])));
};
