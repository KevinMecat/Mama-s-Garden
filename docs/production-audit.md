# Auditoría de preparación — 22 de octubre de 2026

> El registro inicial se conserva como evidencia histórica. El estado de los
> controles nuevos y la aprobación de despliegue figuran en el anexo técnico final.

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
7. Las imágenes de contenedor todavía no se han auditado; las versiones Python
   usan rangos y necesitan una estrategia de bloqueo reproducible.
8. La auditoría completa de npm también detectó hallazgos de severidad alta en
   herramientas de desarrollo. La cadena `eslint-config-next` → `fast-glob` →
   `micromatch` → `braces` usa `braces@3.0.3`, sin versión corregida publicada al
   consultar el registro. No se aplicó el downgrade mayor sugerido por npm.
   Tratar entradas de glob no confiables como riesgo pendiente de la cadena de build.

Los hooks requieren `python` en PATH y Gitleaks en PATH o configurado mediante
`security.gitleaksPath`. Activar con
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

## Correcciones de dependencias

La auditoría adicional detectó una vulnerabilidad crítica y dos altas en las
dependencias de producción del frontend, además de hallazgos en DRF y Pillow.
Se actualizó Next.js/eslint-config-next a 16.4.2 y se corrigieron dependencias
transitivas mediante el lockfile. `npm audit --omit=dev` finalizó sin hallazgos.
CI ahora bloquea vulnerabilidades de producción de severidad alta o crítica.

