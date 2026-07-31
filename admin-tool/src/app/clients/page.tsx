import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/AppHeader';
import ClientsTable, { type ClientWithSites } from '@/components/ClientsTable';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const supabase = await createClient();

  const [{ data: clients, error }, { data: sites }] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, business_type, contact_name, contact_email, contact_phone, notes')
      .order('name'),
    // Site counts come from one extra read rather than an embedded aggregate,
    // which PostgREST only exposes awkwardly.
    supabase.from('sites').select('client_id'),
  ]);

  const counts = new Map<string, number>();
  for (const site of sites ?? []) {
    const key = site.client_id as string;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const rows: ClientWithSites[] = (clients ?? []).map((client) => ({
    ...client,
    siteCount: counts.get(client.id) ?? 0,
  }));

  return (
    <>
      <AppHeader current="clients" />

      <main className="container">
        {error && (
          <div className="alert alert--error" role="alert">
            Could not load clients: {error.message}
          </div>
        )}

        <ClientsTable clients={rows} />
      </main>
    </>
  );
}
