# Trabajo del personal: diseño, pruebas y entrega

## Punto de partida y fuente de verdad

27 de octubre de 2026. Base: `ab045fae9145afee70cf7ca2d2d6b19dd1487d5f`,
`chore/environment-setup`. `main` estaba en `a9420ea`; PR #1 contiene la
infraestructura y exportación estática necesarias. PR #2 está apilado sobre esa
rama para mantener separado este módulo. Integrar primero #1 y después cambiar
la base de #2 a main, conservando los commits compartidos, sin rebase/force push.

El usuario confirmó que Django/PostgreSQL es la fuente de verdad definitiva y
que no existe API ni base operativa de producción en línea. Los recursos
Firestore/Storage de surco-finca son preliminares y NO se integran, importan ni
modifican. No se transfirieron datos entre motores.

La inspección de solo lectura encontró `.env` con destino PostgreSQL local/Compose,
Docker detenido, ningún archivo SQLite del proyecto y carpeta local media vacía.
No se abrió ni modificó el PostgreSQL local. La ubicación de cualquier dato local
previo debe confirmarse antes de encender o migrar ese entorno.

La publicación Firebase conservada es `sites/surco-finca/versions/c2844b9a87a7554d`,
release `1793074077668000`, de 2026-10-27 04:07:57 UTC (26 de octubre, 22:07:57
Guatemala). Su SHA de implementación conocido es `ab045fa`; el servicio de Hosting
no almacena por sí mismo una relación verificable Git-SHA. Este módulo NO se ha
desplegado. NEXT_PUBLIC_API_URL continúa vacío en la publicación conocida.

No existe política formal de releases adicional al package privado 0.1.0; no se
cambia esa versión ni se inventa un release SemVer.

## Integración y contrato

Rutas estáticas conectadas:

- `/dashboard/workforce`: trabajo de hoy, tablero y asignaciones.
- `/dashboard/workforce/close`: resultados, tiempos e incidencias de la jornada.
- `/dashboard/workforce/history`: historial filtrado por trabajador, fecha y proyecto.

API nueva: `/api/v1/workforce/tasks/`, detalle `{id}/`, acciones `{id}/command/`,
`options_data/` y `link_account/`. Listado paginado, 50 tareas por página; filtros
`date`, `from`, `to`, `employee`, `project`. Ningún endpoint elimina físicamente
una tarea o un resultado.

Tablas nuevas, migraciones `workforce/0001_initial` y `0002_worklog_work_date`: Task, Assignment,
EmployeeAccount, WorkLog, TimeEntry, Review, TaskEvent y Operation. Todas las
relaciones reutilizan Employee, User y Project. Los vínculos históricos no se
infieren: el administrador vincula explícitamente una cuenta WORKER con un
empleado y comprueba previamente sus membresías de proyecto. Ese vínculo no se
reasigna desde la API, preservando la atribución histórica.

Las migraciones crean las tablas del módulo y añaden fecha opcional a WorkLog;
no alteran ni rellenan las tablas del dominio preexistente. La fecha opcional
no inventa valores para entregas ya registradas. La validación de FK puede requerir bloqueos breves de las tablas
referenciadas: ensayar en copia del entorno destino y usar una ventana controlada.
No se proporciona una estimación de tiempo para una base real no examinada.

### Estados y revisión

Por hacer → En curso → Por revisar → Finalizado. Una devolución vuelve a En curso
sin borrar el registro anterior. Bloqueo y cancelación conservan el estado previo
y exigen motivo. Un trabajo aceptado no se cancela ni se reabre desde esta API.
La planificación deja de ser editable cuando hay resultados; duplicarla crea
una nueva tarea, conservando únicamente la planificación y sus responsables.

Enviar a revisión requiere resultado, cumplimiento declarado y tiempo real.
Si existe meta numérica, se exige cantidad realizada, admitiendo cero. Aceptar
requiere administrador, criterio cumplido, observaciones, tiempos de todos los
integrantes y cantidad aceptada no superior a la realizada. Para labores sin
cantidad, la cantidad aceptada y la productividad permanecen no aplicables.
Cada revisión guarda revisor, fecha y observaciones; las devoluciones y
correcciones permanecen consultables.

Cada operación requiere UUID `key`; la misma clave/cuerpo devuelve el resultado
existente, mientras reutilizar una clave con otro cuerpo devuelve 409. Los cambios
exigen `revision`; PostgreSQL bloquea la fila y rechaza revisiones desactualizadas.
No se mueve una tarjeta de forma optimista: un rechazo mantiene el último estado
confirmado. Botones deshabilitados y bloqueo síncrono evitan doble envío; un fallo
de red conserva la clave para reintentar sin duplicar.

