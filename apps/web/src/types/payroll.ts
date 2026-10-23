export type WorkEntryStatus = "PRESENT" | "ABSENT" | "HALF_DAY";
export type PayrollStatus = "DRAFT" | "APPROVED" | "PAID";

export interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  hire_date: string;
  is_active: boolean;
  current_daily_rate: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalaryRate {
  id: number;
  employee: number;
  employee_name: string;
  daily_rate: string;
  valid_from: string;
  valid_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkEntry {
  id: number;
  employee: number;
  employee_name: string;
  project: number;
  project_name: string;
  work_date: string;
  status: WorkEntryStatus;
  status_label: string;
  day_fraction: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface PayrollEmployeeSummary {
  employee: number;
  employee_name: string;
  worked_days: string;
  total_amount: string;
}

export interface PayrollProjectSummary {
  project: number;
  project_name: string;
  total_amount: string;
}

export interface PayrollSummary {
  employees: PayrollEmployeeSummary[];
  projects: PayrollProjectSummary[];
  grand_total: string;
  error?: string;
}

export interface PayrollPeriod {
  id: number;
  start_date: string;
  end_date: string;
  status: PayrollStatus;
  status_label: string;
  category: number | null;
  category_name: string;
  approved_by: string | null;
  approved_by_name: string;
  approved_at: string | null;
  paid_at: string | null;
  summary: PayrollSummary;
  created_at: string;
  updated_at: string;
}

export interface EmployeeInput {
  first_name: string;
  last_name: string;
  phone: string;
  hire_date: string;
  is_active: boolean;
  new_daily_rate?: string;
  rate_valid_from?: string;
}

export interface BulkAttendanceInput {
  work_date: string;
  entries: Array<{
    employee: number;
    project: number;
    status: WorkEntryStatus;
  }>;
}
