import { apiFetch } from "@/lib/api-client";
import { getCsrfToken } from "@/lib/auth-api";
import type { FinancialTransaction } from "@/types/finance";

const TRANSACTIONS_ROOT = "/api/v1/finance/transactions";

export class FinanceApiError extends Error {}

function firstError(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = firstError(item);
      if (message) return message;
    }
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      const message = firstError(item);
      if (message) return message;
    }
  }
  return undefined;
}

async function getErrorMessage(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as unknown;
  return firstError(payload) ?? "No fue posible guardar el movimiento. Intenta nuevamente.";
}

export async function createFinancialTransaction(formData: FormData) {
  const csrfToken = await getCsrfToken();
  const response = await apiFetch(`${TRANSACTIONS_ROOT}/`, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: {
      "X-CSRFToken": csrfToken,
    },
    body: formData,
  });

  if (!response.ok) throw new FinanceApiError(await getErrorMessage(response));
  return (await response.json()) as FinancialTransaction;
}
