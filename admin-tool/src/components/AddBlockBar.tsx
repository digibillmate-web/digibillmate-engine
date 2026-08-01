'use client';

/**
 * Adds a block from the catalog to this site.
 *
 * The catalog is every block_definitions row, not just the ones the archetype
 * uses — a site can legitimately want a block its archetype never included.
 * Definitions already on the site are still offered, since a page may want
 * two galleries or two service grids.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addBlock } from '@/app/sites/[siteId]/block-actions';

export interface CatalogEntry {
  id: string;
  key: string;
  name: string;
  inUse: boolean;
}

export default function AddBlockBar({
  siteId,
  pageId,
  catalog,
}: {
  siteId: string;
  /** Blocks belong to a page, so the target page is explicit. */
  pageId: string;
  catalog: CatalogEntry[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(catalog[0]?.id ?? '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function add() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const result = await addBlock(siteId, selected, pageId);
      if (!result.ok) {
        setError(result.error ?? 'Could not add the block.');
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="addblock">
      <div className="addblock__row">
        <label className="ef__label" htmlFor="addblock-select">
          Add a block
        </label>
        <select
          id="addblock-select"
          className="ef__input"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {catalog.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
              {entry.inUse ? ' — already on this site' : ''}
            </option>
          ))}
        </select>
        <button className="btn btn--ghost" type="button" onClick={add} disabled={pending || !selected}>
          {pending ? 'Adding…' : 'Add block'}
        </button>
      </div>

      <p className="newsite__hint">
        Added to the end of the page you are editing, empty and ready to fill in. This forks the
        site from its archetype.
      </p>

      {error && (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
