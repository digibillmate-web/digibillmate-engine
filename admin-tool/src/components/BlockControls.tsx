'use client';

/**
 * Per-block composition controls: move, hide/restore, delete.
 *
 * Up/down buttons rather than drag-and-drop — see AddBlockBar for the
 * reasoning. Every action here forks the site from its archetype.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { reorderBlocks, setBlockHidden, deleteBlock } from '@/app/sites/[siteId]/block-actions';

export default function BlockControls({
  siteId,
  pageId,
  blockId,
  blockName,
  isHidden,
  orderedIds,
}: {
  siteId: string;
  /** Positions are per page, so every action is scoped to one. */
  pageId: string;
  blockId: string;
  blockName: string;
  isHidden: boolean;
  /** Current order of every block on this page, hidden ones included. */
  orderedIds: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const index = orderedIds.indexOf(blockId);
  const isFirst = index <= 0;
  const isLast = index === orderedIds.length - 1;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? 'Action failed.');
        return;
      }
      router.refresh();
    });
  }

  function move(delta: number) {
    const next = [...orderedIds];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    run(() => reorderBlocks(siteId, pageId, next));
  }

  return (
    <div className="blockctl">
      {error && <span className="blockctl__error">{error}</span>}

      <button
        type="button"
        className="btn-icon"
        onClick={() => move(-1)}
        disabled={pending || isFirst}
        aria-label={`Move ${blockName} up`}
        title="Move up"
      >
        ↑
      </button>

      <button
        type="button"
        className="btn-icon"
        onClick={() => move(1)}
        disabled={pending || isLast}
        aria-label={`Move ${blockName} down`}
        title="Move down"
      >
        ↓
      </button>

      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={() => run(() => setBlockHidden(siteId, blockId, !isHidden))}
        disabled={pending}
        title={
          isHidden
            ? 'Show this block on the built site again'
            : 'Keep the content but leave it off the built site'
        }
      >
        {isHidden ? 'Restore' : 'Hide'}
      </button>

      <button
        type="button"
        className="btn btn--ghost btn--sm btn--danger-ghost"
        onClick={() => {
          if (
            !window.confirm(
              `Permanently delete the "${blockName}" block and its content from this site?\n\n` +
                'Hiding keeps the content and is reversible. This is not.',
            )
          ) {
            return;
          }
          run(() => deleteBlock(siteId, pageId, blockId));
        }}
        disabled={pending}
        title="Delete this block and its content permanently"
      >
        Delete
      </button>
    </div>
  );
}
