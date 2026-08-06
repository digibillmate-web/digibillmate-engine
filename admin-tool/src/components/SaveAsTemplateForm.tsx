'use client';

/**
 * Promotes a finished site to a reusable template.
 *
 * Deliberately not a template builder. Building one would mean a second editor
 * for arranging blocks — the thing the site editor already does — used a few
 * times a year. Here the site editor is the template editor, and this is the
 * save button.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveSiteAsTemplate } from '@/app/sites/[siteId]/template-actions';

export interface TemplateOption {
  id: string;
  name: string;
  industry: string | null;
}

export default function SaveAsTemplateForm({
  siteId,
  siteName,
  industries,
  templates,
}: {
  siteId: string;
  siteName: string;
  /** Existing industry labels, so the same trade is not typed three ways. */
  industries: string[];
  templates: TemplateOption[];
}) {
  const router = useRouter();
  const [name, setName] = useState(`${siteName} template`);
  const [industry, setIndustry] = useState(industries[0] ?? '');
  const [description, setDescription] = useState('');
  const [overwriteId, setOverwriteId] = useState('');
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveSiteAsTemplate(siteId, {
        name,
        industry,
        description,
        overwriteId: overwriteId || undefined,
      });

      if (!result.ok) {
        setMessage({ kind: 'error', text: result.error ?? 'Could not save the template.' });
        return;
      }

      setMessage({
        kind: 'ok',
        text: `Saved ${result.pages} page(s) and ${result.blocks} block(s) as a template.`,
      });
      router.refresh();
    });
  }

  return (
    <section className="card settings-card">
      <h2 className="settings-card__title">Save as template</h2>
      <p className="settings-card__hint">
        Captures this site&rsquo;s pages, blocks, content and theme so new sites can start from
        it. This is how a new industry is added — build one site properly, then save it.
      </p>

      <div className="ef">
        <label className="ef__label" htmlFor="tpl-target">
          Save as
        </label>
        <select
          id="tpl-target"
          className="ef__input"
          value={overwriteId}
          disabled={pending}
          onChange={(e) => setOverwriteId(e.target.value)}
        >
          <option value="">A new template</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              Replace &ldquo;{template.name}&rdquo;
            </option>
          ))}
        </select>
        <p className="newsite__hint">
          Replacing changes what future sites are built from. Sites already built are untouched.
        </p>
      </div>

      {!overwriteId && (
        <>
          <div className="ef">
            <label className="ef__label" htmlFor="tpl-name">
              Template name
            </label>
            <input
              id="tpl-name"
              className="ef__input"
              value={name}
              disabled={pending}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="ef">
            <label className="ef__label" htmlFor="tpl-industry">
              Industry
            </label>
            <input
              id="tpl-industry"
              className="ef__input"
              value={industry}
              list="tpl-industries"
              placeholder="Automotive"
              disabled={pending}
              onChange={(e) => setIndustry(e.target.value)}
            />
            {/* Existing labels offered, new ones still typeable: an industry
                exists as soon as a template claims it. */}
            <datalist id="tpl-industries">
              {industries.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
            <p className="newsite__hint">
              Pick an existing industry or type a new one to start a new group.
            </p>
          </div>

          <div className="ef">
            <label className="ef__label" htmlFor="tpl-desc">
              Description
            </label>
            <input
              id="tpl-desc"
              className="ef__input"
              value={description}
              placeholder="What kind of business this suits"
              disabled={pending}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </>
      )}

      {message && (
        <div className={`alert alert--${message.kind === 'ok' ? 'info' : 'error'}`} role="alert">
          {message.text}
        </div>
      )}

      <div className="form-bar">
        <button
          className="btn btn--primary"
          type="button"
          onClick={save}
          disabled={pending || (!overwriteId && (!name.trim() || !industry.trim()))}
        >
          {pending ? 'Saving…' : overwriteId ? 'Replace template' : 'Save as new template'}
        </button>
      </div>
    </section>
  );
}
