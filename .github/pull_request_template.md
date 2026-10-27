## Cambio

<!-- Título: tipo(scope): descripción concisa en minúsculas -->
- Tipo: <!-- feat | fix | refactor | docs | chore | style | test | perf -->
- Scope: <!-- root | ui | api | auth | db | docker | config | workforce -->
- Problema y comportamiento resultante:
- Riesgos, migraciones y rollback:

## Validación y seguridad

- [ ] Rama `feat/`, `feature/`, `fix/` o `chore/` con tarea kebab-case; título y commits válidos.
- [ ] Sin `.env`, credenciales, claves privadas, datos personales ni dumps.
- [ ] Pruebas locales, Ruff, lint, tipos y build correctos; adjunto evidencia.
- [ ] Gitleaks revisó el historial completo y archivos comprimidos.
- [ ] Preflight de producción rechaza secretos débiles sin mostrarlos.
- [ ] Auditorías de dependencias e imágenes cubren los artefactos modificados.
- [ ] Runtime y mapas/trazas del build excluyen las cinco dependencias de desarrollo.
- [ ] TLS, redirección, HSTS, CSP y cookies comprobados o pendientes explícitos.
- [ ] Informe de auditoría actualizado; excepciones con responsable y vencimiento.
- [ ] Backups y rollback probados antes de migraciones de producción.

## Aprobación

<!-- Una casilla no sustituye la revisión de un responsable identificado. -->
Revisor técnico:
Responsable de seguridad:
Evidencia CI / digest de imágenes:
