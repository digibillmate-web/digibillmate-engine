'use client';

/**
 * Inline appearance panel for one block.
 *
 * Two jobs. It sets the section background, and it shows which theme tokens
 * this particular block reads — from the Theme tab alone there is no way to
 * tell which sections a colour change will touch.
 *
 * The tokens are shown, not edited. Per-block colour and font overrides would
 * let a site drift into six fonts and ten colours, and the Theme tab would
 * stop meaning anything; the whole point of routing through theme roles is
 * that changing the palette once updates the site consistently.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setBlockBackground } from '@/app/sites/[siteId]/settings-actions';
import { tokensFor, tokenLabel, isFontToken } from '@/lib/block-appearance';
import { primaryFamily, type ThemeValues } from '@/lib/theme';

const BACKGROUNDS = [
  { value: 'default', label: 'Default' },
  { value: 'surface', label: 'Tinted band' },
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Dark' },
];

export default function BlockAppearance({
  siteId,
  blockId,
  blockKey,
  background,
  theme,
}: {
  siteId: string;
  blockId: string;
  blockKey: string;
  background: string;
  /** Effective theme, so swatches show the colours actually in use. */
  theme: ThemeValues;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const tokens = tokensFor(blockKey);

  function change(value: string) {
    setError(null);
    startTransition(async () => {
      const result = await setBlockBackground(siteId, blockId, value);
      if (!result.ok) {
        setError(result.error ?? 'Could not change the background.');
        return;
      }
      router.refresh();
    });
  }

  const activeLabel =
    BACKGROUNDS.find((b) => b.value === background)?.label ?? 'Default';

  return (
    <div className="appearance">
      <button
        type="button"
        className="appearance__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? '▾' : '▸'} Appearance <span className="appearance__badge">{activeLabel}</span>
      </button>

      {open && (
        <div className="appearance__body">
          <div className="appearance__row">
            <label className="ef__label" htmlFor={`bg-${blockId}`}>
              Section background
            </label>
            <select
              id={`bg-${blockId}`}
              className="ef__input appearance__select"
              value={background}
              disabled={pending}
              onChange={(e) => change(e.target.value)}
            >
              {BACKGROUNDS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="alert alert--error" role="alert">
              {error}
            </div>
          )}

          <p className="ef__label appearance__heading">Theme values this block uses</p>

          {tokens.length === 0 ? (
            <p className="newsite__hint">
              This block uses its own brand colours rather than the site theme.
            </p>
          ) : (
            <ul className="appearance__tokens">
              {tokens.map((token) => {
                const value = theme[token] ?? '';
                return (
                  <li key={token}>
                    {isFontToken(token) ? (
                      <span className="appearance__font" style={{ fontFamily: value || undefined }}>
                        Aa
                      </span>
                    ) : (
                      <span
                        className="appearance__swatch"
                        style={{ background: value || 'transparent' }}
                      />
                    )}
                    <span className="appearance__tokenlabel">{tokenLabel(token)}</span>
                    <code className="appearance__tokenvalue">
                      {isFontToken(token) ? primaryFamily(value) || '—' : value || '—'}
                    </code>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="newsite__hint">
            Change any of these on the Theme tab — it updates every block that uses them.
          </p>
        </div>
      )}
    </div>
  );
}
