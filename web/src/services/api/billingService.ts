// Real invoice data, read from Flask (`app/services/billing_service.py`).
//
// The backend is the single source of truth: an invoice exists because a staff
// member created it through the API and a payment exists because a staff member
// recorded it. Nothing here is a demo array.
import { apiFetch } from './client';

export interface ApiResponse<T> {
  data: T;
}

export type InvoiceStatus = 'draft' | 'issued' | 'partially_paid' | 'paid' | 'void';

export interface InvoicePayment {
  id: string;
  amount: number;
  currency: string;
  method: string;
  reference: string | null;
  recordedBy: string | null;
  paidAt: string | null;
}

export interface Invoice {
  id: string;
  patientId: string;
  patientName?: string;
  invoiceNumber?: string;
  currency: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: InvoiceStatus;
  issuedAt: string | null;
  paidAt: string | null;
  dueAt: string | null;
  payments: InvoicePayment[];
}

export type PaymentMethod = 'cash' | 'mobile_money' | 'bank_transfer' | 'insurance' | 'waiver';

export interface BillingTotals {
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
  currency: string;
}

export async function listInvoices(patientId?: string): Promise<Invoice[]> {
  const query = patientId ? `?patient_id=${encodeURIComponent(patientId)}` : '';
  const response = await apiFetch<ApiResponse<Invoice[]>>(`/invoices${query}`);
  return response.data;
}

/** Sums are computed from the invoices actually returned by the backend. */
export function summarizeInvoices(invoices: Invoice[]): BillingTotals {
  return invoices.reduce<BillingTotals>(
    (acc, invoice) => ({
      totalBilled: acc.totalBilled + Number(invoice.totalAmount ?? 0),
      totalPaid: acc.totalPaid + Number(invoice.paidAmount ?? 0),
      outstanding: acc.outstanding + Number(invoice.balance ?? 0),
      currency: invoice.currency || acc.currency || 'TZS',
    }),
    { totalBilled: 0, totalPaid: 0, outstanding: 0, currency: 'TZS' },
  );
}

/** Records a payment against an invoice. Persisted by the backend. */
export async function recordPayment(
  invoiceId: string,
  payment: { amount: number; method: PaymentMethod; reference?: string; notes?: string },
): Promise<Invoice> {
  const response = await apiFetch<ApiResponse<{ invoice: Invoice }>>(
    `/invoices/${encodeURIComponent(invoiceId)}/payments`,
    { method: 'POST', body: JSON.stringify(payment) },
  );
  return response.data.invoice;
}

export function formatMoney(amount: number, currency = 'TZS'): string {
  return `${currency} ${Number(amount || 0).toLocaleString()}`;
}
