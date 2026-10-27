import { apiFetch } from "@/lib/api-client";
import { getCsrfToken } from "@/lib/auth-api";

export type State = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
export interface WorkRecord {
  id: number;
  result: string;
  criterion_met: boolean;
  quantity: string | null;
  incidents: string;
  created_at: string;
  times: { employee: number; minutes: number }[];
  review: {
    accepted: boolean;
    accepted_quantity: string | null;
    observations: string;
    reviewed_by: string;
    reviewed_by_name?: string;
    created_at: string;
  } | null;
}
export interface Task {
  id: number;
  title: string;
  activity: string;
  project: number;
  project_name: string;
  location: string;
  scheduled_date: string;
  priority: string;
  instructions: string;
  acceptance_criteria: string;
  target_quantity: string | null;
  unit: string;
  estimated_minutes: number | null;
  state: State;
  blocked_reason: string;
  cancelled_reason: string;
  cancelled_at: string | null;
  revision: number;
  assignees: { id: number; name: string }[];
  work_logs: WorkRecord[];
  warnings: string[];
  accepted_quantity: string | null;
  hours: string;
  productivity: string | null;
  crew: boolean;
  events: {
    action: string;
    actor: string;
    actor_name?: string;
    created_at: string;
    detail: Record<string, unknown>;
  }[];
}
export interface Options {
  administrator: boolean;
  day_minutes: number;
  projects: { id: number; name: string; status: string }[];
  employees: { id: number; name: string; active: boolean }[];
  accounts?: { id: string; name: string }[];
  links?: { employee_id: number; user_id: string }[];
}
export interface TaskPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: Task[];
}

function message(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      const found = message(child);
      if (found) return found;
    }
  }
}
export async function workforce<T>(
  route: string,
  body?: Record<string, unknown>,
  method = "POST",
  signal?: AbortSignal,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body) {
    headers["Content-Type"] = "application/json";
    headers["X-CSRFToken"] = await getCsrfToken();
  }
  const response = await apiFetch(`/api/v1/workforce/tasks/${route}`, {
    method: body ? method : "GET",
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      message(data) ??
        `No se pudo completar la solicitud (${response.status}).`,
    );
  return data as T;
}
