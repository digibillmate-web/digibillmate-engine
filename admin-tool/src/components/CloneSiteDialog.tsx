'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cloneSite } from '@/app/sites/clone-actions';
import { normaliseSubdomain } from '@/lib/site-provisioning';

export interface ClientOption {
  id: string;
  name: string;
}

export default function CloneSiteDialog({
  open,
  onClose,
  source,
  clients,
}: {
  open: boolean;
  onClose: () => void;
  source: { id: string; name: string; clientId: string | null };
  clients: ClientOption[];
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);

  const [name, setName] = useState(`${source.name} (copy)`);
  // Seeded from the pre-filled name; onNameChange only fires on typing, so
  // without this the field would start empty despite the name being set.
  const [subdomain, setSubdomain] = useState(normaliseSubdomain(`${source.name}-copy`));
  const [touched, setTouched] = useState(false);
  const [clientId, setClientId] = useState(source.clientId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  function onNameChange(value: string) {
    setName(value);
    if (!touched) setSubdomain(normaliseSubdomain(value));
  }

  async function submit() {
    setBusy(true);
    setError(null);

    const result = await cloneSite({
      sourceSiteId: source.id,
      name,
      subdomain,
      clientId: clientId || undefined,
    });

    if (!result.ok) {
      setError(result.error ?? 'Could not clone the site.');
      setBusy(false);
      return;
    }

    onClose();
    router.push(`/sites/${result.siteId}`);
    router.refresh();
  }

  return (
    <dialog className="modal" ref={ref} onCancel={onClose} onClose={onClose}>
      <h2 className="modal__title">Clone site</h2>
      <p className="modal__sub">
        Copies the blocks and theme of <strong>{source.name}</strong> into a new draft site.
        The deploy hook and publish history are not copied — they belong to the original&apos;s
        Cloudflare project.
      </p>

      {error && (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      )}

      <div className="ef">
        <label className="ef__label" htmlFor="clone-name">
          New site name<span className="req">*</span>
        </label>
        <input
          id="clone-name"
          className="ef__input"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </div>

      <div className="ef">
        <label className="ef__label" htmlFor="clone-subdomain">
          New subdomain<span className="req">*</span>
        </label>
        <input
          id="clone-subdomain"
          className="ef__input"
          placeholder="mariacars-copy"
          value={subdomain}
          onChange={(e) => {
            setTouched(true);
            setSubdomain(e.target.value.toLowerCase());
          }}
        />
      </div>

      <div className="ef">
        <label className="ef__label" htmlFor="clone-client">
          Client
        </label>
        <select
          id="clone-client"
          className="ef__input"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <p className="newsite__hint">Defaults to the source site&apos;s client.</p>
      </div>

      <div className="form-bar">
        <button className="btn btn--primary" type="button" onClick={submit} disabled={busy}>
          {busy ? 'Cloning…' : 'Clone site'}
        </button>
        <button className="btn btn--ghost" type="button" onClick={onClose} disabled={busy}>
          Cancel
        </button>
      </div>
    </dialog>
  );
}
