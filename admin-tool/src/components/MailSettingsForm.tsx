'use client';

/**
 * Mail settings and usage for one site.
 *
 * Usage sits next to the controls rather than on a separate screen: a limit
 * with no visible count is a number someone guesses at, and the question it
 * answers ("are we near it?") is the reason to open this tab at all.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveMailSettings } from '@/app/sites/[siteId]/mail-actions';

export interface MailUsage {
  sentThisMonth: number;
  totalEnquiries: number;
  failed: number;
  skipped: number;
  lastEnquiryAt: string | null;
}

export default function MailSettingsForm({
  siteId,
  initialEmail,
  initialNotify,
  initialLimit,
  usage,
}: {
  siteId: string;
  initialEmail: string;
  initialNotify: boolean;
  initialLimit: string;
  usage: MailUsage;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [notify, setNotify] = useState(initialNotify);
  const [limit, setLimit] = useState(initialLimit);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const dirty =
    email !== initialEmail || notify !== initialNotify || limit !== initialLimit;

  const cap = limit.trim() === '' ? null : Number(limit);
  const remaining = cap === null ? null : Math.max(cap - usage.sentThisMonth, 0);
  const atLimit = cap !== null && usage.sentThisMonth >= cap;

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveMailSettings(siteId, { email, notify, monthlyLimit: limit });
      if (!result.ok) {
        setMessage({ kind: 'error', text: result.error ?? 'Could not save.' });
        return;
      }
      setMessage({ kind: 'ok', text: 'Mail settings saved' });
      router.refresh();
    });
  }

  return (
    <>
      <section className="card settings-card">
        <h2 className="settings-card__title">Enquiry notifications</h2>
        <p className="settings-card__hint">
          Enquiries are always recorded, whatever these say. These control the email that
          announces them.
        </p>

        <div className="ef">
          <label className="ef__label" htmlFor="mail-to">
            Send enquiries to
          </label>
          <input
            id="mail-to"
            className="ef__input"
            type="email"
            value={email}
            placeholder="owner@example.com"
            disabled={pending}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="newsite__hint">
            This site&rsquo;s own inbox. Leave blank to record enquiries without emailing anyone.
          </p>
        </div>

        <div className="ef">
          <label className="ef__check">
            <input
              type="checkbox"
              checked={notify}
              disabled={pending}
              onChange={(e) => setNotify(e.target.checked)}
            />
            <span>Email me when an enquiry arrives</span>
          </label>
          <p className="newsite__hint">
            Turning this off pauses email without losing a single enquiry.
          </p>
        </div>

        <div className="ef">
          <label className="ef__label" htmlFor="mail-limit">
            Monthly email limit
          </label>
          <input
            id="mail-limit"
            className="ef__input"
            type="number"
            min={0}
            step={1}
            value={limit}
            placeholder="No limit"
            disabled={pending}
            onChange={(e) => setLimit(e.target.value)}
          />
          <p className="newsite__hint">
            All sites notify through one sending account, so a runaway form on one site can
            use up the allowance for the rest. Blank means no limit; 0 stops email entirely.
          </p>
        </div>

        <div className="form-bar">
          <button
            className="btn btn--primary"
            type="button"
            onClick={save}
            disabled={pending || !dirty}
          >
            {pending ? 'Saving…' : 'Save mail settings'}
          </button>

          {message && (
            <span className={`form-bar__note form-bar__note--${message.kind}`}>
              {message.text}
            </span>
          )}
        </div>
      </section>

      <section className="card settings-card">
        <h2 className="settings-card__title">Usage</h2>

        {atLimit && (
          <div className="alert alert--info" role="status">
            This site has reached its monthly limit. Enquiries are still being recorded —
            raise the limit to resume email.
          </div>
        )}

        <dl className="mailusage">
          <div>
            <dt>Emails sent this month</dt>
            <dd>
              {usage.sentThisMonth}
              {cap !== null && <span className="mailusage__cap"> of {cap}</span>}
            </dd>
          </div>
          <div>
            <dt>Remaining this month</dt>
            <dd>{remaining === null ? 'No limit' : remaining}</dd>
          </div>
          <div>
            <dt>Enquiries recorded (all time)</dt>
            <dd>{usage.totalEnquiries}</dd>
          </div>
          <div>
            <dt>Not emailed</dt>
            {/* Failed and skipped are separated because they need different
                actions: failed is a delivery problem, skipped is a setting. */}
            <dd>
              {usage.failed} failed · {usage.skipped} skipped
            </dd>
          </div>
          <div>
            <dt>Last enquiry</dt>
            <dd>
              {usage.lastEnquiryAt
                ? new Date(usage.lastEnquiryAt).toLocaleString()
                : 'None yet'}
            </dd>
          </div>
        </dl>
      </section>
    </>
  );
}
