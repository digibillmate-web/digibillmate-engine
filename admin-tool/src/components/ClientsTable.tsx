'use client';

import { useState } from 'react';
import Link from 'next/link';
import ClientFormDialog, { type ClientRecord } from '@/components/ClientFormDialog';

export interface ClientWithSites extends ClientRecord {
  siteCount: number;
}

export default function ClientsTable({ clients }: { clients: ClientWithSites[] }) {
  const [editing, setEditing] = useState<ClientRecord | null>(null);
  const [creating, setCreating] = useState(false);

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
                    {client.siteCount > 0 ? (
                      <Link href="/sites">{client.siteCount}</Link>
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
    </>
  );
}
