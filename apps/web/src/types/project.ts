export type ProjectType =
  | "produccion_avicola"
  | "cultivo_citricos"
  | "infraestructura"
  | "administracion";

export type ProjectStatus = "draft" | "active" | "completed";

export interface Project {
  id: number;
  code: string;
  name: string;
  description: string;
  type: ProjectType;
  type_label: string;
  status: ProjectStatus;
  status_label: string;
  start_date: string | null;
  end_date: string | null;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectInput {
  name: string;
  description: string;
  type: ProjectType;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
}

export type UpdateProjectInput = Partial<CreateProjectInput>;

export interface ProjectMetrics {
  project: number;
  operating_expense: string;
  total_produced: string;
  confirmed_sales: string;
  unit_cost: string;
  operating_result: string;
  operating_roi: string;
}
