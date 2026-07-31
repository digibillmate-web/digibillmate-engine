'use client';

/**
 * Editable, schema-driven form for one block instance.
 *
 * Holds a working copy of the block's content, edits it through the recursive
 * FieldInput tree, and saves via the server action. Keys present in the stored
 * content but absent from the schema are carried through untouched on save —
 * the form cannot show them, so it must not be the thing that deletes them.
 */
import { useState } from 'react';
import FieldInput from '@/components/fields/FieldInput';
import { humanize, type Field } from '@/lib/schema-to-fields';
import { saveBlockContent } from '@/app/sites/[siteId]/actions';

type Content = Record<string, unknown>;

interface Props {
  siteId: string;
  blockId: string;
  /** block_definitions.key — groups this block's uploads in the bucket. */
  blockKey: string;
  fields: Field[];
  initialContent: Content;
  unmapped: string[];
}

export default function SchemaForm({
  siteId,
  blockId,
  blockKey,
  fields,
  initialContent,
  unmapped,
}: Props) {
  const [content, setContent] = useState<Content>(initialContent);
  const [saved, setSaved] = useState<Content>(initialContent);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const dirty = JSON.stringify(content) !== JSON.stringify(saved);

  function setKey(name: string, value: unknown) {
    setContent((prev) => ({ ...prev, [name]: value }));
    setMessage(null);
  }

  async function onSave() {
    setBusy(true);
    setMessage(null);

    // Preserve unmapped keys: start from what was stored, overlay the form.
    const payload: Content = { ...saved, ...content };

    const result = await saveBlockContent(siteId, blockId, payload);

    if (result.ok) {
      setSaved(payload);
      setContent(payload);
      setMessage({ kind: 'ok', text: 'Saved' });
    } else {
      setMessage({ kind: 'error', text: result.error ?? 'Save failed' });
    }

    setBusy(false);
  }

  function onRevert() {
    setContent(saved);
    setMessage(null);
  }

  if (fields.length === 0) {
    return <p className="cell-muted">This block definition has no schema properties.</p>;
  }

  return (
    <div>
      {fields.map((field) => (
        <FieldInput
          key={field.name}
          field={field}
          value={content[field.name]}
          idPath={`${blockId}-${field.name}`}
          uploadPrefix={`${siteId}/${blockKey}`}
          onChange={(next) => setKey(field.name, next)}
        />
      ))}

      {unmapped.length > 0 && (
        <p className="unmapped">
          Stored but not in schema: {unmapped.map(humanize).join(', ')} — not editable here,
          preserved on save.
        </p>
      )}

      <div className="form-bar">
        <button className="btn btn--primary" type="button" onClick={onSave} disabled={busy || !dirty}>
          {busy ? 'Saving…' : 'Save'}
        </button>

        <button
          className="btn btn--ghost"
          type="button"
          onClick={onRevert}
          disabled={busy || !dirty}
        >
          Revert
        </button>

        {dirty && !message && <span className="form-bar__note">Unsaved changes</span>}

        {message && (
          <span className={`form-bar__note form-bar__note--${message.kind}`}>{message.text}</span>
        )}
      </div>
    </div>
  );
}
