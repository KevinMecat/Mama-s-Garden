import { apiFetch } from "@/lib/api-client";
import { getCsrfToken } from "@/lib/auth-api";
import type { CreateProjectInput, Project, UpdateProjectInput } from "@/types/project";

const PROJECTS_ROOT = "/api/v1/projects";

type ErrorPayload = Record<string, string | string[] | undefined>;

export class ProjectApiError extends Error {}

async function getErrorMessage(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as ErrorPayload;
  for (const value of Object.values(payload)) {
    if (Array.isArray(value) && value[0]) return value[0];
    if (typeof value === "string") return value;
  }
  return "No fue posible guardar el proyecto. Intenta nuevamente.";
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const csrfToken = await getCsrfToken();
  const response = await apiFetch(`${PROJECTS_ROOT}/`, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) throw new ProjectApiError(await getErrorMessage(response));
  return (await response.json()) as Project;
}

async function mutateProject(
  id: number,
  method: "PATCH" | "DELETE",
  input?: UpdateProjectInput,
) {
  const csrfToken = await getCsrfToken();
  const response = await apiFetch(`${PROJECTS_ROOT}/${id}/`, {
    method,
    cache: "no-store",
    credentials: "include",
    headers: {
      ...(input ? { "Content-Type": "application/json" } : {}),
      "X-CSRFToken": csrfToken,
    },
    body: input ? JSON.stringify(input) : undefined,
  });
  if (!response.ok) throw new ProjectApiError(await getErrorMessage(response));
  return response.status === 204 ? null : ((await response.json()) as Project);
}

export function updateProject(id: number, input: UpdateProjectInput) {
  return mutateProject(id, "PATCH", input);
}

export function deleteProject(id: number) {
  return mutateProject(id, "DELETE");
}
