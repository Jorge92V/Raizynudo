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

No hay endpoints públicos para listar pedidos, consultar datos personales o modificar pagos. La vista del taller conserva copias de este dispositivo; los cambios simulados solo están disponibles para pedidos de demo. El panel administrativo conectado y el registro manual de anticipos están en `/admin`, con acceso protegido. La API pública únicamente recibe pedidos en estado `Recibido`; solo el administrador puede registrar un anticipo recibido e iniciar el plazo.

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


## Admin privado y avisos de pedidos

La ruta `/admin` no aparece en la navegación pública y lleva `noindex`. La protección real está en la API: sesión firmada en cookie `HttpOnly`, `Secure` y `SameSite=Strict`, con duración de 8 horas. Las contraseñas no se guardan en el navegador. Se limita el login a 10 intentos por IP en 15 minutos y se validan el origen y la cabecera de las operaciones de escritura.

Configurar en **Netlify → Project configuration → Environment variables**, con alcance de Functions:

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | Conexión pooled existente de Neon. |
| `ADMIN_PASSWORD` | Contraseña elegida para el taller, mínimo 16 caracteres. |
| `ADMIN_SESSION_SECRET` | Secreto aleatorio distinto de la contraseña, mínimo 32 caracteres. Generar con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `BUSINESS_TIME_ZONE` | Opcional; por defecto `America/Mexico_City`. |
| `RESEND_API_KEY` | API key de envío de Resend. |
| `MAIL_FROM` | Remitente autorizado en Resend, por ejemplo `Raíz & Nudo <pedidos@dominio-verificado.com>`. |

Después hacer un nuevo deploy. Si falta la configuración de administración, el acceso permanece bloqueado. Rotar la contraseña o el secreto invalida todas las sesiones existentes. No es necesario modificar HTML o JS para cambiar estas variables. No introducir secretos en variables públicas ni subirlos al repositorio.

### Servicio de correo

Proveedor preparado: **Resend**. Crear cuenta en `https://resend.com`, verificar el dominio remitente según los registros DNS que indique Resend y crear una API key de envío. Configurar `MAIL_FROM` con una dirección de ese dominio. El destinatario fijo es **Mike.valleg4@gmail.com** y se define solo en el servidor. El modo de pruebas de Resend restringe destinatarios; verificar el remitente para el envío normal.

Cada confirmación guarda el pedido y su aviso pendiente en la misma sentencia SQL. Solo después del guardado se intenta enviar. El aviso contiene folio, datos del cliente, dimensiones, distribución exacta, extras, grabado, destino, importe y anticipo. La imagen del grabado se consulta y descarga desde el admin; no se adjunta al correo.

Si no está configurada la clave de Resend, el aviso queda pendiente. Si el servicio falla, se conserva el pedido y se registra el error genérico. Los reintentos normales de confirmación y el botón **Reintentar aviso** del admin vuelven a procesar la cola; **todavía no hay un cron de reintentos automáticos**. El envío usa una clave de idempotencia estable y un bloqueo temporal para evitar concurrencia. Máximo 10 intentos por aviso. El estado `sent` significa aceptado por Resend, no entrega confirmada en la bandeja del destinatario; no hay webhook de rebotes/entrega en esta versión.

### Operación del taller

El admin permite buscar por folio, nombre o teléfono; filtrar por estado; navegar resultados de 25 en 25; abrir el diseño, datos y grabado; consultar historial; registrar manualmente el anticipo real del 30%; y actualizar estados. El pago no se cobra ni se verifica con una pasarela: el administrador confirma que ya lo recibió.

La primera confirmación del anticipo fija la fecha de fabricación a 7 días naturales, con la zona horaria del taller. No se permite repetirla ni pasar a Confirmado/Producción/Listo/Enviado/Entregado sin anticipo. Las actualizaciones incluyen una revisión para impedir que dos ventanas sobrescriban cambios sin aviso. Estado e historial se guardan de forma atómica.

Migración añadida: `002_admin_notifications.sql`. Crea cola de correos, control de intentos de acceso y revisión del pedido. Las imágenes grandes solo se consultan al abrir un detalle, no al listar pedidos. No se envían avisos antiguos automáticamente al aplicar la migración.

Prueba de integración: `node --env-file=.env scripts/smoke-admin.mjs`. Usa un pedido temporal y credenciales efímeras, verifica login, acceso protegido, cambios, conflictos de revisión, anticipo y cola, y elimina su registro de prueba. Simula la respuesta de Resend: **no envía correos reales**. Para probar la entrega real hace falta configurar el remitente y la API key.


### Remitente gratuito acordado

Si `MAIL_FROM` está vacío, se utiliza `Raíz & Nudo <onboarding@resend.dev>`. Este modo gratuito de pruebas de Resend solo envía al correo propietario de la cuenta: debe ser `Mike.valleg4@gmail.com`, que permanece como destinatario fijo. Para otros destinatarios se necesita un dominio remitente verificado. `MAIL_FROM` permite reemplazar el remitente sin cambiar código.

`/version.json` identifica el commit publicado para comprobar si Netlify desplegó la versión más reciente. `ADMIN_SESSION_SECRET` debe configurarse como secreto en Netlify, nunca en el repositorio.
