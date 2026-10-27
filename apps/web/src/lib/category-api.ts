import { apiFetch } from "@/lib/api-client";
import { getCsrfToken } from "@/lib/auth-api";
import type { FinancialCategory } from "@/types/finance";

export class CategoryApiError extends Error {}

async function mutateCategory(
  id: number | null,
  method: "POST" | "PATCH" | "DELETE",
  input?: Partial<Pick<FinancialCategory, "name" | "description" | "is_active">>,
) {
  const csrfToken = await getCsrfToken();
  const url = id ? `/api/v1/finance/categories/${id}/` : "/api/v1/finance/categories/";
  const response = await apiFetch(url, {
    method,
    cache: "no-store",
    credentials: "include",
    headers: {
      ...(input ? { "Content-Type": "application/json" } : {}),
      "X-CSRFToken": csrfToken,
    },
    body: input ? JSON.stringify(input) : undefined,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as Record<string, string | string[]>;
    const value = Object.values(payload)[0];
    throw new CategoryApiError(
      (Array.isArray(value) ? value[0] : value) ?? "No fue posible guardar la categoría.",
    );
  }
  return response.status === 204 ? null : ((await response.json()) as FinancialCategory);
}

export const createCategory = (input: Pick<FinancialCategory, "name" | "description" | "is_active">) =>
  mutateCategory(null, "POST", input);
export const updateCategory = (id: number, input: Partial<Pick<FinancialCategory, "name" | "description" | "is_active">>) =>
  mutateCategory(id, "PATCH", input);
export const deleteCategory = (id: number) => mutateCategory(id, "DELETE");
