# Finca Mama's Garden

Aplicacion web para la gestion operativa y financiera de la finca.

## Stack

- Django 5.2 LTS y Django REST Framework
- Next.js 16, React y TypeScript
- PostgreSQL
- Docker Compose

## Desarrollo

1. Copiar `config/environment.example` como `.env` y completar las credenciales y `DATABASE_URL`.
2. Ejecutar `docker compose up --build -d db`.
3. Ejecutar `docker compose run --rm api python manage.py migrate`.
4. Ejecutar `docker compose up --build -d`.

La API de salud queda disponible en `http://localhost:8000/api/v1/health/` y, mediante el proxy de Next.js, en `http://localhost:3000/api/v1/health/`.

## Servicios locales

- Aplicacion web y PWA: `http://localhost:3000`
- Inicio de sesion: `http://localhost:3000/login`
- Dashboard privado: `http://localhost:3000/dashboard`
- Proyectos: `http://localhost:3000/dashboard/projects`
- Finanzas: `http://localhost:3000/dashboard/finance`
- Productos: `http://localhost:3000/dashboard/products`
- Producción: `http://localhost:3000/dashboard/production`
- Ventas: `http://localhost:3000/dashboard/sales`
- Personal: `http://localhost:3000/dashboard/employees`
- Asistencia: `http://localhost:3000/dashboard/attendance`
- Nómina: `http://localhost:3000/dashboard/payroll`
- API Django directa: `http://localhost:8000`
- Administracion Django: `http://localhost:8000/admin/`
- PostgreSQL: `localhost:5432`

La API usa el puerto `8000` tanto dentro de Docker como en el host. Entre contenedores, Next.js accede a Django mediante el nombre DNS del servicio: `http://api:8000`.

## Verificacion

```powershell
docker compose ps
docker compose exec -T api python manage.py check
docker compose exec -T api pytest
docker compose exec -T api ruff check .
docker compose exec -T api ruff format --check .
docker compose exec -T web npm run lint
docker compose exec -T web npm run typecheck
```

Para detener el entorno sin borrar la base de datos:

```powershell
docker compose stop
```

La PWA registra su service worker en builds de produccion. El shell publico puede almacenarse para uso sin conexion, pero las rutas `/api/` y `/media/` nunca se guardan en cache.

## Usuarios y roles

Para crear un administrador local:

```powershell
docker compose exec api python manage.py createsuperuser
```

Los usuarios normales reciben el rol `Trabajador` y los superusuarios reciben `Administrador`. El flujo y los endpoints se documentan en `docs/architecture/phase-2-auth.md`.

## Proyectos y centros de costos

Los proyectos se crean, editan y eliminan exclusivamente desde el panel. El sistema no crea proyectos automáticos. El contrato del módulo se documenta en `docs/architecture/phase-3-projects.md`.

## Finanzas y comprobantes

Las categorías financieras se administran desde el panel y no existen registros precargados.

Los comprobantes se guardan localmente en `apps/api/media/` durante desarrollo. El modelo utiliza el almacenamiento predeterminado de Django para permitir el cambio futuro a S3 sin modificar el dominio financiero. Consulta `docs/architecture/phase-4-finance.md` para el contrato completo.

## Producción y ventas

El catálogo, la producción y las ventas comienzan vacíos. Cada venta genera un ingreso financiero vinculado; editarla o anularla actualiza esa transacción de forma atómica. Las métricas de proyecto se calculan en tiempo real. Consulta `docs/architecture/phase-5-production.md`.

## Personal y nómina

Empleados, tarifas, asistencia y períodos comienzan vacíos. La asistencia exige un proyecto y la planilla pagada crea un gasto operativo contabilizado por cada proyecto involucrado. Consulta `docs/architecture/phase-6-payroll.md`.