### Cuadrillas, asistencia y métricas

La cantidad pertenece una sola vez al resultado compartido. Cada integrante
registra únicamente su tiempo, o el administrador registra los tiempos reales de
todos. No se acepta la revisión mientras falten tiempos de la cuadrilla.
La pantalla indica tiempo del equipo; nunca atribuye su cantidad completa a cada
persona ni calcula productividad individual para una cuadrilla.

Solo para tareas individuales numéricas: cantidad aceptada / horas reales,
incluyendo tiempo dedicado a correcciones. Cero aceptado es cero; sin aceptación,
sin horas o sin unidad comparable es pendiente/no aplicable. No se suman tareas
incompatibles ni se construyen rankings, porcentajes de eficiencia o predicciones.
Comparar requiere misma actividad, unidad, proyecto y condiciones verificadas.

Cada resultado tiene fecha real de trabajo, separada de la fecha planificada; no se
rellena retrospectivamente en registros anteriores. Cierre de jornada incluye
trabajos planificados o realizados en la fecha elegida y suma solo sus minutos.
La cantidad del resultado es el total acumulado de la tarea; cada entrega o
corrección añade solo minutos nuevos, sin repetir los ya declarados.

Asistencia se consulta en WorkEntry, sin escribir allí. Se advierte ausencia,
asistencia pendiente, proyecto distinto, empleado inactivo y exceso de tiempo.
`WORKFORCE_DAY_MINUTES` (480 por defecto) es referencia de planificación por persona,
ponderada por la fracción de asistencia; no es una regla salarial. Se suma el
estimado por persona entre tareas pendientes y el tiempo declarado entre resultados.
Una advertencia no modifica asistencia cerrada, tarifas ni planillas, y el reloj
entre movimientos nunca se convierte en horas trabajadas ni genera pagos.

### Permisos

| Operación | ADMIN | WORKER |
| --- | --- | --- |
| Crear/editar/duplicar/cancelar, vincular cuenta | Sí | No |
| Leer tareas y resultados | Todas | Solo asignadas y con membresía al proyecto |
| Iniciar, bloquear/desbloquear, enviar resultado | Sí | Sus tareas autorizadas |
| Registrar tiempo | Responsables de la tarea | Solo su propio tiempo |
| Aceptar o devolver | Sí | No |
| Consultar salarios desde este módulo | No los expone | No los expone |

El sistema no tiene rol Encargado; no se inventa un nuevo rol ni se amplían
permisos financieros. `options_data` del trabajador solo devuelve su empleado y
sus proyectos, sin cuentas ajenas, salarios ni tarifas.

## Pruebas ejecutadas

- Local: suite completa 51 correctas y 2 omitidas (bloqueos de fila requieren
  PostgreSQL, no SQLite). Tras añadir nombres legibles de actores, las 16 pruebas
  del módulo siguieron correctas; dos de concurrencia permanecieron omitidas localmente.
- Remoto final, SHA `9668fcc`: 55 correctas con PostgreSQL, incluidas concurrencia de
  comandos con claves iguales y distintas, permisos y migración con datos existentes.
