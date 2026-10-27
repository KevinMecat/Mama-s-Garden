# Operación del personal en Firebase — 0.2.0

La instrucción vigente del propietario establece `surco-finca` como origen de
personal, salarios USD, asistencia, unidades, finanzas y fotografías. El cliente
estático usa Firebase Authentication y un perfil `users/{uid}` activo. La
configuración pública se obtiene de Hosting; no se distribuyen claves de servicio.
No hay sesión demo ni sustitución por fixtures si Firebase falla.

## Conservación y respaldo

Antes del despliegue se respaldaron privadamente 795 documentos, recorriendo todas
las colecciones/subcolecciones, y 26 objetos con sus generaciones y metadatos.
El directorio está fuera del repositorio, con ACL NTFS para el propietario y SYSTEM.
El manifiesto y los archivos tienen SHA-256. No contiene una copia pública ni se
sube como artifact de CI. El acta privada `restore-verification.json` certifica
795 documentos restaurados en un proyecto `demo-*` en Firestore emulado sobre
loopback, comparados campo por campo; los 26 archivos se restauraron a otro
directorio privado y sus hashes coinciden. Esta última prueba es de restauración
de archivos, no una carga de recuperación al bucket productivo ni al emulador Storage.

No se conectó, arrancó ni migró PostgreSQL. Cualquier futura migración de ese motor
exige su propio respaldo y restauración: la prueba Firebase no lo sustituye.
No se ejecutaron semillas, borrados ni escrituras de prueba sobre datos reales.

## Documentos y contrato

| Recurso | Uso |
| --- | --- |
| `workers`, `salaries`, `attendance`, `transactions`, `microbusinesses`, `payrolls`, `payments` | Lectura con permisos; nunca destinos de escritura del adaptador Kanban |
| `workforce_tasks` | Plan, IDs reales, estado, condiciones, versión y referencias al último cierre/revisión |
| `workforce_logs` | Cierre inmutable, fecha real, cantidad o cumplimiento, minutos explícitos por persona e incidencias |
| `workforce_reviews` | Revisión inmutable del Administrador; cantidad aceptada o devolución motivada |
| `workforce_history` | Evento inmutable y clave de idempotencia de cada operación, actor y transición |
| `workforce_worker_adjustments` | Revisión de perfil por ID original, sin salario, foto, períodos ni asistencia |
| `workforce_worker_history` | Historial inmutable de las revisiones de perfil |
| `workforce_settings/people` | Índice de inactivos revisados para validar asignaciones en servidor |
| `workforce_accounts/{uid}` | Vínculo permanente entre una cuenta de trabajador existente y su ID real |
| `workforce-evidence/{taskId}/{uid}/{uuid}` | Evidencia nueva, máximo 5 MB, JPG/PNG/WebP/PDF; sin sobrescritura ni borrado |

Las revisiones de perfil son parches vinculados, no otro catálogo de empleados.
Editar/Inactivar conserva `workers/{id}` y aplica su revisión al modelo de lectura.
Los proyectos seleccionables corresponden a las unidades existentes; no se
inventan proyectos ni se duplican los catálogos de Django. Cada cierre de cuadrilla
incluye minutos reales de todos sus integrantes, registrados por el Encargado.
Los trabajadores cierran tareas individuales propias. Los registros omitidos
siguen pendientes; no se infieren tiempos por arrastre o permanencia en columnas.

El dominio mantiene los conceptos Task/WorkLog/TaskReview/TaskHistory del proveedor
Django. Firebase conserva IDs de texto y estados `todo/in_progress/review/done`;
Django mantiene su contrato original. No se transfieren automáticamente IDs,
usuarios o datos entre motores. Para usar Django se configura explícitamente
`NEXT_PUBLIC_DATA_SOURCE=django` y su `NEXT_PUBLIC_API_URL` antes de compilar.

## Flujo y permisos

`Por hacer → En curso → Registrar cierre → Por revisar → Aceptar → Finalizado`.
Una devolución motivada regresa a En curso y conserva cierres y revisiones previos.
Bloquear y cancelar conservan columna y razones. Solo el Administrador cancela,
acepta y ve salarios/finanzas. Encargado corresponde a manager/supervisor; el
trabajador ve únicamente tareas con su ID vinculado. Sin vínculo no recibe tareas.
La planificación deja de ser editable después del primer cierre; para otra labor
se duplica exclusivamente el plan, con una tarea e historial nuevos.