Se elevaron DRF a `>=3.18.3,<3.19` y Pillow a `>=13.0.0,<14`; la instalación local
usa DRF 3.18.3 y Pillow 13.0.0. `pip-audit` sobre el entorno instalado finalizó
sin vulnerabilidades conocidas. Notas oficiales consultadas:
[DRF](https://www.django-rest-framework.org/community/release-notes/) y
[Pillow 13](https://pillow.readthedocs.io/en/stable/releasenotes/13.0.0.html).

Estos resultados reflejan las bases de advisories consultadas durante la sesión,
no garantizan ausencia de vulnerabilidades desconocidas ni cubren las imágenes.
La auditoría sin `--omit=dev` no está limpia; los hallazgos de herramientas de
desarrollo se detallan en los bloqueos: quedan cinco entradas altas de la misma
cadena de dependencias sin parche. Se corrigió además `brace-expansion` mediante
una actualización compatible del lockfile. No confundir ambos alcances.

Tras actualizar: 34 pruebas API correctas, Ruff y `pip check` correctos; frontend
con lint, tipos y build de producción correctos usando Next.js 16.4.2. La
verificación remota del nuevo lockfile se consulta en GitHub Actions.
La validación Linux detectó dos dependencias opcionales `@emnapi` omitidas por
el npm local anterior. Se regeneró el lockfile con npm 11.19.0 y se fijó esa
versión en `packageManager` y en CI para evitar diferencias entre instaladores.

## Anexo técnico: hardening de producción — 22 de octubre de 2026

Dominio canónico indicado por el propietario: **fincamamasgarden.com**.
Alcance: código, imágenes, configuración reproducible y gobernanza del PR.
No se han recibido acceso al servidor, identificación del proveedor ni secretos
de producción. No se emiten certificados ACME ni se modifica DNS desde esta sesión.
Una ejecución con certificado efímero de CI no certifica el sitio público.

### Controles y evidencia

- Nginx no root: TLS 1.2/1.3, ACME webroot, 301 canónico y headers en respuestas
  de éxito y error; reemplaza la cadena de forwarding no confiable. No debe
  colocarse detrás de otro proxy sin revisar expresamente esa frontera de confianza.
- CSP con nonce aleatorio por respuesta para scripts Next.js, sin `unsafe-eval`
  en producción. Las páginas son dinámicas y no se cachea HTML en la PWA.
  Se conserva `style-src 'unsafe-inline'` para estilos dinámicos de React/Recharts:
  la CSP no promete bloquear inyección de estilos; scripts inline sin nonce
  permanecen bloqueados. No se aceptan comodines de orígenes ni scripts externos.
- Django: Gunicorn, WhiteNoise, cookies Secure, HTTPS obligatorio, HSTS de un año
  con includeSubDomains/preload y validación del entorno al importar settings.
  Solo se confía en `X-Forwarded-Proto` porque API/DB no publican puertos y los
  contenedores autorizados comparten una red privada explícita.
- API, web y proxy se ejecutan sin root, sin capacidades, con filesystem de solo
  lectura, no-new-privileges y escrituras limitadas a tmpfs/volúmenes identificados.
  Los digests de Node, Python, Nginx y PostgreSQL están fijados. PostgreSQL tampoco
  publica puertos. Docker/host siguen siendo una frontera de confianza administrativa.
- Secretos ausentes del build: solo el URL público se pasa como argumento.
  La validación exige todas las claves de `config/environment.example`, coherencia
  entre URL y credenciales de DB, host/origen exactos, DEBUG=False y secretos
  largos/diversos; no prueba que un valor haya sido generado aleatoriamente.
  Deben generarse en un gestor de secretos, no reutilizarse ni guardarse en logs.
- Los comprobantes privados usan descarga autenticada con permisos de proyecto;
  `/media/` nunca es un alias público en Nginx. Se añadió prueba de aislamiento
  entre usuarios y de ausencia de caché en las descargas.
- PR template y `pr-lint.yml`: título, rama y todos los commits nuevos; entradas
  del evento se consumen como datos. CI tiene permisos read-only. El propietario
  debe activar los required checks y revisión independiente según el runbook.

Pruebas locales verificadas: cuatro pruebas de preflight/ausencia de exposición,
ocho pruebas financieras (incluida descarga privada), Ruff y build Next.js con
auditoría de **410 mapas y 65 trazas**, sin las dependencias de riesgo.
El resultado definitivo de imágenes/TLS efímero lo determina el check requerido
`production-security`, ejecutado en Linux con Docker. Los valores y claves
efímeros de CI no se publican como artifacts.

### Mitigación y Riesgo Aceptado

Identificador: **DEV-2026-10-22-01**. Responsable propuesto: **KevinMecat**.
Vigencia máxima de la excepción técnica: **21 de noviembre de 2026, 00:00 UTC**.
Estado: **aceptación técnica condicionada; aprobación de negocio pendiente**.

Las cinco entradas altas son una misma cadena de desarrollo:
`eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch`
→ `braces`. El advisory raíz es
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
denegación de servicio por patrones profundamente anidados. No se considera que
las cinco entradas representen cinco vectores independientes en el servidor web.
No se silencian globalmente los advisories ni se degrada Next.js para ocultarlos.

La exclusión no se deduce únicamente de `devDependencies`:

1. `npm ci --omit=dev` instala un árbol nuevo en una etapa independiente;
   la imagen final usa ese árbol y no copia node_modules del builder.
2. Un gate inspecciona los nombres de paquetes instalados en runtime y falla si
   encuentra cualquiera de las cinco entradas o una dependencia directa de desarrollo.
3. Durante la compilación se generan mapas de cliente/servidor y trazas NFT;
   otro gate rechaza referencias a los módulos excluidos. Los mapas se retiran
   antes de copiar artefactos a la imagen final y se comprueba su ausencia allí.
4. CI ejecuta de nuevo el inventario dentro de la imagen final y prueba TLS,
   forwarding y cabeceras sobre el Compose de producción completo.
5. `audit-dependencies.mjs` exige cero hallazgos en producción y solo permite la
   cadena/advisory documentados en desarrollo. Cualquier advisory nuevo o la
   fecha de vencimiento hace fallar CI. El lock fija versiones e integridad.
6. La compilación se realiza en runners efímeros sin secretos de producción,
   con permisos read-only y sin publicación automática. No procesar patrones glob
   recibidos de usuarios o PRs como argumentos arbitrarios del linter.

**Conclusión técnica condicionada:** una release cuyo check `production-security`
sea correcto tiene evidencia automatizada de exclusión de estos paquetes del
árbol de ejecución y del código trazado/mapeado de cliente y servidor. No equivale
a una prueba matemática sobre toda cadena de suministro ni sustituye escaneo de
la imagen base/SBOM, revisión del código o aprobación humana. Un hallazgo nuevo,
una modificación del bundle o del Dockerfile invalida la evidencia anterior.
El riesgo residual aceptable se limita al agotamiento de recursos en el build
aislado; no se acepta exposición de esta cadena a peticiones en producción.

### Matriz de verificación TLS/HSTS y HTTP

| Control | Criterio de aprobación | Evidencia reproducible |
| --- | --- | --- |
| Certificado público | CA confiable, SAN fincamamasgarden.com, vigente | `python scripts/verify_https.py fincamamasgarden.com`; pendiente en host real |
| TLS | Solo 1.2/1.3; certificado/clave coincidentes | Config Nginx, `nginx -t`, instalación valida par/host/expiración |
| HTTP | 301 a HTTPS canónico, excepto desafío ACME | `verify_https.py` valida Location y 301 |
| HSTS | `max-age=31536000; includeSubDomains; preload` | Comparación exacta en login, API, static, media y 404 |
| X-Frame-Options | DENY | Misma prueba 2xx/4xx, sin duplicados |
| X-Content-Type-Options | nosniff | Misma prueba 2xx/4xx, sin duplicados |
| Referrer-Policy | strict-origin-when-cross-origin | Misma prueba 2xx/4xx, sin duplicados |
| CSP | Nonce en header y scripts HTML; strict-dynamic; sin unsafe-eval | `verify_https.py` y proxy Next.js |
| Forwarding | Un X-Forwarded-Proto cliente no altera HTTPS percibido | Prueba con header falsificado, API debe responder 200 |
| Cookies | CSRF Secure y sesión Secure/HttpOnly en settings | Endpoint CSRF y check Django security |
| Privacidad | /media devuelve 404; descargas por API autenticada | Pruebas HTTP y financieras por pertenencia al proyecto |
| Renovación | Certbot renueva, instala clave 0400 y recarga Nginx | `renew-tls.sh`; pendiente con ACME real y timer del host |

HSTS/includeSubDomains exige verificar TODOS los subdominios antes de aprobar.
El header preload no implica inscripción en la lista preload. Los resultados de
CI emplean un certificado efímero y `--resolve 127.0.0.1`, nunca sustituyen las
dos comprobaciones públicas pendientes de certificado y renovación.

### Checklist firmado de aprobación final

- [x] Configuración y gates técnicos preparados; secretos fuera de Git/build/logs.
- [x] Preflight probado ante ausencia de variables, defaults e interpolación.
- [x] Build local y mapas/trazas de exclusión revisados; archivos de release preparados.
- [ ] Check `production-security` verde para el SHA/digests exactos de la release aprobada.
- [ ] Certificado CA pública y renovación automática verificados en el servidor real.
- [ ] Subdominios revisados antes de activar política HSTS/preload en el dominio.
- [ ] Branch Protection aplicada y comprobada, sin bypass de administradores.
- [ ] Backup/restore, observabilidad y rollback probados con el responsable de operaciones.
- [ ] Riesgo DEV-2026-10-22-01 aprobado por el propietario antes de su vencimiento.

**Firma de preparación técnica:** Codex, agente de ingeniería asistida,
22 de octubre de 2026. Alcance de firma: archivos y evidencia de pruebas
indicados; no suplanta a una persona ni es una firma criptográfica.

**Firma del aprobador de seguridad:** PENDIENTE — nombre, fecha, SHA y digests.
**Firma del responsable de operaciones:** PENDIENTE — nombre, fecha y evidencia.
**Decisión de pase a producción:** PENDIENTE hasta completar las casillas.

Runbook: [production-deployment.md](production-deployment.md).
Referencias oficiales:
[proxy Nginx](https://nginx.org/en/docs/http/ngx_http_proxy_module.html),
[Django SECURE_PROXY_SSL_HEADER](https://docs.djangoproject.com/en/5.2/ref/settings/#secure-proxy-ssl-header),
[CSP Next.js](https://nextjs.org/docs/app/guides/content-security-policy),
[Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule).
