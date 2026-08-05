'use client';

/**
 * Recursive editor for one schema-derived field.
 *
 * Every kind is handled here rather than in a file per type: the shapes are
 * small, and objects and arrays need to recurse into the same renderer anyway.
 * Image fields render an upload control at checkpoint D; for now they are a
 * URL box with a live thumbnail.
 */
import { humanize, type Field } from '@/lib/schema-to-fields';
import ImageField from '@/components/fields/ImageField';

/** A blank value matching a field's kind, for newly added array items. */
export function emptyValueFor(field: Field): unknown {
  switch (field.kind) {
    case 'object': {
      const out: Record<string, unknown> = {};
      for (const child of field.fields ?? []) out[child.name] = emptyValueFor(child);
      return out;
    }
    case 'array':
      return [];
    case 'boolean':
      return false;
    case 'number':
      return '';
    default:
      return '';
  }
}

interface Props {
  field: Field;
  value: unknown;
  onChange: (next: unknown) => void;
  /**
   * Unique path for this input's DOM id, carrying the block id and any array
   * indices. The schema path alone is not unique — "title" appears in several
   * block types, and every array item repeats its siblings' field names.
   */
  idPath: string;
  /** "<siteId>/<blockKey>" — where uploads for this block are stored. */
  uploadPrefix: string;
  /** Array items render without the outer label, which the list already shows. */
  hideLabel?: boolean;
}

export default function FieldInput({
  field,
  value,
  onChange,
  idPath,
  uploadPrefix,
  hideLabel,
}: Props) {
  const id = `f-${idPath.replace(/[^a-zA-Z0-9]+/g, '-')}`;

  const label = hideLabel ? null : (
    <label className="ef__label" htmlFor={id}>
      {field.label}
      {field.required && <span className="req">*</span>}
    </label>
  );

  // --- object -------------------------------------------------------------
  if (field.kind === 'object' && field.fields?.length) {
    const obj = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;

    return (
      <fieldset className="ef ef--object">
        <legend className="ef__legend">
          {field.label}
          {field.required && <span className="req">*</span>}
        </legend>
        {field.fields.map((child) => (
          <FieldInput
            key={child.name}
            field={child}
            value={obj[child.name]}
            idPath={`${idPath}-${child.name}`}
            uploadPrefix={uploadPrefix}
            onChange={(next) => onChange({ ...obj, [child.name]: next })}
          />
        ))}
      </fieldset>
    );
  }

  // --- array --------------------------------------------------------------
  if (field.kind === 'array' && field.item) {
    const items = Array.isArray(value) ? value : [];

    const replace = (index: number, next: unknown) =>
      onChange(items.map((item, i) => (i === index ? next : item)));

    const remove = (index: number) => onChange(items.filter((_, i) => i !== index));

    const move = (index: number, delta: number) => {
      const target = index + delta;
      if (target < 0 || target >= items.length) return;
      const copy = [...items];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      onChange(copy);
    };

    return (
      <fieldset className="ef ef--array">
        <legend className="ef__legend">
          {field.label}
          {field.required && <span className="req">*</span>}
          <span className="ef__count">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </legend>

        {/* An empty array otherwise renders as a bare "0 items", which reads
            as a disabled field rather than as something to fill in. */}
        {items.length === 0 && (
          <p className="ef__emptyarray">
            No {field.label.toLowerCase()} yet — use the button below to add the first one.
          </p>
        )}

        <ol className="ef__items">
          {items.map((item, index) => (
            <li className="ef__item" key={index}>
              <div className="ef__item-bar">
                <span className="ef__item-n">{index + 1}</span>
                <div className="ef__item-actions">
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${field.label} item ${index + 1} up`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1}
                    aria-label={`Move ${field.label} item ${index + 1} down`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn-icon btn-icon--danger"
                    onClick={() => remove(index)}
                    aria-label={`Remove ${field.label} item ${index + 1}`}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {field.item!.fields?.length ? (
                field.item!.fields.map((child) => (
                  <FieldInput
                    key={child.name}
                    field={child}
                    value={(item as Record<string, unknown>)?.[child.name]}
                    idPath={`${idPath}-${index}-${child.name}`}
                    uploadPrefix={uploadPrefix}
                    onChange={(next) =>
                      replace(index, {
                        ...((item && typeof item === 'object' ? item : {}) as object),
                        [child.name]: next,
                      })
                    }
                  />
                ))
              ) : (
                <FieldInput
                  field={field.item!}
                  value={item}
                  idPath={`${idPath}-${index}`}
                  uploadPrefix={uploadPrefix}
                  onChange={(next) => replace(index, next)}
                  hideLabel
                />
              )}
            </li>
          ))}
        </ol>

        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => onChange([...items, emptyValueFor(field.item!)])}
        >
          + Add {field.label.replace(/s$/, '').toLowerCase()}
        </button>
      </fieldset>
    );
  }

  // --- image --------------------------------------------------------------
  if (field.kind === 'image') {
    return (
      <div className="ef ef--image">
        {label}
        <ImageField
          id={id}
          value={typeof value === 'string' ? value : ''}
          uploadPrefix={uploadPrefix}
          onChange={onChange}
        />
      </div>
    );
  }

  // --- select -------------------------------------------------------------
  if (field.kind === 'select' && field.options?.length) {
    const current = typeof value === 'string' ? value : '';

    return (
      <div className="ef">
        {label}
        <select
          id={id}
          className="ef__input"
          value={current}
          onChange={(e) => onChange(e.target.value)}
        >
          {/* A value outside the schema's list would otherwise vanish from
              the picker and be silently rewritten on the next save. */}
          {!field.required && <option value="">Default</option>}
          {current && !field.options.includes(current) && (
            <option value={current}>{current} (not a valid option)</option>
          )}
          {field.options.map((option) => (
            <option key={option} value={option}>
              {humanize(option)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // --- textarea -----------------------------------------------------------
  if (field.kind === 'textarea') {
    return (
      <div className="ef">
        {label}
        <textarea
          id={id}
          className="ef__input"
          rows={4}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  // --- number -------------------------------------------------------------
  if (field.kind === 'number') {
    return (
      <div className="ef">
        {label}
        <input
          id={id}
          type="number"
          className="ef__input"
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => {
            // Keep an empty box as empty rather than coercing to 0.
            const raw = e.target.value;
            onChange(raw === '' ? '' : Number(raw));
          }}
        />
      </div>
    );
  }

  // --- boolean ------------------------------------------------------------
  if (field.kind === 'boolean') {
    return (
      <div className="ef ef--check">
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        <label htmlFor={id}>{field.label}</label>
      </div>
    );
  }

  // --- string / unknown ---------------------------------------------------
  return (
    <div className="ef">
      {label}
      <input
        id={id}
        type="text"
        className="ef__input"
        value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
