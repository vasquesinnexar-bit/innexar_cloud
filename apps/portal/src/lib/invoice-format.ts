const INVOICE_BASE_OFFSET = 1354;

export function getDisplayInvoiceNumber(invoiceId: number): number {
  return invoiceId + INVOICE_BASE_OFFSET;
}

export function formatInvoiceCode(invoiceId: number): string {
  return `INV-${getDisplayInvoiceNumber(invoiceId).toString().padStart(4, "0")}`;
}
