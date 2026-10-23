export type TransactionType = "INCOME" | "EXPENSE" | "INVESTMENT";
export type TransactionStatus = "DRAFT" | "POSTED" | "VOID";

export interface FinancialCategory {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TransactionAttachment {
  id: number;
  transaction: number;
  file_url: string;
  original_name: string;
  content_type: string;
  size: number;
  uploaded_by: string | null;
  uploaded_by_name: string;
  uploaded_at: string;
}

export interface FinancialTransaction {
  id: number;
  project: number;
  project_name: string;
  category: number;
  category_name: string;
  type: TransactionType;
  type_label: string;
  status: TransactionStatus;
  status_label: string;
  amount: string;
  transaction_date: string;
  description: string;
  supplier_or_customer: string;
  created_by: string;
  created_by_name: string;
  attachments: TransactionAttachment[];
  created_at: string;
  updated_at: string;
}

export interface FinanceFilters {
  project?: string;
  status?: TransactionStatus;
  type?: TransactionType;
}
