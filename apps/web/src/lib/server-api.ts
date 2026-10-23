import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { AuthResponse, AuthUser } from "@/types/auth";
import type {
  FinanceFilters,
  FinancialCategory,
  FinancialTransaction,
} from "@/types/finance";
import type { Product, ProductionRecord, Sale } from "@/types/production";
import type { Project, ProjectMetrics } from "@/types/project";
import type { Employee, PayrollPeriod, SalaryRate, WorkEntry } from "@/types/payroll";
import type { DashboardReport } from "@/types/reports";

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://api:8000";

async function requestHeaders() {
  const cookieStore = await cookies();
  return {
    Cookie: cookieStore.toString(),
    ...(process.env.NODE_ENV === "production"
      ? { "X-Forwarded-Proto": "https" }
      : {}),
  };
}

async function getAuthenticated<T>(path: string, errorMessage: string): Promise<T> {
  const response = await fetch(`${API_INTERNAL_URL}${path}`, {
    cache: "no-store",
    headers: await requestHeaders(),
  });
  if (response.status === 401 || response.status === 403) redirect("/login");
  if (!response.ok) throw new Error(errorMessage);
  return (await response.json()) as T;
}

export const getServerCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const response = await fetch(`${API_INTERNAL_URL}/api/v1/auth/me/`, {
    cache: "no-store",
    headers: await requestHeaders(),
  });

  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new Error("No fue posible validar la sesión con Django.");

  return ((await response.json()) as AuthResponse).user;
});

export async function requireUser() {
  const user = await getServerCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdministrator() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard/projects");
  return user;
}

export async function getServerProjects(status?: Project["status"]): Promise<Project[]> {
  const query = status ? `?status=${status}` : "";
  const response = await fetch(`${API_INTERNAL_URL}/api/v1/projects/${query}`, {
    cache: "no-store",
    headers: await requestHeaders(),
  });

  if (response.status === 401 || response.status === 403) redirect("/login");
  if (!response.ok) throw new Error("No fue posible cargar los proyectos.");

  return (await response.json()) as Project[];
}

export function getServerProject(id: string): Promise<Project> {
  return getAuthenticated(`/api/v1/projects/${id}/`, "No fue posible cargar el proyecto.");
}

export function getServerProjectMetrics(id: string): Promise<ProjectMetrics> {
  return getAuthenticated(
    `/api/v1/projects/${id}/metrics/`,
    "No fue posible calcular las métricas del proyecto.",
  );
}

export async function getServerFinancialCategories(activeOnly = false) {
  const query = activeOnly ? "?is_active=true" : "";
  const response = await fetch(
    `${API_INTERNAL_URL}/api/v1/finance/categories/${query}`,
    {
      cache: "no-store",
      headers: await requestHeaders(),
    },
  );

  if (response.status === 401 || response.status === 403) redirect("/login");
  if (!response.ok) throw new Error("No fue posible cargar las categorías financieras.");

  return (await response.json()) as FinancialCategory[];
}

export async function getServerFinancialTransactions(filters: FinanceFilters = {}) {
  const query = new URLSearchParams();
  if (filters.project) query.set("project", filters.project);
  if (filters.status) query.set("status", filters.status);
  if (filters.type) query.set("type", filters.type);

  const queryString = query.size ? `?${query.toString()}` : "";
  const response = await fetch(
    `${API_INTERNAL_URL}/api/v1/finance/transactions/${queryString}`,
    {
      cache: "no-store",
      headers: await requestHeaders(),
    },
  );

  if (response.status === 401 || response.status === 403) redirect("/login");
  if (!response.ok) throw new Error("No fue posible cargar los movimientos financieros.");

  return (await response.json()) as FinancialTransaction[];
}

export function getServerProduct(id: string): Promise<Product> {
  return getAuthenticated(`/api/v1/production/products/${id}/`, "No fue posible cargar el producto.");
}

export function getServerProducts(activeOnly = false): Promise<Product[]> {
  const query = activeOnly ? "?is_active=true" : "";
  return getAuthenticated(
    `/api/v1/production/products/${query}`,
    "No fue posible cargar los productos.",
  );
}

export function getServerProductionRecord(id: string): Promise<ProductionRecord> {
  return getAuthenticated(
    `/api/v1/production/records/${id}/`,
    "No fue posible cargar el registro de producción.",
  );
}

export function getServerProductionRecords(): Promise<ProductionRecord[]> {
  return getAuthenticated(
    "/api/v1/production/records/",
    "No fue posible cargar la producción.",
  );
}

export function getServerSale(id: string): Promise<Sale> {
  return getAuthenticated(`/api/v1/production/sales/${id}/`, "No fue posible cargar la venta.");
}

export function getServerSales(): Promise<Sale[]> {
  return getAuthenticated("/api/v1/production/sales/", "No fue posible cargar las ventas.");
}

export function getServerEmployees(activeOnly = false): Promise<Employee[]> {
  const query = activeOnly ? "?is_active=true" : "";
  return getAuthenticated(
    `/api/v1/payroll/employees/${query}`,
    "No fue posible cargar los empleados.",
  );
}

export function getServerEmployee(id: string): Promise<Employee> {
  return getAuthenticated(
    `/api/v1/payroll/employees/${id}/`,
    "No fue posible cargar el empleado.",
  );
}

export function getServerSalaryRates(employee?: string): Promise<SalaryRate[]> {
  const query = employee ? `?employee=${employee}` : "";
  return getAuthenticated(
    `/api/v1/payroll/salary-rates/${query}`,
    "No fue posible cargar las tarifas salariales.",
  );
}

export function getServerWorkEntries(workDate?: string): Promise<WorkEntry[]> {
  const query = workDate ? `?work_date=${workDate}` : "";
  return getAuthenticated(
    `/api/v1/payroll/work-entries/${query}`,
    "No fue posible cargar la asistencia.",
  );
}

export function getServerPayrollPeriods(): Promise<PayrollPeriod[]> {
  return getAuthenticated(
    "/api/v1/payroll/periods/",
    "No fue posible cargar las planillas.",
  );
}

export function getServerDashboardReport(): Promise<DashboardReport> {
  return getAuthenticated(
    "/api/v1/reports/dashboard/",
    "No fue posible cargar el resumen financiero.",
  );
}
