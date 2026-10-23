# Fase 6: personal, asistencia y nómina

## Modelo

- `Employee` mantiene el directorio del personal.
- `SalaryRate` versiona el salario diario mediante rangos de vigencia no superpuestos.
- `WorkEntry` registra una sola asistencia por empleado y fecha, siempre asociada a un proyecto.
- `PayrollPeriod` recorre los estados `DRAFT`, `APPROVED` y `PAID`.
- `PayrollLine` conserva la instantánea aprobada por empleado y proyecto.
- `PayrollExpense` enlaza cada subtotal por proyecto con su transacción financiera.

## Integración financiera

Al pagar una planilla, el servicio bloquea el período, toma una instantánea de los importes y crea una transacción `EXPENSE` en estado `POSTED` por cada proyecto. La categoría financiera se selecciona desde el catálogo administrado por el usuario. Repetir la solicitud de pago es idempotente y no duplica transacciones.

Los períodos aprobados o pagados bloquean la asistencia comprendida en su rango. Las tarifas posteriores no alteran las líneas ya aprobadas.

## Política de datos

La migración contiene únicamente esquema. No hay fixtures, semillas, empleados, salarios, asistencias, categorías ni períodos precargados.
