"use client";

import { useState, useCallback } from "react";
import { workspaceFetch, getCustomerToken } from "@/lib/workspace-api";
import { API_PATHS } from "@/lib/api-paths";

export interface CatalogPlan {
  id: number;
  name: string;
  interval: string;
  amount: number;
  currency: string;
  billing_type: string;
  unit: string | null;
}

export interface CatalogProduct {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  slug: string | null;
  fulfillment_handler: string | null;
  fulfillment_strategy: string | null;
  plans: CatalogPlan[];
}

export interface PurchaseResult {
  contract_id: number | null;
  contract_item_id: number | null;
  invoice_id: number;
  total: number;
  currency: string;
  status: string;
  reused: boolean;
}

export interface MyServiceItem {
  id: number;
  product_name: string | null;
  description: string | null;
  quantity: number;
  unit_amount: number | null;
  source: string | null;
  invoice_id: number | null;
  invoice_status: string | null;
  invoice_total: number | null;
  fulfillment_status: string | null;
  fulfillment_step: string | null;
}

export function useMarketplace() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const apiError = async (res: Response): Promise<string> => {
    try {
      const data = await res.json();
      const d = (data?.detail ?? data) as { code?: string; message?: string };
      return d?.message ?? d?.code ?? `HTTP ${res.status}`;
    } catch {
      return `HTTP ${res.status}`;
    }
  };

  const getCatalog = useCallback(async (): Promise<CatalogProduct[] | null> => {
    const token = getCustomerToken();
    if (!token) return null;
    setLoading(true);
    setError("");
    try {
      const res = await workspaceFetch(API_PATHS.MARKETPLACE.CATALOG, { token });
      if (!res.ok) {
        setError(await apiError(res));
        return null;
      }
      return (await res.json()) as CatalogProduct[];
    } catch {
      setError("load");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const purchase = useCallback(
    async (input: {
      product_id: number;
      price_plan_id: number;
      quantity: number;
      idempotency_key: string;
    }): Promise<{ data: PurchaseResult | null; error: string | null }> => {
      const token = getCustomerToken();
      if (!token) return { data: null, error: "no-token" };
      setLoading(true);
      setError("");
      try {
        const res = await workspaceFetch(API_PATHS.MARKETPLACE.PURCHASES, {
          token,
          method: "POST",
          body: JSON.stringify(input),
        });
        const data = (await res.json().catch(() => null)) as PurchaseResult | null;
        if (!res.ok) {
          const msg = await apiError(res);
          setError(msg);
          return { data, error: msg };
        }
        return { data, error: null };
      } catch {
        setError("load");
        return { data: null, error: "load" };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getMyServices = useCallback(async (): Promise<MyServiceItem[] | null> => {
    const token = getCustomerToken();
    if (!token) return null;
    setLoading(true);
    setError("");
    try {
      const res = await workspaceFetch(API_PATHS.MARKETPLACE.PURCHASES, { token });
      if (!res.ok) {
        setError(await apiError(res));
        return null;
      }
      return (await res.json()) as MyServiceItem[];
    } catch {
      setError("load");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, getCatalog, purchase, getMyServices };
}
