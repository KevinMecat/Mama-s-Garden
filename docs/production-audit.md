# Auditoría de preparación — 22 de octubre de 2026

## Alcance y estado

Preparación del repositorio, normas, exclusión de secretos, revisión inicial,
hooks y CI. Este documento no certifica un despliegue de producción.
Stack detectado: Django 5.2, DRF, Next.js 16, React 19, PostgreSQL 17 y Docker.
Git ya existía sin commits en `master`; el remoto respondió sin referencias.
GitHub CLI no tiene sesión iniciada; Git HTTPS puede usar credenciales distintas.

## Controles incorporados

- `.gitignore` global sin excepciones para `.env.*`, con dependencias, builds,
  claves, bases locales, caches y reportes sensibles excluidos.
- Plantilla versionable `config/environment.example` con secretos vacíos.
- `.dockerignore` raíz y frontend para evitar secretos/dependencias en imágenes.
- `CONTRIBUTING.md`, validación de commits/ramas/rutas y hooks locales.
- Script Bash con parada ante errores, remoto inesperado o historial existente.
- CI con permisos de solo lectura, acciones fijadas a commits y Gitleaks 8.30.1
  descargado con checksum SHA-256 verificado. Pruebas API con PostgreSQL aislado;
  lint, tipos y build del frontend.
- ZIP de marca inspeccionado: contiene tres logos y un manual PDF; escaneo con
  archivos comprimidos habilitado. No se incorporan credenciales locales.

## Bloqueos para producción

1. Docker Desktop no tiene motor Linux disponible durante la auditoría: no se
   pudieron validar contenedores ni integración local con PostgreSQL.
2. Compose ejecuta `runserver` y `next dev`, monta fuentes y publica PostgreSQL.
   Preparar configuración de producción independiente con servidor WSGI/ASGI,
   build/start de Next, imágenes de ejecución sin herramientas de desarrollo,
   usuario sin privilegios y base accesible únicamente por red privada.
3. `manage.py check --deploy` con configuración production y entorno local
   reportó `security.W004` (HSTS), `security.W008` (redirección HTTPS) y
   `security.W009` (fortaleza de clave local). Generar una clave propia mediante
   gestor de secretos; configurar TLS, dominio y proxy de confianza antes de
   habilitar redirección/HSTS. No se modificó ni publicó el `.env` local.
4. El esquema OpenAPI tiene 13 advertencias de autenticación, serializers,
   anotaciones y enumeraciones pendientes de resolver.
5. Definir destino, dominio, TLS, almacenamiento persistente de comprobantes,
   copias de seguridad y restauración probada, observabilidad y rollback.
6. Exigir PR, revisión y checks `policy-and-secrets`, `api`, `web` mediante
   protección/ruleset remoto. No está aplicada ni verificada desde esta sesión.
7. Falta una auditoría completa de vulnerabilidades de dependencias/imágenes;
   las versiones Python usan rangos y necesitan una estrategia de bloqueo.

Los hooks fallan si `python` o `gitleaks` no están en PATH. Activar con
`git config core.hooksPath .githooks` en cada clon. Ningún escáner garantiza
ausencia absoluta de secretos, especialmente dentro de binarios.

## Resultados locales

- Backend: 34 pruebas correctas con SQLite en memoria. Esta ejecución no valida
  comportamiento específico de PostgreSQL. El entorno Python local es 3.14.2;
  contenedores/CI declaran 3.13.
- Ruff lint y formato: correctos (74 archivos). Se normalizó formato y finales
  de línea antes del primer commit. Migraciones: sin cambios pendientes.
- Frontend ESLint: correcto. La primera comprobación TypeScript encontró un
  archivo generado inválido en `.next/dev/types/validator.ts`; se preservó el
  directorio de tipos antiguo en `audit-reports/next-dev-types-original` (ignorado).
  El comando ahora genera tipos con `next typegen` antes de comprobarlos para
  que también funcione en clones nuevos. La instalación local carecía de
  `recharts`, declarado en el lockfile; se ejecutó una reinstalación con `npm ci`.
- Gitleaks 8.30.1: sin hallazgos en staged y primer commit, con ZIP habilitado.
- Push inicial a `origin/main` completado y upstream configurado. Commit:
  `b93cd0b97c02f844688169b9b4e781307ea02c81`.
- Primera ejecución remota de CI: `api` y `policy-and-secrets` correctos, con
  pruebas sobre PostgreSQL 17. `web` detectó la falta de generación de tipos en
  un clon limpio; se corrigió el script `typecheck` para ejecutar `next typegen`.
- Verificación posterior del commit `d125133`: los tres jobs (`api`, `web`,
  `policy-and-secrets`) finalizaron correctamente, incluido el build de producción
  del frontend y las pruebas contra PostgreSQL 17.
  Evidencia: https://github.com/KevinMecat/Mama-s-Garden/actions/runs/39887938045
- Gitleaks instalado fuera del repositorio con checksum verificado; el hook usa
  `security.gitleaksPath` local para funcionar sin modificar el PATH del usuario.
