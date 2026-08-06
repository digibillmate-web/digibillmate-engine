-- Group templates by industry.
--
-- An archetype is already a site template: "Auto Service & Repair" carries a
-- theme and a starting composition. What was missing is the layer above it —
-- one industry will hold several templates before long (a car wash and a body
-- shop are the same trade, different sites), and the portal had nowhere to
-- say so.
--
-- A label rather than a table, deliberately. Grouping emerges from the value,
-- adding an industry is typing a new one, and there is no join to keep
-- correct. If industries later need attributes of their own — an icon, a
-- default price band — promoting this to a table is a contained change, and
-- speculating on it now would cost more than it saves.

alter table archetypes
  add column if not exists industry text;

comment on column archetypes.industry is
  'Grouping label for the templates overview. Null groups under "Uncategorised".';

-- The existing template is the reason the column exists; leaving it null would
-- put the only template in the "Uncategorised" bucket on first view.
update archetypes
set industry = 'Automotive'
where key = 'auto_service_repair'
  and industry is null;

create index if not exists archetypes_industry_idx on archetypes (industry);
