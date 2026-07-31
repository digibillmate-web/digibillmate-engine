import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import SignOutButton from '@/components/SignOutButton';
import NewSiteForm from './NewSiteForm';

export const dynamic = 'force-dynamic';

export default async function NewSitePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: clients }, { data: archetypes }] = await Promise.all([
    supabase.from('clients').select('id, name').order('name'),
    supabase.from('archetypes').select('id, key, name, archetype_blocks(id)').order('name'),
  ]);

  // Block count comes from the embedded rows rather than a second query; it
  // tells the operator how many blocks creating this site will produce.
  const archetypeOptions = (archetypes ?? []).map((a) => {
    const row = a as unknown as {
      id: string;
      key: string;
      name: string;
      archetype_blocks: unknown[] | null;
    };
    return {
      id: row.id,
      key: row.key,
      name: row.name,
      blockCount: row.archetype_blocks?.length ?? 0,
    };
  });

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
        <p className="crumb">
          <Link href="/sites">Sites</Link> / New
        </p>

        <h1 className="page-title">New site</h1>
        <p className="page-subtitle">
          Creates the site and copies its archetype&apos;s blocks in as editable content.
        </p>

        {archetypeOptions.length === 0 ? (
          <div className="card empty">
            No archetypes available. A site needs one to supply its starting blocks.
          </div>
        ) : (
          <NewSiteForm clients={clients ?? []} archetypes={archetypeOptions} />
        )}
      </main>
    </>
  );
}
