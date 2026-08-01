import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'site-media';

export interface SiteStorageUsage {
  fileCount: number;
  totalBytes: number;
}

/**
 * Sums a site's uploads under site-media/<siteId>/**.
 *
 * Two list() calls deep because Supabase Storage has no recursive listing:
 * the site folder holds one subfolder per block key, and files sit inside
 * those. Mirrors the same walk used to clean up a site's media on delete.
 */
export async function getSiteStorageUsage(
  supabase: SupabaseClient,
  siteId: string,
): Promise<SiteStorageUsage> {
  let fileCount = 0;
  let totalBytes = 0;

  const { data: entries } = await supabase.storage.from(BUCKET).list(siteId, { limit: 1000 });

  for (const entry of entries ?? []) {
    // An id means it's a file, not a folder placeholder.
    if (entry.id) {
      fileCount++;
      totalBytes += entry.metadata?.size ?? 0;
      continue;
    }

    const { data: files } = await supabase.storage
      .from(BUCKET)
      .list(`${siteId}/${entry.name}`, { limit: 1000 });

    for (const file of files ?? []) {
      fileCount++;
      totalBytes += file.metadata?.size ?? 0;
    }
  }

  return { fileCount, totalBytes };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
