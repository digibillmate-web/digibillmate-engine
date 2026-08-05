/**
 * Turns a `block_definitions.schema` value into a field tree the UI can render.
 *
 * This is the same principle the export pipeline uses: the database describes
 * the shape, the code adapts. No block type is special-cased, so adding a
 * block definition in Supabase needs no admin-tool change.
 *
 * The stored schemas are a small JSON-Schema subset:
 *   { type: 'object', properties: {...}, required: [...] }
 *   { type: 'array',  items: {...} }
 *   { type: 'string' | 'number' | 'boolean' }
 */

/** Field names that hold an image reference, so the UI offers an upload. */
const IMAGE_FIELD_NAMES = new Set([
  'image_url',
  'logo_url',
  'photo_url',
  'before_url',
  'after_url',
  'background_image',
  'qr_image_url',
  'avatar_url',
  'icon_url',
]);

/** Fields whose text is long enough to deserve a textarea. */
const LONG_TEXT_NAMES = new Set(['body', 'description', 'quote', 'address', 'tagline', 'copyright']);

export type FieldKind =
  | 'string'
  | 'textarea'
  | 'image'
  | 'number'
  | 'boolean'
  | 'select'
  | 'object'
  | 'array'
  | 'unknown';

export interface Field {
  /** Key within its parent object; '' for an array's item template. */
  name: string;
  /** Dotted path from the block content root, e.g. "services.0.name". */
  path: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  /** For kind === 'object'. */
  fields?: Field[];
  /** For kind === 'array' — the shape of one item. */
  item?: Field;
  /** For kind === 'select' — the only values the schema allows. */
  options?: string[];
}

export function isImageField(name: string): boolean {
  return IMAGE_FIELD_NAMES.has(name) || /(^|_)(image|photo|logo|avatar)_url$/.test(name);
}

/** "background_image" -> "Background image" */
export function humanize(name: string): string {
  if (!name) return '';
  const spaced = name.replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  /** A closed set of allowed values, rendered as a picker rather than a box. */
  enum?: string[];
}

function kindFor(name: string, schema: JsonSchema): FieldKind {
  switch (schema.type) {
    case 'object':
      return 'object';
    case 'array':
      return 'array';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'string':
      // A closed set is a choice, and a text box for it invites a typo that
      // saves cleanly and then renders nothing.
      if (Array.isArray(schema.enum) && schema.enum.length > 0) return 'select';
      if (isImageField(name)) return 'image';
      if (LONG_TEXT_NAMES.has(name)) return 'textarea';
      return 'string';
    default:
      // No declared type. An object with properties is still an object;
      // anything else is treated as free text rather than silently dropped.
      if (schema.properties) return 'object';
      if (schema.items) return 'array';
      return 'unknown';
  }
}

function buildField(name: string, schema: JsonSchema, path: string, required: boolean): Field {
  const kind = kindFor(name, schema);

  const field: Field = {
    name,
    path,
    label: humanize(name),
    kind,
    required,
  };

  if (kind === 'select' && schema.enum) {
    field.options = schema.enum;
  }

  if (kind === 'object' && schema.properties) {
    field.fields = fieldsFromProperties(schema, path);
  }

  if (kind === 'array') {
    // Item path uses a placeholder index; callers substitute the real one.
    field.item = buildField('', schema.items ?? {}, `${path}.#`, false);
  }

  return field;
}

function fieldsFromProperties(schema: JsonSchema, basePath: string): Field[] {
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);

  return Object.entries(properties).map(([name, child]) =>
    buildField(name, child, basePath ? `${basePath}.${name}` : name, required.has(name)),
  );
}

/**
 * Top-level entry point: the fields of one block's content object.
 *
 * `preferredOrder` fixes the field order. Postgres does not preserve jsonb key
 * order — it stores keys by length then alphabetically — so without this the
 * form order is effectively arbitrary, and important fields can end up below
 * incidental ones. block_definitions.client_editable_fields is a genuine
 * ordered array listing the fields that matter most, so it doubles as the
 * display order; anything it omits follows, in whatever order it arrives.
 */
export function schemaToFields(schema: unknown, preferredOrder: string[] = []): Field[] {
  if (!schema || typeof schema !== 'object') return [];

  const fields = fieldsFromProperties(schema as JsonSchema, '');
  if (preferredOrder.length === 0) return fields;

  const rank = new Map(preferredOrder.map((name, index) => [name, index]));

  return [...fields].sort((a, b) => {
    const ra = rank.get(a.name) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b.name) ?? Number.MAX_SAFE_INTEGER;
    return ra - rb;
  });
}

/**
 * A blank content object matching a schema, for a newly added block.
 *
 * Required scalars get an empty string rather than being omitted, so the form
 * renders every field the schema promises instead of only the ones that
 * happen to exist. Arrays start empty — an operator adds items deliberately.
 */
export function emptyContentFromSchema(schema: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const field of schemaToFields(schema)) {
    out[field.name] = emptyValueForField(field);
  }

  return out;
}

function emptyValueForField(field: Field): unknown {
  switch (field.kind) {
    case 'object': {
      const nested: Record<string, unknown> = {};
      for (const child of field.fields ?? []) nested[child.name] = emptyValueForField(child);
      return nested;
    }
    case 'array':
      return [];
    case 'boolean':
      return false;
    default:
      return '';
  }
}

/**
 * Keys present in stored content but absent from the schema. Surfacing these
 * matters: they are invisible to the form, so an unwitting save could drop
 * them.
 */
export function unmappedKeys(content: unknown, fields: Field[]): string[] {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return [];
  const known = new Set(fields.map((f) => f.name));
  return Object.keys(content as Record<string, unknown>).filter((key) => !known.has(key));
}
