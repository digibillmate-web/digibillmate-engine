'use client';

import { useState } from 'react';
import CloneSiteDialog, { type ClientOption } from '@/components/CloneSiteDialog';

export default function SiteRowActions({
  site,
  clients,
}: {
  site: { id: string; name: string; clientId: string | null; status: string };
  clients: ClientOption[];
}) {
  const [cloning, setCloning] = useState(false);

  return (
    <div className="rowactions">
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={() => setCloning(true)}
      >
        Clone
      </button>

      <CloneSiteDialog
        open={cloning}
        onClose={() => setCloning(false)}
        source={{ id: site.id, name: site.name, clientId: site.clientId }}
        clients={clients}
      />
    </div>
  );
}
