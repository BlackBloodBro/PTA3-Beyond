-- [[Feature - Add a combat encounter tracker]]: reworked per the user's live-testing feedback
-- (2026-09-08). Two real changes to the original design:
--
-- 1. A Draft encounter's combatants (NPCs + their own Team Pokemon, Wild Pokemon) get NO initiative
--    at all while still in Draft -- deferred until the GM actually starts the fight, so it reflects
--    each combatant's stats at the moment combat truly begins, not whenever they happened to be
--    prepped (which could be a session or more earlier). `turn_order` is therefore now optional.
--
-- 2. No more 'ended' status -- a finished encounter is either reset back to 'draft' (an explicit,
--    warned action, since it clears turn order and current turn back to the start) or genuinely
--    deleted. Simpler than archiving a third state that nothing in the resolved design actually reads
--    from again.
alter table encounter_combatants alter column turn_order drop not null;

update encounters set status = 'draft' where status = 'ended';
alter table encounters drop constraint encounters_status_check;
alter table encounters add constraint encounters_status_check check (status in ('draft', 'active'));
