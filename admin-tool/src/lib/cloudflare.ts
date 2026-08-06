/**
 * Cloudflare Pages provisioning.
 *
 * Every client site is its own Pages project building from the same repo and
 * branch, differing only in its SITE_ID. Setting that up by hand is five steps
 * per site — create project, set five environment variables, wire the deploy
 * hook, paste the hook back into the portal, trigger the first build — and
 * every one of them is a chance to point a site at the wrong id.
 *
 * The shape below is copied from the working dbmcars project rather than
 * assembled from documentation, so a new project is the same thing that is
 * already known to build.
 */

const API = 'https://api.cloudflare.com/client/v4';

/** Matches the existing project; all sites build the same way. */
export const BUILD_CONFIG = {
  build_command: 'npm run build:site',
  destination_dir: 'site-builder/dist',
  root_dir: '',
} as const;

export const SOURCE_REPO = {
  owner: 'digibillmate-web',
  repo_name: 'digibillmate-engine',
  production_branch: 'main',
} as const;

export interface CloudflareResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

function credentials() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

  if (!token || !accountId) {
    return {
      error:
        'Cloudflare is not configured. CLOUDFLARE_API_TOKEN must be a worker secret ' +
        'and CLOUDFLARE_ACCOUNT_ID a worker var.',
    };
  }

  return { token, accountId };
}

async function call<T>(
  path: string,
  init: RequestInit & { token: string },
): Promise<CloudflareResult<T>> {
  const { token, ...options } = init;

  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        ...(options.headers ?? {}),
      },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    return {
      ok: false,
      error: `Could not reach Cloudflare: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    result?: T;
    errors?: { code?: number; message?: string }[];
  } | null;

  if (!response.ok || !payload?.success) {
    // Cloudflare's own message is far more useful than the status code alone.
    const detail =
      payload?.errors?.map((e) => `${e.message ?? ''}${e.code ? ` (${e.code})` : ''}`).join('; ') ||
      `HTTP ${response.status}`;
    return { ok: false, error: detail };
  }

  return { ok: true, data: payload.result };
}

/**
 * Project names are DNS labels — they become <name>.pages.dev — and Cloudflare
 * rejects anything else. Derived from the site's subdomain but not assumed to
 * equal it: the two are independent, and this only proposes a starting point.
 */
export function toProjectName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 58);
}

export interface ProvisionInput {
  projectName: string;
  siteId: string;
  enquiryEndpoint: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
  nodeVersion?: string;
}

/**
 * Creates the Pages project with its build config and environment in one call.
 *
 * Environment variables go in at creation rather than as a follow-up PATCH: a
 * project that exists without its SITE_ID would build the wrong site the
 * moment anything triggered it, and a half-provisioned project is harder to
 * reason about than one that either exists correctly or not at all.
 */
export async function createPagesProject(
  input: ProvisionInput,
): Promise<CloudflareResult<{ name: string; subdomain: string }>> {
  const creds = credentials();
  if ('error' in creds) return { ok: false, error: creds.error };

  const envVars = {
    SITE_ID: { type: 'plain_text', value: input.siteId },
    ENQUIRY_ENDPOINT: { type: 'plain_text', value: input.enquiryEndpoint },
    SUPABASE_URL: { type: 'plain_text', value: input.supabaseUrl },
    // Secret so the dashboard masks it; the build still receives it.
    SUPABASE_SERVICE_ROLE_KEY: { type: 'secret_text', value: input.supabaseServiceKey },
    NODE_VERSION: { type: 'plain_text', value: input.nodeVersion ?? '22' },
  };

  return call<{ name: string; subdomain: string }>(
    `/accounts/${creds.accountId}/pages/projects`,
    {
      token: creds.token,
      method: 'POST',
      body: JSON.stringify({
        name: input.projectName,
        production_branch: SOURCE_REPO.production_branch,
        source: {
          type: 'github',
          config: {
            owner: SOURCE_REPO.owner,
            repo_name: SOURCE_REPO.repo_name,
            production_branch: SOURCE_REPO.production_branch,
            deployments_enabled: true,
            // Only the production branch builds. Without this every branch
            // push would spawn a preview deploy for every client site.
            production_deployments_enabled: true,
            preview_deployment_setting: 'none',
          },
        },
        build_config: BUILD_CONFIG,
        deployment_configs: {
          production: { env_vars: envVars },
          preview: { env_vars: envVars },
        },
      }),
    },
  );
}

/**
 * Starts a build. Replaces the deploy-hook arrangement for provisioned sites:
 * a hook is a URL that has to be created by hand, copied, and stored, and it
 * can only ever build the one project it was made for.
 */
export async function triggerDeployment(
  projectName: string,
): Promise<CloudflareResult<{ id: string }>> {
  const creds = credentials();
  if ('error' in creds) return { ok: false, error: creds.error };

  return call<{ id: string }>(
    `/accounts/${creds.accountId}/pages/projects/${encodeURIComponent(projectName)}/deployments`,
    { token: creds.token, method: 'POST' },
  );
}

/** Whether a name is free, checked before creating so the error is clear. */
export async function projectExists(projectName: string): Promise<boolean> {
  const creds = credentials();
  if ('error' in creds) return false;

  const result = await call(
    `/accounts/${creds.accountId}/pages/projects/${encodeURIComponent(projectName)}`,
    { token: creds.token, method: 'GET' },
  );

  return result.ok;
}
