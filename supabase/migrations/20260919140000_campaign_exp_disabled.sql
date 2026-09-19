-- [[Feature - Fully turn off EXP]]: a per-Campaign switch to stop EXP from driving a Pokemon's Level,
-- letting a GM's players instead learn from a curated, level-independent move list. Same
-- creation-time-snapshot shape as campaigns.lp_disabled (20260919130000) -- not a global-default flip,
-- since this app hosts other real GMs' own Campaigns: every Campaign that exists right now gets
-- backfilled to `false` (EXP stays on, unchanged) before the column's own default becomes `true`, so
-- only Campaigns created from this point forward start with EXP off.
alter table campaigns add column exp_disabled boolean;

update campaigns set exp_disabled = false;

alter table campaigns alter column exp_disabled set not null;
alter table campaigns alter column exp_disabled set default true;

-- Distinct from the existing level_learned column (null there means "TM-eligible" for a move / "always
-- known" for a passive -- an unrelated, already-shipped concept the user confirmed this should NOT
-- reuse). This flags a move as learnable specifically when its species' effective Campaign has EXP off,
-- regardless of level_learned's own value. Shared by both global catalog and Homebrew species, since a
-- Homebrew species' rows are just pokedex_moves rows scoped via its own pokedex.campaign_id -- no
-- separate table needed for the two cases.
alter table pokedex_moves add column learnable_without_exp boolean not null default false;
