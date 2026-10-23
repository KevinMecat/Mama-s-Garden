# Contribuir a Finca Mama's Garden

Stack: Django/DRF (`apps/api`), Next.js/React/TypeScript (`apps/web`), PostgreSQL
y Docker Compose. Rama principal: `main`.

## Commits

Aplicamos [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
con alcance obligatorio y descripción concisa en minúsculas:
`<tipo>(<alcance>): <descripción>`. Prohibidos `initial commit` y `first commit`.

| Tipo | Uso | Ejemplo |
| --- | --- | --- |
| feat | Funcionalidad | `feat(ui): agregar panel de producción` |
| fix | Corrección | `fix(auth): validar sesión para registrar ventas` |
| refactor | Reorganización sin cambio funcional | `refactor(api): extraer servicio de nómina` |
| docs | Documentación | `docs(root): documentar instalación de la finca` |
| chore | Mantenimiento e infraestructura | `chore(docker): configurar servicios locales` |
| style | Formato sin cambio funcional | `style(ui): normalizar formato del dashboard` |
| test | Pruebas | `test(db): verificar transacciones de ventas` |
| perf | Rendimiento | `perf(api): reducir consultas de proyectos` |

Lista fija de alcances válidos: `root`, `ui`, `api`, `auth`, `db`, `docker`, `config`.
Modificarla requiere actualizar esta guía y el validador en el mismo PR.
Cuerpo opcional separado por línea vacía. Para cambios incompatibles, usar el pie
`BREAKING CHANGE: ...`, conservando la cabecera estricta.
Primer commit: `chore(root): initialize project structure and setup`.

## Ramas

Aplicamos [Conventional Branch 1.1.0](https://conventionalbranch.org/) con el perfil
estricto `<tipo>/<nombre-tarea-kebab-case>`. Tipos permitidos: `feat`, `fix`, `chore`.
Documentación, pruebas y refactorización usan ramas `chore/` y su tipo de commit
correspondiente. `main` es la única excepción al prefijo.
Solo letras ASCII minúsculas, números y guiones simples. Prohibidos espacios,
tildes, puntos, guiones bajos, guiones consecutivos y guiones en los extremos.
Ejemplos: `feat/registro-cosechas`, `fix/calculo-nomina`, `chore/environment-setup`.

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/registro-cosechas
git config core.hooksPath .githooks
```

Abrir PR hacia `main`, solicitar revisión y exigir verificaciones correctas.
El título del PR debe cumplir el formato de commit para permitir squash.
No forzar pushes a `main`. Configurar protección en GitHub con revisión y CI
obligatorios; los hooks locales pueden omitirse y no sustituyen controles remotos.

## Entorno y pruebas

Copiar `config/environment.example` a `.env`. Generar clave Django y contraseña
PostgreSQL propias, completar `DATABASE_URL` y conservarlas fuera de Git.
Todos los `.env.*`, incluso `.env.example`, están excluidos sin excepciones.
Requisitos: Python 3.13, Node 24, Docker y Gitleaks 8.30.1. Los hooks requieren
`python` y `gitleaks` en PATH; en Windows, usar Git Bash.
Si Gitleaks está fuera de PATH, configurar su ruta local con
`git config security.gitleaksPath /ruta/absoluta/gitleaks`.

```bash
docker compose up --build -d db
docker compose run --rm api python manage.py migrate
docker compose up --build -d
docker compose exec -T api python manage.py check
docker compose exec -T api pytest
docker compose exec -T api ruff check .
docker compose exec -T api ruff format --check .
docker compose exec -T web npm run lint
docker compose exec -T web npm run typecheck
docker compose exec -T web npm run build
```

## Seguridad pre-push

```bash
git status --short
git diff --cached --stat
python scripts/check_repository.py
git diff --cached --no-ext-diff --binary | gitleaks stdin --redact --no-banner
gitleaks git . --redact --no-banner --log-opts="--all"
```

Revisar también binarios y ZIP: ningún escáner garantiza ausencia absoluta de
secretos. Ante hallazgos, detener el push, revocar/rotar las credenciales y sanear
todos los commits afectados. `.gitignore` no elimina archivos del historial.
Ver `docs/production-audit.md` antes de desplegar: Compose es de desarrollo.
