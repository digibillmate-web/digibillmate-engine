'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteSite } from '@/app/sites/site-actions';

export default function DeleteSiteDialog({
  open,
  onClose,
  site,
}: {
  open: boolean;
  onClose: () => void;
  site: { id: string; name: string };
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const matches = typed.trim() === site.name;

  async function confirm() {
    setBusy(true);
    setError(null);

    const result = await deleteSite(site.id, typed);

    if (!result.ok) {
      setError(result.error ?? 'Could not delete the site.');
      setBusy(false);
      return;
    }

    onClose();
    router.refresh();
  }

  return (
    <dialog className="modal modal--danger" ref={ref} onCancel={onClose} onClose={onClose}>
      <h2 className="modal__title">Delete site permanently</h2>

      <div className="alert alert--error" role="alert">
        This cannot be undone. It removes the site, all of its blocks, its deploy hook and
        every image it uploaded. Archive instead if you only want it out of the way.
      </div>

      {error && (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      )}

      <div className="ef">
        <label className="ef__label" htmlFor="confirm-name">
          Type <strong>{site.name}</strong> to confirm
        </label>
        <input
          id="confirm-name"
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
          {busy ? 'Deleting…' : 'Delete this site'}
        </button>
        <button className="btn btn--ghost" type="button" onClick={onClose} disabled={busy}>
          Cancel
        </button>
      </div>
    </dialog>
  );
}
