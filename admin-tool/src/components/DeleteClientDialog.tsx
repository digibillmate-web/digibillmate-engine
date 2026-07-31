'use client';

/**
 * Client deletion.
 *
 * When the client still owns sites the dialog explains what is blocking it and
 * names them, rather than presenting a dead button. The confirmation itself is
 * the same typed-name pattern as site deletion.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteClientRecord } from '@/app/clients/client-actions';

export default function DeleteClientDialog({
  open,
  onClose,
  client,
}: {
  open: boolean;
  onClose: () => void;
  client: { id: string; name: string; siteNames: string[] };
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blocked = client.siteNames.length > 0;
  const matches = typed.trim() === client.name;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      setTyped('');
      setError(null);
      el.showModal();
    }
    if (!open && el.open) el.close();
  }, [open]);

  async function confirm() {
    setBusy(true);
    setError(null);

    const result = await deleteClientRecord(client.id, typed);

    if (!result.ok) {
      setError(result.error ?? 'Could not delete the client.');
      setBusy(false);
      return;
    }

    setBusy(false);
    onClose();
    router.refresh();
  }

  return (
    <dialog className="modal modal--danger" ref={ref} onCancel={onClose} onClose={onClose}>
      <h2 className="modal__title">Delete client</h2>

      {blocked ? (
        <>
          <div className="alert alert--error" role="alert">
            <strong>{client.name}</strong> still owns {client.siteNames.length}{' '}
            {client.siteNames.length === 1 ? 'site' : 'sites'}. Deleting the client would delete{' '}
            {client.siteNames.length === 1 ? 'it' : 'them'} and all of their content too, so it is
            blocked until {client.siteNames.length === 1 ? 'it is' : 'they are'} removed or
            reassigned.
          </div>

          <ul className="blocklist">
            {client.siteNames.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>

          <div className="form-bar">
            <button className="btn btn--ghost" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="alert alert--error" role="alert">
            This cannot be undone. {client.name} owns no sites, so only the client record is
            removed.
          </div>

          {error && (
            <div className="alert alert--error" role="alert">
              {error}
            </div>
          )}

          <div className="ef">
            <label className="ef__label" htmlFor="confirm-client">
              Type <strong>{client.name}</strong> to confirm
            </label>
            <input
              id="confirm-client"
              className="ef__input"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>

          <div className="form-bar">
            <button
              className="btn btn--danger"
              type="button"
              onClick={confirm}
              disabled={busy || !matches}
            >
              {busy ? 'Deleting…' : 'Delete this client'}
            </button>
            <button className="btn btn--ghost" type="button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
