'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { renameSite } from '@/app/sites/[siteId]/rename-actions';

export default function RenameSiteForm({
  siteId,
  initialName,
}: {
  siteId: string;
  initialName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [saved, setSaved] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const dirty = name.trim() !== saved;

  async function onSave() {
    setBusy(true);
    setMessage(null);

    const result = await renameSite(siteId, name);

    if (result.ok) {
      setSaved(name.trim());
      setMessage({ kind: 'ok', text: 'Saved' });
      router.refresh();
    } else {
      setMessage({ kind: 'error', text: result.error ?? 'Could not save' });
    }

    setBusy(false);
  }

  return (
    <div className="card settings-card">
      <h2 className="settings-card__title">Site name</h2>
      <p className="newsite__hint">
        Internal label only — not shown on the built site. That&apos;s{' '}
        <code>header_nav.business_name</code> and <code>footer.business_name</code>, edited on
        the Content tab.
      </p>

      <div className="ef">
        <input
          className="ef__input"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setMessage(null);
          }}
        />
      </div>

      <div className="form-bar">
        <button className="btn btn--primary btn--sm" type="button" onClick={onSave} disabled={busy || !dirty}>
          {busy ? 'Saving…' : 'Save name'}
        </button>
        {message && (
          <span className={`form-bar__note form-bar__note--${message.kind}`}>{message.text}</span>
        )}
      </div>
    </div>
  );
}
