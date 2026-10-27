# Despliegue de producción: fincamamasgarden.com

Requiere un servidor Linux con Docker Compose v2, Python 3, OpenSSL y Certbot,
acceso administrativo y DNS A/AAAA dirigido a ese servidor. El dominio por sí
solo no proporciona acceso al servidor. No ejecutar estas instrucciones contra
un host que aún esté sirviendo otro despliegue sin plan de migración y respaldo.

## Preparar secretos

```bash
umask 077
cp config/production.example .env.production
chmod 600 .env.production
```

Completar el archivo mediante un editor o gestor de secretos. Clave Django:
al menos 64 caracteres aleatorios; contraseña PostgreSQL: al menos 32. Usar
secretos distintos y alfabeto base64url (`A-Z`, `a-z`, `0-9`, `_`, `-`).
`DATABASE_URL=postgresql://USUARIO:CONTRASEÑA@db:5432/BASE` debe coincidir con
los otros valores. No copiar este marcador literal ni imprimir el archivo.
No usar `source`, `set -x`, `docker compose config` sin `--quiet` ni adjuntar
salidas de `docker inspect` con variables del contenedor.

```bash
bash scripts/verify-prod-env.sh --env-file .env.production
docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet
docker compose --env-file .env.production -f docker-compose.prod.yml build
```

`pip` no tiene opción `--no-dev`: Python usa un lock de producción separado,
con hashes y sin requirements-dev. Node instala `npm ci --omit=dev` en una etapa
independiente. Las imágenes finales no heredan ninguna capa del builder con
ESLint, pruebas o compiladores del proyecto. Las herramientas incluidas por la
imagen base del lenguaje no equivalen a dependencias de la aplicación.

## Obtener el primer certificado

Abrir únicamente TCP 80 y 443 en el firewall público; restringir SSH a la red
administrativa. No abrir 3000, 8000 ni 5432. Revisar también registros AAAA.
Los perfiles bootstrap y producción usan el mismo puerto 80: no arrancarlos juntos.

```bash
mkdir -p deploy/acme
docker compose --env-file .env.production -f docker-compose.prod.yml --profile bootstrap up -d acme-bootstrap
sudo certbot certonly --webroot -w "$PWD/deploy/acme" \
  -d fincamamasgarden.com --email CORREO_OPERACIONES --agree-tos --no-eff-email
sudo bash scripts/install-tls.sh fincamamasgarden.com /etc/letsencrypt/live/fincamamasgarden.com
docker compose --env-file .env.production -f docker-compose.prod.yml --profile bootstrap stop acme-bootstrap
```

Sustituir `CORREO_OPERACIONES` por un correo real. La clave privada se copia con
propietario 101:101 y modo 0400; no se cambian permisos del archivo de Certbot.
Nginx escucha sin privilegios en 8080/8443 y Docker publica 80/443.
La excepción HTTP ACME sirve únicamente el desafío; las demás rutas devuelven 301.

## Arranque y verificación

Hacer y verificar backup antes de migraciones sobre una base existente. El
servicio `migrate` ejecuta una sola instancia antes de iniciar los workers.

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --wait --wait-timeout 180
python scripts/verify_https.py fincamamasgarden.com
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T api python manage.py check --deploy --tag security --fail-level WARNING
```

Esta última comprobación se limita a seguridad; las advertencias de esquema
OpenAPI se mantienen separadas. El validador TLS usa confianza pública por
defecto: no usar `--ca` ni `--resolve` para aprobar un sitio real. CI sí los usa
para un certificado efímero, sin contactar el dominio público ni solicitar ACME.

Verificar login/logout, permisos, carga y descarga de comprobantes y ventas con
un usuario de prueba autorizado. `/media/` público devuelve 404; las descargas
requieren sesión y pertenencia al proyecto. La PWA solo almacena activos
estáticos y una página offline sin datos; no almacena HTML con nonces ni API.
Todos los subdominios deben soportar HTTPS antes de aprobar includeSubDomains.
El token `preload` no inscribe automáticamente el dominio en listas de navegadores.

## Renovación, continuidad y rollback

Configurar Certbot en el host con deploy hook absoluto:

```bash
sudo certbot renew --dry-run
sudo certbot renew --deploy-hook "$PWD/scripts/renew-tls.sh"
```

Guardar el deploy hook en `/etc/letsencrypt/renewal-hooks/deploy/` o en la
configuración de renovación del dominio, con la ruta absoluta del checkout;
activar y comprobar `certbot.timer` en distribuciones que lo proporcionan.
No instalar ambos mecanismos a la vez. Monitorizar expiración externa a 30 días,
la ejecución del timer y el resultado del hook. Probar `renew-tls.sh` y verificar
que Nginx recarga el nuevo certificado sin detener sesiones.

Usar `IMAGE_TAG=<sha-de-release>` al construir y registrar digests de todas las
imágenes. Las bases actuales están fijadas por digest; revisar sus actualizaciones
y vulnerabilidades al aprobar cada release.
Conservar las imágenes previas y backups cifrados fuera del host, incluidos
PostgreSQL y el volumen `media`. Probar restauración; el rollback de imagen no
revierte automáticamente migraciones. No usar `down --volumes` en producción.
CI usa esa opción únicamente en su base y volúmenes efímeros aislados.

## Protección de main

En GitHub: **Settings → Branches → Add classic branch protection rule**,
patrón `main`:

1. Require a pull request before merging; al menos una aprobación independiente.
2. Dismiss stale pull request approvals; Require approval of the most recent
   reviewable push; Require conversation resolution before merging.
3. Require status checks to pass y Require branches to be up to date.
   Seleccionar los checks exactos: `api`, `web`, `policy-and-secrets`,
   `conventional-pr`, `production-security` (tras su primera ejecución).
4. Require linear history; Do not allow bypassing the above settings, incluidos
   administradores. Mantener desactivados force pushes y deletions.
5. Guardar/Create. En **Settings → General → Pull Requests**, permitir solo
   squash merge y configurar el título del PR como título del commit squash.

Requiere permisos administrativos y una segunda persona autorizada para revisar;
el autor no puede aprobar su propio PR. Los nombres aparecen después de ejecutar
CI en el PR. No marcar esta gobernanza como aplicada hasta guardar y verificar
la regla remota. El workflow de PR procesa entradas mediante variables de entorno,
no las interpola como código de shell, y carece de permisos de escritura.
