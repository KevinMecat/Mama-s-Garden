# Fase 5: producción, ventas y métricas

## Dominio

- `Product` mantiene un catálogo configurable de nombres y unidades de medida.
- `ProductionRecord` registra cantidades producidas por producto y proyecto.
- `Sale` pertenece a un proyecto y producto, y se vincula uno a uno con una `Transaction` de tipo `INCOME`.

La creación y actualización de una venta y su ingreso se ejecutan dentro de una misma transacción de base de datos. Al eliminar una venta se elimina también el ingreso vinculado. El estado financiero (`DRAFT`, `POSTED` o `VOID`) es la fuente de verdad para confirmar o anular la venta.

## Métricas

`GET /api/v1/projects/{id}/metrics/` calcula sin persistir agregados:

- gasto operativo: movimientos `EXPENSE` y `POSTED`;
- costo unitario: gasto operativo / cantidad producida;
- resultado operativo: ventas `POSTED` - gasto operativo;
- ROI operativo: resultado operativo / gasto operativo × 100.

Las inversiones se mantienen separadas y no intervienen en el costo unitario. Cuando el denominador es cero, costo unitario y ROI devuelven `0.00`.

## Política de datos

No hay fixtures, semillas ni registros de demostración. La migración correctiva de esta fase elimina exclusivamente los identificadores conocidos de demostración de fases anteriores y deja intactos usuarios y datos ajenos a esas semillas.
