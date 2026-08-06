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
import BlockAppearance from '@/components/BlockAppearance';
import CollapsibleBlock from '@/components/CollapsibleBlock';
import PageAppearance from '@/components/PageAppearance';
import MailSettingsForm, { type MailUsage } from '@/components/MailSettingsForm';
import ProvisionSiteForm from '@/components/ProvisionSiteForm';
import SaveAsTemplateForm, { type TemplateOption } from '@/components/SaveAsTemplateForm';
import LaunchChecklist, { type ChecklistItem } from '@/components/LaunchChecklist';
import AddBlockBar, { type CatalogEntry } from '@/components/AddBlockBar';
import PagesManager, { type PageRow } from '@/components/PagesManager';
import { schemaToFields, unmappedKeys } from '@/lib/schema-to-fields';
import { effectiveTheme } from '@/lib/theme';

export const dynamic = 'force-dynamic';

/**
 * One line of a block's own words, so a collapsed row says what it holds
 * rather than only what type it is — "Header nav" is far less useful than
 * "Header nav · Chennai's Trusted Multi-Brand Body Shop".
 *
 * Deliberately guesses from a few common keys instead of consulting the
 * schema: this is a label, and a block with none of them simply shows its
 * type, which is what the row did before.
 */
const SUMMARY_KEYS = ['heading', 'title', 'headline', 'business_name', 'name'];

function blockSummary(content: unknown): string | undefined {
  if (!content || typeof content !== 'object') return undefined;
  const record = content as Record<string, unknown>;

  for (const key of SUMMARY_KEYS) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      const text = value.trim();
      return text.length > 60 ? `${text.slice(0, 57)}…` : text;
    }
  }

  return undefined;
}

