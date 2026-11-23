const auth = require('./_auth');

const PAGE = (msg) => `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VELTRIX · Acceso</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#06130d;color:#e8fff3;font-family:system-ui,sans-serif}
form{background:#0c2118;border:1px solid #14402b;border-radius:16px;padding:32px;width:min(340px,86vw);box-shadow:0 0 60px #22c55e22}
h1{margin:0 0 4px;font-size:26px;letter-spacing:.14em;color:#22c55e}p{margin:0 0 20px;color:#86b9a0;font-size:14px}
input{width:100%;box-sizing:border-box;padding:12px;border-radius:10px;border:1px solid #14402b;background:#06130d;color:#e8fff3;font-size:16px}
button{margin-top:14px;width:100%;padding:12px;border:0;border-radius:10px;background:#22c55e;color:#04210f;font-weight:700;font-size:16px;cursor:pointer}
.e{color:#fca5a5;font-size:13px;margin-top:10px;min-height:16px}</style>
<form method="post" action="/api/login"><h1>VELTRIX</h1><p>Plataforma de control Dropi</p>
<input type="password" name="password" placeholder="Contraseña" autofocus required autocomplete="current-password">
<button>Entrar</button><div class="e">${msg || ''}</div></form></html>`;

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const q = req.query || {};
  if (q.logout) { res.setHeader('Set-Cookie', auth.cookie('', 0)); res.setHeader('Location', '/api/login'); return res.status(302).end(); }
  if (req.method === 'POST') {
    const t = auth.throttled(req);
    if (t.blocked) return res.status(429).setHeader('Content-Type', 'text/html; charset=utf-8').end(PAGE('Demasiados intentos. Espere 10 minutos.'));
    let pw = req.body && (typeof req.body === 'object' ? req.body.password : new URLSearchParams(String(req.body)).get('password'));
    if (!process.env.VELTRIX_PASSWORD) return res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8').end(PAGE('Falta configurar VELTRIX_PASSWORD en Vercel.'));
    if (auth.checkPass(pw || '')) {
      res.setHeader('Set-Cookie', auth.cookie(auth.make(), 7 * 86400)); res.setHeader('Location', '/'); return res.status(302).end();
    }
    t.hit();
    return res.status(401).setHeader('Content-Type', 'text/html; charset=utf-8').end(PAGE('Contraseña incorrecta.'));
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.status(200).end(PAGE(''));
};
