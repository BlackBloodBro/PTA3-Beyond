-- The spreadsheet's "Dexpage" column is just a page reference into the user's own Pokedex PDF
-- (shared across an entire evolution family, e.g. Bulbasaur/Ivysaur/Venusaur all show the same
-- value) -- not a stable per-species identifier. Dropping dex_number entirely; pokedex.id (serial)
-- is the real unique key, with name also made unique since it's now the natural lookup key for
-- linking relationship rows during data imports.
alter table pokedex drop column dex_number;
alter table pokedex add constraint pokedex_name_key unique (name);
