import { getCurrentUser as fetchCurrentUser } from "@/lib/auth-api";
import { apiFetch } from "@/lib/api-client";

import { redirect } from "@/lib/client-navigation";

import type {
  FinanceFilters,
  FinancialCategory,
  FinancialTransaction,
} from "@/types/finance";
import type { Product, ProductionRecord, Sale } from "@/types/production";
import type { Project, ProjectMetrics } from "@/types/project";
import type { Employee, PayrollPeriod, SalaryRate, WorkEntry } from "@/types/payroll";
import type { DashboardReport } from "@/types/reports";

async function getAuthenticated<T>(path: string, errorMessage: string): Promise<T> {
  const response = await apiFetch(`${path}`, {
    cache: "no-store",

  });
  if (response.status === 401 || response.status === 403) redirect("/login");
  if (!response.ok) throw new Error(errorMessage);
  return (await response.json()) as T;
}

export const getCurrentUser = fetchCurrentUser;

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdministrator() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard/projects");
  return user;
}

export async function getProjects(status?: Project["status"]): Promise<Project[]> {
  const query = status ? `?status=${status}` : "";
  const response = await apiFetch(`/api/v1/projects/${query}`, {
    cache: "no-store",

  });

  if (response.status === 401 || response.status === 403) redirect("/login");
  if (!response.ok) throw new Error("No fue posible cargar los proyectos.");

  return (await response.json()) as Project[];
}

export function getProject(id: string): Promise<Project> {
  return getAuthenticated(`/api/v1/projects/${id}/`, "No fue posible cargar el proyecto.");
}

export function getProjectMetrics(id: string): Promise<ProjectMetrics> {
  return getAuthenticated(
    `/api/v1/projects/${id}/metrics/`,
    "No fue posible calcular las métricas del proyecto.",
  );
}

export async function getFinancialCategories(activeOnly = false) {
  const query = activeOnly ? "?is_active=true" : "";
  const response = await apiFetch(
    `/api/v1/finance/categories/${query}`,
    {
      cache: "no-store",

    },
  );

  if (response.status === 401 || response.status === 403) redirect("/login");
  if (!response.ok) throw new Error("No fue posible cargar las categorías financieras.");

  return (await response.json()) as FinancialCategory[];
}

export async function getFinancialTransactions(filters: FinanceFilters = {}) {
  const query = new URLSearchParams();
  if (filters.project) query.set("project", filters.project);
  if (filters.status) query.set("status", filters.status);
  if (filters.type) query.set("type", filters.type);

  const queryString = query.size ? `?${query.toString()}` : "";
  const response = await apiFetch(
    `/api/v1/finance/transactions/${queryString}`,
    {
      cache: "no-store",

    },
  );

  if (response.status === 401 || response.status === 403) redirect("/login");
  if (!response.ok) throw new Error("No fue posible cargar los movimientos financieros.");

  return (await response.json()) as FinancialTransaction[];
}

export function getProduct(id: string): Promise<Product> {
  return getAuthenticated(`/api/v1/production/products/${id}/`, "No fue posible cargar el producto.");
}

export function getProducts(activeOnly = false): Promise<Product[]> {
  const query = activeOnly ? "?is_active=true" : "";
  return getAuthenticated(
    `/api/v1/production/products/${query}`,
    "No fue posible cargar los productos.",
  );
}

export function getProductionRecord(id: string): Promise<ProductionRecord> {
  return getAuthenticated(
    `/api/v1/production/records/${id}/`,
    "No fue posible cargar el registro de producción.",
  );
}

export function getProductionRecords(): Promise<ProductionRecord[]> {
  return getAuthenticated(
    "/api/v1/production/records/",
    "No fue posible cargar la producción.",
  );
}

export function getSale(id: string): Promise<Sale> {
  return getAuthenticated(`/api/v1/production/sales/${id}/`, "No fue posible cargar la venta.");
}

export function getSales(): Promise<Sale[]> {
  return getAuthenticated("/api/v1/production/sales/", "No fue posible cargar las ventas.");
}

export function getEmployees(activeOnly = false): Promise<Employee[]> {
  const query = activeOnly ? "?is_active=true" : "";
  return getAuthenticated(
    `/api/v1/payroll/employees/${query}`,
    "No fue posible cargar los empleados.",
  );
}

export function getEmployee(id: string): Promise<Employee> {
  return getAuthenticated(
    `/api/v1/payroll/employees/${id}/`,
    "No fue posible cargar el empleado.",
  );
}

export function getSalaryRates(employee?: string): Promise<SalaryRate[]> {
  const query = employee ? `?employee=${employee}` : "";
  return getAuthenticated(
    `/api/v1/payroll/salary-rates/${query}`,
    "No fue posible cargar las tarifas salariales.",
  );
}

export function getWorkEntries(workDate?: string): Promise<WorkEntry[]> {
  const query = workDate ? `?work_date=${workDate}` : "";
  return getAuthenticated(
    `/api/v1/payroll/work-entries/${query}`,
    "No fue posible cargar la asistencia.",
  );
}

export function getPayrollPeriods(): Promise<PayrollPeriod[]> {
  return getAuthenticated(
    "/api/v1/payroll/periods/",
    "No fue posible cargar las planillas.",
  );
}

export function getDashboardReport(): Promise<DashboardReport> {
  return getAuthenticated(
    "/api/v1/reports/dashboard/",
    "No fue posible cargar el resumen financiero.",
  );
}
