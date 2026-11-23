const auth = require('./_auth');

const MARK = (id) => `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="g${id}" x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#065f46"/><stop offset=".55" stop-color="#047857"/><stop offset="1" stop-color="#10b981"/></linearGradient><linearGradient id="s${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="64" height="64" rx="18" fill="url(#g${id})"/><rect width="64" height="34" rx="18" fill="url(#s${id})"/><path d="M17 21 32 46 47 17" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M38.5 17H47v8.5" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const PAGE = (msg) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>VELTRIX · Acceso</title><meta name="theme-color" content="#047857">
<link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest">
<link rel="preload" as="font" type="font/woff2" href="/inter.woff2" crossorigin>
<style>
@font-face{font-family:"Inter";src:url(/inter.woff2) format("woff2");font-weight:100 900;font-display:swap}
@font-face{font-family:"Instrument Serif";src:url(/instrument-serif-italic.woff2) format("woff2");font-style:italic;font-weight:400;font-display:swap}
*{box-sizing:border-box}html{background:#f2f6f3}html,body{margin:0}
body{min-height:100vh;min-height:100dvh;display:grid;grid-template-columns:1.05fr 1fr;grid-template-rows:minmax(100vh,auto);grid-template-rows:minmax(100dvh,auto);font-family:"Inter",system-ui,-apple-system,"Segoe UI",sans-serif;font-feature-settings:"cv11","ss03";color:#0f1f19;background:#f2f6f3;-webkit-font-smoothing:antialiased}
.hero{min-height:100%;position:relative;overflow:hidden;color:#fff;padding:56px;display:flex;flex-direction:column;justify-content:space-between;background:linear-gradient(135deg,#053b2e 0%,#065f46 45%,#047857 80%,#10b981 130%)}
.hero .b{position:absolute;border-radius:34%;background:rgba(255,255,255,.13);animation:fl 11s ease-in-out infinite}
.b1{width:420px;height:420px;right:-120px;top:-100px;--r:14deg}.b2{width:260px;height:260px;left:-70px;bottom:90px;--r:-12deg;animation-duration:14s}.b3{width:150px;height:150px;right:90px;bottom:-40px;--r:8deg;animation-duration:9s;background:rgba(255,255,255,.1)}
@keyframes fl{0%,100%{transform:translate(0,0) rotate(var(--r))}50%{transform:translate(-16px,14px) rotate(calc(var(--r) + 7deg))}}
.brand{display:flex;align-items:center;gap:14px;position:relative;z-index:1}.brand svg{width:48px;height:48px;filter:drop-shadow(0 10px 18px rgba(0,60,35,.35))}
.brand span{font-weight:700;font-size:22px;letter-spacing:.2em}
.hero h2{position:relative;z-index:1;font-weight:650;font-size:clamp(32px,3.4vw,46px);line-height:1.1;letter-spacing:-.03em;margin:0 0 18px;max-width:520px}
.hero h2 em{font-family:"Instrument Serif",Georgia,serif;font-size:1.12em;font-weight:400;color:#a7f3d0;padding-right:.08em}
.hero p{position:relative;z-index:1;margin:0;opacity:.92;max-width:460px;font-size:16px}
.feat{position:relative;z-index:1;display:grid;gap:12px;margin-top:30px;padding:0;list-style:none}
.feat li{display:flex;align-items:center;gap:12px;font-weight:600;opacity:0;animation:up .7s cubic-bezier(.22,1,.36,1) forwards}
.feat li:nth-child(1){animation-delay:.3s}.feat li:nth-child(2){animation-delay:.45s}.feat li:nth-child(3){animation-delay:.6s}
.feat i{width:30px;height:30px;border-radius:10px;background:rgba(255,255,255,.2);display:grid;place-items:center;backdrop-filter:blur(6px)}.feat svg{width:16px;height:16px;fill:none;stroke:#fff;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.main{display:grid;place-items:center;padding:32px;background:radial-gradient(700px 420px at 90% -10%,rgba(52,211,153,.25),transparent 60%)}
form{width:min(400px,100%);background:#fff;border:1px solid #e0e8e3;border-radius:20px;padding:38px 34px 30px;box-shadow:0 30px 60px -34px rgba(4,90,65,.4),0 2px 6px rgba(15,40,30,.05);animation:up .8s cubic-bezier(.22,1,.36,1) both}
@keyframes up{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
.logo{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo svg{width:44px;height:44px;filter:drop-shadow(0 8px 14px rgba(4,120,87,.4))}
.logo b{font-size:21px;font-weight:700;letter-spacing:.2em;color:#0f1f19}
h1{margin:0 0 6px;font-size:26px;font-weight:650;letter-spacing:-.03em}h1 em{font-family:"Instrument Serif",Georgia,serif;font-size:1.1em;font-weight:400;color:#047857}
.sub{margin:0 0 24px;color:#5d7a6c;font-size:14px}
label{display:block;font-size:11px;font-weight:600;letter-spacing:.1em;color:#5d7a6c;margin-bottom:8px}
.fld{position:relative}.fld input{width:100%;padding:14px 48px 14px 16px;border-radius:14px;border:1px solid #e0e8e3;background:#f6f9f7;color:#0f1f19;font:inherit;font-size:16px;transition:.2s}
.fld input:focus{outline:0;border-color:#10b981;background:#fff;box-shadow:0 0 0 4px rgba(16,185,129,.18)}
.eye{position:absolute;right:6px;top:50%;transform:translateY(-50%);border:0;background:none;color:#5d7a6c;cursor:pointer;padding:9px;border-radius:10px;display:grid}.eye:hover{background:#e4f4ec;color:#047857}
.eye svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
button.go{margin-top:18px;width:100%;display:flex;align-items:center;justify-content:center;gap:10px;padding:14px;border:0;border-radius:14px;font:inherit;font-size:15px;font-weight:600;color:#fff;cursor:pointer;background:linear-gradient(135deg,#065f46,#047857 60%,#10b981);box-shadow:0 12px 24px -12px rgba(4,120,87,.9);transition:transform .25s,box-shadow .25s}
button.go:hover{transform:translateY(-2px);box-shadow:0 18px 32px -12px rgba(4,120,87,1)}button.go:active{transform:scale(.98)}
button.go svg{width:18px;height:18px;fill:none;stroke:#fff;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;transition:transform .25s}button.go:hover svg{transform:translateX(4px)}
.e{min-height:20px;margin-top:14px;color:#be123c;font-size:13px;font-weight:500;text-align:center}.e:not(:empty){animation:sh .4s}
@keyframes sh{20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}
.lock{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:6px;color:#5d7a6c;font-size:12px}.lock svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
@media(max-width:860px){body{grid-template-columns:1fr}.hero{display:none}.main{background:linear-gradient(160deg,#dff3e8,#eaf4ef 60%)}}
@media(prefers-color-scheme:dark){html{background:#09130f}body{background:#09130f;color:#e7f2ec}.main{background:radial-gradient(700px 420px at 90% -10%,rgba(16,185,129,.18),transparent 60%)}form{background:#0f1d17;border-color:#1f382c}.logo b{color:#e7f2ec}h1 em{color:#34d399}.sub,label,.lock,.eye{color:#8aa398}.fld input{background:#09130f;border-color:#1f382c;color:#e7f2ec}.fld input:focus{background:#0c1a14}@media(max-width:860px){.main{background:#09130f}}}
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

const MSG = { 1: 'Contraseña incorrecta.', 2: 'Demasiados intentos. Espere 10 minutos.', 3: 'Falta configurar VELTRIX_PASSWORD en Vercel.' };
const back = (res, e) => { res.setHeader('Location', '/api/login?e=' + e); return res.status(303).end(); }; // POST -> redirect -> GET: recargar no reenvia el formulario

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const q = req.query || {};
  if (q.logout) { res.setHeader('Set-Cookie', auth.cookie('', 0)); res.setHeader('Location', '/api/login'); return res.status(302).end(); }
  if (req.method === 'POST') {
    const t = auth.throttled(req);
    if (t.blocked) return back(res, 2);
    if (!process.env.VELTRIX_PASSWORD) return back(res, 3);
    const pw = req.body && (typeof req.body === 'object' ? req.body.password : new URLSearchParams(String(req.body)).get('password'));
    if (auth.checkPass(pw || '')) {
      res.setHeader('Set-Cookie', auth.cookie(auth.make(), 7 * 86400)); res.setHeader('Location', '/'); return res.status(303).end();
    }
    t.hit();
    return back(res, 1);
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.status(200).end(PAGE(MSG[q.e] || ''));
};
