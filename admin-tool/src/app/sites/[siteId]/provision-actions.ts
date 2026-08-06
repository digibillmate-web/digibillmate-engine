'use server';

/**
 * Provisions a site's Cloudflare Pages project.
 *
 * This replaces the manual sequence that stood between creating a site and
 * seeing it live: create the project, set five environment variables, make a
 * deploy hook, paste that hook back into the portal, trigger the first build.
 * Each step was a chance to point a site at another site's SITE_ID, and the
 * result of getting it wrong is a project that builds the wrong customer.
 */
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  createPagesProject,
  triggerDeployment,
  projectExists,
  toProjectName,
} from '@/lib/cloudflare';

export interface ProvisionResult {
  ok: boolean;
  error?: string;
  projectName?: string;
  url?: string;
  deploymentQueued?: boolean;
}

export async function provisionSite(
  siteId: string,
  requestedName?: string,
): Promise<ProvisionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: 'Not signed in.' };

  // Creating infrastructure is an admin action, checked here as well as by RLS
  // because Cloudflare has no notion of our roles.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { ok: false, error: 'Provisioning requires an admin account.' };
  }

  const { data: site } = await supabase
    .from('sites')
    .select('id, name, subdomain, pages_project')
    .eq('id', siteId)
    .single();

  if (!site) return { ok: false, error: 'Site not found.' };

  if (site.pages_project) {
    return {
      ok: false,
      error: `Already provisioned as "${site.pages_project}". Delete that project in Cloudflare first if you need to start again.`,
    };
  }

  const projectName = toProjectName(requestedName || site.subdomain || site.name);

  if (projectName.length < 3) {
    return { ok: false, error: 'Project name must be at least 3 characters.' };
  }

  /*
   * Checked before creating so a name clash reads as a name clash. Cloudflare's
   * own error for this is generic enough to send someone looking in the wrong
   * place.
   */
  if (await projectExists(projectName)) {
    return {
      ok: false,
      error: `A Cloudflare project called "${projectName}" already exists. Choose another name.`,
    };
  }

  const enquiryEndpoint = process.env.ENQUIRY_ENDPOINT;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!enquiryEndpoint || !supabaseUrl || !supabaseServiceKey) {
    return {
      ok: false,
      error:
        'The portal is missing configuration the new site needs: ENQUIRY_ENDPOINT, ' +
        'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must all be set on this worker.',
    };
  }

  const created = await createPagesProject({
    projectName,
    siteId: site.id,
    enquiryEndpoint,
    supabaseUrl,
    supabaseServiceKey,
  });

  if (!created.ok) {
    return { ok: false, error: `Cloudflare rejected the project: ${created.error}` };
  }

  /*
   * Recorded before the build is triggered. If the trigger fails the project
   * still exists, and a site that forgot its project name would be provisioned
   * twice — leaving an orphan nobody knows about.
   */
  const { error: saveError } = await supabase
    .from('sites')
    .update({ pages_project: projectName })
    .eq('id', siteId);

  if (saveError) {
    return {
      ok: false,
      error:
        `Cloudflare project "${projectName}" was created, but recording it failed: ` +
        `${saveError.message}. Set it on the site before provisioning again.`,
    };
  }

  // Best effort: a project that exists but has not built yet is a working
  // state, and the first push would build it anyway.
  const deployment = await triggerDeployment(projectName);

  revalidatePath(`/sites/${siteId}`);

  return {
    ok: true,
    projectName,
    url: `https://${projectName}.pages.dev`,
    deploymentQueued: deployment.ok,
  };
}
