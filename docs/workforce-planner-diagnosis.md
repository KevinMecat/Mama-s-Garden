# Diagnóstico inicial: planificación y asistencia

Fecha: 2026-10-27. Rama de trabajo: `feature/workforce-planner`, creada desde
`feature/personal-kanban`. El estado en producción debe consultarse en
`/build-info.json`; la referencia a la versión 0.2.0 del encargo es anterior a
las mejoras de asistencia ya entregadas.

## Estado existente

- La asistencia consolida los documentos históricos con revisiones nuevas en
  `workforce_attendance`; cada revisión genera un evento ligado e inmutable.
  El historial conserva sus versiones y las reglas impiden cambios en semanas
  con planilla cerrada. La pantalla muestra fotos, presencia, ausencia y horas.
- La hora automática se obtiene del reloj del navegador en `America/Managua`;
  el campo `updatedAt` y la fecha del evento proceden de `serverTimestamp`.
  Por tanto, la hora mostrada de entrada/salida no está garantizada por el
  servidor y no debe presentarse como tal. La fuente fiable necesita un diseño
  que use un instante confirmado de servidor para cada marcación, sin modificar
  las jornadas históricas y manteniendo el control de conflictos.
- Los estados disponibles son presente, tarde, medio día y ausencia con una
  marca de justificación. No distinguen permiso, incapacidad o descanso programado.
- El tablero cuenta con cuatro columnas, prioridad, ubicación, unidad, cuadrilla,
  meta, evidencias, bloqueos, revisión y cantidad de cuadrilla. El envío de un
  registro actualmente mueve la tarea a revisión: falta separar avances parciales
  de solicitud de revisión. Las reglas enumeran expresamente los campos y las
  transiciones válidas, por lo que cualquier ampliación necesita reglas y pruebas.
- No hay matriz de competencias, horarios previstos, compromisos fijos,
  inventario de herramientas, dependencias entre tareas ni fechas de hitos. No es
  seguro inferirlos de nombres o asignaciones históricas para producir propuestas.
- El árbol actual contiene una prueba preexistente que exige que `firebase-client`
  sea de solo lectura, aunque desde la restauración de movimientos contiene una
  operación de creación. La discrepancia debe resolverse mediante pruebas de
  permisos y creación aisladas, no eliminando la comprobación sin reemplazarla.

## Diseño y criterios de aceptación pendientes

1. Introducir marcaciones de servidor y cambios de estado compatibles con datos
   anteriores. Las correcciones deben incluir antes/después, motivo, autor y fecha;
   una salida pendiente debe ser visible sin asignar una hora ficticia.
2. Ampliar tarea e historial con avances parciales inmutables y revisión final
   separada. Respetar las restricciones de acceso y evitar duplicar cantidades de
   cuadrilla. Probar conflictos de revisión y reintentos idempotentes.
3. Registrar competencias y disponibilidad explícitas, con permisos de edición y
   tratamiento de valores desconocidos como desconocidos, no como capacidades.
4. Resolver el modelo en un Web Worker con tiempo límite, y distinguir óptimo,
   factible, inviable y tiempo agotado. Para garantizar que herramientas no se
   solapen, hacen falta intervalos o bloques de tiempo; un límite de horas total
   por herramienta no demuestra ausencia de solapamiento. Las asignaciones fijas
   deben ser inmutables en la propuesta y su aplicación debe validar revisiones
   en una transacción y ser idempotente.
5. Añadir dependencias e hitos con detección de ciclos y cálculo CPM, indicando
   hipótesis de duración, calendario y fecha de inicio.
6. Probar con fixtures y emuladores aislados, verificar copias y recuperación
   antes de tocar datos o reglas reales y confirmar que Hosting corresponde al
   commit validado. El despliegue no implica verificar un inicio de sesión real
   si no se dispone de credenciales autorizadas.

Para un motor MIP en navegador se evaluará [javascript-lp-solver](https://github.com/JWally/jsLPSolver),
que documenta soporte para MIP y Web Workers. Su instalación, resultados y tiempo
de respuesta deben medirse sobre el modelo y dispositivos objetivo.

## Prototipo aislado

Se añadió un experimento de asignación por bloques de media hora con una prueba
sintética para capacidad, prioridad, ausencia, acompañamiento y herramienta
compartida. No lee Firestore, no aplica propuestas y no está integrado en la
interfaz. No implementa aún jornadas fijas, fragmentación, diagnóstico de cuellos
de botella ni control externo de tiempo mediante Web Worker. Su salida no afirma
optimalidad: debe considerarse experimental y no usarse para decisiones reales.