Las reglas verifican los mismos permisos y transiciones que el cliente. Cada
transacción incrementa la revisión y crea un evento ligado mediante `getAfter`.
Los reintentos conservan UUID y huella de la operación; un doble clic no duplica
tareas ni cierres. Si la revisión cambió se exige actualizar; no se mueve una tarjeta
visualmente antes de que el servidor confirme. Las tareas cerradas no se reabren
ni borran. No hay almacenamiento offline persistente de datos personales.

La asignación bloquea inactivos en servidor, advierte ausencias y más de 8 h
previstas por persona/día. El detalle advierte más de 8 h reales acumuladas.
Las cantidades solo producen una razón cantidad aceptada/horas explícitas positivas.
Se incluyen los tiempos de cierres previos devueltos. Una cuadrilla presenta
producción grupal por hora-persona; no replica la producción completa por trabajador.
Se distinguen cero, pendiente y no aplica. No hay rankings ni pagos automáticos.

## Pruebas reproducibles

Desde la raíz, con Node 24.12+ y Java 21 en PATH:

```bash
cd apps/web
npm ci
npm test
npm run lint
npm run typecheck
npx --yes firebase-tools@15.34.1 emulators:exec --project demo-workforce-security --config ../../firebase/emulators.json --only firestore,storage "npm run test:firestore"
```

La suite usa exclusivamente el proyecto indicado `demo-*` en loopback. Comprueba
jornada completa, devolución, aceptación, cuadrilla de seis personas, tiempos,
idempotencia, versiones obsoletas, inactivos, permisos, inmutabilidad, evidencias
y conservación de personal/asistencia/finanzas/nómina sintéticos. Nunca apuntar
estas fixtures a `surco-finca` ni cambiar el identificador por un proyecto real.

La prueba de navegador necesita Auth/Firestore emulados y un servidor Next separado
en `127.0.0.1:3004`, con `NEXT_PUBLIC_DATA_SOURCE=firebase`, API vacía y
`NEXT_PUBLIC_FIREBASE_EMULATORS=1`; ejecutar `npm run test:firebase-browser`.
Ese interruptor solo funciona en loopback y `npm run build` lo rechaza. La prueba
crea cuentas sintéticas únicamente en Auth emulado, recorre la jornada, comprueba
USD, historial, modo oscuro, móvil sin desbordamiento y permisos del trabajador.
Para Windows puede usarse `QA_BROWSER_CHANNEL=msedge`.

## Build, publicación y recuperación

La rama `feature/personal-kanban` mantiene PR #2 sobre `chore/environment-setup`,
dependiente de PR #1. No se integra ni se eluden las revisiones de main. Los commits
son convencionales y la versión menor 0.2.0 incorpora funcionalidad compatible.

Compilar desde un commit limpio con `NEXT_PUBLIC_DATA_SOURCE=firebase`, API vacía,
`NEXT_PUBLIC_SITE_URL=https://fincamamasgarden.com`, `BUILD_AUDIT_MAPS=1` y sin el
interruptor de emuladores. Ejecutar `npm run build`,
`node scripts/audit-production.mjs build` y `node scripts/prepare-hosting.mjs`.
Después, desde raíz:

```bash
firebase deploy --config firebase.deploy.json --only firestore:rules,storage,hosting --project surco-finca --non-interactive
```

El despliegue publica reglas y Hosting, no documentos, índices, funciones, usuarios
ni objetos existentes. `/build-info.json` informa SHA, versión, fecha y estado del
árbol; su cabecera no-store permite verificar la publicación exacta. El despliegue
anterior no tenía marcador Git: su release/version de Hosting se puede identificar,
pero no atribuir retrospectivamente un SHA criptográficamente comprobado.

Para rollback de interfaz usar la versión previa de Hosting desde Releases;
conservar todas las colecciones nuevas y evidencia. No restaurar un respaldo sobre
producción ni revertir reglas a una versión que abra finanzas a otros roles.
Si hay operaciones nuevas, corregir hacia adelante y preservar la trazabilidad.

La validación positiva del propietario en producción requiere su contraseña
existente, que no se solicita, cambia ni sustituye. Las pruebas positivas se
ejecutan aisladas; en vivo se verifican publicación, cabeceras, proveedor Auth y
denegación anónima. Esto no constituye firma humana de aceptación operacional.
