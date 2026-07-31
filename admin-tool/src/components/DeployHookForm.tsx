'use client';

/**
 * Sets the Cloudflare deploy hook for one site.
 *
 * The URL is a capability, so it is masked by default — visible on request,
 * not by default on a screen someone might be sharing.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveDeployHook } from '@/app/sites/[siteId]/hook-actions';

export default function DeployHookForm({
  siteId,
  initialUrl,
}: {
  siteId: string;
  initialUrl: string;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [saved, setSaved] = useState(initialUrl);
  const [reveal, setReveal] = useState(false);
  const [open, setOpen] = useState(!initialUrl);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const dirty = url.trim() !== saved.trim();

  async function onSave() {
    setBusy(true);
    setMessage(null);

    const result = await saveDeployHook(siteId, url);

    if (result.ok) {
      setSaved(url.trim());
      setMessage({ kind: 'ok', text: result.hasHook ? 'Deploy hook saved' : 'Deploy hook cleared' });
      router.refresh();
    } else {
      setMessage({ kind: 'error', text: result.error ?? 'Could not save' });
    }

    setBusy(false);
  }

  return (
    <div className="hookform">
      <button
        type="button"
        className="hookform__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? '▾' : '▸'} Deploy hook {saved ? '(set)' : '(not set)'}
      </button>

      {open && (
        <div className="hookform__body">
          <p className="newsite__hint">
            Each site needs its own Cloudflare Pages deploy hook — a hook rebuilds one fixed
            project and cannot be told which site to build. Stored in an admin-only table.
          </p>

          <div className="hookform__row">
            <input
              className="ef__input"
              type={reveal ? 'text' : 'password'}
              value={url}
              placeholder="https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/…"
              onChange={(e) => {
                setUrl(e.target.value);
                setMessage(null);
              }}
            />
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setReveal((v) => !v)}
            >
              {reveal ? 'Hide' : 'Show'}
            </button>
          </div>

          <div className="form-bar">
            <button
              className="btn btn--primary btn--sm"
              type="button"
              onClick={onSave}
              disabled={busy || !dirty}
            >
              {busy ? 'Saving…' : 'Save hook'}
            </button>
            {saved && (
              <button
                className="btn btn--ghost btn--sm"
                type="button"
                disabled={busy}
                onClick={() => {
                  setUrl('');
                  setMessage(null);
                }}
              >
                Clear
              </button>
            )}
            {message && (
              <span className={`form-bar__note form-bar__note--${message.kind}`}>
                {message.text}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
