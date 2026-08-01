'use client';

/**
 * Theme editor with a live preview.
 *
 * Hex codes are unreadable on their own, so every change is reflected in a
 * miniature of the real site chrome — a heading, body copy, a primary button
 * and a dark footer bar — using the same tokens the components consume.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveTheme, relinkTheme } from '@/app/sites/[siteId]/theme-actions';
import ImageField from '@/components/fields/ImageField';
import {
  THEME_TOKENS,
  primaryFamily,
  toColorInputValue,
  type ThemeValues,
} from '@/lib/theme';

export default function ThemeForm({
  siteId,
  archetypeName,
  themeLinked,
  effective,
}: {
  siteId: string;
  archetypeName: string;
  themeLinked: boolean;
  /** What the site renders with today: archetype defaults under site overrides. */
  effective: ThemeValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ThemeValues>(effective);
  const [saved, setSaved] = useState<ThemeValues>(effective);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const changedKeys = THEME_TOKENS.filter(
    (token) => (values[token.key] ?? '') !== (saved[token.key] ?? ''),
  ).map((token) => token.key);

  const dirty = changedKeys.length > 0;

  function set(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setMessage(null);
  }

  async function onSave() {
    setBusy(true);
    setMessage(null);

    const result = await saveTheme(siteId, values);

    if (result.ok) {
      setSaved(values);
      setMessage({
        kind: 'ok',
        text: result.forked
          ? 'Theme saved — this site no longer follows its archetype theme'
          : 'Theme saved',
      });
      router.refresh();
    } else {
      setMessage({ kind: 'error', text: result.error ?? 'Could not save the theme.' });
    }

    setBusy(false);
  }

  async function onRelink() {
    setBusy(true);
    setMessage(null);

    const result = await relinkTheme(siteId);

    if (result.ok) {
      setMessage({ kind: 'ok', text: `Theme reset to the ${archetypeName} defaults` });
      router.refresh();
    } else {
      setMessage({ kind: 'error', text: result.error ?? 'Could not reset the theme.' });
    }

    setBusy(false);
  }

  const preview = {
    background: values['color-background'] || '#ffffff',
    text: values['color-text'] || '#222222',
    primary: values['color-primary'] || '#c0392b',
    secondary: values['color-secondary'] || '#1a1a1a',
    heading: values['font-heading'] || 'system-ui, sans-serif',
    body: values['font-body'] || 'system-ui, sans-serif',
  };

  return (
    <div className="themegrid">
      <div className="card themegrid__form">
        {themeLinked && (
          <div className="alert alert--info" role="status">
            This site follows the <strong>{archetypeName}</strong> theme. Saving a change here
            forks it — the site keeps its own colours from then on, and later archetype changes
            will not overwrite them.
          </div>
        )}

        {THEME_TOKENS.map((token) => {
          const raw = values[token.key] ?? '';
          const picker = token.kind === 'color' ? toColorInputValue(raw) : null;
          const changed = changedKeys.includes(token.key);

          return (
            <div className="ef" key={token.key}>
              <label className="ef__label" htmlFor={`t-${token.key}`}>
                {token.label}
                {changed && <span className="themetoken__changed">changed</span>}
              </label>

              {token.kind === 'color' && (
                <div className="themetoken__row">
                  <input
                    type="color"
                    className="themetoken__swatch"
                    aria-label={`${token.label} colour picker`}
                    value={picker ?? '#000000'}
                    onChange={(e) => set(token.key, e.target.value)}
                  />
                  <input
                    id={`t-${token.key}`}
                    className="ef__input"
                    value={raw}
                    placeholder="#c0392b"
                    onChange={(e) => set(token.key, e.target.value)}
                  />
                </div>
              )}

              {(token.kind === 'font' || token.kind === 'text') && (
                <input
                  id={`t-${token.key}`}
                  className="ef__input"
                  value={raw}
                  placeholder={token.hint}
                  onChange={(e) => set(token.key, e.target.value)}
                />
              )}

              {token.kind === 'image' && (
                <ImageField
                  id={`t-${token.key}`}
                  value={raw}
                  uploadPrefix={`${siteId}/theme`}
                  onChange={(next) => set(token.key, next)}
                />
              )}

              <p className="newsite__hint">
                {token.hint}
                {token.kind === 'color' && !picker && raw && ' · not a hex value, picker disabled'}
              </p>
            </div>
          );
        })}

        <div className="form-bar">
          <button className="btn btn--primary" type="button" onClick={onSave} disabled={busy || !dirty}>
            {busy ? 'Saving…' : 'Save theme'}
          </button>

          <button
            className="btn btn--ghost"
            type="button"
            onClick={() => {
              setValues(saved);
              setMessage(null);
            }}
            disabled={busy || !dirty}
          >
            Revert
          </button>

          {!themeLinked && (
            <button className="btn btn--ghost" type="button" onClick={onRelink} disabled={busy}>
              Reset to archetype
            </button>
          )}

          {dirty && !message && (
            <span className="form-bar__note">
              {changedKeys.length} unsaved {changedKeys.length === 1 ? 'change' : 'changes'}
            </span>
          )}

          {message && (
            <span className={`form-bar__note form-bar__note--${message.kind}`}>{message.text}</span>
          )}
        </div>
      </div>

      <div className="themegrid__preview">
        <p className="themepreview__label">Preview</p>

        <div
          className="themepreview"
          style={{ background: preview.background, color: preview.text }}
        >
          <div className="themepreview__bar" style={{ background: preview.secondary }} />

          <div className="themepreview__body">
            <p
              className="themepreview__eyebrow"
              style={{ color: preview.primary, fontFamily: preview.body }}
            >
              TRUSTED SINCE 2008
            </p>
            <h3 style={{ fontFamily: preview.heading, margin: '0 0 .4rem' }}>
              Your Car, Fixed Right.
            </h3>
            <p style={{ fontFamily: preview.body, margin: '0 0 .8rem', fontSize: '.8rem' }}>
              Multi-brand dent removal, painting and rust treatment.
            </p>
            <span
              className="themepreview__btn"
              style={{ background: preview.primary, fontFamily: preview.body }}
            >
              Call Now
            </span>
          </div>

          <div
            className="themepreview__footer"
            style={{ background: preview.secondary, fontFamily: preview.body }}
          >
            © 2026 Maria Cars
          </div>
        </div>

        <dl className="themepreview__legend">
          {THEME_TOKENS.filter((t) => t.kind === 'font').map((token) => (
            <div key={token.key}>
              <dt>{token.label}</dt>
              <dd>{primaryFamily(values[token.key] ?? '') || '—'}</dd>
            </div>
          ))}
        </dl>

        <p className="newsite__hint">
          Fonts render here only if installed locally. The built site self-hosts them.
        </p>
      </div>
    </div>
  );
}
