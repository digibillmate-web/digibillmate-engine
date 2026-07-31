/**
 * Read-only, schema-driven display of one block's content.
 *
 * Checkpoint B: proves the schema drives the field tree correctly before any
 * editing exists. The editable form will consume the same `Field[]`.
 */
import { humanize, type Field } from '@/lib/schema-to-fields';

function valueAt(content: unknown, name: string): unknown {
  if (!content || typeof content !== 'object') return undefined;
  return (content as Record<string, unknown>)[name];
}

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

function ScalarValue({ field, value }: { field: Field; value: unknown }) {
  if (isEmpty(value)) return <span className="val val--empty">empty</span>;

  if (field.kind === 'image') {
    const src = String(value);
    return (
      <span className="val val--image">
        <img src={src} alt="" className="thumb" />
        <code className="val__path">{src}</code>
      </span>
    );
  }

  if (field.kind === 'boolean') {
    return <span className="val">{value ? 'true' : 'false'}</span>;
  }

  return <span className="val">{String(value)}</span>;
}

function FieldView({ field, value }: { field: Field; value: unknown }) {
  // --- object ---
  if (field.kind === 'object' && field.fields?.length) {
    return (
      <div className="fv">
        <div className="fv__label">
          {field.label}
          {field.required && <span className="req">*</span>}
        </div>
        <div className="fv__nested">
          {field.fields.map((child) => (
            <FieldView key={child.name} field={child} value={valueAt(value, child.name)} />
          ))}
        </div>
      </div>
    );
  }

  // --- array ---
  if (field.kind === 'array') {
    const items = Array.isArray(value) ? value : [];

    return (
      <div className="fv">
        <div className="fv__label">
          {field.label}
          {field.required && <span className="req">*</span>}
          <span className="fv__count">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="fv__nested">
            <span className="val val--empty">no items</span>
          </div>
        ) : (
          <ol className="fv__items">
            {items.map((item, index) => (
              <li key={index} className="fv__item">
                {field.item?.fields?.length ? (
                  field.item.fields.map((child) => (
                    <FieldView key={child.name} field={child} value={valueAt(item, child.name)} />
                  ))
                ) : (
                  <ScalarValue field={field.item ?? field} value={item} />
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }

  // --- scalar ---
  return (
    <div className="fv fv--scalar">
      <div className="fv__label">
        {field.label}
        {field.required && <span className="req">*</span>}
      </div>
      <ScalarValue field={field} value={value} />
    </div>
  );
}

export default function SchemaView({
  fields,
  content,
  unmapped,
}: {
  fields: Field[];
  content: unknown;
  unmapped: string[];
}) {
  if (fields.length === 0) {
    return <p className="cell-muted">This block definition has no schema properties.</p>;
  }

  return (
    <>
      {fields.map((field) => (
        <FieldView key={field.name} field={field} value={valueAt(content, field.name)} />
      ))}

      {unmapped.length > 0 && (
        <p className="unmapped">
          Stored but not in schema: {unmapped.map((k) => humanize(k)).join(', ')} — these
          are invisible to the editor.
        </p>
      )}
    </>
  );
}
