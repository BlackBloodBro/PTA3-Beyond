-- [[Feature - Add a combat encounter tracker]]: per the user (2026-09-08) -- "down" shouldn't be a
-- manually-toggled GM flag at all; it should just be whether the combatant's own current HP has hit
-- 0, the same real HP already tracked on trainers/pokemon everywhere else in this app. A separate
-- is_down column can only ever drift from that (a GM forgetting to flip it, or flipping it when they
-- shouldn't), so it's dropped outright rather than kept unused -- the app now derives "down" by
-- reading current_hp directly, same source of truth as every HP display already uses.
alter table encounter_combatants drop column is_down;
