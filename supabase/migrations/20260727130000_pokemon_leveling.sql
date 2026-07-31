-- Pokemon leveling: level is now ALWAYS computed from current_exp + modifiers (growth rate,
-- capture/obtain method, shininess, loyalty), looked up against the levels(cumulative_exp) table --
-- never stored as a fixed, manually-incremented value the way trainers.level is. Per the user's
-- explicit direction: "the level should not be kept somewhere as a fixed amount, but be
-- calculated every time. Once a modifier changes, the level should reflect that immediately."

-- "catch_modifiers_shiny" was named under the assumption it affected catch rate (grouped with the
-- other catch_modifiers_* tables during the original Lists-sheet import). The user has now
-- confirmed it's actually an EXPERIENCE modifier ("it has nothing to do with catch rate, only exp
-- modifier") -- renamed to reflect what it actually is. Same table, same rows (No -> 1, Yes ->
-- 1.05), just a name that no longer misdescribes it.
alter table catch_modifiers_shiny rename to exp_modifiers_shiny;

-- Loyalty's exp modifier didn't exist as a column at all yet -- values are the user's own homebrew
-- scale (loyalty 0 is a harsh penalty, loyalty 5 is a strong bonus), not derived from anything
-- already in the schema.
alter table loyalties add column modifier numeric;

update loyalties set modifier = 0.5 where name = '0';
update loyalties set modifier = 0.7 where name = '1';
update loyalties set modifier = 1 where name = '2';
update loyalties set modifier = 1.2 where name = '3';
update loyalties set modifier = 1.5 where name = '4';
update loyalties set modifier = 1.8 where name = '5';

alter table loyalties alter column modifier set not null;

-- Nothing should be writing to this anymore -- keeping an unused column around would just be a
-- stale, misleading value sitting in the table once the app stops touching it.
alter table pokemon drop column level;
