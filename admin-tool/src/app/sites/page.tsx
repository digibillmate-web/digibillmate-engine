import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import SignOutButton from '@/components/SignOutButton';
import SiteRowActions from '@/components/SiteRowActions';

export const dynamic = 'force-dynamic';

interface SiteRow {
  id: string;
  client_id: string | null;
  name: string;
  subdomain: string | null;
  custom_domain: string | null;
  status: string;
  composition_linked: boolean;
  theme_linked: boolean;
  last_published_at: string | null;
  archetypes: { key: string; name: string } | null;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function SitesPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const { archived } = await searchParams;
  const showArchived = archived === '1';
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Reads run as the signed-in user, so an account without an admin profile
  // simply sees nothing — RLS decides, not this component.
  const [{ data, error }, { data: clientRows }] = await Promise.all([
    supabase
      .from('sites')
      .select(
        'id, client_id, name, subdomain, custom_domain, status, composition_linked, theme_linked, last_published_at, archetypes(key, name)',
      )
      .order('name', { ascending: true }),
    supabase.from('clients').select('id, name').order('name'),
  ]);

  const allSites = (data ?? []) as unknown as SiteRow[];
  const clients = clientRows ?? [];

  // Archived sites are retired, not deleted: hidden by default so the list
  // reflects live work, but one click away rather than lost.
  const archivedCount = allSites.filter((s) => s.status === 'archived').length;
  const sites = showArchived ? allSites : allSites.filter((s) => s.status !== 'archived');

  return (
    <>
      <header className="app-header">
        <div className="app-header__inner">
          <Link className="app-header__brand" href="/sites">
            DigiBillMate Admin
          </Link>
          <div className="app-header__spacer" />
          <span className="app-header__user">{user?.email}</span>
          <SignOutButton />
        </div>
      </header>

      <main className="container">
        <div className="page-head">
          <div>
            <h1 className="page-title">Sites</h1>
            <p className="page-subtitle">
              {sites.length} {sites.length === 1 ? 'site' : 'sites'}
              {archivedCount > 0 && (
                <>
                  {' · '}
                  <Link href={showArchived ? '/sites' : '/sites?archived=1'}>
                    {showArchived
                      ? 'hide archived'
                      : `show ${archivedCount} archived`}
                  </Link>
                </>
              )}
            </p>
          </div>
          <Link className="btn btn--primary" href="/sites/new">
            New site
          </Link>
        </div>

        {error && (
          <div className="alert alert--error" role="alert">
            Could not load sites: {error.message}
          </div>
        )}

        <div className="card table-wrap">
          {sites.length === 0 && !error ? (
            <p className="empty">
              No sites visible. If you expect to see some, check that your account has an
              admin row in <code>profiles</code>.
            </p>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Archetype</th>
                  <th>Subdomain</th>
                  <th>Status</th>
                  <th>Composition</th>
                  <th>Theme</th>
                  <th>Last published</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {sites.map((site) => (
                  <tr key={site.id}>
                    <td className="cell-name">
                      <Link href={`/sites/${site.id}`}>{site.name}</Link>
                    </td>
                    <td className="cell-muted">{site.archetypes?.name ?? '—'}</td>
                    <td className="cell-muted">{site.custom_domain || site.subdomain || '—'}</td>
                    <td>
                      <span className={`badge badge--${site.status}`}>{site.status}</span>
                    </td>
                    <td>
                      <span className={`flag ${site.composition_linked ? 'flag--on' : ''}`}>
                        {site.composition_linked ? 'linked' : 'forked'}
                      </span>
                    </td>
                    <td>
                      <span className={`flag ${site.theme_linked ? 'flag--on' : ''}`}>
                        {site.theme_linked ? 'linked' : 'forked'}
                      </span>
                    </td>
                    <td className="cell-muted">{formatDate(site.last_published_at)}</td>
                    <td>
                      <SiteRowActions
                        site={{
                          id: site.id,
                          name: site.name,
                          clientId: site.client_id,
                          status: site.status,
                        }}
                        clients={clients}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  );
}
