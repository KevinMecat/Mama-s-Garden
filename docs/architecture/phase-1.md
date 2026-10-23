# Fase 1: fundamentos

La aplicacion se organiza como un monolito modular dentro de un monorepo.
Django es la autoridad de datos, validaciones, permisos y reglas financieras.
Next.js se ocupa de la presentacion y consume una API REST versionada.

## Regla financiera acordada

- Los gastos operativos determinan el costo total y unitario de un lote.
- Las inversiones de infraestructura y maquinaria se muestran por separado.
- `ROI operativo = (ingresos - gastos operativos) / gastos operativos * 100`.
- Una depreciacion futura podra asignarse como gasto operativo, pero no forma parte del MVP.

## Decisiones de la fase

- Configuracion separada para desarrollo y produccion.
- Usuario personalizado creado antes de la primera migracion.
- Archivos locales mediante la abstraccion `STORAGES` de Django.
- PWA instalable como base, sin sincronizacion offline de datos financieros.
- PostgreSQL 17 para desarrollo reproducible.
