import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { AlertBanner } from '../../components/common/AlertBanner';
import { Icons } from '../../components/common/Icons';
import SiteHeader from '../../components/marketing/SiteHeader';
import SiteFooter from '../../components/marketing/SiteFooter';
import { submitContactMessage } from '../../services/api/contactService';

export default function ContactPage() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  /**
   * The message is really persisted by `POST /api/contact-messages` before any
   * success state is shown. This form previously only flipped local React
   * state, so the UI claimed a message had been sent when nothing was stored.
   */
  const onSend = async () => {
    if (state === 'sending') return;
    setState('sending');
    setError(null);
    try {
      await submitContactMessage({ name: name.trim(), message: message.trim() });
      setState('sent');
    } catch (cause) {
      setState('idle');
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : t('contact.sendError'),
      );
    }
  };

  return (
    <div className="min-h-screen bg-canvas">
      <SiteHeader />
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <span className="inline-flex items-center rounded-full bg-primary-light px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            {t('contact.badge')}
          </span>
          <h1 className="mt-4 text-3xl font-extrabold text-heading md:text-4xl">{t('contact.headline')}</h1>
          <p className="mt-3 max-w-2xl text-base text-ink-muted">{t('contact.subheadline')}</p>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-14 md:grid-cols-2">
        <Card title={t('contact.infoTitle')}>
          <ul className="space-y-4 text-sm">
            <ContactRow icon="phoneCall" label={t('contact.phoneLabel')} value={t('contact.phoneValue')} />
            <ContactRow icon="mail" label={t('contact.emailLabel')} value={t('contact.emailValue')} />
            <ContactRow icon="mapPin" label={t('contact.addressLabel')} value={t('contact.addressValue')} />
            <ContactRow icon="calendarClock" label={t('contact.hoursLabel')} value={t('contact.hoursValue')} />
          </ul>
        </Card>
        <Card title={t('contact.formTitle')}>
          <p className="mb-4 text-sm text-ink-muted">{t('contact.formDesc')}</p>
          {error ? <div className="mb-4"><AlertBanner text={error} variant="warning" /></div> : null}
          {state === 'sent' ? (
            <div className="rounded-xl bg-primary-light px-4 py-4 text-sm font-medium text-primary">
              {t('contact.sentLabel')}
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">{t('contact.nameLabel')}</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('contact.namePlaceholder')}
                  maxLength={120}
                  className="h-12 w-full rounded-xl border-2 border-line bg-canvas px-4 focus:border-primary focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">{t('contact.messageLabel')}</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('contact.messagePlaceholder')}
                  rows={4}
                  maxLength={4000}
                  className="w-full rounded-xl border-2 border-line bg-canvas px-4 py-3 focus:border-primary focus:outline-none"
                />
              </label>
              <Button
                label={state === 'sending' ? t('common.sending') : t('contact.sendLabel')}
                onClick={() => void onSend()}
                disabled={state === 'sending'}
              />
            </div>
          )}
        </Card>
      </section>
      <SiteFooter />
    </div>
  );
}

function ContactRow({ icon, label, value }: { icon: keyof typeof Icons; label: string; value: string }) {
  const Icon = Icons[icon] ?? Icons.mail;
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
        <Icon width={18} height={18} />
      </span>
      <span>
        <span className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">{label}</span>
        <span className="block font-semibold text-ink">{value}</span>
      </span>
    </li>
  );
}
