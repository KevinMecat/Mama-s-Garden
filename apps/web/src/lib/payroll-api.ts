import { apiFetch } from "@/lib/api-client";
import { getCsrfToken } from "@/lib/auth-api";
import type {
  BulkAttendanceInput,
  Employee,
  EmployeeInput,
  PayrollPeriod,
  WorkEntry,
} from "@/types/payroll";

const PAYROLL_ROOT = "/api/v1/payroll";

export class PayrollApiError extends Error {}

function firstError(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const error = firstError(item);
      if (error) return error;
    }
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      const error = firstError(item);
      if (error) return error;
    }
  }
  return undefined;
}

async function request<T>(path: string, method: string, input?: unknown): Promise<T | null> {
  const csrfToken = await getCsrfToken();
  const response = await apiFetch(`${PAYROLL_ROOT}${path}`, {
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
    throw new PayrollApiError(firstError(payload) ?? "No fue posible completar la operación.");
  }
  return response.status === 204 ? null : ((await response.json()) as T);
}

export const createEmployee = (input: EmployeeInput) =>
  request<Employee>("/employees/", "POST", input);
export const updateEmployee = (id: number, input: Partial<EmployeeInput>) =>
  request<Employee>(`/employees/${id}/`, "PATCH", input);
export const deleteEmployee = (id: number) =>
  request<never>(`/employees/${id}/`, "DELETE");

export async function getAttendance(workDate: string): Promise<WorkEntry[]> {
  const response = await apiFetch(`${PAYROLL_ROOT}/work-entries/?work_date=${workDate}`, {
    cache: "no-store",
    credentials: "include",
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as unknown;
    throw new PayrollApiError(firstError(payload) ?? "No fue posible cargar la asistencia.");
  }
  return (await response.json()) as WorkEntry[];
}

export const saveBulkAttendance = (input: BulkAttendanceInput) =>
  request<WorkEntry[]>("/work-entries/bulk/", "POST", input);

export const createPayrollPeriod = (startDate: string, endDate: string) =>
  request<PayrollPeriod>("/periods/", "POST", { start_date: startDate, end_date: endDate });
export const payPayrollPeriod = (id: number, category: number) =>
  request<PayrollPeriod>(`/periods/${id}/pay/`, "POST", { category });
