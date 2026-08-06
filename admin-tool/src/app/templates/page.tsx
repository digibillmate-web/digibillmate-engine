import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Industries and the templates inside them.
 *
 * The portal grew site-first: a flat list of sites, with the template they
 * came from as a footnote. That reads fine with one template and stops
 * working the moment there are several trades — which is the direction this
 * is going, a car wash template today and another industry next.
 *
 * So this is the other axis. An archetype is the template; its industry label
 * groups them. Counting sites per template answers the question actually
 * being asked at this level — which templates are earning their keep — rather
 * than repeating the site list.
 */

interface ArchetypeRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  industry: string | null;
}

const UNCATEGORISED = 'Uncategorised';

export default async function TemplatesPage() {
  const supabase = await createClient();

  const [{ data: archetypes, error }, { data: sites }] = await Promise.all([
    supabase
      .from('archetypes')
      .select('id, key, name, description, industry')
      .order('industry', { ascending: true })
      .order('name', { ascending: true }),
    supabase.from('sites').select('id, archetype_id, status'),
  ]);

  const rows = (archetypes ?? []) as ArchetypeRow[];

  /*
   * Counted here rather than with a grouped query: PostgREST has no group-by,
   * and the alternative is one count request per template. At this scale the
   * whole site list is a few rows.
   */
  const usage = new Map<string, { total: number; published: number }>();
  for (const site of sites ?? []) {
    const key = (site.archetype_id as string | null) ?? '';
    const entry = usage.get(key) ?? { total: 0, published: 0 };
    entry.total += 1;
    if (site.status === 'published') entry.published += 1;
    usage.set(key, entry);
  }

  // Grouped in code so an industry with no templates simply does not appear,
  // rather than needing a second table to enumerate industries.
  const byIndustry = new Map<string, ArchetypeRow[]>();
  for (const row of rows) {
    const industry = row.industry?.trim() || UNCATEGORISED;
    byIndustry.set(industry, [...(byIndustry.get(industry) ?? []), row]);
  }

  const industries = [...byIndustry.keys()].sort((a, b) =>
    // Uncategorised last: it is a gap to fill, not a category.
    a === UNCATEGORISED ? 1 : b === UNCATEGORISED ? -1 : a.localeCompare(b),
  );

  return (
    <>
      <AppHeader current="templates" />

      <main className="container">
        <div className="page-head">
          <div>
            <h1 className="page-title">Industries &amp; templates</h1>
            <p className="page-subtitle">
              {rows.length} template{rows.length === 1 ? '' : 's'} across {industries.length}{' '}
              industr{industries.length === 1 ? 'y' : 'ies'}
            </p>
          </div>
          <Link className="btn btn--primary" href="/sites/new">
            New site
          </Link>
        </div>

        {error && (
          <div className="alert alert--error" role="alert">
            Could not load templates: {error.message}
          </div>
        )}

        {rows.length === 0 && !error && (
          <div className="card empty">
            No templates yet. A template is an archetype with its starting blocks — see
            supabase/migrations for how the first one was seeded.
          </div>
        )}

        {industries.map((industry) => (
          <section key={industry} className="industry">
            <h2 className="industry__name">{industry}</h2>

            <div className="industry__grid">
              {byIndustry.get(industry)!.map((template) => {
                const counts = usage.get(template.id) ?? { total: 0, published: 0 };

                return (
                  <article className="card tmpl" key={template.id}>
                    <h3 className="tmpl__name">{template.name}</h3>
                    <code className="tmpl__key">{template.key}</code>

                    {template.description && (
                      <p className="tmpl__desc">{template.description}</p>
                    )}

                    <dl className="tmpl__stats">
                      <div>
                        <dt>Sites</dt>
                        <dd>{counts.total}</dd>
                      </div>
                      <div>
                        <dt>Published</dt>
                        <dd>{counts.published}</dd>
                      </div>
                    </dl>

                    <Link
                      className="btn btn--ghost tmpl__action"
                      href={`/sites/new?archetype=${template.id}`}
                    >
                      Build a site from this
                    </Link>
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        <p className="newsite__hint templates__note">
          A new industry appears here as soon as a template carries its name. Templates are
          created as archetypes with their starting blocks.
        </p>
      </main>
    </>
  );
}
