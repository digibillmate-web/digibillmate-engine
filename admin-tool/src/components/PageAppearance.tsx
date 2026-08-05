'use client';

/**
 * Per-page accents and reveal style.
 *
 * The site theme is the master and this is a delta: each colour shows the
 * site's value until the page sets its own, and "Use site colour" puts it
 * back. Presenting it that way is the point — an operator should be able to
 * see at a glance that a page has drifted, and undo it in one click.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updatePageAppearance } from '@/app/sites/[siteId]/page-actions';
import { PAGE_OVERRIDE_TOKENS, REVEAL_OPTIONS } from '@/lib/page-appearance';
import { toColorInputValue, type ThemeValues } from '@/lib/theme';

export default function PageAppearance({
  siteId,
  pageId,
  pageTitle,
  siteTheme,
  initialOverrides,
  initialReveal,
}: {
  siteId: string;
  pageId: string;
  pageTitle: string;
  /** What the page inherits when it overrides nothing. */
  siteTheme: ThemeValues;
  initialOverrides: Record<string, string>;
  initialReveal: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>(initialOverrides);
  const [reveal, setReveal] = useState(initialReveal);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const overrideCount = Object.keys(overrides).length;

  function setToken(key: string, value: string) {
    setOverrides((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function clearToken(key: string) {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setSaved(false);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updatePageAppearance(siteId, pageId, {
        overrides,
        revealAnimation: reveal,
      });
      if (!result.ok) {
        setError(result.error ?? 'Could not save.');
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  const badge =
    overrideCount > 0
      ? `${overrideCount} colour${overrideCount === 1 ? '' : 's'} overridden`
      : 'Following site theme';

  return (
    <div className="appearance">
      <button
        type="button"
        className="appearance__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '▾' : '▸'} Page appearance <span className="appearance__badge">{badge}</span>
      </button>

      {open && (
        <div className="appearance__body">
          <p className="newsite__hint">
            Colours set here apply to <strong>{pageTitle}</strong> only, and win over the site
            theme. Anything left on the site colour follows the Theme tab.
          </p>

          {PAGE_OVERRIDE_TOKENS.map((token) => {
            const overridden = token.key in overrides;
            const inherited = siteTheme[token.key] ?? '';
            const value = overridden ? overrides[token.key] : inherited;
            const picker = toColorInputValue(value);

            return (
              <div className="ef" key={token.key}>
                <label className="ef__label" htmlFor={`pg-${token.key}`}>
                  {token.label}
                  {overridden && <span className="themetoken__changed">page</span>}
                </label>

                <div className="themetoken__row">
                  <input
                    type="color"
                    className="themetoken__swatch"
                    aria-label={`${token.label} colour picker`}
                    value={picker ?? '#000000'}
                    disabled={pending}
                    onChange={(e) => setToken(token.key, e.target.value)}
                  />
                  <input
                    id={`pg-${token.key}`}
                    className="ef__input"
                    value={overridden ? overrides[token.key] : ''}
                    placeholder={inherited || 'Site colour'}
                    disabled={pending}
                    onChange={(e) => setToken(token.key, e.target.value)}
                  />
                  {overridden && (
                    <button
                      type="button"
                      className="btn btn--ghost"
                      disabled={pending}
                      onClick={() => clearToken(token.key)}
                    >
                      Use site colour
                    </button>
                  )}
                </div>

                <p className="newsite__hint">{token.hint}</p>
              </div>
            );
          })}

          <div className="ef">
            <label className="ef__label" htmlFor={`pg-reveal-${pageId}`}>
              Scroll animation
            </label>
            <select
              id={`pg-reveal-${pageId}`}
              className="ef__input"
              value={reveal}
              disabled={pending}
              onChange={(e) => {
                setReveal(e.target.value);
                setSaved(false);
              }}
            >
              {REVEAL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="newsite__hint">
              How sections arrive as you scroll this page.
            </p>
          </div>

          {error && (
            <div className="alert alert--error" role="alert">
              {error}
            </div>
          )}

          <div className="form-bar">
            <button
              className="btn btn--primary"
              type="button"
              onClick={save}
              disabled={pending}
            >
              {pending ? 'Saving…' : 'Save page appearance'}
            </button>
            {saved && !pending && (
              <span className="form-bar__note form-bar__note--ok">Saved</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
