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
| `DROPI_TOKEN` | Cuenta 1 · México (token de **integración** de Dropi) |
| `DROPI_TOKEN_2` | Cuenta 2 · México 2 |
| `DROPI_TOKEN_3` | Cuenta 3 · México 3 |
| `VELTRIX_MXN_PEN` | Opcional: tasa inicial de soles por 1 peso mexicano (por defecto 0.20). Se edita desde el tablero. |
| `DROPI_API_BASE_<n>` | Opcional: otra base de API para la cuenta n |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Guardar retiros, favoritos, gestión y registro diario (sin esto usa memoria y se pierde) |
| `DROPI_QUOTE_PATH` | Opcional: ruta del cotizador de flete (por defecto `/integrations/orders/cotizaEnvioTransportadoraV2`). |
| `DROPI_SENDER_DANE` | Opcional: código DANE/ciudad de origen por defecto para cotizar. El cotizador de Dropi la exige; si no se define, se detecta del detalle del producto o se elige en pantalla. |
| `DROPI_ORDER_PATH` | Opcional: ruta de Dropi para crear pedidos (por defecto `/integrations/orders/myorders`). |
| `VELTRIX_DEMO` | `1` = datos simulados para cuentas sin token (solo pruebas) |

El navegador nunca ve los tokens. No se guardan datos de clientes: se piden a Dropi en cada consulta (caché de 2 min).

## Desarrollo local

```bash
npm run dev     # http://localhost:3000, contraseña: demo, datos simulados
npm test
```

## Notas
- Moneda: las cuentas son de México (MXN, base `https://api.dropi.mx`, WhatsApp 52). Todos los paneles se pueden ver **convertidos a soles (S/)** con el interruptor de la esquina superior; la tasa (soles por 1 MXN) se edita ahí y se guarda en el servidor. No es una tasa en vivo: actualícela cuando cambie.
- Los países/monedas por cuenta están en `META` dentro de `api/_dropipanel.js`; el panel los lee de `a=cuentas`.
- Los endpoints de Dropi usados son solo `/integrations/orders/myorders` y `/integrations/products/index`. Los campos de pedido se leyeron de la guía; **confirme con un token real** que coinciden (ver `slim()` y `costOf()`).

## Subir pedidos a Dropi (pantalla «Crear Orden»)

Tres columnas como la de Dropi: **cliente** (con estado y municipio de Dropi y huella por teléfono), **transportadora** (contra entrega / pago anticipado, con el flete cotizado de cada una) y **resumen** (total a recaudar, precio proveedor, envío y ganancias). Usa la API oficial de integraciones de Dropi: cabecera `dropi-integration-key`, `POST /orders/myorders` (`payment_method_id: 1`, `type: FINAL_ORDER`, `total_order`, `shop_order_id`, `distributionCompany`), `GET /department`, `POST /trajectory/bycity` y `POST /orders/cotizaEnvioTransportadoraV2`.


Sección **Subir pedido** (menú lateral, o pestaña dentro de Admin Dropi). Pide lo que exige Dropi: nombre, apellido, teléfono, estado, ciudad, dirección, código postal (5 dígitos en México), tipo de pago (con o sin recaudo) y uno o más productos con cantidad y precio (y variación si el producto la tiene). Opcionales: correo, documento, colonia, notas, referencias de tu tienda y transportadora fija.

- Antes de enviar hay un resumen y una casilla de confirmación obligatoria: **cada envío crea un pedido real**.
- Protección contra duplicados: mismo teléfono + estado + productos en menos de 3 minutos pide confirmación extra.
- Si Dropi no responde (error de red/5xx) el pedido queda como "Verificar en Dropi" y **no** se reintenta solo.
- El historial guarda solo ID, fecha, estado de destino, productos y total; **no** guarda nombre, teléfono ni dirección del cliente.
- Sin token y con `VELTRIX_DEMO=1` los pedidos se simulan y no salen a Dropi.
- **Antes de usarlo en serio, haga un pedido de prueba con su token** y confirme que Dropi lo acepta: los nombres de los campos siguen la API documentada de Dropi, pero no se probaron contra su cuenta. El flete lo calcula Dropi al crear.
