# digibillmate-engine

Backend engine and database schema for DigiBillMate — a multi-tenant site builder
where clients own sites, sites are composed of blocks, and archetypes provide
reusable site templates.

## Data model

| Table        | Purpose |
| ------------ | ------- |
| `clients`    | Tenant boundary. Owned by a Supabase `auth.users` row via `owner_id`. |
| `sites`      | Belongs to a client. Optionally instantiated from an archetype. |
| `blocks`     | Ordered, optionally nested content units belonging to a site. |
| `archetypes` | Global template library. Read-only to clients; managed via `service_role`. |

```
auth.users
    └── clients
            └── sites ──(archetype_id)──> archetypes
                    └── blocks (self-referencing via parent_id)
```

## Security

Row Level Security is enabled on all four tables. Access is derived from
`clients.owner_id = auth.uid()` and flows down through `sites` and `blocks` via
the `owns_client()` / `owns_site()` helper functions.

- **authenticated** users read and write only their own clients, sites, and blocks.
- **anon** users may read sites with `status = 'published'` and their visible blocks,
  plus archetypes with `is_published = true`.
- The **service_role** key bypasses RLS. Server-side only — never ship it to a browser.

## Setup

```bash
cp .env.example .env   # then fill in real values
```

Apply migrations with the Supabase CLI:

```bash
supabase db push
```

Or run them directly against Postgres, in order:

```bash
psql "$DATABASE_URL" -f supabase/migrations/0001_init_schema.sql
psql "$DATABASE_URL" -f supabase/migrations/0002_rls_policies.sql
```

## Migrations

Migrations live in `supabase/migrations/` and are applied in filename order.
They are append-only — add a new numbered file rather than editing an applied one.

| File | Contents |
| ---- | -------- |
| `0001_init_schema.sql` | Tables, indexes, `updated_at` triggers |
| `0002_rls_policies.sql` | RLS enablement, ownership helpers, policies |
