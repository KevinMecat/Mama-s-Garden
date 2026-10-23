# Fase 3: proyectos y centros de costos

## Regla de dominio

`Project` es el centro de costos obligatorio de la aplicación. Los módulos financieros y productivos exigen un proyecto para cada operación. Todos los proyectos son creados y administrados por el usuario desde el panel.

La separación entre inversión y gasto operativo se implementará en Finanzas. El costo unitario productivo se calculará solo con gastos operativos; las inversiones permanecerán diferenciadas para el ROI.

## Modelo

- `Project`: código UUID inmutable, nombre, descripción, tipo, estado, fechas y marca de sistema.
- `ProjectMember`: relación única entre un usuario y un proyecto. Define qué centros de costos puede consultar un trabajador.
- La fecha de finalización no puede ser anterior a la fecha de inicio; la regla existe en validación y en PostgreSQL.

## Proyecto del sistema

El sistema no crea proyectos automáticamente ni reserva proyectos del sistema.

## API

| Método | Ruta | Acceso | Propósito |
| --- | --- | --- | --- |
| GET | `/api/v1/projects/` | Autenticado | Listar proyectos visibles |
| POST | `/api/v1/projects/` | `ADMIN` | Crear un proyecto |
| GET | `/api/v1/projects/{id}/` | Autenticado | Consultar un proyecto visible |
| PUT/PATCH | `/api/v1/projects/{id}/` | `ADMIN` | Editar un proyecto |
| DELETE | `/api/v1/projects/{id}/` | `ADMIN` | Eliminar un proyecto no esencial |

Los administradores consultan todos los proyectos. Los trabajadores solo reciben proyectos asignados en `ProjectMember`. El filtro opcional `?status=active` limita el listado por estado.

## Frontend

- `/dashboard`: entrada privada después del login.
- `/dashboard/projects`: tarjetas alimentadas por la API, sin datos simulados en React.
- `/dashboard/projects/new`: formulario exclusivo para administradores.
- Las rutas privadas se validan contra `GET /api/v1/auth/me/` desde Server Components y cada operación vuelve a autorizarse en Django.
- El service worker nunca guarda respuestas de `/dashboard`, `/api` o `/media`.

## Política de datos

No existen semillas ni fixtures. La tabla inicia vacía y se gestiona desde el dashboard.
