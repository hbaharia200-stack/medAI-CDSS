import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { AlertBanner } from '../components/common/AlertBanner';
import { useAppScrollRoot } from '../hooks/useScrollReveal';
import Reveal from '../components/marketing/Reveal';
import {
  formatMoney,
  listInvoices,
  summarizeInvoices,
  type Invoice,
} from '../services/api/billingService';

/**
 * Billing reads real `Invoice` rows from Flask. An invoice is listed here only
 * because staff created it through the API and (optionally) recorded payments
 * against it — there is no demo data behind this table.
 */
export default function BillingsPage() {
  const { t } = useTranslation();
  const scrollRoot = useAppScrollRoot();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    listInvoices()
      .then((rows) => { if (!cancelled) setInvoices(rows); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const totals = summarizeInvoices(invoices);
  const name = (invoice: Invoice) => invoice.patientName ?? invoice.patientId.slice(0, 8);
  const date = (invoice: Invoice) =>
    invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString() : '—';

  return (
    <div className="space-y-6">
      <div>
        <div className="overflow-hidden pb-1 pt-1"><h1 className="text-2xl font-extrabold text-heading">{t('nav.billings')}</h1></div>
        <p className="subtitle-typewriter text-sm text-ink-muted">{t('app.systemName')}</p>
      </div>

      {error ? <AlertBanner text={t('admin.loadError')} variant="warning" /> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Reveal root={scrollRoot} className="h-full">
          <Card className="h-full">
            <p className="text-sm font-semibold text-ink-muted">{t('billing.totalRevenue')}</p>
            <p className="mt-1 text-3xl font-extrabold text-ink">{formatMoney(totals.totalPaid, totals.currency)}</p>
          </Card>
        </Reveal>
        <Reveal root={scrollRoot} delayMs={90} className="h-full">
          <Card className="h-full">
            <p className="text-sm font-semibold text-ink-muted">{t('billing.totalBilled')}</p>
            <p className="mt-1 text-3xl font-extrabold text-ink">{formatMoney(totals.totalBilled, totals.currency)}</p>
          </Card>
        </Reveal>
        <Reveal root={scrollRoot} delayMs={180} className="h-full">
          <Card className="h-full">
            <p className="text-sm font-semibold text-ink-muted">{t('billing.outstanding')}</p>
            <p className="mt-1 text-3xl font-extrabold text-conf-medium">{formatMoney(totals.outstanding, totals.currency)}</p>
          </Card>
        </Reveal>
      </div>

      <Reveal root={scrollRoot} delayMs={90}>
      <Card title={t('billing.recentInvoices')}>
        {!loading && !error && invoices.length === 0 ? (
          <p className="py-4 text-sm text-ink-muted">{t('billing.empty')}</p>
        ) : null}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th>{t('billing.invoice')}</th>
                <th>{t('billing.patient')}</th>
                <th>{t('billing.date')}</th>
                <th>{t('billing.amount')}</th>
                <th>{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-line last:border-0">
                  <td className="font-bold text-ink">{invoice.id.slice(0, 8)}</td>
                  <td className="text-ink">{name(invoice)}</td>
                  <td className="text-ink-muted">{date(invoice)}</td>
                  <td className="font-semibold text-ink">{formatMoney(invoice.totalAmount, invoice.currency)}</td>
                  <td>
                    <Badge
                      label={invoice.status}
                      variant={invoice.status === 'paid' ? 'high' : invoice.status === 'issued' ? 'medium' : 'neutral'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile stacked cards — same fields, no horizontal scroll */}
        <div className="space-y-3 md:hidden">
          {invoices.map((invoice) => (
            <div key={invoice.id} className="rounded-xl border border-line bg-canvas p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-ink">{invoice.id.slice(0, 8)}</p>
                <Badge label={invoice.status} variant={invoice.status === 'paid' ? 'high' : 'medium'} />
              </div>
              <dl className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between gap-2"><dt className="text-ink-muted">{t('billing.patient')}</dt><dd className="truncate font-medium text-ink">{name(invoice)}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-ink-muted">{t('billing.date')}</dt><dd className="font-medium text-ink-muted">{date(invoice)}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-ink-muted">{t('billing.amount')}</dt><dd className="font-semibold text-ink">{formatMoney(invoice.totalAmount, invoice.currency)}</dd></div>
              </dl>
            </div>
          ))}
        </div>
      </Card>
      </Reveal>
    </div>
  );
}
