# Firebase Hosting: frontend estático

Proyecto y sitio: `surco-finca`. Dominio: <https://fincamamasgarden.com>.
El frontend completo se exporta desde Next.js a `apps/web/out`; Firebase no
ejecuta Node, Django, Server Actions ni código de servidor de Next.js.

## Configuración de la API

`config/frontend.example` contiene exclusivamente parámetros públicos de build.
`NEXT_PUBLIC_API_URL` debe ser el **origen HTTPS** de Django, sin `/api`, ruta,
credenciales, query ni fragmento; por ejemplo `https://api.fincamamasgarden.com`
cuando ese servidor exista. El valor vacío activa la demostración local descrita en [demo-mode.md](demo-mode.md). El login acepta credenciales públicas de ejemplo y no envía solicitudes a una API. Con un origen configurado se usa exclusivamente Django, sin fallback ante errores. Nunca poner claves o tokens en variables `NEXT_PUBLIC_*`.

En GitHub: Settings → Secrets and variables → Actions → Variables → New
repository variable → `NEXT_PUBLIC_API_URL`. Después, ejecutar el workflow
`firebase-hosting` sobre `main` o publicar un cambio en esa rama. Cambiar una
variable sin recompilar no modifica el JavaScript ya desplegado.

Django de producción incluye CORS con credenciales y CSRF para los orígenes
exactos del dominio, `www` y los dos dominios predeterminados del sitio Firebase.
Las cookies son Secure y SameSite=None; la autorización sigue siendo obligatoria
en cada endpoint de Django. Preferir `api.fincamamasgarden.com`: navegadores que
bloquean cookies de terceros pueden impedir sesiones desde `surco-finca.web.app`.
Los archivos adjuntos privados se descargan desde Django con su cookie de sesión.
La integración real de login, permisos y datos se verificará cuando exista la API.

## Publicación local (PowerShell, desde la raíz)

```powershell
$env:NEXT_PUBLIC_SITE_URL = 'https://fincamamasgarden.com'
$env:NEXT_PUBLIC_API_URL = '' # Sustituir solo cuando exista la API HTTPS.
$env:BUILD_AUDIT_MAPS = '1'
Push-Location apps/web
npm.cmd ci
if ($LASTEXITCODE) { throw 'npm ci failed' }
npm.cmd run lint
if ($LASTEXITCODE) { throw 'lint failed' }
npm.cmd run typecheck
if ($LASTEXITCODE) { throw 'typecheck failed' }
node scripts/audit-dependencies.mjs
if ($LASTEXITCODE) { throw 'dependency audit failed' }
npm.cmd run build
if ($LASTEXITCODE) { throw 'build failed' }
node scripts/audit-production.mjs build
if ($LASTEXITCODE) { throw 'bundle audit failed' }
node scripts/prepare-hosting.mjs
if ($LASTEXITCODE) { throw 'hosting preparation failed' }
Pop-Location
firebase.cmd deploy --config firebase.deploy.json --only hosting --project surco-finca --non-interactive
if ($LASTEXITCODE) { throw 'deployment failed' }
```

`prepare-hosting.mjs` genera `firebase.deploy.json` con hashes SHA-256 de los
scripts inline de los HTML exportados, cabeceras de seguridad, `cleanUrls`,
cache de assets y CSP limitada al origen de la API configurada. Elimina los mapas
de fuentes públicos después de auditar el build. El archivo generado es ignorado
por Git y debe regenerarse para cada build; no publicar directamente con la
configuración base omitiendo este paso. Se conserva el rewrite general solicitado
en `firebase.json`; las rutas exportadas existentes tienen precedencia mediante
`cleanUrls`. Las rutas desconocidas caen al inicio por ese rewrite.

Las pantallas con identificador usan rutas exportables, por ejemplo
`/dashboard/projects/detail?id=123` y `/dashboard/projects/edit?id=123`.
Solo se publican shells y código de interfaz, nunca datos de usuarios obtenidos
durante el build. La protección del cliente mejora la navegación; la barrera de
seguridad definitiva permanece en Django.

## Despliegue automático sin claves permanentes

`.github/workflows/firebase-hosting.yml` valida PRs y despliega los pushes a
`main` tras sus comprobaciones. La rama de trabajo se integra mediante PR.
La identidad cloud ya está configurada:

- Cuenta: `github-hosting@surco-finca.iam.gserviceaccount.com`.
- Pool: `projects/450724961922/locations/global/workloadIdentityPools/github-hosting`.
- Proveedor OIDC: `github`.
- Roles de proyecto: `roles/firebasehosting.admin` y
  `roles/serviceusage.serviceUsageConsumer`.
- Impersonación: `roles/iam.workloadIdentityUser`, restringida al ID del repositorio.
- Condición del proveedor: repositorio `1430465407`, propietario `153412973`,
  `refs/heads/main` y el workflow exacto `firebase-hosting.yml` en esa rama.

No se creó ni almacenó una clave privada de cuenta de servicio. Los builds de PR
no reciben credenciales cloud. La prueba de impersonación desde Actions queda
ligada a la primera ejecución del workflow integrado en `main`; no se amplió la
confianza a ramas de trabajo para eludir esa restricción.

## Verificación y rollback

Comprobar `/`, `/login` y una ruta profunda, HTTP→HTTPS, consola del navegador sin
errores CSP/hidratación y ausencia de peticiones `/api/` cuando la variable esté
vacía. Firebase administra certificados y renovación; el dominio y `www` estaban
en estado HOST_ACTIVE/OWNERSHIP_ACTIVE/CERT_ACTIVE al publicar.

Rollback: Firebase Console → Hosting → sitio `surco-finca` → historial de versiones
→ menú de la versión anterior → Roll back. Revertir también el commit o variable
que causó el problema para que el siguiente despliegue no lo reintroduzca.

Referencias: [exportación de Next.js](https://nextjs.org/docs/app/guides/static-exports),
[Hosting y GitHub](https://firebase.google.com/docs/hosting/github-integration),
[federación para pipelines](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines).
