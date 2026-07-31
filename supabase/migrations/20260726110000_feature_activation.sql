-- Distinguishes passive features (always in effect) from active ones (the trainer spends an
-- action / has limited uses), per the user's request to make active features more visible and
-- let their uses be tracked.
--
-- ASSUMPTION: there's no structured "activation type" in the source tracking sheet, so this is a
-- best-effort heuristic classification of the existing 206 seeded rows based on their description
-- text (action-economy phrases like "as an action", or explicit use limits like "3/day"). It will
-- misclassify some edge cases (e.g. downtime/tutoring abilities phrased as "once per week" get
-- flagged active even though they're not combat actions) -- this is meant as a starting point the
-- user can correct via simple `update features set ... where name = '...'` statements, not a final
-- authoritative tagging.
alter table features
  add column requires_activation boolean not null default false,
  add column max_uses int,
  add column uses_reset_on text check (uses_reset_on in ('turn', 'encounter', 'rest'));

-- Active: explicit action-economy phrasing, or an explicit numeric use limit.
update features set requires_activation = true
where description ~* '\mas an? (free|bonus)? ?action\M'
   or description ~* '\d+\s*/\s*(day|week|turn|encounter)\M'
   or description ~* '\monce per (day|week|turn|encounter)\M';

-- Explicit "X/day" (or "X / day") -> track X uses, resetting on rest (daily reset).
update features set max_uses = (regexp_match(description, '(\d+)\s*/\s*day', 'i'))[1]::int, uses_reset_on = 'rest'
where requires_activation and max_uses is null and description ~* '\d+\s*/\s*day\M';

-- "Once per day" -> 1 use, resets on rest.
update features set max_uses = 1, uses_reset_on = 'rest'
where requires_activation and max_uses is null and description ~* '\monce per day\M';

-- "Once per encounter" -> 1 use, resets on encounter end.
update features set max_uses = 1, uses_reset_on = 'encounter'
where requires_activation and max_uses is null and description ~* '\monce per encounter\M';

-- "Once per turn" -> 1 use, resets each turn.
update features set max_uses = 1, uses_reset_on = 'turn'
where requires_activation and max_uses is null and description ~* '\monce per turn\M';

-- Everything else flagged active (e.g. "once per week", or a bare "as an action" with no stated
-- limit) is left with max_uses/uses_reset_on null -- shown as Active in the UI but without a
-- tracked counter, since there's no reliable count to enforce.
