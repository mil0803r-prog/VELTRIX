const auth = require('./_auth');

const MARK = (id) => `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="g${id}" x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#15803d"/><stop offset=".55" stop-color="#16a34a"/><stop offset="1" stop-color="#34d399"/></linearGradient><linearGradient id="s${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="64" height="64" rx="18" fill="url(#g${id})"/><rect width="64" height="34" rx="18" fill="url(#s${id})"/><path d="M17 21 32 46 47 17" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M38.5 17H47v8.5" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const PAGE = (msg) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>VELTRIX · Acceso</title><meta name="theme-color" content="#16a34a">
<link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest">
<style>
*{box-sizing:border-box}html,body{height:100%;margin:0}
body{display:grid;grid-template-columns:1.05fr 1fr;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:#0c2018;background:#eaf4ef;-webkit-font-smoothing:antialiased}
.hero{position:relative;overflow:hidden;color:#fff;padding:56px;display:flex;flex-direction:column;justify-content:space-between;background:linear-gradient(135deg,#0a7a52 0%,#13a86f 55%,#3ddc97 100%)}
.hero .b{position:absolute;border-radius:34%;background:rgba(255,255,255,.13);animation:fl 11s ease-in-out infinite}
.b1{width:420px;height:420px;right:-120px;top:-100px;--r:14deg}.b2{width:260px;height:260px;left:-70px;bottom:90px;--r:-12deg;animation-duration:14s}.b3{width:150px;height:150px;right:90px;bottom:-40px;--r:8deg;animation-duration:9s;background:rgba(255,255,255,.1)}
@keyframes fl{0%,100%{transform:translate(0,0) rotate(var(--r))}50%{transform:translate(-16px,14px) rotate(calc(var(--r) + 7deg))}}
.brand{display:flex;align-items:center;gap:14px;position:relative;z-index:1}.brand svg{width:48px;height:48px;filter:drop-shadow(0 10px 18px rgba(0,60,35,.35))}
.brand span{font-weight:800;font-size:24px;letter-spacing:.22em}
.hero h2{position:relative;z-index:1;font-size:clamp(32px,3.6vw,50px);line-height:1.08;letter-spacing:-.035em;margin:0 0 18px;max-width:520px}
.hero h2 em{font-family:Georgia,serif;font-weight:400;color:#d9ffe9}
.hero p{position:relative;z-index:1;margin:0;opacity:.92;max-width:460px;font-size:16px}
.feat{position:relative;z-index:1;display:grid;gap:12px;margin-top:30px;padding:0;list-style:none}
.feat li{display:flex;align-items:center;gap:12px;font-weight:600;opacity:0;animation:up .7s cubic-bezier(.22,1,.36,1) forwards}
.feat li:nth-child(1){animation-delay:.3s}.feat li:nth-child(2){animation-delay:.45s}.feat li:nth-child(3){animation-delay:.6s}
.feat i{width:30px;height:30px;border-radius:10px;background:rgba(255,255,255,.2);display:grid;place-items:center;backdrop-filter:blur(6px)}.feat svg{width:16px;height:16px;fill:none;stroke:#fff;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.main{display:grid;place-items:center;padding:32px;background:radial-gradient(700px 420px at 90% -10%,rgba(52,211,153,.25),transparent 60%)}
form{width:min(400px,100%);background:#fff;border:1px solid #d3e7dc;border-radius:26px;padding:38px 34px 30px;box-shadow:0 40px 80px -40px rgba(16,150,90,.55),0 2px 6px rgba(16,80,50,.06);animation:up .8s cubic-bezier(.22,1,.36,1) both}
@keyframes up{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
.logo{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo svg{width:44px;height:44px;filter:drop-shadow(0 8px 14px rgba(22,163,74,.4))}
.logo b{font-size:23px;font-weight:800;letter-spacing:.2em;color:#15803d}
h1{margin:0 0 6px;font-size:27px;letter-spacing:-.03em}h1 em{font-family:Georgia,serif;font-weight:400;color:#16a34a}
.sub{margin:0 0 24px;color:#5d7a6c;font-size:14px}
label{display:block;font-size:11px;font-weight:800;letter-spacing:.14em;color:#5d7a6c;margin-bottom:8px}
.fld{position:relative}.fld input{width:100%;padding:14px 48px 14px 16px;border-radius:14px;border:1px solid #d3e7dc;background:#f6fbf8;color:#0c2018;font:inherit;font-size:16px;transition:.2s}
.fld input:focus{outline:0;border-color:#22c55e;background:#fff;box-shadow:0 0 0 4px rgba(34,197,94,.18)}
.eye{position:absolute;right:6px;top:50%;transform:translateY(-50%);border:0;background:none;color:#5d7a6c;cursor:pointer;padding:9px;border-radius:10px;display:grid}.eye:hover{background:#e6f5ec;color:#16a34a}
.eye svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
button.go{margin-top:18px;width:100%;display:flex;align-items:center;justify-content:center;gap:10px;padding:14px;border:0;border-radius:14px;font:inherit;font-size:16px;font-weight:700;color:#fff;cursor:pointer;background:linear-gradient(135deg,#16a34a,#34d399);box-shadow:0 14px 28px -12px rgba(22,163,74,.9);transition:transform .25s,box-shadow .25s}
button.go:hover{transform:translateY(-2px);box-shadow:0 18px 32px -12px rgba(22,163,74,1)}button.go:active{transform:scale(.98)}
button.go svg{width:18px;height:18px;fill:none;stroke:#fff;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;transition:transform .25s}button.go:hover svg{transform:translateX(4px)}
.e{min-height:20px;margin-top:14px;color:#e11d48;font-size:13px;font-weight:600;text-align:center}.e:not(:empty){animation:sh .4s}
@keyframes sh{20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}
.lock{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:6px;color:#5d7a6c;font-size:12px}.lock svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
@media(max-width:860px){body{grid-template-columns:1fr}.hero{display:none}.main{background:linear-gradient(160deg,#dff3e8,#eaf4ef 60%)}}
@media(prefers-color-scheme:dark){body{background:#06130d;color:#e8fff3}.main{background:radial-gradient(700px 420px at 90% -10%,rgba(34,197,94,.18),transparent 60%)}form{background:#0c2118;border-color:#17432d}.logo b{color:#4ade80}h1 em{color:#4ade80}.sub,label,.lock,.eye{color:#86b9a0}.fld input{background:#06130d;border-color:#17432d;color:#e8fff3}.fld input:focus{background:#0a1d14}@media(max-width:860px){.main{background:#06130d}}}
@media(prefers-reduced-motion:reduce){*{animation:none!important}}
</style></head><body>
<section class="hero"><i class="b b1"></i><i class="b b2"></i><i class="b b3"></i>
  <div class="brand">${MARK('h')}<span>VELTRIX</span></div>
  <div><h2>Tu negocio Dropi, <em>claro</em> y en vivo.</h2><p>Pedidos, utilidad y devoluciones de todas tus cuentas en un solo lugar, convertidos a soles.</p>
  <ul class="feat"><li><i><svg viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg></i>Utilidad real por pedido y por cuenta</li>
  <li><i><svg viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></i>Rastreo de guías y gestión de novedades</li>
  <li><i><svg viewBox="0 0 24 24"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></i>Pesos mexicanos a soles al instante</li></ul></div>
  <small style="position:relative;z-index:1;opacity:.75">© VELTRIX · Plataforma de control Dropi</small>
</section>
<section class="main"><form method="post" action="/api/login">
  <div class="logo">${MARK('f')}<b>VELTRIX</b></div>
  <h1>Bienvenido <em>de vuelta</em></h1><p class="sub">Ingresa tu contraseña para ver tu panel.</p>
  <label for="pw">CONTRASEÑA</label>
  <div class="fld"><input id="pw" type="password" name="password" placeholder="••••••••" autofocus required autocomplete="current-password">
  <button type="button" class="eye" id="eye" aria-label="Mostrar contraseña"><svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></div>
  <button class="go">Entrar <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
  <div class="e">${msg || ''}</div>
  <div class="lock"><svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>Conexión segura · sesión de 7 días</div>
</form></section>
<script>var p=document.getElementById('pw');document.getElementById('eye').onclick=function(){p.type=p.type==='password'?'text':'password';p.focus()}</script>
</body></html>`;

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
