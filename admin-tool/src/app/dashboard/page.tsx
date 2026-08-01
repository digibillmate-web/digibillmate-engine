import AppHeader from '@/components/AppHeader';
import { createClient } from '@/lib/supabase/server';
import { getSiteStorageUsage, formatBytes } from '@/lib/storage-usage';

export const dynamic = 'force-dynamic';

interface SiteRow {
  id: string;
  name: string;
  status: string;
  archetypes: { name: string } | null;
}

/**
 * Read-only rollup across every client and site: counts, publish status,
 * and per-site storage usage. Built for onboarding-capacity planning, not
 * for editing anything — every write path lives on /sites and /clients.
 */
export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { data: clients },
    { data: sitesData },
    { data: blockDefs },
    { data: archetypes },
    { data: blockInstances },
  ] = await Promise.all([
    supabase.from('clients').select('id'),
    supabase.from('sites').select('id, name, status, archetypes(name)'),
    supabase.from('block_definitions').select('id'),
    supabase.from('archetypes').select('id'),
    supabase.from('block_instances').select('site_id, is_hidden'),
  ]);

  const sites = (sitesData ?? []) as unknown as SiteRow[];

  const blocksBySite = new Map<string, { total: number; hidden: number }>();
  for (const row of blockInstances ?? []) {
    const key = row.site_id as string;
    const entry = blocksBySite.get(key) ?? { total: 0, hidden: 0 };
    entry.total++;
    if (row.is_hidden) entry.hidden++;
    blocksBySite.set(key, entry);
  }

  // One Storage list() round trip per site; fine at this scale, and the
  // number to watch as onboarding grows is exactly what this page is for.
  const usagePerSite = await Promise.all(
    sites.map(async (site) => ({
      siteId: site.id,
      usage: await getSiteStorageUsage(supabase, site.id),
    })),
  );
  const usageBySite = new Map(usagePerSite.map((u) => [u.siteId, u.usage]));

  const statusCounts = sites.reduce<Record<string, number>>((acc, site) => {
    acc[site.status] = (acc[site.status] ?? 0) + 1;
    return acc;
  }, {});

  const totalFiles = usagePerSite.reduce((sum, u) => sum + u.usage.fileCount, 0);
  const totalBytes = usagePerSite.reduce((sum, u) => sum + u.usage.totalBytes, 0);
  const totalBlocks = (blockInstances ?? []).length;

  return (
    <>
      <AppHeader current="dashboard" />

      <main className="container">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          Overview across every client and site — a starting point for planning capacity before
          onboarding more customers.
        </p>

        <div className="statgrid">
          <div className="statcard">
            <span className="statcard__value">{clients?.length ?? 0}</span>
            <span className="statcard__label">Clients</span>
          </div>
          <div className="statcard">
            <span className="statcard__value">{sites.length}</span>
            <span className="statcard__label">Sites</span>
          </div>
          <div className="statcard">
            <span className="statcard__value">{statusCounts.published ?? 0}</span>
            <span className="statcard__label">Published</span>
          </div>
          <div className="statcard">
            <span className="statcard__value">{statusCounts.draft ?? 0}</span>
            <span className="statcard__label">Draft</span>
          </div>
          <div className="statcard">
            <span className="statcard__value">{statusCounts.archived ?? 0}</span>
            <span className="statcard__label">Archived</span>
          </div>
          <div className="statcard">
            <span className="statcard__value">{archetypes?.length ?? 0}</span>
            <span className="statcard__label">Archetypes</span>
          </div>
          <div className="statcard">
            <span className="statcard__value">{blockDefs?.length ?? 0}</span>
            <span className="statcard__label">Block types</span>
          </div>
          <div className="statcard">
            <span className="statcard__value">{totalBlocks}</span>
            <span className="statcard__label">Block instances</span>
          </div>
          <div className="statcard">
            <span className="statcard__value">{totalFiles}</span>
            <span className="statcard__label">Uploaded images</span>
          </div>
          <div className="statcard">
            <span className="statcard__value">{formatBytes(totalBytes)}</span>
            <span className="statcard__label">Storage used</span>
          </div>
        </div>

        <h2 className="section-title">Storage by site</h2>
        <div className="card table-wrap">
          {sites.length === 0 ? (
            <p className="empty">No sites yet.</p>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Archetype</th>
                  <th>Status</th>
                  <th>Blocks</th>
                  <th>Hidden</th>
                  <th>Images</th>
                  <th>Storage</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((site) => {
                  const blocks = blocksBySite.get(site.id) ?? { total: 0, hidden: 0 };
                  const usage = usageBySite.get(site.id) ?? { fileCount: 0, totalBytes: 0 };
                  return (
                    <tr key={site.id}>
                      <td className="cell-name">{site.name}</td>
                      <td className="cell-muted">{site.archetypes?.name ?? '—'}</td>
                      <td>
                        <span className={`badge badge--${site.status}`}>{site.status}</span>
                      </td>
                      <td>{blocks.total}</td>
                      <td className="cell-muted">{blocks.hidden || '—'}</td>
                      <td>{usage.fileCount}</td>
                      <td className="cell-muted">{formatBytes(usage.totalBytes)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <p className="newsite__hint">
          Storage figures cover the site-media bucket only, not the Postgres database itself.
          Supabase&apos;s free tier includes 1 GB of storage and 500 MB of database space —
          worth checking against as more clients come on board.
        </p>
      </main>
    </>
  );
}
