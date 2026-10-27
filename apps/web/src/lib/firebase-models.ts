import type { CloudRow } from "@/lib/firebase-client";
export function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
export function fullName(row: CloudRow) {
  return (
    `${text(row.firstName)} ${text(row.lastName)}`.trim() ||
    "Nombre no registrado"
  );
}
export function cents(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}
export function formatMoney(value: unknown, currency: unknown): string {
  const amount = cents(value),
    code = text(currency);
  if (amount === null || !/^[A-Z]{3}$/.test(code))
    return "Importe o moneda no registrados";
  try {
    return new Intl.NumberFormat("es-NI", {
      style: "currency",
      currency: code,
      currencyDisplay: "code",
    }).format(amount / 100);
  } catch {
    return "Moneda no reconocida";
  }
}
export function currencyTotals(rows: CloudRow[]) {
  const result: Record<
    string,
    { income: number; expense: number; investment: number; count: number }
  > = {};
  for (const row of rows) {
    const amount = cents(row.amountCents),
      code = text(row.currency);
    if (
      amount === null ||
      !/^[A-Z]{3}$/.test(code) ||
      !["income", "expense", "investment"].includes(text(row.type))
    )
      continue;
    const total = (result[code] ??= {
      income: 0,
      expense: 0,
      investment: 0,
      count: 0,
    });
    total[row.type as "income" | "expense" | "investment"] += amount;
    total.count++;
  }
  return result;
}
export function salaryHistory(
  row: CloudRow | undefined,
): {
  from: string;
  type: string;
  amountCents: number | null;
  currency: string;
}[] {
  return (Array.isArray(row?.history) ? row.history : [])
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      from: text(item.from),
      type: text(item.type),
      amountCents: cents(item.amountCents),
      currency: text(item.currency),
    }))
    .sort((a, b) => b.from.localeCompare(a.from));
}
export function currentSalary(row: CloudRow | undefined, date: string) {
  return salaryHistory(row).find((item) => item.from && item.from <= date);
}
export const salaryUnits: Record<string, string> = {
  weekly: "semana",
  daily: "día",
  monthly: "mes",
  hourly: "hora",
};
export const attendanceLabels: Record<string, string> = {
  present: "Presente",
  half: "Medio día",
  absent: "Ausente",
  late: "Tarde",
};
