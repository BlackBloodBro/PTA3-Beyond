-- Backfills a random gender (uniform 50/50 male/female, no per-species ratio data exists) for
-- every existing Pokemon that doesn't have one yet, same reasoning as the nature backfill: the
-- gender picker didn't exist until now, so anything created before it was left null.
update pokemon
set gender = (case when random() < 0.5 then 'male' else 'female' end)
where gender is null;
