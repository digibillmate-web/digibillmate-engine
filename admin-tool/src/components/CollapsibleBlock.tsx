'use client';

/**
 * One block, collapsed until asked for.
 *
 * A page of eleven blocks rendered every field at once: roughly 29 screens of
 * scrolling and 176 inputs, so changing one heading meant scrolling past ten
 * sections that were not being edited. Collapsed, the same page is a list you
 * can read in one screen and open a single row of.
 *
 * The summary keeps the block's name, position and status visible, because a
 * collapsed row still has to be identifiable without opening it.
 */
import { useState, type ReactNode } from 'react';

export default function CollapsibleBlock({
  position,
  name,
  blockKey,
  badges,
  controls,
  summary,
  children,
}: {
  position: number;
  name: string;
  blockKey: string;
  badges?: ReactNode;
  /** Reorder/hide/delete, which must stay reachable while collapsed. */
  controls?: ReactNode;
  /** One line of the block's own content, so a closed row is recognisable. */
  summary?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="block__head">
        {/*
         * Only the label toggles. The controls sit alongside it rather than
         * inside it — nesting buttons is invalid, and a delete that also
         * expanded the block would be a trap.
         */}
        <button
          type="button"
          className="block__toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="block__chevron" aria-hidden="true">
            {open ? '▾' : '▸'}
          </span>
          <span className="block__pos">{position}</span>
          <span className="block__labels">
            <span className="block__name">{name}</span>
            {summary && !open && <span className="block__summary">{summary}</span>}
            {(!summary || open) && <code className="block__key">{blockKey}</code>}
          </span>
        </button>

        {badges}
        {controls}
      </header>

      {open && <div className="block__body">{children}</div>}
    </>
  );
}
