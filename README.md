# VELTRIX

Plataforma de control Dropi multi-cuenta (país) en tema verde. Todo en un repo, desplegable en Vercel.

| Pieza | Archivo |
|---|---|
| Tablero (Dashboard, Admin Dropi, Dinero, Registro diario) | `private/veltrix.html` |
| Panel Dropi (6 pestañas: resumen, pedidos, proveedores, favoritos, gestión, rendimiento) | `private/panel-dropi.html` → `/pedidos-dropi?c=N` |
| Tema verde compartido | `private/theme.css` |
| Servidor del panel | `api/_dropipanel.js` (ruta `api/dropi.js`) |
| Sesión / login | `api/_auth.js`, `api/login.js`, `api/page.js` |
| Datos guardados | `api/_store.js` (Upstash Redis, hashes `vx:*`) |
| Datos simulados | `api/_mock.js` |

Guía para agregar otro país: [`docs/PLANTILLA-PANEL-PAIS.md`](docs/PLANTILLA-PANEL-PAIS.md) (adaptada: el prefijo de datos es `vx:` y los nombres de archivo son los de esta tabla).

## Variables de entorno (Vercel)

| Variable | Para qué |
|---|---|
| `VELTRIX_PASSWORD` | **Obligatoria.** Contraseña de acceso. Sin ella nadie entra. |
| `VELTRIX_SECRET` | Firma de la cookie de sesión (cadena larga aleatoria). |
| `DROPI_TOKEN` | Cuenta 1 · Guatemala (token de **integración** de Dropi) |
| `DROPI_TOKEN_2` | Cuenta 2 · Colombia |
| `DROPI_TOKEN_3` | Cuenta 3 · Colombia 2 |
| `DROPI_API_BASE_<n>` | Opcional: otra base de API para la cuenta n |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Guardar retiros, favoritos, gestión y registro diario (sin esto usa memoria y se pierde) |
| `VELTRIX_DEMO` | `1` = datos simulados para cuentas sin token (solo pruebas) |

El navegador nunca ve los tokens. No se guardan datos de clientes: se piden a Dropi en cada consulta (caché de 2 min).

## Desarrollo local

```bash
npm run dev     # http://localhost:3000, contraseña: demo, datos simulados
npm test
```

## Notas
- Las monedas y prefijos de WhatsApp por país están en `META` dentro de `api/_dropipanel.js`; el panel los lee de `a=cuentas`.
- Los endpoints de Dropi usados son solo `/integrations/orders/myorders` y `/integrations/products/index`. Los campos de pedido se leyeron de la guía; **confirme con un token real** que coinciden (ver `slim()` y `costOf()`).
