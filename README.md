# Raíz & Nudo

Configurador de tablas de picar y prototipo del flujo completo de pedidos. HTML, CSS y JavaScript sin dependencias de ejecución ni paso de compilación.

## Iniciar

Con Python 3 instalado:

```sh
npm run dev
```

Abrir `http://127.0.0.1:5173`. También puede abrirse `index.html` directamente, aunque el almacenamiento en URLs `file:` depende del navegador. Para comprobaciones se necesita Node.js 18 o superior:

```sh
npm run check
npm test
```

No hace falta ejecutar `npm install`.

## Flujo

1. Elegir división, dimensiones, maderas, distribución y extras.
2. Capturar datos de prueba del cliente.
3. Elegir recogida o envío e indicar destino.
4. Revisar diseño, importes y datos; confirmar una sola vez.
5. Recibir folio y consultar la vista del taller.
6. Simular anticipo y actualizar estado; descargar el pedido completo en JSON.

Reglas acordadas:

- Anticipo del **30% del producto**, redondeado a centavos.
- Fabricación en **7 días naturales desde la recepción del anticipo**. No incluye tránsito.
- Envío cotizado según destino y confirmado antes de pedir el pago; no se inventa una tarifa ni se suma cero a un costo pendiente.
- Sin paso adicional de aprobación del grabado ni flujo de cancelación.
- El grabado sigue disponible como extra del configurador. PNG/JPG hasta 1.5 MB.

## Estructura

- `index.html`: estructura del configurador y del recorrido.
- `assets/styles.css`: estilos adaptables a móvil.
- `assets/configurator.js`: canvas, maderas, medidas, extras y estimación de precio.
- `assets/flow.js`: pasos, validaciones, resumen, confirmación y vista del taller.
- `assets/business.js`: anticipo, plazo, estados y registro simulado del anticipo.
- `assets/storage.js`: adaptador local para borradores y pedidos.
- `tests/`: pruebas de reglas comerciales y persistencia.
- `netlify.toml`: configuración estática, sin build.

## Estado de esta versión

**Es una versión de prueba, todavía sin BD.** Pedidos, imágenes y datos viven en `localStorage` del mismo navegador y origen. No hay mensajes, cobros, usuarios ni autenticación del taller. No debe usarse para recibir pedidos reales hasta completar la fase siguiente. Borrar los datos del navegador elimina los registros; la descarga JSON sirve para inspeccionar la estructura, no es un respaldo automatizado.

La cotización de esta versión conserva factores del código original (3.7 para tiras, 4.2 para ajedrez). Antes de cobrar deben verificarse precios de madera, factores y tratamiento fiscal con el negocio. El anticipo se calcula sobre el producto; si debe incluir envío, se cambia esa regla al conectar el backend.

## Siguiente fase: base de datos

1. Crear clientes, pedidos, partidas/diseños, historial y catálogo de precios en PostgreSQL/Supabase.
2. Crear almacenamiento privado para grabados y previews; sustituir data URLs por referencias a archivos.
3. Añadir API para confirmar pedidos y recalcular precios en servidor. Guardar en una transacción diseño, reglas/precios aceptados y pedido, con clave de idempotencia.
4. Sustituir el adaptador local por llamadas **asíncronas** a esa API y adaptar cargas/errores en el flujo; no basta cambiar la URL del almacenamiento.
5. Autenticar el panel del taller, autorizar cambios de estado y registrar pagos verificados por servidor. La simulación actual no verifica dinero.
6. Confirmar envío y total con el cliente antes del anticipo. El costo pendiente se representa como `null`, no como cero.
7. Añadir notificaciones después del guardado y probar la recepción de extremo a extremo.

Cada pedido exporta `schemaVersion`, folio, fecha, cliente, entrega, matriz exacta de maderas, extras, grabado, importe del producto, anticipo, plazo e historial. La fecha límite se fija al simular el primer anticipo; repetir la acción no reinicia el plazo. Para producción, el servidor debe usar una zona horaria acordada del taller al calcular días naturales.

No colocar claves privilegiadas de Supabase ni otras credenciales en los archivos públicos.

## Publicación

El repositorio puede servirse desde cualquier hosting estático. En Netlify, conectar este repositorio: sin comando de build y directorio de publicación `.`. La publicación requiere configurarse en la cuenta del propietario; el repositorio por sí solo no cambia el sitio existente de Netlify.
