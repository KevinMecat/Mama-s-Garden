export interface Product {
  id: number;
  name: string;
  unit_of_measure: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductionRecord {
  id: number;
  project: number;
  project_name: string;
  product: number;
  product_name: string;
  unit_of_measure: string;
  production_date: string;
  quantity: string;
  notes: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: number;
  project: number;
  project_name: string;
  product: number;
  product_name: string;
  unit_of_measure: string;
  sale_date: string;
  quantity: string;
  unit_price: string;
  total_amount: string;
  customer: string;
  category_id: number;
  category_name: string;
  status: "DRAFT" | "POSTED" | "VOID";
  status_label: string;
  transaction: number;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface ProductInput {
  name: string;
  unit_of_measure: string;
  is_active: boolean;
}

export interface ProductionRecordInput {
  project: number;
  product: number;
  production_date: string;
  quantity: string;
  notes: string;
}

export interface SaleInput {
  project: number;
  product: number;
  category: number;
  sale_date: string;
  quantity: string;
  unit_price: string;
  customer: string;
  status: "DRAFT" | "POSTED" | "VOID";
}
