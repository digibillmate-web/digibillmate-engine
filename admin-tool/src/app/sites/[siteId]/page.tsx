import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SignOutButton from '@/components/SignOutButton';
import SchemaForm from '@/components/SchemaForm';
import PublishButton from '@/components/PublishButton';
import { schemaToFields, unmappedKeys } from '@/lib/schema-to-fields';

export const dynamic = 'force-dynamic';

interface BlockDefinition {
  key: string;
  name: string;
  description: string | null;
  schema: unknown;
  client_editable_fields: string[];
}

interface InstanceRow {
  id: string;
  position: number;
  content: unknown;
  content_draft: unknown;
  block_definitions: BlockDefinition | null;
}

export default async function SiteEditorPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: site } = await supabase
    .from('sites')
    .select('id, name, subdomain, status, archetypes(key, name)')
    .eq('id', siteId)
    .single();

  if (!site) notFound();

  const { data, error } = await supabase
    .from('block_instances')
    .select(
      'id, position, content, content_draft, block_definitions(key, name, description, schema, client_editable_fields)',
    )
    .eq('site_id', siteId)
    .order('position', { ascending: true });

  const blocks = (data ?? []) as unknown as InstanceRow[];
  // PostgREST types an embedded one-to-one as an array; it is a single row here.
  const archetype = (site as unknown as { archetypes?: { name: string } | null }).archetypes;

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
          <Link href="/sites">Sites</Link> / {site.name}
        </p>

        <h1 className="page-title">{site.name}</h1>
        <p className="page-subtitle">
          {archetype?.name ?? 'No archetype'} · {site.subdomain ?? 'no subdomain'} ·{' '}
          <span className={`badge badge--${site.status}`}>{site.status}</span> · {blocks.length}{' '}
          blocks
        </p>

        <PublishButton siteId={siteId} siteStatus={site.status} />

        {error && (
          <div className="alert alert--error" role="alert">
            Could not load blocks: {error.message}
          </div>
        )}

        {blocks.length === 0 && !error && (
          <div className="card empty">
            This site has no rows in <code>block_instances</code>.
          </div>
        )}

        {blocks.map((block) => {
          const definition = block.block_definitions;
          const fields = schemaToFields(definition?.schema);
          const unmapped = unmappedKeys(block.content, fields);

          return (
            <section className="card block" key={block.id}>
              <header className="block__head">
                <span className="block__pos">{block.position}</span>
                <div>
                  <h2 className="block__name">{definition?.name ?? 'Unknown block'}</h2>
                  <code className="block__key">{definition?.key ?? '—'}</code>
                </div>
                {block.content_draft ? <span className="badge badge--draft">draft pending</span> : null}
              </header>

              <div className="block__body">
                {definition ? (
                  <SchemaForm
                    siteId={siteId}
                    blockId={block.id}
                    blockKey={definition.key}
                    fields={fields}
                    initialContent={(block.content ?? {}) as Record<string, unknown>}
                    unmapped={unmapped}
                  />
                ) : (
                  <p className="cell-muted">
                    No block definition joined — check the foreign key.
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </main>
    </>
  );
}
