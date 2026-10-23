# Fase 2: autenticacion y RBAC

## Flujo de sesion

1. El navegador solicita `GET /api/v1/auth/csrf/`.
2. Django entrega un token CSRF y establece la cookie CSRF.
3. Next.js envia correo, contrasena y `X-CSRFToken` a `POST /api/v1/auth/login/`.
4. Django valida las credenciales, rota la sesion y establece `finca_sessionid` como cookie HttpOnly.
5. El frontend consulta `GET /api/v1/auth/me/` para representar el usuario actual.
6. `POST /api/v1/auth/logout/` invalida la sesion en el servidor y elimina la cookie.

Las credenciales y decisiones de permisos pertenecen siempre al backend. El frontend solo adapta la interfaz a la respuesta segura del servidor.

## Endpoints

| Metodo | Ruta | Acceso | Proposito |
| --- | --- | --- | --- |
| GET | `/api/v1/auth/csrf/` | Publico | Obtener el token CSRF |
| POST | `/api/v1/auth/login/` | Publico + CSRF | Crear una sesion |
| GET | `/api/v1/auth/me/` | Autenticado | Consultar el usuario actual |
| POST | `/api/v1/auth/logout/` | Autenticado + CSRF | Cerrar la sesion |

## Roles

- `ADMIN`: administrador con control total. Los superusuarios reciben este rol automaticamente.
- `WORKER`: trabajador con acceso operativo limitado. Es el rol predeterminado de nuevos usuarios normales.

Los permisos reutilizables viven en `modules/accounts/permissions.py`. Cada endpoint futuro debe aplicar su permiso en Django aunque el frontend tambien oculte acciones no autorizadas.

## Controles de seguridad

- Sesiones persistidas por Django en PostgreSQL.
- Cookie de sesion HttpOnly y SameSite Lax.
- Cookies Secure habilitadas por la configuracion de produccion.
- CSRF obligatorio para login, logout y futuras mutaciones con sesion.
- Respuestas de autenticacion sin cache.
- Mensaje generico para credenciales incorrectas.
- Limite de diez intentos de login por minuto mediante throttling de DRF.

## Crear administradores

Ejecutar el comando interactivo para que la contrasena no quede en el historial ni en archivos:

```powershell
docker compose exec api python manage.py createsuperuser
```

Los trabajadores pueden crearse desde el panel `/admin/` y asignarse al rol `Trabajador`.
