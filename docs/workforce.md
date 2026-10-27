# Personal y trabajo: diagnóstico e integración

Fecha: 27 de octubre de 2026. Base: ab045fae9145afee70cf7ca2d2d6b19dd1487d5f,
chore/environment-setup. main está en a9420ea y el PR #1 contiene infraestructura
y exportación estática necesarias. Este cambio es un PR apilado sobre esa rama;
requiere integrar #1 antes de retargetear a main.

Frontend publicado: Firebase Hosting, sitio surco-finca, fincamamasgarden.com.
La publicación conocida corresponde al build ab045fa; la API está deshabilitada
mediante NEXT_PUBLIC_API_URL vacío. No se identificó un backend de producción
accesible ni evidencia de backup/restauración. PostgreSQL es el motor previsto;
comprobantes usan storage privado de Django y volumen media en Docker.
No se ejecutarán migraciones ni despliegues reales sin verificar esos requisitos.

Modelos existentes: Employee no tiene cuenta de usuario; ProjectMember limita los
proyectos visibles a WORKER. Solo existen ADMIN y WORKER, no encargado independiente.
WorkEntry registra presencia por día, sin horas; PayrollPeriod y sus líneas
aprobadas/pagadas deben permanecer intactas. El módulo no escribirá en esas tablas.

Secuencia: (1) política y dependencia; (2) modelos nuevos, API y permisos;
(3) tres vistas móviles y acciones accesibles; (4) transiciones, conservación y
pruebas de migración aislada; (5) evidencia, PR y despliegue solo con respaldos verificados.
Los modelos nuevos reutilizarán empleados/proyectos y un vínculo explícito opcional
empleado-cuenta. Ningún vínculo histórico se inferirá ni rellenará automáticamente.

Los scripts de pruebas solo apuntarán a bases temporales; no se borrarán volúmenes,
archivos ni registros reales. No hay política de releases/versionado formal distinta
del package 0.1.0 privado: no se modifica esa versión sin release aprobada.
