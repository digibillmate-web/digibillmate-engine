'use client';

/**
 * Creates the site's Cloudflare Pages project.
 *
 * Shown as a one-time step because that is what it is: once a project exists
 * the panel reports it and gets out of the way. The alternative — a button
 * that stays clickable — invites a second project for the same site, which
 * Cloudflare will happily create and nobody will notice until two projects
 * are building the same customer.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { provisionSite } from '@/app/sites/[siteId]/provision-actions';

export default function ProvisionSiteForm({
  siteId,
  suggestedName,
  existingProject,
}: {
  siteId: string;
  suggestedName: string;
  existingProject: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(suggestedName);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  function provision() {
    setResult(null);
    startTransition(async () => {
      const outcome = await provisionSite(siteId, name);

      if (!outcome.ok) {
        setResult({ kind: 'error', text: outcome.error ?? 'Could not provision.' });
        return;
      }

      setResult({
        kind: 'ok',
        text: outcome.deploymentQueued
          ? `Created ${outcome.projectName} and started the first build.`
          : `Created ${outcome.projectName}. The first build did not start — publish to try again.`,
      });
      router.refresh();
    });
  }

  if (existingProject) {
    return (
      <section className="card settings-card">
        <h2 className="settings-card__title">Hosting</h2>
        <p className="settings-card__hint">
          Built by Cloudflare Pages project <code>{existingProject}</code>.
        </p>
        <p className="newsite__hint">
          <a
            href={`https://${existingProject}.pages.dev`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {existingProject}.pages.dev
          </a>
        </p>
      </section>
    );
  }

  return (
    <section className="card settings-card">
      <h2 className="settings-card__title">Hosting</h2>
      <p className="settings-card__hint">
        This site has no Cloudflare project yet, so nothing builds it. Creating one sets its
        build command, environment and site id in one step.
      </p>

      <div className="ef">
        <label className="ef__label" htmlFor="pages-name">
          Project name
        </label>
        <input
          id="pages-name"
          className="ef__input"
          value={name}
          disabled={pending}
          onChange={(e) => setName(e.target.value)}
        />
        <p className="newsite__hint">
          Becomes <code>{name || 'name'}.pages.dev</code>. Lowercase letters, numbers and
          hyphens.
        </p>
      </div>

      {result && (
        <div className={`alert alert--${result.kind === 'ok' ? 'info' : 'error'}`} role="alert">
          {result.text}
        </div>
      )}

      <div className="form-bar">
        <button
          className="btn btn--primary"
          type="button"
          onClick={provision}
          disabled={pending || name.trim().length < 3}
        >
          {pending ? 'Creating…' : 'Create Cloudflare project'}
        </button>
      </div>

      <p className="newsite__hint">
        A custom domain is still added in Cloudflare — the customer&rsquo;s own domain is the
        one step that cannot be done from here.
      </p>
    </section>
  );
}
