'use client';

/**
 * Image field: preview + upload to the site-media bucket, with the resolved
 * public URL written back into the block content.
 *
 * Uploads go straight from the browser on the user's own session. The
 * "site-media admin insert" policy from migration 0006 is what authorises
 * them, so a non-admin session is rejected by Postgres rather than by a check
 * here. No service-role key is involved.
 */
import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const BUCKET = 'site-media';

/** Mirrors allowed_mime_types in migration 0006. */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif'];

/** Mirrors file_size_limit (10 MB) in migration 0006. */
const MAX_BYTES = 10 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Safe, collision-resistant object path: <siteId>/<block>/<time>-<name>. */
function objectPath(prefix: string, fileName: string) {
  const clean = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-80);

  return `${prefix}/${Date.now()}-${clean || 'image'}`;
}

interface Props {
  id: string;
  value: string;
  onChange: (next: string) => void;
  /** "<siteId>/<blockKey>" — groups a site's media together in the bucket. */
  uploadPrefix: string;
}

export default function ImageField({ id, value, onChange, uploadPrefix }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  const src = value ?? '';
  // A root-relative path belongs to the built site's origin, not this app's,
  // so it cannot render here. Say so rather than showing a broken image.
  const isRelative = src.startsWith('/');

  async function onFile(file: File) {
    setError(null);

    // Validate before the network call so the failure is immediate and the
    // message is ours, not a generic 400 from the storage API.
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(
        `${file.type || 'That file type'} is not allowed. Use JPEG, PNG, WebP, SVG or GIF.`,
      );
      return;
    }

    if (file.size > MAX_BYTES) {
      setError(`${formatBytes(file.size)} exceeds the ${formatBytes(MAX_BYTES)} limit.`);
      return;
    }

    setBusy(true);

    const supabase = createClient();
    const path = objectPath(uploadPrefix, file.name);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });

    if (uploadError) {
      setError(uploadError.message);
      setBusy(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(path);

    setPreviewFailed(false);
    onChange(publicUrl);
    setBusy(false);
  }

  return (
    <div className="imgf">
      <div className="imgf__row">
        <div className="imgf__preview">
          {src && !previewFailed && !isRelative ? (
            <img src={src} alt="" onError={() => setPreviewFailed(true)} />
          ) : (
            <span className="imgf__nopreview">
              {!src ? 'No image' : isRelative ? 'Site-relative' : 'Preview failed'}
            </span>
          )}
        </div>

        <div className="imgf__controls">
          <input
            id={id}
            type="text"
            className="ef__input"
            value={src}
            placeholder="/placeholders/example.svg or an uploaded URL"
            onChange={(e) => {
              setPreviewFailed(false);
              onChange(e.target.value);
            }}
          />

          <div className="imgf__actions">
            <input
              ref={inputRef}
              type="file"
              accept={ALLOWED_TYPES.join(',')}
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
                // Reset so re-picking the same file fires change again.
                e.target.value = '';
              }}
            />

            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? 'Uploading…' : src ? 'Replace image' : 'Upload image'}
            </button>

            {src && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={busy}
                onClick={() => {
                  setPreviewFailed(false);
                  setError(null);
                  onChange('');
                }}
              >
                Clear
              </button>
            )}

            <span className="imgf__hint">JPEG, PNG, WebP, SVG, GIF · max 10 MB</span>
          </div>

          {isRelative && src && (
            <p className="imgf__note">
              Points at the built site&apos;s own files, so it cannot preview here. It still
              renders on the site.
            </p>
          )}

          {error && (
            <p className="imgf__error" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
