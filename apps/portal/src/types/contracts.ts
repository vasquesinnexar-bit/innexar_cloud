export interface ContractItem {
  id: number;
  product_name: string | null;
  plan_name: string | null;
  description: string | null;
  quantity: number;
  unit_amount: number | null;
}

export interface Contract {
  id: number;
  status: string;
  currency: string | null;
  billing_interval: string | null;
  billing_day: number | null;
  created_at: string;
  items: ContractItem[];
}
