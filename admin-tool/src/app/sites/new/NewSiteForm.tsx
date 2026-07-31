'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createSite } from './actions';
import { normaliseSubdomain } from '@/lib/site-provisioning';

interface Option {
  id: string;
  name: string;
}

interface ArchetypeOption extends Option {
  key: string;
  blockCount: number;
}

export default function NewSiteForm({
  clients,
  archetypes,
}: {
  clients: Option[];
  archetypes: ArchetypeOption[];
}) {
  const router = useRouter();

  const [mode, setMode] = useState<'existing' | 'new'>(clients.length > 0 ? 'existing' : 'new');
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [newClient, setNewClient] = useState({
    name: '',
    businessType: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
  });

  const [archetypeId, setArchetypeId] = useState(archetypes[0]?.id ?? '');
  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [subdomainTouched, setSubdomainTouched] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState<string | null>(null);

  const selectedArchetype = archetypes.find((a) => a.id === archetypeId);

  // Suggest a subdomain from the site name until the user edits it directly.
  function onNameChange(value: string) {
    setName(value);
    if (!subdomainTouched) setSubdomain(normaliseSubdomain(value));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setField(null);

    const result = await createSite({
      clientId: mode === 'existing' ? clientId : undefined,
      newClientName: mode === 'new' ? newClient.name : undefined,
      newClientBusinessType: mode === 'new' ? newClient.businessType : undefined,
      newClientContactName: mode === 'new' ? newClient.contactName : undefined,
      newClientContactEmail: mode === 'new' ? newClient.contactEmail : undefined,
      newClientContactPhone: mode === 'new' ? newClient.contactPhone : undefined,
      archetypeId,
      name,
      subdomain,
    });

    if (!result.ok) {
      setError(result.error ?? 'Could not create the site.');
      setField(result.field ?? null);
      setBusy(false);
      return;
    }

    router.replace(`/sites/${result.siteId}`);
    router.refresh();
  }

  return (
    <form className="card newsite" onSubmit={onSubmit}>
      {error && (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      )}

      {/* --- client --- */}
      <fieldset className="ef ef--object">
        <legend className="ef__legend">Client</legend>

        <div className="newsite__modes">
          <label className="ef--check">
            <input
              type="radio"
              name="clientmode"
              checked={mode === 'existing'}
              disabled={clients.length === 0}
              onChange={() => setMode('existing')}
            />
            <span>Existing client</span>
          </label>
          <label className="ef--check">
            <input
              type="radio"
              name="clientmode"
              checked={mode === 'new'}
              onChange={() => setMode('new')}
            />
            <span>Create new client</span>
          </label>
        </div>

        {mode === 'existing' ? (
          <div className="ef">
            <label className="ef__label" htmlFor="client">
              Client<span className="req">*</span>
            </label>
            <select
              id="client"
              className="ef__input"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              {clients.length === 0 && <option value="">No clients yet</option>}
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div className="ef">
              <label className="ef__label" htmlFor="nc-name">
                Business name<span className="req">*</span>
              </label>
              <input
                id="nc-name"
                className="ef__input"
                value={newClient.name}
                onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
              />
            </div>
            <div className="newsite__grid">
              <div className="ef">
                <label className="ef__label" htmlFor="nc-type">
                  Business type
                </label>
                <input
                  id="nc-type"
                  className="ef__input"
                  placeholder="auto_service"
                  value={newClient.businessType}
                  onChange={(e) => setNewClient({ ...newClient, businessType: e.target.value })}
                />
              </div>
              <div className="ef">
                <label className="ef__label" htmlFor="nc-contact">
                  Contact name
                </label>
                <input
                  id="nc-contact"
                  className="ef__input"
                  value={newClient.contactName}
                  onChange={(e) => setNewClient({ ...newClient, contactName: e.target.value })}
                />
              </div>
              <div className="ef">
                <label className="ef__label" htmlFor="nc-email">
                  Contact email
                </label>
                <input
                  id="nc-email"
                  type="email"
                  className="ef__input"
                  value={newClient.contactEmail}
                  onChange={(e) => setNewClient({ ...newClient, contactEmail: e.target.value })}
                />
              </div>
              <div className="ef">
                <label className="ef__label" htmlFor="nc-phone">
                  Contact phone
                </label>
                <input
                  id="nc-phone"
                  className="ef__input"
                  value={newClient.contactPhone}
                  onChange={(e) => setNewClient({ ...newClient, contactPhone: e.target.value })}
                />
              </div>
            </div>
          </>
        )}
      </fieldset>

      {/* --- site --- */}
      <fieldset className="ef ef--object">
        <legend className="ef__legend">Site</legend>

        <div className="ef">
          <label className="ef__label" htmlFor="archetype">
            Archetype<span className="req">*</span>
          </label>
          <select
            id="archetype"
            className="ef__input"
            value={archetypeId}
            onChange={(e) => setArchetypeId(e.target.value)}
          >
            {archetypes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.blockCount} blocks)
              </option>
            ))}
          </select>
          {selectedArchetype && (
            <p className="newsite__hint">
              Creates {selectedArchetype.blockCount} blocks copied from{' '}
              <code>{selectedArchetype.key}</code>. Edit them after creation.
            </p>
          )}
        </div>

        <div className="ef">
          <label className="ef__label" htmlFor="site-name">
            Site name<span className="req">*</span>
          </label>
          <input
            id="site-name"
            className="ef__input"
            placeholder="Maria Cars - Guindy"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
          />
          <p className="newsite__hint">Internal label, not shown on the site.</p>
        </div>

        <div className="ef">
          <label className="ef__label" htmlFor="subdomain">
            Subdomain<span className="req">*</span>
          </label>
          <input
            id="subdomain"
            className={`ef__input ${field === 'subdomain' ? 'ef__input--error' : ''}`}
            placeholder="mariacars"
            value={subdomain}
            onChange={(e) => {
              setSubdomainTouched(true);
              setSubdomain(e.target.value.toLowerCase());
            }}
          />
          <p className="newsite__hint">
            Lowercase letters, numbers and hyphens. Must be unique across all sites.
          </p>
        </div>
      </fieldset>

      <div className="form-bar">
        <button className="btn btn--primary" type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create site'}
        </button>
        <Link className="btn btn--ghost" href="/sites">
          Cancel
        </Link>
        <span className="form-bar__note">
          Starts as a draft, linked to its archetype. Publish separately.
        </span>
      </div>
    </form>
  );
}
