-- Move uses ("Usable" tracking) didn't exist until now -- pokemon_moves.uses_remaining/resets_on
-- were columns from the original schema but nothing ever wrote to them (learnMove only inserted
-- pokemon_id + move_id). Backfills every already-learned move's cap from its move's frequency
-- ("N/day" -> N, resets on a trainer's Sleep; anything else stays null/unlimited, e.g. "At will"),
-- the same parsing learnMove now applies going forward (lib/pta3/moveFrequency.ts). Only touches
-- rows that are still null so it's safe to re-run and won't clobber a real in-play use count.
update pokemon_moves pm
set uses_remaining = (regexp_match(m.frequency, '^(\d+)/day$'))[1]::int,
    resets_on = 'rest'
from moves m
where m.id = pm.move_id
  and m.frequency ~ '^\d+/day$'
  and pm.uses_remaining is null;
