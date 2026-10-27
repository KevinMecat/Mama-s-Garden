# Demostración del cliente estático

Solo con `NEXT_PUBLIC_DATA_SOURCE=demo`, el frontend usa datos ficticios en el navegador. Producción utiliza `firebase` y no acepta la sesión ni las credenciales de demostración. Las credenciales públicas son `demo@mamasgarden.com` / `demo1234` (administrador). También existe `trabajador@mamasgarden.com` / `demo1234`, vinculado a Ana Demo para explorar el rol de trabajador.

La sesión, proyectos, empleados, asistencia, nómina, finanzas, producción, ventas y tareas se guardan únicamente en la clave `finca.demo.v1` de localStorage. No se guardan contraseñas ni se envían solicitudes a Django, Firestore o Storage. Cada navegador tiene su propia demostración. El badge Demo del navbar y el menú de usuario identifican este modo; no se deben introducir datos personales ni comprobantes reales. Cerrar sesión conserva los ejemplos editados; **Restablecer demo**, disponible en el menú de usuario y Configuración, repone los ejemplos conservando la sesión y sin borrar otras claves.

Los importes y transiciones son simulaciones para explorar la interfaz, no registros contables ni pagos. Los archivos binarios adjuntos no se almacenan ni se suben en este modo. El término Offline describe el servicio de datos local; la primera descarga del sitio requiere red y no se implementa un service worker.

## Conexión futura a Django

Definir `NEXT_PUBLIC_DATA_SOURCE=django` y `NEXT_PUBLIC_API_URL=https://api.example.com` **durante la compilación**, volver a compilar, regenerar la configuración CSP y desplegar. Con un origen configurado, todas las solicitudes usan exclusivamente la API con cookies de sesión, CSRF y HTTPS; la sesión demo nunca autentica ante Django. Un fallo de la API no activa el modo demo. Los ejemplos locales no se migran a PostgreSQL.

## Verificación

Desde `apps/web`: `npm test`, `npm run lint`, `npm run typecheck` y `npm run build`. El test del cliente verifica aislamiento del transporte, persistencia, permisos simulados, estados de tareas y ausencia de fallback ante errores del backend configurado.

Con un export servido o una publicación demo autorizada: `node scripts/test-demo-hosting.mjs https://fincamamasgarden.com`. Configurar `QA_BROWSER_CHANNEL=msedge` para usar Edge en Windows, o instalar Chromium de Playwright. La prueba crea y elimina únicamente estado local en un contexto de navegador nuevo; recorre las 29 rutas protegidas, comprueba búsqueda con Ctrl + K, cambios de estado de proyectos por selector y arrastre, persistencia, reinicio aislado, móvil y cierre de sesión y ausencia de llamadas API y errores de CSP.
