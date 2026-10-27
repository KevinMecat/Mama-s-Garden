import { apiFetch } from "@/lib/api-client";
import { getCsrfToken } from "@/lib/auth-api";
import type {
  Product,
  ProductInput,
  ProductionRecord,
  ProductionRecordInput,
  Sale,
  SaleInput,
} from "@/types/production";

export class ProductionApiError extends Error {}

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

async function request<T>(url: string, method: string, input?: unknown): Promise<T | null> {
  const csrfToken = await getCsrfToken();
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
    const payload = (await response.json().catch(() => ({}))) as unknown;
    throw new ProductionApiError(firstError(payload) ?? "No fue posible completar la operación.");
  }
  return response.status === 204 ? null : ((await response.json()) as T);
}

export const createProduct = (input: ProductInput) =>
  request<Product>("/api/v1/production/products/", "POST", input);
export const updateProduct = (id: number, input: Partial<ProductInput>) =>
  request<Product>(`/api/v1/production/products/${id}/`, "PATCH", input);
export const deleteProduct = (id: number) =>
  request<never>(`/api/v1/production/products/${id}/`, "DELETE");

export const createProductionRecord = (input: ProductionRecordInput) =>
  request<ProductionRecord>("/api/v1/production/records/", "POST", input);
export const updateProductionRecord = (id: number, input: Partial<ProductionRecordInput>) =>
  request<ProductionRecord>(`/api/v1/production/records/${id}/`, "PATCH", input);
export const deleteProductionRecord = (id: number) =>
  request<never>(`/api/v1/production/records/${id}/`, "DELETE");

export const createSale = (input: SaleInput) =>
  request<Sale>("/api/v1/production/sales/", "POST", input);
export const updateSale = (id: number, input: Partial<SaleInput>) =>
  request<Sale>(`/api/v1/production/sales/${id}/`, "PATCH", input);
export const deleteSale = (id: number) =>
  request<never>(`/api/v1/production/sales/${id}/`, "DELETE");
