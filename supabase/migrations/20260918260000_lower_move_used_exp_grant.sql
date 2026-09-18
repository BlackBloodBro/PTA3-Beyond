-- [[Feature - Add triggers for a Pokemon to gain EXP automatically]]: per the user, the first-pass
-- "Move used" grant (2 EXP, seeded in 20260918250000_exp_grant_triggers.sql) is too generous -- lowered
-- to 1. Still first-pass/unplaytested data, still trivially retunable via the Customization page's
-- EXP settings section rather than something to get exactly right now.
update exp_grant_events set exp = 1 where name = 'Move used';
