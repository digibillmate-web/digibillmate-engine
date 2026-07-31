'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import CloneSiteDialog, { type ClientOption } from '@/components/CloneSiteDialog';
import DeleteSiteDialog from '@/components/DeleteSiteDialog';
import { setSiteStatus } from '@/app/sites/site-actions';

export default function SiteRowActions({
  site,
  clients,
}: {
  site: { id: string; name: string; clientId: string | null; status: string };
  clients: ClientOption[];
}) {
  const router = useRouter();
  const [cloning, setCloning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const archived = site.status === 'archived';

  function changeStatus(status: 'draft' | 'archived') {
    setError(null);
    startTransition(async () => {
      const result = await setSiteStatus(site.id, status);
      if (!result.ok) {
        setError(result.error ?? 'Could not change status.');
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rowactions">
      {error && <span className="rowactions__error">{error}</span>}

      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={() => setCloning(true)}
        disabled={pending}
      >
        Clone
      </button>

      {archived ? (
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => changeStatus('draft')}
          disabled={pending}
          title="Restore to draft"
        >
          Restore
        </button>
      ) : (
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => changeStatus('archived')}
          disabled={pending}
          title="Hide from the site list without deleting anything"
        >
          Archive
        </button>
      )}

      <button
        type="button"
        className="btn btn--ghost btn--sm btn--danger-ghost"
        onClick={() => setDeleting(true)}
        disabled={pending}
        title="Permanently delete this site and everything belonging to it"
      >
        Delete
      </button>

      <CloneSiteDialog
        open={cloning}
        onClose={() => setCloning(false)}
        source={{ id: site.id, name: site.name, clientId: site.clientId }}
        clients={clients}
      />

      <DeleteSiteDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        site={{ id: site.id, name: site.name }}
      />
    </div>
  );
}
