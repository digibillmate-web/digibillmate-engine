'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { renameSite, changeSubdomain } from '@/app/sites/[siteId]/rename-actions';
import { normaliseSubdomain } from '@/lib/site-provisioning';

type Message = { kind: 'ok' | 'error'; text: string } | null;

export default function RenameSiteForm({
  siteId,
  initialName,
  initialSubdomain,
}: {
  siteId: string;
  initialName: string;
  initialSubdomain: string;
}) {
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [nameBusy, setNameBusy] = useState(false);
  const [nameMessage, setNameMessage] = useState<Message>(null);

  const [subdomain, setSubdomain] = useState(initialSubdomain);
  const [savedSubdomain, setSavedSubdomain] = useState(initialSubdomain);
  const [subBusy, setSubBusy] = useState(false);
  const [subMessage, setSubMessage] = useState<Message>(null);

  const nameDirty = name.trim() !== savedName;
  const subDirty = subdomain.trim() !== savedSubdomain;

  async function saveName() {
    setNameBusy(true);
    setNameMessage(null);

    const result = await renameSite(siteId, name);

    if (result.ok) {
      setSavedName(name.trim());
      setNameMessage({ kind: 'ok', text: 'Saved' });
      router.refresh();
    } else {
      setNameMessage({ kind: 'error', text: result.error ?? 'Could not save' });
    }

    setNameBusy(false);
  }

  async function saveSubdomain() {
    setSubBusy(true);
    setSubMessage(null);

    const result = await changeSubdomain(siteId, subdomain);

    if (result.ok) {
      setSavedSubdomain(subdomain.trim().toLowerCase());
      setSubMessage({ kind: 'ok', text: 'Subdomain updated' });
      router.refresh();
    } else {
      setSubMessage({ kind: 'error', text: result.error ?? 'Could not save' });
    }

    setSubBusy(false);
  }

  return (
    <>
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
              setNameMessage(null);
            }}
          />
        </div>

        <div className="form-bar">
          <button
            className="btn btn--primary btn--sm"
            type="button"
            onClick={saveName}
            disabled={nameBusy || !nameDirty}
          >
            {nameBusy ? 'Saving…' : 'Save name'}
          </button>
          {nameMessage && (
            <span className={`form-bar__note form-bar__note--${nameMessage.kind}`}>
              {nameMessage.text}
            </span>
          )}
        </div>
      </div>

      <div className="card settings-card">
        <h2 className="settings-card__title">Subdomain</h2>
        <p className="newsite__hint">
          The site&apos;s address, and the name of its exported file. Lowercase letters, numbers
          and hyphens; must be unique across all sites.
        </p>

        <div className="ef">
          <input
            className="ef__input"
            value={subdomain}
            onChange={(e) => {
              setSubdomain(e.target.value.toLowerCase());
              setSubMessage(null);
            }}
            onBlur={(e) => setSubdomain(normaliseSubdomain(e.target.value))}
          />
        </div>

        {subDirty && (
          <div className="alert alert--info" role="status">
            Changing this does not move anything that already points at{' '}
            <strong>{savedSubdomain}</strong> — a Cloudflare project or DNS record set up for the
            old value keeps using it until you update it there too.
          </div>
        )}

        <div className="form-bar">
          <button
            className="btn btn--primary btn--sm"
            type="button"
            onClick={saveSubdomain}
            disabled={subBusy || !subDirty}
          >
            {subBusy ? 'Saving…' : 'Save subdomain'}
          </button>
          {subDirty && (
            <button
              className="btn btn--ghost btn--sm"
              type="button"
              onClick={() => {
                setSubdomain(savedSubdomain);
                setSubMessage(null);
              }}
              disabled={subBusy}
            >
              Revert
            </button>
          )}
          {subMessage && (
            <span className={`form-bar__note form-bar__note--${subMessage.kind}`}>
              {subMessage.text}
            </span>
          )}
        </div>
      </div>
    </>
  );
}
