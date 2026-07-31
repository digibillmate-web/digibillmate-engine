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
    // Names, not just counts: deletion is blocked while a client owns sites,
    // and naming them is more useful than saying "3".
    supabase.from('sites').select('client_id, name').order('name'),
  ]);

  const byClient = new Map<string, string[]>();
  for (const site of sites ?? []) {
    const key = site.client_id as string;
    byClient.set(key, [...(byClient.get(key) ?? []), site.name as string]);
  }

  const rows: ClientWithSites[] = (clients ?? []).map((client) => ({
    ...client,
    siteNames: byClient.get(client.id) ?? [],
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
