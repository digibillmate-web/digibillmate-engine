'use client';

import { useState } from 'react';
import Link from 'next/link';
import ClientFormDialog, { type ClientRecord } from '@/components/ClientFormDialog';
import DeleteClientDialog from '@/components/DeleteClientDialog';

export interface ClientWithSites extends ClientRecord {
  siteNames: string[];
}

export default function ClientsTable({ clients }: { clients: ClientWithSites[] }) {
  const [editing, setEditing] = useState<ClientRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ClientWithSites | null>(null);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">
            {clients.length} {clients.length === 1 ? 'client' : 'clients'}
          </p>
        </div>
        <button className="btn btn--primary" type="button" onClick={() => setCreating(true)}>
          New client
        </button>
      </div>

      <div className="card table-wrap">
        {clients.length === 0 ? (
          <p className="empty">No clients yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Business</th>
                <th>Type</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Sites</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id}>
                  <td className="cell-name">{client.name}</td>
                  <td className="cell-muted">{client.business_type ?? '—'}</td>
                  <td className="cell-muted">{client.contact_name ?? '—'}</td>
                  <td className="cell-muted">
                    {client.contact_email ? (
                      <a href={`mailto:${client.contact_email}`}>{client.contact_email}</a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="cell-muted">{client.contact_phone ?? '—'}</td>
                  <td className="cell-muted">
                    {client.siteNames.length > 0 ? (
                      <Link href="/sites" title={client.siteNames.join(', ')}>
                        {client.siteNames.length}
                      </Link>
                    ) : (
                      '0'
                    )}
                  </td>
                  <td>
                    <div className="rowactions">
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => setEditing(client)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm btn--danger-ghost"
                        onClick={() => setDeleting(client)}
                        title={
                          client.siteNames.length > 0
                            ? 'Owns sites — deletion is blocked, open to see which'
                            : 'Permanently delete this client'
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ClientFormDialog open={creating} onClose={() => setCreating(false)} client={null} />

      <ClientFormDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        client={editing}
      />

      {deleting && (
        <DeleteClientDialog
          open
          onClose={() => setDeleting(null)}
          client={{
            id: deleting.id,
            name: deleting.name,
            siteNames: deleting.siteNames,
          }}
        />
      )}
    </>
  );
}