type Tab = 'content' | 'theme' | 'mail' | 'settings';

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
  const active: Tab =
    tab === 'theme' || tab === 'settings' || tab === 'mail' ? tab : 'content';

  const supabase = await createClient();

  const { data: site } = await supabase
    .from('sites')
    .select(
      'id, name, subdomain, custom_domain, status, theme, composition_linked, theme_linked, enquiry_email, enquiry_notify, enquiry_monthly_limit, pages_project, archetypes(key, name, default_theme)',
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
        .select('id, slug, title, show_in_nav, position, theme_overrides, reveal_animation')
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

  const appearanceByPage = new Map(
    (pageRows ?? []).map((row) => [
      row.id as string,
      {
        overrides: (row.theme_overrides ?? {}) as Record<string, string>,
        reveal: (row.reveal_animation as string | null) ?? '',
      },
    ]),
  );

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

  // Resolved once here so every block's appearance panel shows the colours
  // actually in use, rather than each recomputing the archetype merge.
  const siteTheme = effectiveTheme(
    archetype?.default_theme,
    site.theme,
    Boolean(site.theme_linked),
  );

  /*
   * Usage counters, fetched only for the tab that shows them. Four head-only
   * counts are cheaper than pulling every enquiry row back to tally in JS,
   * and this table grows without bound.
   */
  let mailUsage: MailUsage = {
    sentThisMonth: 0,
    totalEnquiries: 0,
    failed: 0,
    skipped: 0,
    lastEnquiryAt: null,
  };

  if (active === 'mail') {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    function countBase() {
      return supabase
        .from('enquiries')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', siteId);
    }

    const [sent, total, failed, skipped, last] = await Promise.all([
      countBase().eq('email_status', 'sent').gte('created_at', monthStart.toISOString()),
      countBase(),
      countBase().eq('email_status', 'failed'),
      countBase().eq('email_status', 'skipped'),
      supabase
        .from('enquiries')
        .select('created_at')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    mailUsage = {
      sentThisMonth: sent.count ?? 0,
      totalEnquiries: total.count ?? 0,
      failed: failed.count ?? 0,
      skipped: skipped.count ?? 0,
      lastEnquiryAt: (last.data?.created_at as string | undefined) ?? null,
    };
  }

  /*
   * Existing templates and their industries, so saving one offers what is
   * already there rather than inviting the same trade to be typed three ways.
   */
  let templateOptions: TemplateOption[] = [];
  let industries: string[] = [];

  if (active === 'settings') {
    const { data: allArchetypes } = await supabase
      .from('archetypes')
      .select('id, name, industry')
      .order('name');

    templateOptions = (allArchetypes ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      industry: (row.industry as string | null) ?? null,
    }));

    industries = [
      ...new Set(
        templateOptions
          .map((template) => template.industry?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    ].sort();
  }

  /*
   * Derived, never stored. A checklist someone ticks by hand is a checklist
   * that drifts from reality; every item below is read from the site itself,
   * so it cannot claim hosting exists when no project does.
   */
  const headerBlock = allBlocks.find((block) => block.block_definitions?.key === 'header_nav');
  const headerContent = (headerBlock?.content ?? {}) as { logo_url?: string };

  const checklist: ChecklistItem[] = [
    {
      label: 'Pages and content',
      done: allBlocks.length > 0 && pages.length > 0,
      hint: 'A site with no blocks builds an empty page, and the export refuses it.',
      href: `/sites/${siteId}`,
    },
    {
      label: 'Logo',
      done: Boolean(headerContent.logo_url),
      hint: 'Without one the header falls back to the business name as text.',
      href: `/sites/${siteId}`,
    },
    {
      label: 'Colours and fonts',
      done: !site.theme_linked,
      hint: 'Still using the archetype defaults, so this site looks like its template.',
      href: `/sites/${siteId}?tab=theme`,
    },
    {
      label: 'Enquiry recipient',
      done: Boolean(site.enquiry_email) || site.enquiry_notify === false,
      hint: 'Enquiries are recorded but nobody is told about them.',
      href: `/sites/${siteId}?tab=mail`,
    },
    {
      label: 'Cloudflare hosting',
      done: Boolean(site.pages_project),
      hint: 'Nothing builds this site until it has a Pages project.',
      href: `/sites/${siteId}?tab=settings`,
    },
    {
      label: 'Published',
      done: site.status === 'published',
      hint: 'Draft sites are not built, so changes never reach the web.',
      href: `/sites/${siteId}?tab=settings`,
    },
    {
      label: 'Custom domain',
      // Not knowable from here: the domain may be live without this column
      // being filled in, so it is guidance rather than a verdict.
      done: Boolean(site.custom_domain),
      hint: "Added in Cloudflare against this site's Pages project, using the customer's own domain.",
      manual: true,
    },
  ];

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
          <Link className={`tab ${active === 'mail' ? 'is-active' : ''}`} href={tabHref('mail')}>
            Mail
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

        {active === 'mail' && (
          <MailSettingsForm
            siteId={siteId}
            initialEmail={(site.enquiry_email as string | null) ?? ''}
            initialNotify={site.enquiry_notify !== false}
            initialLimit={
              site.enquiry_monthly_limit === null || site.enquiry_monthly_limit === undefined
                ? ''
                : String(site.enquiry_monthly_limit)
            }
            usage={mailUsage}
          />
        )}

        {active === 'settings' && (
          <>
            <LaunchChecklist items={checklist} />
            <RenameSiteForm
              siteId={siteId}
              initialName={site.name}
              initialSubdomain={site.subdomain ?? ''}
            />
            <ProvisionSiteForm
              siteId={siteId}
              suggestedName={(site.subdomain as string | null) ?? ''}
              existingProject={(site.pages_project as string | null) ?? null}
            />
            <PublishButton
              siteId={siteId}
              siteStatus={site.status}
              hasDeployHook={Boolean(hook?.url)}
              hasPagesProject={Boolean(site.pages_project)}
            />
            <DeployHookForm siteId={siteId} initialUrl={hook?.url ?? ''} />
            <SaveAsTemplateForm
              siteId={siteId}
              siteName={site.name as string}
              industries={industries}
              templates={templateOptions}
            />
          </>
        )}

        {active === 'content' && (
          <>
            <PagesManager siteId={siteId} pages={pages} activePageId={activePageId} />

            {activePage && (
              <>
                <p className="pages__editing">
                  Editing blocks on <strong>{activePage.title}</strong>{' '}
                  <code>/{activePage.slug}</code>
                </p>

                <div className="card">
                  <PageAppearance
                    siteId={siteId}
                    pageId={activePage.id}
                    pageTitle={activePage.title}
                    siteTheme={siteTheme}
                    initialOverrides={appearanceByPage.get(activePage.id)?.overrides ?? {}}
                    initialReveal={appearanceByPage.get(activePage.id)?.reveal ?? ''}
                  />
                </div>
              </>
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
                  <CollapsibleBlock
                    position={block.position}
                    name={definition?.name ?? 'Unknown block'}
                    blockKey={definition?.key ?? '—'}
                    summary={blockSummary(block.content)}
                    badges={
                      <>
                        {block.is_hidden && <span className="badge badge--archived">hidden</span>}
                        {block.content_draft ? (
                          <span className="badge badge--draft">draft pending</span>
                        ) : null}
                      </>
                    }
                    controls={
                      <BlockControls
                        siteId={siteId}
                        pageId={activePageId}
                        blockId={block.id}
                        blockName={definition?.name ?? 'this block'}
                        isHidden={block.is_hidden}
                        orderedIds={orderedIds}
                      />
                    }
                  >
                    {definition && (
                      <BlockAppearance
                        siteId={siteId}
                        blockId={block.id}
                        blockKey={definition.key}
                        background={block.settings?.background ?? 'default'}
                        theme={siteTheme}
                      />
                    )}

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
                  </CollapsibleBlock>
                </section>
              );
            })}
          </>
        )}
      </main>
    </>
  );
}
