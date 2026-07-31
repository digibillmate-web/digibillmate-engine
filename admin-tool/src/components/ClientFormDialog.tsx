'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientRecord, updateClientRecord, type ClientInput } from '@/app/clients/client-actions';

export interface ClientRecord {
  id: string;
  name: string;
  business_type: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
}

const EMPTY: ClientInput = {
  name: '',
  businessType: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  notes: '',
};

function toInput(client: ClientRecord | null): ClientInput {
  if (!client) return EMPTY;
  return {
    name: client.name,
    businessType: client.business_type ?? '',
    contactName: client.contact_name ?? '',
    contactEmail: client.contact_email ?? '',
    contactPhone: client.contact_phone ?? '',
    notes: client.notes ?? '',
  };
}

export default function ClientFormDialog({
  open,
  onClose,
  client,
}: {
  open: boolean;
  onClose: () => void;
  /** null creates, a record edits. */
  client: ClientRecord | null;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<ClientInput>(toInput(client));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      setForm(toInput(client));
      setError(null);
      el.showModal();
    }
    if (!open && el.open) el.close();
  }, [open, client]);

  const set = (key: keyof ClientInput) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function submit() {
    setBusy(true);
    setError(null);

    const result = client
      ? await updateClientRecord(client.id, form)
      : await createClientRecord(form);

    if (!result.ok) {
      setError(result.error ?? 'Could not save the client.');
      setBusy(false);
      return;
    }

    setBusy(false);
    onClose();
    router.refresh();
  }

  return (
    <dialog className="modal" ref={ref} onCancel={onClose} onClose={onClose}>
      <h2 className="modal__title">{client ? 'Edit client' : 'New client'}</h2>
      <p className="modal__sub">
        The business a site belongs to. Deleting is deliberately not offered here — a client
        with sites cannot be removed without taking those sites with it.
      </p>

      {error && (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      )}

      <div className="ef">
        <label className="ef__label" htmlFor="c-name">
          Business name<span className="req">*</span>
        </label>
        <input
          id="c-name"
          className="ef__input"
          value={form.name}
          onChange={(e) => set('name')(e.target.value)}
        />
      </div>

      <div className="newsite__grid">
        <div className="ef">
          <label className="ef__label" htmlFor="c-type">
            Business type
          </label>
          <input
            id="c-type"
            className="ef__input"
            placeholder="auto_service"
            value={form.businessType}
            onChange={(e) => set('businessType')(e.target.value)}
          />
        </div>

        <div className="ef">
          <label className="ef__label" htmlFor="c-contact">
            Contact name
          </label>
          <input
            id="c-contact"
            className="ef__input"
            value={form.contactName}
            onChange={(e) => set('contactName')(e.target.value)}
          />
        </div>

        <div className="ef">
          <label className="ef__label" htmlFor="c-email">
            Contact email
          </label>
          <input
            id="c-email"
            type="email"
            className="ef__input"
            value={form.contactEmail}
            onChange={(e) => set('contactEmail')(e.target.value)}
          />
        </div>

        <div className="ef">
          <label className="ef__label" htmlFor="c-phone">
            Contact phone
          </label>
          <input
            id="c-phone"
            className="ef__input"
            value={form.contactPhone}
            onChange={(e) => set('contactPhone')(e.target.value)}
          />
        </div>
      </div>

      <div className="ef">
        <label className="ef__label" htmlFor="c-notes">
          Notes
        </label>
        <textarea
          id="c-notes"
          className="ef__input"
          rows={3}
          value={form.notes}
          onChange={(e) => set('notes')(e.target.value)}
        />
      </div>

      <div className="form-bar">
        <button className="btn btn--primary" type="button" onClick={submit} disabled={busy}>
          {busy ? 'Saving…' : client ? 'Save changes' : 'Create client'}
        </button>
        <button className="btn btn--ghost" type="button" onClick={onClose} disabled={busy}>
          Cancel
        </button>
      </div>
    </dialog>
  );
}
