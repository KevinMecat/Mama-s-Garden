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
  Se admite además el host interno fijo `api` para fetch SSR: Node no permite
  sustituir Host con fetch. El proxy público solo admite el dominio canónico.
  El socket administrativo de Gunicorn está desactivado en el runtime read-only.
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

**Evidencia de integración verificada:** implementación
`cc569827c00d58b94a3496793ae999613dead883`,
[production-security correcto](https://github.com/KevinMecat/Mama-s-Garden/actions/runs/39894248749),
[calidad correcta](https://github.com/KevinMecat/Mama-s-Garden/actions/runs/39894248770) y
[reglas de PR correctas](https://github.com/KevinMecat/Mama-s-Garden/actions/runs/39894248761).
Linux auditó 230 mapas/65 trazas de build y 31 trazas en runtime, sin las
dependencias excluidas; el runtime no contiene mapas públicos. Se verificaron
usuarios no root, PostgreSQL/migraciones, Nginx, 301, TLS efímero, cabeceras en
2xx/4xx, CSP/nonce, cookies y forwarding. Django `check --deploy --tag security
--fail-level WARNING` terminó sin incidencias. Esta evidencia no acredita DNS,
CA pública ni renovación del dominio en un servidor real.

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
   Se retiran también los paquetes solo de declaraciones `@types`, que npm puede
   instalar mediante peers opcionales de dependencias productivas.
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
- [x] Check `production-security` verde para el SHA de implementación citado arriba.
- [ ] Registrar SHA/digests exactos de la release final aprobada por los responsables.
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


## Anexo de sustitución de arquitectura — 26 de octubre de 2026

Este anexo sustituye las conclusiones anteriores relativas al runtime Node,
SSR, CSP con nonces y aceptación de cinco vulnerabilidades de desarrollo para
el frontend publicado. Se autorizó convertir toda la aplicación a cliente
estático y publicar con la API pendiente de despliegue.

- Next.js exporta todas las pantallas; Django se consume desde el navegador mediante
  `NEXT_PUBLIC_API_URL`. Vacío en el release: ninguna solicitud ni credencial se
  envía a una API temporal. Login deshabilitado y panel con aviso de servicio pendiente.
- Firebase Hosting publica únicamente `apps/web/out`; no contiene node_modules,
  dependencias de desarrollo, secretos ni mapas de fuentes. El contenedor alternativo
  también sirve exclusivamente estáticos con Nginx y usuario 101:101.
- CSP usa hashes SHA-256 del HTML exportado; no requiere nonces ni unsafe-eval.
  Se admite unsafe-inline exclusivamente en estilos por las necesidades de React/Recharts.
- Auditoría completa npm y auditoría --omit=dev: cero hallazgos después de actualizar
  el lockfile de forma compatible. DEV-2026-10-22-01 está RESUELTO; no hay excepción
  activa ni aprobación de vulnerabilidades pendiente para esta cadena.
- Build auditado: 405 mapas y 2 trazas sin módulos de desarrollo prohibidos;
  preparación Hosting: 29 HTML y 29 hashes de scripts, mapas retirados antes del upload.
- Backend: 35 pruebas correctas; Ruff y 5 pruebas del validador de entorno correctas.
  Comprobación adicional de settings production: preflight CORS permitido/denegado,
  credenciales, cookie CSRF Secure/SameSite=None correctos.
- Navegador Edge real sobre el dominio publicado: inicio, login y ruta profunda
  HTTP 200; hidratación sin errores, CSP aplicada, login deshabilitado y cero
  solicitudes a la API sin configurar.
- Cuenta CI sin claves permanentes, federación OIDC restringida al repositorio,
  propietario, rama main y workflow exacto. Primer deploy de Actions pendiente de
  integrar el workflow en main; el despliegue local live sí fue ejecutado.

| Control del dominio real | Resultado |
| --- | --- |
| HTTP /login → HTTPS /login | 301 |
| HTTPS /login, CA pública | 200, certificado validado |
| HSTS | max-age=31536000; includeSubDomains; preload |
| X-Frame-Options | DENY |
| X-Content-Type-Options | nosniff |
| Referrer-Policy | strict-origin-when-cross-origin |
| CSP | hashes del build, origen de API parametrizado |
| Dominio y www en Firebase | HOST_ACTIVE, OWNERSHIP_ACTIVE, CERT_ACTIVE |

La cabecera preload expresa la política; no certifica inscripción del dominio
al listado de preload de navegadores. Firebase aplica su propio max-age HSTS
al dominio predeterminado web.app; el dominio personalizado tiene el valor requerido.

**Alcance publicado:** frontend disponible en https://fincamamasgarden.com y
https://surco-finca.web.app. La autenticación, datos y operaciones reales no están
certificados de extremo a extremo hasta desplegar Django, configurar su origen
HTTPS, recompilar y verificar las sesiones, CORS, CSRF y permisos con usuarios reales.
Se conserva pendiente la aprobación operacional global anterior; no se inventa firma
humana ni se certifica un backend inexistente.

**Firma de ejecución técnica:** Codex, 26 de octubre de 2026; preparación y publicación
frontend realizadas. Procedimiento reproducible: [firebase-hosting.md](firebase-hosting.md).


## Módulo de trabajo del personal — 27 de octubre de 2026

Desarrollado en feature/personal-kanban sobre ab045fa; PR #2 dependiente de #1.
No integrado ni desplegado mientras falten las revisiones exigidas por main.
El usuario confirmó Django/PostgreSQL como fuente de verdad y ausencia de datos
operativos en línea; Firestore/Storage preliminares no se modificaron ni importaron.

Migraciones workforce/0001_initial y 0002_worklog_work_date exclusivamente aditivas. Empleados, proyectos,
asistencia, tarifas, planillas, importes y comprobantes existentes permanecen
fuera de las escrituras del módulo. Prueba de conservación con fixtures y hash
de archivo correcta; suite local 51 correctas y 2 de concurrencia omitidas en
SQLite; CI PostgreSQL final en 9668fcc con 55 correctas, incluidas ambas de concurrencia
y las pruebas de fecha real distinta de la planificación.
E2E local automatizado: tres escenarios correctos de jornada completa, escritorio,
móvil, teclado, arrastre, rechazo de revisión obsoleta, reintento y permisos.

No se verificó respaldo/restauración de una base operativa real: no existe un
destino operativo en línea confirmado y no se accedió al PostgreSQL local detenido.
No se presenta la prueba de fixtures como evidencia de restauración real.
Antes de cualquier cambio sobre datos locales previos se exige identificar el
volumen/base/media, respaldo privado y restauración aislada.

La publicación conservada es Firebase Hosting version c2844b9a87a7554d, release
1793074077668000; SHA de implementación conocido ab045fa. El módulo nuevo no está
publicado. Matriz de permisos, límites y runbook: [workforce.md](workforce.md).

Evidencia final de código 9668fcc: quality 40541898308 y production 40541898522
correctos; E2E Chromium remoto 3 correctas. Build de Hosting y PR lint correctos.
El stack sintético arrancó, migró y verificó TLS/cabeceras/media privada sin usar
una base operativa. Los respaldos y la restauración real permanecen sin verificar;
no se requerían para modificar exclusivamente fixtures aisladas.


## Anexo: demostración pública del cliente (2026-10-27)

Por solicitud explícita se habilita un modo demo cuando el origen público de API está vacío. Esto sustituye el bloqueo del login descrito en los anexos anteriores. Las credenciales son públicas y el estado ficticio se limita a localStorage del navegador (`finca.demo.v1`); no constituye autenticación productiva ni autoriza acceso a Django/PostgreSQL. No se accede ni modifica una base operativa o archivos adjuntos privados.

La API configurada conserva cookies de sesión y CSRF; cualquier indisponibilidad genera error, sin conmutación automática a datos ficticios. El retorno a operación real exige configurar el origen HTTPS en el build y volver a desplegar. Los ejemplos no se importan a PostgreSQL. No se certifican respaldos ni un backend operativo. Detalles y verificaciones reproducibles: [demo-mode.md](demo-mode.md).

Verificación ejecutada el 2026-10-27: tests del cliente, ESLint y build estático con TypeScript correctos; tres pruebas E2E contra Django temporal correctas. La auditoría del build inspeccionó 328 mapas y dos trazas sin dependencias de desarrollo en el artefacto; los mapas fueron eliminados antes de publicar. Gitleaks staged sin hallazgos. Firebase CLI confirmó la publicación de 224 archivos en `surco-finca`.

Validación en vivo en `https://fincamamasgarden.com`: login, 27 rutas protegidas, creación y persistencia local de proyecto, reinicio aislado, móvil y logout correctos; cero llamadas API y cero errores de ejecución/CSP. HTTPS, HSTS, DENY, nosniff, Referrer-Policy y CSP con hashes verificados. Esta publicación es una demostración pública; no certifica la operación de un ERP con datos reales.


## Anexo: publicación del rediseño con datos operativos Firebase (2026-10-27)

La instrucción más reciente del propietario sustituye la clasificación anterior de Firestore como preliminar: el origen operativo de este despliegue es `surco-finca`, no los fixtures de Django ni la sesión demo. La inspección autenticada de solo lectura identificó siete perfiles, siete historiales salariales semanales USD, 216 asistencias, 62 movimientos, una unidad y 26 archivos. No se incorporan nombres, importes individuales, fotos ni enlaces con tokens a los archivos versionados o al export estático.

El conector exige Firebase Authentication y un perfil activo autorizado. Lee los documentos desde el servidor con las reglas vigentes, mantiene las colecciones en memoria y resuelve los archivos mediante Storage autenticado. No incluye métodos de escritura, eliminación o carga. Las rutas y controles de edición del proveedor Django no se montan cuando el origen es Firebase. Los salarios conservan centavos, moneda y periodicidad; las monedas se contabilizan separadas, sin conversión ni inferencia de pagos.

Se comprobó que la cuenta administrativa existente coincide con su perfil activo. No se creó una cuenta, se cambió una contraseña ni se concedieron nuevos roles. Se añadieron únicamente los dominios verificados de Hosting a la configuración de dominios autorizados de Auth. Las reglas de Firestore/Storage y sus registros permanecen bajo la política existente; el servicio de Storage ya dispone del permiso requerido para consultar perfiles desde sus reglas.

SDK Firebase fijado y dependencia transitiva `@grpc/grpc-js` actualizada mediante override a la versión corregida 1.14.6; auditoría completa y de producción sin vulnerabilidades. Pruebas de centavos, monedas separadas, fechas efectivas, periodicidad y ausencia de API de escritura correctas. Prueba de navegador: rutas privadas protegidas, login de Firebase real, credenciales demo rechazadas y consulta anónima de personal denegada; sin escrituras ni errores de ejecución/CSP. No se afirma una prueba positiva con la contraseña del propietario, que no fue solicitada ni modificada.


Publicación completada: Firebase CLI confirmó `Deploy complete!` para 233 archivos. `https://fincamamasgarden.com/login` y `https://surco-finca.web.app/login` responden 200 con HSTS y CSP que permite exclusivamente los servicios Firebase necesarios. La prueba de navegador en el dominio público confirmó proveedor Auth real, rechazo de credenciales demo, protección de rutas, denegación anónima de personal y ausencia de errores de ejecución/CSP. La comparación de nombres y tiempos de actualización de todos los documentos inspeccionados y de generaciones/metageneraciones de los 26 objetos antes/después resultó idéntica. No se sobrescribió ni eliminó ningún registro o archivo. El export no contiene los perfiles operativos; se consultan tras autenticar.

## Anexo vigente: Kanban operativo y conservación — 0.2.0

Este anexo sustituye las afirmaciones históricas de demo pública, Firebase preliminar,
solo lectura del módulo de trabajo y falta de respaldo Firebase. No certifica ni
modifica el PostgreSQL local. La rama de partida fue `feature/personal-kanban`,
HEAD `089fa79d2fa45cfcef3f7b7aa32d167ac6a546d1`, sin cambios locales útiles pendientes.
PR #2 continúa dependiendo de PR #1, sin reescribir historia ni eludir main.

La publicación previa identificable era Hosting release `1793127148314000`,
version `15e48bf63c96c0cd`, 2026-10-27 18:52:28 UTC. No llevaba metadatos Git:
`089fa79` es la última implementación conocida, no una atribución criptográfica
retrospectiva. A partir de 0.2.0 `/build-info.json` informa el SHA exacto compilado,
SemVer, fecha, proveedor y si el árbol estaba limpio.

### Protección verificada

Respaldo privado de 795 documentos y 26 objetos, con ACL restringida y manifiesto
SHA-256 fuera del repositorio. Restauración independiente: 795 documentos en
Firestore emulado loopback, coincidencia completa de campos; 26 archivos en otro
directorio privado, hashes idénticos. El acta detallada permanece privada.
No se presenta una copia de archivos como un ensayo de carga al bucket productivo.
No hubo semillas, migraciones, reinicios de volúmenes o escrituras de prueba reales.

El adaptador escribe exclusivamente recursos nuevos `workforce_*` y evidencias
nuevas. Las revisiones de perfil conservan el documento original. Las unidades y
los trabajadores usan sus IDs existentes; seis activos de siete registros. Las
tarifas continúan semanales en USD, sin convertirlas a horas/días ni producir pagos.

### Mitigación y riesgos aceptados

| Riesgo | Mitigación y límite |
| --- | --- |
| Finalización o revisión sin privilegios | Reglas de Firestore comprueban perfil activo, estados, revisión, cierre y aceptación exclusivamente administrativa |
| Reintentos, concurrencia y pérdida de red | Transacción, revisión incremental, evento inmutable ligado, UUID/huella idempotente y confirmación del servidor antes de mover la tarjeta |
| Sobrescritura de datos previos | Solo parches operativos separados; evidencia nueva exige objeto inexistente; documentos, archivos e historial no se borran por el módulo |
| Asignaciones inválidas | IDs reales, personal activo comprobado en servidor, índice de inactivos revisados, avisos de ausencia y sobrecarga |
| Medición injusta | Tiempo explícito, incluye cierres devueltos, producción de cuadrilla grupal, cumplimiento sin rankings, cero y pendiente diferenciados |
| Exposición de salarios/finanzas | Consultas y reglas exclusivamente Admin, también para comprobantes; Encargado no obtiene datos financieros |
| Dependencias de desarrollo | Herramientas de reglas solo en devDependencies; auditoría npm completa y productiva sin alertas; mapas/trazas del build deben demostrar exclusión antes de publicar |
| Enlaces heredados de Storage con token | Se preservan los tokens existentes por la prohibición de modificar objetos. Un poseedor de una URL puede compartirla; no se publican en Git, logs o HTML estático. No se afirma revocación automática al cerrar sesión |
| Desconexión en campo | La operación requiere red para confirmar escritura. No se promete captura offline persistente ni se almacena personal en localStorage |
| Identidades de trabajadores | Vínculo explícito con cuentas existentes; no se inventan usuarios ni contraseñas. La creación de cuentas adicionales sigue bajo administración autorizada |
| Recuperación y escala | Respaldo local privado verificado en esta entrega; no equivale a política periódica, retención externa o restauración productiva. No se certificó carga masiva ni alta concurrencia |

### Matriz HTTP para la publicación

| Control | Valor requerido |
| --- | --- |
| HTTPS | Certificado válido para el dominio público; HTTP redirige a HTTPS |
| HSTS | `max-age=31536000; includeSubDomains; preload` |
| Framing | `X-Frame-Options: DENY` y CSP `frame-ancestors 'none'` |
| MIME | `X-Content-Type-Options: nosniff` |
| Referencia | `Referrer-Policy: strict-origin-when-cross-origin` |
| CSP | Scripts propios y hashes; conexiones a Auth/Firestore/Storage; sin unsafe-eval ni credenciales de servidor |
| Export | Solo estático, sin mapas públicos, fixtures, documentos operativos, respaldos o archivos secretos |
| Proveniencia | `/build-info.json`, no-store, SHA del commit limpio publicado |

### Aprobación

- [x] Respaldo privado y restauración aislada verificados.
- [x] No se modificó PostgreSQL ni los registros operativos originales.
- [x] Jornada completa, correcciones, seis integrantes, permisos y conservación probados en emuladores.
- [x] Flujo positivo de navegador aislado, USD, modo oscuro, móvil e historial comprobados.
- [ ] Aceptación operacional del propietario con su cuenta y contraseña existentes.
- [ ] Política de respaldo periódico, copia fuera del equipo y retención aprobadas por el propietario.

Firma de ejecución técnica: Codex, 27 de octubre de 2026. No constituye firma
humana ni certificación de aceptación del propietario. Resultado de publicación
y verificaciones en vivo se registran al cierre de esta entrega.

Primera publicación operativa 0.2.0 verificada a las 19:58 UTC: CLI confirmó
`Deploy complete!`, 249 archivos, release `1793131088281000`, versión Hosting
`a81a6a06a850813c`, compilada desde el commit limpio
`96a9271139874573ad564832a131e8fc92e43b13`. El dominio público y `surco-finca.web.app`
devolvieron ese SHA y el mismo HTML que el export local. HTTP redirigió con 301;
HSTS fue de al menos un año, includeSubDomains/preload, junto con DENY, nosniff,
Referrer-Policy y CSP correctos. El dominio firebase por defecto aplica su propio
max-age HSTS 31556926, superior al mínimo 31536000 configurado.

La prueba de navegador en vivo confirmó Auth real, rechazo de credenciales demo,
protección de rutas, denegación anónima y ausencia de errores de ejecución/CSP.
Las fuentes de ambas reglas publicadas coinciden con las versionadas. El export
no contiene mapas, perfiles reales, fixtures ni marcadores de emuladores.
La huella posterior de todos los documentos originales y generaciones/metadatos
de los 26 objetos es idéntica a la anterior; la cuenta administrativa sigue activa.
No se hizo una prueba positiva con la contraseña del propietario.

Los ajustes posteriores de metadatos Docker no cambian datos ni el dominio
operativo. El SHA servido de la última compilación se consulta siempre en
`/build-info.json`; no se interpreta el HEAD de un commit documental como prueba
de la versión desplegada. CI valida también el build Docker sin copiar `.git`.

## Asistencia operativa — 0.3.0

Se sustituye la consulta de asistencia por registro diario de presencia, entrada,
salida, descanso, turno nocturno, justificación y observaciones; se añaden resumen
semanal, CSV y revisiones auditadas. Se mantiene el origen real del personal.
Las marcaciones nuevas y las correcciones se guardan en `workforce_attendance`
y `workforce_attendance_history`, sin sobrescribir los 216 registros originales.
La lectura consolidada se comparte con los avisos de asignación del Kanban.

Reglas: Administrador/Encargado registran; trabajador consulta su vínculo. Fechas
futuras en Nicaragua e inactivos se rechazan. La semana se deriva y valida en el
servidor para impedir eludir una planilla cerrada mediante otra clave semanal.
Se exige revisión incremental e historial inmutable ligado. No se generan pagos,
no se cambian salarios, tarifas o planillas, ni se calculan horas desde el Kanban.

Pruebas aisladas correctas: entrada/salida, descuento de descanso, turno nocturno,
horas inválidas, permisos, idempotencia, conflictos, cierre de planilla, revisiones,
conservación de asistencia original, móvil y descarga CSV. El respaldo privado
anterior sigue coincidiendo con todos los documentos originales actuales y
conserva su acta de restauración verificada. No se registraron asistencias de prueba
con trabajadores reales en producción. Versión/SHA publicados: `/build-info.json`.
