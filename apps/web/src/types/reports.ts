export type DashboardReport = {
  period: { current_month: string; cash_flow_months: number };
  permissions: { can_view_payroll: boolean };
  kpis: {
    month_income: string;
    month_expenses: string;
    pending_payroll: { amount: string; missing_rate_entries: number } | null;
  };
  cash_flow: Array<{
    month: string;
    label: string;
    income: string;
    expenses: string;
  }>;
  active_profitability: Array<{
    project: number;
    project_name: string;
    operating_cost: string;
    confirmed_sales: string;
    operating_result: string;
  }>;
  cost_distribution: Array<{
    category: number;
    category_name: string;
    amount: string;
    percentage: string;
  }>;
};
