# Fase 4: finanzas, transacciones y comprobantes

## Regla de dominio

Toda transacción requiere un `Project` y una `FinancialCategory`. El vínculo con el proyecto usa `PROTECT`, de modo que un centro de costos con historia financiera no puede eliminarse accidentalmente.

`EXPENSE` representa gastos operativos e `INVESTMENT` representa infraestructura o activos. Esta separación queda persistida desde el origen para que los cálculos posteriores de costo productivo usen únicamente gastos operativos y el ROI pueda presentar inversiones por separado.

## Modelos

- `FinancialCategory`: nombre único, descripción y estado activo.
- `Transaction`: proyecto, categoría, tipo, estado, monto positivo, fecha, descripción, proveedor o cliente y usuario creador.
- `TransactionAttachment`: imagen, metadatos del archivo, usuario que la subió y relación con la transacción.

La factura es opcional. Cuando existe, se valida como imagen y se limita a 10 MB. El archivo se guarda mediante el storage predeterminado de Django bajo `media/finance/receipts/`; cambiar ese storage por S3 no requiere modificar los modelos ni los endpoints.

Al reemplazar o eliminar un comprobante se elimina también el archivo anterior del storage.

## Permisos

- `ADMIN` puede gestionar categorías y cualquier transacción, incluido contabilizar (`POSTED`) o anular (`VOID`).
- `WORKER` solo ve movimientos de proyectos asignados.
- `WORKER` solo puede crear transacciones `DRAFT` en proyectos activos asignados.
- `WORKER` solo puede editar o eliminar borradores propios.
- `WORKER` solo puede administrar comprobantes de sus propios borradores.

La interfaz adapta las opciones al rol, pero Django vuelve a validar cada operación.

## API

| Recurso | Ruta base | Formatos |
| --- | --- | --- |
| Categorías | `/api/v1/finance/categories/` | JSON |
| Transacciones | `/api/v1/finance/transactions/` | JSON y multipart |
| Comprobantes | `/api/v1/finance/attachments/` | multipart |

Los tres recursos exponen CRUD REST. Las transacciones aceptan los filtros `project`, `status` y `type`.

El alta conjunta de movimiento y factura usa un único `POST multipart/form-data` a `/api/v1/finance/transactions/`. El campo opcional de imagen se llama `receipt`. También puede agregarse posteriormente con `POST /api/v1/finance/attachments/`, enviando `transaction` y `file`.

Las respuestas exponen las facturas mediante rutas relativas `/media/...` para que Next.js las entregue a través del mismo origen.

## Frontend

- `/dashboard/finance`: resumen, filtros y listado responsivo. En escritorio se muestra tabla; en móvil, tarjetas.
- `/dashboard/finance/new`: formulario para gasto o inversión, con captura de cámara o selección de imagen.
- Los administradores eligen entre borrador y contabilizado.
- Los trabajadores reciben el estado borrador de forma obligatoria.

## Datos iniciales

Las categorías y transacciones inician vacías. No existen comandos de semillas ni datos demostrativos; las categorías se administran desde el dashboard.
