import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/AppHeader';
import SchemaForm from '@/components/SchemaForm';
import PublishButton from '@/components/PublishButton';
import DeployHookForm from '@/components/DeployHookForm';
import ThemeForm from '@/components/ThemeForm';
import RenameSiteForm from '@/components/RenameSiteForm';
import BlockControls from '@/components/BlockControls';
import BlockBackgroundPicker from '@/components/BlockBackgroundPicker';
import AddBlockBar, { type CatalogEntry } from '@/components/AddBlockBar';
import PagesManager, { type PageRow } from '@/components/PagesManager';
import { schemaToFields, unmappedKeys } from '@/lib/schema-to-fields';
import { effectiveTheme } from '@/lib/theme';

export const dynamic = 'force-dynamic';

type Tab = 'content' | 'theme' | 'settings';

interface BlockDefinition {
  id: string;
  key: string;
  name: string;
  description: string | null;
  schema: unknown;
  client_editable_fields: string[];
}

interface InstanceRow {
  id: string;
  page_id: string;
  position: number;
  content: unknown;
  content_draft: unknown;
  settings: { background?: string } | null;
  is_hidden: boolean;
  block_definitions: BlockDefinition | null;
}

export default async function SiteEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const { siteId } = await params;
  const { tab, page: pageParam } = await searchParams;
  const active: Tab = tab === 'theme' || tab === 'settings' ? tab : 'content';

  const supabase = await createClient();

  const { data: site } = await supabase
    .from('sites')
    .select(
      'id, name, subdomain, status, theme, composition_linked, theme_linked, archetypes(key, name, default_theme)',
    )
    .eq('id', siteId)
    .single();

  if (!site) notFound();

  const archetype = (
    site as unknown as {
      archetypes?: { key: string; name: string; default_theme: unknown } | null;
    }
  ).archetypes;

  const [{ data: blockRows, error }, { data: hook }, { data: definitions }, { data: pageRows }] =
    await Promise.all([
      supabase
        .from('block_instances')
        .select(
          'id, page_id, position, content, content_draft, settings, is_hidden, block_definitions(id, key, name, description, schema, client_editable_fields)',
        )
        .eq('site_id', siteId)
        .order('position', { ascending: true }),
      // Admin-only table: a non-admin session simply gets no row back.
      supabase.from('site_deploy_hooks').select('url').eq('site_id', siteId).maybeSingle(),
      supabase.from('block_definitions').select('id, key, name').order('name'),
      supabase
        .from('site_pages')
        .select('id, slug, title, show_in_nav, position')
        .eq('site_id', siteId)
        .order('position', { ascending: true }),
    ]);

  const allBlocks = (blockRows ?? []) as unknown as InstanceRow[];

  const pages: PageRow[] = (pageRows ?? []).map((row) => ({
    id: row.id as string,
    slug: (row.slug as string) ?? '',
    title: row.title as string,
    show_in_nav: row.show_in_nav !== false,
    blockCount: allBlocks.filter((b) => b.page_id === row.id).length,
  }));

  // Editing is always scoped to one page: ?page=<id>, defaulting to home.
  const activePage = pages.find((p) => p.id === pageParam) ?? pages[0];
  const activePageId = activePage?.id ?? '';

  const blocks = allBlocks.filter((block) => block.page_id === activePageId);
  const orderedIds = blocks.map((block) => block.id);
  const usedDefinitionIds = new Set(blocks.map((b) => b.block_definitions?.id));

  const catalog: CatalogEntry[] = (definitions ?? []).map((definition) => ({
    id: definition.id,
    key: definition.key,
    name: definition.name,
    inUse: usedDefinitionIds.has(definition.id),
  }));

  const hiddenCount = blocks.filter((block) => block.is_hidden).length;

  const tabHref = (next: Tab) =>
    next === 'content' ? `/sites/${siteId}` : `/sites/${siteId}?tab=${next}`;

  return (
    <>
      <AppHeader current="sites" />

      <main className="container">
        <p className="crumb">
          <Link href="/sites">Sites</Link> / {site.name}
        </p>

        <h1 className="page-title">{site.name}</h1>
        <p className="page-subtitle">
          {archetype?.name ?? 'No archetype'} · {site.subdomain ?? 'no subdomain'} ·{' '}
          <span className={`badge badge--${site.status}`}>{site.status}</span>
        </p>

        {/* Linked/forked is a real state change, so it is stated, not implied. */}
        <div className="linkbadges">
          <span className={`linkbadge ${site.composition_linked ? 'is-linked' : 'is-forked'}`}>
            {site.composition_linked
              ? `Composition linked to ${archetype?.name ?? 'archetype'}`
              : 'Composition forked'}
          </span>
          <span className={`linkbadge ${site.theme_linked ? 'is-linked' : 'is-forked'}`}>
            {site.theme_linked
              ? `Theme linked to ${archetype?.name ?? 'archetype'}`
              : 'Theme forked'}
          </span>
        </div>

        <nav className="tabs" aria-label="Site editor sections">
          <Link className={`tab ${active === 'content' ? 'is-active' : ''}`} href={tabHref('content')}>
            Content <span className="tab__count">{blocks.length}</span>
          </Link>
          <Link className={`tab ${active === 'theme' ? 'is-active' : ''}`} href={tabHref('theme')}>
            Theme
          </Link>
          <Link
            className={`tab ${active === 'settings' ? 'is-active' : ''}`}
            href={tabHref('settings')}
          >
            Settings
          </Link>
        </nav>

        {error && (
          <div className="alert alert--error" role="alert">
            Could not load blocks: {error.message}
          </div>
        )}

        {active === 'theme' && (
          <ThemeForm
            siteId={siteId}
            archetypeName={archetype?.name ?? 'archetype'}
            themeLinked={Boolean(site.theme_linked)}
            effective={effectiveTheme(
              archetype?.default_theme,
              site.theme,
              Boolean(site.theme_linked),
            )}
          />
        )}

        {active === 'settings' && (
          <>
            <RenameSiteForm
              siteId={siteId}
              initialName={site.name}
              initialSubdomain={site.subdomain ?? ''}
            />
            <PublishButton
              siteId={siteId}
              siteStatus={site.status}
              hasDeployHook={Boolean(hook?.url)}
            />
            <DeployHookForm siteId={siteId} initialUrl={hook?.url ?? ''} />
          </>
        )}

        {active === 'content' && (
          <>
            <PagesManager siteId={siteId} pages={pages} activePageId={activePageId} />

            {activePage && (
              <p className="pages__editing">
                Editing blocks on <strong>{activePage.title}</strong>{' '}
                <code>/{activePage.slug}</code>
              </p>
            )}

            <div className="card addblock-card">
              <AddBlockBar siteId={siteId} pageId={activePageId} catalog={catalog} />
            </div>

            {hiddenCount > 0 && (
              <div className="alert alert--info" role="status">
                {hiddenCount} block{hiddenCount === 1 ? '' : 's'} hidden from the built site.
                Content is kept — restore any of them below.
              </div>
            )}

            {blocks.length === 0 && !error && (
              <div className="card empty">
                This page has no blocks yet. Add one above.
              </div>
            )}

            {blocks.map((block) => {
              const definition = block.block_definitions;
              const fields = schemaToFields(
                definition?.schema,
                definition?.client_editable_fields ?? [],
              );
              const unmapped = unmappedKeys(block.content, fields);

              return (
                <section
                  className={`card block ${block.is_hidden ? 'block--hidden' : ''}`}
                  key={block.id}
                >
                  <header className="block__head">
                    <span className="block__pos">{block.position}</span>
                    <div>
                      <h2 className="block__name">{definition?.name ?? 'Unknown block'}</h2>
                      <code className="block__key">{definition?.key ?? '—'}</code>
                    </div>

                    {block.is_hidden && <span className="badge badge--archived">hidden</span>}
                    {block.content_draft ? (
                      <span className="badge badge--draft">draft pending</span>
                    ) : null}

                    <BlockBackgroundPicker
                      siteId={siteId}
                      blockId={block.id}
                      current={block.settings?.background ?? 'default'}
                    />

                    <BlockControls
                      siteId={siteId}
                      pageId={activePageId}
                      blockId={block.id}
                      blockName={definition?.name ?? 'this block'}
                      isHidden={block.is_hidden}
                      orderedIds={orderedIds}
                    />
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
          </>
        )}
      </main>
    </>
  );
}
