'use client';

/**
 * Page list for a site: add, rename, reorder, remove.
 *
 * The home page is deliberately not removable and its slug is fixed — it is
 * what builds to index.html, and a site without one exports nothing.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  createPage,
  updatePage,
  deletePage,
  reorderPages,
  normaliseSlug,
} from '@/app/sites/[siteId]/page-actions';

export interface PageRow {
  id: string;
  slug: string;
  title: string;
  show_in_nav: boolean;
  blockCount: number;
}

export default function PagesManager({
  siteId,
  pages,
  activePageId,
}: {
  siteId: string;
  pages: PageRow[];
  activePageId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [newInNav, setNewInNav] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editInNav, setEditInNav] = useState(true);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? 'Action failed.');
        return;
      }
      after?.();
      router.refresh();
    });
  }

  function onNewTitleChange(value: string) {
    setNewTitle(value);
    if (!slugTouched) setNewSlug(normaliseSlug(value));
  }

  function move(pageId: string, delta: number) {
    const ids = pages.map((p) => p.id);
    const index = ids.indexOf(pageId);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    run(() => reorderPages(siteId, ids));
  }

  function startEdit(page: PageRow) {
    setEditingId(page.id);
    setEditTitle(page.title);
    setEditSlug(page.slug);
    setEditInNav(page.show_in_nav);
    setError(null);
  }

  function confirmDelete(page: PageRow) {
    const typed = window.prompt(
      `Delete the "${page.title}" page and its ${page.blockCount} block(s)?\n\n` +
        `This cannot be undone. Type the page title to confirm:`,
    );
    if (typed === null) return;
    run(() => deletePage(siteId, page.id, typed));
  }

  return (
    <div className="card pages">
      <div className="pages__head">
        <h2 className="settings-card__title">Pages</h2>
        <button
          className="btn btn--ghost btn--sm"
          type="button"
          onClick={() => setAdding((v) => !v)}
          disabled={pending}
        >
          {adding ? 'Cancel' : '+ Add page'}
        </button>
      </div>

      {error && (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      )}

      {adding && (
        <div className="pages__new">
          <div className="newsite__grid">
            <div className="ef">
              <label className="ef__label" htmlFor="np-title">
                Page title<span className="req">*</span>
              </label>
              <input
                id="np-title"
                className="ef__input"
                placeholder="About Us"
                value={newTitle}
                onChange={(e) => onNewTitleChange(e.target.value)}
              />
            </div>
            <div className="ef">
              <label className="ef__label" htmlFor="np-slug">
                URL slug<span className="req">*</span>
              </label>
              <input
                id="np-slug"
                className="ef__input"
                placeholder="about"
                value={newSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setNewSlug(e.target.value.toLowerCase());
                }}
              />
              <p className="newsite__hint">Builds to /{newSlug || 'slug'}/</p>
            </div>
          </div>

          <label className="ef--check">
            <input
              type="checkbox"
              checked={newInNav}
              onChange={(e) => setNewInNav(e.target.checked)}
            />
            <span>Show in navigation</span>
          </label>

          <div className="form-bar">
            <button
              className="btn btn--primary btn--sm"
              type="button"
              disabled={pending || !newTitle.trim() || !newSlug.trim()}
              onClick={() =>
                run(
                  () => createPage(siteId, { slug: newSlug, title: newTitle, showInNav: newInNav }),
                  () => {
                    setAdding(false);
                    setNewTitle('');
                    setNewSlug('');
                    setSlugTouched(false);
                  },
                )
              }
            >
              {pending ? 'Adding…' : 'Add page'}
            </button>
            <span className="form-bar__note">Starts empty — add blocks to it after.</span>
          </div>
        </div>
      )}

      <ul className="pages__list">
        {pages.map((page, index) => {
          const isHome = page.slug === '';
          const isActive = page.id === activePageId;
          const isEditing = editingId === page.id;

          return (
            <li className={`pages__item ${isActive ? 'is-active' : ''}`} key={page.id}>
              {isEditing ? (
                <div className="pages__edit">
                  <div className="newsite__grid">
                    <div className="ef">
                      <label className="ef__label">Title</label>
                      <input
                        className="ef__input"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                      />
                    </div>
                    <div className="ef">
                      <label className="ef__label">Slug</label>
                      <input
                        className="ef__input"
                        value={isHome ? '(home)' : editSlug}
                        disabled={isHome}
                        onChange={(e) => setEditSlug(e.target.value.toLowerCase())}
                      />
                      {isHome && (
                        <p className="newsite__hint">
                          The home page slug is fixed — it is what builds index.html.
                        </p>
                      )}
                    </div>
                  </div>

                  <label className="ef--check">
                    <input
                      type="checkbox"
                      checked={editInNav}
                      onChange={(e) => setEditInNav(e.target.checked)}
                    />
                    <span>Show in navigation</span>
                  </label>

                  <div className="form-bar">
                    <button
                      className="btn btn--primary btn--sm"
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () =>
                            updatePage(siteId, page.id, {
                              slug: editSlug,
                              title: editTitle,
                              showInNav: editInNav,
                            }),
                          () => setEditingId(null),
                        )
                      }
                    >
                      Save
                    </button>
                    <button
                      className="btn btn--ghost btn--sm"
                      type="button"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <Link
                    className="pages__link"
                    href={`/sites/${siteId}?page=${page.id}`}
                    scroll={false}
                  >
                    <span className="pages__title">{page.title}</span>
                    <code className="pages__slug">/{page.slug}</code>
                    <span className="pages__meta">
                      {page.blockCount} block{page.blockCount === 1 ? '' : 's'}
                      {!page.show_in_nav && ' · hidden from nav'}
                    </span>
                  </Link>

                  <div className="pages__actions">
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => move(page.id, -1)}
                      disabled={pending || index === 0}
                      aria-label={`Move ${page.title} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => move(page.id, 1)}
                      disabled={pending || index === pages.length - 1}
                      aria-label={`Move ${page.title} down`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => startEdit(page)}
                      disabled={pending}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm btn--danger-ghost"
                      onClick={() => confirmDelete(page)}
                      disabled={pending || isHome}
                      title={
                        isHome
                          ? 'The home page cannot be deleted'
                          : 'Delete this page and its blocks'
                      }
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
