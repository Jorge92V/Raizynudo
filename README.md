# Raíz & Nudo

Configurador de tablas de picar y recepción de pedidos. HTML/CSS/JavaScript en el navegador, Netlify Functions en servidor y PostgreSQL en Neon.

## Flujo y reglas

Diseño → datos del cliente → entrega → revisión → confirmación → folio.

- Anticipo del **30% del producto**, redondeado a centavos.
- Fabricación en **7 días naturales desde el anticipo**; transporte aparte.
- Envío según destino, confirmado antes de solicitar pago. Mientras falta cotizar se guarda `null`, no cero.
- Sin aprobación adicional del grabado ni flujo de cancelación.
- PNG/JPG de grabado hasta 1.5 MB, con posición y tamaño dentro de la tabla.

El precio se recalcula en servidor con las reglas originales: factor 3.7 en tiras, 4.2 en ajedrez. Si difiere de lo revisado por el cliente, la API no crea el pedido y pide revisar la cotización.

## Instalación y pruebas

Node.js 22 o superior y npm:

```sh
npm ci
npm run check
npm test
npm run build
```

`npm run dev` sirve la demo estática con Python 3 en `http://127.0.0.1:5173`. Esa demo usa almacenamiento local y no recibe pedidos reales. Para probar Functions localmente, usar Netlify CLI (`netlify dev`) con las variables de `.env`.

## Conexión a Neon

Crear `.env` a partir de `.env.example` con:

- `DATABASE_URL`: conexión pooled para Functions.
- `DATABASE_URL_UNPOOLED`: conexión directa para migraciones.

Nunca subir valores reales a GitHub. `.env` está ignorado. La aplicación pública no recibe esas variables.

```sh
npm run db:inspect
npm run db:migrate
```

La migración versionada `db/migrations/001_orders.sql` crea el esquema `raiz_nudo` con `orders`, `order_events` y `schema_migrations`. Usa una transacción y no borra datos. Se aplicó y verificó en la base suministrada. No se creó otra base ni otro proyecto Neon.

Cada pedido conserva los datos del cliente, destino, matriz exacta de maderas, extras, grabado, precios/reglas aceptados, importe, anticipo y estado. Cliente, diseño y cotización son snapshots JSONB del pedido, para no modificar su historia cuando cambie el catálogo. Los grabados se guardan temporalmente en el JSONB del diseño; pueden pasar a almacenamiento privado de archivos en una fase posterior.

La conexión SQL permite trabajar con esta BD; **no autentica Neon CLI ni instala MCP**. Esos componentes requieren acceso a la cuenta de Neon por separado.

## Publicar en Netlify

1. Conectar `Jorge92V/Raizynudo`, rama `main`, al sitio de Netlify.
2. En la configuración del proyecto → Environment variables, crear `DATABASE_URL` como secreto disponible para Functions en el contexto de producción. Usar la conexión pooled. No usar prefijos de variables públicas.
3. Hacer un nuevo deploy. `netlify.toml` configura `npm run build`, carpeta `public` y funciones.
4. `/api/config` debe devolver `{"ordersEnabled":true}`. Solo revela si está configurado; nunca la conexión.
5. Completar un pedido para verificar el flujo del sitio desplegado.

El build copia exclusivamente `index.html` y `assets/` a `public/`: ni `.env`, ni migraciones, ni archivos del servidor se publican como estáticos. Al rotar la contraseña, actualizar `.env` local y `DATABASE_URL` en Netlify y volver a desplegar. No es necesario cambiar código.

Si la configuración del servidor no tiene `DATABASE_URL`, el sitio permanece claramente en modo demo. Si no se puede comprobar la configuración por un error de red, no se permite confirmar para evitar mostrar éxito local como un pedido registrado.

## API

- `GET /api/config`: indica si está habilitada la recepción en servidor.
- `POST /api/orders`: valida datos y diseño, recalcula, guarda y devuelve folio/importes. Necesita `requestKey` UUID y el precio revisado `expectedAmountCents`. Un reintento con la misma clave y contenido devuelve el mismo folio; con contenido distinto devuelve 409. El primer registro y su evento se guardan en una sola sentencia atómica.

No hay endpoints públicos para listar pedidos, consultar datos personales o modificar pagos. La vista del taller conserva copias de este dispositivo; los cambios simulados solo están disponibles para pedidos de demo. **El panel administrativo conectado y autenticado, el registro real de anticipos y las notificaciones siguen pendientes**. El plazo solo comenzará cuando se registre un anticipo verificado; la API actual únicamente recibe pedidos en estado `Recibido`.

## Estructura

- `assets/configurator.js`, `styles.css`: configuración y vista previa.
- `assets/flow.js`: pasos, guardado local y confirmación asíncrona en servidor.
- `assets/business.js`, `storage.js`: reglas de demo y borradores locales.
- `server/orders.cjs`: validación, precio e idempotencia.
- `netlify/functions/`: entrada de servidor y configuración pública.
- `db/migrations/`: esquema versionado.
- `scripts/`: build, inspección, migración y prueba real de registro.
- `tests/`: reglas de negocio, persistencia y validación de API.

Prueba opcional real: `node --env-file=.env scripts/smoke-db.mjs`. Crea un pedido ficticio, verifica cálculo, anticipo e idempotencia y elimina exclusivamente su registro temporal. Se ejecutó correctamente contra Neon. En entornos que requieran un proxy para Node, usar `NODE_USE_ENV_PROXY=1` (Node 24).
