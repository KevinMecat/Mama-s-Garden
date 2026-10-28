/** Suma cantidades de una cuadrilla una sola vez por registro, sin repartirlas entre sus integrantes. */
export function accumulatedCrewQuantity(logs: readonly { id: string; quantity: number | null }[]) {
  const seen = new Set<string>();
  let total = BigInt(0);
  let scale = 0;
  const powerOfTen = (power: number) => {
    let value = BigInt(1);
    for (let index = 0; index < power; index++) value *= BigInt(10);
    return value;
  };
  for (const log of logs) {
    if (!log.id || seen.has(log.id)) throw Error("Hay registros de avance duplicados o sin identificador.");
    seen.add(log.id);
    if (log.quantity === null) continue;
    if (!Number.isFinite(log.quantity) || log.quantity < 0) throw Error("La cantidad registrada no es válida.");
    const [mantissa, exponentText] = log.quantity.toString().toLowerCase().split("e");
    const [whole, fraction = ""] = mantissa.split(".");
    const exponent = Number(exponentText ?? 0);
    const decimalPlaces = fraction.length - exponent;
    const coefficient = BigInt(whole + fraction);
    if (decimalPlaces > scale) { total *= powerOfTen(decimalPlaces - scale); scale = decimalPlaces; }
    total += coefficient * powerOfTen(scale - decimalPlaces);
  }
  const result = Number(total) / 10 ** scale;
  if (!Number.isFinite(result)) throw Error("La cantidad acumulada excede el límite permitido.");
  return result;
}