- Remoto quality [40541898308](https://github.com/KevinMecat/Mama-s-Garden/actions/runs/40541898308):
  3 E2E correctas en Chromium, junto con API, web y policy-and-secrets.
  [Producción 40541898522](https://github.com/KevinMecat/Mama-s-Garden/actions/runs/40541898522),
  Hosting y PR lint también correctos en ese SHA, incluidas migraciones, TLS y media privada.
- Local tras la corrección de fechas: 18 pruebas del módulo correctas y dos de
  concurrencia omitidas por SQLite; E2E final nuevamente 3 correctas.
- E2E local automatizado: 3 pruebas correctas en Edge, Django temporal y Next dev:
  jornada completa, revisión, teclado, escritorio/móvil, tres vistas, conflicto
  simultáneo, arrastre, duplicación, error/reintento de conexión, vacío y restricciones.
- Revisión visual local a 1440 px y 390 px; sin desbordamiento horizontal móvil.
- Lint, TypeScript, seguridad del cliente API, Ruff y 5 pruebas del validador de entorno.
- Build auditado final: 323 mapas y 2 trazas; Hosting preparado con 32 HTML y
  32 hashes CSP. Se retiraron mapas públicos. Esta preparación no se desplegó.
- Auditorías npm completa y de producción: cero hallazgos.
- Gitleaks sobre historial y diff de cada incremento antes del push.

La prueba de migración crea datos sintéticos representativos en el esquema anterior
(empleado, tarifa, asistencia, planilla pagada, líneas, gasto, transacción, proyecto y
comprobante). Compara todos sus campos, PK/FK e importes después de migrar, y verifica
el hash del archivo. Ningún vínculo empleado-cuenta se rellena automáticamente.
Esto prueba conservación sobre fixtures; NO equivale a restaurar un respaldo real.

La prueba de navegador vive en `apps/web/e2e/workforce.spec.ts` y se ejecuta también
en el job `workforce-browser` de quality. No publica artifacts con datos.

Para repetir E2E en Windows, desde apps/web:

```powershell
$env:QA_PYTHON = (Resolve-Path ../../.venv/Scripts/python.exe).Path
$env:QA_BROWSER_CHANNEL = 'msedge'
npm.cmd ci
npm.cmd run test:e2e
```

En Linux: instalar requirements-dev.txt, npm ci y `npx playwright install --with-deps
chromium`; ejecutar npm run test:e2e. El harness exige --confirm-isolated, crea su
propia base temporal y media temporal, fuerza settings locales y solo escucha
127.0.0.1:8218; Next usa 127.0.0.1:3002. No reutiliza servidores ni bases existentes.
La contraseña de fixtures solo tiene sentido dentro de ese proceso efímero.

## Respaldo y recuperación antes de un entorno real

Estado: NO se realizó ni verificó respaldo/restauración de datos operativos. Según
la aclaración del usuario no hay entorno operativo en línea; no se inventa uno.
Para cualquier PostgreSQL local existente se necesita acceso al Docker/servidor
con su volumen original, referencia inequívoca de la base y ubicación/montaje de
media. No iniciar contenedores con un volumen nuevo como sustituto.

Antes del primer cambio sobre datos existentes:

1. Registrar entorno, propietario, versión y montajes persistentes sin secretos.
2. Hacer backup consistente de PostgreSQL y media; cifrar y restringir acceso fuera
   del repositorio, cachés del proyecto y artifacts de CI. Credenciales mediante
   archivo de servicio/contraseña privado o gestor de secretos; nunca en comandos/logs.
3. Restaurar en una base nueva y aislada y un directorio/storage privado separado.
   Comprobar filas, PK/FK, importes y archivos/hashes. Conservar acta privada de fecha,
   alcance, responsables y resultado; este documento solo registra su estado.
4. Aplicar la migración a esa copia y repetir las comparaciones y pruebas de lectura.
5. Solo tras aprobar, desplegar primero API compatible y después frontend. Evitar
   acciones de creación/modificación/borrado de registros como prueba de producción.

Ejemplos orientativos, NO ejecutados; ambos servicios deben estar confirmados y
el de restauración debe apuntar a una base vacía creada exclusivamente para la prueba:

```bash
pg_dump --format=custom --file "$PRIVATE_BACKUP/database.dump" --dbname 'service=confirmed-source'
pg_restore --exit-on-error --single-transaction --no-owner --no-privileges   --dbname 'service=isolated-restore' "$PRIVATE_BACKUP/database.dump"
```

No usar clean, flush, DROP/TRUNCATE ni eliminar volúmenes. Los archivos media se
respaldan/restauran aparte mediante el procedimiento del almacenamiento confirmado.
No restaurar automáticamente un backup antiguo sobre la base actual.

Rollback compatible: volver al frontend anterior y, si hace falta, a la API anterior;
conservar las tablas nuevas y todo su historial. No revertir la migración eliminando
tablas de trabajo. Si ya hay nuevas operaciones, preferir una corrección hacia adelante.

## Integración y publicación pendientes

main exige 1 aprobación, aprobación del último push y revisión de CODEOWNERS cuando
aplique; enforce_admins está activado. No se elude esa protección. El usuario debe
obtener la revisión de un colaborador autorizado antes de integrar #1 y #2.
El PR es el resultado concreto revisable; no se afirma que esté integrado o desplegado.

Para publicar funcionalidad operativa: confirmar destino y respaldos si existen datos,
ensayar la migración, desplegar Django/PostgreSQL y storage privado, validar CORS/CSRF
y permisos, configurar NEXT_PUBLIC_API_URL, recompilar y desplegar Hosting mediante
el workflow revisado. El frontend estático sin API permanece deliberadamente sin login.
Límites: no se añaden chat, adjuntos de tareas, tarifas, pagos, optimizadores ni
importación de Firestore. Solo datos de trabajo y revisión.


Firma de preparación técnica: Codex, 27 de octubre de 2026. Evidencia sintética y
checks indicados; no representa aprobación humana ni certificación de un backend
operativo todavía inexistente. main requiere la revisión humana descrita arriba.
