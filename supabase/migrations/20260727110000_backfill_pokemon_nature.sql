-- Backfills a random nature for every existing Pokemon that doesn't have one yet -- the starter
-- flow didn't assign natures at all until the nature-picker pass, so anything created before that
-- was left with nature_id null. The subquery is correlated (re-evaluated per row via order by
-- random()), so each Pokemon gets its own independent random nature rather than all sharing one.
update pokemon
set nature_id = (select id from natures order by random() limit 1)
where nature_id is null;
