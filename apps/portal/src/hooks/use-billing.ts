import { useState, useEffect, useCallback } from "react";
import { useWorkspaceApi, workspaceFetch, getCustomerToken } from "@/lib/workspace-api";
import { API_PATHS } from "@/lib/api-paths";
import { getDisplayInvoiceNumber } from "@/lib/invoice-format";
import type { Invoice, StatusFilter } from "@/types/billing";

export function useBilling() {
  const isWorkspaceApi = useWorkspaceApi();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const fetchInvoices = useCallback(async () => {
    const token = getCustomerToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      if (!isWorkspaceApi) {
        setLoading(false);
        return;
      }
      const res = await workspaceFetch(API_PATHS.INVOICES.LIST, { token });
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.invoices || [];
      setInvoices(
        list.map((inv: { id: number; status: string; due_date?: string; total: number; currency?: string }) => ({
          id: inv.id,
          project_name: `Fatura #${getDisplayInvoiceNumber(inv.id)}`,
          amount: Number(inv.total),
          currency: inv.currency || "USD",
          status: (inv.status === "paid"
            ? "paid"
            : inv.status === "past_due" || inv.status === "overdue"
              ? "overdue"
              : "pending") as Invoice["status"],
          date: inv.due_date || "",
          due_date: inv.due_date || "",
          isErp: true,
        }))
      );
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [isWorkspaceApi]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices, refreshTrigger]);

  const filteredInvoices =
    statusFilter === "all"
      ? invoices
      : statusFilter === "paid"
        ? invoices.filter((i) => i.status === "paid")
        : invoices.filter((i) => i.status !== "paid");
  // Totais agrupados por moeda (nunca somar moedas diferentes).
  const totalsByCurrency: Record<string, { paid: number; pending: number }> = {};
  for (const i of invoices) {
    const cur = i.currency || "USD";
    totalsByCurrency[cur] ??= { paid: 0, pending: 0 };
    if (i.status === "paid") totalsByCurrency[cur].paid += i.amount;
    else totalsByCurrency[cur].pending += i.amount;
  }
  const dominantCurrency =
    Object.entries(totalsByCurrency).sort(
      (a, b) => b[1].paid + b[1].pending - (a[1].paid + a[1].pending)
    )[0]?.[0] ?? "USD";
  const totalPaid = totalsByCurrency[dominantCurrency]?.paid ?? 0;
  const totalPending = totalsByCurrency[dominantCurrency]?.pending ?? 0;

  return {
    invoices,
    loading,
    isWorkspaceApi,
    statusFilter,
    setStatusFilter,
    filteredInvoices,
    totalPaid,
    totalPending,
    totalsByCurrency,
    dominantCurrency,
    refresh: () => setRefreshTrigger((t) => t + 1),
  };
}
