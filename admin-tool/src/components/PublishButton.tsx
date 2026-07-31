'use client';

/**
 * Triggers a Cloudflare Pages deploy for this site.
 *
 * Wording is deliberate throughout: a deploy hook is fire-and-forget, so the
 * most this component can honestly claim is that the build was *queued*.
 * Nothing here knows whether the build succeeded or whether the site is live.
 */
import { useState } from 'react';

type Status =
  | { kind: 'idle' }
  | { kind: 'triggering' }
  | { kind: 'queued'; deployId: string | null; at: string }
  | { kind: 'error'; message: string };

export default function PublishButton({
  siteId,
  siteStatus,
  hasDeployHook,
}: {
  siteId: string;
  siteStatus: string;
  /** Whether sites.deploy_hook_url is set. Without it there is nowhere to publish. */
  hasDeployHook: boolean;
}) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const notPublished = siteStatus !== 'published';

  async function publish() {
    setStatus({ kind: 'triggering' });

    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId }),
      });

      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        deployId?: string | null;
        triggeredAt?: string;
      };

      if (!res.ok || !data.ok) {
        setStatus({ kind: 'error', message: data.error ?? `Request failed (${res.status})` });
        return;
      }

      setStatus({
        kind: 'queued',
        deployId: data.deployId ?? null,
        at: data.triggeredAt ?? new Date().toISOString(),
      });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Network error',
      });
    }
  }

  return (
    <div className="publish">
      <div className="publish__row">
        <button
          className="btn btn--primary"
          type="button"
          onClick={publish}
          disabled={status.kind === 'triggering' || !hasDeployHook}
        >
          {status.kind === 'triggering' ? 'Triggering…' : 'Publish'}
        </button>

        <span className="publish__hint">
          Rebuilds the site from saved content and deploys it.
        </span>
      </div>

      {!hasDeployHook && (
        <p className="publish__warn">
          No deploy hook set for this site. Create its Cloudflare Pages project, then save the
          hook to <code>sites.deploy_hook_url</code> — each site needs its own, because a hook
          cannot be told which site to build.
        </p>
      )}

      {notPublished && (
        <p className="publish__warn">
          This site&apos;s status is <strong>{siteStatus}</strong>. The build refuses anything
          that is not <code>published</code>, so the deploy will fail until you change it.
        </p>
      )}

      {status.kind === 'queued' && (
        <div className="publish__result" role="status">
          <strong>Deploy triggered.</strong> Cloudflare has queued a build — it does not report
          success or failure back here. Check the Cloudflare Pages dashboard for build status,
          then reload the site once it finishes.
          <div className="publish__meta">
            {status.deployId && <>Deploy ID {status.deployId} · </>}
            triggered {new Date(status.at).toLocaleTimeString()}
          </div>
        </div>
      )}

      {status.kind === 'error' && (
        <div className="publish__error" role="alert">
          <strong>Could not trigger a deploy.</strong> {status.message}
        </div>
      )}
    </div>
  );
}
